import re
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    Verifies that the last consultation date and refresh checkbox are visible
    for a company with a prior consultation, using the 'create new company' flow.
    """
    # 1. Navigate to the application
    page.goto("http://localhost:3000/consultas/perdecomp-comparativo", wait_until="networkidle")

    # 2. Find the input and enter a name for a new company
    client_input = page.get_by_placeholder("Digite o Nome ou CNPJ")
    expect(client_input).to_be_visible(timeout=10000)
    client_input.fill("Empresa Teste Para Verificacao")

    # 3. Click the button to trigger the 'create new' modal
    create_button = page.get_by_role("button", name=re.compile("Cadastrar .*"))
    expect(create_button).to_be_visible(timeout=10000)
    create_button.click()

    # 4. In the modal, fill in the CNPJ that will trigger the last consultation logic and save
    expect(page.get_by_role("heading", name="Cadastrar Nova Empresa")).to_be_visible()

    cnpj_input = page.get_by_label("CNPJ")
    expect(cnpj_input).to_be_visible()
    cnpj_input.fill("00.000.000/0001-91")

    save_button = page.get_by_role("button", name="Salvar Empresa")
    save_button.click()

    # 5. After saving, verify the UI elements are visible on the main page
    # Assert that the last consultation info is now visible
    last_consultation_text = page.get_by_text(re.compile("Última consulta em .*"))
    expect(last_consultation_text).to_be_visible(timeout=15000)

    # Assert that the "Refazer consulta" checkbox is also visible
    refresh_checkbox = page.get_by_label("Refazer consulta ao atualizar")
    expect(refresh_checkbox).to_be_visible()

    print("UI elements verified successfully.")

    # 6. Take a screenshot for visual confirmation
    page.screenshot(path="jules-scratch/verification/verification.png")
    print("Screenshot taken successfully.")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_verification(page)
            print("Verification script completed successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
            page.screenshot(path="jules-scratch/verification/verification_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    main()