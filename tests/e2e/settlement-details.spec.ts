import { test, expect, type Page } from "@playwright/test";
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
test("acertos mostra baixas sem identificação e detalha pessoa e empresa", async ({
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
      category: "Materiais",
      due_date: date,
      contact_id: null,
      supplier_id: null,
      notes: "",
    };
    const payment = { date, account_id: null };
    s.finance = [
      {
        ...base,
        id: "unknown",
        title: "Compra sem identificação",
        amount_cents: 10000,
        settled_date: null,
        payments: [{ ...payment, id: "p1", amount_cents: 3000 }],
      },
      {
        ...base,
        id: "member",
        title: "Compra paga pela pessoa",
        amount_cents: 2000,
        settled_date: date,
        payments: [
          {
            ...payment,
            id: "p2",
            amount_cents: 2000,
            payer_user_id: "member-112233",
            allocations: [{ user_id: null, amount_cents: 2000 }],
          },
        ],
      },
      {
        ...base,
        id: "company",
        title: "Compra paga pela empresa",
        amount_cents: 4000,
        settled_date: date,
        payments: [
          {
            ...payment,
            id: "p3",
            amount_cents: 4000,
            payer_user_id: null,
            allocations: [{ user_id: null, amount_cents: 4000 }],
          },
        ],
      },
      {
        ...base,
        id: "income",
        title: "Receita não identificada",
        direction: "income",
        amount_cents: 9000,
        settled_date: date,
        payments: [{ ...payment, id: "p4", amount_cents: 9000 }],
      },
    ];
    s.settlements = [
      {
        ...base,
        id: "settlement",
        from_user_id: null,
        to_user_id: "member-112233",
        amount_cents: 500,
        date,
        notes: "Reembolso parcial",
      },
    ];
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1, 15);
    const future = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-15`;
    s.finance.push(
      {
        ...base,
        id: "future-income",
        title: "Receita futura",
        direction: "income",
        due_date: future,
        amount_cents: 30000,
        settled_date: null,
        payments: [],
      },
      {
        ...base,
        id: "future-expense",
        title: "Despesa futura",
        direction: "expense",
        due_date: future,
        amount_cents: 12000,
        settled_date: null,
        payments: [],
      },
    );
    s.recurrences = [];
    localStorage.setItem("atraction-demo-v1", JSON.stringify(s));
  });
  await page.reload();
  const overview = page.getByRole("region", {
    name: "Resumo financeiro da visão geral",
  });
  await expect(
    overview
      .getByRole("button", { name: "A receber no mês", exact: true })
      .locator("strong"),
  ).toContainText(/R\$\s*0/);
  await expect(
    overview
      .getByRole("button", { name: "Contas a pagar no mês", exact: true })
      .locator("strong"),
  ).toContainText(/R\$\s*70/);
  await expect(
    overview
      .getByRole("button", { name: "Contas em aberto", exact: true })
      .locator("strong"),
  ).toContainText(/R\$\s*190/);
  await expect(
    overview
      .getByRole("button", { name: "Despesas do mês", exact: true })
      .locator("strong"),
  ).toContainText(/R\$\s*160/);
  await expect(
    overview.getByRole("button", { name: "Prejuízo do mês", exact: true }),
  ).toHaveClass(/negative/);
  await expect(
    overview.getByRole("button", { name: "Receitas do mês", exact: true }),
  ).toHaveClass(/positive/);
  await expect(
    overview
      .getByRole("button", { name: "Prejuízo acumulado", exact: true })
      .locator("strong"),
  ).toContainText(/-R\$\s*70/);
  await overview
    .getByRole("button", { name: "Prejuízo acumulado", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toContainText("Despesa futura");
  await expect(page.getByRole("dialog")).toContainText(
    "Compra paga pela pessoa",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page.screenshot({
    path: test.info().outputPath("overview-redesign.png"),
    fullPage: true,
  });
  await overview
    .getByRole("button", { name: "Contas em aberto", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Despesa futura");
  await expect(page.getByRole("dialog")).toContainText(
    "Compra sem identificação",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await overview
    .getByRole("button", { name: "Contas a pagar no mês", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toContainText("Despesa futura");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await go(page, "Contas e DRE");
  const cash = page.getByRole("region", {
    name: "Caixa da empresa",
    exact: true,
  });
  await expect(
    cash.getByRole("article").filter({ hasText: "Total que entrou" }),
  ).toContainText(/R\$\s*90/);
  await expect(
    cash
      .getByRole("article")
      .filter({ hasText: "Total que saiu" })
      .locator("strong"),
  ).toContainText(/R\$\s*90/);
  await expect(cash).toContainText(/Pago por sócios e equipe: R\$\s*20/);
  await expect(
    cash.getByRole("article").filter({ hasText: "Saldo em caixa a conferir" }),
  ).toContainText(/R\$\s*45/);
  await expect(cash).toContainText("pagamentos sem pagador identificado");
  await expect(
    page.getByRole("status").filter({ hasText: "sem identificação completa" }),
  ).toContainText("1 despesa com 1 baixa");
  await expect(
    page.getByRole("status").filter({ hasText: "sem identificação completa" }),
  ).toContainText(/R\$\s*30/);
  await page
    .getByRole("button", {
      name: "Ver acertos de Membro indisponível (112233)",
      exact: true,
    })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Compra paga pela pessoa");
  await expect(dialog).toContainText(/Saldo atual: R\$\s*15/);
  await expect(dialog).toContainText("Reembolso parcial");
  await expect(dialog).not.toContainText("Compra paga pela empresa");
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver acertos de Empresa", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Compra paga pela empresa");
  await expect(dialog).toContainText("Compra paga pela pessoa");
  await expect(dialog).not.toContainText("Compra sem identificação");
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Ver pagamentos sem identificação",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Compra sem identificação");
  await expect(dialog).not.toContainText("Receita não identificada");
  await dialog
    .getByRole("button", { name: "Identificar / corrigir baixa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Corrigir quem pagou", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar correção", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Todos os pagamentos já foram identificados.",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Todas as despesas pagas estão identificadas." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
