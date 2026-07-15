with open("api/shared/persistence/careers_store.py", "r") as f:
    content = f.read()

old_text = content[31524:32566]

new_text = """_active_store = None
_supabase_unconfigured = False


def get_careers_store():
    """Return the best available careers store.

    Priority:
      1. Supabase store (if SUPABASE_URL + SUPABASE_SERVICE_KEY are set)
      2. SQLite store (fallback for local dev / unconfigured environments)

    Caching strategy:
      - Supabase working - cached permanently (fast path for all subsequent calls).
      - Supabase env vars missing (local dev) - SQLite cached permanently.
      - Supabase env vars SET but unreachable - SQLite used transiently but
        NOT cached, so the next call retries Supabase. This prevents a cold-start
        Supabase hiccup from permanently crippling an Azure Functions instance.
    """
    global _active_store, _supabase_unconfigured

    # Fast path - Supabase already confirmed working on this process
    if _active_store is not None:
        return _active_store

    # Supabase env vars were already checked and are missing - skip retry
    if _supabase_unconfigured:
        return _careers_store

    # Try Supabase first
    try:
        from persistence.careers_supabase_store import get_careers_supabase_store
        supabase_store = get_careers_supabase_store()
        if supabase_store.is_available:
            _active_store = supabase_store
            _store_logger.info("Using Supabase careers store.")
            return _active_store
        # Supabase env vars are missing/unset - cache SQLite permanently
        _supabase_unconfigured = True
        _store_logger.info(
            "Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing). "
            "Using SQLite careers store."
        )
        return _careers_store
    except Exception as exc:
        _store_logger.warning(
            "Supabase store init failed (will retry on next request): %s", exc
        )

    # Supabase IS configured but unreachable - DON"T cache, retry next call
    _store_logger.info(
        "Using SQLite careers store transiently (Supabase unavailable - will retry "
        "on next request)."
    )
    return _careers_store
"""

if content[31524:32566] == old_text:
    new_content = content[:31524] + new_text + content[32566:]
    with open("api/shared/persistence/careers_store.py", "w") as f:
        f.write(new_content)
    print("Replacement successful!")
    print(f"Old length: {len(old_text)}, New length: {len(new_text)}")
else:
    print("ERROR: Position mismatch")
