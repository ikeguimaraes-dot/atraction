"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { Recurrence } from "@/lib/types";
import { stopRecurrence } from "@/lib/recurrences";
import { today } from "@/lib/finance";
import { money } from "@/lib/domain";
import { Modal } from "./ui";
export function Recurrences({
  w,
  direction,
}: {
  w: ReturnType<typeof useWorkspace>;
  direction: "income" | "expense";
}) {
  const [ending, setEnding] = useState<Recurrence | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = (w.state?.recurrences || []).filter(
    (r) => r.direction === direction,
  );
  if (!rows.length) return null;
  return (
    <>
      <details className="card" style={{ padding: 16, marginBottom: 16 }}>
        <summary>
          Recorrências mensais (
          {
            rows.filter(
              (r) => r.active && (!r.end_date || r.end_date >= today()),
            ).length
          }{" "}
          ativas)
        </summary>
        {rows.map((r) => (
          <div className="setting-line" key={r.id}>
            <span>
              <strong>{r.title}</strong>
              <small style={{ display: "block" }}>
                {money(r.amount_cents / 100)}/mês ·{" "}
                {!r.active
                  ? "Encerrada"
                  : r.end_date
                    ? `Até ${r.end_date.split("-").reverse().join("/")}`
                    : "Sem data final"}
              </small>
            </span>
            {r.active && (
              <button className="secondary" onClick={() => setEnding(r)}>
                Encerrar {r.title}
              </button>
            )}
          </div>
        ))}
      </details>
      {ending && (
        <Modal
          title="Encerrar recorrência"
          onClose={() => {
            if (!busy) setEnding(null);
          }}
        >
          <p>
            Encerrar “{ending.title}”? Os lançamentos futuros sem baixa serão
            removidos. Valores já pagos ou recebidos, baixas parciais e
            vencimentos até hoje serão preservados.
          </p>
          <footer>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setEnding(null)}
            >
              Voltar
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (await stopRecurrence(w, ending.id)) setEnding(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar encerramento
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
