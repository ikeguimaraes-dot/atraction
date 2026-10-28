"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { CustomerDocument, FinanceEntry } from "@/lib/types";
import { alive, money } from "@/lib/domain";
import { installmentPlan } from "@/lib/installments";
import {
  expensePurchases,
  paymentMethods,
  purchaseInstallments,
  type ExpensePurchase,
} from "@/lib/expense-purchases";
import { cents, today } from "@/lib/finance";
import { categoryGroup } from "@/lib/finance-categories";
import { supabase } from "@/lib/supabase";
import { SectionTitle } from "./ui";
import { companyKey } from "@/lib/shared-expenses";
import { useTeamMembers } from "@/lib/use-team-members";
import { ExpensePurchaseEditor } from "./expense-purchase-editor";

export function ExpenseDocuments({
  w,
}: {
  w: ReturnType<typeof useWorkspace>;
}) {
  const s = w.state!;
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ExpensePurchase | null>(null);
  const members = useTeamMembers(s.tenant.id);
  const payers = [
    { key: companyKey, label: "Empresa" },
    ...members.map((member) => ({ key: member.user_id, label: member.email })),
  ];

  const [method, setMethod] =
    useState<keyof typeof paymentMethods>("credit_card");
  const [count, setCount] = useState("1");
  const [amount, setAmount] = useState("");
  const [firstDue, setFirstDue] = useState(today());
  const canInstall = method === "credit_card" || method === "bank_slip";
  const purchases = expensePurchases(s.finance, s.documents);
  const months = [...new Set(purchases.map((purchase) => purchase.month))];
  let preview: ReturnType<typeof installmentPlan> = [];
  try {
    preview = installmentPlan(cents(amount), Number(count), firstDue);
  } catch {
    /* Validation is shown on submission. */
  }

  async function openDocument(document: CustomerDocument) {
    const viewer = window.open("about:blank", "_blank");
    if (!viewer) {
      setError("Permita abrir uma nova aba para visualizar o comprovante.");
      return;
    }
    viewer.opener = null;
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
      viewer.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      viewer.close();
      setError("Não foi possível abrir o comprovante.");
    }
  }

  return (
    <>
      <SectionTitle
        title="NF e Recibos"
        subtitle="Cadastre a despesa e, se desejar, anexe a nota fiscal ou o recibo."
      />
      <section className="card attribution">
        <form
          className="form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving || w.busy) return;
            const formElement = event.currentTarget;
            setSaving(true);
            setError("");
            const form = new FormData(formElement);
            const file = form.get("file") as File;
            let expenses: FinanceEntry[] = [];
            let financeSaved = false;
            let document: CustomerDocument | undefined;
            try {
              if (
                file?.name &&
                (!["application/pdf", "image/png", "image/jpeg"].includes(
                  file.type,
                ) ||
                  file.size < 1 ||
                  file.size > 5 * 1024 * 1024)
              )
                throw new Error("Escolha uma foto JPG/PNG ou PDF de até 5 MB.");
              const kind = form.get("kind") as "nfe" | "receipt";
              const category = String(form.get("category")).trim();
              const number = String(form.get("number") || "").trim();
              const title =
                String(form.get("title") || "").trim() ||
                `${kind === "nfe" ? "NF" : "Recibo"}${number ? ` ${number}` : ""} · ${category}`.slice(
                  0,
                  200,
                );
              const payer = String(form.get("purchase_payer"));
              if (!payers.some((person) => person.key === payer))
                throw new Error("Escolha quem pagou a despesa.");
              const expense: FinanceEntry = {
                ...w.base(),
                direction: "expense",
                purchase_date: String(form.get("issue_date")),
                payment_method: method,
                purchase_payer: payer,
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
              expenses = purchaseInstallments(
                expense,
                Number(count),
                () => w.base().id,
              );
              financeSaved = await w.createFinanceInstallments(expenses, true);
              if (!financeSaved)
                throw new Error("Não foi possível criar a despesa.");
              if (file?.name) {
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
                    throw new Error(
                      "Não foi possível cadastrar o comprovante.",
                    );
                  const upload = await supabase()
                    .storage.from("atraction-documents")
                    .upload(document.path, file, {
                      contentType: file.type,
                      upsert: false,
                    });
                  if (upload.error) throw upload.error;
                }
              }
              w.notify(
                document
                  ? "Despesa e comprovante cadastrados."
                  : "Despesa cadastrada.",
              );
              formElement.reset();
              setAmount("");
              setCount("1");
              setMethod("credit_card");
              setFirstDue(today());
            } catch (cause) {
              if (document && s.tenant.id === "demo")
                await w.write("documents", {
                  ...document,
                  deleted_at: new Date().toISOString(),
                });
              if (financeSaved && s.tenant.id === "demo") {
                const ids = new Set(expenses.map((expense) => expense.id));
                w.setState((state) =>
                  state
                    ? {
                        ...state,
                        finance: state.finance.filter(
                          (expense) => !ids.has(expense.id),
                        ),
                      }
                    : state,
                );
              }
              if (document && s.tenant.id !== "demo")
                await supabase()
                  .from("atraction_documents")
                  .update({ deleted_at: new Date().toISOString() })
                  .eq("id", document.id)
                  .eq("tenant_id", s.tenant.id);
              if (financeSaved && s.tenant.id !== "demo")
                await supabase()
                  .from("atraction_finance")
                  .update({ deleted_at: new Date().toISOString() })
                  .in(
                    "id",
                    expenses.map((expense) => expense.id),
                  )
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
              {Number(count) > 1 ? "Primeiro vencimento" : "Vencimento"}
              <input
                name="due_date"
                type="date"
                value={firstDue}
                onChange={(event) => setFirstDue(event.target.value)}
                required
              />
            </label>
            <label>
              Valor total (R$)
              <input
                name="amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                required
                placeholder="0,00"
                onBlur={(event) => {
                  try {
                    setAmount(
                      (cents(event.currentTarget.value) / 100).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      ),
                    );
                  } catch {
                    // Keep invalid input available for correction on submit.
                  }
                }}
              />
            </label>
            <label>
              Forma de pagamento
              <select
                value={method}
                onChange={(event) => {
                  const next = event.target
                    .value as keyof typeof paymentMethods;
                  setMethod(next);
                  if (next !== "credit_card" && next !== "bank_slip")
                    setCount("1");
                }}
              >
                {Object.entries(paymentMethods).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantidade de parcelas
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                required
                disabled={!canInstall}
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </label>
            <label>
              Quem pagou
              <select name="purchase_payer" defaultValue={companyKey} required>
                {payers.map((person) => (
                  <option key={person.key} value={person.key}>
                    {person.label}
                  </option>
                ))}
              </select>
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
              Foto ou PDF (opcional)
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                capture="environment"
              />
            </label>
          </div>
          {Number(count) > 1 && (
            <section aria-label="Prévia das parcelas">
              <p>
                O valor total será dividido em {count} cobranças mensais, a
                partir do primeiro vencimento.
              </p>
              {preview.map((part, i) => (
                <p key={part.due_date}>
                  {i + 1}/{count} ·{" "}
                  {part.due_date.split("-").reverse().join("/")} ·{" "}
                  {money(part.amount_cents / 100)}
                </p>
              ))}
            </section>
          )}
          <label>
            Descrição da despesa (opcional)
            <input
              name="title"
              maxLength={200}
              placeholder="Ex.: Compra de materiais"
            />
          </label>
          <label>
            Observações
            <textarea name="notes" maxLength={1000} />
          </label>
          <p>
            Se anexar um comprovante, ele será privado e poderá ser consultado
            somente por donos e gerentes.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={saving || w.busy}>
            {saving ? "Enviando…" : "Cadastrar despesa"}
          </button>
        </form>
      </section>
      <section className="card attribution">
        <SectionTitle
          title={`Despesas por mês · ${s.tenant.name}`}
          subtitle={`${purchases.length} despesas cadastradas, com ou sem comprovante.`}
          action={
            w.userId ? (
              <button
                className="secondary"
                disabled={refreshing || w.switching}
                onClick={async () => {
                  setRefreshing(true);
                  setError("");
                  try {
                    await w.read(w.userId!);
                  } catch {
                    setError(
                      "Não foi possível atualizar as despesas. Tente novamente.",
                    );
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                {refreshing ? "Atualizando…" : "Atualizar despesas"}
              </button>
            ) : undefined
          }
        />
        <p>
          Compras organizadas pela data de emissão informada, mesmo sem
          comprovante. Quando não há data de emissão, usamos o vencimento.
        </p>
        {months.map((month) => {
          const items = purchases.filter(
            (purchase) => purchase.month === month,
          );
          const monthLabel = new Date(
            `${month}-01T12:00:00`,
          ).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
          return (
            <section
              key={month}
              aria-label={monthLabel}
              className="expense-month"
            >
              <h3>
                {monthLabel} ·{" "}
                {money(items.reduce((sum, item) => sum + item.total, 0) / 100)}
              </h3>
              {items.map((purchase) => (
                <details className="expense-purchase" key={purchase.id}>
                  <summary>
                    {purchase.title} · {money(purchase.total / 100)}
                  </summary>
                  <p>
                    Data: {purchase.date.split("-").reverse().join("/")} ·
                    Pagamento: {purchase.paymentMethod}
                  </p>
                  <p>
                    {purchase.rows.length > 1
                      ? `${purchase.rows.length} parcelas`
                      : "1 parcela"}
                  </p>
                  <p>
                    Quem pagou:{" "}
                    {purchase.rows[0].purchase_payer
                      ? payers.find(
                          (person) =>
                            person.key === purchase.rows[0].purchase_payer,
                        )?.label || "Membro indisponível"
                      : "Não informado"}
                  </p>
                  <button
                    className="secondary"
                    disabled={w.busy}
                    onClick={() => setEditing(purchase)}
                  >
                    Editar despesa
                  </button>
                  {purchase.rows.map((row) => (
                    <div className="document-row" key={row.id}>
                      <span>
                        {row.purchase_installment
                          ? `${row.purchase_installment}/${row.purchase_installments} · `
                          : ""}
                        Vencimento:{" "}
                        {row.due_date.split("-").reverse().join("/")} ·{" "}
                        {money(row.amount_cents / 100)}
                      </span>
                    </div>
                  ))}
                  {purchase.documents.map((document) => (
                    <div className="document-row" key={document.id}>
                      <span>
                        <strong>
                          {document.document_kind === "nfe" ? "NF" : "Recibo"}{" "}
                          {document.document_number}
                        </strong>
                        <small>{document.name}</small>
                      </span>
                      <button
                        className="secondary"
                        onClick={() => void openDocument(document)}
                      >
                        Abrir comprovante
                      </button>
                      <button
                        className="text-button"
                        disabled={w.busy || w.state!.role === "manager"}
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
                  ))}
                  {!purchase.documents.length && (
                    <p>Sem comprovante disponível.</p>
                  )}
                </details>
              ))}
            </section>
          );
        })}
        {!purchases.length && <p>Nenhuma despesa cadastrada.</p>}
      </section>
      {editing && (
        <ExpensePurchaseEditor
          w={w}
          purchase={editing}
          payers={payers}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
