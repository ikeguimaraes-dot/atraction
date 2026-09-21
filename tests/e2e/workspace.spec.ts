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
    page.getByRole("heading", { name: "Um bom dia para crescer." }),
  ).toBeVisible();
});
test("cadastro, persistência, edição, exclusão e restauração", async ({
  page,
}) => {
  await go(page, "Pessoas");
  await page.getByRole("button", { name: "Nova pessoa", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente de teste");
  await page.getByLabel("Telefone com DDD").fill("11987654321");
  await page.getByRole("button", { name: "Salvar pessoa" }).click();
  await expect(
    page.getByRole("button", {
      name: "Cliente de teste Vamos conhecer melhor",
    }),
  ).toBeVisible();
  await page.reload();
  await go(page, "Pessoas");
  await page
    .getByRole("button", { name: "Cliente de teste Vamos conhecer melhor" })
    .click();
  await page.getByRole("button", { name: "Mover para lixeira" }).click();
  await expect(
    page.getByRole("button", {
      name: "Cliente de teste Vamos conhecer melhor",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Cliente de teste Vamos conhecer melhor",
    }),
  ).toBeVisible();
});
test("move negócio e desfaz mudança", async ({ page }) => {
  await go(page, "Caminho do cliente");
  const stage = page.getByLabel("Etapa de Mariana Costa");
  await stage.selectOption("4");
  await expect(
    page.locator(".stage-4").getByLabel("Etapa de Mariana Costa"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(
    page.locator(".stage-0").getByLabel("Etapa de Mariana Costa"),
  ).toBeVisible();
});
test("conclui tarefa e salva nota interna", async ({ page }) => {
  await page
    .getByRole("button", {
      name: "Concluir Retornar sobre a avaliação",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Concluir Retornar sobre a avaliação",
      exact: true,
    }),
  ).toHaveCount(0);
  await go(page, "Conversas 3");
  await page.getByRole("button", { name: "Nota interna", exact: true }).click();
  await page
    .getByLabel("Escrever nota interna")
    .fill("Prefere atendimento à tarde.");
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(page.locator(".message.note")).toContainText(
    "Prefere atendimento à tarde.",
  );
});
test("robô exige prévia antes de ativar", async ({ page }) => {
  await go(page, "Robôs NOVO");
  await page
    .getByRole("switch", { name: "Ativar Boas-vindas com carinho" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Veja o que seu robô vai fazer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ativar robô", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Ativar Boas-vindas com carinho" }),
  ).toBeChecked();
});
test("telas não transbordam a largura", async ({ page }) => {
  for (const label of [
    "Pessoas",
    "Clientes",
    "Financeiro",
    "Fornecedores",
    "Caminho do cliente",
    "Conversas 3",
    "Agenda",
    "Robôs NOVO",
    "Atrair clientes",
    "Resultados",
    "Hoje",
  ]) {
    await go(page, label);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow, label).toBe(false);
  }
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("importação mostra problemas e importa somente pessoas válidas", async ({
  page,
}) => {
  await go(page, "Pessoas");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "contatos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "nome,telefone\nPessoa importada,11911112222\nRepetida,11911112222\nInválida,12",
    ),
  });
  await expect(
    page.getByText("1 pessoas prontas para importar · 2 avisos"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importar 1 pessoas" }).click();
  await expect(
    page.getByRole("button", {
      name: /Pessoa importada Vamos conhecer melhor/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /Pessoa importada Vamos conhecer melhor/,
    }),
  ).toHaveCount(0);
});
test("rascunho não marca uma conversa como respondida", async ({ page }) => {
  await go(page, "Conversas 3");
  await page.getByRole("button", { name: "Usar modelo", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await expect(
    page
      .locator("nav")
      .getByRole("button", { name: "Conversas 3", exact: true }),
  ).toBeAttached();
  await expect(page.locator(".message.out")).toContainText("Rascunho");
});
test("cadastro recusa telefone duplicado sem criar outra pessoa", async ({
  page,
}) => {
  await go(page, "Pessoas");
  await page.getByRole("button", { name: "Nova pessoa", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Repetida");
  await page.getByLabel("Telefone com DDD").fill("11999900000");
  await page
    .getByRole("button", { name: "Salvar pessoa", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Esse telefone já está cadastrado",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("cliente manual, fornecedor e financeiro com baixa e persistência", async ({
  page,
}) => {
  await go(page, "Clientes");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente da casa");
  await page.getByLabel("Telefone com DDD").fill("21988887777");
  await page.getByRole("button", { name: "Salvar pessoa" }).click();
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
