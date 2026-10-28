import { expect, test, type Page } from "@playwright/test";

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

test("NF e Recibos groups a credit card purchase and creates ten monthly charges", async ({
  page,
}) => {
  await page.goto("/");
  await go(page, "NF e Recibos");
  await expect(
    page.getByRole("heading", { name: "NF e Recibos", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Data de emissão").fill("2026-09-15");
  await page.getByLabel("Valor total (R$)").fill("1.629,11");
  await page.getByLabel("Forma de pagamento").selectOption("credit_card");
  await page
    .getByRole("combobox", { name: "Quem pagou", exact: true })
    .selectOption("company");
  await page.getByLabel("Quantidade de parcelas").fill("10");
  await page.getByLabel("Primeiro vencimento").fill("2028-01-31");
  await page.getByLabel("Categoria", { exact: true }).fill("Materiais");
  await page.getByLabel("Descrição da despesa").fill("Compra parcelada teste");
  await page.getByLabel("Foto ou PDF").setInputFiles({
    name: "nota.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("region", { name: "Prévia das parcelas" }),
  ).toContainText("29/02/2028");
  await page.getByRole("button", { name: "Cadastrar despesa" }).click();
  const purchase = page
    .getByRole("region", { name: "setembro de 2026" })
    .locator("details")
    .filter({ hasText: "Compra parcelada teste" });
  await expect(purchase).toBeVisible();
  await expect(page.getByLabel("Valor total (R$)")).toHaveValue("");
  await purchase.locator("summary").click();
  await expect(purchase).toContainText("Cartão de crédito");
  await expect(purchase).toContainText("10 parcelas");
  await expect(purchase).toContainText("Quem pagou: Empresa");
  const popupPromise = page.waitForEvent("popup");
  await purchase.getByRole("button", { name: "Abrir comprovante" }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toMatch(/^blob:/);
  await popup.close();
  await purchase
    .getByRole("button", { name: "Editar despesa", exact: true })
    .click();
  const editor = page.getByRole("dialog");
  await expect(
    editor.getByLabel("Valor total (R$)", { exact: true }),
  ).toHaveValue("1629,11");
  await editor.getByLabel("Valor total (R$)", { exact: true }).fill("1639,11");
  await editor
    .getByLabel("Primeiro vencimento", { exact: true })
    .fill("2028-01-28");
  await editor
    .getByRole("combobox", { name: "Forma de pagamento", exact: true })
    .selectOption("bank_slip");
  await editor
    .getByRole("combobox", { name: "Tipo", exact: true })
    .selectOption("receipt");
  await editor.getByLabel("Número (opcional)").fill("NF-EDITADA");
  await editor.getByLabel("Data de emissão").fill("2026-09-20");
  await editor
    .getByRole("combobox", { name: "Quem pagou", exact: true })
    .selectOption("company");
  await editor.getByLabel("Observações").fill("Observação editada");
  await editor
    .getByLabel("Foto ou PDF (substituir comprovante)")
    .setInputFiles({
      name: "recibo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await editor
    .getByRole("button", { name: "Salvar despesa", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(purchase).toContainText("28/02/2028");
  await expect(purchase).toContainText("recibo.png");
  await expect(
    purchase.getByRole("button", { name: "Abrir comprovante" }),
  ).toBeVisible();
  await page.reload();
  await go(page, "Financeiro");
  await page.getByRole("tab", { name: "Despesas", exact: true }).click();
  await page.getByLabel("Mês de referência").fill("2028-02");
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Compra parcelada teste" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Compra parcelada teste" }),
  ).toContainText("2/10");
  await page.getByLabel("Mês de referência").fill("2028-11");
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Compra parcelada teste" }),
  ).toHaveCount(0);
  const rows = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atraction-demo-v1")!).finance.filter(
      (row: { title: string }) =>
        row.title.startsWith("Compra parcelada teste"),
    ),
  );
  expect(rows).toHaveLength(10);
  expect(
    rows.every(
      (row: { payment_method: string; purchase_date: string; notes: string }) =>
        row.payment_method === "bank_slip" &&
        row.purchase_date === "2026-09-20" &&
        row.notes === "Observação editada",
    ),
  ).toBe(true);
  const documents = await page.evaluate(
    () => JSON.parse(localStorage.getItem("atraction-demo-v1")!).documents,
  );
  expect(
    documents.find(
      (doc: { document_number: string }) =>
        doc.document_number === "NF-EDITADA",
    ),
  ).toMatchObject({ document_kind: "receipt", issue_date: "2026-09-20" });
  expect(
    rows.every(
      (row: { purchase_payer: string }) => row.purchase_payer === "company",
    ),
  ).toBe(true);
  expect(
    rows.reduce(
      (sum: number, row: { amount_cents: number }) => sum + row.amount_cents,
      0,
    ),
  ).toBe(163911);
});

test("switching to Pix resets installment count", async ({ page }) => {
  await page.goto("/");
  await go(page, "NF e Recibos");
  await page.getByLabel("Quantidade de parcelas").fill("10");
  await page.getByLabel("Forma de pagamento").selectOption("pix");
  await expect(page.getByLabel("Quantidade de parcelas")).toHaveValue("1");
  await expect(page.getByLabel("Quantidade de parcelas")).toBeDisabled();
});

test("edits a single expense and preserves its recorded payment", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio em dia" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
    state.finance = [
      {
        id: "editable-expense",
        tenant_id: "demo",
        owner_id: null,
        created_at: "2026-09-01",
        updated_at: "2026-09-01",
        deleted_at: null,
        is_example: true,
        direction: "expense",
        title: "Despesa editável",
        category: "Materiais",
        amount_cents: 10000,
        due_date: "2026-09-15",
        settled_date: null,
        contact_id: null,
        supplier_id: null,
        notes: "",
        payments: [
          {
            id: "payment",
            date: "2026-09-15",
            amount_cents: 3000,
            account_id: null,
          },
        ],
      },
    ];
    localStorage.setItem("atraction-demo-v1", JSON.stringify(state));
  });
  await page.reload();
  await go(page, "NF e Recibos");
  const expense = page
    .locator("details")
    .filter({ hasText: "Despesa editável" });
  await expense.locator("summary").click();
  await expense
    .getByRole("button", { name: "Editar despesa", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição da despesa", { exact: true })
    .fill("Despesa corrigida");
  await dialog.getByLabel("Valor total (R$)", { exact: true }).fill("150,00");
  await dialog
    .getByRole("combobox", { name: "Quem pagou", exact: true })
    .selectOption("company");
  await dialog
    .getByRole("button", { name: "Salvar despesa", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator("details").filter({ hasText: "Despesa corrigida" }),
  ).toBeVisible();
  await page.reload();
  const rows = await page.evaluate(
    () => JSON.parse(localStorage.getItem("atraction-demo-v1")!).finance,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: "editable-expense",
    title: "Despesa corrigida",
    amount_cents: 15000,
  });
  expect(rows[0].payments).toEqual([
    { id: "payment", date: "2026-09-15", amount_cents: 3000, account_id: null },
  ]);
});

for (const kind of ["nfe", "receipt"]) {
  test(`creates ${kind} without attachment or description`, async ({
    page,
  }) => {
    await page.goto("/");
    await go(page, "NF e Recibos");
    await page
      .getByRole("combobox", { name: "Tipo", exact: true })
      .selectOption(kind);
    await page.getByLabel("Número (opcional)").fill("OPCIONAL-123");
    await page.getByLabel("Valor total (R$)").fill("1.629,11");
    await page.getByLabel("Categoria", { exact: true }).fill("Materiais");
    await page
      .getByLabel("Forma de pagamento")
      .selectOption(kind === "nfe" ? "credit_card" : "pix");
    if (kind === "nfe")
      await page.getByLabel("Quantidade de parcelas").fill("10");
    await expect(page.getByLabel("Foto ou PDF (opcional)")).not.toHaveAttribute(
      "required",
    );
    await expect(
      page.getByLabel("Descrição da despesa (opcional)"),
    ).not.toHaveAttribute("required");
    await page
      .getByRole("button", { name: "Cadastrar despesa", exact: true })
      .click();
    const title = `${kind === "nfe" ? "NF" : "Recibo"} OPCIONAL-123 · Materiais`;
    const purchase = page.locator("details").filter({ hasText: title });
    await expect(purchase).toBeVisible();
    await purchase.locator("summary").click();
    await expect(purchase).toContainText("Sem comprovante disponível.");
    await page.reload();
    const saved = await page.evaluate((title) => {
      const state = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
      const rows = state.finance.filter((row: { title: string }) =>
        row.title.startsWith(title),
      );
      return {
        rows,
        documents: state.documents.filter((doc: { finance_id: string }) =>
          rows.some((row: { id: string }) => row.id === doc.finance_id),
        ),
      };
    }, title);
    expect(saved.rows).toHaveLength(kind === "nfe" ? 10 : 1);
    expect(
      saved.rows.reduce(
        (sum: number, row: { amount_cents: number }) => sum + row.amount_cents,
        0,
      ),
    ).toBe(162911);
    expect(saved.documents).toHaveLength(0);
  });
}
