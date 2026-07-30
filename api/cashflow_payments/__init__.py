import azure.functions as func
from shared.api_contract import create_response
from shared.admin_auth import validate_admin_or_finance

def main(req: func.HttpRequest) -> func.HttpResponse:
    if not validate_admin_or_finance(req):
        return create_response(403, False, error="Unauthorized")

    return create_response(200, True, data={"transactions": []})