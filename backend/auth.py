"""
Supabase JWT authentication middleware for Flask.
Verifies tokens via Supabase JWKS endpoint (supports ECC P-256 and legacy HS256).
"""
import os
from functools import wraps

from flask import request, jsonify

try:
    import jwt
    _PYJWT_AVAILABLE = True
except ImportError:
    _PYJWT_AVAILABLE = False

_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if not _PYJWT_AVAILABLE:
        return None
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        return None
    if _jwks_client is None:
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def verify_token(token: str) -> dict | None:
    """Verify a Supabase-issued JWT. Returns the payload dict or None if invalid."""
    client = _get_jwks_client()
    if client is None:
        return {"sub": "anonymous"}
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            options={"verify_exp": True},
        )
        return payload
    except Exception as e:
        print(f"[Auth] Token verification failed: {e}")
        return None


def require_auth(f):
    """Decorator that enforces Supabase JWT auth on a Flask route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not os.getenv("SUPABASE_URL"):
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth_header.split(" ", 1)[1]
        payload = verify_token(token)
        if payload is None:
            return jsonify({"error": "Unauthorized"}), 401

        request.user_id = payload.get("sub")
        return f(*args, **kwargs)
    return decorated
