from __future__ import annotations

import base64
import csv
import io
import json
import logging
import os
import re
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

from shared.admin_auth import resolve_identity_headers, validate_identity_headers
from shared.db import get_supabase_client

try:
    from azure.ai.formrecognizer import DocumentAnalysisClient
    from azure.core.credentials import AzureKeyCredential
    DOC_INTEL_IMPORT_ERROR = None
except Exception as exc:
    DocumentAnalysisClient = None
    AzureKeyCredential = None
    DOC_INTEL_IMPORT_ERROR = exc


HEADER_ALIASES = {
    "voucher_number": [
        "voucher_number", "voucherno", "voucher no", "invoice_number", "bill_number", "ref", "reference",
        "transaction_id", "transaction ref", "transaction_ref", "utr", "utr no", "rrn", "chq no", "cheque_no",
        "cheque number", "cheque number/id", "txn id", "txn_id",
    ],
    "voucher_type": [
        "voucher_type", "vchtype", "type", "voucher type", "transaction_type", "dr_cr", "debit_credit", "cr/dr",
    ],
    "voucher_date": [
        "voucher_date", "date", "voucher date", "doc_date", "document date", "transaction_date", "value_date", "posting_date",
        "txn date", "tran date", "transaction date", "value date",
    ],
    "party_name": [
        "party_name", "party", "ledger_name", "ledger", "counterparty", "name", "description", "narration", "particulars",
        "remarks", "details", "transaction details", "beneficiary",
    ],
    "amount": ["amount", "voucher_amount", "value", "total", "gross_amount", "txn_amount", "amount (inr)", "txn amount"],
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


def _is_missing_table_error(exc: Exception) -> bool:
    text = str(exc or "")
    lowered = text.lower()
    return "pgrst205" in lowered or "could not find the table" in lowered


def _num(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return 0.0
        normalized = text.upper().replace(",", "").replace("INR", "").replace("RS.", "").replace("RS", "")
        is_negative = "DR" in normalized or normalized.startswith("(")
        normalized = re.sub(r"[^0-9.+\-]", "", normalized)
        if normalized in {"", "+", "-", ".", "+.", "-."}:
            return 0.0
        try:
            parsed = float(normalized)
            return -abs(parsed) if is_negative else parsed
        except ValueError:
            return 0.0
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
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d.%m.%Y", "%d-%b-%Y", "%d %b %Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        if pd is not None:
            try:
                return pd.to_datetime(value, dayfirst=True, errors="coerce").date()
            except Exception:
                return None
        return None

    if pd is None:
        return None

    try:
        return pd.to_datetime(value, dayfirst=True, errors="coerce").date()
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


def _extract_bank_rows(df):
    _require_pandas()
    cols = _normalize_columns(df.columns)

    mapped = {}
    for key, aliases in HEADER_ALIASES.items():
        mapped[key] = _find_column(cols, aliases)

    column_warnings = []
    debit_col = _find_column(cols, ["debit", "withdrawal", "debit amount", "dr", "withdrawals"])
    credit_col = _find_column(cols, ["credit", "deposit", "credit amount", "cr", "deposits"])

    if not mapped.get("voucher_date"):
        column_warnings.append("Missing expected column mapping for: voucher_date")
    if not mapped.get("amount") and not debit_col and not credit_col:
        column_warnings.append("Missing expected amount columns. Provide amount or debit/credit")

    rows = []
    for idx, row in df.iterrows():
        voucher_number_raw = row.get(mapped["voucher_number"]) if mapped.get("voucher_number") else None
        voucher_date_raw = row.get(mapped["voucher_date"]) if mapped.get("voucher_date") else None
        amount_raw = row.get(mapped["amount"]) if mapped.get("amount") else None
        if _is_blank(amount_raw):
            debit_raw = row.get(debit_col) if debit_col else None
            credit_raw = row.get(credit_col) if credit_col else None
            debit_val = round(abs(_num(debit_raw)), 2)
            credit_val = round(abs(_num(credit_raw)), 2)
            if debit_val > 0:
                amount_raw = -debit_val
            elif credit_val > 0:
                amount_raw = credit_val

        voucher_number = str(voucher_number_raw or "").strip()
        voucher_date = _to_date(voucher_date_raw)
        amount = round(_num(amount_raw), 2)
        if amount == 0.0:
            # Some banks split debit/credit without a unified amount column.
            debit_raw = row.get(debit_col) if debit_col else None
            credit_raw = row.get(credit_col) if credit_col else None
            debit_val = round(abs(_num(debit_raw)), 2)
            credit_val = round(abs(_num(credit_raw)), 2)
            if debit_val > 0:
                amount = -debit_val
            elif credit_val > 0:
                amount = credit_val

        voucher_type = str(row.get(mapped["voucher_type"], "") or "").strip() if mapped.get("voucher_type") else ""
        if not voucher_type:
            debit_raw = row.get(debit_col) if debit_col else None
            credit_raw = row.get(credit_col) if credit_col else None
            debit_val = round(abs(_num(debit_raw)), 2)
            credit_val = round(abs(_num(credit_raw)), 2)
            if debit_val > 0:
                voucher_type = "Payment"
            elif credit_val > 0:
                voucher_type = "Receipt"
            elif amount < 0:
                voucher_type = "Payment"
            elif amount > 0:
                voucher_type = "Receipt"

        issues = []
        if not mapped.get("voucher_date"):
            issues.append("voucher_date column not found")
        elif _is_blank(voucher_date_raw):
            issues.append("voucher_date is missing")
        elif voucher_date is None:
            issues.append("voucher_date format is invalid")

        if amount == 0.0:
            issues.append("amount is missing or zero")

        if not voucher_number:
            voucher_number = f"BANK-ROW-{int(idx) + 2}"

        suggestion = None
        if issues:
            suggestion = (
                "Flagged for assisted correction: please review this row with our finance operations team "
                "to fix missing/invalid fields before final posting."
            )

        rows.append(
            {
                "voucher_number": voucher_number,
                "voucher_type": voucher_type,
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


def _statement_only_summary(bank_rows: list[dict]):
    valid_rows = [r for r in bank_rows if not (r.get("validation_issues") or [])]
    issue_rows = [r for r in bank_rows if (r.get("validation_issues") or [])]

    reconcile_rows = []
    for row in bank_rows:
        row_issues = row.get("validation_issues") or []
        reconcile_rows.append(
            {
                "source_side": "bank",
                "voucher_type": row.get("voucher_type") or "",
                "voucher_number": row.get("voucher_number") or "",
                "voucher_date": row.get("voucher_date"),
                "party_name": row.get("party_name") or "",
                "amount": row.get("amount", 0.0),
                "status": "unexpected_in_bank_statement" if row_issues else "matched",
                "notes": "; ".join(row_issues) if row_issues else "Parsed from bank statement",
                "raw_data": row.get("raw_data") or {},
            }
        )

    summary = {
        "total_bank_rows": len(bank_rows),
        "total_platform_rows": 0,
        "matched": len(valid_rows),
        "amount_mismatch": 0,
        "missing_in_bank_statement": 0,
        "unexpected_in_bank_statement": len(issue_rows),
    }

    return summary, reconcile_rows


def _analyze_pdf_with_document_intelligence(raw_bytes: bytes):
    if DocumentAnalysisClient is None or AzureKeyCredential is None:
        raise RuntimeError(
            "PDF import requires Azure Document Intelligence SDK on the Function host. "
            "Install azure-ai-formrecognizer and azure-core."
        ) from DOC_INTEL_IMPORT_ERROR

    endpoint = (
        os.environ.get("CASHFLOW_DOC_INTEL_ENDPOINT")
        or os.environ.get("AZURE_DOC_INTEL_ENDPOINT")
        or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        or os.environ.get("AZURE_FORM_RECOGNIZER_ENDPOINT")
        or ""
    ).strip()
    key = (
        os.environ.get("CASHFLOW_DOC_INTEL_KEY")
        or os.environ.get("AZURE_DOC_INTEL_KEY")
        or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
        or os.environ.get("AZURE_FORM_RECOGNIZER_KEY")
        or ""
    ).strip()

    if not endpoint or not key:
        raise ValueError(
            "PDF import needs Document Intelligence configuration. "
            "Set CASHFLOW_DOC_INTEL_ENDPOINT and CASHFLOW_DOC_INTEL_KEY."
        )

    client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    poller = client.begin_analyze_document("prebuilt-layout", document=raw_bytes)
    return poller.result()


def _table_records_from_doc_intel(result) -> list[dict]:
    records = []
    for table in result.tables or []:
        if table.row_count <= 1 or table.column_count <= 0:
            continue

        grid = [["" for _ in range(table.column_count)] for _ in range(table.row_count)]
        for cell in table.cells or []:
            r = int(cell.row_index)
            c = int(cell.column_index)
            if 0 <= r < table.row_count and 0 <= c < table.column_count:
                grid[r][c] = str(cell.content or "").strip()

        headers = [h.strip() or f"col_{idx + 1}" for idx, h in enumerate(grid[0])]
        for row in grid[1:]:
            rec = {}
            has_content = False
            for idx, header in enumerate(headers):
                value = row[idx] if idx < len(row) else ""
                rec[header] = value
                if str(value).strip():
                    has_content = True
            if has_content:
                records.append(rec)

    return records


def _line_records_from_doc_intel(result) -> list[dict]:
    records = []
    amount_pattern = re.compile(r"([+-]?\d[\d,]*(?:\.\d{1,2})?)")
    date_pattern = re.compile(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})")

    line_no = 0
    for page in result.pages or []:
        for line in page.lines or []:
            line_no += 1
            text = str(line.content or "").strip()
            if not text:
                continue

            date_match = date_pattern.search(text)
            amount_matches = amount_pattern.findall(text)
            if not date_match or not amount_matches:
                continue

            amount_text = amount_matches[-1]
            amount_value = _num(amount_text.replace(",", ""))
            if amount_value <= 0:
                continue

            records.append(
                {
                    "reference": f"PDF-{line_no}",
                    "transaction_date": date_match.group(1),
                    "description": text,
                    "amount": round(amount_value, 2),
                }
            )

    return records


def _parse_pdf_report(file_name: str, raw_bytes: bytes):
    _require_pandas()
    result = _analyze_pdf_with_document_intelligence(raw_bytes)
    records = _table_records_from_doc_intel(result)
    if not records:
        records = _line_records_from_doc_intel(result)
    if not records:
        raise ValueError(
            "Could not parse tabular transactions from PDF. "
            "Upload a machine-readable bank statement or configure Document Intelligence model settings."
        )
    return pd.DataFrame(records)


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


def _run_reconcile(bank_rows: list[dict], platform_rows: list[dict]):
    platform_map = {}
    for row in platform_rows:
        key = (row["voucher_number"] or "").strip().lower()
        if not key:
            continue
        platform_map.setdefault(key, []).append(row)

    matched_platform_ids = set()
    reconcile_rows = []

    def _find_fallback_candidate(bank_row: dict):
        bank_amount = round(_num(bank_row.get("amount")), 2)
        bank_date = bank_row.get("voucher_date")
        best = None
        best_score = None

        for candidate in platform_rows:
            cid = id(candidate)
            if cid in matched_platform_ids:
                continue

            candidate_amount = round(_num(candidate.get("amount")), 2)
            amount_delta = round(abs(bank_amount - candidate_amount), 2)
            if amount_delta > 1.0:
                continue

            candidate_date = candidate.get("voucher_date")
            same_date = bank_date and candidate_date and bank_date == candidate_date
            score = (0 if same_date else 1, amount_delta)

            if best_score is None or score < best_score:
                best = candidate
                best_score = score

        return best

    for b_row in bank_rows:
        row_issues = b_row.get("validation_issues") or []
        if row_issues:
            reconcile_rows.append(
                {
                    "source_side": "bank",
                    "voucher_type": b_row.get("voucher_type") or "",
                    "voucher_number": b_row.get("voucher_number") or f"ROW-{b_row.get('row_number', '')}",
                    "voucher_date": b_row.get("voucher_date"),
                    "party_name": b_row.get("party_name") or "",
                    "amount": b_row.get("amount", 0.0),
                    "status": "unexpected_in_bank_statement",
                    "notes": "; ".join(row_issues),
                    "suggested_correction": b_row.get("suggested_correction"),
                    "raw_data": {
                        "bank": b_row.get("raw_data") or {},
                        "validation_issues": row_issues,
                        "row_number": b_row.get("row_number"),
                    },
                }
            )
            continue

        key = (b_row["voucher_number"] or "").strip().lower()
        candidates = platform_map.get(key, [])

        matched_by_fallback = False
        if not candidates:
            fallback_candidate = _find_fallback_candidate(b_row)
            if fallback_candidate is not None:
                candidates = [fallback_candidate]
                matched_by_fallback = True

        if not candidates:
            reconcile_rows.append(
                {
                    "source_side": "bank",
                    "voucher_type": b_row.get("voucher_type") or "",
                    "voucher_number": b_row.get("voucher_number"),
                    "voucher_date": b_row.get("voucher_date"),
                    "party_name": b_row.get("party_name") or "",
                    "amount": b_row.get("amount", 0.0),
                    "status": "unexpected_in_bank_statement",
                    "notes": "No matching voucher number in platform data",
                    "raw_data": b_row.get("raw_data") or {},
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

        amount_delta = round(abs(_num(b_row.get("amount")) - _num(chosen.get("amount"))), 2)
        status = "matched" if amount_delta <= 1.0 else "amount_mismatch"

        reconcile_rows.append(
            {
                "source_side": "bank",
                "voucher_type": b_row.get("voucher_type") or chosen.get("voucher_type") or "",
                "voucher_number": b_row.get("voucher_number"),
                "voucher_date": b_row.get("voucher_date") or chosen.get("voucher_date"),
                "party_name": b_row.get("party_name") or chosen.get("party_name") or "",
                "amount": b_row.get("amount", 0.0),
                "status": status,
                "notes": (
                    "Matched using amount/date heuristic"
                    if status == "matched" and matched_by_fallback
                    else (None if status == "matched" else f"Amount mismatch vs platform: {chosen.get('amount', 0.0):.2f}")
                ),
                "suggested_correction": (
                    None
                    if status == "matched"
                    else "Review bank statement amount and update the statement or platform source to match before posting."
                ),
                "raw_data": {
                    "bank": b_row.get("raw_data") or {},
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
                "status": "missing_in_bank_statement",
                "notes": "Exists in platform but not found in uploaded bank statement",
                "suggested_correction": "Review bank receipts/transactions and upload a corrected statement to mirror platform records.",
                "raw_data": p_row.get("raw_data") or {},
            }
        )

    summary = {
        "total_bank_rows": len(bank_rows),
        "total_platform_rows": len(platform_rows),
        "matched": sum(1 for r in reconcile_rows if r["status"] == "matched"),
        "amount_mismatch": sum(1 for r in reconcile_rows if r["status"] == "amount_mismatch"),
        "missing_in_bank_statement": sum(1 for r in reconcile_rows if r["status"] == "missing_in_bank_statement"),
        "unexpected_in_bank_statement": sum(1 for r in reconcile_rows if r["status"] == "unexpected_in_bank_statement"),
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
        run_res = supabase.table("cashflow_bank_reconcile_runs").insert(payload).execute()
    except Exception:
        # Retry without created_by when FK constraints reject non-auth UUIDs.
        payload.pop("created_by", None)
        run_res = supabase.table("cashflow_bank_reconcile_runs").insert(payload).execute()

    rows = run_res.data or []
    if not rows:
        raise ValueError("Could not create reconciliation run")
    return rows[0]["id"]


def _save_rows(supabase, run_id: str, rows: list[dict]):
    if not rows:
        return

    payload = []
    for row in rows:
        source_side = row.get("source_side") or "bank"
        status = row.get("status") or "matched"

        payload.append(
            {
                "run_id": run_id,
                "source_side": source_side,
                "voucher_type": row.get("voucher_type") or "",
                "voucher_number": row.get("voucher_number") or "",
                "voucher_date": _iso_date(row.get("voucher_date")),
                "party_name": row.get("party_name") or "",
                "amount": round(_num(row.get("amount")), 2),
                "status": status,
                "notes": row.get("notes") or row.get("suggested_correction"),
                "raw_data": row.get("raw_data") or {},
            }
        )

    supabase.table("cashflow_bank_reconcile_rows").insert(payload).execute()


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

    if lower_name.endswith(".pdf"):
        return _parse_pdf_report(file_name, raw_bytes)

    raise ValueError("Only .csv, .xlsx, and .pdf reports are supported")


def _normalize_report_df(df):
    _require_pandas()
    cleaned = df.copy()
    cleaned.columns = [str(col).strip() for col in cleaned.columns]
    cleaned = cleaned.loc[:, [str(col).strip() != "" for col in cleaned.columns]]

    for col in cleaned.columns:
        if str(cleaned[col].dtype).lower() == "object":
            cleaned[col] = cleaned[col].map(lambda value: value.strip() if isinstance(value, str) else value)

    return cleaned


def _promote_first_row_as_header(df):
    _require_pandas()
    if df.empty:
        return df

    current_columns = [str(col) for col in df.columns]
    unnamed_count = sum(1 for col in current_columns if col.lower().startswith("unnamed"))
    if unnamed_count == 0:
        return df

    first_row = df.iloc[0].tolist()
    if not any(str(value or "").strip() for value in first_row):
        return df

    promoted = df.iloc[1:].copy()
    promoted.columns = [str(value).strip() or f"col_{idx + 1}" for idx, value in enumerate(first_row)]
    return promoted


def _run_bank_statement_pipeline(report_df, compare_with_platform: bool, supabase, start_date: str, end_date: str):
    working_df = _normalize_report_df(report_df)
    best_result = None
    pass_details = []

    for pass_index in range(2):
        bank_rows, mapped_columns, column_warnings = _extract_bank_rows(working_df)
        row_issues_count = sum(1 for row in bank_rows if row.get("validation_issues"))
        if compare_with_platform:
            platform_rows = _build_platform_rows(supabase, start_date, end_date)
            summary, reconcile_rows = _run_reconcile(bank_rows, platform_rows)
        else:
            summary, reconcile_rows = _statement_only_summary(bank_rows)

        candidate = {
            "bank_rows": bank_rows,
            "mapped_columns": mapped_columns,
            "column_warnings": column_warnings,
            "summary": summary,
            "reconcile_rows": reconcile_rows,
            "row_issues_count": row_issues_count,
        }

        pass_details.append(
            {
                "pass": pass_index + 1,
                "row_issues_count": row_issues_count,
                "total_rows": len(bank_rows),
                "warnings": column_warnings,
            }
        )

        if best_result is None or row_issues_count < best_result["row_issues_count"]:
            best_result = candidate

        if row_issues_count == 0:
            break

        if pass_index == 0:
            working_df = _normalize_report_df(_promote_first_row_as_header(working_df))

    return {
        **(best_result or {}),
        "pipeline": {
            "stage": "complete",
            "passes": len(pass_details),
            "pass_details": pass_details,
            "selected_pass": min(pass_details, key=lambda item: item.get("row_issues_count", 0))["pass"] if pass_details else 1,
        },
    }


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
    missing_in_bank_statement = int(summary.get("missing_in_bank_statement") or 0)
    unexpected_in_bank_statement = int(summary.get("unexpected_in_bank_statement") or 0)
    mismatch_total = amount_mismatch + missing_in_bank_statement + unexpected_in_bank_statement

    if mismatch_total >= 10:
        return "high"
    if mismatch_total >= 1:
        return "medium"
    return "low"


def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = str(uuid.uuid4())
    action = (req.route_params.get("action") or "analyze").strip().lower()
    user_id = None

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

            auth = resolve_identity_headers(req, allow_anonymous=True)
            identity = auth.get("identity") or {}
            user_id = identity.get("user_id")

            compare_with_platform = bool(body.get("compare_with_platform"))

            pipeline_result = _run_bank_statement_pipeline(
                report_df,
                compare_with_platform,
                supabase,
                start_date,
                end_date,
            )
            bank_rows = pipeline_result.get("bank_rows") or []
            mapped_columns = pipeline_result.get("mapped_columns") or {}
            column_warnings = pipeline_result.get("column_warnings") or []
            summary = pipeline_result.get("summary") or {}
            reconcile_rows = pipeline_result.get("reconcile_rows") or []
            row_issues_count = int(pipeline_result.get("row_issues_count") or 0)
            run_id = None
            persistence_warning = None
            try:
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
            except Exception as persist_error:
                if _is_missing_table_error(persist_error):
                    persistence_warning = (
                        "Bank reconcile tables are not created yet. Analysis ran successfully but was not saved. "
                        "Apply DB migration for cashflow_bank_reconcile_runs/rows to persist results."
                    )
                    logging.warning(persistence_warning)
                else:
                    raise

            return _ok(
                {
                    "run_id": run_id,
                    "summary": summary,
                    "uploaded_rows": bank_rows,
                    "column_mapping": mapped_columns,
                    "column_warnings": column_warnings,
                    "row_issues_count": row_issues_count,
                    "sample_mismatches": [r for r in reconcile_rows if r["status"] != "matched"][:10],
                    "comparison_mode": "platform" if compare_with_platform else "bank_statement_only",
                    "persistence_warning": persistence_warning,
                    "pipeline": pipeline_result.get("pipeline") or {},
                },
                trace_id,
            )

        auth = validate_identity_headers(req)
        if not auth.get("ok"):
            return _err(auth.get("status_code", 401), auth.get("error") or "Unauthorized", trace_id)

        identity = auth.get("identity") or {}
        user_id = identity.get("user_id")

        if req.method == "GET" and action == "summary":
            run_id = str(req.params.get("run_id") or "").strip()
            if not run_id:
                return _err(400, "run_id is required", trace_id)

            try:
                run_res = supabase.table("cashflow_bank_reconcile_runs").select("*").eq("id", run_id).limit(1).execute()
            except Exception as fetch_error:
                if _is_missing_table_error(fetch_error):
                    return _ok({"run": None, "rows": [], "warning": "Bank reconcile tables are not configured yet."}, trace_id)
                raise
            if not run_res.data:
                return _err(404, "Run not found", trace_id)

            try:
                rows_res = (
                    supabase.table("cashflow_bank_reconcile_rows")
                    .select("*")
                    .eq("run_id", run_id)
                    .order("created_at", desc=False)
                    .execute()
                )
            except Exception as fetch_rows_error:
                if _is_missing_table_error(fetch_rows_error):
                    return _ok({"run": run_res.data[0], "rows": [], "warning": "Bank reconcile rows table is not configured yet."}, trace_id)
                raise

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

            try:
                runs_res = (
                    supabase.table("cashflow_bank_reconcile_runs")
                    .select("id,start_date,end_date,source_file_name,summary,created_at")
                    .order("created_at", desc=True)
                    .limit(parsed_limit)
                    .execute()
                )
            except Exception as recent_error:
                if _is_missing_table_error(recent_error):
                    return _ok({"runs": [], "warning": "Bank reconcile tables are not configured yet."}, trace_id)
                raise

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

            try:
                rows_res = (
                    supabase.table("cashflow_bank_reconcile_rows")
                    .select("*")
                    .eq("run_id", run_id)
                    .order("created_at", desc=False)
                    .execute()
                )
            except Exception as export_error:
                if _is_missing_table_error(export_error):
                    return _err(400, "Bank reconcile tables are not configured yet. Export is unavailable.", trace_id)
                raise
            rows = rows_res.data or []

            if kind == "corrected":
                filtered = [r for r in rows if r.get("source_side") == "platform" and r.get("status") in {"missing_in_bank_statement", "amount_mismatch"}]
            elif kind == "mismatch":
                filtered = [r for r in rows if r.get("status") != "matched"]
            else:
                filtered = rows

            csv_bytes = _export_rows_csv(filtered)
            filename = f"bank_reconcile_{run_id}_{kind}.csv"
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
                headers={"Content-Disposition": "attachment; filename=bank_statement_upload_template.csv", "X-Trace-Id": trace_id},
            )

        return _err(404, f"Unsupported action '{action}' for method {req.method}", trace_id)
    except Exception as exc:
        logging.error(f"Bank statement reconcile failed: {str(exc)}")
        return _err(500, str(exc), trace_id)
