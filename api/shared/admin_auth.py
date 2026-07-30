import azure.functions as func

def validate_admin_or_finance(req: func.HttpRequest) -> bool:
    role = req.headers.get("X-App-Role", "user")
    user_id = req.headers.get("X-User-Id", None)
    if not user_id or role not in ["admin", "finance"]:
        return False
    return True