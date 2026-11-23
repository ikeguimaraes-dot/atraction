import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Método inválido." });
  try {
    const authorization = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(
      url,
      JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default ||
        Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (authError || !user)
      return reply(401, { error: "Entre novamente para cadastrar a pessoa." });
    const body = await req.json();
    const { tenant, role, password } = body;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (
      typeof tenant !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(tenant) ||
      !["owner", "manager", "agent"].includes(role) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320 ||
      typeof password !== "string" ||
      password.length < 8 ||
      new TextEncoder().encode(password).length > 72
    ) {
      return reply(400, {
        error: "Confira e-mail, cargo e senha (8 a 72 bytes).",
      });
    }
    const membership = await caller
      .from("atraction_members")
      .select("role")
      .eq("tenant_id", tenant)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership.error || membership.data?.role !== "owner") {
      return reply(403, {
        error: "Somente donos podem cadastrar pessoas na empresa.",
      });
    }
    const team = await caller.rpc("atraction_team", { p_tenant: tenant });
    if (team.error)
      return reply(503, { error: "Não foi possível consultar a equipe." });
    if (team.data?.length >= 10)
      return reply(409, {
        error: "A equipe já atingiu o limite de 10 pessoas.",
      });
    const admin = createClient(
      url,
      JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    // Never change the password or identity of an existing account in this shared project.
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      return reply(400, {
        error:
          "Não foi possível criar a conta. Se o e-mail já possui cadastro, selecione Adicionar usuário existente. Confira também os requisitos da senha.",
      });
    }
    const linked = await caller.rpc("atraction_add_member", {
      tenant,
      member_email: email,
      member_role: role,
    });
    if (linked.error || linked.data !== created.data.user.id) {
      // Preserve the new identity on a linking failure; it can be linked using the existing-user flow.
      return reply(409, {
        error:
          "A conta foi criada, mas o vínculo não foi concluído. Selecione Adicionar usuário existente para tentar novamente.",
      });
    }
    return reply(201, { user_id: linked.data });
  } catch {
    return reply(500, {
      error:
        "Não foi possível concluir o cadastro. Confira a equipe antes de tentar novamente.",
    });
  }
});
