"""
HTTP keep-warm endpoint for Azure Static Web Apps.
Azure SWA only supports httpTrigger functions.
Ping GET /api/keep-warm to warm the function host.
"""
import datetime
import logging
import azure.functions as func

logger = logging.getLogger("ofstride")


def main(req: func.HttpRequest) -> func.HttpResponse:
    utc_timestamp = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
    logger.info(f"Keep-warm pinged at {utc_timestamp}")
    return func.HttpResponse(
        f'{{"status":"warm","timestamp":"{utc_timestamp}"}}',
        status_code=200,
        mimetype="application/json",
    )