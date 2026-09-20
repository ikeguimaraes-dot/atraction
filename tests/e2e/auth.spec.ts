import { test, expect } from "@playwright/test";
test("usuário existente entra sem novo cadastro e configura seu espaço", async ({
  page,
}) => {
  const id = "00000000-0000-4000-8000-000000000991";
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "existing@example.invalid",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        aal: "aal2",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".fixture";
  let signups = 0;
  let credentials: Record<string, string> | undefined;
  await page.route("**/auth/v1/signup*", (r) => {
    signups++;
    return r.fulfill({ status: 400, json: { message: "Unexpected signup" } });
  });
  await page.route("**/auth/v1/token*", (r) => {
    credentials = r.request().postDataJSON();
    return r.fulfill({
      json: {
        access_token: token,
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      },
    });
  });
  await page.route("**/auth/v1/user", (r) => r.fulfill({ json: user }));
  await page.route("**/rest/v1/atraction_members*", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Usar com meus clientes", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("E-mail", { exact: true })
    .fill("Existing@example.invalid");
  await modal.getByLabel("Senha", { exact: true }).fill("old123");
  await expect(modal.getByLabel("Senha", { exact: true })).not.toHaveAttribute(
    "minlength",
    "8",
  );
  await modal.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    modal.getByText("Seu usuário já está conectado.", { exact: false }),
  ).toBeVisible();
  expect(credentials).toMatchObject({
    email: "existing@example.invalid",
    password: "old123",
  });
  expect(signups).toBe(0);
  await expect(modal.getByLabel("Nome do seu negócio")).toBeVisible();
});
