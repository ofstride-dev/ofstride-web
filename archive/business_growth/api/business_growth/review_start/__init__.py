import azure.functions as func
from business_growth.shared.http import json_response, options_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    return json_response(req, {"status": "review_started"})