export type Niche = "estetica" | "academia" | "pet";
export type Role = "owner" | "manager" | "agent" | "viewer";
export type Base = {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  owner_id: string | null;
  is_example: boolean;
};
export type Contact = Base & {
  lifecycle?: "prospect" | "customer" | "inactive";
  customer_since?: string | null;
  document?: string;
  address?: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  tags: string[];
  notes: string;
  consent: boolean;
  consent_proof: string;
};
export type Deal = Base & {
  contact_id: string;
  title: string;
  value: number;
  stage: number;
  loss_reason: string;
};
export type Activity = Base & {
  contact_id: string | null;
  title: string;
  due_at: string;
  done: boolean;
  kind: "task" | "appointment";
};
export type Message = Base & {
  contact_id: string;
  body: string;
  direction: "in" | "out" | "note";
  status: "example" | "draft" | "received" | "sent";
};
export type Automation = Base & {
  name: string;
  trigger: "contact_created" | "deal_stale";
  delay_hours: number;
  action: "create_task";
  enabled: boolean;
};
export type Event = {
  id: string;
  tenant_id: string;
  entity: string;
  entity_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};
export type NichePack = {
  name: string;
  emoji: string;
  service: string;
  stages: string[];
  message: string;
  robots: string[];
};
export type Tenant = {
  onboarding?: Record<string, string>;
  pack_version?: number;
  niche_pack?: NichePack;
  id: string;
  name: string;
  niche: Niche;
  owner_id: string;
  created_at: string;
  capture_enabled: boolean;
  capture_title: string;
  capture_slug: string;
  animations: boolean;
};
export type Supplier = Base & {
  name: string;
  document: string;
  email: string;
  phone: string;
  category: string;
  address: string;
  notes: string;
};
export type FinanceEntry = Base & {
  title: string;
  direction: "income" | "expense";
  amount_cents: number;
  category: string;
  due_date: string;
  settled_date: string | null;
  contact_id: string | null;
  supplier_id: string | null;
  notes: string;
};
export type State = {
  tenant: Tenant;
  role: Role;
  contacts: Contact[];
  suppliers: Supplier[];
  finance: FinanceEntry[];
  deals: Deal[];
  activities: Activity[];
  messages: Message[];
  automations: Automation[];
  events: Event[];
};
export type Collection =
  | "contacts"
  | "deals"
  | "activities"
  | "messages"
  | "automations"
  | "suppliers"
  | "finance";
export type Row =
  | Contact
  | Deal
  | Activity
  | Message
  | Automation
  | Supplier
  | FinanceEntry;
