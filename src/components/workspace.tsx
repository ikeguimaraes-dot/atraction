"use client";
import { demo } from "@/lib/demo";
import { alive, csvSafe } from "@/lib/domain";
import { pt } from "@/lib/pt";
import { ui } from "@/lib/pt-ui";
import { supabase } from "@/lib/supabase";
import type { Collection, Contact, Row } from "@/lib/types";
import { useWorkspace } from "@/lib/use-workspace";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Heart,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import Papa from "papaparse";
import { useEffect, useState } from "react";
import { Auth } from "./auth";
import { BusinessSettings } from "./business-settings";
import { Cash } from "./cash";
import { AllCompanies, CompanySelector } from "./companies";
import { Contracts } from "./contracts";
import { CustomerHub } from "./customer-hub";
import { Clients, Finance, FinancialSummary, Suppliers } from "./management";
import { Retention } from "./retention";
import { ToolsPanel } from "./tools-panel";
import { Avatar, CardLink, Empty, Mascot, Modal, SectionTitle } from "./ui";

import { Assignment } from "./assignment";
import { ContactForm, TaskForm } from "./forms";
import { Team } from "./team";
const navigation = [
  { id: "today", label: "Visão geral", icon: Home },
  { id: "clients", label: "Clientes", icon: Heart },
  { id: "contracts", label: "Contratos", icon: FileText },
  { id: "calendar", label: "Agenda", icon: CalendarDays },
  { id: "retention", label: "Pós-venda", icon: Heart },
  { id: "finance", label: "Financeiro", icon: Wallet },
  { id: "cash", label: "Contas e DRE", icon: Wallet },
  { id: "suppliers", label: "Fornecedores", icon: Truck },
  { id: "tools", label: "Documentos e cadastros", icon: SlidersHorizontal },
];
type View = (typeof navigation)[number]["id"] | "settings" | "trash";
export function Workspace() {
  const w = useWorkspace();
  const s = w.state;
  const [view, setView] = useState<View>("today");
  const [navOpen, setNavOpen] = useState(false);
  const [createCompany, setCreateCompany] = useState(false);
  const [financeContact, setFinanceContact] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact>();
  const go = (v: View) => {
    setView(v);
    setNavOpen(false);
  };
  const changeCompany = async (id: string) => {
    setModal(null);
    setSelected(undefined);
    setFinanceContact("");
    setNavOpen(false);
    await w.selectCompany(id);
  };
  const searchClients = () => {
    go("clients");
    setTimeout(() => document.getElementById("client-search")?.focus(), 50);
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchClients();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  if (!s)
    return (
      <div className="loading">
        <Mascot />
        <p>{pt.loading}</p>
      </div>
    );
  const isDemo = s.tenant.id === "demo";
  const canWrite = s.role !== "viewer";
  const canManage = ["owner", "manager"].includes(s.role);
  const contacts = alive(s.contacts);
  const activities = alive(s.activities);
  const pending = activities
    .filter((a) => !a.done)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const contactName = (id: string | null) =>
    contacts.find((c) => c.id === id)?.name || "Sem cliente vinculado";
  const openCustomer = (id: string) => {
    const c = contacts.find((c) => c.id === id);
    if (c) {
      setSelected(c);
      setModal("detail");
    }
  };
  const newContact = () => {
    setSelected(undefined);
    setModal("contact");
  };
  const exportContacts = async () => {
    if (!canManage) return;
    let source = contacts as {
      name: string;
      phone: string;
      email: string;
      source: string;
    }[];
    if (!isDemo) {
      const { data, error } = await supabase().rpc(
        "atraction_export_contacts",
        { p_tenant: s.tenant.id },
      );
      if (error) {
        w.notify(ui.nao_conseguimos_exportar_confira_sua_conexao_e_tente_no);
        return;
      }
      source = data;
    }
    const csv = Papa.unparse(
      source.map((c) => ({
        nome: csvSafe(c.name),
        telefone: csvSafe(c.phone),
        email: csvSafe(c.email),
      })),
    );
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ion-cadastros.csv";
    a.click();
    URL.revokeObjectURL(url);
    w.notify(ui.planilha_exportada_guarde_em_um_lugar_seguro);
  };
  return (
    <div className={`app ${!s.tenant.animations ? "reduce-motion" : ""}`}>
      {navOpen && (
        <button
          className="nav-scrim"
          aria-label={ui.fechar_navegacao}
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <a href="/" className="brand" aria-label="ION — início">
          <img src="/icon.svg?v=ion" alt="" />
          {ui.atraction_2}
        </a>
        <CompanySelector
          w={w}
          onSelect={changeCompany}
          onCreate={() => {
            setCreateCompany(true);
            w.setAuthOpen(true);
            setNavOpen(false);
          }}
        />
        <span className="nav-label">{ui.seu_espaco}</span>
        <nav>
          {navigation
            .filter(
              (item) =>
                !["finance", "suppliers", "contracts", "cash"].includes(
                  item.id,
                ) ||
                canManage ||
                (w.allSelected &&
                  w.companies.some((c) =>
                    ["owner", "manager"].includes(c.role),
                  )),
            )
            .map((item) => (
              <button
                key={item.id}
                aria-current={view === item.id ? "page" : undefined}
                className={view === item.id ? "active" : ""}
                onClick={() => {
                  setFinanceContact("");
                  go(item.id);
                }}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <Mascot small />
            <strong>{ui.um_passo_de_cada_vez}</strong>
            <p>
              {ui.seu_negocio_pode_ir_longe}
              <br />
              {ui.a_gente_vai_junto}
            </p>
            <button onClick={() => setModal("help")}>
              {ui.conhecer_o_atraction}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="settings-link" onClick={() => go("settings")}>
            <Settings size={18} />
            {pt.settings}
          </button>
          <button
            className="profile"
            onClick={() => (isDemo ? w.setAuthOpen(true) : go("settings"))}
          >
            <Avatar name={isDemo ? ui.voce_aqui : s.tenant.name} small />
            <span>
              <strong>
                {isDemo
                  ? ui.seu_espaco_de_teste
                  : w.allSelected
                    ? "Todas as empresas"
                    : s.tenant.name}
              </strong>
              <small>
                {isDemo ? ui.explore_a_vontade : ui.conta_protegida}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={ui.abrir_navegacao}
            onClick={() => setNavOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            {ui.meu_espaco}
            <ChevronRight size={14} />
            <strong>
              {navigation.find((n) => n.id === view)?.label ||
                (view === "trash" ? ui.lixeira : ui.configuracoes)}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              aria-label="Buscar clientes"
              onClick={searchClients}
            >
              <Search size={17} />
              <span>{ui.buscar_no_seu_espaco}</span>
              <kbd>{ui.k}</kbd>
            </button>
            <span className="topbar-divider" />
            <button
              className="notification icon-button"
              aria-label={ui.ver_tarefas_pendentes}
              onClick={() => go("calendar")}
            >
              <Bell size={20} />
              {pending.length > 0 && <i />}
            </button>
            <Avatar name={s.tenant.name} small />
          </div>
        </header>
        <main key={w.selection || "demo"}>
          {w.switching ? (
            <div className="loading">
              <p>Carregando empresa…</p>
            </div>
          ) : w.allSelected && w.allState ? (
            <AllCompanies w={w} view={view} onSelect={changeCompany} />
          ) : (
            <>
              {isDemo && (
                <div className="demo-banner">
                  <span>
                    <span className="demo-dot" />
                    <strong>
                      {ui.voce_esta_explorando_uma_demonstracao}
                    </strong>{" "}
                    {ui.os_dados_sao_exemplos_e_ficam_neste_navegador}
                  </span>
                  <button onClick={() => w.setAuthOpen(true)}>
                    {ui.usar_com_meus_clientes}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {view === "today" && (
                <>
                  <SectionTitle
                    title="Seu negócio em dia"
                    subtitle="Clientes, contratos e finanças em um só lugar."
                  />
                  {canManage && <FinancialSummary rows={s.finance} />}
                  <div className="today-grid management-overview">
                    <section className="card today-card">
                      <h2>Clientes</h2>
                      <p>
                        {
                          contacts.filter((c) => c.lifecycle === "customer")
                            .length
                        }{" "}
                        clientes ativos
                      </p>
                      <CardLink onClick={() => go("clients")}>
                        Gerenciar clientes
                      </CardLink>
                    </section>
                    <section className="card today-card">
                      <h2>Agenda</h2>
                      <p>{pending.length} tarefas pendentes</p>
                      <CardLink onClick={() => go("calendar")}>
                        Abrir agenda
                      </CardLink>
                    </section>
                    {canManage && (
                      <section className="card today-card">
                        <h2>Contratos</h2>
                        <p>
                          {
                            alive(s.contracts).filter(
                              (c) => c.status === "active",
                            ).length
                          }{" "}
                          contratos ativos
                        </p>
                        <CardLink onClick={() => go("contracts")}>
                          Gerenciar contratos
                        </CardLink>
                      </section>
                    )}
                  </div>
                </>
              )}
              {view === "contracts" && canManage && (
                <Contracts
                  w={w}
                  onCustomer={openCustomer}
                  onFinance={(id) => {
                    setFinanceContact(id);
                    go("finance");
                  }}
                />
              )}
              {view === "retention" && (
                <Retention
                  w={w}
                  onCustomer={openCustomer}
                  onContracts={() => go("contracts")}
                />
              )}
              {view === "clients" && (
                <Clients
                  w={w}
                  onDetail={(c) => {
                    setSelected(c);
                    setModal("detail");
                  }}
                />
              )}
              {view === "finance" && canManage && (
                <Finance
                  key={financeContact}
                  w={w}
                  initialContact={financeContact}
                />
              )}
              {view === "cash" && canManage && <Cash w={w} />}
              {view === "tools" && <ToolsPanel w={w} />}

              {view === "suppliers" && canManage && <Suppliers w={w} />}

              {view === "calendar" && (
                <>
                  <SectionTitle
                    title={ui.espaco_na_agenda_leveza_na_cabeca}
                    subtitle="Seus próximos passos, organizados para nada ficar para trás."
                    action={
                      <button
                        className="primary"
                        onClick={() => setModal("task")}
                        disabled={!canWrite}
                      >
                        <Plus size={17} />
                        {ui.lembrar_de_algo}
                      </button>
                    }
                  />
                  <div className="agenda-layout">
                    <section className="card agenda-card">
                      <header>
                        <h2>{ui.seus_proximos_passos}</h2>
                        <span className="chip purple-chip">
                          {pending.length} {ui.pendentes}
                        </span>
                      </header>
                      {pending.map((a) => (
                        <div className="agenda-row" key={a.id}>
                          <div className="agenda-date">
                            <strong>{new Date(a.due_at).getDate()}</strong>
                            <span>
                              {new Date(a.due_at).toLocaleDateString("pt-BR", {
                                month: "short",
                              })}
                            </span>
                          </div>
                          <button
                            className="check-task"
                            aria-label={ui.concluir + a.title}
                            disabled={!canWrite || w.busy}
                            onClick={() =>
                              w.write("activities", { ...a, done: true })
                            }
                          >
                            <Check size={13} />
                          </button>
                          <div>
                            <strong>{a.title}</strong>
                            <p>
                              {contactName(a.contact_id)} {ui.text_7}
                              {new Date(a.due_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span
                            className={`chip ${a.kind === "appointment" ? "purple-chip" : "gray-chip"}`}
                          >
                            {a.kind === "appointment"
                              ? ui.compromisso
                              : ui.tarefa}
                          </span>
                          <button
                            className="icon-button"
                            disabled={!canWrite}
                            aria-label={ui.excluir + a.title}
                            onClick={() =>
                              w.write("activities", {
                                ...a,
                                deleted_at: new Date().toISOString(),
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {!pending.length && (
                        <Empty
                          title={ui.tudo_feito_respira_e_comemora}
                          text="Adicione seu próximo compromisso quando precisar."
                        />
                      )}
                      <details className="completed">
                        <summary>
                          <CheckCircle2 size={17} />
                          {ui.concluidos}
                          {activities.filter((a) => a.done).length}
                          {ui.text_6}
                        </summary>
                        {activities
                          .filter((a) => a.done)
                          .map((a) => (
                            <div key={a.id}>
                              <span>{a.title}</span>
                              <button
                                className="text-button"
                                disabled={!canWrite}
                                onClick={() =>
                                  w.write("activities", { ...a, done: false })
                                }
                              >
                                {ui.reabrir}
                              </button>
                            </div>
                          ))}
                      </details>
                    </section>
                    <aside className="agenda-tip">
                      <Mascot />
                      <h2>{ui.seu_dia_cabe_aqui}</h2>
                      <p>
                        {
                          ui.uma_tarefa_de_cada_vez_um_cliente_mais_perto_voce_esta_
                        }
                      </p>
                      <button
                        className="secondary"
                        onClick={() => setModal("task")}
                      >
                        {ui.planejar_meu_proximo_passo}
                        <Plus size={16} />
                      </button>
                    </aside>
                  </div>
                </>
              )}

              {view === "settings" && (
                <>
                  <SectionTitle
                    title={ui.um_espaco_com_a_sua_cara}
                    subtitle="O essencial para cuidar do negócio do seu jeito."
                  />
                  <div className="settings-grid">
                    <Team state={s} notify={w.notify} />
                    <section className="card settings-card">
                      <h2>{ui.seu_negocio}</h2>
                      <BusinessSettings w={w} />
                      <div className="setting-line">
                        <span>
                          <strong>{ui.animacoes_e_pequenos_momentos}</strong>
                          <small>{ui.um_toque_de_leveza_no_dia_a_dia}</small>
                        </span>
                        <button
                          className={
                            "toggle " + (s.tenant.animations ? "on" : "")
                          }
                          role="switch"
                          aria-checked={s.tenant.animations}
                          aria-label={ui.animacoes}
                          onClick={() =>
                            w.updateTenant({ animations: !s.tenant.animations })
                          }
                        >
                          <i />
                        </button>
                      </div>
                    </section>

                    <section className="card settings-card">
                      <h2>{ui.seus_dados_seu_controle}</h2>
                      {!isDemo && (
                        <button
                          className="secondary"
                          onClick={() => w.logout()}
                        >
                          Sair da conta
                        </button>
                      )}
                      <p>
                        {
                          ui.itens_excluidos_podem_ser_restaurados_por_ate_30_dias
                        }
                      </p>
                      <div className="button-row">
                        <button
                          className="secondary"
                          onClick={() => go("trash")}
                        >
                          <Trash2 size={16} />
                          {ui.abrir_lixeira}
                        </button>
                        {canManage && (
                          <button
                            className="secondary"
                            onClick={exportContacts}
                          >
                            <Download size={16} />
                            Exportar cadastros
                          </button>
                        )}
                      </div>
                      {isDemo && (
                        <div className="demo-controls">
                          <button
                            className="text-button"
                            onClick={() => {
                              w.setState(demo(s.tenant.niche));
                              w.notify(ui.demonstracao_reiniciada, async () => {
                                w.setState(s);
                                w.notify("Alteração desfeita.");
                              });
                            }}
                          >
                            {ui.recomecar_demonstracao}
                          </button>
                          <button
                            className="text-button danger"
                            onClick={() => {
                              w.setState({
                                ...s,
                                contacts: [],
                                deals: [],
                                activities: [],
                                messages: [],
                                events: [],
                                automations: [],
                                finance: [],
                                suppliers: [],
                                contracts: [],
                                documents: [],
                                accounts: [],
                                transfers: [],
                                segments: [],
                                chat_sessions: [],
                                chat_messages: [],
                              });
                              w.notify(
                                ui.exemplos_removidos_voce_pode_recomecar_a_demonstracao_n,
                              );
                            }}
                          >
                            {ui.limpar_exemplos}
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
              {view === "trash" && (
                <>
                  <SectionTitle
                    title={ui.mudou_de_ideia_tudo_bem}
                    subtitle="Restaure itens excluídos nos últimos 30 dias."
                  />
                  <section className="card trash-card">
                    {(
                      [
                        "contacts",
                        "deals",
                        "activities",
                        "messages",
                        "automations",
                        "finance",
                        "suppliers",
                        "documents",
                      ] as Collection[]
                    ).flatMap((c) =>
                      (s[c] as Row[])
                        .filter(
                          (r) =>
                            r.deleted_at &&
                            new Date(r.deleted_at).getTime() >
                              Date.now() - 30 * 86400000,
                        )
                        .map((r) => (
                          <div className="trash-row" key={r.id}>
                            <Trash2 size={18} />
                            <span>
                              <strong>
                                {"name" in r
                                  ? r.name
                                  : "title" in r
                                    ? r.title
                                    : "body" in r
                                      ? r.body
                                      : ui.item}
                              </strong>
                              <small>
                                {ui.excluido_em}
                                {new Date(r.deleted_at!).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </small>
                            </span>
                            <button
                              className="secondary"
                              disabled={!canWrite || w.busy}
                              onClick={() =>
                                w.write(c, { ...r, deleted_at: null })
                              }
                            >
                              {ui.restaurar}
                            </button>
                          </div>
                        )),
                    )}
                    {!(
                      [
                        "contacts",
                        "deals",
                        "activities",
                        "messages",
                        "automations",
                        "finance",
                        "suppliers",
                        "documents",
                      ] as Collection[]
                    ).some((c) => s[c].some((r) => r.deleted_at)) && (
                      <Empty
                        title={ui.nada_por_aqui}
                        text="O que for excluído aparecerá aqui por 30 dias."
                      />
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            {ui.atraction_2}
            <span className="purple"> {ui.text_5}</span>
          </span>
          <small>{ui.feito_para_aproximar}</small>
          <span className="status-dot">
            <i />
            {isDemo ? ui.demonstracao_local : ui.conectado_ao_seu_espaco}
          </span>
        </footer>
      </div>
      {w.notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{w.notice}</span>
          {w.undo && (
            <button
              onClick={async () => {
                const fn = w.undo;
                try {
                  await fn?.();
                } catch {
                  w.notify(pt.error);
                }
              }}
            >
              {ui.desfazer}
            </button>
          )}
        </div>
      )}
      {w.authOpen && (
        <Auth
          createCompany={createCompany}
          onClose={() => {
            w.setAuthOpen(false);
            setCreateCompany(false);
          }}
          onReady={async (id, companyId) => {
            setSelected(undefined);
            setFinanceContact("");
            setModal(null);
            setView("today");
            return w.read(id, companyId);
          }}
        />
      )}
      {modal === "contact" && (
        <ContactForm
          tenant={s.tenant}
          customer
          contact={selected}
          base={w.base}
          onSave={(r) => w.write("contacts", r)}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "task" && (
        <TaskForm
          state={s}
          base={w.base}
          onSave={(r) => w.write("activities", r)}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "detail" && selected && (
        <Modal title="Cadastro do cliente" onClose={() => setModal(null)} wide>
          <div className="contact-detail">
            <div className="detail-heading">
              <Avatar name={selected.name} />
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.phone}</p>
              </div>
              <button
                className="secondary"
                disabled={!canWrite}
                onClick={() => setModal("contact")}
              >
                Editar cliente
              </button>
            </div>
            <div className="tags">
              {selected.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <p className="management-hint">
              {selected.lifecycle === "customer"
                ? "Cliente ativo"
                : selected.lifecycle === "inactive"
                  ? "Cliente inativo"
                  : "Cadastro anterior"}
              {selected.document ? ` · ${selected.document}` : ""}
              {selected.address ? ` · ${selected.address}` : ""}
            </p>
            {canManage && (
              <section aria-label="Financeiro do cliente">
                <FinancialSummary
                  rows={s.finance.filter((f) => f.contact_id === selected.id)}
                />
                <button
                  className="secondary"
                  onClick={() => {
                    setFinanceContact(selected.id);
                    setModal(null);
                    go("finance");
                  }}
                >
                  Ver lançamentos deste cliente
                </button>
              </section>
            )}
            <Assignment
              contact={selected}
              state={s}
              onSave={async (r) => {
                const ok = await w.write("contacts", r);
                if (ok) setSelected(r);
                return ok;
              }}
            />
            <p className="detail-note">
              {selected.notes ||
                ui.anote_aqui_o_que_torna_esse_cliente_especial}
            </p>
            <CustomerHub w={w} id={selected.id} />
            <footer>
              <button
                className="text-button danger"
                disabled={!canWrite}
                onClick={async () => {
                  if (
                    await w.write("contacts", {
                      ...selected,
                      deleted_at: new Date().toISOString(),
                    })
                  )
                    setModal(null);
                }}
              >
                <Trash2 size={16} />
                {ui.mover_para_lixeira}
              </button>
            </footer>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title={ui.seu_negocio_mais_perto} onClose={() => setModal(null)}>
          <div className="form">
            <Mascot />
            <p>
              Organize as empresas e acompanhe sua operação pela visão geral.
            </p>
            <ol className="help-steps">
              <li>Cadastre seus clientes.</li>
              <li>Registre contratos e acompanhe vencimentos.</li>
              <li>Controle receitas, despesas e contas.</li>
              <li>Organize compromissos na agenda.</li>
            </ol>
            <button
              className="primary"
              onClick={() => {
                setModal(null);
                newContact();
              }}
            >
              {ui.vamos_comecar}
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
