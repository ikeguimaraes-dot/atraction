"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { CustomerDocument } from "@/lib/types";
import { money } from "@/lib/domain";
import { cents, today } from "@/lib/finance";
import { categoryGroup } from "@/lib/finance-categories";
import { installmentPlan } from "@/lib/installments";
import {
  editPurchaseRows,
  paymentMethods,
  type ExpensePurchase,
  type PurchaseChanges,
} from "@/lib/expense-purchases";
import { supabase } from "@/lib/supabase";
import { Modal } from "./ui";

type Work = ReturnType<typeof useWorkspace>;
export function ExpensePurchaseEditor({
  w,
  purchase,
  payers,
  onClose,
}: {
  w: Work;
  purchase: ExpensePurchase;
  payers: { key: string; label: string }[];
  onClose: () => void;
}) {
  const s = w.state!;
  const first = purchase.rows[0];
  const document = purchase.documents[0];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hasReplacement, setHasReplacement] = useState(false);
  const [method, setMethod] = useState(
    first.payment_method || (purchase.rows.length > 1 ? "credit_card" : "pix"),
  );
  const [count, setCount] = useState(String(purchase.rows.length));
  const [amount, setAmount] = useState(
    (purchase.total / 100).toFixed(2).replace(".", ","),
  );
  const [due, setDue] = useState(first.due_date);
  let preview: ReturnType<typeof installmentPlan> = [];
  try {
    const total = cents(amount);
    preview =
      total === purchase.total &&
      Number(count) === purchase.rows.length &&
      due === first.due_date
        ? purchase.rows.map((row) => ({
            amount_cents: row.amount_cents,
            due_date: row.due_date,
          }))
        : installmentPlan(total, Number(count), due);
  } catch {
    /* Validate on save. */
  }

  return (
    <Modal
      title="Editar despesa completa"
      onClose={saving ? () => {} : onClose}
      wide
    >
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving || w.busy) return;
          const form = new FormData(event.currentTarget);
          setSaving(true);
          setError("");
          let replacement: CustomerDocument | undefined;
          let committed = false;
          try {
            const changes: PurchaseChanges = {
              title: String(form.get("title")).trim(),
              category: String(form.get("category")).trim(),
              dre_group:
                categoryGroup("expense", String(form.get("category")).trim()) ||
                "expense",
              amount_cents: cents(amount),
              count: Number(count),
              first_due: due,
              issue_date: String(form.get("issue_date")),
              payment_method: method,
              purchase_payer: String(form.get("purchase_payer")),
              supplier_id: String(form.get("supplier_id")) || null,
              notes: String(form.get("notes") || ""),
              kind: (form.get("kind") || "nfe") as "nfe" | "receipt",
              number: String(form.get("number") || "").trim(),
            };
            if (
              !payers.some((person) => person.key === changes.purchase_payer) &&
              changes.purchase_payer !== first.purchase_payer
            )
              throw new Error("Escolha quem pagou a despesa.");
            if (changes.issue_date > today())
              throw new Error("A emissão não pode estar no futuro.");
            const rows = editPurchaseRows(purchase, changes, () => ({
              ...first,
              ...w.base(),
              payments: [],
              settled_date: null,
            }));
            const file = form.get("file") as File;
            if (file?.size) {
              if (
                !["application/pdf", "image/png", "image/jpeg"].includes(
                  file.type,
                ) ||
                file.size > 5 * 1024 * 1024
              )
                throw new Error("Escolha uma foto JPG/PNG ou PDF de até 5 MB.");
              replacement = {
                ...w.base(),
                contact_id: null,
                finance_id: first.id,
                document_kind: changes.kind,
                document_number: changes.number,
                issue_date: changes.issue_date,
                name: file.name.slice(0, 200),
                path: "",
                mime_type: file.type,
                size: file.size,
              };
              replacement.path = `${s.tenant.id}/${replacement.id}`;
              if (s.tenant.id === "demo") {
                replacement.demo_data = await new Promise<string>(
                  (resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () =>
                      reject(new Error("Não foi possível ler o comprovante."));
                    reader.readAsDataURL(file);
                  },
                );
              } else {
                if (!(await w.write("documents", replacement)))
                  throw new Error(
                    "Não foi possível preparar o novo comprovante.",
                  );
                const upload = await supabase()
                  .storage.from("atraction-documents")
                  .upload(replacement.path, file, { contentType: file.type });
                if (upload.error) throw upload.error;
              }
            }
            if (s.tenant.id === "demo") {
              const oldIds = new Set(purchase.rows.map((row) => row.id));
              const nextIds = new Set(rows.map((row) => row.id));
              const stamp = new Date().toISOString();
              const nextDocument = replacement || document;
              w.setState((state) =>
                state
                  ? {
                      ...state,
                      finance: [
                        ...rows.map((row) => ({ ...row, updated_at: stamp })),
                        ...state.finance.filter((row) => !oldIds.has(row.id)),
                        ...purchase.rows
                          .filter((row) => !nextIds.has(row.id))
                          .map((row) => ({
                            ...row,
                            deleted_at: stamp,
                            updated_at: stamp,
                          })),
                      ],
                      documents: [
                        ...(replacement ? [{ ...replacement }] : []),
                        ...state.documents.map((doc) => {
                          if (replacement && doc.id === document?.id)
                            return {
                              ...doc,
                              deleted_at: stamp,
                              updated_at: stamp,
                            };
                          return doc.id === nextDocument?.id
                            ? {
                                ...doc,
                                document_kind: changes.kind,
                                document_number: changes.number,
                                issue_date: changes.issue_date,
                                updated_at: stamp,
                              }
                            : doc;
                        }),
                      ],
                    }
                  : state,
              );
            } else {
              const result = await supabase().rpc(
                "atraction_edit_expense_purchase",
                {
                  entry_id: first.id,
                  expected: purchase.rows.map((row) => ({
                    id: row.id,
                    updated_at: row.updated_at,
                  })),
                  changes,
                  document_id: document?.id || null,
                  document_version: document?.updated_at || null,
                  replacement_id: replacement?.id || null,
                },
              );
              if (result.error) throw new Error(result.error.message);
            }
            committed = true;
            if (w.userId) {
              try {
                await w.read(w.userId);
              } catch {
                w.notify(
                  "Despesa salva. Atualize a página para ver as alterações.",
                );
                onClose();
                return;
              }
            }
            w.notify("Despesa e comprovante atualizados.");
            onClose();
          } catch (cause) {
            if (replacement && !committed && s.tenant.id !== "demo") {
              await supabase()
                .from("atraction_documents")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", replacement.id)
                .eq("tenant_id", s.tenant.id);
              await supabase()
                .storage.from("atraction-documents")
                .remove([replacement.path]);
            }
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível salvar a despesa.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <p>
          Edite os dados da compra e do comprovante. As alterações valem para
          todas as parcelas desta compra.
        </p>
        <div className="form-grid">
          <label>
            Tipo
            <select
              name="kind"
              disabled={!document && !hasReplacement}
              defaultValue={
                document?.document_kind === "receipt" ? "receipt" : "nfe"
              }
              required
            >
              <option value="nfe">Nota fiscal (NF)</option>
              <option value="receipt">Recibo</option>
            </select>
          </label>
          <label>
            Número (opcional)
            <input
              name="number"
              disabled={!document && !hasReplacement}
              maxLength={80}
              defaultValue={document?.document_number || ""}
            />
          </label>
          <label>
            Data de emissão
            <input
              type="date"
              name="issue_date"
              required
              max={today()}
              defaultValue={purchase.date}
            />
          </label>
          <label>
            {Number(count) > 1 ? "Primeiro vencimento" : "Vencimento"}
            <input
              type="date"
              required
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            Valor total (R$)
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Forma de pagamento
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as keyof typeof paymentMethods)
              }
            >
              {Object.entries(paymentMethods).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantidade de parcelas
            <input
              type="number"
              required
              min="1"
              max="60"
              step="1"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          <label>
            Quem pagou
            <select
              name="purchase_payer"
              required
              defaultValue={first.purchase_payer || ""}
            >
              <option value="" disabled>
                Selecione quem pagou
              </option>
              {first.purchase_payer &&
                !payers.some((p) => p.key === first.purchase_payer) && (
                  <option value={first.purchase_payer}>
                    Membro indisponível (manter registro)
                  </option>
                )}
              {payers.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fornecedor
            <select name="supplier_id" defaultValue={first.supplier_id || ""}>
              <option value="">Sem fornecedor</option>
              {s.suppliers
                .filter(
                  (supplier) =>
                    !supplier.deleted_at || supplier.id === first.supplier_id,
                )
                .map((supplier) => (
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
              defaultValue={first.category}
            />
          </label>
        </div>
        <label>
          Descrição da despesa
          <input
            name="title"
            autoFocus
            required
            maxLength={200}
            defaultValue={purchase.title}
          />
        </label>
        <label>
          Observações
          <textarea name="notes" maxLength={1000} defaultValue={first.notes} />
        </label>
        <p>Comprovante atual: {document?.name || "Sem comprovante"}</p>
        <label>
          Foto ou PDF (substituir comprovante)
          <input
            type="file"
            name="file"
            onChange={(event) =>
              setHasReplacement(!!event.target.files?.length)
            }
            accept="image/jpeg,image/png,application/pdf"
          />
        </label>
        <p>Deixe o arquivo vazio para manter o comprovante atual.</p>
        {Number(count) > 1 && (
          <details>
            <summary>Prévia das parcelas</summary>
            {preview.map((part, i) => (
              <p key={i}>
                {i + 1}/{count} · {part.due_date.split("-").reverse().join("/")}{" "}
                · {money(part.amount_cents / 100)}
              </p>
            ))}
          </details>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            className="secondary"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button className="primary" disabled={saving || w.busy}>
            {saving ? "Salvando…" : "Salvar despesa"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
