import { expect, test, type Page } from "@playwright/test";
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
test("gerente vê despesas sem comprovante, cadastra e edita, sem baixas ou exclusões", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
    const date = new Date().toISOString().slice(0, 10);
    const base = {
      tenant_id: "demo",
      owner_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      is_example: true,
      direction: "expense",
      amount_cents: 55000,
      category: "Materiais",
      dre_group: "expense",
      due_date: date,
      purchase_date: date,
      purchase_installments: 1,
      purchase_installment: 1,
      payment_method: "pix",
      purchase_payer: "company",
      settled_date: null,
      payments: [],
      contact_id: null,
      supplier_id: null,
      notes: "",
    };
    s.role = "manager";
    s.tenant.name = "Orkestri";
    s.finance = [
      { ...base, id: "apple", purchase_id: "apple", title: "Apple Developer" },
      {
        ...base,
        id: "september",
        purchase_id: "september",
        title: "Despesa setembro",
        purchase_date: "2026-09-15",
        due_date: "2026-09-15",
      },
    ];
    s.documents = [];
    s.recurrences = [];
    localStorage.setItem("atraction-demo-v1", JSON.stringify(s));
  });
  await page.reload();
  await go(page, "NF e Recibos");
  await expect(
    page.getByRole("heading", { name: "Despesas por mês · Orkestri" }),
  ).toBeVisible();
  const apple = page.locator("details").filter({ hasText: "Apple Developer" });
  await expect(apple).toBeVisible();
  await expect(
    page.getByRole("region", { name: "setembro de 2026" }),
  ).toContainText("Despesa setembro");
  await apple.locator("summary").click();
  await apple
    .getByRole("button", { name: "Editar despesa", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Descrição da despesa")
    .fill("Apple Developer editado");
  await page.getByRole("button", { name: "Salvar despesa" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Valor total (R$)").fill("100");
  await page.getByLabel("Categoria", { exact: true }).fill("Materiais");
  await page
    .getByLabel("Descrição da despesa")
    .fill("Despesa criada pela gerente");
  await page
    .getByRole("button", { name: "Cadastrar despesa", exact: true })
    .click();
  await expect(
    page.locator("summary").filter({ hasText: "Despesa criada pela gerente" }),
  ).toBeVisible();
  await go(page, "Financeiro");
  await page.getByRole("tab", { name: "Despesas", exact: true }).click();
  const row = page
    .locator(".ledger-row")
    .filter({ hasText: "Apple Developer editado" });
  await expect(
    row.getByRole("button", { name: "Pagar", exact: true }),
  ).toBeDisabled();
  await expect(
    row.getByRole("button", {
      name: "Excluir Apple Developer editado",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    row.getByRole("button", {
      name: "Editar Apple Developer editado",
      exact: true,
    }),
  ).toBeEnabled();
  await go(page, "Contas e DRE");
  await expect(
    page.getByRole("button", { name: "Registrar acerto", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Registrar transferência", exact: true }),
  ).toBeDisabled();
});
