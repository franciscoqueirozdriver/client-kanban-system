import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Mock the API response to avoid Google Sheets dependency
    def handle_route(route):
        if "/api/clientes" in route.request.url:
            mock_response = {
                "clients": [
                    {
                        "id": "1",
                        "company": "Test Company",
                        "segment": "Test Segment",
                        "uf": "TS",
                        "city": "Test City",
                        "contacts": [],
                        "opportunities": []
                    }
                ],
                "filters": {
                    "segmento": ["Test Segment"],
                    "uf": ["TS"],
                    "cidade": ["Test City"]
                }
            }
            route.fulfill(json=mock_response)
        else:
            route.continue_()

    page.route("**/*", handle_route)

    page.goto("http://localhost:3000/clientes", wait_until="networkidle")

    # Verify NewCompanyModal
    page.get_by_role("button", name="Novo cliente").click()

    modal_title = page.locator("#modal-title")
    expect(modal_title).to_have_text("Cadastrar Nova Empresa")
    page.screenshot(path="jules-scratch/verification/new-company-modal.png")

    page.get_by_role("button", name="Cancelar").click()

    # Verify SpotterModal by clicking the "Enviar ao Spotter" button inside the first client card
    page.get_by_role("article").first.get_by_role("button", name="Enviar ao Spotter").click()

    spotter_modal_title = page.get_by_role("heading", name=re.compile("Enviar .* ao Spotter", re.IGNORECASE))
    expect(spotter_modal_title).to_be_visible()

    page.screenshot(path="jules-scratch/verification/spotter-modal.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)