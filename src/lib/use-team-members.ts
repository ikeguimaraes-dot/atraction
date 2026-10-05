"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type TeamMember = { user_id: string; role: string; email: string };
export function useTeamMembers(tenantId: string) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  useEffect(() => {
    if (tenantId === "demo") return;
    supabase()
      .rpc("atraction_team", { p_tenant: tenantId })
      .then(({ data, error }) => !error && setMembers(data || []));
  }, [tenantId]);
  return members;
}
