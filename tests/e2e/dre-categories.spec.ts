import { test, expect } from "@playwright/test";
test("categorias classificam automaticamente receitas e despesas na DRE", async ({
  page,
}) => {
  await page.goto("/");
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Financeiro", exact: true })
    .click();
  for (const [direction, category, amount] of [
    ["receita", "Prestação de serviços", "1000"],
    ["receita", "Aporte de capital dos sócios", "5000"],
    ["receita", "Rendimentos de aplicações financeiras", "20"],
    ["despesa", "Juros de empréstimos e financiamentos", "10"],
    ["despesa", "ISS sobre faturamento", "50"],
  ]) {
    await page
      .getByRole("button", { name: `Nova ${direction}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Descrição", { exact: true }).fill(category);
    await dialog
      .getByLabel("Categoria", { exact: true })
      .selectOption(category);
    await expect(dialog.getByText(/Classificação automática:/)).toBeVisible();
    await expect(
      dialog.getByLabel("Grupo na DRE", { exact: true }),
    ).toHaveCount(0);
    await dialog.getByLabel("Valor total (R$)", { exact: true }).fill(amount);
    await dialog
      .getByLabel(
        direction === "receita"
          ? "Já recebi esse valor"
          : "Já paguei esse valor",
      )
      .check();
    await dialog
      .getByRole("button", { name: "Salvar lançamento", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  if (await menu.isVisible()) await menu.click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Contas e DRE", exact: true })
    .click();
  const lines = page.locator(".dre-lines");
  await expect(
    lines
      .locator(":scope > div")
      .filter({ has: page.getByText("Resultado do período", { exact: true }) }),
  ).toContainText("R$ 960");
  await page.getByText("Movimentos fora da DRE", { exact: true }).click();
  await expect(
    page.getByText(/Aporte de capital dos sócios · Entrada:/),
  ).toBeVisible();
  await page.getByText("Detalhar por categoria", { exact: true }).click();
  await expect(
    page.locator(".setting-line").filter({ hasText: "ISS sobre faturamento" }),
  ).toBeVisible();
});
