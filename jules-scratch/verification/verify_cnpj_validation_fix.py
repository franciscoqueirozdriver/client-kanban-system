from playwright.sync_api import sync_playwright, expect
import re

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # --- Mocks ---
    def mock_client_search(route):
        route.fulfill(
            status=200,
            json=[{
                "Cliente_ID": "1",
                "Nome_da_Empresa": "Cliente Exemplo Ltda",
                "CNPJ_Empresa": "12345678000195"
            }]
        )

    def mock_competitor_search(route):
        route.fulfill(
            status=200,
            json={
                "items": [
                    {"nome": "Concorrente Válido S.A.", "cnpj": "11222333000188"},
                    {"nome": "Concorrente Sem CNPJ", "cnpj": ""},
                    {"nome": "Outro Concorrente", "cnpj": "99888777000166"}
                ]
            }
        )

    page.route(re.compile(r"/api/clientes/buscar.*"), mock_client_search)
    page.route("**/api/empresas/concorrentes", mock_competitor_search)
    # --- End Mocks ---

    try:
        # 1. Navigate to the page
        page.goto("http://localhost:3000/consultas/perdecomp-comparativo")

        expect(page.get_by_role("heading", name="PER/DCOMP Comparativo")).to_be_visible(timeout=20000)

        # 2. Select a client company
        client_autocomplete = page.get_by_placeholder("Digite o Nome ou CNPJ")
        expect(client_autocomplete).to_be_visible()

        client_autocomplete.press_sequentially("cliente", delay=150)

        # A more robust selector for the option that appears
        option_to_click = page.locator('div[cmdk-item]').filter(has_text="Cliente Exemplo Ltda").first
        expect(option_to_click).to_be_visible(timeout=10000)
        option_to_click.click()

        # 3. Open the competitor search dialog
        search_competitors_button = page.get_by_role("button", name="Pesquisar Concorrentes")
        expect(search_competitors_button).to_be_enabled()
        search_competitors_button.click()

        # 4. Select a competitor in the dialog
        dialog_title = page.get_by_role("heading", name="Sugestões de Concorrentes")
        expect(dialog_title).to_be_visible()

        # Select the competitor without a CNPJ
        competitor_row = page.locator("li", has_text="Concorrente Sem CNPJ")
        expect(competitor_row).to_be_visible(timeout=10000)

        competitor_checkbox = competitor_row.get_by_role("checkbox")
        expect(competitor_checkbox).to_be_visible()
        competitor_checkbox.check()

        # 5. Confirm the selection
        confirm_button = page.get_by_role("button", name="Adicionar selecionados")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()

        # 6. Verify the competitor was added to the main page
        expect(dialog_title).not_to_be_visible(timeout=5000)

        # Check if the competitor card is now on the page, showing the name in the input.
        expect(page.locator('input[value="Concorrente Sem CNPJ"]')).to_be_visible()

        # 7. Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)