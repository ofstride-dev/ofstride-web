import azure.functions as func
import json
import logging
from datetime import datetime, timedelta
from shared.db import get_supabase_client

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

            amount = float(data.get("amount", 0))
            gst_amount = float(data.get("gst_amount", 0))

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
            
            new_transaction = {
                "invoice_id": data.get("invoice_id"),
                "transaction_date": data.get("transaction_date", datetime.now().strftime("%Y-%m-%d")),
                "amount": float(data.get("amount", 0)),
                "payment_mode": data.get("payment_mode", "bank_transfer"),
                "reference_no": data.get("reference_no", "")
            }
            
            response = supabase.table('cashflow_transactions').insert(new_transaction).execute()
            
            # Optional: Update invoice status to 'paid' if fully paid
            # You would add logic here to compare transaction totals vs invoice total
            
            return func.HttpResponse(json.dumps({"ok": True, "data": response.data[0]}), mimetype="application/json")

    except Exception as e:
        logging.error(f"Error in AR API: {str(e)}")
        return func.HttpResponse(json.dumps({"ok": False, "error": str(e)}), mimetype="application/json", status_code=500)