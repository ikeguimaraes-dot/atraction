import { expect, test, type Page } from "@playwright/test";

async function go(page: Page, label: string) {
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator("nav")
    .getByRole("button", { name: label, exact: true })
    .click();
}

test("NF e Recibos groups a credit card purchase and creates ten monthly charges", async ({
  page,
}) => {
  await page.goto("/");
  await go(page, "NF e Recibos");
  await expect(
    page.getByRole("heading", { name: "NF e Recibos", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Data de emissão").fill("2026-09-15");
  await page.getByLabel("Valor total (R$)").fill("1.629,11");
  await page.getByLabel("Forma de pagamento").selectOption("credit_card");
  await page.getByLabel("Quantidade de parcelas").fill("10");
  await page.getByLabel("Primeiro vencimento").fill("2028-01-31");
  await page.getByLabel("Categoria", { exact: true }).fill("Materiais");
  await page.getByLabel("Descrição da despesa").fill("Compra parcelada teste");
  await page.getByLabel("Foto ou PDF").setInputFiles({
    name: "nota.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("region", { name: "Prévia das parcelas" }),
  ).toContainText("29/02/2028");
  await page
    .getByRole("button", { name: "Cadastrar despesa e comprovante" })
    .click();
  const purchase = page
    .getByRole("region", { name: "setembro de 2026" })
    .locator("details")
    .filter({ hasText: "Compra parcelada teste" });
  await expect(purchase).toBeVisible();
  await expect(page.getByLabel("Valor total (R$)")).toHaveValue("");
  await purchase.locator("summary").click();
  await expect(purchase).toContainText("Cartão de crédito");
  await expect(purchase).toContainText("10 parcelas");
  const popupPromise = page.waitForEvent("popup");
  await purchase.getByRole("button", { name: "Abrir comprovante" }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toMatch(/^blob:/);
  await popup.close();
  await page.reload();
  await go(page, "Financeiro");
  await page.getByRole("tab", { name: "Despesas", exact: true }).click();
  await page.getByLabel("Mês de referência").fill("2028-02");
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Compra parcelada teste" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Compra parcelada teste" }),
  ).toContainText("2/10");
  await page.getByLabel("Mês de referência").fill("2028-11");
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Compra parcelada teste" }),
  ).toHaveCount(0);
  const rows = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atraction-demo-v1")!).finance.filter(
      (row: { title: string }) =>
        row.title.startsWith("Compra parcelada teste"),
    ),
  );
  expect(rows).toHaveLength(10);
  expect(
    rows.reduce(
      (sum: number, row: { amount_cents: number }) => sum + row.amount_cents,
      0,
    ),
  ).toBe(162911);
});

test("switching to Pix resets installment count", async ({ page }) => {
  await page.goto("/");
  await go(page, "NF e Recibos");
  await page.getByLabel("Quantidade de parcelas").fill("10");
  await page.getByLabel("Forma de pagamento").selectOption("pix");
  await expect(page.getByLabel("Quantidade de parcelas")).toHaveValue("1");
  await expect(page.getByLabel("Quantidade de parcelas")).toBeDisabled();
});
