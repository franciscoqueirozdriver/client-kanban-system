from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Mock the API call to /api/clientes
        page.route("**/api/clientes**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"clientes": []}'
        ))

        # Navigate to the page with the button that opens the modal
        page.goto("http://localhost:3000/clientes")

        # Click the first button to open the modal
        # Using a data-testid or a more specific selector would be more robust
        page.locator('button:has-text("Enviar para o Spotter")').first.click()

        # Wait for the modal to be visible
        modal_title = page.locator('h2:has-text("Enviar Lead ao Spotter")')
        expect(modal_title).to_be_visible()

        # Check if the "Etapa" input field exists and has the default value "Entrada"
        etapa_input = page.locator('input[name="etapa"]')
        expect(etapa_input).to_have_value("Entrada")

        # Take a screenshot of the modal
        page.screenshot(path="jules-scratch/verification/spotter-modal-verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)