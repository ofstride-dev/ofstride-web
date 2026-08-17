import azure.functions as func
from shared.api_contract import create_response
from shared.admin_auth import require_cashflow_tenant

def main(req: func.HttpRequest) -> func.HttpResponse:
    action = req.route_params.get("action")
    auth = require_cashflow_tenant(req)
    if not auth["ok"]:
        return create_response(auth["status_code"], False, error=auth["error"])

    if req.method == "GET" and (not action or action == "list"):
        return create_response(200, True, data={"transactions": []})

    if req.method == "POST" and (not action or action == "create"):
        return create_response(200, True, data={"transactions": []})

    return create_response(
        404,
        False,
        error=f"Unsupported payments route action '{action}' for method {req.method}",
    )