import type { useWorkspace } from "./use-workspace";
import type { Contract, CustomerDocument } from "./types";
import { supabase } from "./supabase";

export async function validateContractPdf(file: File, demo = false) {
  if (
    !file.name.toLowerCase().endsWith(".pdf") ||
    (await file.slice(0, 5).text()) !== "%PDF-" ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Escolha um PDF válido de até 5 MB.");
  if (demo && file.size > 1024 * 1024)
    throw new Error("Na demonstração, use um PDF de até 1 MB.");
}

export async function attachContractPdf(
  w: ReturnType<typeof useWorkspace>,
  contract: Contract,
  file: File,
) {
  const state = w.state!;
  let uploadedPath: string | undefined;
  let saved = false;
  try {
    await validateContractPdf(file, state.tenant.id === "demo");
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
      row.demo_data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível ler o PDF."));
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
    if (saved)
      w.notify("PDF salvo. Atualize a página para visualizar o anexo.");
    else throw err;
  }
}
