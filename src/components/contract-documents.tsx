"use client";
import { useRef, useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { Contract, CustomerDocument } from "@/lib/types";
import { alive } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { downloadFile } from "@/lib/files";
import { attachContractPdf } from "@/lib/contract-documents";

export function ContractDocuments({
  w,
  contract,
}: {
  w: ReturnType<typeof useWorkspace>;
  contract: Contract;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const state = w.state!;
  const documents = alive(state.documents).filter(
    (d) => d.contract_id === contract.id,
  );
  const canUpload = state.role === "owner" || state.role === "manager";

  async function upload(file: File) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await attachContractPdf(w, contract, file);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function download(row: CustomerDocument) {
    setError("");
    try {
      const blob = row.demo_data
        ? await (await fetch(row.demo_data)).blob()
        : await (async () => {
            const result = await supabase()
              .storage.from("atraction-contracts")
              .download(row.path);
            if (result.error) throw result.error;
            return result.data;
          })();
      downloadFile(row.name, blob);
    } catch {
      setError("Não foi possível baixar o PDF. Tente novamente.");
    }
  }

  return (
    <div className="form">
      {documents.map((row) => (
        <button
          key={row.id}
          className="text-button"
          onClick={() => download(row)}
        >
          Baixar PDF: {row.name}
        </button>
      ))}
      {canUpload && (
        <label>
          Anexar contrato em PDF
          <input
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy || w.busy}
            aria-label={`Anexar PDF ao contrato ${contract.title}`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <small>
            {busy
              ? "Enviando PDF…"
              : "PDF de até 5 MB. Acesso restrito à empresa."}
          </small>
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
