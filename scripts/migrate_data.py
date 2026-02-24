import os
import json
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Configurações
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
GOOGLE_CLIENT_EMAIL = os.getenv("GOOGLE_CLIENT_EMAIL")
GOOGLE_PRIVATE_KEY = os.getenv("GOOGLE_PRIVATE_KEY").replace("\\n", "\n")

# Inicializar clientes
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_google_sheets_service():
    creds = service_account.Credentials.from_service_account_info({
        "client_email": GOOGLE_CLIENT_EMAIL,
        "private_key": GOOGLE_PRIVATE_KEY,
        "token_uri": "https://oauth2.googleapis.com/token",
        "type": "service_account",
        "project_id": "client-kanban-system"
    })
    return build('sheets', 'v4', credentials=creds)

def get_sheet_data(service, sheet_name):
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{sheet_name}!A:ZZ"
        ).execute()
        values = result.get('values', [])
        if not values:
            return pd.DataFrame()
        
        headers = values[0]
        data = values[1:]
        
        # Garantir que todas as linhas tenham o mesmo número de colunas que o cabeçalho
        max_cols = len(headers)
        cleaned_data = []
        for row in data:
            if len(row) < max_cols:
                row.extend([None] * (max_cols - len(row)))
            cleaned_data.append(row[:max_cols])
            
        return pd.DataFrame(cleaned_data, columns=headers)
    except Exception as e:
        print(f"Erro ao ler aba {sheet_name}: {e}")
        return pd.DataFrame()

def migrate_table(sheet_name, table_name, on_conflict=None):
    print(f"\n--- Migrando {sheet_name} -> {table_name} ---")
    service = get_google_sheets_service()
    df = get_sheet_data(service, sheet_name)
    
    if df.empty:
        print(f"Aba {sheet_name} está vazia ou não foi encontrada.")
        return

    # Limpeza básica: substituir strings vazias por None
    df = df.replace('', None)
    
    # Converter para lista de dicionários
    records = df.to_dict('records')
    
    batch_size = 100
    success_count = 0
    fail_count = 0
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            if on_conflict:
                res = supabase.table(table_name).upsert(batch, on_conflict=on_conflict).execute()
            else:
                res = supabase.table(table_name).insert(batch).execute()
            success_count += len(batch)
            print(f"Lote {i//batch_size + 1} processado: {len(batch)} registros.")
        except Exception as e:
            fail_count += len(batch)
            print(f"Erro no lote {i//batch_size + 1} da tabela {table_name}: {e}")

    print(f"Resumo {table_name}: Sucesso {success_count}, Falha {fail_count}")

def main():
    # Ordem de migração para respeitar chaves estrangeiras
    tables = [
        ("sheet1", "leads", "cliente_id"),
        ("layout_importacao_empresas", "layout_importacao_empresas", "cliente_id"),
        ("leads_exact_spotter", "leads_exact_spotter", "cliente_id"),
        ("perdecomp", "perdecomp", "perdcomp_id"),
        ("perdecomp_itens", "perdecomp_itens", None),
        ("perdecomp_facts", "perdecomp_facts", None),
        ("perdecomp_snapshot", "perdecomp_snapshot", None),
        ("padroes", "padroes", None),
        ("historico_interacoes", "historico_interacoes", "message_id"),
        ("mensagens", "mensagens", None),
        ("historico_whats_app", "historico_whats_app", None),
        ("usuarios", "usuarios", "usuario_id"),
        ("dic_tipos", "dic_tipos", "tipo_codigo"),
        ("dic_naturezas", "dic_naturezas", None),
        ("dic_creditos", "dic_creditos", "credito_codigo"),
        ("dic_situacoes", "dic_situacoes", None),
        ("rotas", "rotas", "rota_codigo"),
        ("permissoes", "permissoes", None),
        ("vocab_permissoes", "vocab_permissoes", "chave"),
        ("roles_default", "roles_default", None),
        ("auditoria_acesso", "auditoria_acesso", "evento_id"),
        ("auditoria_acao", "auditoria_acao", "evento_id"),
        ("teses", "teses", "tese_id"),
        ("cnae", "cnae", "cnae_id")
    ]
    
    for sheet, table, pk in tables:
        migrate_table(sheet, table, pk)

if __name__ == "__main__":
    main()
