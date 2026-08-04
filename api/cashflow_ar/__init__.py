import azure.functions as func
import json
import logging
from datetime import datetime, timedelta
from shared.db import get_supabase_client
from shared.admin_auth import validate_identity_headers


def _to_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, str) and not value.strip():
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

def get_or_create_customer(supabase, customer_name: str, gstin: str = None) -> str:
    """Finds existing customer by name or creates a new one in cashflow_entities."""
    if not customer_name:
        customer_name = "Walk-in Customer"
        
    res = supabase.table('cashflow_entities').select('id').eq('name', customer_name).eq('entity_type', 'customer').execute()
    if res.data and len(res.data) > 0:
        return res.data[0]['id']

    new_customer = {
        "name": customer_name,
        "entity_type": "customer",
        "gstin": gstin if gstin else None,
        "msme_registered": False,
        "msme_category": "none"
    }
    c_res = supabase.table('cashflow_entities').insert(new_customer).execute()
    return c_res.data[0]['id']

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing Accounts Receivable request.')
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

        # 1. GET /api/cashflow/ar/list -> Fetch all outbound invoices
        if req.method == "GET" and action == "list":
            # Using the customer_id relation
            response = supabase.table('cashflow_invoices').select(
                '*, cashflow_entities!cashflow_invoices_customer_id_fkey(id, name, gstin)'
            ).order('created_at', desc=True).execute()
            
            return func.HttpResponse(json.dumps({"ok": True, "data": response.data}), mimetype="application/json")

        # 2. POST /api/cashflow/ar/create -> Create a new sales invoice
        elif req.method == "POST" and action == "create":
            data = req.get_json()
            
            customer_id = get_or_create_customer(supabase, data.get("customer_name"), data.get("customer_gstin"))

            amount = _to_float(data.get("amount"), 0.0)
            gst_amount = _to_float(data.get("gst_amount"), 0.0)

            invoice_date = data.get("invoice_date") or datetime.now().strftime("%Y-%m-%d")
            # Default due date to 15 days if not specified
            due_date = data.get("due_date") or (datetime.strptime(invoice_date, "%Y-%m-%d") + timedelta(days=15)).strftime("%Y-%m-%d")

            new_invoice = {
                "customer_id": customer_id,
                "invoice_number": data.get("invoice_number") or f"INV-{int(datetime.now().timestamp())}",
                "invoice_date": invoice_date,
                "due_date": due_date,
                "amount": amount,
                "gst_amount": gst_amount,
                "status": data.get("status", "pending"),
                "irn_number": data.get("irn_number", None),
                "is_proforma": data.get("is_proforma", False)
            }
            
            response = supabase.table('cashflow_invoices').insert(new_invoice).execute()
            
            # Re-fetch with customer details to return to frontend
            inv_with_customer = supabase.table('cashflow_invoices').select(
                '*, cashflow_entities!cashflow_invoices_customer_id_fkey(id, name, gstin)'
            ).eq('id', response.data[0]['id']).single().execute()
            
            return func.HttpResponse(json.dumps({"ok": True, "data": inv_with_customer.data}), mimetype="application/json")

        # 3. POST /api/cashflow/ar/collect -> Record a payment in cashflow_transactions
        elif req.method == "POST" and action == "collect":
            data = req.get_json()
            invoice_id = data.get("invoice_id")
            if not invoice_id:
                return func.HttpResponse(json.dumps({"ok": False, "error": "invoice_id is required"}), mimetype="application/json", status_code=400)

            invoice_res = supabase.table('cashflow_invoices').select('id, amount, gst_amount, status').eq('id', invoice_id).limit(1).execute()
            invoice_rows = invoice_res.data or []
            if not invoice_rows:
                return func.HttpResponse(json.dumps({"ok": False, "error": "Invoice not found"}), mimetype="application/json", status_code=404)

            invoice = invoice_rows[0]
            current_status = str(invoice.get("status") or "")
            if current_status == "paid":
                return func.HttpResponse(json.dumps({"ok": False, "error": "Invoice is already paid"}), mimetype="application/json", status_code=400)
            
            new_transaction = {
                "invoice_id": invoice_id,
                "transaction_date": data.get("transaction_date", datetime.now().strftime("%Y-%m-%d")),
                "amount": _to_float(data.get("amount"), 0.0),
                "payment_mode": data.get("payment_mode", "bank_transfer"),
                "reference_no": data.get("reference_no", "")
            }
            
            response = supabase.table('cashflow_transactions').insert(new_transaction).execute()

            tx_sum_res = supabase.table('cashflow_transactions').select('amount').eq('invoice_id', invoice_id).execute()
            total_collected = round(sum(_to_float(t.get("amount"), 0.0) for t in (tx_sum_res.data or [])), 2)
            invoice_total = round(_to_float(invoice.get("amount"), 0.0) + _to_float(invoice.get("gst_amount"), 0.0), 2)

            updated_invoice = None
            if total_collected >= invoice_total and invoice_total > 0:
                paid_update = (
                    supabase.table('cashflow_invoices')
                    .update({"status": "paid"})
                    .eq('id', invoice_id)
                    .execute()
                )
                updated_rows = paid_update.data or []
                updated_invoice = updated_rows[0] if updated_rows else None

            return func.HttpResponse(
                json.dumps(
                    {
                        "ok": True,
                        "data": {
                            "transaction": response.data[0],
                            "invoice_status": updated_invoice.get("status") if updated_invoice else current_status,
                            "total_collected": total_collected,
                            "invoice_total": invoice_total,
                        },
                    }
                ),
                mimetype="application/json"
            )

        # 4. POST /api/cashflow/ar/approve -> Transition invoice from pending to approved
        elif req.method == "POST" and action == "approve":
            try:
                data = req.get_json()
            except ValueError:
                return func.HttpResponse(json.dumps({"ok": False, "error": "Request body must be valid JSON"}), mimetype="application/json", status_code=400)

            invoice_id = str(data.get("invoice_id") or "").strip()
            if not invoice_id:
                return func.HttpResponse(json.dumps({"ok": False, "error": "invoice_id is required"}), mimetype="application/json", status_code=400)

            current = supabase.table('cashflow_invoices').select('id,status').eq('id', invoice_id).limit(1).execute()
            current_rows = current.data or []
            if not current_rows:
                return func.HttpResponse(json.dumps({"ok": False, "error": "Invoice not found"}), mimetype="application/json", status_code=404)

            current_status = str(current_rows[0].get("status") or "")
            if current_status == "approved":
                invoice_data = supabase.table('cashflow_invoices').select('*, cashflow_entities!cashflow_invoices_customer_id_fkey(id, name, gstin)').eq('id', invoice_id).single().execute()
                return func.HttpResponse(json.dumps({"ok": True, "data": invoice_data.data}), mimetype="application/json")

            if current_status != "pending":
                return func.HttpResponse(json.dumps({"ok": False, "error": f"Only pending invoices can be approved. Current status: {current_status}"}), mimetype="application/json", status_code=400)

            update_res = (
                supabase.table('cashflow_invoices')
                .update({"status": "approved"})
                .eq('id', invoice_id)
                .execute()
            )

            updated_rows = update_res.data or []
            if not updated_rows:
                return func.HttpResponse(json.dumps({"ok": False, "error": "Unable to approve invoice"}), mimetype="application/json", status_code=500)

            invoice_data = supabase.table('cashflow_invoices').select('*, cashflow_entities!cashflow_invoices_customer_id_fkey(id, name, gstin)').eq('id', invoice_id).single().execute()
            return func.HttpResponse(json.dumps({"ok": True, "data": invoice_data.data}), mimetype="application/json")

        return func.HttpResponse(
            json.dumps({"ok": False, "error": f"Unsupported AR route action '{action}' for method {req.method}"}),
            mimetype="application/json",
            status_code=404,
        )

    except Exception as e:
        logging.error(f"Error in AR API: {str(e)}")
        return func.HttpResponse(json.dumps({"ok": False, "error": str(e)}), mimetype="application/json", status_code=500)