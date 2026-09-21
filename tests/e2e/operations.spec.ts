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
test("Excel, segmentos, funil, campos e PDF", async ({ page }) => {
  await page.goto("/");
  await go(page, "Pessoas");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/contacts.xlsx");
  await expect(
    page.getByText("1 pessoas prontas para importar · 0 avisos"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importar 1 pessoas" }).click();
  await go(page, "Ferramentas");
  await page.getByRole("button", { name: "Salvar novo segmento" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Meu público");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await expect(
    page.locator(".segment-person").filter({ hasText: "Pessoa Excel" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Funis e campos" }).click();
  await page
    .getByRole("button", { name: "Novo funil personalizado", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Consultoria");
  const stages = page.getByRole("dialog").locator("input[name^=stage]");
  for (let i = 0; i < 5; i++)
    await stages
      .nth(i)
      .fill(["Novo", "Contato", "Proposta", "Acordo", "Ganho"][i]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo campo", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Preferência");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await go(page, "Clientes");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await expect(page.getByLabel("Preferência", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await go(page, "Caminho do cliente");
  await page
    .getByRole("combobox", { name: "Funil", exact: true })
    .selectOption({ label: "Consultoria" });
  await expect(page.locator(".deal-card")).toHaveCount(0);
  await go(page, "Ferramentas");
  await page.getByRole("button", { name: "Modelos e PDFs" }).click();
  await page
    .getByLabel("Pessoa do documento")
    .selectOption({ label: "Pessoa Excel" });
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Gerar PDF", exact: true }).click();
  const pdfDownload = await pdf;
  expect(pdfDownload.suggestedFilename()).toContain(".pdf");
  await pdfDownload.saveAs(test.info().outputPath("proposta.pdf"));
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
test("chat público envia e recebe resposta", async ({ page }) => {
  const messages: {
    id: string;
    body: string;
    direction: string;
    created_at: string;
  }[] = [];
  await page.route("**/rest/v1/rpc/atraction_capture_info", (r) =>
    r.fulfill({
      json: {
        name: "Empresa teste",
        title: "Vamos conversar",
        niche: "estetica",
      },
    }),
  );
  await page.route("**/rest/v1/rpc/atraction_chat_start", (r) =>
    r.fulfill({
      json: { id: "00000000-0000-4000-8000-000000000001", token: "fixture" },
    }),
  );
  await page.route("**/rest/v1/rpc/atraction_chat_poll", (r) =>
    r.fulfill({ json: { closed: false, messages } }),
  );
  await page.route("**/rest/v1/rpc/atraction_chat_send", (r) => {
    messages.push(
      {
        id: "1",
        body: r.request().postDataJSON().body,
        direction: "in",
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        body: "Podemos ajudar!",
        direction: "out",
        created_at: new Date().toISOString(),
      },
    );
    return r.fulfill({ json: null });
  });
  await page.goto("/c/fixture");
  await page.getByLabel("Seu nome no chat").fill("Visitante teste");
  await page.getByLabel("Telefone para contato").fill("11988887777");
  await page.locator(".live-chat input[type=checkbox]").check();
  await page
    .getByRole("button", { name: "Iniciar conversa", exact: true })
    .click();
  await page.getByLabel("Sua mensagem").fill("Olá, quero informações");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(page.locator(".chat-feed")).toContainText("Podemos ajudar!");
  await page.reload();
  await expect(page.locator(".chat-feed")).toContainText(
    "Olá, quero informações",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
test("mesclagem reúne o histórico e arquiva o duplicado", async ({ page }) => {
  await page.goto("/");
  await go(page, "Ferramentas");
  await page.getByRole("button", { name: "Mesclar pessoas" }).click();
  const source = page.getByRole("combobox", {
    name: "Cadastro que será arquivado",
  });
  await source.selectOption({ index: 1 });
  const target = page.getByRole("combobox", {
    name: "Cadastro principal que será mantido",
  });
  await target.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Ver prévia da mesclagem" }).click();
  await page.getByRole("button", { name: "Confirmar mesclagem" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Segmentos", exact: true }).click();
  await page.getByRole("button", { name: "Salvar novo segmento" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Após mesclagem");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await expect(page.locator(".segment-person")).toHaveCount(7);
});
test("equipe responde e encerra chat na caixa de conversas", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Um bom dia para crescer." }),
  ).toBeVisible();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
    const c = s.contacts[0];
    s.chat_sessions = [
      {
        ...c,
        id: "test-session",
        contact_id: c.id,
        visitor_name: "Visitante de teste",
        closed: false,
      },
    ];
    s.chat_messages = [
      {
        ...c,
        id: "test-message",
        session_id: "test-session",
        body: "Quero conhecer o serviço",
        direction: "in",
        client_id: "visitor",
      },
    ];
    localStorage.setItem("atraction-demo-v1", JSON.stringify(s));
  });
  await page.reload();
  await go(page, "Conversas 3");
  await expect(page.locator(".site-inbox")).toContainText(
    "Quero conhecer o serviço",
  );
  await page
    .getByLabel("Resposta pelo chat")
    .fill("Olá! Podemos conversar sobre o plano.");
  await page.getByRole("button", { name: "Enviar resposta no chat" }).click();
  await expect(page.locator(".site-inbox .chat-feed")).toContainText(
    "Podemos conversar sobre o plano.",
  );
  await page
    .getByRole("button", { name: "Encerrar chat", exact: true })
    .click();
  await expect(page.getByLabel("Resposta pelo chat")).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
