import type {
  Contact,
  Account,
  Transfer,
  Segment,
  ChatSession,
  ChatMessage,
  Contract,
  CustomerDocument,
  Supplier,
  FinanceEntry,
  Recurrence,
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
      atraction_accounts: Table<Account>;
      atraction_transfers: Table<Transfer>;
      atraction_segments: Table<Segment>;
      atraction_chat_sessions: Table<ChatSession>;
      atraction_chat_messages: Table<ChatMessage>;
      atraction_tenants: Table<Tenant>;
      atraction_members: Table<{
        tenant_id: string;
        user_id: string;
        role: "owner" | "manager" | "agent" | "viewer";
      }>;
      atraction_suppliers: Table<Supplier>;
      atraction_finance: Table<FinanceEntry>;
      atraction_recurrences: Table<Recurrence>;
      atraction_contracts: Table<Contract>;
      atraction_documents: Table<CustomerDocument>;
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
      atraction_create_recurrence: {
        Args: {
          t: string;
          request_id: string;
          entry: FinanceEntry;
          ends_on: string | null;
        };
        Returns: string;
      };
      atraction_stop_recurrence: {
        Args: { series: string };
        Returns: undefined;
      };
      atraction_record_payment: {
        Args: {
          entry: string;
          amount: number;
          paid_on: string;
          account: string | null;
          request_id: string;
          reverse_id?: string | null;
        };
        Returns: undefined;
      };
      atraction_member_role: {
        Args: { tenant: string; member: string; new_role: string };
        Returns: undefined;
      };
      atraction_merge_contacts: {
        Args: { source_id: string; target_id: string };
        Returns: undefined;
      };
      atraction_chat_start: {
        Args: {
          slug: string;
          person_name: string;
          person_phone: string;
          accepted: boolean;
        };
        Returns: { id: string; token: string };
      };
      atraction_chat_poll: {
        Args: { session: string; token: string };
        Returns: {
          closed: boolean;
          messages: {
            id: string;
            body: string;
            direction: string;
            created_at: string;
          }[];
        };
      };
      atraction_chat_send: {
        Args: {
          session: string;
          token: string;
          body: string;
          request_id: string;
        };
        Returns: undefined;
      };
      atraction_create_contract: {
        Args: { p: Record<string, unknown> };
        Returns: string;
      };
      atraction_contract_action: {
        Args: {
          contract: string;
          action: string;
          amount: number;
          effective: string;
        };
        Returns: undefined;
      };
      atraction_capture_attributed: {
        Args: {
          slug: string;
          person_name: string;
          person_phone: string;
          accepted: boolean;
          attribution: Record<string, string>;
        };
        Returns: boolean;
      };
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
