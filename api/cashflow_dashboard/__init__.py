import azure.functions as func
from shared.api_contract import create_response
from shared.admin_auth import validate_admin_or_finance

def main(req: func.HttpRequest) -> func.HttpResponse:
    if not validate_admin_or_finance(req):
        return create_response(403, False, error="Unauthorized: Finance or Admin role required")
    
    # Calculation stub integrating AP, AR, Petty Cash and read-only expenses
    dashboard_data = {
        "summary": {
            "cash_inflow_30d": 450000.00,
            "cash_outflow_30d": 210000.00,
            "net_cash_flow": 240000.00,
            "runway_months": 8.5,
            "petty_cash_balance": 15400.00
        },
        "msme_alerts": [
            {"vendor": "TechCorp India", "amount": 50000, "days_remaining": 3, "deadline": "2026-08-01"}
        ]
    }
    return create_response(200, True, data=dashboard_data)