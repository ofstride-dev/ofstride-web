import os
from supabase import create_client

_supabase = None


def get_supabase():
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SERVICE_KEY")
        )
        if not url or not key:
            raise ValueError("Supabase credentials missing in environment variables.")
        _supabase = create_client(url, key)
    return _supabase
