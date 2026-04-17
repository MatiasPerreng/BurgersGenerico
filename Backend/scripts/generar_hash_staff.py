"""
Genera un hash bcrypt para insertar un usuario en la tabla `staff`.
Requiere: pip install bcrypt
Uso: python generar_hash_staff.py
"""
import getpass

try:
    import bcrypt
except ImportError:
    raise SystemExit("Instalá bcrypt: pip install bcrypt")

if __name__ == "__main__":
    pwd = getpass.getpass("Contraseña: ")
    h = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
    print(h)
