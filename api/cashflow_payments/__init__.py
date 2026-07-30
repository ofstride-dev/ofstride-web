import azure.functions as func
from shared.api_contract import create_response
from shared.admin_auth import validate_identity_headers

def main(req: func.HttpRequest) -> func.HttpResponse:
    auth = validate_identity_headers(req)
    if not auth["ok"]:
        return create_response(auth["status_code"], False, error=auth["error"])

    return create_response(200, True, data={"transactions": []})