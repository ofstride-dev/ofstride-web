"""Minimal admin_careers function to diagnose Azure Functions cold-start / routing issue."""
import json
import azure.functions as func


async def main(req: func.HttpRequest) -> func.HttpResponse:
    """Health-check endpoint: returns static JSON to prove routing works."""
    return func.HttpResponse(
        '{"ok":true,"data":{"message":"admin_careers function is alive","path":%s,"method":"%s"}}'
        % (json.dumps(str(req.route_params.get("path") or "")), req.method),
        status_code=200,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )