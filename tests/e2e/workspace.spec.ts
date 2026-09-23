import { test, expect, Page } from "@playwright/test";
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
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio em dia" }),
  ).toBeVisible();
});

test("cliente manual, fornecedor e financeiro com baixa e persistência", async ({
  page,
}) => {
  await go(page, "Clientes");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente da casa");
  await page.getByLabel("Telefone com DDD").fill("21988887777");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await page
    .getByRole("button", { name: /Cliente da casa Cliente ativo/ })
    .click();
  await expect(page.getByLabel("Financeiro do cliente")).toBeVisible();
  await page
    .getByRole("button", { name: "Ver lançamentos deste cliente" })
    .click();
  await page.getByRole("button", { name: "Nova receita", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Mensalidade teste");
  await page.getByLabel("Valor total (R$)", { exact: true }).fill("123,45");
  await expect(page.getByLabel("Cliente ou pessoa")).not.toHaveValue("");
  await page
    .getByRole("dialog")
    .getByLabel("Categoria", { exact: true })
    .selectOption("Prestação de serviços");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  const income = page
    .locator(".ledger-row")
    .filter({ hasText: "Mensalidade teste" });
  await expect(income).toContainText("Em aberto");
  await income.getByRole("button", { name: "Receber", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(income).toContainText("Recebido");
  await go(page, "Fornecedores");
  await page.getByRole("button", { name: "Novo fornecedor" }).click();
  await page.getByLabel("Nome do fornecedor").fill("Fornecedor teste");
  await page.getByRole("button", { name: "Salvar fornecedor" }).click();
  await go(page, "Financeiro");
  await page.getByRole("button", { name: "Nova despesa", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Materiais teste");
  await page.getByLabel("Valor total (R$)", { exact: true }).fill("23,45");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Fornecedor", exact: true })
    .selectOption({ label: "Fornecedor teste" });
  await page.getByLabel("Já paguei esse valor").check();
  await page
    .getByRole("dialog")
    .getByLabel("Categoria", { exact: true })
    .selectOption("Materiais aplicados nos serviços");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(
    page.locator(".finance-summary:not(.monthly-totals)"),
  ).toContainText("R$ 100");
  await page.reload();
  await go(page, "Financeiro");
  await page.getByRole("tab", { name: "Despesas", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Despesas", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Mensalidade teste" }),
  ).toHaveCount(0);
  const expense = page
    .locator(".ledger-row")
    .filter({ hasText: "Materiais teste" });
  await expect(expense).toContainText("Pago");
  await expense.getByRole("button", { name: "Reabrir" }).click();
  await expect(expense).toContainText("Em aberto");
  await expense
    .getByRole("button", { name: "Excluir Materiais teste" })
    .click();
  await expect(expense).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(expense).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("settled");
  await expect(expense).toHaveCount(0);
  await expect(page.locator(".ledger-row")).toHaveCount(0);
  await page.getByRole("tab", { name: "Receitas", exact: true }).click();
  await expect(income).toContainText("Recebido");
  await expect(expense).toHaveCount(0);
  await page.screenshot({
    path: `test-results/finance-${test.info().project.name}.png`,
    fullPage: true,
  });
});
