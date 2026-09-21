import { test, expect } from "@playwright/test";
test("cards mensais somam valores cadastrados por vencimento, inclusive baixados", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Um bom dia para crescer." }),
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
  await expect(page.locator(".ledger-row")).toHaveCount(2);
  await page.getByRole("tab", { name: "Despesas", exact: true }).click();
  await expect(page.locator(".ledger-row")).toHaveCount(1);
  await expect(income).toContainText("R$ 200");
  await month.fill("2028-02");
  await expect(income).toContainText("R$ 0");
  await expect(expense).toContainText("R$ 200");
  await expect(page.locator(".ledger-row")).toContainText("Despesa fevereiro");
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await expect(month).toHaveValue("2028-02");
  await month.fill("2028-03");
  await expect(income).toContainText("R$ 0");
  await expect(expense).toContainText("R$ 0");
  await expect(page.locator(".ledger-row")).toHaveCount(0);
});
