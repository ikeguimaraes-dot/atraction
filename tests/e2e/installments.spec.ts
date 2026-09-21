import { test, expect } from "@playwright/test";
test("receitas e despesas em 12 parcelas preservam total e vencimentos", async ({
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
  for (const direction of ["receita", "despesa"]) {
    await page
      .getByRole("button", { name: `Nova ${direction}`, exact: true })
      .click();
    await page
      .getByLabel("Descrição", { exact: true })
      .fill(`Taxa ${direction}`);
    await page.getByLabel("Valor total (R$)", { exact: true }).fill("100,00");
    await page.getByLabel("Quantidade de parcelas").fill("12");
    await page.getByLabel("Primeiro vencimento").fill("2028-01-31");
    await page
      .getByRole("dialog")
      .getByLabel("Categoria", { exact: true })
      .selectOption(
        direction === "receita"
          ? "Assinaturas e mensalidades"
          : "Software de uso administrativo",
      );
    await expect(
      page.getByRole("region", { name: "Prévia das parcelas" }),
    ).toContainText("29/02/2028");
    await page.getByRole("button", { name: "Salvar lançamento" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.reload();
  const rows = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atraction-demo-v1")!).finance.filter(
      (r: { title: string }) => r.title.startsWith("Taxa "),
    ),
  );
  expect(rows).toHaveLength(24);
  for (const direction of ["income", "expense"]) {
    const parts = rows.filter(
      (r: { direction: string }) => r.direction === direction,
    );
    expect(
      parts.reduce(
        (s: number, r: { amount_cents: number }) => s + r.amount_cents,
        0,
      ),
    ).toBe(10000);
    expect(
      parts.every(
        (r: { settled_date: string | null }) => r.settled_date === null,
      ),
    ).toBe(true);
    expect(parts.map((r: { due_date: string }) => r.due_date)).toContain(
      "2028-03-31",
    );
  }
});
