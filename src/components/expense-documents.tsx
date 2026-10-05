"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { CustomerDocument, FinanceEntry } from "@/lib/types";
import { alive, money } from "@/lib/domain";
import { cents, today } from "@/lib/finance";
import { categoryGroup } from "@/lib/finance-categories";
import { supabase } from "@/lib/supabase";
import { SectionTitle } from "./ui";

export function ExpenseDocuments({
  w,
}: {
  w: ReturnType<typeof useWorkspace>;
}) {
  const s = w.state!;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function openDocument(document: CustomerDocument) {
    try {
      const blob = document.demo_data
        ? await (await fetch(document.demo_data)).blob()
        : await (async () => {
            const result = await supabase()
              .storage.from("atraction-documents")
              .download(document.path);
            if (result.error) throw result.error;
            return result.data;
          })();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Não foi possível abrir o comprovante.");
    }
  }

  return (
    <>
      <SectionTitle
        title="Entrada de NFe e recibos"
        subtitle="Guarde o comprovante e crie a despesa financeira no mesmo lançamento."
      />
      <section className="card attribution">
        <form
          className="form"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            const form = new FormData(event.currentTarget);
            const file = form.get("file") as File;
            let expense: FinanceEntry | undefined;
            let document: CustomerDocument | undefined;
            try {
              if (
                !file ||
                !["application/pdf", "image/png", "image/jpeg"].includes(
                  file.type,
                ) ||
                file.size < 1 ||
                file.size > 5 * 1024 * 1024
              )
                throw new Error("Escolha uma foto JPG/PNG ou PDF de até 5 MB.");
              const kind = form.get("kind") as "nfe" | "receipt";
              const title = String(form.get("title")).trim();
              const category = String(form.get("category")).trim();
              expense = {
                ...w.base(),
                direction: "expense",
                title,
                amount_cents: cents(String(form.get("amount"))),
                category,
                dre_group: categoryGroup("expense", category) || "expense",
                due_date: String(form.get("due_date")),
                settled_date: null,
                payments: [],
                contact_id: null,
                supplier_id: String(form.get("supplier_id")) || null,
                notes:
                  `${kind === "nfe" ? "NFe" : "Recibo"}${form.get("number") ? ` ${form.get("number")}` : ""}. ${String(form.get("notes") || "")}`.trim(),
              };
              document = {
                ...w.base(),
                contact_id: null,
                finance_id: expense.id,
                document_kind: kind,
                document_number: String(form.get("number") || "").trim(),
                issue_date: String(form.get("issue_date")),
                name: file.name.slice(0, 200),
                path: "",
                mime_type: file.type,
                size: file.size,
              };
              document.path = `${s.tenant.id}/${document.id}`;
              if (!(await w.write("finance", expense)))
                throw new Error("Não foi possível criar a despesa.");
              if (s.tenant.id === "demo") {
                document.demo_data = await new Promise<string>(
                  (resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  },
                );
                if (!(await w.write("documents", document)))
                  throw new Error("Não foi possível guardar o comprovante.");
              } else {
                if (!(await w.write("documents", document)))
                  throw new Error("Não foi possível cadastrar o comprovante.");
                const upload = await supabase()
                  .storage.from("atraction-documents")
                  .upload(document.path, file, {
                    contentType: file.type,
                    upsert: false,
                  });
                if (upload.error) throw upload.error;
              }
              w.notify("Despesa e comprovante cadastrados.");
              event.currentTarget.reset();
            } catch (cause) {
              if (document && s.tenant.id === "demo")
                await w.write("documents", {
                  ...document,
                  deleted_at: new Date().toISOString(),
                });
              if (expense && s.tenant.id === "demo")
                await w.write("finance", {
                  ...expense,
                  deleted_at: new Date().toISOString(),
                });
              if (document && s.tenant.id !== "demo")
                await supabase()
                  .from("atraction_documents")
                  .update({ deleted_at: new Date().toISOString() })
                  .eq("id", document.id)
                  .eq("tenant_id", s.tenant.id);
              if (expense && s.tenant.id !== "demo")
                await supabase()
                  .from("atraction_finance")
                  .update({ deleted_at: new Date().toISOString() })
                  .eq("id", expense.id)
                  .eq("tenant_id", s.tenant.id);
              if (w.userId) await w.read(w.userId);
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível cadastrar.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Tipo
              <select name="kind" required>
                <option value="nfe">Nota fiscal (NFe)</option>
                <option value="receipt">Recibo</option>
              </select>
            </label>
            <label>
              Número (opcional)
              <input name="number" maxLength={80} />
            </label>
            <label>
              Data de emissão
              <input
                name="issue_date"
                type="date"
                max={today()}
                defaultValue={today()}
                required
              />
            </label>
            <label>
              Vencimento
              <input
                name="due_date"
                type="date"
                defaultValue={today()}
                required
              />
            </label>
            <label>
              Valor (R$)
              <input
                name="amount"
                inputMode="decimal"
                required
                placeholder="0,00"
              />
            </label>
            <label>
              Fornecedor
              <select name="supplier_id">
                <option value="">Sem fornecedor</option>
                {alive(s.suppliers).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <input
                name="category"
                required
                maxLength={120}
                placeholder="Ex.: Materiais"
              />
            </label>
            <label>
              Foto ou PDF
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                capture="environment"
                required
              />
            </label>
          </div>
          <label>
            Descrição da despesa
            <input
              name="title"
              required
              maxLength={200}
              placeholder="Ex.: Compra de materiais"
            />
          </label>
          <label>
            Observações
            <textarea name="notes" maxLength={1000} />
          </label>
          <p>
            O arquivo é privado e pode ser consultado somente por donos e
            gerentes.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={saving || w.busy}>
            {saving ? "Enviando…" : "Cadastrar despesa e comprovante"}
          </button>
        </form>
      </section>
      <section className="card attribution">
        <h2>Comprovantes cadastrados</h2>
        {alive(s.documents)
          .filter((document) => document.finance_id)
          .map((document) => {
            const expense = s.finance.find(
              (item) => item.id === document.finance_id,
            );
            return (
              <div className="document-row" key={document.id}>
                <span>
                  <strong>
                    {document.document_kind === "nfe" ? "NFe" : "Recibo"}
                    {document.document_number
                      ? ` ${document.document_number}`
                      : ""}
                  </strong>{" "}
                  · {expense?.title || "Despesa arquivada"}
                  <small>
                    {document.issue_date?.split("-").reverse().join("/")} ·{" "}
                    {expense ? money(expense.amount_cents / 100) : ""} ·{" "}
                    {document.name}
                  </small>
                </span>
                <button
                  className="secondary"
                  onClick={() => void openDocument(document)}
                >
                  Abrir
                </button>
                <button
                  className="text-button"
                  disabled={w.busy}
                  onClick={() =>
                    w.write("documents", {
                      ...document,
                      deleted_at: new Date().toISOString(),
                    })
                  }
                >
                  Arquivar comprovante
                </button>
              </div>
            );
          })}
        {!alive(s.documents).some((document) => document.finance_id) && (
          <p>Nenhuma NFe ou recibo cadastrado.</p>
        )}
      </section>
    </>
  );
}
