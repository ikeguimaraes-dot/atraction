import { test, expect, type Page } from "@playwright/test";

async function go(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}

test("contrato aceita PDF, preserva após recarregar e permite baixar", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio em dia" }),
  ).toBeVisible();
  await go(page, "Contratos");
  await page
    .getByRole("button", { name: "Novo contrato", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption({ label: "Mariana Costa" });
  await page.getByLabel("Descrição do contrato").fill("Contrato com PDF");
  await page.getByLabel("Valor total (R$)").fill("100");
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await page
    .getByRole("button", { name: "Confirmar contrato e cobranças" })
    .click();
  const input = page.getByLabel("Anexar PDF ao contrato Contrato com PDF");
  await input.setInputFiles({
    name: "invalido.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("não é PDF"),
  });
  await expect(page.locator(".error[role=alert]")).toContainText("PDF válido");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  await input.setInputFiles({
    name: "contrato.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await expect(
    page.getByRole("button", { name: "Baixar PDF: contrato.pdf" }),
  ).toBeVisible();
  await page.reload();
  await go(page, "Contratos");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF: contrato.pdf" }).click();
  expect((await download).suggestedFilename()).toBe("contrato.pdf");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atraction-demo-v1")!),
  );
  expect(stored.documents[0]).toMatchObject({
    document_kind: "contract",
    contract_id: stored.contracts[0].id,
  });
});

test("dono cria usuário na empresa com senha, preservando sua sessão", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const uid = "00000000-0000-4000-8000-00000000fe01";
  const tenant = "00000000-0000-4000-8000-00000000fe02";
  const member = "00000000-0000-4000-8000-00000000fe03";
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: now,
  };
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: uid,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".fixture";
  const session = {
    access_token: token,
    refresh_token: "fixture",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  await page.addInitScript(
    (session) =>
      localStorage.setItem("atraction-auth", JSON.stringify(session)),
    session,
  );
  await page.route("**/auth/v1/user", (r) => r.fulfill({ json: user }));
  await page.route("**/rest/v1/atraction_*", (r) => {
    const table = new URL(r.request().url()).pathname.split("/").at(-1);
    return r.fulfill({
      json:
        table === "atraction_members"
          ? [{ tenant_id: tenant, user_id: uid, role: "owner" }]
          : table === "atraction_tenants"
            ? [
                {
                  id: tenant,
                  owner_id: uid,
                  name: "Empresa de teste",
                  niche: "estetica",
                  created_at: now,
                },
              ]
            : [],
    });
  });
  let members = [{ user_id: uid, email: user.email, role: "owner" }];
  await page.route("**/rest/v1/rpc/atraction_team", (r) =>
    r.fulfill({ json: members }),
  );
  const requests: Record<string, unknown>[] = [];
  await page.route("**/functions/v1/atraction-create-member", (r) => {
    requests.push(r.request().postDataJSON());
    members = [
      ...members,
      { user_id: member, email: "new@example.invalid", role: "manager" },
    ];
    return r.fulfill({ status: 201, json: { user_id: member } });
  });
  await page.goto("/");
  await go(page, "Configurações");
  await page
    .getByRole("button", { name: "Adicionar pessoa", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("E-mail da pessoa", { exact: true })
    .fill("New@example.invalid");
  await modal.getByLabel("Senha", { exact: true }).fill("ExampleTest!123");
  await modal.getByLabel("Cargo e acesso").selectOption("manager");
  await modal
    .getByRole("button", { name: "Adicionar pessoa", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(requests).toEqual([
    {
      tenant,
      email: "new@example.invalid",
      password: "ExampleTest!123",
      role: "manager",
    },
  ]);
  await expect(
    page.locator(".team-row").filter({ hasText: "new@example.invalid" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("atraction-auth")!).user.id,
    ),
  ).toBe(uid);
  await page.reload();
  await go(page, "Configurações");
  await expect(
    page.locator(".team-row").filter({ hasText: "new@example.invalid" }),
  ).toBeVisible();
  const contract = {
    id: "00000000-0000-4000-8000-00000000fe04",
    tenant_id: tenant,
    owner_id: uid,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    is_example: false,
    contact_id: null,
    supplier_id: "00000000-0000-4000-8000-00000000fe05",
    deal_id: null,
    renews_id: null,
    title: "Contrato persistido",
    plan: "",
    mode: "once",
    amount_cents: 10000,
    periods: 1,
    start_date: "2026-11-23",
    first_due_date: "2026-11-23",
    end_date: "2026-12-22",
    status: "active",
    notes: "",
  };
  const documents: Record<string, unknown>[] = [];
  let uploaded = false;
  const pdf = Buffer.from("%PDF-1.4\n%%EOF");
  await page.route("**/rest/v1/atraction_contracts*", (r) =>
    r.fulfill({ json: [contract] }),
  );
  await page.route("**/rest/v1/atraction_documents*", (r) => {
    if (r.request().method() === "POST") {
      expect(uploaded).toBe(true);
      const row = r.request().postDataJSON();
      documents.push(row);
      return r.fulfill({ json: { id: row.id } });
    }
    return r.fulfill({ json: documents });
  });
  await page.route("**/storage/v1/object/atraction-contracts/**", (r) => {
    expect(r.request().url()).toContain(tenant + "/");
    if (r.request().method() === "POST") {
      uploaded = true;
      return r.fulfill({ json: { Key: "stored.pdf" } });
    }
    return r.fulfill({ contentType: "application/pdf", body: pdf });
  });
  await page.reload();
  await go(page, "Contratos");
  await page
    .getByLabel("Anexar PDF ao contrato Contrato persistido")
    .setInputFiles({
      name: "persistido.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
  await expect(
    page.getByRole("button", { name: "Baixar PDF: persistido.pdf" }),
  ).toBeVisible();
  expect(documents[0]).toMatchObject({
    tenant_id: tenant,
    contract_id: contract.id,
    document_kind: "contract",
    mime_type: "application/pdf",
  });
  expect(documents[0]).not.toHaveProperty("demo_data");
  await page.reload();
  await go(page, "Contratos");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Baixar PDF: persistido.pdf" })
    .click();
  expect((await downloaded).suggestedFilename()).toBe("persistido.pdf");
});
