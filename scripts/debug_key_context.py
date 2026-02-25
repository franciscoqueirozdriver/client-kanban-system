import os
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GOOGLE_PRIVATE_KEY")
fixed_key = key.replace("\\n", "\n")

pos = 612
print(f"Contexto em {pos}: '{fixed_key[pos-20:pos+20]}'")
for i in range(pos-5, pos+5):
    if i < len(fixed_key):
        print(f"Pos {i}: '{fixed_key[i]}' (ASCII: {ord(fixed_key[i])})")
