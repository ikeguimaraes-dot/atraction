import { test, expect } from "@playwright/test";
test("cards mensais somam valores cadastrados por vencimento, inclusive baixados", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio em dia" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
    const base = {
      tenant_id: "demo",
      owner_id: null,
      created_at: "2028-01-01",
      updated_at: "2028-01-01",
      deleted_at: null,
      is_example: true,
      category: "Teste",
      contact_id: null,
      supplier_id: null,
      notes: "",
      settled_date: null,
      payments: [],
    };
    s.finance = [
      {
        ...base,
        id: "month-1",
        title: "Receita paga depois",
        direction: "income",
        amount_cents: 10000,
        due_date: "2028-01-31",
        settled_date: "2028-02-02",
        payments: [
          {
            id: "p1",
            date: "2028-02-02",
            amount_cents: 10000,
            account_id: null,
          },
        ],
      },
      {
        ...base,
        id: "month-2",
        title: "Receita parcial",
        direction: "income",
        amount_cents: 10000,
        due_date: "2028-01-15",
        payments: [
          {
            id: "p2",
            date: "2028-01-15",
            amount_cents: 2500,
            account_id: null,
          },
        ],
      },
      {
        ...base,
        id: "month-3",
        title: "Despesa janeiro",
        direction: "expense",
        amount_cents: 6000,
        due_date: "2028-01-20",
      },
      {
        ...base,
        id: "month-4",
        title: "Despesa fevereiro",
        direction: "expense",
        amount_cents: 20000,
        due_date: "2028-02-29",
      },
      {
        ...base,
        id: "month-5",
        title: "Excluída",
        direction: "expense",
        amount_cents: 99900,
        due_date: "2028-01-20",
        deleted_at: "2028-01-01",
      },
    ];
    localStorage.setItem("atraction-demo-v1", JSON.stringify(s));
  });
  await page.reload();
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Financeiro", exact: true })
    .click();
  const month = page.getByLabel("Mês de referência");
  await month.fill("2028-01");
  const income = page.getByLabel("Receita cadastrada", { exact: true });
  const expense = page.getByLabel("Despesa cadastrada", { exact: true });
  await expect(income).toContainText("R$ 200");
  await expect(expense).toContainText("R$ 60");
  const profit = page.getByLabel("Lucro calculado", { exact: true });
  await expect(profit).toContainText("R$ 140");
  await expect(income).toContainText("Receita do mês");
  await expect(expense).toContainText("Despesa do mês");
  await expect(profit).toContainText("Lucro do mês");
  await expect(page.locator(".ledger-row")).toHaveCount(2);
  await page.getByRole("tab", { name: "Despesas", exact: true }).click();
  await expect(page.locator(".ledger-row")).toHaveCount(1);
  await expect(income).toContainText("R$ 200");
  await month.fill("2028-02");
  await expect(income).toContainText("R$ 0");
  await expect(expense).toContainText("R$ 200");
  await expect(profit).toContainText(/-R\$\s*200/);
  await expect(profit).toContainText("Prejuízo");
  await expect(page.locator(".ledger-row")).toContainText("Despesa fevereiro");
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await expect(month).toHaveValue("2028-02");
  await month.fill("2028-03");
  await expect(income).toContainText("R$ 0");
  await expect(expense).toContainText("R$ 0");
  await expect(page.locator(".ledger-row")).toHaveCount(0);
  await expect(profit).toContainText("R$ 0");
  await page
    .getByRole("combobox", { name: "Filtro de datas", exact: true })
    .selectOption("period");
  await page.getByLabel("Data inicial", { exact: true }).fill("2028-01-20");
  await page.getByLabel("Data final", { exact: true }).fill("2028-02-29");
  await expect(income).toContainText("Receita do período");
  await expect(income).toContainText("R$ 100");
  await expect(expense).toContainText("R$ 260");
  await expect(profit).toContainText(/-R\$\s*160/);
  await expect(page.locator(".ledger-row")).toHaveCount(2);
  await page.getByRole("tab", { name: "Receitas", exact: true }).click();
  await expect(page.locator(".ledger-row")).toHaveCount(1);
  await expect(page.locator(".ledger-row")).toContainText(
    "Receita paga depois",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar financeiro (CSV)" }).click();
  const stream = await (await downloadPromise).createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain("Receita paga depois");
  expect(csv).not.toContain("Receita parcial");
  await page.getByLabel("Data inicial", { exact: true }).fill("2028-03-01");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "A data final deve ser igual ou posterior" }),
  ).toContainText("A data final deve ser igual ou posterior");
  await expect(
    page.getByRole("button", { name: "Exportar financeiro (CSV)" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Todos os meses", exact: true })
    .click();
  await expect(income).toContainText("R$ 200");
  await expect(expense).toContainText("R$ 260");
  await expect(profit).toContainText(/-R\$\s*60/);
  await page.getByRole("button", { name: "Mês atual", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Filtro de datas", exact: true }),
  ).toHaveValue("month");
  await expect(page.getByLabel("Mês de referência")).toHaveValue(
    await page.evaluate(() => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
