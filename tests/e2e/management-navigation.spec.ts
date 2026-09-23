import { test, expect, Page } from "@playwright/test";
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
test("gestão sem módulos de marketing, cadastro e edição de clientes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio em dia" }),
  ).toBeVisible();
  for (const name of [
    "Pessoas",
    "Caminho do cliente",
    "Conversas",
    "Robôs",
    "Atrair clientes",
    "Resultados",
  ])
    await expect(
      page.locator("nav").getByRole("button", { name, exact: true }),
    ).toHaveCount(0);
  await go(page, "Clientes");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await expect(page.getByLabel("Campanha", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Como chegou", { exact: false })).toHaveCount(0);
  await page.getByLabel("Nome", { exact: true }).fill("Cliente gestão");
  await page.getByLabel("Telefone com DDD").fill("11954321234");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await page.reload();
  await go(page, "Clientes");
  await page
    .locator(".customer-card")
    .filter({ hasText: "Cliente gestão" })
    .click();
  await expect(
    page.getByRole("button", { name: "Abrir conversa" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Editar cliente" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente atualizado");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(
    page.locator(".customer-card").filter({ hasText: "Cliente atualizado" }),
  ).toBeVisible();
  await page
    .locator(".customer-card")
    .filter({ hasText: "Cliente atualizado" })
    .click();
  await page.getByRole("button", { name: "Mover para lixeira" }).click();
  await expect(
    page.locator(".customer-card").filter({ hasText: "Cliente atualizado" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(
    page.locator(".customer-card").filter({ hasText: "Cliente atualizado" }),
  ).toBeVisible();
  for (const name of [
    "Visão geral",
    "Contratos",
    "Agenda",
    "Pós-venda",
    "Financeiro",
    "Contas e DRE",
    "Fornecedores",
    "Documentos e cadastros",
  ]) {
    await go(page, name);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page
    .getByLabel("Cliente do documento")
    .selectOption({ label: "Cliente atualizado" });
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Gerar PDF", exact: true }).click();
  expect((await pdf).suggestedFilename()).toContain(".pdf");
  await go(page, "Visão geral");
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await page
    .locator(".sidebar")
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.screenshot({
    path: test.info().outputPath("gestao.png"),
    fullPage: true,
  });
});
test("antigos links de captação não recebem novos cadastros", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/atraction_(capture|chat)/.test(r.url())) calls.push(r.url());
  });
  const response = await page.goto("/c/demonstracao");
  expect(response?.status()).toBe(404);
  await expect(page.locator("form")).toHaveCount(0);
  expect(calls).toEqual([]);
});
