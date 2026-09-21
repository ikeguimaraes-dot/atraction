export type Niche =
  | "estetica"
  | "academia"
  | "pet"
  | "fintech"
  | "software"
  | "restaurante"
  | "ia"
  | "ecommerce"
  | "consultoria"
  | "agencia"
  | "educacao"
  | "saude"
  | "imobiliaria"
  | "outro";
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
  birthday?: string | null;
  custom_data?: Record<string, string>;
  merged_into?: string | null;
  campaign?: string;
  medium?: string;
  referred_by?: string;
  last_contact_at?: string | null;
  retention_days?: number;
  satisfaction?: number | null;
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
  pipeline_id?: string;
  contact_id: string;
  title: string;
  value: number;
  stage: number;
  loss_reason: string;
};
export type Activity = Base & {
  purpose?: "onboarding" | "followup" | "renewal" | "referral" | null;
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
export type Pipeline = { id: string; name: string; stages: string[] };
export type FieldDefinition = {
  id: string;
  label: string;
  type: "text" | "number" | "date";
};
export type DocumentTemplate = { id: string; name: string; body: string };
export type Tenant = {
  settings?: {
    pipelines?: Pipeline[];
    fields?: FieldDefinition[];
    templates?: DocumentTemplate[];
  };
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
export type Payment = {
  id: string;
  date: string;
  amount_cents: number;
  account_id: string | null;
};
export type FinanceEntry = Base & {
  payments?: Payment[];
  dre_group?: "revenue" | "cost" | "expense" | "tax";
  contract_id?: string | null;
  installment?: number | null;
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
export type Contract = Base & {
  contact_id: string;
  deal_id: string | null;
  renews_id: string | null;
  title: string;
  plan: string;
  mode: "once" | "installments" | "monthly";
  amount_cents: number;
  periods: number;
  start_date: string;
  first_due_date: string;
  end_date: string;
  status: "active" | "cancelled";
  notes: string;
};
export type CustomerDocument = Base & {
  contact_id: string;
  name: string;
  path: string;
  mime_type: string;
  size: number;
  demo_data?: string;
};
export type Account = Base & {
  name: string;
  kind: "cash" | "bank";
  initial_cents: number;
  initial_date: string;
};
export type Transfer = Base & {
  from_account: string;
  to_account: string;
  amount_cents: number;
  date: string;
  notes: string;
};
export type Segment = Base & { name: string; rule: string; value: string };
export type ChatSession = Base & {
  contact_id: string;
  visitor_name: string;
  closed: boolean;
};
export type ChatMessage = Base & {
  session_id: string;
  body: string;
  direction: "in" | "out";
  client_id: string;
};
export type State = {
  accounts: Account[];
  transfers: Transfer[];
  segments: Segment[];
  chat_sessions: ChatSession[];
  chat_messages: ChatMessage[];
  tenant: Tenant;
  role: Role;
  contracts: Contract[];
  documents: CustomerDocument[];
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
  | "finance"
  | "contracts"
  | "documents"
  | "accounts"
  | "transfers"
  | "segments"
  | "chat_sessions"
  | "chat_messages";
export type Row =
  | Contact
  | Deal
  | Activity
  | Message
  | Automation
  | Supplier
  | FinanceEntry
  | Contract
  | CustomerDocument
  | Account
  | Transfer
  | Segment
  | ChatSession
  | ChatMessage;
