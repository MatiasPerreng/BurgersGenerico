import hashlib
import secrets
import sys

password = sys.argv[1].encode()
salt = secrets.token_hex(16)
dk = hashlib.pbkdf2_hmac("sha256", password, bytes.fromhex(salt), 100000)
print(f"pbkdf2_sha256$100000${salt}${dk.hex()}")
