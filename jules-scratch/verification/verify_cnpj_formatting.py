from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the page that has the "Cadastrar Nova Empresa" button
    page.goto("http://localhost:3000/clientes")

    # Click the button to open the modal
    page.click('button:has-text("Cadastrar Nova Empresa")')

    # Wait for the modal to appear
    page.wait_for_selector('h2:has-text("Cadastrar Nova Empresa")')

    # Get the CNPJ input field
    cnpj_input = page.locator('input[name="CNPJ_Empresa"]')

    # Enter a CNPJ value
    cnpj_input.fill("12345678000190")

    # Trigger the onBlur event to format the CNPJ
    cnpj_input.evaluate('e => e.blur()')

    # Take a screenshot of the modal
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)