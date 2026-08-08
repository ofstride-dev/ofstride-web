import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response


ALLOWED_FIELDS = {
    "status",
    "title",
    "description",
    "impact",
    "confidence",
    "effort",
    "domain",
    "phase",
    "strategic_weight",
}


def _to_float(value, fallback: float) -> float:
    try:
        return float(value)
    except Exception:
        return fallback

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    try:
        body = req.get_json()
    except Exception:
        return error_response(req, "Invalid JSON", status_code=400)

    item_id = body.get("item_id")
    updates = body.get("updates", {})
    if not item_id:
        return error_response(req, "Missing item_id", status_code=400)
    if not isinstance(updates, dict):
        return error_response(req, "updates must be an object", status_code=400)

    filtered_updates = {k: v for k, v in updates.items() if k in ALLOWED_FIELDS}
    if not filtered_updates:
        return error_response(req, "No valid fields provided in updates", status_code=400)

    supa = get_supabase()

    current_rows = supa.table("roadmap_item").select("*").eq("id", item_id).execute().data or []
    if not current_rows:
        return error_response(req, "Roadmap item not found", status_code=404)
    current = current_rows[0]

    impact = _to_float(filtered_updates.get("impact", current.get("impact", 1)), 1.0)
    confidence = _to_float(filtered_updates.get("confidence", current.get("confidence", 1)), 1.0)
    effort = _to_float(filtered_updates.get("effort", current.get("effort", 1)), 1.0)
    strategic_weight = _to_float(
        filtered_updates.get("strategic_weight", current.get("strategic_weight", 1)),
        1.0,
    )

    safe_effort = effort if effort > 0 else 1.0
    filtered_updates["priority_score"] = round((impact * confidence * strategic_weight) / safe_effort, 2)

    res = supa.table("roadmap_item").update(filtered_updates).eq("id", item_id).execute()
    return json_response(req, {"updated": len(res.data)})