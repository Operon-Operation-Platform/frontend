"""
Operon Secret Vault Service
Provides authenticated AES encryption at rest for customer third-party integration credentials.
Ensures API keys, passwords, and tokens never leak in plaintext, logs, or API responses.
"""

import base64
import hashlib
import json
import logging
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet
from database.postgres.config import settings

logger = logging.getLogger("operon.secret_vault")

def _get_fernet_key() -> bytes:
    """Derive a reproducible 32-byte base64-encoded Fernet key from SECRET_KEY."""
    raw_key = settings.SECRET_KEY.encode("utf-8")
    derived_32 = hashlib.sha256(raw_key).digest()
    return base64.urlsafe_b64encode(derived_32)

_FERNET = Fernet(_get_fernet_key())

def encrypt_credentials(data: Dict[str, Any]) -> str:
    """Encrypt a dictionary of credentials into a ciphertext string."""
    json_bytes = json.dumps(data).encode("utf-8")
    encrypted_bytes = _FERNET.encrypt(json_bytes)
    return encrypted_bytes.decode("utf-8")

def decrypt_credentials(ciphertext: str) -> Dict[str, Any]:
    """Decrypt a ciphertext string back into credentials dictionary."""
    if not ciphertext:
        return {}
    try:
        decrypted_bytes = _FERNET.decrypt(ciphertext.encode("utf-8"))
        return json.loads(decrypted_bytes.decode("utf-8"))
    except Exception as exc:
        logger.error(f"Failed to decrypt credentials: {exc}")
        return {}

def redact_secrets(obj: Any) -> Any:
    """Recursively mask secrets and tokens so they never appear in API responses or logs."""
    SENSITIVE_KEYS = {
        "api_key", "password", "token", "secret", "auth_token", "access_token",
        "refresh_token", "client_secret", "private_key", "credentials", "credential",
        "connection_string", "auth"
    }

    if isinstance(obj, dict):
        sanitized = {}
        for k, v in obj.items():
            if any(s in k.lower() for s in SENSITIVE_KEYS) and isinstance(v, str) and v:
                if len(v) > 8:
                    sanitized[k] = f"{v[:3]}...{v[-3:]} (encrypted)"
                else:
                    sanitized[k] = "****** (encrypted)"
            else:
                sanitized[k] = redact_secrets(v)
        return sanitized
    elif isinstance(obj, list):
        return [redact_secrets(item) for item in obj]
    return obj
