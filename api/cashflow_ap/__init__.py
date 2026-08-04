import azure.functions as func
import json
import logging
import os
import base64
import re
from datetime import datetime, timedelta
from shared.db import get_supabase_client
from shared.tax_engine_interface import calculate_tds, calculate_msme_due_date
from shared.admin_auth import validate_identity_headers


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        if isinstance(value, str):
            normalized = value.replace(',', '').strip()
            if not normalized:
                return default
            return float(normalized)
        return float(value)
    except (TypeError, ValueError):
        return default


def _field_amount(field) -> float | None:
    if field is None:
        return None

    value = getattr(field, "value", None)
    if value is None:
        return None

    amount_obj = getattr(value, "amount", None)
    if amount_obj is not None:
        return _safe_float(amount_obj, None)

    if isinstance(value, (int, float, str)):
        return _safe_float(value, None)

    return None


def _extract_first_amount(fields: dict, keys: list[str]) -> float | None:
    for key in keys:
        candidate = _field_amount(fields.get(key))
        if candidate is not None:
            return candidate
    return None


def _extract_gst_from_content(content: str) -> float:
    if not content:
        return 0.0

    total = 0.0

    # Pattern 1: CGST@2.5% : 22.49 (or SGST/IGST variants)
    pattern_rate_then_amount = re.compile(
        r"(?:cgst|sgst|igst)\s*@?\s*\d+(?:\.\d+)?\s*%\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)",
        flags=re.IGNORECASE,
    )
    for match in pattern_rate_then_amount.finditer(content):
        total += _safe_float(match.group(1), 0.0)

    # Pattern 2: CGST : 22.49 (without explicit rate)
    if total <= 0:
        pattern_label_then_amount = re.compile(
            r"(?:cgst|sgst|igst)\b[^0-9%]{0,12}([0-9]+(?:\.[0-9]+)?)",
            flags=re.IGNORECASE,
        )
        for match in pattern_label_then_amount.finditer(content):
            total += _safe_float(match.group(1), 0.0)

    return round(total, 2)

def get_or_create_vendor(supabase, vendor_name: str, gstin: str = None) -> str:
    if not vendor_name:
        vendor_name = "Unassigned Vendor"
        
    res = supabase.table('cashflow_entities').select('id').eq('name', vendor_name).eq('entity_type', 'vendor').execute()
    if res.data and len(res.data) > 0:
        return res.data[0]['id']

    new_vendor = {
        "name": vendor_name,
        "entity_type": "vendor",
        "gstin": gstin if gstin else None,
        "msme_registered": False,
        "msme_category": "none"
    }
    v_res = supabase.table('cashflow_entities').insert(new_vendor).execute()
    return v_res.data[0]['id']

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing Accounts Payable request.')
    action = req.route_params.get("action")
    if not action and req.method == "GET":
        action = "list"

    auth = validate_identity_headers(req)
    if not auth["ok"]:
        return func.HttpResponse(
            json.dumps({"ok": False, "error": auth["error"]}),
            mimetype="application/json",
            status_code=auth["status_code"],
        )
    
    try:
        supabase = get_supabase_client()

        def build_mock_extracted() -> dict:
            # Keep endpoint contract stable when OCR can't infer fields.
            return {
                "vendor_name": "",
                "vendor_gstin": "",
                "bill_number": "",
                "bill_date": datetime.now().strftime("%Y-%m-%d"),
                "amount": 0.0,
                "gst_amount": 0.0,
            }

        # 1. GET /api/cashflow/ap/list
        if req.method == "GET" and action == "list":
            response = supabase.table('cashflow_bills').select(
                '*, cashflow_entities(id, name, gstin, msme_category)'
            ).order('created_at', desc=True).execute()
            
            return func.HttpResponse(json.dumps({"ok": True, "data": response.data}), mimetype="application/json")

        # 2. POST /api/cashflow/ap/ocr
        elif req.method == "POST" and action == "ocr":
            req_body = req.get_json()
            b64_file = req_body.get("file")
            if not b64_file:
                return func.HttpResponse(json.dumps({"ok": False, "error": "No file provided"}), status_code=400)

            # Mock fallback if Azure Doc Intel keys aren't set yet
            endpoint = os.environ.get("AZURE_DOC_INTEL_ENDPOINT")
            key = os.environ.get("AZURE_DOC_INTEL_KEY")

            if endpoint and key:
                try:
                    from azure.core.credentials import AzureKeyCredential
                    from azure.ai.formrecognizer import DocumentAnalysisClient

                    file_bytes = base64.b64decode(b64_file.split(",")[1])
                    client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
                    poller = client.begin_analyze_document("prebuilt-invoice", document=file_bytes)
                    ocr_result = poller.result()
                    if not ocr_result.documents:
                        return func.HttpResponse(json.dumps({"ok": True, "data": build_mock_extracted()}), mimetype="application/json")

                    doc = ocr_result.documents[0]
                    fields = doc.fields

                    total_tax = _extract_first_amount(fields, ["TotalTax", "Tax", "TaxTotal"])
                    subtotal = _extract_first_amount(fields, ["SubTotal", "Subtotal"])
                    invoice_total = _extract_first_amount(fields, ["InvoiceTotal", "TotalAmount", "AmountDue"])

                    parsed_tax_from_content = _extract_gst_from_content(getattr(ocr_result, "content", "") or "")

                    if total_tax is None:
                        total_tax = parsed_tax_from_content
                    else:
                        # OCR sometimes returns the tax rate (e.g., 5) instead of amount.
                        # If parsed GST from textual content is clearly larger, trust parsed value.
                        if parsed_tax_from_content > 0 and total_tax > 0 and parsed_tax_from_content > (total_tax * 1.5):
                            total_tax = parsed_tax_from_content

                    if invoice_total is None:
                        if subtotal is not None and total_tax is not None:
                            invoice_total = round(subtotal + total_tax, 2)
                        elif subtotal is not None:
                            invoice_total = subtotal
                        else:
                            invoice_total = 0.0

                    if total_tax is None:
                        total_tax = 0.0

                    extracted = {
                        "vendor_name": (fields.get("VendorName").value if fields.get("VendorName") else "") or "",
                        "vendor_gstin": (fields.get("VendorTaxId").value if fields.get("VendorTaxId") else "") or "",
                        "bill_number": (fields.get("InvoiceId").value if fields.get("InvoiceId") else "") or "",
                        "bill_date": str(fields.get("InvoiceDate").value) if fields.get("InvoiceDate") else datetime.now().strftime("%Y-%m-%d"),
                        "amount": round(_safe_float(invoice_total, 0.0), 2),
                        "gst_amount": round(_safe_float(total_tax, 0.0), 2),
                    }
                except Exception as ocr_error:
                    logging.warning(f"AP OCR fallback triggered: {str(ocr_error)}")
                    extracted = build_mock_extracted()
            else:
                # Local dev fallback when Azure credentials are pending
                extracted = build_mock_extracted()
            
            return func.HttpResponse(json.dumps({"ok": True, "data": extracted}), mimetype="application/json")

        # 3. POST /api/cashflow/ap/save
        elif req.method == "POST" and action == "save":
            data = req.get_json()
            vendor_id = get_or_create_vendor(supabase, data.get("vendor_name"), data.get("vendor_gstin"))

            amount = float(data.get("amount", 0))
            tds_section = data.get("tds_section", "NONE")
            tds_amount = calculate_tds(amount, tds_section)

            bill_date = data.get("bill_date") or datetime.now().strftime("%Y-%m-%d")
            due_date = calculate_msme_due_date(bill_date, False) or (datetime.strptime(bill_date, "%Y-%m-%d") + timedelta(days=30)).strftime("%Y-%m-%d")

            new_bill = {
                "vendor_id": vendor_id,
                "bill_number": data.get("bill_number", f"BILL-{int(datetime.now().timestamp())}"),
                "bill_date": bill_date,
                "due_date": due_date,
                "amount": amount,
                "gst_amount": float(data.get("gst_amount", 0)),
                "tds_amount": tds_amount,
                "status": "pending"
            }
            
            response = supabase.table('cashflow_bills').insert(new_bill).execute()
            
            # Re-query with vendor relationship
            bill_with_vendor = supabase.table('cashflow_bills').select('*, cashflow_entities(id, name, gstin)').eq('id', response.data[0]['id']).single().execute()
            
            return func.HttpResponse(json.dumps({"ok": True, "data": bill_with_vendor.data}), mimetype="application/json")

        # 4. POST /api/cashflow/ap/approve
        elif req.method == "POST" and action == "approve":
            try:
                data = req.get_json()
            except ValueError:
                return func.HttpResponse(
                    json.dumps({"ok": False, "error": "Request body must be valid JSON"}),
                    mimetype="application/json",
                    status_code=400,
                )

            bill_id = str(data.get("bill_id") or "").strip()
            if not bill_id:
                return func.HttpResponse(
                    json.dumps({"ok": False, "error": "bill_id is required"}),
                    mimetype="application/json",
                    status_code=400,
                )

            current = supabase.table('cashflow_bills').select('id,status').eq('id', bill_id).limit(1).execute()
            current_rows = current.data or []
            if not current_rows:
                return func.HttpResponse(
                    json.dumps({"ok": False, "error": "Bill not found"}),
                    mimetype="application/json",
                    status_code=404,
                )

            current_status = str(current_rows[0].get("status") or "")
            if current_status == "approved":
                approved = supabase.table('cashflow_bills').select('*, cashflow_entities(id, name, gstin)').eq('id', bill_id).single().execute()
                return func.HttpResponse(json.dumps({"ok": True, "data": approved.data}), mimetype="application/json")

            if current_status != "pending":
                return func.HttpResponse(
                    json.dumps({"ok": False, "error": f"Only pending bills can be approved. Current status: {current_status}"}),
                    mimetype="application/json",
                    status_code=400,
                )

            updated = (
                supabase.table('cashflow_bills')
                .update({"status": "approved"})
                .eq('id', bill_id)
                .execute()
            )

            updated_rows = updated.data or []
            if not updated_rows:
                return func.HttpResponse(
                    json.dumps({"ok": False, "error": "Unable to approve bill"}),
                    mimetype="application/json",
                    status_code=500,
                )

            bill_with_vendor = supabase.table('cashflow_bills').select('*, cashflow_entities(id, name, gstin)').eq('id', bill_id).single().execute()
            return func.HttpResponse(json.dumps({"ok": True, "data": bill_with_vendor.data}), mimetype="application/json")

        return func.HttpResponse(
            json.dumps({"ok": False, "error": f"Unsupported AP route action '{action}' for method {req.method}"}),
            mimetype="application/json",
            status_code=404,
        )

    except Exception as e:
        logging.error(f"Error in AP API: {str(e)}")
        return func.HttpResponse(json.dumps({"ok": False, "error": str(e)}), mimetype="application/json", status_code=500)