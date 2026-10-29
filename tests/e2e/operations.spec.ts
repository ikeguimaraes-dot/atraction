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

test("baixa identifica pagador e responsável pela despesa", async ({
  page,
}) => {
  await page.goto("/");
  await go(page, "Financeiro");
  await page.getByRole("button", { name: "Nova despesa", exact: true }).click();
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Despesa da empresa teste");
  await page.getByLabel("Valor total (R$)", { exact: true }).fill("100");
  await page
    .getByRole("dialog")
    .getByLabel("Categoria", { exact: true })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  const row = page
    .locator(".ledger-row")
    .filter({ hasText: "Despesa da empresa teste" });
  await row.getByRole("button", { name: "Pagar", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Quem pagou", exact: true }),
  ).toHaveValue("company");
  await expect(
    page.getByRole("combobox", { name: "De quem é a despesa", exact: true }),
  ).toHaveValue("company");
  await expect(page.getByRole("dialog")).toContainText("Não há reembolso");
  await page.getByLabel("Valor da baixa (R$)").fill("40");
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(row).toContainText("Parcial");
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("atraction-demo-v1")!).finance.find(
        (f: { title: string }) => f.title === "Despesa da empresa teste",
      ).payments[0],
  );
  expect(saved.payer_user_id).toBeNull();
  expect(saved.allocations).toEqual([{ user_id: null, amount_cents: 4000 }]);
  await row.getByRole("button", { name: "Pagar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    /Despesa de Empresa: R\$\s*40/,
  );
  await page.getByRole("button", { name: "Estornar baixa" }).click();
  await expect(
    page.getByRole("button", { name: "Estornar baixa" }),
  ).toHaveCount(0);
});

test("corrige pagador de despesa paga pelo editor sem estornar", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
    const date = new Date().toISOString().slice(0, 10);
    s.finance = [
      {
        id: "paid-expense",
        tenant_id: "demo",
        owner_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        is_example: true,
        title: "Despesa paga teste",
        direction: "expense",
        amount_cents: 55000,
        category: "Materiais",
        due_date: date,
        settled_date: date,
        payments: [
          {
            id: "existing-payment",
            date,
            amount_cents: 55000,
            account_id: null,
          },
        ],
        contact_id: null,
        supplier_id: null,
        notes: "",
      },
    ];
    s.recurrences = [];
    localStorage.setItem("atraction-demo-v1", JSON.stringify(s));
  });
  await page.reload();
  await go(page, "Financeiro");
  await page.getByRole("tab", { name: "Despesas", exact: true }).click();
  const row = page
    .locator(".ledger-row")
    .filter({ hasText: "Despesa paga teste" });
  await row
    .getByRole("button", { name: "Editar Despesa paga teste", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Corrigir quem pagou", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Corrigir quem pagou", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Quem pagou esta baixa", exact: true })
    .selectOption("company");
  await page
    .getByRole("button", { name: "Salvar pagador", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Pago por Empresa");
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("atraction-demo-v1")!).finance[0],
  );
  expect(saved.payments).toHaveLength(1);
  expect(saved.payments[0]).toMatchObject({
    id: "existing-payment",
    amount_cents: 55000,
    account_id: null,
    payer_user_id: null,
    allocations: [{ user_id: null, amount_cents: 55000 }],
  });
  expect(saved.settled_date).toBe(saved.payments[0].date);
});
