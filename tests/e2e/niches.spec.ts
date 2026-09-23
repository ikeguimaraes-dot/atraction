import { test, expect } from "@playwright/test";
test("amplia segmentos e permite editar sem apagar negócios", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio em dia" }),
  ).toBeVisible();
  const before = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
    return {
      ids: s.deals.map((d: { id: string }) => d.id),
      contacts: s.contacts.length,
    };
  });
  const menu = page.getByRole("button", {
    name: "Abrir navegação",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const select = page.getByRole("combobox", { name: "Seu nicho", exact: true });
  for (const label of [
    "Fintech e serviços financeiros",
    "Empresa de software / SaaS",
    "Restaurante, bar e cafeteria",
    "Sistemas de IA e automação",
  ]) {
    await select.selectOption({ label });
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(select.locator("option:checked")).toHaveText(label);
  }
  await select.selectOption("outro");
  await page
    .getByLabel("Nome do segmento (opcional)")
    .fill("Logística integrada");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  const after = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atraction-demo-v1")!);
    return {
      ids: s.deals.map((d: { id: string }) => d.id),
      contacts: s.contacts.length,
      name: s.tenant.niche_pack.name,
      niche: s.tenant.niche,
      stages: s.tenant.niche_pack.stages,
    };
  });
  expect(after.ids).toEqual(before.ids);
  expect(after.contacts).toBe(before.contacts);
  expect(after.name).toBe("Logística integrada");
  expect(after.niche).toBe("outro");
  expect(after.stages[2]).toBe("Avaliação marcada");
  await page.reload();
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await expect(page.getByLabel("Nome do segmento (opcional)")).toHaveValue(
    "Logística integrada",
  );
});
