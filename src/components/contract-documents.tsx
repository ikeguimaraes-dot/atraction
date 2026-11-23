"use client";
import { useRef, useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { Contract, CustomerDocument } from "@/lib/types";
import { alive } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { downloadFile } from "@/lib/files";

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
    let uploadedPath: string | undefined;
    let saved = false;
    try {
      const signature = await file.slice(0, 5).text();
      if (
        !file.name.toLowerCase().endsWith(".pdf") ||
        signature !== "%PDF-" ||
        file.size < 1 ||
        file.size > 5 * 1024 * 1024
      ) {
        throw new Error("Escolha um PDF válido de até 5 MB.");
      }
      const row: CustomerDocument = {
        ...w.base(),
        contact_id: null,
        finance_id: null,
        contract_id: contract.id,
        document_kind: "contract",
        name: file.name.slice(0, 200),
        path: "",
        mime_type: "application/pdf",
        size: file.size,
      };
      row.path = `${state.tenant.id}/${row.id}`;
      if (state.tenant.id === "demo") {
        if (file.size > 1024 * 1024)
          throw new Error("Na demonstração, use um PDF de até 1 MB.");
        row.demo_data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error("Não foi possível ler o PDF."));
          reader.readAsDataURL(file);
        });
        if (!(await w.write("documents", row)))
          throw new Error("Não foi possível guardar o PDF.");
        saved = true;
      } else {
        const storage = supabase().storage.from("atraction-contracts");
        const result = await storage.upload(row.path, file, {
          contentType: "application/pdf",
          upsert: false,
        });
        if (result.error)
          throw new Error(
            "Falha no envio do PDF. Confira sua conexão e tente novamente.",
          );
        uploadedPath = row.path;
        // Publish the attachment in the workspace only after its upload has completed.
        const inserted = await supabase()
          .from("atraction_documents")
          .insert(row)
          .select("id")
          .single();
        if (inserted.error)
          throw new Error(
            "O PDF foi enviado, mas não foi possível vinculá-lo ao contrato. Tente novamente.",
          );
        saved = true;
        await w.read(w.userId!);
      }
      w.notify("PDF anexado ao contrato com acesso privado.");
    } catch (err) {
      if (uploadedPath && !saved) {
        // Storage only permits deleting unlinked uploads belonging to this user.
        await supabase()
          .storage.from("atraction-contracts")
          .remove([uploadedPath]);
      }
      setError(
        saved
          ? "PDF salvo. Atualize a página para visualizar o anexo."
          : (err as Error).message,
      );
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
