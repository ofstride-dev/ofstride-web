import json
import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal
from xml.sax.saxutils import escape

import azure.functions as func

from shared.admin_auth import validate_identity_headers
from shared.db import get_supabase_client


def _err(status_code: int, message: str, trace_id: str) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"success": False, "error": message, "trace_id": trace_id}),
        mimetype="application/json",
        status_code=status_code,
    )


def _num(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _parse_iso_date(value: str) -> datetime.date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _voucher_date(value: str, edu_mode: bool) -> str:
    dt = _parse_iso_date(value)
    if edu_mode:
        dt = dt.replace(day=1)
    return dt.strftime("%Y%m%d")


def _state_code(gstin: str | None) -> str:
    normalized = str(gstin or "").strip()
    if len(normalized) >= 2 and normalized[:2].isdigit():
        return normalized[:2]
    return ""


def _split_gst(total_gst: float, seller_gstin: str | None, buyer_gstin: str | None) -> dict:
    total = round(max(total_gst, 0.0), 2)
    if total <= 0:
        return {"igst": 0.0, "cgst": 0.0, "sgst": 0.0}

    seller_state = _state_code(seller_gstin)
    buyer_state = _state_code(buyer_gstin)

    if seller_state and buyer_state and seller_state == buyer_state:
        half = round(total / 2, 2)
        return {
            "igst": 0.0,
            "cgst": half,
            "sgst": round(total - half, 2),
        }

    return {"igst": total, "cgst": 0.0, "sgst": 0.0}


def _ledger_xml(name: str, amount: float, is_deemed_positive: bool) -> str:
    return (
        "<ALLLEDGERENTRIES.LIST>"
        f"<LEDGERNAME>{escape(name)}</LEDGERNAME>"
        f"<ISDEEMEDPOSITIVE>{'Yes' if is_deemed_positive else 'No'}</ISDEEMEDPOSITIVE>"
        f"<AMOUNT>{amount:.2f}</AMOUNT>"
        "</ALLLEDGERENTRIES.LIST>"
    )


def _purchase_voucher_xml(bill: dict, company_gstin: str | None, edu_mode: bool) -> str:
    amount = _num(bill.get("amount"))
    gst_amount = _num(bill.get("gst_amount"))
    tds_amount = _num(bill.get("tds_amount"))

    vendor = bill.get("cashflow_entities") or {}
    vendor_name = str(vendor.get("name") or "Unknown Vendor")
    vendor_gstin = vendor.get("gstin")

    split = _split_gst(gst_amount, vendor_gstin, company_gstin)
    taxable = round(amount - gst_amount, 2)
    vendor_credit = round(amount - tds_amount, 2)

    ledgers = [
        _ledger_xml("Purchase Account", -taxable, True),
    ]

    if split["igst"] > 0:
        ledgers.append(_ledger_xml("Input IGST", -split["igst"], True))
    else:
        if split["cgst"] > 0:
            ledgers.append(_ledger_xml("Input CGST", -split["cgst"], True))
        if split["sgst"] > 0:
            ledgers.append(_ledger_xml("Input SGST", -split["sgst"], True))

    if tds_amount > 0:
        ledgers.append(_ledger_xml("TDS Payable", tds_amount, False))

    ledgers.append(_ledger_xml(vendor_name, vendor_credit, False))

    date_val = _voucher_date(str(bill.get("bill_date")), edu_mode)
    bill_number = escape(str(bill.get("bill_number") or ""))

    return (
        "<TALLYMESSAGE xmlns:UDF='TallyUDF'>"
        f"<VOUCHER VCHTYPE='Purchase' ACTION='Create'>"
        f"<DATE>{date_val}</DATE>"
        f"<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>"
        f"<VOUCHERNUMBER>{bill_number}</VOUCHERNUMBER>"
        f"<PARTYLEDGERNAME>{escape(vendor_name)}</PARTYLEDGERNAME>"
        + "".join(ledgers) +
        "</VOUCHER>"
        "</TALLYMESSAGE>"
    )


def _sales_voucher_xml(inv: dict, company_gstin: str | None, edu_mode: bool) -> str:
    amount = _num(inv.get("amount"))
    gst_amount = _num(inv.get("gst_amount"))

    customer = inv.get("cashflow_entities") or {}
    customer_name = str(customer.get("name") or "Unknown Customer")
    customer_gstin = customer.get("gstin")

    split = _split_gst(gst_amount, company_gstin, customer_gstin)
    taxable = round(amount - gst_amount, 2)

    ledgers = [
        _ledger_xml(customer_name, -amount, True),
        _ledger_xml("Sales Account", taxable, False),
    ]

    if split["igst"] > 0:
        ledgers.append(_ledger_xml("Output IGST", split["igst"], False))
    else:
        if split["cgst"] > 0:
            ledgers.append(_ledger_xml("Output CGST", split["cgst"], False))
        if split["sgst"] > 0:
            ledgers.append(_ledger_xml("Output SGST", split["sgst"], False))

    date_val = _voucher_date(str(inv.get("invoice_date")), edu_mode)
    inv_number = escape(str(inv.get("invoice_number") or ""))

    return (
        "<TALLYMESSAGE xmlns:UDF='TallyUDF'>"
        f"<VOUCHER VCHTYPE='Sales' ACTION='Create'>"
        f"<DATE>{date_val}</DATE>"
        f"<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>"
        f"<VOUCHERNUMBER>{inv_number}</VOUCHERNUMBER>"
        f"<PARTYLEDGERNAME>{escape(customer_name)}</PARTYLEDGERNAME>"
        + "".join(ledgers) +
        "</VOUCHER>"
        "</TALLYMESSAGE>"
    )


def _petty_voucher_xml(entry: dict, edu_mode: bool) -> str:
    cash_in = _num(entry.get("cash_in"))
    cash_out = _num(entry.get("cash_out"))
    category = str(entry.get("category") or "Misc Expense")

    if cash_out > 0:
        ledgers = [
            _ledger_xml(category, -cash_out, True),
            _ledger_xml("Petty Cash", cash_out, False),
        ]
        vtype = "Payment"
    else:
        ledgers = [
            _ledger_xml("Petty Cash", -cash_in, True),
            _ledger_xml("Bank Account", cash_in, False),
        ]
        vtype = "Receipt"

    date_val = _voucher_date(str(entry.get("entry_date")), edu_mode)
    narration = escape(str(entry.get("description") or "Petty cash entry"))

    return (
        "<TALLYMESSAGE xmlns:UDF='TallyUDF'>"
        f"<VOUCHER VCHTYPE='{vtype}' ACTION='Create'>"
        f"<DATE>{date_val}</DATE>"
        f"<VOUCHERTYPENAME>{vtype}</VOUCHERTYPENAME>"
        f"<NARRATION>{narration}</NARRATION>"
        + "".join(ledgers) +
        "</VOUCHER>"
        "</TALLYMESSAGE>"
    )


def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = str(uuid.uuid4())

    auth = validate_identity_headers(req)
    if not auth.get("ok"):
        return _err(auth.get("status_code", 401), auth.get("error") or "Unauthorized", trace_id)

    start_date = str(req.params.get("start_date") or "").strip()
    end_date = str(req.params.get("end_date") or "").strip()
    edu_mode = str(req.params.get("edu_mode") or "false").strip().lower() == "true"

    if not start_date or not end_date:
        return _err(400, "start_date and end_date are required (YYYY-MM-DD)", trace_id)

    try:
        _parse_iso_date(start_date)
        _parse_iso_date(end_date)
    except ValueError:
        return _err(400, "Invalid date format. Use YYYY-MM-DD", trace_id)

    try:
        supabase = get_supabase_client()
        company_gstin = os.environ.get("COMPANY_GSTIN") or os.environ.get("CASHFLOW_COMPANY_GSTIN")

        bills_res = (
            supabase.table("cashflow_bills")
            .select("*, cashflow_entities!cashflow_bills_vendor_id_fkey(id,name,gstin)")
            .in_("status", ["approved", "paid"])
            .gte("bill_date", start_date)
            .lte("bill_date", end_date)
            .order("bill_date", desc=False)
            .execute()
        )

        invoices_res = (
            supabase.table("cashflow_invoices")
            .select("*, cashflow_entities!cashflow_invoices_customer_id_fkey(id,name,gstin)")
            .in_("status", ["approved", "paid"])
            .eq("is_proforma", False)
            .gte("invoice_date", start_date)
            .lte("invoice_date", end_date)
            .order("invoice_date", desc=False)
            .execute()
        )

        petty_res = (
            supabase.table("cashflow_petty_cash")
            .select("*")
            .gte("entry_date", start_date)
            .lte("entry_date", end_date)
            .order("entry_date", desc=False)
            .execute()
        )

        vouchers = []
        for bill in bills_res.data or []:
            vouchers.append(_purchase_voucher_xml(bill, company_gstin, edu_mode))

        for inv in invoices_res.data or []:
            vouchers.append(_sales_voucher_xml(inv, company_gstin, edu_mode))

        for entry in petty_res.data or []:
            if _num(entry.get("cash_in")) > 0 or _num(entry.get("cash_out")) > 0:
                vouchers.append(_petty_voucher_xml(entry, edu_mode))

        xml_text = (
            "<?xml version='1.0' encoding='UTF-8'?>"
            "<ENVELOPE>"
            "<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>"
            "<BODY><IMPORTDATA>"
            "<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>"
            "<REQUESTDATA>"
            + "".join(vouchers) +
            "</REQUESTDATA>"
            "</IMPORTDATA></BODY>"
            "</ENVELOPE>"
        )

        filename = f"tally_export_{start_date}_to_{end_date}.xml"
        return func.HttpResponse(
            body=xml_text,
            status_code=200,
            mimetype="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Trace-Id": trace_id,
            },
        )
    except Exception as exc:
        logging.error(f"Tally export failed: {str(exc)}")
        return _err(500, str(exc), trace_id)
