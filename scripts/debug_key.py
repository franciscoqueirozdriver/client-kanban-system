import os
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization

load_dotenv()
key = os.getenv("GOOGLE_PRIVATE_KEY")

print(f"Raw key start: {key[:30]}")
print(f"Raw key length: {len(key)}")

# Tentativa 1: Substituir \\n por \n
try:
    fixed_key = key.replace("\\n", "\n")
    serialization.load_pem_private_key(fixed_key.encode(), password=None)
    print("✅ Sucesso ao carregar com replace('\\\\n', '\\n')")
except Exception as e:
    print(f"❌ Falha com replace: {e}")

# Tentativa 2: Se houver aspas extras
if key.startswith('"') and key.endswith('"'):
    key = key[1:-1]
    try:
        fixed_key = key.replace("\\n", "\n")
        serialization.load_pem_private_key(fixed_key.encode(), password=None)
        print("✅ Sucesso ao carregar após remover aspas e replace")
    except Exception as e:
        print(f"❌ Falha após remover aspas: {e}")
