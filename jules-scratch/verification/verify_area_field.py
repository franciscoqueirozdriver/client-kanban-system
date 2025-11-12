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
        elif "/api/padroes" in route.request.url:
            mock_response = {
                "produtos": ["Produto A", "Produto B"],
                "mercados": ["Mercado X", "Mercado Y"],
                "areas": ["Área 1", "Área 2", "Área 3"],
                "prevendedores": ["test@test.com"]
            }
            route.fulfill(json=mock_response)
        else:
            route.continue_()

    page.route("**/*", handle_route)

    page.goto("http://localhost:3000/clientes", wait_until="networkidle")

    # Open the Spotter Modal
    page.get_by_role("article").first.get_by_role("button", name="Enviar ao Spotter").click()

    # Verify the "Área" field is a select dropdown and take a screenshot
    area_select = page.get_by_label("Área *")
    expect(area_select).to_be_visible()

    page.screenshot(path="jules-scratch/verification/spotter-modal-area-field.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)