import azure.functions as func

from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response
from business_growth.shared.journey import get_journey_by_assessment_session


def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    assessment_session_id = req.params.get("assessment_session_id")
    if not assessment_session_id:
        return error_response(req, "Missing assessment_session_id", status_code=400)

    supa = get_supabase()
    journey = get_journey_by_assessment_session(supa, assessment_session_id)
    if not journey:
        return error_response(req, "Assessment session not found", status_code=404)

    return json_response(req, journey)
