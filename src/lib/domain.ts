import Papa from "papaparse";
import type { State, Contact } from "./types";
export const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
export function phone(value: string) {
  let n = value.replace(/\D/g, "");
  if (!value.trim().startsWith("+") && (n.length === 10 || n.length === 11))
    n = "55" + n;
  if (!/^[1-9]\d{9,14}$/.test(n))
    throw new Error("Informe um telefone com DDD.");
  return "+" + n;
}
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}
export function first(name: string) {
  return name.split(" ")[0];
}
export const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => !r.deleted_at);
export function parseContacts(csv: string, existing: Contact[]) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) =>
      h
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
  });
  const errors: string[] = [];
  const rows: { name: string; phone: string; email: string; source: string }[] =
    [];
  const seen = new Set(existing.map((c) => c.phone));
  if (
    !parsed.meta.fields?.includes("nome") ||
    !parsed.meta.fields?.includes("telefone")
  )
    return {
      rows,
      errors: ["A planilha precisa ter as colunas nome e telefone."],
    };
  if (parsed.data.length > 10000)
    return { rows, errors: ["Importe até 10.000 pessoas de cada vez."] };
  parsed.errors.forEach((e) =>
    errors.push(`Linha ${(e.row ?? 0) + 2}: confira a quantidade de colunas.`),
  );
  parsed.data.forEach((r, i) => {
    try {
      if (!r.nome?.trim()) throw new Error("Nome ausente.");
      const p = phone(r.telefone || "");
      if (seen.has(p)) throw new Error("Telefone já cadastrado ou repetido.");
      seen.add(p);
      rows.push({
        name: r.nome.trim().slice(0, 160),
        phone: p,
        email: r.email?.trim() || "",
        source: r.origem?.trim() || "Planilha",
      });
    } catch (e) {
      errors.push(`Linha ${i + 2}: ${(e as Error).message}`);
    }
  });
  return { rows, errors };
}
export function csvSafe(value: unknown) {
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
export function metrics(s: State, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const ev = s.events.filter((e) => new Date(e.created_at).getTime() >= cutoff);
  return {
    entered: ev.filter((e) => e.entity === "contacts" && e.kind === "INSERT")
      .length,
    talked: new Set(
      ev
        .filter((e) => e.entity === "messages" && e.payload.direction === "in")
        .map((e) => e.payload.contact_id),
    ).size,
    won: ev.reduce(
      (n, e) => n + (e.kind === "won" ? 1 : e.kind === "unwon" ? -1 : 0),
      0,
    ),
    revenue: ev.reduce(
      (n, e) =>
        n +
        Number(
          e.payload.revenue_delta ??
            (e.kind === "won"
              ? Number(e.payload.value || 0)
              : e.kind === "unwon"
                ? -Number(e.payload.value || 0)
                : 0),
        ),
      0,
    ),
  };
}
