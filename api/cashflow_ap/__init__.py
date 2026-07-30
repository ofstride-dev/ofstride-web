import azure.functions as func
import json
import logging
import os
import base64
from datetime import datetime, timedelta
from shared.db import get_supabase_client
from shared.tax_engine import calculate_tds, calculate_msme_due_date
from shared.admin_auth import validate_identity_headers

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

    auth = validate_identity_headers(req)
    if not auth["ok"]:
        return func.HttpResponse(
            json.dumps({"ok": False, "error": auth["error"]}),
            mimetype="application/json",
            status_code=auth["status_code"],
        )
    
    try:
        supabase = get_supabase_client()

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
                from azure.core.credentials import AzureKeyCredential
                from azure.ai.formrecognizer import DocumentAnalysisClient
                
                file_bytes = base64.b64decode(b64_file.split(",")[1])
                client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
                poller = client.begin_analyze_document("prebuilt-invoice", document=file_bytes)
                doc = poller.result().documents[0]
                fields = doc.fields

                extracted = {
                    "vendor_name": fields.get("VendorName").value if fields.get("VendorName") else "",
                    "vendor_gstin": fields.get("VendorTaxId").value if fields.get("VendorTaxId") else "",
                    "bill_number": fields.get("InvoiceId").value if fields.get("InvoiceId") else "",
                    "bill_date": str(fields.get("InvoiceDate").value) if fields.get("InvoiceDate") else datetime.now().strftime("%Y-%m-%d"),
                    "amount": fields.get("InvoiceTotal").value.amount if fields.get("InvoiceTotal") else 0.0,
                    "gst_amount": fields.get("TotalTax").value.amount if fields.get("TotalTax") else 0.0,
                }
            else:
                # Local dev fallback when Azure credentials are pending
                extracted = {
                    "vendor_name": "Sample Vendor Ltd",
                    "vendor_gstin": "27AAAAA0000A1Z5",
                    "bill_number": f"INV-{int(datetime.now().timestamp())}",
                    "bill_date": datetime.now().strftime("%Y-%m-%d"),
                    "amount": 10000.0,
                    "gst_amount": 1800.0,
                }
            
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

    except Exception as e:
        logging.error(f"Error in AP API: {str(e)}")
        return func.HttpResponse(json.dumps({"ok": False, "error": str(e)}), mimetype="application/json", status_code=500)