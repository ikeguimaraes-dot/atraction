import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { describe, it, expect, vi } from "vitest";

// Run the actual Edge handler with an in-memory Auth/Data API boundary.
const source = readFileSync(
  "supabase/functions/atraction-create-member/index.ts",
  "utf8",
).replace(/^import .*;\n/, "");
const javascript = transpileModule(source, {
  compilerOptions: { module: ModuleKind.None, target: ScriptTarget.ES2022 },
}).outputText;
const tenant = "00000000-0000-4000-8000-00000000fe02";
function fixture({
  role = "owner",
  authenticated = true,
  count = 1,
  duplicate = false,
  linkFailure = false,
} = {}) {
  let handler!: (request: Request) => Promise<Response>;
  const createUser = vi
    .fn()
    .mockResolvedValue(
      duplicate
        ? { data: {}, error: { message: "duplicate" } }
        : { data: { user: { id: "new-user" } }, error: null },
    );
  const rpc = vi.fn(async (name: string) =>
    name === "atraction_team"
      ? { data: Array(count).fill({}), error: null }
      : {
          data: linkFailure ? null : "new-user",
          error: linkFailure ? { message: "team limit" } : null,
        },
  );
  const membership = {
    select: () => membership,
    eq: () => membership,
    maybeSingle: async () => ({ data: { role }, error: null }),
  };
  const caller = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: "owner" } : null },
        error: null,
      }),
    },
    from: () => membership,
    rpc,
  };
  const admin = { auth: { admin: { createUser } } };
  const createClient = vi.fn((_url: string, key: string) =>
    key === "secret-test" ? admin : caller,
  );
  const env: Record<string, string> = {
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_PUBLISHABLE_KEYS: '{"default":"publishable-test"}',
    SUPABASE_SECRET_KEYS: '{"default":"secret-test"}',
  };
  new Function("createClient", "Deno", javascript)(createClient, {
    env: { get: (key: string) => env[key] },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  });
  const request = (changes = {}) =>
    handler(
      new Request("https://example.invalid", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-session",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant,
          role: "agent",
          email: "NEW@example.invalid",
          password: "ExampleTest!123",
          ...changes,
        }),
      }),
    );
  return { request, createUser, rpc, createClient, caller };
}

describe("company user creation", () => {
  it("verifies the session and links a new Auth user using the caller's permissions", async () => {
    const f = fixture();
    expect((await f.request()).status).toBe(201);
    expect(f.caller.auth.getUser).toHaveBeenCalledWith("test-session");
    expect(f.createUser).toHaveBeenCalledWith({
      email: "new@example.invalid",
      password: "ExampleTest!123",
      email_confirm: true,
    });
    expect(f.rpc).toHaveBeenCalledWith("atraction_add_member", {
      tenant,
      member_email: "new@example.invalid",
      member_role: "agent",
    });
  });
  it("rejects unauthenticated requests before creating identities", async () => {
    const f = fixture({ authenticated: false });
    expect((await f.request()).status).toBe(401);
    expect(f.createUser).not.toHaveBeenCalled();
  });
  it("rejects managers before creating identities", async () => {
    const f = fixture({ role: "manager" });
    expect((await f.request()).status).toBe(403);
    expect(f.createUser).not.toHaveBeenCalled();
  });
  it("enforces team capacity before creating identities", async () => {
    const f = fixture({ count: 10 });
    expect((await f.request()).status).toBe(409);
    expect(f.createUser).not.toHaveBeenCalled();
  });
  it("rejects weak passwords and oversized UTF-8 passwords", async () => {
    const f = fixture();
    expect((await f.request({ password: "short" })).status).toBe(400);
    expect((await f.request({ password: "é".repeat(40) })).status).toBe(400);
    expect(f.createUser).not.toHaveBeenCalled();
  });
  it("preserves existing accounts and offers recovery when linking fails", async () => {
    const duplicate = fixture({ duplicate: true });
    expect((await duplicate.request()).status).toBe(400);
    expect(duplicate.rpc).not.toHaveBeenCalledWith(
      "atraction_add_member",
      expect.anything(),
    );
    const partial = fixture({ linkFailure: true });
    const response = await partial.request();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain(
      "Adicionar usuário existente",
    );
  });
});
