from __future__ import annotations

import base64
import csv
import io
import json
import logging
import uuid
from datetime import datetime
from decimal import Decimal

import azure.functions as func

try:
    import pandas as pd
    PANDAS_IMPORT_ERROR = None
except Exception as exc:
    pd = None
    PANDAS_IMPORT_ERROR = exc

from shared.admin_auth import validate_identity_headers
from shared.db import get_supabase_client


HEADER_ALIASES = {
    "voucher_number": ["voucher_number", "voucherno", "voucher no", "invoice_number", "bill_number", "ref", "reference"],
    "voucher_type": ["voucher_type", "vchtype", "type", "voucher type"],
    "voucher_date": ["voucher_date", "date", "voucher date", "doc_date", "document date"],
    "party_name": ["party_name", "party", "ledger_name", "ledger", "counterparty", "name"],
    "amount": ["amount", "voucher_amount", "value", "total", "gross_amount"],
}


def _require_pandas() -> None:
    if pd is None:
        raise RuntimeError(
            "Excel reconcile support is unavailable because pandas/openpyxl is not installed on the Function host. "
            "Deploy with updated requirements.txt including pandas and openpyxl."
        ) from PANDAS_IMPORT_ERROR


def _json_response(status_code: int, payload: dict) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(payload, default=str),
        mimetype="application/json",
        status_code=status_code,
    )


def _err(status_code: int, message: str, trace_id: str) -> func.HttpResponse:
    return _json_response(status_code, {"success": False, "error": message, "trace_id": trace_id})


def _ok(data: dict, trace_id: str) -> func.HttpResponse:
    return _json_response(200, {"success": True, "data": data, "trace_id": trace_id})


def _num(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _iso_date(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


def _parse_iso_date(value: str):
    return datetime.strptime(value, "%Y-%m-%d").date()


def _to_date(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        return None

    if pd is None:
        return None

    try:
        return pd.to_datetime(value).date()
    except Exception:
        return None


def _normalize_columns(columns):
    return {str(c): str(c).strip().lower().replace("_", " ") for c in columns}


def _find_column(column_map: dict, candidates: list[str]) -> str | None:
    normalized_candidates = [str(c).strip().lower().replace("_", " ") for c in candidates]
    for raw, normalized in column_map.items():
        for c in normalized_candidates:
            if normalized == c:
                return raw
    return None


def _is_blank(value) -> bool:
    if value is None:
        return True
    text = str(value).strip()
    return text == "" or text.lower() in {"nan", "none", "null"}


def _extract_tally_rows(df):
    _require_pandas()
    cols = _normalize_columns(df.columns)

    mapped = {}
    for key, aliases in HEADER_ALIASES.items():
        mapped[key] = _find_column(cols, aliases)

    column_warnings = []
    for required_col in ["voucher_number", "voucher_date", "amount"]:
        if not mapped.get(required_col):
            column_warnings.append(f"Missing expected column mapping for: {required_col}")

    rows = []
    for idx, row in df.iterrows():
        voucher_number_raw = row.get(mapped["voucher_number"]) if mapped.get("voucher_number") else None
        voucher_date_raw = row.get(mapped["voucher_date"]) if mapped.get("voucher_date") else None
        amount_raw = row.get(mapped["amount"]) if mapped.get("amount") else None

        voucher_number = str(voucher_number_raw or "").strip()
        voucher_date = _to_date(voucher_date_raw)
        amount = round(_num(amount_raw), 2)

        issues = []
        if not mapped.get("voucher_number"):
            issues.append("voucher_number column not found")
        elif _is_blank(voucher_number_raw):
            issues.append("voucher_number is missing")

        if not mapped.get("voucher_date"):
            issues.append("voucher_date column not found")
        elif _is_blank(voucher_date_raw):
            issues.append("voucher_date is missing")
        elif voucher_date is None:
            issues.append("voucher_date format is invalid")

        if not mapped.get("amount"):
            issues.append("amount column not found")
        elif _is_blank(amount_raw):
            issues.append("amount is missing")
        else:
            raw_amount_text = str(amount_raw).strip()
            try:
                float(raw_amount_text.replace(",", ""))
            except Exception:
                issues.append("amount is not numeric")

        suggestion = None
        if issues:
            suggestion = (
                "Flagged for assisted correction: please review this row with our finance operations team "
                "to fix missing/invalid fields before final posting."
            )

        rows.append(
            {
                "voucher_number": voucher_number,
                "voucher_type": str(row.get(mapped["voucher_type"], "") or "").strip() if mapped.get("voucher_type") else "",
                "voucher_date": voucher_date,
                "party_name": str(row.get(mapped["party_name"], "") or "").strip() if mapped.get("party_name") else "",
                "amount": amount,
                "row_number": int(idx) + 2,
                "validation_issues": issues,
                "suggested_correction": suggestion,
                "raw_data": {str(k): (None if pd.isna(v) else str(v)) for k, v in row.items()},
            }
        )

    return rows, mapped, column_warnings


def _build_platform_rows(supabase, start_date: str, end_date: str):
    platform_rows = []

    bills_res = (
        supabase.table("cashflow_bills")
        .select("*, cashflow_entities!cashflow_bills_vendor_id_fkey(name)")
        .in_("status", ["approved", "paid"])
        .gte("bill_date", start_date)
        .lte("bill_date", end_date)
        .execute()
    )

    for bill in bills_res.data or []:
        vendor = bill.get("cashflow_entities") or {}
        platform_rows.append(
            {
                "source": "AP",
                "voucher_type": "Purchase",
                "voucher_number": str(bill.get("bill_number") or "").strip(),
                "voucher_date": _to_date(bill.get("bill_date")),
                "party_name": str(vendor.get("name") or "Unknown Vendor"),
                "amount": round(_num(bill.get("amount")), 2),
                "raw_data": bill,
            }
        )

    inv_res = (
        supabase.table("cashflow_invoices")
        .select("*, cashflow_entities!cashflow_invoices_customer_id_fkey(name)")
        .in_("status", ["approved", "paid"])
        .eq("is_proforma", False)
        .gte("invoice_date", start_date)
        .lte("invoice_date", end_date)
        .execute()
    )

    for inv in inv_res.data or []:
        customer = inv.get("cashflow_entities") or {}
        platform_rows.append(
            {
                "source": "AR",
                "voucher_type": "Sales",
                "voucher_number": str(inv.get("invoice_number") or "").strip(),
                "voucher_date": _to_date(inv.get("invoice_date")),
                "party_name": str(customer.get("name") or "Unknown Customer"),
                "amount": round(_num(inv.get("amount")), 2),
                "raw_data": inv,
            }
        )

    petty_res = (
        supabase.table("cashflow_petty_cash")
        .select("*")
        .gte("entry_date", start_date)
        .lte("entry_date", end_date)
        .execute()
    )

    for entry in petty_res.data or []:
        cash_in = round(_num(entry.get("cash_in")), 2)
        cash_out = round(_num(entry.get("cash_out")), 2)
        amount = cash_out if cash_out > 0 else cash_in
        if amount <= 0:
            continue

        platform_rows.append(
            {
                "source": "PettyCash",
                "voucher_type": "Payment" if cash_out > 0 else "Receipt",
                "voucher_number": f"PETTY-{str(entry.get('id', ''))[:8]}",
                "voucher_date": _to_date(entry.get("entry_date")),
                "party_name": str(entry.get("description") or "Petty Cash"),
                "amount": amount,
                "raw_data": entry,
            }
        )

    return platform_rows


def _run_reconcile(tally_rows: list[dict], platform_rows: list[dict]):
    platform_map = {}
    for row in platform_rows:
        key = (row["voucher_number"] or "").strip().lower()
        if not key:
            continue
        platform_map.setdefault(key, []).append(row)

    matched_platform_ids = set()
    reconcile_rows = []

    for t_row in tally_rows:
        row_issues = t_row.get("validation_issues") or []
        if row_issues:
            reconcile_rows.append(
                {
                    "source_side": "tally",
                    "voucher_type": t_row.get("voucher_type") or "",
                    "voucher_number": t_row.get("voucher_number") or f"ROW-{t_row.get('row_number', '')}",
                    "voucher_date": t_row.get("voucher_date"),
                    "party_name": t_row.get("party_name") or "",
                    "amount": t_row.get("amount", 0.0),
                    "status": "unexpected_in_tally",
                    "notes": "; ".join(row_issues),
                    "suggested_correction": t_row.get("suggested_correction"),
                    "raw_data": {
                        "tally": t_row.get("raw_data") or {},
                        "validation_issues": row_issues,
                        "row_number": t_row.get("row_number"),
                    },
                }
            )
            continue

        key = (t_row["voucher_number"] or "").strip().lower()
        candidates = platform_map.get(key, [])

        if not candidates:
            reconcile_rows.append(
                {
                    "source_side": "tally",
                    "voucher_type": t_row.get("voucher_type") or "",
                    "voucher_number": t_row.get("voucher_number"),
                    "voucher_date": t_row.get("voucher_date"),
                    "party_name": t_row.get("party_name") or "",
                    "amount": t_row.get("amount", 0.0),
                    "status": "unexpected_in_tally",
                    "notes": "No matching voucher number in platform data",
                    "raw_data": t_row.get("raw_data") or {},
                }
            )
            continue

        chosen = None
        for c in candidates:
            cid = id(c)
            if cid in matched_platform_ids:
                continue
            chosen = c
            matched_platform_ids.add(cid)
            break

        if chosen is None:
            chosen = candidates[0]

        amount_delta = round(abs(_num(t_row.get("amount")) - _num(chosen.get("amount"))), 2)
        status = "matched" if amount_delta <= 1.0 else "amount_mismatch"

        reconcile_rows.append(
            {
                "source_side": "tally",
                "voucher_type": t_row.get("voucher_type") or chosen.get("voucher_type") or "",
                "voucher_number": t_row.get("voucher_number"),
                "voucher_date": t_row.get("voucher_date") or chosen.get("voucher_date"),
                "party_name": t_row.get("party_name") or chosen.get("party_name") or "",
                "amount": t_row.get("amount", 0.0),
                "status": status,
                "notes": None if status == "matched" else f"Amount mismatch vs platform: {chosen.get('amount', 0.0):.2f}",
                "suggested_correction": (
                    None
                    if status == "matched"
                    else "Review voucher amount and update in Tally or platform source to match before posting."
                ),
                "raw_data": {
                    "tally": t_row.get("raw_data") or {},
                    "platform": chosen.get("raw_data") or {},
                },
            }
        )

    for p_row in platform_rows:
        if id(p_row) in matched_platform_ids:
            continue
        reconcile_rows.append(
            {
                "source_side": "platform",
                "voucher_type": p_row.get("voucher_type") or "",
                "voucher_number": p_row.get("voucher_number"),
                "voucher_date": p_row.get("voucher_date"),
                "party_name": p_row.get("party_name") or "",
                "amount": p_row.get("amount", 0.0),
                "status": "missing_in_tally",
                "notes": "Exists in platform but not found in Tally report",
                "suggested_correction": "Create or correct this voucher in Tally to mirror platform records.",
                "raw_data": p_row.get("raw_data") or {},
            }
        )

    summary = {
        "total_tally_rows": len(tally_rows),
        "total_platform_rows": len(platform_rows),
        "matched": sum(1 for r in reconcile_rows if r["status"] == "matched"),
        "amount_mismatch": sum(1 for r in reconcile_rows if r["status"] == "amount_mismatch"),
        "missing_in_tally": sum(1 for r in reconcile_rows if r["status"] == "missing_in_tally"),
        "unexpected_in_tally": sum(1 for r in reconcile_rows if r["status"] == "unexpected_in_tally"),
    }

    return summary, reconcile_rows


def _save_run(supabase, start_date: str, end_date: str, file_name: str, file_type: str, summary: dict, user_id: str):
    payload = {
        "start_date": start_date,
        "end_date": end_date,
        "source_file_name": file_name,
        "source_file_type": file_type,
        "summary": summary,
    }

    # created_by references auth.users(id). In fallback local-header mode,
    # x-user-id may be a generated UUID that does not exist in auth.users.
    # To avoid runtime 500s, only include created_by when bearer auth is present.
    if user_id:
        payload["created_by"] = user_id

    try:
        run_res = supabase.table("cashflow_tally_reconcile_runs").insert(payload).execute()
    except Exception:
        # Retry without created_by when FK constraints reject non-auth UUIDs.
        payload.pop("created_by", None)
        run_res = supabase.table("cashflow_tally_reconcile_runs").insert(payload).execute()

    rows = run_res.data or []
    if not rows:
        raise ValueError("Could not create reconciliation run")
    return rows[0]["id"]


def _save_rows(supabase, run_id: str, rows: list[dict]):
    if not rows:
        return

    payload = []
    for row in rows:
        payload.append(
            {
                "run_id": run_id,
                "source_side": row.get("source_side") or "tally",
                "voucher_type": row.get("voucher_type") or "",
                "voucher_number": row.get("voucher_number") or "",
                "voucher_date": _iso_date(row.get("voucher_date")),
                "party_name": row.get("party_name") or "",
                "amount": round(_num(row.get("amount")), 2),
                "status": row.get("status") or "matched",
                "notes": row.get("notes") or row.get("suggested_correction"),
                "raw_data": row.get("raw_data") or {},
            }
        )

    supabase.table("cashflow_tally_reconcile_rows").insert(payload).execute()


def _parse_uploaded_report(file_name: str, content_b64: str):
    if not file_name:
        raise ValueError("file_name is required")
    if not content_b64:
        raise ValueError("file_content_base64 is required")

    raw_bytes = base64.b64decode(content_b64)
    lower_name = file_name.lower()

    if lower_name.endswith(".csv"):
        decoded = raw_bytes.decode("utf-8", errors="ignore")
        rows = list(csv.DictReader(io.StringIO(decoded)))
        if not rows:
            raise ValueError("CSV file has no rows")
        _require_pandas()
        return pd.DataFrame(rows)

    if lower_name.endswith(".xlsx") or lower_name.endswith(".xls"):
        _require_pandas()
        return pd.read_excel(io.BytesIO(raw_bytes))

    raise ValueError("Only .csv and .xlsx reports are supported")


def _export_rows_csv(rows: list[dict]) -> bytes:
    fieldnames = [
        "source_side",
        "voucher_type",
        "voucher_number",
        "voucher_date",
        "party_name",
        "amount",
        "status",
        "notes",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for r in rows:
        writer.writerow(
            {
                "source_side": r.get("source_side"),
                "voucher_type": r.get("voucher_type"),
                "voucher_number": r.get("voucher_number"),
                "voucher_date": r.get("voucher_date"),
                "party_name": r.get("party_name"),
                "amount": r.get("amount"),
                "status": r.get("status"),
                "notes": r.get("notes"),
            }
        )

    return output.getvalue().encode("utf-8")


def _risk_level(summary: dict) -> str:
    amount_mismatch = int(summary.get("amount_mismatch") or 0)
    missing_in_tally = int(summary.get("missing_in_tally") or 0)
    unexpected_in_tally = int(summary.get("unexpected_in_tally") or 0)
    mismatch_total = amount_mismatch + missing_in_tally + unexpected_in_tally

    if mismatch_total >= 10:
        return "high"
    if mismatch_total >= 1:
        return "medium"
    return "low"


def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = str(uuid.uuid4())
    action = (req.route_params.get("action") or "analyze").strip().lower()

    auth = validate_identity_headers(req)
    if not auth.get("ok"):
        return _err(auth.get("status_code", 401), auth.get("error") or "Unauthorized", trace_id)

    identity = auth.get("identity") or {}
    user_id = identity.get("user_id")

    try:
        supabase = get_supabase_client()

        if req.method == "POST" and action == "analyze":
            try:
                body = req.get_json()
            except ValueError:
                return _err(400, "Request body must be valid JSON", trace_id)

            start_date = str(body.get("start_date") or "").strip()
            end_date = str(body.get("end_date") or "").strip()
            file_name = str(body.get("file_name") or "").strip()
            file_content_b64 = str(body.get("file_content_base64") or "").strip()

            if not start_date or not end_date:
                return _err(400, "start_date and end_date are required (YYYY-MM-DD)", trace_id)

            try:
                _parse_iso_date(start_date)
                _parse_iso_date(end_date)
            except ValueError:
                return _err(400, "Invalid date format. Use YYYY-MM-DD", trace_id)

            try:
                report_df = _parse_uploaded_report(file_name, file_content_b64)
            except (ValueError, RuntimeError) as parse_error:
                return _err(400, str(parse_error), trace_id)

            tally_rows, mapped_columns, column_warnings = _extract_tally_rows(report_df)
            platform_rows = _build_platform_rows(supabase, start_date, end_date)

            summary, reconcile_rows = _run_reconcile(tally_rows, platform_rows)
            run_id = _save_run(
                supabase,
                start_date,
                end_date,
                file_name,
                file_name.split(".")[-1].lower() if "." in file_name else "unknown",
                summary,
                user_id,
            )
            _save_rows(supabase, run_id, reconcile_rows)

            return _ok(
                {
                    "run_id": run_id,
                    "summary": summary,
                    "uploaded_rows": tally_rows,
                    "column_mapping": mapped_columns,
                    "column_warnings": column_warnings,
                    "row_issues_count": sum(1 for r in tally_rows if r.get("validation_issues")),
                    "sample_mismatches": [r for r in reconcile_rows if r["status"] != "matched"][:10],
                },
                trace_id,
            )

        if req.method == "GET" and action == "summary":
            run_id = str(req.params.get("run_id") or "").strip()
            if not run_id:
                return _err(400, "run_id is required", trace_id)

            run_res = supabase.table("cashflow_tally_reconcile_runs").select("*").eq("id", run_id).limit(1).execute()
            if not run_res.data:
                return _err(404, "Run not found", trace_id)

            rows_res = (
                supabase.table("cashflow_tally_reconcile_rows")
                .select("*")
                .eq("run_id", run_id)
                .order("created_at", desc=False)
                .execute()
            )

            return _ok(
                {
                    "run": run_res.data[0],
                    "rows": rows_res.data or [],
                },
                trace_id,
            )

        if req.method == "GET" and action == "recent":
            limit = req.params.get("limit")
            try:
                parsed_limit = int(limit) if limit else 5
            except ValueError:
                return _err(400, "limit must be a valid integer", trace_id)

            parsed_limit = max(1, min(parsed_limit, 20))

            runs_res = (
                supabase.table("cashflow_tally_reconcile_runs")
                .select("id,start_date,end_date,source_file_name,summary,created_at")
                .order("created_at", desc=True)
                .limit(parsed_limit)
                .execute()
            )

            runs = []
            for run in runs_res.data or []:
                summary = run.get("summary") or {}
                runs.append(
                    {
                        "id": run.get("id"),
                        "start_date": run.get("start_date"),
                        "end_date": run.get("end_date"),
                        "source_file_name": run.get("source_file_name"),
                        "created_at": run.get("created_at"),
                        "summary": summary,
                        "risk_level": _risk_level(summary),
                    }
                )

            return _ok({"runs": runs}, trace_id)

        if req.method == "GET" and action == "export":
            run_id = str(req.params.get("run_id") or "").strip()
            kind = str(req.params.get("kind") or "corrected").strip().lower()
            if not run_id:
                return _err(400, "run_id is required", trace_id)
            if kind not in {"corrected", "mismatch", "all"}:
                return _err(400, "kind must be one of: corrected, mismatch, all", trace_id)

            rows_res = (
                supabase.table("cashflow_tally_reconcile_rows")
                .select("*")
                .eq("run_id", run_id)
                .order("created_at", desc=False)
                .execute()
            )
            rows = rows_res.data or []

            if kind == "corrected":
                filtered = [r for r in rows if r.get("source_side") == "platform" and r.get("status") in {"missing_in_tally", "amount_mismatch"}]
            elif kind == "mismatch":
                filtered = [r for r in rows if r.get("status") != "matched"]
            else:
                filtered = rows

            csv_bytes = _export_rows_csv(filtered)
            filename = f"tally_reconcile_{run_id}_{kind}.csv"
            return func.HttpResponse(
                body=csv_bytes,
                status_code=200,
                mimetype="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "X-Trace-Id": trace_id,
                },
            )

        if req.method == "GET" and action == "template":
            output = io.StringIO()
            writer = csv.DictWriter(
                output,
                fieldnames=["voucher_number", "voucher_type", "voucher_date", "party_name", "amount"],
            )
            writer.writeheader()
            writer.writerow(
                {
                    "voucher_number": "INV-1001",
                    "voucher_type": "Sales",
                    "voucher_date": "2026-08-01",
                    "party_name": "Customer A",
                    "amount": 11800.00,
                }
            )
            csv_bytes = output.getvalue().encode("utf-8")
            return func.HttpResponse(
                body=csv_bytes,
                status_code=200,
                mimetype="text/csv",
                headers={"Content-Disposition": "attachment; filename=tally_upload_template.csv", "X-Trace-Id": trace_id},
            )

        return _err(404, f"Unsupported action '{action}' for method {req.method}", trace_id)
    except Exception as exc:
        logging.error(f"Tally reconcile failed: {str(exc)}")
        return _err(500, str(exc), trace_id)
