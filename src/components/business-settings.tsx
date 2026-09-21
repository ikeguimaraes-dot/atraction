"use client";
import { useEffect, useState } from "react";
import { niches, segmentPack, accountPack } from "@/data/niches";
import type { Niche } from "@/lib/types";
import type { useWorkspace } from "@/lib/use-workspace";
export function BusinessSettings({
  w,
}: {
  w: ReturnType<typeof useWorkspace>;
}) {
  const s = w.state!;
  const [name, setName] = useState(s.tenant.name);
  const [niche, setNiche] = useState(s.tenant.niche);
  const [label, setLabel] = useState(
    s.tenant.niche === "outro" ? accountPack(s.tenant).name : "",
  );
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(s.tenant.name);
    setNiche(s.tenant.niche);
    setLabel(s.tenant.niche === "outro" ? accountPack(s.tenant).name : "");
  }, [s.tenant.id, s.tenant.name, s.tenant.niche, s.tenant.niche_pack?.name]);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (s.role !== "owner") return;
        setSaving(true);
        try {
          const changed =
            niche !== s.tenant.niche ||
            (niche === "outro" && label.trim() !== accountPack(s.tenant).name);
          await w.updateTenant({
            name: name.trim(),
            ...(changed
              ? {
                  niche,
                  niche_pack: segmentPack(
                    s.tenant,
                    niche,
                    label,
                    s.deals.length > 0,
                  ),
                  pack_version: (s.tenant.pack_version || 1) + 1,
                }
              : {}),
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <label>
        Nome do negócio
        <input
          required
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={s.role !== "owner"}
        />
      </label>
      <label>
        Seu nicho
        <select
          value={niche}
          onChange={(e) => setNiche(e.target.value as Niche)}
          disabled={s.role !== "owner"}
        >
          {Object.entries(niches).map(([id, n]) => (
            <option key={id} value={id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
      {niche === "outro" && (
        <label>
          Nome do segmento (opcional)
          <input
            maxLength={120}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Logística, turismo, indústria"
            disabled={s.role !== "owner"}
          />
        </label>
      )}
      <p className="management-hint">
        O segmento orienta as sugestões de serviço, mensagem e automação. Ao
        trocar, seus cadastros e funis personalizados são preservados. Se já
        houver negócios, as etapas do funil principal também permanecem.
      </p>
      <button
        className="primary"
        disabled={s.role !== "owner" || saving || !name.trim()}
      >
        Salvar alterações
      </button>
    </form>
  );
}
