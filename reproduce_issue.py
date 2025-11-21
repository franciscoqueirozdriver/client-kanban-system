import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Mock APIs
    # 1. Search Client - Returns a client with INVALID CNPJ to trigger Enrich button
    page.route("**/api/clientes/buscar?q=Test*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"cliente_id": "CLIENT-123", "nome_da_empresa": "Test Company", "cnpj_empresa": "111", "Cliente_ID": "CLIENT-123"}]'
    ))

    # 2. Enrich
    page.route("**/api/empresas/enriquecer", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"suggestion": {"Nome_da_Empresa": "Test Company Enriched", "CNPJ_Empresa": "90845300000164", "Site_Empresa": "example.com"}}'
    ))

    # 3. Register (Save) - Returns a NEW ID to test if we preserve the old one
    page.route("**/api/empresas/cadastrar", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"company": {"cliente_id": "CLIENT-999", "Cliente_ID": "CLIENT-999", "nome_da_empresa": "Test Company Enriched", "cnpj_empresa": "90845300000164"}}'
    ))

    # 4. Capture the Consultation request to verify the ID
    def handle_consult(route):
        request = route.request
        post_data = request.post_data_json
        print(f"Consultation Request Body: {post_data}")
        route.fulfill(
            status=200,
            content_type="application/json",
            body='{"fallback": {"requested_at": "2023-01-01"}}'
        )

    page.route("**/api/infosimples/perdcomp", handle_consult)

    # 5. Perdecomp Verify
    page.route("**/api/perdecomp/verificar?cnpj=*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"lastConsultation": "2023-01-01"}'
    ))

    page.route("**/api/sheets/cnpj", lambda route: route.fulfill(status=200, body="{}"))


    page.goto("http://localhost:3000/consultas/perdecomp-comparativo")
    page.wait_for_load_state("networkidle")

    # Select Client
    page.get_by_placeholder("Digite o Nome ou CNPJ").fill("Test")
    page.wait_for_timeout(1000)
    page.get_by_text("Test Company").first.click()
    print("Client selected.")

    # Click Enrich
    enrich_btn = page.get_by_role("button", name="Enriquecer dados")
    enrich_btn.wait_for()
    enrich_btn.click()
    print("Clicked Enrich")

    # Confirm Preview
    page.get_by_text("Pré-visualização do Enriquecimento").wait_for()
    confirm_btn = page.get_by_role("button", name="Usar e abrir cadastro")
    confirm_btn.click()
    print("Confirmed Preview")

    # NewCompanyModal - Save
    try:
        page.get_by_text("Cadastrar Nova Empresa", timeout=5000).wait_for()
        save_btn = page.get_by_role("button", name="Cadastrar")
    except:
        print("Cadastrar Nova Empresa not found, checking for Atualizar...")
        page.get_by_text("Atualizar Empresa").wait_for()
        save_btn = page.get_by_role("button", name="Atualizar")

    save_btn.click()
    print("Clicked Cadastrar/Atualizar")

    # Wait for modal to close (using a generic text or role check that implies main screen is back)
    # Or wait for the modal specific element to be detached
    try:
        page.locator("div[role='dialog']").wait_for(state="detached", timeout=5000)
        print("Modal closed")
    except:
        print("Modal did not close cleanly or timed out.")

    # Click Consultar
    consult_btn = page.get_by_role("button", name="Consultar / Atualizar Comparação")

    try:
        consult_btn.wait_for(state="visible", timeout=5000)
        if consult_btn.is_disabled():
            print("Button is disabled! Client state might be lost.")
        else:
            consult_btn.click()
            print("Clicked Consultar")
    except Exception as e:
        print(f"Error finding/clicking consult button: {e}")

    # Wait for network request
    page.wait_for_timeout(2000)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
