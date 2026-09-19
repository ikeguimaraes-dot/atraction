import type {
  Contact,
  Deal,
  Activity,
  Message,
  Automation,
  Tenant,
  Event,
} from "./types";
type Table<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      atraction_tenants: Table<Tenant>;
      atraction_members: Table<{
        tenant_id: string;
        user_id: string;
        role: "owner" | "manager" | "agent" | "viewer";
      }>;
      atraction_contacts: Table<Contact>;
      atraction_deals: Table<Deal>;
      atraction_activities: Table<Activity>;
      atraction_messages: Table<Message>;
      atraction_automations: Table<Automation>;
      atraction_events: Table<Event>;
      atraction_invites: Table<{
        id: string;
        tenant_id: string;
        email: string;
        role: "manager" | "agent" | "viewer";
        token: string;
        created_at: string;
        expires_at: string;
        accepted_at: string | null;
      }>;
    };
    Views: Record<never, never>;
    Functions: {
      atraction_undo_import: {
        Args: { p_tenant: string; ids: string[] };
        Returns: number;
      };
      atraction_import_contacts: {
        Args: { p_tenant: string; rows: unknown[] };
        Returns: number;
      };
      atraction_export_contacts: {
        Args: { p_tenant: string };
        Returns: {
          name: string;
          phone: string;
          email: string;
          source: string;
        }[];
      };
      atraction_accept_invite: { Args: { p_token: string }; Returns: string };
      atraction_team: {
        Args: { p_tenant: string };
        Returns: { user_id: string; role: string; email: string }[];
      };
      atraction_remove_member: {
        Args: { p_tenant: string; p_user: string };
        Returns: undefined;
      };
      atraction_run_tasks: { Args: { p_tenant: string }; Returns: number };
      atraction_capture_info: {
        Args: { slug: string };
        Returns: {
          name: string;
          title: string;
          niche: "estetica" | "academia" | "pet";
        } | null;
      };
      atraction_capture: {
        Args: {
          slug: string;
          person_name: string;
          person_phone: string;
          accepted: boolean;
        };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
