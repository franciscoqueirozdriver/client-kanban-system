from playwright.sync_api import sync_playwright, Page, expect

def verify_frontend_changes(page: Page):
    """
    This script verifies the frontend changes for the PER/DCOMP comparison page.
    """
    # 1. Navigate to the page
    page.goto("http://localhost:3002/consultas/perdecomp-comparativo")

    # 2. Input a CNPJ to load the client data
    cnpj_input = page.get_by_placeholder("Digite o Nome ou CNPJ")
    expect(cnpj_input).to_be_visible()
    cnpj_input.fill("33400167000120")

    # 3. Click the first result in the autocomplete list
    first_result = page.locator('ul > li').first
    expect(first_result).to_be_visible(timeout=15000)
    first_result.click()

    # 4. Wait for the main client card to appear
    main_client_card = page.locator('article.group') # Using a more robust selector from MainClientCard.tsx
    expect(main_client_card).to_be_visible(timeout=30000)

    # 5. Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_frontend_changes(page)
        browser.close()

if __name__ == "__main__":
    main()