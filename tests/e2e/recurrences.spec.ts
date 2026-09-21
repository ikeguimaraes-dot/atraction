import { test, expect } from "@playwright/test";
test("assinaturas repetem o valor mensal e podem ser encerradas", async ({
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
  await page
    .getByRole("button", { name: "Todos os meses", exact: true })
    .click();
  for (const direction of ["receita", "despesa"]) {
    await page
      .getByRole("button", { name: `Nova ${direction}`, exact: true })
      .click();
    await page
      .getByLabel("Descrição", { exact: true })
      .fill(`Assinatura ${direction}`);
    await page.getByLabel("Repetir mensalmente", { exact: true }).check();
    await expect(page.getByLabel("Quantidade de parcelas")).toHaveCount(0);
    await page.getByLabel("Valor mensal (R$)", { exact: true }).fill("99,90");
    await page.getByLabel("Primeiro vencimento").fill("2028-01-31");
    if (direction === "receita")
      await page.getByLabel("Repetir até (opcional)").fill("2028-03-31");
    await page
      .getByRole("button", { name: "Salvar recorrência", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page
        .locator(".ledger-row")
        .filter({ hasText: `Assinatura ${direction}` }),
    ).toHaveCount(direction === "receita" ? 3 : 12);
  }
  await page
    .getByText("Recorrências mensais (1 ativas)", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Encerrar Assinatura despesa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar encerramento", exact: true })
    .click();
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Assinatura despesa" }),
  ).toHaveCount(0);
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atraction-demo-v1")!),
  );
  expect(
    saved.recurrences.find(
      (r: { direction: string }) => r.direction === "expense",
    ).active,
  ).toBe(false);
  const incomes = saved.finance.filter((r: { title: string }) =>
    r.title.startsWith("Assinatura receita"),
  );
  expect(incomes).toHaveLength(3);
  expect(
    incomes.every((r: { amount_cents: number }) => r.amount_cents === 9990),
  ).toBe(true);
});
