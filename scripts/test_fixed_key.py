import os
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization

load_dotenv()
key = os.getenv("GOOGLE_PRIVATE_KEY")
fixed_key = key.replace("\\n", "\n").replace("\\x", "x")

try:
    serialization.load_pem_private_key(fixed_key.encode(), password=None)
    print("✅ Sucesso ao carregar após remover '\\x'")
except Exception as e:
    print(f"❌ Falha: {e}")
