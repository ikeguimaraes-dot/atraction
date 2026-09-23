import { test, expect, Page } from "@playwright/test";
async function menu(p: Page) {
  const button = p.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await button.isVisible()) await button.click();
}
async function go(p: Page, label: string) {
  await menu(p);
  await p
    .locator("nav")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("empresas: cadastrar, alternar, consolidar e preservar seleção", async ({
  page,
}) => {
  const uid = "00000000-0000-4000-8000-000000000801";
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const a = "00000000-0000-4000-8000-000000000802",
    b = "00000000-0000-4000-8000-000000000803";
  const companies = [
    {
      id: a,
      name: "Empresa Alfa",
      owner_id: uid,
      niche: "estetica",
      created_at: now,
      capture_enabled: false,
      capture_title: "Olá",
      capture_slug: "alfa",
      animations: false,
    },
    {
      id: b,
      name: "Empresa Beta",
      owner_id: uid,
      niche: "pet",
      created_at: now,
      capture_enabled: false,
      capture_title: "Olá",
      capture_slug: "beta",
      animations: false,
    },
  ];
  const base = (id: string, tenant_id: string) => ({
    id,
    tenant_id,
    owner_id: uid,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    is_example: false,
  });
  const contacts = [
    {
      ...base("00000000-0000-4000-8000-000000000804", a),
      name: "Cliente Alfa",
      phone: "+5511999991111",
      email: "",
      source: "Cadastro",
      tags: [],
      notes: "",
      consent: false,
      consent_proof: "",
      lifecycle: "customer",
    },
    {
      ...base("00000000-0000-4000-8000-000000000805", b),
      name: "Cliente Beta",
      phone: "+5511999992222",
      email: "",
      source: "Cadastro",
      tags: [],
      notes: "",
      consent: false,
      consent_proof: "",
      lifecycle: "customer",
    },
  ];
  const finance = [
    {
      ...base("00000000-0000-4000-8000-000000000806", a),
      title: "Receita Alfa",
      direction: "income",
      amount_cents: 10000,
      due_date: date,
      settled_date: date,
      contact_id: contacts[0].id,
      supplier_id: null,
      category: "Serviços",
      notes: "",
      payments: [{ id: "p1", amount_cents: 10000, date, account_id: null }],
    },
    {
      ...base("00000000-0000-4000-8000-000000000807", b),
      title: "Receita Beta",
      direction: "income",
      amount_cents: 20000,
      due_date: date,
      settled_date: date,
      contact_id: contacts[1].id,
      supplier_id: null,
      category: "Serviços",
      notes: "",
      payments: [{ id: "p2", amount_cents: 20000, date, account_id: null }],
    },
  ];
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "companies@example.invalid",
    app_metadata: { provider: "email", providers: ["email"] },
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
        aal: "aal1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".fixture";
  await page.route("**/auth/v1/token*", (r) =>
    r.fulfill({
      json: {
        access_token: token,
        refresh_token: "fixture",
        token_type: "bearer",
        expires_in: 3600,
        user,
      },
    }),
  );
  await page.route("**/auth/v1/user", (r) => r.fulfill({ json: user }));
  const writes: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/atraction_*", (r) => {
    const url = new URL(r.request().url());
    const table = url.pathname.split("/").at(-1);
    if (r.request().method() === "PATCH" && table === "atraction_tenants") {
      const body = r.request().postDataJSON();
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const company = companies.find((c) => c.id === id)!;
      Object.assign(company, body);
      writes.push({ ...body, table });
      return r.fulfill({ json: [{ id: company.id }] });
    }
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      writes.push({ ...body, table });
      if (table === "atraction_tenants") {
        const company = {
          ...companies[0],
          ...body,
          id: body.id,
        };
        expect(r.request().headers()["prefer"] || "").not.toContain(
          "return=representation",
        );
        companies.push(company);
        return r.fulfill({ json: { id: company.id } });
      }
      return r.fulfill({ json: [{ id: body.id }] });
    }
    if (table === "atraction_members")
      return r.fulfill({
        json: companies.map((c) => ({
          tenant_id: c.id,
          user_id: uid,
          role: "owner",
        })),
      });
    if (table === "atraction_tenants") return r.fulfill({ json: companies });
    const filter = url.searchParams.get("tenant_id") || "";
    const data =
      table === "atraction_contacts"
        ? contacts
        : table === "atraction_finance"
          ? finance
          : [];
    return r.fulfill({
      json: data.filter((x) => filter.includes(x.tenant_id)),
    });
  });
  await page.goto("/");
  await expect(page.locator(".sidebar")).not.toContainText("Meu negócio");
  await expect(page.locator(".sidebar")).not.toContainText(
    "Clínica de estética",
  );
  await page
    .getByRole("button", { name: "Usar com meus clientes", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("E-mail", { exact: true })
    .fill(user.email);
  await page
    .getByRole("dialog")
    .getByLabel("Senha", { exact: true })
    .fill("fixture123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await go(page, "Clientes");
  await expect(page.locator("main")).toContainText("Cliente Alfa");
  await expect(page.locator("main")).not.toContainText("Cliente Beta");
  await menu(page);
  await expect(page.getByLabel("Selecionar empresa")).toHaveValue(a);
  await page.getByLabel("Selecionar empresa").selectOption(b);
  await expect(page.locator("main")).toContainText("Cliente Beta");
  await expect(page.locator("main")).not.toContainText("Cliente Alfa");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cadastro na Beta");
  await page.getByLabel("Telefone com DDD").fill("11922223333");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes.find((x) => x.table === "atraction_contacts")).toMatchObject({
    tenant_id: b,
    name: "Cadastro na Beta",
  });
  await page.reload();
  await menu(page);
  await expect(page.getByLabel("Selecionar empresa")).toHaveValue(b);
  await page.getByLabel("Selecionar empresa").selectOption("all");
  await expect(
    page.getByRole("heading", { name: "Todas as empresas", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".consolidated-rows")).toContainText(
    "Cliente Alfa",
  );
  await expect(page.locator(".consolidated-rows")).toContainText(
    "Cliente Beta",
  );
  await expect(
    page.locator(".company-metrics").filter({ hasText: "Recebido" }),
  ).toContainText(/R\$\s*300/);
  await page.screenshot({
    path: test.info().outputPath("todas-empresas.png"),
    fullPage: true,
  });
  await go(page, "Financeiro");
  await expect(page.locator(".consolidated-rows")).toContainText(
    "Receita Alfa",
  );
  await expect(page.locator(".consolidated-rows")).toContainText(
    "Receita Beta",
  );
  await expect(
    page.getByRole("button", { name: "Nova receita", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await menu(page);
  await page
    .getByRole("button", { name: "+ Cadastrar empresa", exact: true })
    .click();
  await page.getByLabel("Nome do seu negócio").fill("Empresa Gama");
  await page
    .getByRole("dialog")
    .getByRole("combobox")
    .first()
    .selectOption("software");
  await page
    .getByRole("button", { name: "Abrir meu espaço", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await menu(page);
  await expect(page.getByLabel("Selecionar empresa")).toHaveValue(
    companies[2].id,
  );
  expect(writes.filter((w) => w.table === "atraction_tenants")).toHaveLength(1);
  expect(writes.find((w) => w.table === "atraction_tenants")).toMatchObject({
    name: "Empresa Gama",
    owner_id: uid,
    niche: "software",
  });
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Seu nicho", exact: true })
    .selectOption("fintech");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect.poll(() => companies[2].niche).toBe("fintech");
});
