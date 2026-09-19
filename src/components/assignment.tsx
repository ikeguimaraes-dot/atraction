"use client";
import { ui } from "@/lib/pt-ui";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Contact, State } from "@/lib/types";
import type { TeamMember } from "./team";
export function Assignment({
  contact,
  state,
  onSave,
}: {
  contact: Contact;
  state: State;
  onSave: (r: Contact) => Promise<boolean>;
}) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [owner, setOwner] = useState(contact.owner_id || "");
  useEffect(() => {
    if (state.tenant.id !== "demo")
      supabase()
        .rpc("atraction_team", { p_tenant: state.tenant.id })
        .then(({ data }) => setTeam(data || []));
  }, [state.tenant.id]);
  if (!["owner", "manager"].includes(state.role) || state.tenant.id === "demo")
    return null;
  return (
    <label className="assignment">
      {ui.quem_cuida_desta_pessoa}
      <select
        aria-label={ui.responsavel_pela_pessoa}
        value={owner}
        onChange={async (e) => {
          const value = e.target.value;
          if (await onSave({ ...contact, owner_id: value || null }))
            setOwner(value);
        }}
      >
        <option value="">{ui.sem_responsavel}</option>
        {team
          .filter((m) => m.role !== "viewer")
          .map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.email}
            </option>
          ))}
      </select>
    </label>
  );
}
