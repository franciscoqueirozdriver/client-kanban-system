import os
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GOOGLE_PRIVATE_KEY")
fixed_key = key.replace("\\n", "\n")

# O erro reportou InvalidByte(576, 92)
# 92 é o código ASCII para a barra invertida (\)
pos = 576
if pos < len(fixed_key):
    print(f"Caractere na posição {pos}: '{fixed_key[pos]}' (ASCII: {ord(fixed_key[pos])})")
    print(f"Contexto: '{fixed_key[pos-10:pos+10]}'")
else:
    print(f"Posição {pos} fora do alcance (tamanho: {len(fixed_key)})")

# Procurar todas as barras invertidas
for i, char in enumerate(fixed_key):
    if char == '\\':
        print(f"Barra invertida encontrada na posição {i}")
