import { test, expect, Page } from "@playwright/test";
async function go(p: Page, label: string) {
  const menu = p.getByRole("button", { name: "Abrir navegação", exact: true });
  if (await menu.isVisible()) await menu.click();
  await p
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
test("contrato mensal gera cliente, cobranças e pós-venda; reajusta e renova", async ({
  page,
}) => {
  await go(page, "Contratos");
  await page
    .getByRole("button", { name: "Novo contrato", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption({ label: "Mariana Costa" });
  await page.getByLabel("Descrição do contrato").fill("Plano de cuidado");
  await page.getByLabel("Plano / serviço").fill("Essencial");
  await page
    .getByRole("combobox", { name: "Cobrança", exact: true })
    .selectOption("monthly");
  await page.getByLabel("Mensalidade (R$)").fill("100,01");
  await page.getByLabel("Vigência em meses").fill("3");
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.locator(".contract-preview>div")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Confirmar contrato e cobranças" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await go(page, "Financeiro");
  await expect(page.locator(".ledger-row")).toHaveCount(3);
  await page
    .locator(".ledger-row")
    .first()
    .getByRole("button", { name: "Receber", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await go(page, "Contratos");
  await page.getByRole("button", { name: "Reajustar", exact: true }).click();
  await page.getByLabel("Nova mensalidade (R$)").fill("120,01");
  await page.getByRole("button", { name: "Confirmar reajuste" }).click();
  await go(page, "Financeiro");
  await expect(
    page.locator(".ledger-row").filter({ hasText: "Recebido" }),
  ).toContainText("100,01");
  await expect(
    page.locator(".ledger-row").filter({ hasText: "120,01" }),
  ).toHaveCount(2);
  await go(page, "Clientes");
  await page
    .getByRole("button", { name: /Mariana Costa Cliente ativo/ })
    .click();
  await expect(page.locator(".journey-timeline")).toContainText(
    "Contrato: Plano de cuidado",
  );
  await expect(page.locator(".journey-timeline")).toContainText(
    "Dar boas-vindas",
  );
  const welcome = page
    .locator(".journey-timeline > div")
    .filter({ hasText: "Dar boas-vindas e combinar próximos passos" });
  await welcome.getByRole("button", { name: "Concluir tarefa" }).click();
  await expect(welcome).toContainText("Concluída");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await go(page, "Contratos");
  await page.getByRole("button", { name: "Renovar", exact: true }).click();
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await page
    .getByRole("button", { name: "Confirmar contrato e cobranças" })
    .click();
  await expect(page.locator(".supplier-card")).toHaveCount(2);
  await page.reload();
  await go(page, "Financeiro");
  await expect(page.locator(".ledger-row")).toHaveCount(6);
  await page.screenshot({
    path: `test-results/journey-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("venda ganha oferece jornada sem duplicar contrato", async ({ page }) => {
  await go(page, "Caminho do cliente");
  await page.getByLabel("Etapa de Mariana Costa").selectOption("4");
  await page.getByRole("button", { name: "Continuar jornada" }).click();
  await expect(page.getByRole("dialog")).toContainText("Continuar a jornada");
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await page
    .getByRole("button", { name: "Confirmar contrato e cobranças" })
    .click();
  await go(page, "Caminho do cliente");
  await expect(
    page.locator(".stage-4").getByLabel("Etapa de Mariana Costa"),
  ).toBeVisible();
  await go(page, "Financeiro");
  await expect(page.locator(".ledger-row")).toHaveCount(1);
});
test("ficha registra atendimento, indicação e documento privado na demonstração", async ({
  page,
}) => {
  await go(page, "Clientes");
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente satisfeito");
  await page.getByLabel("Telefone com DDD").fill("11912345678");
  await page.getByRole("button", { name: "Salvar pessoa" }).click();
  await page
    .getByRole("button", { name: /Cliente satisfeito Cliente ativo/ })
    .click();
  await page
    .getByRole("button", { name: "Acompanhamento", exact: true })
    .click();
  await page
    .getByLabel("Como foi o atendimento?")
    .fill("Adorou o resultado e deseja continuar.");
  await page.getByRole("button", { name: "Registrar atendimento" }).click();
  await page
    .getByRole("combobox", { name: "Satisfação informada pelo cliente" })
    .selectOption("10");
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await page.getByLabel("Anexar documento", { exact: true }).setInputFiles({
    name: "contrato.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nDemo documento\n%%EOF"),
  });
  await expect(page.locator(".document-row")).toContainText("contrato.pdf");
  await page.getByRole("button", { name: "Histórico completo" }).click();
  await expect(page.locator(".journey-timeline")).toContainText(
    "Adorou o resultado",
  );
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await go(page, "Pós-venda");
  await page
    .getByRole("button", { name: "Agendar indicação", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Agendar indicação", exact: true }),
  ).toHaveCount(0);
  await go(page, "Agenda");
  await expect(
    page.getByText("Pedir indicação após um bom atendimento").first(),
  ).toBeVisible();
});
test("links de campanha e novas telas cabem no celular", async ({ page }) => {
  await go(page, "Atrair clientes");
  await page.getByLabel("Campanha", { exact: true }).fill("primavera");
  await expect(page.getByLabel("Link da campanha")).toHaveValue(
    /utm_campaign=primavera/,
  );
  for (const screen of ["Contratos", "Pós-venda", "Resultados", "Hoje"]) {
    await go(page, screen);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      screen,
    ).toBe(false);
  }
});
