import { test, expect, type Page } from "@playwright/test";
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
test("lucro mensal divide igualmente, persiste por mês e mantém reembolsos separados", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/atraction_team", (route) =>
    route.fulfill({
      json: [
        { user_id: "a", email: "amanda@example.test", role: "manager" },
        { user_id: "b", email: "karine@example.test", role: "manager" },
        { user_id: "c", email: "dono@example.test", role: "owner" },
      ],
    }),
  );
  const uid = "00000000-0000-4000-8000-000000009001";
  const now = new Date().toISOString();
  let role = "owner";
  const tenant = {
    id: "profit-test",
    name: "Empresa Lucro",
    owner_id: uid,
    niche: "estetica",
    created_at: now,
    capture_enabled: false,
    capture_title: "",
    capture_slug: "profit",
    animations: false,
    settings: {
      fields: [{ id: "preserve", label: "Preservado", type: "text" }],
      profit_sharing: {} as Record<string, { participants: string[] }>,
    },
  };
  const base = {
    id: "income",
    tenant_id: tenant.id,
    owner_id: uid,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    is_example: false,
    direction: "income",
    amount_cents: 10001,
    category: "Serviços",
    due_date: "2026-10-15",
    settled_date: null,
    payments: [],
    contact_id: null,
    supplier_id: null,
    notes: "",
  };
  const finance = [
    base,
    {
      ...base,
      id: "expense",
      direction: "expense",
      amount_cents: 3000,
      category: "Materiais",
    },
    {
      ...base,
      id: "november",
      direction: "expense",
      amount_cents: 10000,
      due_date: "2026-11-15",
    },
  ];
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "dono@example.test",
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
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".fixture";
  await page.route("**/auth/v1/user", (r) => r.fulfill({ json: user }));
  await page.route("**/rest/v1/atraction_*", (r) => {
    const table = new URL(r.request().url()).pathname.split("/").at(-1);
    if (table === "atraction_tenants" && r.request().method() === "PATCH") {
      expect(role).toBe("owner");
      Object.assign(tenant, r.request().postDataJSON());
      return r.fulfill({ json: [{ id: tenant.id }] });
    }
    return r.fulfill({
      json:
        table === "atraction_members"
          ? [{ tenant_id: tenant.id, user_id: uid, role }]
          : table === "atraction_tenants"
            ? [tenant]
            : table === "atraction_finance"
              ? finance
              : [],
    });
  });
  await page.addInitScript(
    ({ token, user }) =>
      localStorage.setItem(
        "atraction-auth",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        }),
      ),
    { token, user },
  );
  await page.goto("/");
  await expect(
    page.locator('select[aria-label="Selecionar empresa"]'),
  ).toBeAttached();
  await go(page, "Contas e DRE");
  await page.getByLabel("Mês do lucro").fill("2026-10");
  const region = page.getByRole("region", { name: "Divisão dos lucros" });
  await expect(region.getByLabel("Lucro mensal para divisão")).toContainText(
    /R\$\s*70,01/,
  );
  await page
    .getByRole("button", { name: "Escolher participantes do lucro" })
    .click();
  await page.getByRole("checkbox", { name: /amanda@example.test/ }).check();
  await page.getByRole("checkbox", { name: /karine@example.test/ }).check();
  await page.getByRole("button", { name: "Salvar divisão dos lucros" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    region.getByRole("article", { name: "Lucro de amanda@example.test" }),
  ).toContainText(/R\$\s*35,01/);
  await expect(
    region.getByRole("article", { name: "Lucro de karine@example.test" }),
  ).toContainText(/R\$\s*35/);
  await expect(
    region.getByRole("article", { name: "Lucro de dono@example.test" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Ver acertos de amanda@example.test",
      exact: true,
    }),
  ).toContainText("Está acertado");
  const saved = tenant.settings;
  expect(saved.profit_sharing["2026-10"].participants).toEqual(["a", "b"]);
  expect(saved.fields[0].id).toBe("preserve");
  await page.reload();
  await expect(
    page.locator('select[aria-label="Selecionar empresa"]'),
  ).toBeAttached();
  await go(page, "Contas e DRE");
  await page.getByLabel("Mês do lucro").fill("2026-10");
  await expect(
    region.getByRole("article", { name: "Lucro de amanda@example.test" }),
  ).toContainText(/R\$\s*35,01/);
  await expect(
    region.getByLabel("Resultado acumulado da empresa"),
  ).toContainText(/R\$\s*70,01/);
  await page.getByLabel("Mês do lucro").fill("2026-11");
  await expect(
    region.getByLabel("Resultado acumulado da empresa"),
  ).toContainText(/-R\$\s*29,99/);
  await expect(region).toContainText(/Faltam R\$\s*29,99/);
  await expect(region).toContainText(
    "Nenhum participante escolhido para este mês.",
  );
  await expect(region).toContainText(
    "Não há lucro positivo para distribuir neste mês.",
  );
  await page
    .getByRole("button", { name: "Escolher participantes do lucro" })
    .click();
  await page.getByRole("checkbox", { name: /amanda@example.test/ }).check();
  await page.getByRole("button", { name: "Salvar divisão dos lucros" }).click();
  await expect(
    region.getByRole("article", { name: "Lucro de amanda@example.test" }),
  ).toContainText(/R\$\s*0/);
  await page.getByLabel("Mês do lucro").fill("2026-10");
  await expect(region.getByRole("article")).toHaveCount(2);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  // Managers see saved allocations but cannot configure them.
  role = "manager";
  await page.reload();
  await expect(
    page.locator('select[aria-label="Selecionar empresa"]'),
  ).toBeAttached();
  await go(page, "Contas e DRE");
  await page.getByLabel("Mês do lucro").fill("2026-10");
  await expect(
    page.getByRole("button", { name: "Escolher participantes do lucro" }),
  ).toHaveCount(0);
  await expect(region.getByRole("article")).toHaveCount(2);
});
