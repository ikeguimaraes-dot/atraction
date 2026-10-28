import type { FinanceEntry } from "./types";

type SaveError = { code?: string; message?: string };
type Result = { error: SaveError | null; status?: number };
type Storage = {
  insert: (rows: FinanceEntry[]) => PromiseLike<Result>;
  find: (
    ids: string[],
  ) => PromiseLike<{ data: { id: string }[] | null; error: SaveError | null }>;
};

const transient = (result: Result) =>
  (result.status || 0) >= 500 ||
  result.status === 0 ||
  result.error?.code === "57014" ||
  /fetch|network|timeout|timed out/i.test(result.error?.message || "");

export function financeSaveMessage(cause: unknown): string {
  const error = cause as SaveError | undefined;
  if (error?.code === "42501")
    return "Sua sessão não tem permissão para cadastrar despesas nesta empresa. Entre novamente e confira a empresa selecionada.";
  if (error?.code === "23503")
    return "O fornecedor ou outro vínculo da despesa não está mais disponível. Atualize a página e selecione novamente.";
  if (error?.code === "23514")
    return "Confira o valor, a forma de pagamento e a quantidade de parcelas da despesa.";
  if (error?.message === "purchase payer must be a tenant member")
    return "Quem pagou deve ser um membro da empresa selecionada.";
  return "Não foi possível confirmar o cadastro no servidor. Seus dados continuam no formulário. Confira a lista de despesas antes de tentar novamente.";
}

/** Retry a temporary failure once, preserving IDs and checking for a lost response. */
export async function saveFinanceRows(
  rows: FinanceEntry[],
  storage: Storage,
): Promise<void> {
  const ids = rows.map((row) => row.id);
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: Result;
    try {
      result = await storage.insert(rows);
    } catch (cause) {
      result = {
        error: {
          message: cause instanceof Error ? cause.message : "Network error",
        },
        status: 0,
      };
    }
    if (!result.error) return;
    if (!transient(result) && result.error.code !== "23505") throw result.error;
    try {
      const saved = await storage.find(ids);
      if (
        !saved.error &&
        saved.data?.length === rows.length &&
        ids.every((id) => saved.data!.some((row) => row.id === id))
      )
        return;
    } catch {
      /* A retry still uses exactly the same primary keys. */
    }
    if (attempt === 1 || !transient(result)) throw result.error;
  }
}
