import { test, expect, Page } from "@playwright/test";
async function go(p: Page, label: string) {
  const menu = p.getByRole("button", { name: "Abrir navegação", exact: true });
  if (await menu.isVisible()) await menu.click();
  await p
    .locator("nav")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("contas, baixa parcial, transferência e DRE", async ({ page }) => {
  await page.goto("/");
  await go(page, "Contas e DRE");
  for (const name of ["Banco teste", "Caixa teste"]) {
    await page.getByRole("button", { name: "Nova conta", exact: true }).click();
    await page.getByLabel("Nome da conta").fill(name);
    await page
      .getByRole("button", { name: "Salvar conta", exact: true })
      .click();
  }
  await go(page, "Financeiro");
  await page.getByRole("button", { name: "Nova receita", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Receita parcial");
  await page.getByLabel("Valor total (R$)", { exact: true }).fill("100");
  await page
    .getByRole("dialog")
    .getByLabel("Categoria", { exact: true })
    .selectOption("Prestação de serviços");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  const row = page
    .locator(".ledger-row")
    .filter({ hasText: "Receita parcial" });
  await row.getByRole("button", { name: "Receber", exact: true }).click();
  await page.getByLabel("Valor da baixa (R$)").fill("30");
  await page
    .getByLabel("Conta da baixa")
    .selectOption({ label: "Banco teste" });
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(row).toContainText("Parcial");
  await expect(row).toContainText(/Restante: R\$\s*70/);
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar financeiro (CSV)" }).click();
  expect((await csv).suggestedFilename()).toContain(".csv");
  await go(page, "Contas e DRE");
  await expect(page.locator(".dre-lines")).toContainText(/R\$\s*30/);
  await page
    .getByRole("button", { name: "Registrar transferência", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Da conta", exact: true })
    .selectOption({ label: "Banco teste" });
  await page.getByLabel("Para a conta").selectOption({ label: "Caixa teste" });
  await page.getByLabel("Valor transferido (R$)").fill("10");
  await page.getByRole("button", { name: "Salvar transferência" }).click();
  await expect(
    page.locator(".customer-grid").filter({ hasText: "Banco teste" }),
  ).toContainText(/R\$\s*20/);
  await expect(page.locator(".dre-lines")).toContainText(/R\$\s*30/);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
