import azure.functions as func
import json
import logging
from shared.db import get_supabase_client
from shared.admin_auth import validate_identity_headers

def ai_categorize_expense(description: str) -> tuple[str, bool]:
    desc_lower = description.lower()
    if any(word in desc_lower for word in ['uber', 'ola', 'taxi', 'train']):
        return "Travel & Transport", True
    elif any(word in desc_lower for word in ['swiggy', 'zomato', 'lunch', 'tea']):
        return "Meals & Entertainment", True
    elif any(word in desc_lower for word in ['paper', 'pen', 'print']):
        return "Office Supplies", True
    return "Uncategorized", False

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing Petty Cash request.')

    auth = validate_identity_headers(req)
    if not auth["ok"]:
        return func.HttpResponse(
            json.dumps({"ok": False, "error": auth["error"]}),
            mimetype="application/json",
            status_code=auth["status_code"],
        )
    
    try:
        supabase = get_supabase_client()
        method = req.method

        if method == "GET":
            # Correct table: cashflow_petty_cash
            response = supabase.table('cashflow_petty_cash').select('*').order('entry_date', desc=True).execute()
            return func.HttpResponse(
                json.dumps({"ok": True, "data": response.data}),
                mimetype="application/json",
                status_code=200
            )

        elif method == "POST":
            req_body = req.get_json()
            description = req_body.get('description', '')
            category = req_body.get('category')
            auto_categorized = False
            
            if not category:
                category, auto_categorized = ai_categorize_expense(description)

            amount = float(req_body.get('amount', 0))
            entry_type = req_body.get('type', 'OUT') # 'IN' or 'OUT'

            # Schema exact mapping
            new_entry = {
                "entry_date": req_body.get('date'),
                "description": description,
                "category": category,
                "auto_categorized": auto_categorized,
                "cash_in": amount if entry_type == 'IN' else 0.00,
                "cash_out": amount if entry_type == 'OUT' else 0.00,
            }
            
            response = supabase.table('cashflow_petty_cash').insert(new_entry).execute()
            return func.HttpResponse(
                json.dumps({"ok": True, "message": "Entry logged", "data": response.data[0]}),
                mimetype="application/json",
                status_code=201
            )

    except Exception as e:
        logging.error(f"Error in Petty Cash API: {str(e)}")
        return func.HttpResponse(
            json.dumps({"ok": False, "error": str(e)}),
            mimetype="application/json",
            status_code=500
        )