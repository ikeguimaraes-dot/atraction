"use client";
import { ui } from "@/lib/pt-ui";
import { useEffect, useMemo, useState } from "react";
import {
  Home,
  FileText,
  Wallet,
  Truck,
  Users,
  GitBranch,
  MessageCircle,
  Bot,
  Magnet,
  BarChart3,
  CalendarDays,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Bell,
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock,
  MoreHorizontal,
  Upload,
  Download,
  Trash2,
  LogOut,
  Menu,
  X,
  Sparkles,
  CheckCheck,
  Send,
  Link2,
  Copy,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Heart,
  Target,
  Calendar,
  SlidersHorizontal,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";
import Papa from "papaparse";
import QRCode from "qrcode";
import { useWorkspace } from "@/lib/use-workspace";
import { alive, first, money, metrics, csvSafe } from "@/lib/domain";
import { demo } from "@/lib/demo";
import { niches, accountPack } from "@/data/niches";
import { pt } from "@/lib/pt";
import type {
  Contact,
  Deal,
  Activity,
  Automation,
  Collection,
  Row,
  Niche,
  State,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Avatar, Mascot, Empty, Modal, SectionTitle, CardLink } from "./ui";
import { Auth } from "./auth";
import { Clients, Finance, Suppliers, FinancialSummary } from "./management";
import { Contracts } from "./contracts";
import { CustomerHub } from "./customer-hub";
import { Priorities, Retention, Attribution, CampaignLink } from "./growth";
import { Cash } from "./cash";
import { ToolsPanel } from "./tools-panel";
import { SiteInbox } from "./site-chat";
import { Team } from "./team";
import { Assignment } from "./assignment";
import {
  ContactForm,
  DealForm,
  TaskForm,
  ImportForm,
  RobotForm,
} from "./forms";
const navigation = [
  { id: "tools", label: "Ferramentas", icon: SlidersHorizontal },
  { id: "cash", label: "Contas e DRE", icon: Wallet },
  { id: "today", label: pt.today, icon: Home },
  { id: "contacts", label: pt.contacts, icon: Users },
  { id: "deals", label: pt.deals, icon: GitBranch },
  { id: "messages", label: pt.messages, icon: MessageCircle },
  { id: "calendar", label: pt.calendar, icon: CalendarDays },
  { id: "automations", label: pt.automations, icon: Bot },
  { id: "capture", label: pt.capture, icon: Magnet },
  { id: "results", label: pt.results, icon: BarChart3 },
  { id: "clients", label: "Clientes", icon: Heart },
  { id: "contracts", label: "Contratos", icon: FileText },
  { id: "retention", label: "Pós-venda", icon: Heart },
  { id: "finance", label: "Financeiro", icon: Wallet },
  { id: "suppliers", label: "Fornecedores", icon: Truck },
];
type View = (typeof navigation)[number]["id"] | "settings" | "trash";
export function Workspace() {
  const w = useWorkspace();
  const s = w.state;
  const [pipelineId, setPipelineId] = useState("main");
  const [view, setView] = useState<View>("today");
  const [navOpen, setNavOpen] = useState(false);
  const [financeContact, setFinanceContact] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>(ui.todas);
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | undefined>();
  const [journeyDeal, setJourneyDeal] = useState<Deal>();
  const [wonOffer, setWonOffer] = useState<Deal>();
  const [deal, setDeal] = useState<Deal | undefined>();
  const [robot, setRobot] = useState<Automation | undefined>();
  const [conversation, setConversation] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(false);
  const [period, setPeriod] = useState(7);
  const [qr, setQr] = useState("");
  const [captureUrl, setCaptureUrl] = useState("");
  const contacts = useMemo(() => (s ? alive(s.contacts) : []), [s]);
  const deals = useMemo(() => (s ? alive(s.deals) : []), [s]);
  const activities = useMemo(() => (s ? alive(s.activities) : []), [s]);
  const messages = useMemo(() => (s ? alive(s.messages) : []), [s]);
  const go = (v: View) => {
    setView(v);
    setNavOpen(false);
    setQuery("");
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        go("contacts");
        setTimeout(() => document.getElementById("people-search")?.focus(), 50);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    if (s) {
      const url = window.location.origin + "/c/" + s.tenant.capture_slug;
      setCaptureUrl(url);
      QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: "#28213eff", light: "#ffffffff" },
      }).then(setQr);
    }
  }, [s?.tenant.capture_slug]);
  if (!s)
    return (
      <div className="loading">
        <Mascot />
        <p>{pt.loading}</p>
      </div>
    );
  const pack = accountPack(s.tenant);
  const pipeline = s.tenant.settings?.pipelines?.find(
    (p) => p.id === pipelineId,
  );
  const boardPack = pipeline
    ? { ...pack, name: pipeline.name, stages: pipeline.stages }
    : pack;
  const boardDeals = deals.filter(
    (d) => (d.pipeline_id || "main") === pipelineId,
  );
  const isDemo = s.tenant.id === "demo";
  const canWrite = s.role !== "viewer";
  const canManage = ["owner", "manager"].includes(s.role);
  const openCustomer = (id: string) => {
    const c = s.contacts.find((c) => c.id === id);
    if (c) {
      setSelected(c);
      setModal("detail");
    }
  };
  const writeDeal = async (d: Deal) => {
    const was = s.deals.find((x) => x.id === d.id);
    const ok = await w.write("deals", d);
    if (
      ok &&
      d.stage === 4 &&
      was?.stage !== 4 &&
      canManage &&
      !s.contracts.some((c) => c.deal_id === d.id)
    )
      setWonOffer(d);
    return ok;
  };

  const stats = metrics(s, period);
  const pending = activities
    .filter((a) => !a.done)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const unread = contacts.filter((c) => {
    const thread = messages
      .filter(
        (m) =>
          m.contact_id === c.id &&
          (m.direction === "in" || m.status === "sent"),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return thread[0]?.direction === "in";
  });
  const contactName = (id: string | null) =>
    contacts.find((c) => c.id === id)?.name || ui.sem_pessoa_vinculada;
  const newContact = () => {
    setSelected(undefined);
    setModal("contact");
  };
  const openConversation = (id: string) => {
    setConversation(id);
    setDraft("");
    go("messages");
  };
  const current = contacts.find((c) => c.id === conversation) || contacts[0];
  const filtered = contacts.filter(
    (c) =>
      (filter === ui.todas || c.source === filter) &&
      [c.name, c.phone, c.email, ...c.tags]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
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
        origem: csvSafe(c.source),
      })),
    );
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "atraction-pessoas.csv";
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
        <a href="/" className="brand">
          <img src="/icon.svg" alt="" />
          {ui.atraction_2}
        </a>
        <button className="workspace-switch" onClick={() => go("settings")}>
          <span className="business-icon">{pack.emoji}</span>
          <span>
            <strong>{s.tenant.name}</strong>
            <small>{pack.name}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <span className="nav-label">{ui.seu_espaco}</span>
        <nav>
          {navigation
            .filter(
              (item) =>
                !["finance", "suppliers", "contracts", "cash"].includes(
                  item.id,
                ) || canManage,
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
                {item.id === "messages" && unread.length > 0 && (
                  <b>{unread.length}</b>
                )}
                {item.id === "automations" && <i>{ui.novo}</i>}
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
              <strong>{isDemo ? ui.seu_espaco_de_teste : s.tenant.name}</strong>
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
              onClick={() => {
                go("contacts");
                setTimeout(
                  () => document.getElementById("people-search")?.focus(),
                  50,
                );
              }}
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
        <main>
          {isDemo && (
            <div className="demo-banner">
              <span>
                <span className="demo-dot" />
                <strong>{ui.voce_esta_explorando_uma_demonstracao}</strong>{" "}
                {ui.os_dados_sao_exemplos_e_ficam_neste_navegador}
              </span>
              <button onClick={() => w.setAuthOpen(true)}>
                {ui.usar_com_meus_clientes}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {wonOffer && canManage && (
            <section className="card journey-offer">
              <div>
                <strong>Venda ganha. Vamos cuidar do próximo passo?</strong>
                <p>
                  Transforme {wonOffer.title} em contrato, contas a receber e
                  pós-venda.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setJourneyDeal(wonOffer);
                  setWonOffer(undefined);
                  go("contracts");
                }}
              >
                Continuar jornada
              </button>
              <button
                className="text-button"
                onClick={() => setWonOffer(undefined)}
              >
                Depois
              </button>
            </section>
          )}
          {view === "contracts" && canManage && (
            <Contracts
              key={journeyDeal?.id || "contracts"}
              w={w}
              initialDeal={journeyDeal}
              onStarted={() => setJourneyDeal(undefined)}
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
          {view === "tools" && (
            <ToolsPanel w={w} onCustomer={(c) => openCustomer(c.id)} />
          )}
          {view === "messages" && <SiteInbox w={w} />}
          {view === "suppliers" && canManage && <Suppliers w={w} />}
          {view === "today" && (
            <>
              <div className="greeting">
                <div>
                  <div className="eyebrow">
                    <span className="sun">{ui.text_2}</span>{" "}
                    {ui.seu_negocio_em_boas_maos}
                  </div>
                  <h1>
                    {ui.um_bom_dia_para_crescer}
                    <span className="purple">{ui.text_3}</span>
                  </h1>
                  <p>
                    {ui.menos_coisas_na_cabeca_mais_tempo_para_quem_importa}
                  </p>
                </div>
                <div className="date-pill">
                  <Calendar size={16} />
                  {new Date().toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                  })}
                </div>
              </div>
              <Priorities
                w={w}
                onCustomer={openCustomer}
                onFinance={() => go("finance")}
                onContracts={() => go("contracts")}
                onDeals={() => go("deals")}
                onAgenda={() => go("calendar")}
              />
              <section className="welcome-card">
                <div className="welcome-copy">
                  <span className="pill light">
                    <Sparkles size={13} /> {ui.cada_conversa_e_um_comeco}
                  </span>
                  <h2>
                    {ui.seu_proximo_cliente}
                    <br />
                    {ui.pode_estar_a_um_oi_de_distancia}
                  </h2>
                  <p>
                    {ui.tem_gente_esperando_por_voce_vamos_fazer_o_dia_acontece}
                  </p>
                  <button
                    className="dark-button"
                    onClick={() =>
                      unread.length
                        ? openConversation(unread[0].id)
                        : newContact()
                    }
                  >
                    {unread.length
                      ? ui.vamos_conversar
                      : ui.conhecer_alguem_novo}
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="welcome-art" aria-hidden="true">
                  <span className="floating-message fm-one">
                    <span className="green-dot" />
                    {ui.oi_quero_saber_mais}
                  </span>
                  <span className="orbit orbit-one" />
                  <span className="orbit orbit-two" />
                  <Mascot />
                  <span className="art-spark spark-one">{ui.text_4}</span>
                  <span className="art-spark spark-two">{ui.text_5}</span>
                  <span className="floating-message fm-two">
                    <Heart size={15} />
                    {ui.mais_perto_de_conquistar}
                  </span>
                </div>
              </section>
              <div className="today-grid">
                <section className="card today-card">
                  <header>
                    <div className="card-icon lilac">
                      <MessageCircle size={20} />
                    </div>
                    <span className="chip purple-chip">
                      {unread.length} {ui.esperando}
                    </span>
                  </header>
                  <h2>{ui.responder_agora}</h2>
                  <p>{ui.uma_boa_conversa_muda_o_dia}</p>
                  <div className="today-list">
                    {unread.slice(0, 3).map((c) => {
                      const last = messages
                        .filter(
                          (m) => m.contact_id === c.id && m.direction === "in",
                        )
                        .sort((a, b) =>
                          b.created_at.localeCompare(a.created_at),
                        )[0];
                      return (
                        <button
                          className="person-row"
                          key={c.id}
                          onClick={() => openConversation(c.id)}
                        >
                          <Avatar name={c.name} small />
                          <span>
                            <strong>{c.name}</strong>
                            <small>{last?.body}</small>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      );
                    })}
                    {unread.length === 0 && (
                      <Empty
                        title={ui.todo_mundo_respondido}
                        text="Quando uma conversa chegar, ela aparece aqui."
                      />
                    )}
                  </div>
                  <CardLink onClick={() => go("messages")}>
                    {ui.abrir_conversas}
                  </CardLink>
                </section>
                <section className="card today-card">
                  <header>
                    <div className="card-icon peach">
                      <Clock size={20} />
                    </div>
                    <span className="chip amber-chip">
                      {
                        pending.filter(
                          (a) =>
                            new Date(a.due_at).getTime() <
                            Date.now() + 86400000,
                        ).length
                      }{" "}
                      {ui.para_cuidar}
                    </span>
                  </header>
                  <h2>{ui.dar_o_proximo_passo}</h2>
                  <p>{ui.pequenos_retornos_grandes_oportunidades}</p>
                  <div className="today-list">
                    {pending.slice(0, 3).map((a) => (
                      <div className="task-row" key={a.id}>
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
                        <span>
                          <strong>{a.title}</strong>
                          <small>{contactName(a.contact_id)}</small>
                        </span>
                        <span className="task-time">
                          {new Date(a.due_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                    {pending.length === 0 && (
                      <Empty
                        title={ui.dia_em_dia_voce_merece}
                        text="Sua lista está pronta para o próximo passo."
                      />
                    )}
                  </div>
                  <CardLink onClick={() => go("calendar")}>
                    {ui.ver_minha_agenda}
                  </CardLink>
                </section>
                <section className="card today-card wins-card">
                  <header>
                    <div className="card-icon mint">
                      <Target size={20} />
                    </div>
                    <span className="chip green-chip">{ui.ultimos_7_dias}</span>
                  </header>
                  <h2>{ui.motivos_para_comemorar}</h2>
                  <p>{ui.cada_conquista_conta_olha_as_suas}</p>
                  <div className="revenue">
                    {money(metrics(s).revenue)}
                    <span>{ui.em_negocios_conquistados}</span>
                  </div>
                  <div className="wins-detail">
                    <span>
                      <strong>{metrics(s).won}</strong>{" "}
                      {ui.clientes_conquistados}
                    </span>
                    <span className="mini-chart" aria-hidden="true">
                      {Array.from({ length: 7 }, (_, i) => {
                        const day = new Date(
                          Date.now() - (6 - i) * 86400000,
                        ).toLocaleDateString("pt-BR");
                        const n = s.events.filter(
                          (e) =>
                            e.kind === "won" &&
                            new Date(e.created_at).toLocaleDateString(
                              "pt-BR",
                            ) === day,
                        ).length;
                        return (
                          <i
                            key={i}
                            style={{ height: Math.min(100, 3 + n * 28) + "%" }}
                          />
                        );
                      })}
                    </span>
                  </div>
                  <CardLink onClick={() => go("results")}>
                    {ui.acompanhar_resultados}
                  </CardLink>
                </section>
              </div>
              <div className="quick-section">
                <div>
                  <h3>{ui.o_que_vamos_fazer_agora}</h3>
                  <p>{ui.o_essencial_sempre_por_perto}</p>
                </div>
                <div className="quick-actions">
                  <button onClick={newContact} disabled={!canWrite}>
                    <span className="lilac">
                      <Users size={19} />
                    </span>
                    {ui.adicionar_pessoa}
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setDeal(undefined);
                      setModal("deal");
                    }}
                    disabled={!canWrite}
                  >
                    <span className="mint">
                      <GitBranch size={19} />
                    </span>
                    {ui.criar_um_negocio}
                    <Plus size={16} />
                  </button>
                  <button onClick={() => setModal("task")} disabled={!canWrite}>
                    <span className="peach">
                      <CalendarDays size={19} />
                    </span>
                    {ui.lembrar_de_algo}
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="bottom-note">
                <span>{ui.text_5}</span>{" "}
                {ui.voce_cuida_dos_seus_clientes_a_gente_cuida_do_resto}
              </div>
            </>
          )}
          {view === "contacts" && (
            <>
              <SectionTitle
                title={ui.pessoas_nao_numeros}
                subtitle="Cada nome aqui é uma história que pode crescer com você."
                action={
                  <button
                    className="primary"
                    onClick={newContact}
                    disabled={!canWrite}
                  >
                    <Plus size={17} />
                    {pt.newContact}
                  </button>
                }
              />
              <div className="toolbar">
                <div className="search-input">
                  <Search size={18} />
                  <input
                    id="people-search"
                    placeholder={pt.search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label={ui.filtrar_por_origem}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    ui.todas,
                    ui.instagram,
                    ui.whatsapp,
                    ui.indicacao,
                    ui.site,
                    ui.planilha,
                    ui.pagina,
                    ui.cadastro,
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <button
                  className="secondary"
                  onClick={() => setModal("import")}
                  disabled={!canWrite}
                >
                  <Upload size={16} />
                  {ui.importar_2}
                </button>
                {canManage && (
                  <button
                    className="icon-button outlined"
                    aria-label={ui.exportar_pessoas}
                    onClick={exportContacts}
                  >
                    <Download size={18} />
                  </button>
                )}
              </div>
              <div className="card table-card">
                <div className="table-summary">
                  <strong>
                    {filtered.length} {ui.pessoas}
                  </strong>
                  <span>{ui.uma_oportunidade_em_cada_conversa}</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{ui.nome}</th>
                        <th>{ui.telefone_2}</th>
                        <th>{ui.como_chegou_2}</th>
                        <th>{ui.etiquetas_2}</th>
                        <th>{ui.ultimo_contato}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <button
                              className="table-name"
                              onClick={() => {
                                setSelected(c);
                                setModal("detail");
                              }}
                            >
                              <Avatar name={c.name} />
                              <span>
                                <strong>{c.name}</strong>
                                <small>
                                  {c.email || ui.vamos_conhecer_melhor}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>{c.phone}</td>
                          <td>
                            <span className="source-chip">{c.source}</span>
                          </td>
                          <td>
                            <div className="tags">
                              {c.tags.filter(Boolean).map((t) => (
                                <span key={t}>{t}</span>
                              ))}
                            </div>
                          </td>
                          <td className="muted">
                            {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={ui.conversar_com + c.name}
                              onClick={() => openConversation(c.id)}
                            >
                              <MessageCircle size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <Empty
                    title={
                      query
                        ? ui.nenhuma_pessoa_encontrada
                        : ui.sua_primeira_pessoa_faz_toda_a_diferenca
                    }
                    text={
                      query
                        ? ui.tente_outro_nome_ou_telefone
                        : ui.exemplo_cadastre_alguem_que_pediu_informacoes_sobre_seu
                    }
                    action={
                      !query && (
                        <button className="primary" onClick={newContact}>
                          {ui.adicionar_minha_primeira_pessoa}
                        </button>
                      )
                    }
                  />
                )}
              </div>
            </>
          )}
          {view === "deals" && (
            <>
              <SectionTitle
                title={ui.de_um_primeiro_oi_a_uma_conquista}
                subtitle="Veja onde cada conversa está. E qual é o próximo passo."
                action={
                  <button
                    className="primary"
                    disabled={!canWrite}
                    onClick={() => {
                      setDeal(undefined);
                      setModal("deal");
                    }}
                  >
                    <Plus size={17} />
                    {ui.novo_negocio}
                  </button>
                }
              />
              <label className="pipeline-picker">
                Funil
                <select
                  value={pipelineId}
                  onChange={(e) => setPipelineId(e.target.value)}
                >
                  <option value="main">Principal · {pack.name}</option>
                  {(s.tenant.settings?.pipelines || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="path-summary">
                <span className="pill">
                  <span className="green-dot" />
                  {boardPack.name}
                </span>
                <span>
                  <strong>
                    {boardDeals.filter((d) => d.stage !== -1).length}
                  </strong>{" "}
                  {ui.negocios_no_caminho}
                </span>
                <span>
                  <strong>
                    {money(
                      boardDeals
                        .filter((d) => d.stage >= 0 && d.stage < 4)
                        .reduce((n, d) => n + Number(d.value), 0),
                    )}
                  </strong>{" "}
                  {ui.em_oportunidades}
                </span>
                <small>{ui.arraste_um_cartao_ou_escolha_a_etapa}</small>
              </div>
              <div className="kanban">
                {boardPack.stages.map((stage, i) => {
                  const rows = boardDeals.filter((d) => d.stage === i);
                  return (
                    <section
                      className={"kanban-column stage-" + i}
                      key={stage}
                      onDragOver={(e) => {
                        if (canWrite) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const d = deals.find(
                          (d) => d.id === e.dataTransfer.getData("text/plain"),
                        );
                        if (d && canWrite) writeDeal({ ...d, stage: i });
                      }}
                    >
                      <header>
                        <span className="stage-dot" />
                        <h3>{stage}</h3>
                        <b>{rows.length}</b>
                        <button
                          className="icon-button"
                          aria-label={ui.adicionar_em + stage}
                          onClick={() => {
                            setDeal({
                              ...w.base(),
                              contact_id: contacts[0]?.id || "",
                              title: boardPack.service,
                              value: 0,
                              stage: i,
                              loss_reason: "",
                            });
                            setModal("deal");
                          }}
                          disabled={!canWrite}
                        >
                          <Plus size={16} />
                        </button>
                      </header>
                      <p className="column-value">
                        {money(rows.reduce((n, d) => n + Number(d.value), 0))}
                      </p>
                      {rows.map((d) => (
                        <article
                          className="deal-card"
                          key={d.id}
                          draggable={canWrite}
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", d.id)
                          }
                        >
                          <button
                            className="deal-title"
                            onClick={() => {
                              setDeal(d);
                              setModal("deal");
                            }}
                          >
                            {d.title}
                            <MoreHorizontal size={17} />
                          </button>
                          <span className="deal-person">
                            <Avatar name={contactName(d.contact_id)} small />
                            {contactName(d.contact_id)}
                          </span>
                          <strong className="deal-value">
                            {money(d.value)}
                          </strong>
                          {d.stage === 4 &&
                            canManage &&
                            !s.contracts.some((c) => c.deal_id === d.id) && (
                              <button
                                className="secondary"
                                onClick={() => {
                                  setJourneyDeal(d);
                                  go("contracts");
                                }}
                              >
                                Criar contrato e cobranças
                              </button>
                            )}
                          <div className="deal-footer">
                            <span>
                              <Clock size={12} />
                              {Math.floor(
                                (Date.now() -
                                  new Date(d.updated_at).getTime()) /
                                  86400000,
                              )}
                              {ui.d_nesta_etapa}
                            </span>
                            <button
                              className="icon-button"
                              aria-label={ui.conversar_sobre + d.title}
                              onClick={() => openConversation(d.contact_id)}
                            >
                              <MessageCircle size={14} />
                            </button>
                          </div>
                          <select
                            aria-label={ui.etapa_de + contactName(d.contact_id)}
                            value={d.stage}
                            disabled={!canWrite || w.busy}
                            onChange={(e) =>
                              writeDeal({
                                ...d,
                                stage: Number(e.target.value),
                              })
                            }
                          >
                            {boardPack.stages.map((s, i) => (
                              <option key={s} value={i}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </article>
                      ))}
                      {!rows.length && (
                        <div className="kanban-empty">
                          {ui.um_espaco_para_a_proxima_oportunidade}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
              {deals.some((d) => d.stage === -1) && (
                <details className="lost-deals">
                  <summary>
                    {ui.nao_foi_desta_vez_2}
                    {boardDeals.filter((d) => d.stage === -1).length}
                    {ui.text_6}
                  </summary>
                  {boardDeals
                    .filter((d) => d.stage === -1)
                    .map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setDeal(d);
                          setModal("deal");
                        }}
                      >
                        {contactName(d.contact_id)} {ui.text_7}
                        {d.loss_reason}
                      </button>
                    ))}
                </details>
              )}
            </>
          )}
          {view === "messages" && (
            <>
              <SectionTitle
                title="Rascunhos e notas internas"
                subtitle="Todo o contexto, bem perto. Nenhum cliente esquecido."
              />
              <div className="integration-notice">
                <MessageCircle size={18} />
                <span>
                  <strong>
                    {isDemo
                      ? ui.conversas_de_exemplo
                      : ui.whatsapp_ainda_nao_conectado}
                  </strong>{" "}
                  {ui.text_7}
                  {isDemo
                    ? ui.explore_a_caixa_e_teste_seus_rascunhos
                    : ui.as_respostas_sao_salvas_como_rascunho_nenhuma_mensagem_}
                </span>
                <button onClick={() => go("settings")}>
                  {ui.ver_conexao}
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="inbox card">
                <aside className="thread-list">
                  <div className="inbox-search">
                    <Search size={16} />
                    <input
                      aria-label={ui.buscar_conversa}
                      placeholder={ui.buscar_conversa}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="thread-label">
                    {ui.todas_as_conversas}
                    <span>{contacts.length}</span>
                  </div>
                  {contacts
                    .filter((c) =>
                      c.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((c) => {
                      const thread = messages
                        .filter((m) => m.contact_id === c.id)
                        .sort((a, b) =>
                          b.created_at.localeCompare(a.created_at),
                        );
                      return (
                        <button
                          className={`thread ${current?.id === c.id ? "selected" : ""}`}
                          key={c.id}
                          onClick={() => {
                            setConversation(c.id);
                            setDraft("");
                          }}
                        >
                          <Avatar name={c.name} />
                          <span>
                            <strong>{c.name}</strong>
                            <small>
                              {thread[0]?.body || ui.comece_uma_boa_conversa}
                            </small>
                          </span>
                          {unread.some((u) => u.id === c.id) && <i />}
                        </button>
                      );
                    })}
                </aside>
                <section className="conversation">
                  {current ? (
                    <>
                      <header>
                        <Avatar name={current.name} />
                        <span>
                          <strong>{current.name}</strong>
                          <small>
                            <span className="green-dot" />
                            {isDemo
                              ? ui.conversa_de_exemplo
                              : ui.rascunhos_e_notas_internas}
                          </small>
                        </span>
                        <button
                          className="icon-button"
                          aria-label={ui.ver_pessoa}
                          onClick={() => {
                            setSelected(current);
                            setModal("detail");
                          }}
                        >
                          <Users size={18} />
                        </button>
                      </header>
                      <div className="message-area">
                        <div className="chat-date">
                          {ui.sua_historia_com}
                          {first(current.name)}
                        </div>
                        {messages
                          .filter((m) => m.contact_id === current.id)
                          .sort((a, b) =>
                            a.created_at.localeCompare(b.created_at),
                          )
                          .map((m) => (
                            <div
                              key={m.id}
                              className={"message " + m.direction}
                            >
                              <p>{m.body}</p>
                              <span>
                                {m.direction === "note"
                                  ? ui.nota_interna
                                  : m.status === "draft"
                                    ? ui.rascunho
                                    : ""}
                                {new Date(m.created_at).toLocaleTimeString(
                                  "pt-BR",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                                {m.direction === "out" && <Check size={12} />}
                              </span>
                            </div>
                          ))}
                        {!messages.some((m) => m.contact_id === current.id) && (
                          <Empty
                            title={ui.uma_nova_conversa_comeca_aqui}
                            text="Use um modelo para preparar sua primeira mensagem."
                          />
                        )}
                      </div>
                      <div className="composer">
                        <div className="composer-tabs">
                          <button
                            className={!note ? "active" : ""}
                            onClick={() => setNote(false)}
                          >
                            {ui.resposta}
                          </button>
                          <button
                            className={note ? "active" : ""}
                            onClick={() => setNote(true)}
                          >
                            {ui.nota_interna_2}
                          </button>
                          <button
                            className="quick-reply"
                            onClick={() =>
                              setDraft(
                                pack.message.replace(
                                  "{nome}",
                                  first(current.name),
                                ),
                              )
                            }
                          >
                            <Sparkles size={14} />
                            {ui.usar_modelo}
                          </button>
                        </div>
                        <textarea
                          aria-label={
                            note
                              ? ui.escrever_nota_interna
                              : ui.escrever_resposta
                          }
                          placeholder={
                            note
                              ? ui.uma_anotacao_so_para_sua_equipe
                              : ui.escreva_com_seu_jeito_uma_boa_conversa_aproxima
                          }
                          value={draft}
                          maxLength={10000}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <footer>
                          <span>
                            <LockKeyhole size={13} />
                            {note
                              ? ui.so_sua_equipe_pode_ver
                              : ui.nenhum_envio_externo_ativado}
                          </span>
                          <button
                            className="primary"
                            disabled={!draft.trim() || w.busy || !canWrite}
                            onClick={async () => {
                              if (
                                await w.write("messages", {
                                  ...w.base(),
                                  contact_id: current.id,
                                  body: draft.trim(),
                                  direction: note ? "note" : "out",
                                  status: "draft",
                                })
                              )
                                setDraft("");
                            }}
                          >
                            {note ? ui.salvar_nota : ui.salvar_rascunho}
                            <Send size={15} />
                          </button>
                        </footer>
                      </div>
                    </>
                  ) : (
                    <Empty
                      title={ui.quem_vai_ser_a_primeira_conversa}
                      action={
                        <button className="primary" onClick={newContact}>
                          {ui.adicionar_pessoa}
                        </button>
                      }
                    />
                  )}
                </section>
              </div>
            </>
          )}
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
                        {a.kind === "appointment" ? ui.compromisso : ui.tarefa}
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
                    {ui.uma_tarefa_de_cada_vez_um_cliente_mais_perto_voce_esta_}
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
          {view === "automations" && (
            <>
              <SectionTitle
                title={ui.uma_maozinha_que_faz_diferenca}
                subtitle="Pequenos robôs cuidam dos lembretes. Você cuida das pessoas."
                action={
                  <button
                    className="primary"
                    disabled={!canManage}
                    onClick={() => {
                      setRobot(undefined);
                      setModal("robot");
                    }}
                  >
                    <Plus size={17} />
                    {ui.criar_robo}
                  </button>
                }
              />
              <div className="robot-intro">
                <div className="card-icon lilac">
                  <Bot size={25} />
                </div>
                <div>
                  <strong>
                    {ui.simples_assim_quando_acontecer_isto_espere_e_faca_aquil}
                  </strong>
                  <p>
                    {ui.os_robos_criam_tarefas_a_fila_e_processada_a_cada_minut}
                  </p>
                </div>
                <span className="pill">{ui.sem_custo_de_envio}</span>
              </div>
              <div className="robot-grid">
                {(alive(s.automations).length
                  ? alive(s.automations)
                  : pack.robots.map((name, i) => ({
                      ...w.base(),
                      name,
                      trigger:
                        i === 1
                          ? ("deal_stale" as const)
                          : ("contact_created" as const),
                      delay_hours: [0, 24, 720][i],
                      action: "create_task" as const,
                      enabled: false,
                    }))
                ).map((r, i) => (
                  <article className="card robot-card" key={r.id}>
                    <header>
                      <div
                        className={
                          "card-icon " + ["lilac", "peach", "mint"][i % 3]
                        }
                      >
                        {i % 3 === 0 ? (
                          <Heart size={22} />
                        ) : i % 3 === 1 ? (
                          <Clock size={22} />
                        ) : (
                          <RefreshCw size={22} />
                        )}
                      </div>
                      <span
                        className={
                          "chip " + (r.enabled ? "green-chip" : "gray-chip")
                        }
                      >
                        {r.enabled ? ui.ligado : ui.desligado}
                      </span>
                    </header>
                    <h2>{r.name}</h2>
                    <p>
                      {r.trigger === "contact_created"
                        ? ui.quando_uma_pessoa_nova_chegar_ajude_sua_equipe_a_dar_o_
                        : ui.quando_um_negocio_ficar_parado_lembre_sua_equipe_de_ret}
                    </p>
                    <div className="robot-recipe">
                      <span>
                        <span>{ui["1"]}</span>
                        {r.trigger === "contact_created"
                          ? ui.uma_pessoa_chega
                          : ui.um_negocio_fica_parado}
                      </span>
                      <ChevronDown size={14} />
                      <span>
                        <span>{ui["2"]}</span>
                        {ui.esperar}
                        {r.delay_hours} {ui.horas}
                      </span>
                      <ChevronDown size={14} />
                      <span>
                        <span>{ui["3"]}</span>
                        {ui.criar_uma_tarefa_de_retorno}
                      </span>
                    </div>
                    <footer>
                      <button
                        className="text-button"
                        onClick={() => {
                          setRobot(r);
                          setModal("robot");
                        }}
                        disabled={!canManage}
                      >
                        {ui.personalizar}
                        <SlidersHorizontal size={14} />
                      </button>
                      <button
                        className={"toggle " + (r.enabled ? "on" : "")}
                        role="switch"
                        aria-checked={r.enabled}
                        aria-label={ui.ativar + r.name}
                        disabled={!canManage || w.busy}
                        onClick={() => {
                          if (r.enabled)
                            w.write("automations", { ...r, enabled: false });
                          else {
                            setRobot(r);
                            setModal("activate");
                          }
                        }}
                      >
                        <i />
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
              <div className="subtle-note">
                <ShieldCheck size={17} />
                {ui.voce_esta_no_comando_nenhum_robo_envia_mensagens_ou_con}
              </div>
            </>
          )}
          {view === "capture" && (
            <>
              <SectionTitle
                title={ui.abra_a_porta_para_novos_clientes}
                subtitle="Um link, uma boa conversa e muitas possibilidades."
              />
              <div className="capture-layout">
                <section className="card capture-editor">
                  <span className="pill purple-chip">
                    <Magnet size={14} />
                    {ui.sua_pagina_de_captacao}
                  </span>
                  <h2>{ui.o_primeiro_oi_fica_mais_facil}</h2>
                  <p>
                    {ui.compartilhe_seu_link_no_instagram_nas_redes_ou_no_balca}
                  </p>
                  <form
                    className="form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await w.updateTenant({
                        capture_title: String(f.get("title")),
                        capture_enabled: true,
                      });
                    }}
                  >
                    <label>
                      {ui.convide_com_o_seu_jeito}
                      <input
                        name="title"
                        maxLength={160}
                        defaultValue={s.tenant.capture_title}
                        required
                      />
                    </label>
                    <div className="link-display">
                      <Link2 size={17} />
                      <input
                        aria-label={ui.link_da_pagina}
                        readOnly
                        value={captureUrl}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={ui.copiar_link}
                        onClick={() =>
                          navigator.clipboard
                            .writeText(captureUrl)
                            .then(() => w.notify(ui.link_copiado))
                            .catch(() =>
                              w.notify(
                                ui.selecione_o_link_e_copie_para_compartilhar,
                              ),
                            )
                        }
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <button
                      className="primary"
                      disabled={s.role !== "owner" || isDemo}
                    >
                      {s.tenant.capture_enabled
                        ? ui.salvar_pagina
                        : ui.ativar_minha_pagina}
                      <ArrowUpRight size={16} />
                    </button>
                    {isDemo && (
                      <p className="muted">
                        {ui.entre_na_sua_conta_para_ativar_uma_pagina_real}
                      </p>
                    )}
                  </form>
                  {s.tenant.capture_enabled && (
                    <button
                      className="text-button danger"
                      onClick={() => w.updateTenant({ capture_enabled: false })}
                    >
                      {ui.pausar_pagina}
                    </button>
                  )}
                  <div className="qr-block">
                    {qr && (
                      <img src={qr} alt={ui.qr_code_da_pagina_de_captacao} />
                    )}
                    <div>
                      <h3>{ui.do_mundo_real_para_uma_conversa}</h3>
                      <p>
                        {
                          ui.coloque_seu_qr_no_balcao_ou_no_cartao_do_seu_negocio
                        }
                      </p>
                      {qr && (
                        <a
                          className="text-button"
                          href={qr}
                          download="atraction-qr.png"
                        >
                          <Download size={15} />
                          {ui.baixar_qr_code}
                        </a>
                      )}
                    </div>
                  </div>
                </section>
                <aside className="capture-preview">
                  <span>{ui.assim_seus_clientes_vao_ver}</span>
                  <div className="phone-preview">
                    <div className="phone-notch" />
                    <span className="business-icon">{pack.emoji}</span>
                    <small>{s.tenant.name}</small>
                    <h2>{s.tenant.capture_title}</h2>
                    <p>
                      {ui.deixe_seu_nome_e_telefone_vamos_adorar_conhecer_voce}
                    </p>
                    <div className="fake-input">{ui.seu_nome}</div>
                    <div className="fake-input">{ui.seu_telefone}</div>
                    <div className="fake-consent">
                      <Check size={12} />
                      {ui.quero_receber_um_contato_deste_negocio}
                    </div>
                    <div className="primary">
                      {ui.quero_saber_mais}
                      <ArrowRight size={14} />
                    </div>
                    <small className="powered">
                      {ui.feito_com_no_atraction}
                    </small>
                  </div>
                  {s.tenant.capture_enabled && (
                    <a
                      href={captureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-button"
                    >
                      {ui.abrir_minha_pagina}
                      <ExternalLink size={14} />
                    </a>
                  )}
                </aside>
              </div>
            </>
          )}
          {view === "capture" && <CampaignLink url={captureUrl} w={w} />}
          {view === "results" && <Attribution w={w} />}
          {view === "results" && (
            <>
              <SectionTitle
                title={ui.seu_esforco_esta_virando_historia}
                subtitle="Os números que importam. Sem complicar o que é simples."
                action={
                  <select
                    aria-label={ui.periodo_dos_resultados}
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                  >
                    <option value={7}>{ui.ultimos_7_dias}</option>
                    <option value={30}>{ui.ultimos_30_dias}</option>
                    <option value={90}>{ui.ultimos_90_dias}</option>
                  </select>
                }
              />
              <div className="stats-grid">
                {[
                  {
                    label: ui.pessoas_chegaram,
                    value: stats.entered,
                    icon: Users,
                    color: "lilac",
                  },
                  {
                    label: ui.comecaram_uma_conversa,
                    value: stats.talked,
                    icon: MessageCircle,
                    color: "blue",
                  },
                  {
                    label: ui.clientes_conquistados_2,
                    value: stats.won,
                    icon: Heart,
                    color: "peach",
                  },
                  {
                    label: ui.em_negocios_conquistados_2,
                    value: money(stats.revenue),
                    icon: BarChart3,
                    color: "mint",
                  },
                ].map((k) => (
                  <div className="card stat-card" key={k.label}>
                    <div className={"card-icon " + k.color}>
                      <k.icon size={21} />
                    </div>
                    <strong>{k.value}</strong>
                    <p>{k.label}</p>
                    <small>{ui.neste_periodo}</small>
                  </div>
                ))}
              </div>
              <div className="results-grid">
                <section className="card chart-card">
                  <header>
                    <h2>{ui.de_onde_vem_suas_pessoas}</h2>
                    <span className="muted">{ui.neste_periodo}</span>
                  </header>
                  {Object.entries(
                    s.events
                      .filter(
                        (e) =>
                          e.entity === "contacts" &&
                          e.kind === ui.insert &&
                          new Date(e.created_at).getTime() >=
                            Date.now() - period * 86400000,
                      )
                      .reduce(
                        (acc, e) => {
                          const key = String(e.payload.source || ui.cadastro);
                          acc[key] = (acc[key] || 0) + 1;
                          return acc;
                        },
                        {} as Record<string, number>,
                      ),
                  )
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, n], i) => (
                      <div className="bar-row" key={source}>
                        <div>
                          <span>{source}</span>
                          <strong>
                            {n} {ui.pessoas}
                          </strong>
                        </div>
                        <div className="bar-track">
                          <i
                            style={{
                              width:
                                Math.max(
                                  5,
                                  (n / Math.max(stats.entered, 1)) * 100,
                                ) + "%",
                              background: [
                                "#8b72ec",
                                "#b9a7f6",
                                "#d0c3f9",
                                "#a4d2c2",
                              ][i % 4],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  {!stats.entered && (
                    <Empty
                      title={ui.os_proximos_numeros_comecam_com_voce}
                      text="Cadastre uma pessoa para começar a acompanhar suas origens."
                    />
                  )}
                </section>
                <section className="card chart-card">
                  <header>
                    <h2>{ui.seu_caminho_agora}</h2>
                    <GitBranch size={18} />
                  </header>
                  {pack.stages.map((name, i) => {
                    const n = deals.filter((d) => d.stage === i).length;
                    return (
                      <div className="funnel-row" key={name}>
                        <span className={"funnel-number stage-" + i}>
                          {i + 1}
                        </span>
                        <span>{name}</span>
                        <strong>{n}</strong>
                      </div>
                    );
                  })}
                  <p className="muted">
                    {ui.fotografia_dos_negocios_atuais_as_conquistas_acima_segu}
                  </p>
                </section>
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
                  <form
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      w.updateTenant({ name: String(f.get("name")) });
                    }}
                  >
                    <label>
                      {ui.nome_do_negocio}
                      <input
                        name="name"
                        defaultValue={s.tenant.name}
                        maxLength={160}
                        required
                      />
                    </label>
                    <label>
                      {ui.seu_nicho}
                      <select
                        value={s.tenant.niche}
                        disabled={!isDemo}
                        onChange={(e) => {
                          w.setState(demo(e.target.value as Niche));
                          w.notify(ui.novo_exemplo_preparado_para_voce);
                        }}
                      >
                        {Object.entries(niches).map(([k, n]) => (
                          <option key={k} value={k}>
                            {n.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="primary" disabled={s.role !== "owner"}>
                      {ui.salvar_alteracoes}
                    </button>
                  </form>
                  <div className="setting-line">
                    <span>
                      <strong>{ui.animacoes_e_pequenos_momentos}</strong>
                      <small>{ui.um_toque_de_leveza_no_dia_a_dia}</small>
                    </span>
                    <button
                      className={"toggle " + (s.tenant.animations ? "on" : "")}
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
                  <h2>{ui.conexoes_e_seguranca}</h2>
                  <div className="connection-row">
                    <span className="card-icon mint">
                      <MessageCircle size={20} />
                    </span>
                    <div>
                      <strong>{ui.whatsapp_oficial}</strong>
                      <p>{ui.nao_conectado_nenhum_envio_cobrado}</p>
                    </div>
                    <LockKeyhole size={16} />
                  </div>
                  <p className="muted">
                    {ui.a_conexao_exige_credenciais_da_whatsapp_business_platfo}
                  </p>
                  <div className="connection-row">
                    <span className="card-icon lilac">
                      <Sparkles size={20} />
                    </span>
                    <div>
                      <strong>{ui.assistencia_com_ia}</strong>
                      <p>{ui.modelos_prontos_sem_chamadas_pagas}</p>
                    </div>
                    <LockKeyhole size={16} />
                  </div>
                  <div className="connection-row">
                    <span className="card-icon blue">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <strong>
                        {isDemo
                          ? ui.conta_real_protegida_por_dois_fatores
                          : ui.verificacao_em_dois_fatores_ativa}
                      </strong>
                      <p>
                        {isDemo
                          ? ui.crie_sua_conta_para_guardar_seus_clientes
                          : ui.seus_dados_sao_isolados_por_negocio}
                      </p>
                    </div>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => (isDemo ? w.setAuthOpen(true) : w.logout())}
                  >
                    {isDemo ? ui.entrar_na_minha_conta : ui.sair_da_conta}
                    <LogOut size={16} />
                  </button>
                </section>
                <section className="card settings-card">
                  <h2>{ui.seus_dados_seu_controle}</h2>
                  <p>
                    {ui.itens_excluidos_podem_ser_restaurados_por_ate_30_dias}
                  </p>
                  <div className="button-row">
                    <button className="secondary" onClick={() => go("trash")}>
                      <Trash2 size={16} />
                      {ui.abrir_lixeira}
                    </button>
                    {canManage && (
                      <button className="secondary" onClick={exportContacts}>
                        <Download size={16} />
                        {ui.exportar_pessoas}
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
                          onClick={() => w.write(c, { ...r, deleted_at: null })}
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
        <Auth onClose={() => w.setAuthOpen(false)} onReady={w.read} />
      )}
      {modal === "contact" && (
        <ContactForm
          tenant={s.tenant}
          contact={selected}
          base={w.base}
          onSave={(r) => w.write("contacts", r)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "deal" && (
        <DealForm
          pipelineId={pipelineId}
          deal={deal}
          state={s}
          base={w.base}
          onSave={writeDeal}
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
      {modal === "import" && (
        <ImportForm
          state={s}
          base={w.base}
          onSave={(r) => w.bulk("contacts", r)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "robot" && (
        <RobotForm
          robot={robot}
          state={s}
          base={w.base}
          onSave={(r) => w.write("automations", r)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "activate" && robot && (
        <Modal
          title={ui.veja_o_que_seu_robo_vai_fazer}
          onClose={() => setModal(null)}
        >
          <div className="form">
            <div className="card-icon lilac">
              <Bot size={24} />
            </div>
            <h3>{robot.name}</h3>
            <p>
              {robot.trigger === "contact_created"
                ? ui.para_cada_nova_pessoa_cadastrada_a_partir_da_ativacao
                : ui.para_cada_negocio_parado_alem_do_tempo_escolhido}
              {ui.criar_uma_tarefa_apos}
              {robot.delay_hours} {ui.horas_2}
            </p>
            <div className="inline-notice">
              {robot.trigger === "contact_created"
                ? ui.exemplo_com_sua_conta_a_proxima_pessoa_recebera_um_lemb
                : `${deals.filter((d) => d.stage >= 0 && d.stage < 4 && new Date(d.updated_at).getTime() < Date.now() - robot.delay_hours * 3600000).length} negócios atuais atendem ao tempo escolhido.`}
            </div>
            <p>{ui.nenhuma_mensagem_sera_enviada_os_lembretes_sao_processa}</p>
            <footer>
              <button className="secondary" onClick={() => setModal(null)}>
                {ui.agora_nao}
              </button>
              <button
                className="primary"
                disabled={w.busy}
                onClick={async () => {
                  if (await w.write("automations", { ...robot, enabled: true }))
                    setModal(null);
                }}
              >
                {ui.ativar_robo}
                <Check size={16} />
              </button>
            </footer>
          </div>
        </Modal>
      )}
      {modal === "detail" && selected && (
        <Modal
          title={ui.cada_pessoa_tem_uma_historia}
          onClose={() => setModal(null)}
          wide
        >
          <div className="contact-detail">
            <div className="detail-heading">
              <Avatar name={selected.name} />
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.phone} {ui.text_7}
                  {selected.source}
                </p>
              </div>
              <button
                className="secondary"
                disabled={!canWrite}
                onClick={() => setModal("contact")}
              >
                {ui.editar_pessoa}
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
                  : "Interessado"}
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
            <div className="detail-stats">
              <span>
                <strong>
                  {deals.filter((d) => d.contact_id === selected.id).length}
                </strong>{" "}
                {ui.negocios}
              </span>
              <span>
                <strong>
                  {money(
                    deals
                      .filter(
                        (d) => d.contact_id === selected.id && d.stage === 4,
                      )
                      .reduce((n, d) => n + Number(d.value), 0),
                  )}
                </strong>{" "}
                {ui.conquistados}
              </span>
              <span className="muted">
                {selected.consent
                  ? ui.autorizacao_registrada
                  : ui.sem_autorizacao_para_disparos}
              </span>
            </div>
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
              <button
                className="primary"
                onClick={() => {
                  openConversation(selected.id);
                  setModal(null);
                }}
              >
                {ui.abrir_conversa}
                <MessageCircle size={16} />
              </button>
            </footer>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title={ui.seu_negocio_mais_perto} onClose={() => setModal(null)}>
          <div className="form">
            <Mascot />
            <p>{ui.comece_pela_tela_hoje_ela_mostra_quem_espera_uma_respos}</p>
            <ol className="help-steps">
              <li>{ui.adicione_uma_pessoa_com_nome_e_telefone}</li>
              <li>{ui.crie_um_negocio_e_acompanhe_cada_etapa}</li>
              <li>{ui.prepare_respostas_e_anote_o_que_combinaram}</li>
              <li>{ui.use_a_agenda_e_os_robos_para_lembrar_de_voltar}</li>
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
