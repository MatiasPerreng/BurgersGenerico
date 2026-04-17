import hashlib
import secrets


def hash_password(plain: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), bytes.fromhex(salt), 100000)
    return f"pbkdf2_sha256$100000${salt}${dk.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    if not stored:
        return False
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        try:
            import bcrypt

            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
        except (ValueError, TypeError):
            return False
        except Exception as e:
            import logging

            logging.getLogger(__name__).warning("bcrypt verify inesperado: %s", e)
            return False
    if not stored.startswith("pbkdf2_sha256$"):
        return False
    rest = stored[len("pbkdf2_sha256$") :]
    parts = rest.split("$", 2)
    if len(parts) != 3:
        return False
    iters_s, salt_hex, hexhash = parts
    try:
        iters = int(iters_s)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), bytes.fromhex(salt_hex), iters)
        return dk.hex() == hexhash
    except ValueError:
        return False
