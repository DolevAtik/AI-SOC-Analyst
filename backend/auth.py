"""
Clerk JWT authentication middleware for Flask.
Verifies tokens issued by Clerk using the JWKS endpoint.
"""
import os
from functools import wraps

from flask import request, jsonify

try:
    import jwt
    _PYJWT_AVAILABLE = True
except ImportError:
    _PYJWT_AVAILABLE = False

# Cached PyJWKClient — reused across requests (handles key rotation automatically)
_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if not _PYJWT_AVAILABLE:
        return None
    url = os.getenv("CLERK_JWKS_URL")
    if not url:
        return None
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(url, cache_keys=True)
    return _jwks_client


def verify_token(token: str) -> dict | None:
    """Verify a Clerk-issued JWT. Returns the payload dict or None if invalid."""
    client = _get_jwks_client()
    if client is None:
        # Auth not configured — open access (dev mode)
        return {"sub": "anonymous"}
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
        return payload
    except Exception as e:
        print(f"[Auth] Token verification failed: {e}")
        return None


def require_auth(f):
    """Decorator that enforces Clerk JWT auth on a Flask route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not os.getenv("CLERK_JWKS_URL"):
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
