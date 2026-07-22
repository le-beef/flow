import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Settings,
  Search,
  Plus,
  Clock3,
  Tag,
  Zap,
  ChevronRight,
  CheckCircle2,
  Bot,
  Menu as MenuIcon,
  X,
  Pencil,
  Save,
  QrCode,
  RefreshCw,
  Building2,
  MessagesSquare,
  ShieldCheck,
  Activity,
  BarChart3,
  Download,
  KeyRound,
  Bell,
  ArrowLeft,
  Moon,
  Sun,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import "./styles.css";
const API = import.meta.env.VITE_API_URL || "http://localhost:3333";
let authToken = localStorage.getItem("lebeef_token") || "";
type ToastKind = "success" | "error" | "info";
function notify(message: string, kind: ToastKind = "success") {
  window.dispatchEvent(
    new CustomEvent("atendeflow-toast", { detail: { message, kind } }),
  );
}
function shortDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function applyAccent(color: string) {
  const value = /^#[0-9a-f]{6}$/i.test(color) ? color : "#245c3a";
  const rgb = [1, 3, 5].map((index) =>
    parseInt(value.slice(index, index + 2), 16),
  );
  const mix = (amount: number) =>
    `rgb(${rgb.map((channel) => Math.round(channel + (255 - channel) * amount)).join(",")})`;
  const dark = `rgb(${rgb.map((channel) => Math.round(channel * 0.72)).join(",")})`;
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  document.documentElement.style.setProperty("--accent", value);
  document.documentElement.style.setProperty("--accent-dark", dark);
  document.documentElement.style.setProperty("--accent-soft", mix(0.88));
  document.documentElement.style.setProperty("--accent-muted", mix(0.72));
  document.documentElement.style.setProperty(
    "--accent-contrast",
    luminance > 0.62 ? "#102019" : "#ffffff",
  );
}
async function api(path: string, options?: RequestInit) {
  const r = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (r.status === 401 && path !== "/auth/login") {
    authToken = "";
    localStorage.removeItem("lebeef_token");
    window.location.reload();
  }
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}
type View =
  | "dashboard"
  | "conversations"
  | "customers"
  | "automation"
  | "reports"
  | "settings";
const nav = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["conversations", "Conversas", MessageCircle],
  ["customers", "Clientes", Users],
  ["automation", "Automação", Zap],
  ["reports", "Relatórios", BarChart3],
  ["settings", "Configurações", Settings],
] as const;
function App() {
  const [v, setV] = useState<View>("dashboard");
  const [mobile, setMobile] = useState(false);
  const [connection, setConnection] = useState("offline");
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [company, setCompany] = useState<any>({ name: "Sua empresa" });
  const [currentUser, setCurrentUser] = useState<any>({
    name: "Usuário",
    role: "agent",
  });
  const [needsSetup, setNeedsSetup] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    kind: ToastKind;
  } | null>(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("atendeflow_theme") || "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("atendeflow_theme", theme);
  }, [theme]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [v]);
  useEffect(() => {
    if (
      currentUser.role &&
      currentUser.role !== "admin" &&
      !["dashboard", "conversations", "customers"].includes(v)
    )
      setV("dashboard");
  }, [currentUser.role, v]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const showToast = (event: Event) => {
      setToast((event as CustomEvent).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener("atendeflow-toast", showToast);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("atendeflow-toast", showToast);
    };
  }, []);
  useEffect(() => {
    api("/auth/me").then(setCurrentUser).catch(() => {});
    api("/settings")
      .then((settings) => {
        const profile = settings.company_profile || company;
        setCompany(profile);
        setNeedsSetup(settings.setup_completed === false);
        if (profile.accentColor) applyAccent(profile.accentColor);
      })
      .catch(() => {});
    const check = () =>
      api("/connection")
        .then((x) => {
          const next = x.instance?.state || "offline";
          const previous = localStorage.getItem("atendeflow_connection");
          if (
            previous === "open" &&
            next !== "open" &&
            localStorage.getItem("atendeflow_notifications") === "true" &&
            "Notification" in window &&
            Notification.permission === "granted"
          )
            new Notification("WhatsApp desconectado", {
              body: "A automação do AtendeFlow precisa de atenção.",
              icon: "/atendeflow-icon.png",
            });
          localStorage.setItem("atendeflow_connection", next);
          setConnection(next);
        })
        .catch(() => setConnection("offline"));
    check();
    const timer = setInterval(check, 15000);
    const updateCompany = (event: Event) =>
      setCompany((event as CustomEvent).detail);
    window.addEventListener("company-profile-updated", updateCompany);
    return () => {
      clearInterval(timer);
      window.removeEventListener("company-profile-updated", updateCompany);
    };
  }, []);
  const visibleNav = nav.filter(
    ([id]) =>
      currentUser.role === "admin" ||
      id === "dashboard" ||
      id === "conversations" ||
      id === "customers",
  );
  return (
    <div className="app">
      <aside className={mobile ? "open" : ""}>
        <div className="brand">
          <div className="brandIdentity">
            <img src="/atendeflow-logo-white.png" alt="AtendeFlow" />
            <small>{company.name}</small>
          </div>
          <button className="close" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <nav>
          {visibleNav.map(([id, label, I]) => (
            <button
              className={v === id ? "active" : ""}
              onClick={() => {
                setV(id);
                setMobile(false);
              }}
              key={id}
            >
              <I size={19} />
              {label}
            </button>
          ))}
        </nav>
        {currentUser.role === "admin" && (
          <button
            className="whatsappManager"
            onClick={() => {
              setShowWhatsApp(true);
              setMobile(false);
            }}
          >
            <QrCode size={18} />
            <div>
              <strong>Conectar WhatsApp</strong>
              <small>Gerar ou renovar QR Code</small>
            </div>
            <ChevronRight size={14} />
          </button>
        )}
        <div className={`connection ${connection}`}>
          <i />
          <div>
            <strong>
              {connection === "open"
                ? "WhatsApp conectado"
                : connection === "connecting"
                  ? "WhatsApp conectando"
                  : "WhatsApp desconectado"}
            </strong>
            <small>{company.name}</small>
          </div>
        </div>
        <div className="appVersion">
          AtendeFlow <span>|</span> Versão: 3.19.0
        </div>
      </aside>
      {showWhatsApp && (
        <WhatsAppConnection
          connection={connection}
          setConnection={setConnection}
          close={() => setShowWhatsApp(false)}
        />
      )}
      {needsSetup && (
        <SetupWizard
          finish={(profile: any) => {
            setCompany(profile);
            setNeedsSetup(false);
            setShowWhatsApp(true);
          }}
        />
      )}
      <main>
        <header>
          <button className="hamb" onClick={() => setMobile(true)}>
            <MenuIcon />
          </button>
          <div>
            <h1>{visibleNav.find((x) => x[0] === v)?.[1]}</h1>
            <p>Gerencie seu atendimento em um só lugar</p>
          </div>
          <div className="operator">
            <button
              className="themeToggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={
                theme === "dark" ? "Ativar modo claro" : "Ativar modo noturno"
              }
              title={theme === "dark" ? "Modo claro" : "Modo noturno"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <span>
              {(currentUser.name || "Usuário").trim().slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{currentUser.name || "Usuário"}</b>
              <button
                className="logout"
                onClick={() => {
                  authToken = "";
                  localStorage.removeItem("lebeef_token");
                  location.reload();
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </header>
        {v === "dashboard" ? (
          <Dashboard go={() => setV("conversations")} user={currentUser} />
        ) : v === "conversations" ? (
          <Conversations />
        ) : v === "customers" ? (
          <Customers />
        ) : v === "automation" ? (
          <Automation />
        ) : v === "reports" ? (
          <Reports />
        ) : (
          <SettingsView />
        )}
      </main>
      {toast && (
        <div className={`appToast ${toast.kind}`} role="status">
          {toast.kind === "success" ? <CheckCircle2 /> : <Activity />}
          <span>{toast.message}</span>
          <button aria-label="Fechar notificação" onClick={() => setToast(null)}>
            <X />
          </button>
        </div>
      )}
    </div>
  );
}
function SetupWizard({ finish }: { finish: (profile: any) => void }) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    name: "",
    owner: "",
    phone: "",
    segment: "",
    address: "",
  });
  const [hours, setHours] = useState(["08:00", "18:00"]);
  async function complete() {
    await api("/settings/company_profile", {
      method: "PUT",
      body: JSON.stringify({ value: profile }),
    });
    const days: any = {};
    [1, 2, 3, 4, 5].forEach((day) => (days[day] = hours));
    await api("/settings/business_hours", {
      method: "PUT",
      body: JSON.stringify({ value: { timezone: "America/Sao_Paulo", days } }),
    });
    await api("/settings/setup_completed", {
      method: "PUT",
      body: JSON.stringify({ value: true }),
    });
    finish(profile);
  }
  return (
    <div className="modalBackdrop">
      <article className="setupWizard">
        <img src="/atendeflow-logo-green.png" alt="AtendeFlow" />
        <span className="setupStep">ETAPA {step} DE 2</span>
        {step === 1 ? (
          <>
            <h2>Cadastre sua empresa</h2>
            <p>Esses dados personalizam esta instalação.</p>
            <label>
              Nome da empresa
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </label>
            <label>
              Responsável
              <input
                value={profile.owner}
                onChange={(e) =>
                  setProfile({ ...profile, owner: e.target.value })
                }
              />
            </label>
            <label>
              Telefone
              <input
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
              />
            </label>
            <label>
              Segmento
              <input
                value={profile.segment}
                onChange={(e) =>
                  setProfile({ ...profile, segment: e.target.value })
                }
              />
            </label>
            <button
              className="primary"
              disabled={!profile.name || !profile.owner}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          </>
        ) : (
          <>
            <h2>Horário inicial</h2>
            <p>
              Aplicaremos de segunda a sexta. Depois você poderá personalizar
              cada dia.
            </p>
            <div className="setupHours">
              <label>
                Abertura
                <input
                  type="time"
                  value={hours[0]}
                  onChange={(e) => setHours([e.target.value, hours[1]])}
                />
              </label>
              <label>
                Fechamento
                <input
                  type="time"
                  value={hours[1]}
                  onChange={(e) => setHours([hours[0], e.target.value])}
                />
              </label>
            </div>
            <button className="primary" onClick={complete}>
              Salvar e conectar WhatsApp
            </button>
            <button className="secondary" onClick={() => setStep(1)}>
              Voltar
            </button>
          </>
        )}
      </article>
    </div>
  );
}
function WhatsAppConnection({
  connection,
  setConnection,
  close,
}: {
  connection: string;
  setConnection: (state: string) => void;
  close: () => void;
}) {
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setError("");
    const result = await api("/connection");
    setConnection(result.instance?.state || "offline");
    if (result.instance?.state === "open") setQrCode("");
  }
  async function generateQr() {
    setLoading(true);
    setError("");
    try {
      const result = await api("/connection/qr", { method: "POST" });
      if (result.connected) {
        setConnection("open");
        setQrCode("");
      } else {
        setConnection("connecting");
        setQrCode(result.qrCode);
      }
    } catch {
      setError("Não foi possível gerar o QR Code. Verifique a Evolution API.");
    } finally {
      setLoading(false);
    }
  }
  async function disconnect() {
    const confirmed = window.confirm(
      "Deseja desconectar o número atual? A automação parará de receber mensagens até que um novo QR Code seja conectado.",
    );
    if (!confirmed) return;
    setDisconnecting(true);
    setError("");
    try {
      await api("/connection", { method: "DELETE" });
      setConnection("offline");
      setQrCode("");
    } catch {
      setError("Não foi possível desconectar o WhatsApp.");
    } finally {
      setDisconnecting(false);
    }
  }
  useEffect(() => {
    if (!qrCode) return;
    const timer = setInterval(() => refresh().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [qrCode]);
  return (
    <div className="modalBackdrop" onMouseDown={close}>
      <article
        className="whatsappModal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modalClose" onClick={close} aria-label="Fechar">
          <X />
        </button>
        <div className="waIcon">
          <QrCode />
        </div>
        <h2>Conectar WhatsApp</h2>
        <p className="waSubtitle">Gerencie a conexão sem abrir outra página.</p>
        <div className={`waStatus ${connection}`}>
          <i />
          <div>
            <strong>
              {connection === "open"
                ? "WhatsApp conectado"
                : connection === "connecting"
                  ? "Aguardando conexão"
                  : "WhatsApp desconectado"}
            </strong>
            <small>
              {connection === "open"
                ? "A automação está pronta para responder."
                : "Gere o QR Code e leia com o celular."}
            </small>
          </div>
        </div>
        {qrCode && (
          <div className="qrBox">
            <img src={qrCode} alt="QR Code para conectar o WhatsApp" />
            <p>WhatsApp → Aparelhos conectados → Conectar aparelho</p>
          </div>
        )}
        {error && <p className="waError">{error}</p>}
        <div className="waActions">
          {connection !== "open" && (
            <button className="primary" onClick={generateQr} disabled={loading}>
              {loading
                ? "Gerando..."
                : qrCode
                  ? "Gerar novo QR Code"
                  : "Gerar QR Code"}
            </button>
          )}
          <button
            className="secondary"
            onClick={() =>
              refresh().catch(() =>
                setError("Não foi possível consultar a conexão."),
              )
            }
          >
            <RefreshCw /> Atualizar status
          </button>
        </div>
        {connection === "open" && (
          <button
            className="waDisconnect"
            onClick={disconnect}
            disabled={disconnecting}
          >
            {disconnecting ? "Desconectando..." : "Desconectar / trocar número"}
          </button>
        )}
        {connection === "open" && (
          <p className="waHint">
            Não é necessário gerar outro QR Code em cada navegador.
          </p>
        )}
      </article>
    </div>
  );
}
function Dashboard({
  go,
  user,
}: {
  go: () => void;
  user: { name?: string };
}) {
  const [d, setD] = useState<any>({ stats: {}, recent: [] });
  useEffect(() => {
    api("/dashboard")
      .then(setD)
      .catch(() => notify("Não foi possível carregar a visão geral.", "error"));
  }, []);
  const cards = [
    [
      MessageCircle,
      "Mensagens hoje",
      d.stats.messages_today || 0,
      "Dados em tempo real",
    ],
    [Clock3, "Aguardando", d.stats.waiting || 0, "Precisam de atenção"],
    [Users, "Total de clientes", d.stats.customers || 0, "Base cadastrada"],
    [
      Bot,
      "Cobertura automática",
      `${d.stats.automation_rate || 0}%`,
      "Respostas por mensagem recebida",
    ],
  ];
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "Bom dia"
      : hour >= 12 && hour < 18
        ? "Boa tarde"
        : "Boa noite";
  const loggedName = user.name?.trim().split(/\s+/)[0] || "Usuário";
  return (
    <section className="page">
      <div className="hero">
        <div>
          <span className="eyebrow">CENTRAL DE ATENDIMENTO</span>
          <h2>
            {greeting}, {loggedName}! <em>👋</em>
          </h2>
          <p>Acompanhe as conversas e mantenha seus clientes bem atendidos.</p>
        </div>
        <button onClick={go}>
          Abrir conversas <ChevronRight size={18} />
        </button>
      </div>
      <div className="metrics">
        {cards.map(([I, t, n, s]: any) => (
          <article key={t}>
            <div className="metricIcon">
              <I />
            </div>
            <div>
              <small>{t}</small>
              <strong>{n}</strong>
              <span>{s}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="grid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <h3>Conversas recentes</h3>
              <p>Últimas interações com seus clientes</p>
            </div>
            <button onClick={go}>Ver todas</button>
          </div>
          {d.recent.length ? (
            d.recent.map((c: any) => (
              <div className="recent" key={c.id}>
                <Avatar name={c.name} />
                <div>
                  <b>{c.name || c.phone}</b>
                  <span>{c.last_message || "Nova conversa"}</span>
                </div>
                <Status s={c.status} />
              </div>
            ))
          ) : (
            <Empty text="As conversas aparecerão aqui." />
          )}
        </article>
        <article className="panel statusPanel">
          <div className="panelHead">
            <div>
              <h3>Status da automação</h3>
              <p>Operação em tempo real</p>
            </div>
            <span className="online">Ativa</span>
          </div>
          <div className="botCard">
            <Bot />
            <div>
              <b>Atendimento automático</b>
              <span>Respondendo normalmente</span>
            </div>
            <CheckCircle2 />
          </div>
          <div className="statusRow">
            <span>Saudação em 24h</span>
            <b>Ativa</b>
          </div>
          <div className="statusRow">
            <span>Respostas por gatilhos</span>
            <b>Ativas</b>
          </div>
          <div className="statusRow">
            <span>Fora do horário</span>
            <b>Configurada</b>
          </div>
        </article>
      </div>
    </section>
  );
}
function Avatar({ name }: { name?: string }) {
  const initials = (name || "Cliente")
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="avatar" title={name || "Cliente"}>
      {initials || "CL"}
    </span>
  );
}
function Status({ s }: { s: string }) {
  return (
    <span className={"status " + s}>
      {s === "waiting"
        ? "Aguardando"
        : s === "human"
          ? "Humano"
          : s === "closed"
            ? "Finalizada"
            : "Bot"}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <MessageCircle />
      <span>{text}</span>
    </div>
  );
}
function Conversations() {
  const [list, setList] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(),
    [messages, setMessages] = useState<any[]>([]),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const load = () =>
    api("/conversations?search=" + encodeURIComponent(search))
      .then((x) => {
        setList(x);
        if (!selected && x[0]) setSelected(x[0]);
      })
      .catch(() => notify("Não foi possível carregar as conversas.", "error"));
  useEffect(() => {
    load();
    const s = io(API);
    s.on("conversation:update", (event: any) => {
      load();
      if (
        localStorage.getItem("atendeflow_notifications") === "true" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Nova mensagem no AtendeFlow", {
          body: "Uma conversa recebeu uma nova mensagem.",
          icon: "/atendeflow-icon.png",
          tag: event?.conversationId || "conversation",
        });
      }
    });
    return () => {
      s.disconnect();
    };
  }, []);
  useEffect(() => {
    if (selected) {
      api(`/conversations/${selected.id}/messages`).then(setMessages);
    }
  }, [selected]);
  return (
    <section className={`chatPage ${selected ? "hasSelection" : ""}`}>
      <div className="chatList">
        <div className="search">
          <Search />
          <input
            placeholder="Pesquisar conversas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div className="filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todas
          </button>
          <button
            className={filter === "unread" ? "active" : ""}
            onClick={() => setFilter("unread")}
          >
            Não lidas
          </button>
          <button
            className={filter === "waiting" ? "active" : ""}
            onClick={() => setFilter("waiting")}
          >
            Aguardando
          </button>
        </div>
        {list
          .filter(
            (c) =>
              filter === "all" ||
              (filter === "unread" && c.unread_count > 0) ||
              (filter === "waiting" && c.status === "waiting"),
          )
          .map((c) => (
            <button
              key={c.id}
              className={
                "chatItem " + (selected?.id === c.id ? "selected" : "")
              }
              onClick={() => setSelected(c)}
            >
              <Avatar name={c.name} />
              <div>
                <div className="chatMeta">
                  <b>{c.name || c.phone}</b>
                  <time>{shortDateTime(c.updated_at)}</time>
                </div>
                <span>{c.last_message}</span>
              </div>
              {c.unread_count > 0 && <i>{c.unread_count}</i>}
            </button>
          ))}
      </div>
      <div className="conversation">
        {selected ? (
          <>
            <div className="conversationHead">
              <button
                className="mobileChatBack"
                onClick={() => setSelected(undefined)}
                aria-label="Voltar para conversas"
              >
                <ArrowLeft />
              </button>
              <Avatar name={selected.name} />
              <div>
                <b>{selected.name || selected.phone}</b>
                <span>{selected.phone}</span>
              </div>
              <a
                className="whatsappWebButton"
                href={`https://wa.me/${String(selected.phone || "").replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir WhatsApp Web <ExternalLink size={15} />
              </a>
            </div>
            <div className="messages">
              {messages.map((m) => (
                <div className={"bubble " + m.direction} key={m.id}>
                  <span>{m.content}</span>
                  <small>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    ·{" "}
                    {m.sender === "bot"
                      ? "Automático"
                      : m.sender === "agent"
                        ? "Atendente"
                        : "Cliente"}
                  </small>
                </div>
              ))}
            </div>
            <div className="conversationReadOnly">
              <MessageCircle size={18} />
              <span>
                Esta tela exibe somente o histórico. Para responder ao cliente,
                use o WhatsApp Web.
              </span>
            </div>
          </>
        ) : (
          <Empty text="Selecione uma conversa" />
        )}
      </div>
    </section>
  );
}
function Customers() {
  const [x, setX] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const loadCustomers = () =>
    api("/customers")
      .then(setX)
      .catch(() => notify("Não foi possível carregar os clientes.", "error"));
  useEffect(() => {
    loadCustomers();
    api("/tags").then(setAllTags);
  }, []);
  async function addTag(customerId: string, tagId: string) {
    if (!tagId) return;
    await api(`/customers/${customerId}/tags/${tagId}`, { method: "POST" });
    loadCustomers();
  }
  async function removeTag(customerId: string, tagId: string) {
    await api(`/customers/${customerId}/tags/${tagId}`, { method: "DELETE" });
    loadCustomers();
  }
  return (
    <section className="page">
      <div className="titleRow">
        <div>
          <h2>Clientes</h2>
          <p>Contatos que já conversaram com sua empresa.</p>
        </div>
      </div>
      <article className="panel table">
        <div className="tableHead">
          <span>CLIENTE</span>
          <span>ETIQUETAS</span>
          <span>ÚLTIMO CONTATO</span>
          <span>STATUS</span>
        </div>
        {x.map((c) => (
          <div className="tableRow" key={c.id}>
            <div className="person">
              <Avatar name={c.name} />
              <div>
                <b>{c.name || "Sem nome"}</b>
                <small>{c.phone}</small>
              </div>
            </div>
            <div>
              {c.tags.map((t: any) => (
                <button
                  key={t.id}
                  title="Remover etiqueta"
                  onClick={() => removeTag(c.id, t.id)}
                  className="tag"
                  style={{ color: t.color }}
                >
                  <Tag size={12} />
                  {t.name}
                </button>
              ))}
              <select
                className="tagSelect"
                value=""
                onChange={(e) => addTag(c.id, e.target.value)}
              >
                <option value="">+ etiqueta</option>
                {allTags
                  .filter((t) => !c.tags.some((ct: any) => ct.id === t.id))
                  .map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <span>{new Date(c.updated_at).toLocaleDateString("pt-BR")}</span>
            <span className={c.automation_paused ? "humanText" : "botText"}>
              {c.automation_paused ? "Atendimento humano" : "Automático"}
            </span>
          </div>
        ))}
      </article>
    </section>
  );
}
function Automation() {
  const [tab, setTab] = useState("triggers"),
    [triggerItems, setTriggerItems] = useState<any[]>([]),
    [menuItems, setMenuItems] = useState<any[]>([]),
    [form, setForm] = useState<any>({
      name: "",
      keywords: "",
      response: "",
      active: true,
      priority: 0,
      mediaType: "",
      mediaUrl: "",
      mediaName: "",
    }),
    [editing, setEditing] = useState<string | null>(null),
    [testText, setTestText] = useState(""),
    [testResult, setTestResult] = useState<any>(null),
    [uploading, setUploading] = useState(false);
  function reset() {
    setEditing(null);
    setForm({
      name: "",
      keywords: "",
      response: "",
      active: true,
      action: "reply",
      priority: 0,
      mediaType: "",
      mediaUrl: "",
      mediaName: "",
    });
  }
  const items = tab === "menu" ? menuItems : triggerItems;
  function load(target = tab) {
    api("/" + (target === "menu" ? "menu_items" : "triggers"))
      .then(target === "menu" ? setMenuItems : setTriggerItems)
      .catch(() => notify("Não foi possível carregar as regras.", "error"));
  }
  useEffect(() => {
    reset();
    load(tab);
  }, [tab]);
  function edit(i: any) {
    setEditing(i.id);
    setForm(
      tab === "menu"
        ? {
            optionNumber: i.option_number,
            name: i.label,
            response: i.response,
            action: i.action,
            active: i.active,
            mediaType: i.media_type || "",
            mediaUrl: i.media_url || "",
            mediaName: i.media_url ? "Anexo atual" : "",
          }
        : {
            name: i.name,
            keywords: i.keywords.join(", "),
            response: i.response,
            active: i.active,
            priority: i.priority || 0,
            mediaType: i.media_type || "",
            mediaUrl: i.media_url || "",
            mediaName: i.media_url ? "Anexo atual" : "",
          },
    );
  }
  async function toggle(i: any) {
    const path = tab === "menu" ? "menu_items" : "triggers";
    try {
      await api(`/${path}/${i.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !i.active }),
      });
      load();
      notify(i.active ? "Resposta desativada." : "Resposta ativada.");
    } catch {
      notify("Não foi possível alterar esta resposta.", "error");
    }
  }
  async function uploadAutomationMedia(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch(`${API}/api/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: data,
      });
      const media = await response.json();
      if (!response.ok) throw new Error(media.error || "Falha no arquivo");
      setForm((current: any) => ({
        ...current,
        mediaType: media.type,
        mediaUrl: media.url,
        mediaName: media.originalName || file.name,
      }));
      notify("Arquivo anexado à resposta automática.");
    } catch (error: any) {
      notify(error.message || "Não foi possível anexar o arquivo", "error");
    } finally {
      setUploading(false);
    }
  }
  async function save() {
    if (form.name.trim().length < 2)
      return notify("Informe um nome para a regra.", "error");
    if (!form.response.trim())
      return notify("Informe a mensagem que será enviada.", "error");
    if (tab === "triggers" && !form.keywords.trim())
      return notify("Informe pelo menos uma palavra-chave.", "error");
    if (
      tab === "menu" &&
      (!Number.isInteger(Number(form.optionNumber)) ||
        Number(form.optionNumber) < 1 ||
        Number(form.optionNumber) > 99)
    )
      return notify("Use um número de opção entre 1 e 99.", "error");
    const path = tab === "menu" ? "menu_items" : "triggers";
    const body =
      tab === "menu"
        ? {
            optionNumber: Number(form.optionNumber),
            label: form.name,
            response: form.response,
            action: form.action || "reply",
            mediaType: form.mediaType || null,
            mediaUrl: form.mediaUrl || null,
          }
        : {
            ...form,
            keywords: form.keywords
              .split(",")
              .map((x: string) => x.trim())
              .filter(Boolean),
          };
    try {
      await api(editing ? `/${path}/${editing}` : "/" + path, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      const wasEditing = !!editing;
      reset();
      load();
      notify(wasEditing ? "Alterações salvas." : "Regra criada com sucesso.");
    } catch (error: any) {
      try {
        notify(JSON.parse(error.message).error, "error");
      } catch {
        notify("Não foi possível salvar a regra.", "error");
      }
    }
  }
  return (
    <section className="page">
      <div className="titleRow">
        <div>
          <h2>Automação</h2>
          <p>
            Configure regras simples e previsíveis, sem inteligência artificial.
          </p>
        </div>
      </div>
      <div className="tabs">
        <button
          className={tab === "triggers" ? "active" : ""}
          onClick={() => setTab("triggers")}
        >
          Gatilhos
        </button>
        <button
          className={tab === "menu" ? "active" : ""}
          onClick={() => setTab("menu")}
        >
          Menu numérico
        </button>
      </div>
      <div className="grid automationGrid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <h3>
                {tab === "menu"
                  ? "Opções do menu"
                  : "Respostas por palavra-chave"}
              </h3>
              <p>{items.length} regras cadastradas</p>
            </div>
          </div>
          {items.map((i) => (
            <div
              className={"rule " + (editing === i.id ? "editing" : "")}
              key={i.id}
            >
              <span className="ruleIcon">
                {tab === "menu" ? i.option_number : <Zap size={17} />}
              </span>
              <div>
                <b>{i.name || i.label}</b>
                <span>
                  {tab === "menu"
                    ? i.action === "human"
                      ? "Transferir para humano"
                      : i.response
                    : Array.isArray(i.keywords)
                      ? i.keywords.join(" · ")
                      : ""}
                </span>
                {i.media_url && (
                  <small className="ruleAttachment">
                    <Paperclip size={12} /> Anexo incluído
                  </small>
                )}
              </div>
              <button
                className="editButton"
                aria-label={`Editar ${i.name || i.label}`}
                onClick={() => edit(i)}
              >
                <Pencil size={16} />
              </button>
              <label
                className="switch"
                title={i.active ? "Desativar" : "Ativar"}
              >
                <input
                  type="checkbox"
                  checked={i.active}
                  onChange={() => toggle(i)}
                />
                <i />
              </label>
            </div>
          ))}
        </article>
        <article className="panel form editForm">
          <div className="formTitle">
            <h3>
              {editing ? "Editar" : "Adicionar"}{" "}
              {tab === "menu" ? "opção" : "gatilho"}
            </h3>
            {editing && <button onClick={reset}>Cancelar</button>}
          </div>
          {tab === "menu" && (
            <label>
              Número da opção
              <input
                type="number"
                disabled={!!editing}
                value={form.optionNumber || ""}
                onChange={(e) =>
                  setForm({ ...form, optionNumber: e.target.value })
                }
              />
            </label>
          )}
          <label>
            Nome
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Cardápio"
            />
          </label>
          {tab === "triggers" && (
            <>
              <label>
                Palavras-chave
                <input
                  value={form.keywords}
                  onChange={(e) =>
                    setForm({ ...form, keywords: e.target.value })
                  }
                  placeholder="cardápio, menu, preço"
                />
                <small>Separe as palavras por vírgula</small>
              </label>
              <label>
                Prioridade
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={form.priority || 0}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) })
                  }
                />
                <small>
                  Regras com maior prioridade são verificadas primeiro.
                </small>
              </label>
            </>
          )}
          <label>
            Resposta
            <textarea
              value={form.response}
              onChange={(e) => setForm({ ...form, response: e.target.value })}
              placeholder="Mensagem enviada automaticamente"
            />
          </label>
          <div className="automationAttachment">
            <span>Anexo da resposta</span>
            {form.mediaUrl ? (
              <div className="attachedFile">
                <Paperclip size={16} />
                <a href={form.mediaUrl} target="_blank" rel="noreferrer">
                  {form.mediaName || "Visualizar anexo"}
                </a>
                <button
                  type="button"
                  aria-label="Remover anexo"
                  onClick={() =>
                    setForm({
                      ...form,
                      mediaType: "",
                      mediaUrl: "",
                      mediaName: "",
                    })
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <label className="attachAutomationButton">
                <Paperclip size={16} />
                {uploading
                  ? "Enviando arquivo..."
                  : "Anexar imagem, PDF ou áudio"}
                <input
                  type="file"
                  disabled={uploading}
                  accept="image/*,audio/*,application/pdf"
                  onChange={(e) => uploadAutomationMedia(e.target.files?.[0])}
                />
              </label>
            )}
            <small>Tamanho máximo: 15 MB.</small>
          </div>
          {tab === "menu" && (
            <label>
              Ação
              <select
                value={form.action || "reply"}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
              >
                <option value="reply">Responder automaticamente</option>
                <option value="human">Transferir para humano</option>
              </select>
            </label>
          )}
          <button className="primary" onClick={save}>
            {editing ? <Save /> : <Plus />}
            {editing ? "Salvar alterações" : "Salvar regra"}
          </button>
          <div className="automationTester">
            <h4>Testar automação</h4>
            <p className="muted">O teste não envia mensagem ao WhatsApp.</p>
            <input
              value={testText}
              placeholder="Digite como se fosse o cliente"
              onChange={(e) => setTestText(e.target.value)}
            />
            <button
              className="secondary"
              disabled={!testText.trim()}
              onClick={async () =>
                setTestResult(
                  await api("/automation/test", {
                    method: "POST",
                    body: JSON.stringify({ text: testText }),
                  }),
                )
              }
            >
              Testar mensagem
            </button>
            {testResult && (
              <div className={testResult.matched ? "testMatch" : "testNoMatch"}>
                {testResult.matched ? (
                  <>
                    <b>Regra: {testResult.rule.name}</b>
                    <span>{testResult.rule.response}</span>
                  </>
                ) : (
                  "Nenhuma regra correspondeu."
                )}
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
function Reports() {
  const [report, setReport] = useState<any>({
    daily: [],
    summary: {},
  });
  useEffect(() => {
    api("/reports/overview")
      .then(setReport)
      .catch(() => notify("Não foi possível carregar os relatórios.", "error"));
  }, []);
  const max = Math.max(
    1,
    ...report.daily.map((x: any) => Number(x.received) + Number(x.sent)),
  );
  return (
    <section className="page">
      <div className="titleRow">
        <div>
          <h2>Relatórios</h2>
          <p>Resultados dos últimos 30 dias.</p>
        </div>
      </div>
      <div className="reportCards">
        <article className="panel">
          <small>CLIENTES</small>
          <strong>{report.summary.customers || 0}</strong>
        </article>
        <article className="panel">
          <small>MENSAGENS RECEBIDAS</small>
          <strong>{report.summary.received || 0}</strong>
        </article>
        <article className="panel">
          <small>RESPOSTAS AUTOMÁTICAS</small>
          <strong>{report.summary.automated || 0}</strong>
        </article>
        <article className="panel">
          <small>COBERTURA AUTOMÁTICA</small>
          <strong>{report.summary.automation_rate || 0}%</strong>
        </article>
      </div>
      <article className="panel reportPanel reportFull">
        <h3>Volume de mensagens</h3>
        <p className="muted">Mensagens recebidas e respostas enviadas por dia</p>
        <div className="barChart">
          {report.daily.map((x: any) => (
            <div className="barDay" key={x.report_day}>
              <div className="barTrack">
                <i
                  style={{
                    height: `${Math.max(5, ((Number(x.received) + Number(x.sent)) / max) * 100)}%`,
                  }}
                />
              </div>
              <small>
                {new Date(x.report_day).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
const weekDays = [
  ["1", "Segunda-feira"],
  ["2", "Terça-feira"],
  ["3", "Quarta-feira"],
  ["4", "Quinta-feira"],
  ["5", "Sexta-feira"],
  ["6", "Sábado"],
  ["0", "Domingo"],
];
function SettingsView() {
  const [s, setS] = useState<any>({}),
    [saved, setSaved] = useState(false),
    [tab, setTab] = useState<
      "company" | "messages" | "hours" | "admin" | "system"
    >("company");
  useEffect(() => {
    api("/settings")
      .then(setS)
      .catch(() => notify("Não foi possível carregar as configurações.", "error"));
  }, []);
  async function save(key: string, silent = false) {
    try {
      await api("/settings/" + key, {
        method: "PUT",
        body: JSON.stringify({ value: s[key] }),
      });
      if (key === "company_profile" && s[key]?.accentColor)
        applyAccent(s[key].accentColor);
      if (key === "company_profile")
        window.dispatchEvent(
          new CustomEvent("company-profile-updated", { detail: s[key] }),
        );
      if (!silent) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
        notify("Alterações salvas.");
      }
      return true;
    } catch {
      notify("Não foi possível salvar esta configuração.", "error");
      return false;
    }
  }
  function setDay(day: string, value: any) {
    setS((old: any) => ({
      ...old,
      business_hours: {
        timezone: "America/Sao_Paulo",
        ...(old.business_hours || {}),
        days: { ...(old.business_hours?.days || {}), [day]: value },
      },
    }));
  }
  return (
    <section className="page">
      <div className="titleRow">
        <div>
          <h2>Configurações</h2>
          <p>Personalize as mensagens e o horário do atendimento.</p>
        </div>
        {saved && (
          <span className="saved">
            <CheckCircle2 />
            Alterações salvas
          </span>
        )}
      </div>
      <div className="settingsTabs">
        <button
          className={tab === "company" ? "active" : ""}
          onClick={() => setTab("company")}
        >
          <Building2 /> Empresa
        </button>
        <button
          className={tab === "messages" ? "active" : ""}
          onClick={() => setTab("messages")}
        >
          <MessagesSquare /> Mensagens
        </button>
        <button
          className={tab === "hours" ? "active" : ""}
          onClick={() => setTab("hours")}
        >
          <Clock3 /> Horários
        </button>
        <button
          className={tab === "admin" ? "active" : ""}
          onClick={() => setTab("admin")}
        >
          <ShieldCheck /> Administração
        </button>
        <button
          className={tab === "system" ? "active" : ""}
          onClick={() => setTab("system")}
        >
          <Activity /> Sistema
        </button>
      </div>
      <div className="settingsGrid">
        {tab === "company" && (
          <article className="panel form companySettings">
            <div className="settingTitle">
              <span>
                <Building2 />
              </span>
              <div>
                <h3>Dados da empresa</h3>
                <p>
                  Esses dados identificam o estabelecimento dentro do
                  AtendeFlow.
                </p>
              </div>
            </div>
            <div className="companyFormGrid">
              <label>
                Nome da empresa
                <input
                  value={s.company_profile?.name || ""}
                  placeholder="Ex: Le Beef"
                  onChange={(e) =>
                    setS({
                      ...s,
                      company_profile: {
                        ...(s.company_profile || {}),
                        name: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Nome do responsável
                <input
                  value={s.company_profile?.owner || ""}
                  placeholder="Ex: Maria Silva"
                  onChange={(e) =>
                    setS({
                      ...s,
                      company_profile: {
                        ...(s.company_profile || {}),
                        owner: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Telefone
                <input
                  value={s.company_profile?.phone || ""}
                  placeholder="(16) 99999-9999"
                  onChange={(e) =>
                    setS({
                      ...s,
                      company_profile: {
                        ...(s.company_profile || {}),
                        phone: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Segmento
                <input
                  value={s.company_profile?.segment || ""}
                  placeholder="Ex: Restaurante"
                  onChange={(e) =>
                    setS({
                      ...s,
                      company_profile: {
                        ...(s.company_profile || {}),
                        segment: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label className="full">
                Endereço
                <input
                  value={s.company_profile?.address || ""}
                  placeholder="Rua, número, bairro e cidade"
                  onChange={(e) =>
                    setS({
                      ...s,
                      company_profile: {
                        ...(s.company_profile || {}),
                        address: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Cor principal
                <div className="colorPicker">
                  <input
                    type="color"
                    value={s.company_profile?.accentColor || "#245c3a"}
                    onChange={(e) => {
                      applyAccent(e.target.value);
                      setS({
                        ...s,
                        company_profile: {
                          ...(s.company_profile || {}),
                          accentColor: e.target.value,
                        },
                      });
                    }}
                  />
                  <code>{s.company_profile?.accentColor || "#245c3a"}</code>
                  {[
                    "#245c3a",
                    "#147d73",
                    "#2563a8",
                    "#6d4bb5",
                    "#b5483f",
                    "#b7791f",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Usar cor ${color}`}
                      style={{ background: color }}
                      onClick={() => {
                        applyAccent(color);
                        setS({
                          ...s,
                          company_profile: {
                            ...(s.company_profile || {}),
                            accentColor: color,
                          },
                        });
                      }}
                    />
                  ))}
                </div>
              </label>
            </div>
            <button className="primary" onClick={() => save("company_profile")}>
              <Save /> Salvar empresa
            </button>
          </article>
        )}
        {tab === "messages" && (
          <>
            <article className="panel form">
              <div className="settingTitle">
                <span>
                  <MessageCircle />
                </span>
                <div>
                  <h3>Saudação quando estiver aberto</h3>
                  <p>
                    Enviada uma única vez a cada 24 horas, somente dentro do
                    horário configurado.
                  </p>
                </div>
              </div>
              <textarea
                className="large"
                value={s.greeting || ""}
                onChange={(e) => setS({ ...s, greeting: e.target.value })}
              />
              <button className="primary" onClick={() => save("greeting")}>
                Salvar saudação
              </button>
            </article>
            <article className="panel form">
              <div className="settingTitle">
                <span>
                  <Clock3 />
                </span>
                <div>
                  <h3>Mensagem quando estiver fechado</h3>
                  <p>Fora do horário, somente esta mensagem será enviada.</p>
                </div>
              </div>
              <textarea
                className="large"
                value={s.closed_message || ""}
                onChange={(e) => setS({ ...s, closed_message: e.target.value })}
              />
              <button
                className="primary"
                onClick={() => save("closed_message")}
              >
                Salvar mensagem
              </button>
            </article>
            <article className="panel form hoursCard">
              <div className="settingTitle">
                <span>
                  <Bot />
                </span>
                <div>
                  <h3>Resposta quando não reconhecer</h3>
                  <p>
                    Opcional: enviada quando nenhuma palavra-chave corresponde.
                  </p>
                </div>
              </div>
              <label className="dayToggle">
                <input
                  type="checkbox"
                  checked={!!s.fallback_enabled}
                  onChange={(e) =>
                    setS({ ...s, fallback_enabled: e.target.checked })
                  }
                />
                <i />
                <b>Ativar resposta padrão</b>
              </label>
              <textarea
                value={s.fallback_message || ""}
                onChange={(e) =>
                  setS({ ...s, fallback_message: e.target.value })
                }
              />
              <button
                className="primary"
                onClick={async () => {
                  if (await save("fallback_message", true))
                    await save("fallback_enabled");
                }}
              >
                Salvar resposta padrão
              </button>
            </article>
          </>
        )}
        {tab === "hours" && (
          <article className="panel form hoursCard">
            <div className="settingTitle">
              <span>
                <Clock3 />
              </span>
              <div>
                <h3>Horário de funcionamento</h3>
                <p>
                  Fuso horário de Brasília · cada dia pode ter seu próprio
                  horário.
                </p>
              </div>
            </div>
            <div className="days">
              {weekDays.map(([day, label]) => {
                const range = s.business_hours?.days?.[day];
                return (
                  <div className="dayRow" key={day}>
                    <label className="dayToggle">
                      <input
                        type="checkbox"
                        checked={!!range}
                        onChange={(e) =>
                          setDay(
                            day,
                            e.target.checked ? ["18:00", "23:00"] : null,
                          )
                        }
                      />
                      <i />
                      <b>{label}</b>
                    </label>
                    {range ? (
                      <div className="timeRange">
                        <input
                          aria-label={`Abertura ${label}`}
                          type="time"
                          value={range[0]}
                          onChange={(e) =>
                            setDay(day, [e.target.value, range[1]])
                          }
                        />
                        <span>até</span>
                        <input
                          aria-label={`Fechamento ${label}`}
                          type="time"
                          value={range[1]}
                          onChange={(e) =>
                            setDay(day, [range[0], e.target.value])
                          }
                        />
                      </div>
                    ) : (
                      <span className="closedDay">Fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
            <button className="primary" onClick={() => save("business_hours")}>
              <Save />
              Salvar horários
            </button>
          </article>
        )}
        {tab === "admin" && (
          <>
            <LicenseSettings />
            <AdminTools />
          </>
        )}
        {tab === "system" && <SystemSettings />}
      </div>
    </section>
  );
}
function SystemSettings() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateBusy, setUpdateBusy] = useState("");
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">(
    "success",
  );
  const load = () =>
    api("/system/diagnostics")
      .then(setDiagnostics)
      .catch(() => {
        setMessageKind("error");
        setMessage("Falha ao consultar o diagnóstico.");
      });
  const loadUpdate = () =>
    api("/system/update")
      .then(setUpdateInfo)
      .catch((error: any) =>
        setUpdateInfo({ error: error?.message || "Falha ao consultar atualizações." }),
      );
  useEffect(() => {
    load();
    loadUpdate();
  }, []);
  async function downloadUpdate() {
    setUpdateBusy("download");
    try {
      const prepared = await api("/system/update/download", { method: "POST" });
      setUpdateInfo((current: any) => ({ ...current, ready: true, prepared }));
      setMessageKind("success");
      setMessage(`Versão ${prepared.version} baixada e verificada.`);
    } catch (error: any) {
      setMessageKind("error");
      try {
        setMessage(JSON.parse(error.message).error);
      } catch {
        setMessage("Não foi possível baixar a atualização.");
      }
    } finally {
      setUpdateBusy("");
    }
  }
  async function installUpdate() {
    const version = updateInfo?.manifest?.version;
    if (!version) return;
    if (
      !window.confirm(
        `Instalar o AtendeFlow ${version} agora? O painel ficará indisponível por alguns minutos. Um backup será criado automaticamente.`,
      )
    )
      return;
    setUpdateBusy("install");
    try {
      await api("/system/update/install", { method: "POST" });
      setMessageKind("success");
      setMessage("Atualização iniciada. Não desligue o computador.");
      let attempts = 0;
      const timer = window.setInterval(async () => {
        attempts += 1;
        try {
          const status = await api("/system/update/status");
          setUpdateInfo((current: any) => ({ ...current, status }));
          if (status.state === "complete") {
            window.clearInterval(timer);
            window.location.reload();
          }
          if (status.state === "failed") {
            window.clearInterval(timer);
            setUpdateBusy("");
            setMessageKind("error");
            setMessage(status.message);
          }
        } catch {}
        if (attempts >= 120) {
          window.clearInterval(timer);
          setUpdateBusy("");
          setMessageKind("error");
          setMessage("A atualização está demorando. Consulte logs/atualizacao.log.");
        }
      }, 3000);
    } catch (error: any) {
      setUpdateBusy("");
      setMessageKind("error");
      try {
        setMessage(JSON.parse(error.message).error);
      } catch {
        setMessage("Não foi possível iniciar a atualização.");
      }
    }
  }
  async function exportData() {
    const response = await fetch(`${API}/api/system/export`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) {
      setMessageKind("error");
      return setMessage("Não foi possível exportar os dados.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atendeflow-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function changePassword() {
    setMessage("");
    if (!password.currentPassword) {
      setMessageKind("error");
      return setMessage("Digite sua senha atual.");
    }
    if (password.newPassword.length < 8) {
      setMessageKind("error");
      return setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
    }
    if (password.newPassword === password.currentPassword) {
      setMessageKind("error");
      return setMessage("A nova senha precisa ser diferente da senha atual.");
    }
    if (password.newPassword !== password.confirmPassword) {
      setMessageKind("error");
      return setMessage("A confirmação não corresponde à nova senha.");
    }
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        }),
      });
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessageKind("success");
      setMessage("Senha atualizada com sucesso.");
    } catch (e: any) {
      setMessageKind("error");
      try {
        setMessage(JSON.parse(e.message).error);
      } catch {
        setMessage("Não foi possível alterar a senha.");
      }
    }
  }
  async function enableNotifications() {
    if (!("Notification" in window)) {
      setMessageKind("error");
      return setMessage("Este navegador não oferece notificações.");
    }
    const permission = await Notification.requestPermission();
    localStorage.setItem(
      "atendeflow_notifications",
      String(permission === "granted"),
    );
    setMessageKind(permission === "granted" ? "success" : "error");
    setMessage(
      permission === "granted"
        ? "Notificações ativadas."
        : "Permissão de notificação negada.",
    );
  }
  const check = (name: string, data: any) => (
    <div className="diagnosticRow">
      <i className={data?.ok ? "ok" : "fail"} />
      <div>
        <b>{name}</b>
        <small>
          {(data?.state === "open"
            ? "Conectado"
            : data?.state === "connecting"
              ? "Conectando"
              : data?.state === "close" || data?.state === "offline"
                ? "Desconectado"
                : data?.state) ||
            data?.error ||
            (data?.latencyMs !== undefined
              ? `${data.latencyMs} ms`
              : "Funcionando")}
        </small>
      </div>
    </div>
  );
  return (
    <>
      <article className="panel form systemWide">
        <div className="settingTitle">
          <span>
            <Activity />
          </span>
          <div>
            <h3>Central de diagnóstico</h3>
            <p>Estado da API, banco, WhatsApp e fila de mensagens.</p>
          </div>
        </div>
        <div className="diagnosticGrid">
          {diagnostics && (
            <>
              {check("API", diagnostics.checks.api)}
              {check("Banco de dados", diagnostics.checks.database)}
              {check("WhatsApp", diagnostics.checks.whatsapp)}
              <div className="diagnosticRow">
                <i
                  className={diagnostics.checks.queue?.failed ? "fail" : "ok"}
                />
                <div>
                  <b>Fila de envio</b>
                  <small>
                    {diagnostics.checks.queue?.pending || 0} pendentes ·{" "}
                    {diagnostics.checks.queue?.failed || 0} falhas
                  </small>
                </div>
              </div>
            </>
          )}
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw /> Atualizar diagnóstico
        </button>
      </article>
      <article className="panel form updateCard systemWide">
        <div className="settingTitle">
          <span>
            <RefreshCw />
          </span>
          <div>
            <h3>Atualizações do AtendeFlow</h3>
            <p>Consulte, baixe e instale novas versões com backup automático.</p>
          </div>
        </div>
        {!updateInfo ? (
          <p className="muted">Consultando atualizações...</p>
        ) : updateInfo.error ? (
          <div className="updateState errorState">Não foi possível consultar o servidor de atualizações.</div>
        ) : !updateInfo.configured ? (
          <div className="updateState">
            <b>Servidor ainda não configurado</b>
            <span>Informe UPDATE_MANIFEST_URL no arquivo .env desta instalação.</span>
          </div>
        ) : updateInfo.available ? (
          <>
            <div className="updateVersions">
              <div><small>INSTALADA</small><b>{updateInfo.installedVersion}</b></div>
              <ChevronRight />
              <div><small>DISPONÍVEL</small><b>{updateInfo.manifest.version}</b></div>
              {updateInfo.manifest.required && <strong>Obrigatória</strong>}
            </div>
            {!!updateInfo.manifest.notes?.length && (
              <ul className="updateNotes">
                {updateInfo.manifest.notes.map((note: string) => <li key={note}>{note}</li>)}
              </ul>
            )}
            {updateInfo.compatible === false && (
              <div className="updateState errorState">
                Esta atualização exige o instalador completo do AtendeFlow.
              </div>
            )}
            {updateInfo.status && updateBusy === "install" && (
              <div className="updateProgress">
                <div><i style={{ width: `${updateInfo.status.progress || 0}%` }} /></div>
                <span>{updateInfo.status.message}</span>
              </div>
            )}
            <div className="updateActions">
              {updateInfo.compatible === false ? null : !updateInfo.ready ? (
                <button className="primary" onClick={downloadUpdate} disabled={!!updateBusy}>
                  <Download /> {updateBusy === "download" ? "Baixando e verificando..." : "Baixar atualização"}
                </button>
              ) : (
                <button className="primary" onClick={installUpdate} disabled={!!updateBusy}>
                  <RefreshCw /> {updateBusy === "install" ? "Atualizando..." : "Instalar agora"}
                </button>
              )}
              <button className="secondary" onClick={loadUpdate} disabled={!!updateBusy}>
                Verificar novamente
              </button>
            </div>
          </>
        ) : (
          <div className="updateState successState">
            <CheckCircle2 />
            <div><b>AtendeFlow atualizado</b><span>Versão instalada: {updateInfo.installedVersion}</span></div>
            <button className="secondary" onClick={loadUpdate}>Verificar novamente</button>
          </div>
        )}
      </article>
      <article className="panel form">
        <div className="settingTitle">
          <span>
            <KeyRound />
          </span>
          <div>
            <h3>Alterar minha senha</h3>
            <p>Use ao menos 8 caracteres.</p>
          </div>
        </div>
        <label>
          Senha atual
          <input
            type="password"
            autoComplete="current-password"
            value={password.currentPassword}
            onChange={(e) =>
              setPassword({ ...password, currentPassword: e.target.value })
            }
          />
        </label>
        <label>
          Nova senha
          <input
            type="password"
            autoComplete="new-password"
            value={password.newPassword}
            onChange={(e) =>
              setPassword({ ...password, newPassword: e.target.value })
            }
          />
        </label>
        <label>
          Confirmar nova senha
          <input
            type="password"
            autoComplete="new-password"
            value={password.confirmPassword}
            onChange={(e) =>
              setPassword({ ...password, confirmPassword: e.target.value })
            }
          />
        </label>
        <button
          className="primary"
          onClick={changePassword}
        >
          Alterar senha
        </button>
      </article>
      <article className="panel form">
        <div className="settingTitle">
          <span>
            <Download />
          </span>
          <div>
            <h3>Dados e backup</h3>
            <p>
              Exporte uma cópia legível ou use os scripts para backup completo.
            </p>
          </div>
        </div>
        <button className="primary" onClick={exportData}>
          <Download /> Exportar dados
        </button>
        <p className="muted">
          Backup completo: scripts/backup.ps1 · Restauração: scripts/restore.ps1
        </p>
      </article>
      <article className="panel form">
        <div className="settingTitle">
          <span>
            <Bell />
          </span>
          <div>
            <h3>Notificações</h3>
            <p>Receba avisos de novas conversas neste navegador.</p>
          </div>
        </div>
        <button className="primary" onClick={enableNotifications}>
          <Bell /> Ativar notificações
        </button>
      </article>
      {message && (
        <span
          className={`${messageKind === "error" ? "loginError" : "saved"} systemMessage`}
        >
          {message}
        </span>
      )}
    </>
  );
}
function LicenseSettings() {
  const [status, setStatus] = useState<any>(null),
    [key, setKey] = useState(""),
    [message, setMessage] = useState("");
  const load = () =>
    api("/license/status").then((next: any) => {
      setStatus(next);
      const days = next.expiresAt
        ? Math.ceil(
            (new Date(next.expiresAt).getTime() - Date.now()) / 86400000,
          )
        : 999;
      const notified = localStorage.getItem("atendeflow_license_alert");
      if (
        next.active &&
        days <= 7 &&
        days >= 0 &&
        notified !== next.expiresAt &&
        localStorage.getItem("atendeflow_notifications") === "true" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Licença perto do vencimento", {
          body: `A licença do AtendeFlow vence em ${days} dia(s).`,
          icon: "/atendeflow-icon.png",
        });
        localStorage.setItem("atendeflow_license_alert", next.expiresAt);
      }
    });
  useEffect(() => {
    load();
  }, []);
  async function replace() {
    try {
      const next = await api("/license/activate", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      setStatus(next);
      setKey("");
      setMessage("Licença atualizada com sucesso.");
    } catch (e: any) {
      try {
        setMessage(JSON.parse(e.message).error);
      } catch {
        setMessage("Não foi possível ativar esta chave.");
      }
    }
  }
  return (
    <article className="panel form hoursCard licenseSettings">
      <div className="settingTitle">
        <span>
          <Save />
        </span>
        <div>
          <h3>Licença do sistema</h3>
          <p>Consulte, renove ou substitua a licença desta instalação.</p>
        </div>
      </div>
      {status && (
        <div className="licenseSummary">
          <div>
            <small>STATUS</small>
            <b>
              {status.reason === "trial"
                ? "Avaliação de 7 dias"
                : status.active
                  ? "Licença ativa"
                  : "Licença vencida"}
            </b>
          </div>
          <div>
            <small>CLIENTE</small>
            <b>{status.customer || "Não ativado"}</b>
          </div>
          <div>
            <small>VÁLIDA ATÉ</small>
            <b>
              {status.expiresAt
                ? new Date(status.expiresAt).toLocaleDateString("pt-BR")
                : "—"}
            </b>
          </div>
        </div>
      )}
      <label>
        Código desta instalação
        <div className="installationCode">
          <code>{status?.installationId}</code>
          <button
            onClick={() =>
              navigator.clipboard.writeText(status?.installationId || "")
            }
          >
            Copiar
          </button>
        </div>
      </label>
      <label>
        Nova chave de ativação
        <textarea
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Cole uma nova chave para renovar ou trocar a licença atual"
        />
      </label>
      {message && (
        <span className={message.includes("sucesso") ? "saved" : "loginError"}>
          {message}
        </span>
      )}
      <button className="primary" disabled={!key.trim()} onClick={replace}>
        Trocar ou renovar licença
      </button>
    </article>
  );
}
function AdminTools() {
  const [users, setUsers] = useState<any[]>([]),
    [tags, setTags] = useState<any[]>([]),
    [tagForm, setTagForm] = useState({ name: "", color: "#245c3a" }),
    [u, setU] = useState({ name: "", email: "", password: "", role: "agent" }),
    [adminMessage, setAdminMessage] = useState(""),
    [adminError, setAdminError] = useState(""),
    [editingUser, setEditingUser] = useState<string | null>(null);
  const load = () => {
    api("/tags").then(setTags).catch(() => {});
    api("/users")
      .then(setUsers)
      .catch(() => setAdminError("Não foi possível carregar os atendentes."));
  };
  useEffect(load, []);
  async function addCustomerTag() {
    if (tagForm.name.trim().length < 2)
      return notify("Informe um nome para a etiqueta.", "error");
    try {
      await api("/tags", {
        method: "POST",
        body: JSON.stringify({ ...tagForm, name: tagForm.name.trim() }),
      });
      setTagForm({ name: "", color: "#245c3a" });
      load();
      notify("Etiqueta criada.");
    } catch (e: any) {
      try {
        notify(JSON.parse(e.message).error, "error");
      } catch {
        notify("Não foi possível criar a etiqueta.", "error");
      }
    }
  }
  async function deleteCustomerTag(tag: any) {
    if (!window.confirm(`Excluir a etiqueta ${tag.name}?`)) return;
    try {
      await api(`/tags/${tag.id}`, { method: "DELETE" });
      load();
      notify("Etiqueta excluída.");
    } catch {
      notify("Não foi possível excluir a etiqueta.", "error");
    }
  }
  function editUser(user: any) {
    setEditingUser(user.id);
    setU({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "agent",
    });
    setAdminError("");
    setAdminMessage("");
  }
  function cancelUserEdit() {
    setEditingUser(null);
    setU({ name: "", email: "", password: "", role: "agent" });
    setAdminError("");
  }
  async function saveUser() {
    setAdminError("");
    if (u.name.trim().length < 2)
      return setAdminError("Informe o nome do usuário.");
    if (!u.email.includes("@"))
      return setAdminError("Informe um e-mail válido.");
    if (!editingUser && u.password.length < 8)
      return setAdminError("A senha inicial precisa ter pelo menos 8 caracteres.");
    try {
      await api(editingUser ? `/users/${editingUser}` : "/users", {
        method: editingUser ? "PATCH" : "POST",
        body: JSON.stringify(
          editingUser
            ? { name: u.name.trim(), email: u.email.trim(), role: u.role }
            : u,
        ),
      });
      setU({ name: "", email: "", password: "", role: "agent" });
      const wasEditing = !!editingUser;
      setEditingUser(null);
      load();
      notify(
        wasEditing
          ? "Dados do atendente atualizados."
          : "Acesso criado. O usuário deverá trocar a senha no primeiro login.",
      );
    } catch (e: any) {
      try {
        setAdminError(JSON.parse(e.message).error);
      } catch {
        setAdminError("Não foi possível criar o usuário. Confira os dados.");
      }
    }
  }
  async function resetPassword(user: any) {
    if (!window.confirm(`Gerar uma senha temporária para ${user.name}?`))
      return;
    const result = await api(`/users/${user.id}/reset-password`, {
      method: "POST",
    });
    setAdminMessage(`Senha temporária de ${user.name}: ${result.password}`);
  }
  async function toggleUser(user: any) {
    await api(`/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !user.active }),
    });
    load();
  }
  async function deleteUser(user: any) {
    if (
      !window.confirm(
        `Excluir permanentemente o acesso de ${user.name}? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setAdminError("");
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      if (editingUser === user.id) cancelUserEdit();
      load();
      notify(`Atendente ${user.name} excluído.`);
    } catch (e: any) {
      try {
        setAdminError(JSON.parse(e.message).error);
      } catch {
        setAdminError("Não foi possível excluir o atendente.");
      }
    }
  }
  return (
    <>
      <article className="panel form tagSettings">
        <h3>Etiquetas de clientes</h3>
        <p className="muted">Organize os contatos exibidos na lista de clientes.</p>
        <div className="managedTags">
          {tags.map((tag) => (
            <span key={tag.id} style={{ borderColor: tag.color }}>
              <i style={{ background: tag.color }} />
              {tag.name}
              <button
                aria-label={`Excluir etiqueta ${tag.name}`}
                onClick={() => deleteCustomerTag(tag)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <label>
          Nome da etiqueta
          <input
            value={tagForm.name}
            placeholder="Ex: Cliente frequente"
            onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
          />
        </label>
        <label>
          Cor
          <input
            className="tagColorInput"
            type="color"
            value={tagForm.color}
            onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
          />
        </label>
        <button className="primary" onClick={addCustomerTag}>
          <Plus size={16} /> Criar etiqueta
        </button>
      </article>
      <article className="panel form">
        <h3>Atendentes</h3>
        <p className="muted">Crie acessos separados para sua equipe.</p>
        {users.map((x) => (
          <div
            className={`userAdminRow ${editingUser === x.id ? "editing" : ""}`}
            key={x.id}
          >
            <div>
              <b>{x.name}</b>
              <small>
                {x.role} ·{" "}
                {x.last_seen_at &&
                Date.now() - new Date(x.last_seen_at).getTime() < 120000
                  ? "online"
                  : "offline"}
              </small>
            </div>
            <button onClick={() => editUser(x)}>
              <Pencil size={12} /> Editar
            </button>
            <button onClick={() => resetPassword(x)}>Nova senha</button>
            <button
              className={x.active ? "dangerText" : ""}
              onClick={() => toggleUser(x)}
            >
              {x.active ? "Desativar" : "Ativar"}
            </button>
            <button className="deleteUserButton" onClick={() => deleteUser(x)}>
              <X size={12} /> Excluir
            </button>
          </div>
        ))}
        {adminMessage && (
          <div className="temporaryPassword">
            <b>Copie agora</b>
            <code>{adminMessage}</code>
            <button
              onClick={() =>
                navigator.clipboard.writeText(adminMessage.split(": ")[1] || "")
              }
            >
              Copiar senha
            </button>
          </div>
        )}
        <label>
          Nome
          <input
            autoComplete="off"
            value={u.name}
            onChange={(e) => setU({ ...u, name: e.target.value })}
          />
        </label>
        <label>
          E-mail
          <input
            type="email"
            autoComplete="off"
            value={u.email}
            onChange={(e) => setU({ ...u, email: e.target.value })}
          />
        </label>
        {!editingUser && (
          <label>
            Senha inicial
            <input
              type="password"
              autoComplete="new-password"
              value={u.password}
              onChange={(e) => setU({ ...u, password: e.target.value })}
            />
            <small>Use pelo menos 8 caracteres.</small>
          </label>
        )}
        <label>
          Perfil
          <select
            value={u.role}
            onChange={(e) => setU({ ...u, role: e.target.value })}
          >
            <option value="agent">Atendente</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        {adminError && <span className="loginError">{adminError}</span>}
        <div className="userFormActions">
          <button className="primary" onClick={saveUser}>
            {editingUser ? <Save size={16} /> : <Plus size={16} />}
            {editingUser ? "Salvar alterações" : "Criar acesso"}
          </button>
          {editingUser && (
            <button className="secondary" onClick={cancelUserEdit}>
              Cancelar
            </button>
          )}
        </div>
      </article>
    </>
  );
}
function AuthGate() {
  const [logged, setLogged] = useState(!!authToken);
  if (logged) return <LicenseGate />;
  return <Login onLogin={() => setLogged(true)} />;
}
function PasswordGate() {
  const [me, setMe] = useState<any>(null);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    api("/auth/me").then(setMe);
  }, []);
  if (!me)
    return (
      <div className="loginPage">
        <p>Preparando seu acesso…</p>
      </div>
    );
  if (!me.must_change_password) return <App />;
  async function change(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.currentPassword)
      return setError("Digite a senha temporária no campo Senha atual.");
    if (form.newPassword.length < 8)
      return setError("A nova senha precisa ter pelo menos 8 caracteres.");
    if (form.newPassword === form.currentPassword)
      return setError("A nova senha precisa ser diferente da senha temporária.");
    if (form.newPassword !== form.confirmPassword)
      return setError("A confirmação não corresponde à nova senha.");
    setLoading(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      setMe({ ...me, must_change_password: false });
    } catch (e: any) {
      try {
        setError(JSON.parse(e.message).error);
      } catch {
        setError("Não foi possível alterar a senha.");
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="loginPage">
      <form className="activationCard passwordChangeCard" onSubmit={change}>
        <img
          className="loginBrandLogo"
          src="/atendeflow-logo-green.png"
          alt="AtendeFlow"
        />
        <h1>Crie uma nova senha</h1>
        <p>Por segurança, a senha temporária precisa ser substituída.</p>
        <label>Senha atual</label>
        <input
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) => {
            setError("");
            setForm({ ...form, currentPassword: e.target.value });
          }}
        />
        <label>Nova senha</label>
        <input
          type="password"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => {
            setError("");
            setForm({ ...form, newPassword: e.target.value });
          }}
        />
        <small className="passwordHint">
          Use pelo menos 8 caracteres e não repita a senha temporária.
        </small>
        <label>Confirmar nova senha</label>
        <input
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => {
            setError("");
            setForm({ ...form, confirmPassword: e.target.value });
          }}
        />
        {error && (
          <span className="loginError passwordError" role="alert">
            {error}
          </span>
        )}
        <button
          type="submit"
          className="primary"
          disabled={loading}
        >
          {loading ? "Salvando nova senha..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
function LicenseGate() {
  const [status, setStatus] = useState<any>(null),
    [key, setKey] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    api("/license/status").then((next: any) => {
      setStatus(next);
      const days = next.expiresAt
        ? Math.ceil(
            (new Date(next.expiresAt).getTime() - Date.now()) / 86400000,
          )
        : 999;
      if (
        next.active &&
        days <= 7 &&
        days >= 0 &&
        localStorage.getItem("atendeflow_license_alert") !== next.expiresAt &&
        localStorage.getItem("atendeflow_notifications") === "true" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Licença perto do vencimento", {
          body: `A licença do AtendeFlow vence em ${days} dia(s).`,
          icon: "/atendeflow-icon.png",
        });
        localStorage.setItem("atendeflow_license_alert", next.expiresAt);
      }
    });
  useEffect(() => {
    load();
  }, []);
  async function activate() {
    try {
      setError("");
      const result = await api("/license/activate", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      setStatus(result);
    } catch (e: any) {
      try {
        setError(JSON.parse(e.message).error);
      } catch {
        setError("Chave de ativação inválida");
      }
    }
  }
  if (!status)
    return (
      <div className="loginPage">
        <p>Verificando licença…</p>
      </div>
    );
  if (status.active) return <PasswordGate />;
  return (
    <div className="loginPage">
      <div className="activationCard">
        <img
          className="loginBrandLogo"
          src="/atendeflow-logo-green.png"
          alt="AtendeFlow"
        />
        <h1>Ativação do sistema</h1>
        <p>
          {status.reason === "expired"
            ? "A licença desta instalação venceu."
            : "Esta instalação ainda não foi ativada."}
        </p>
        <label>Código da instalação</label>
        <div className="installationCode">
          <code>{status.installationId}</code>
          <button
            onClick={() => navigator.clipboard.writeText(status.installationId)}
          >
            Copiar
          </button>
        </div>
        <label>Chave de ativação</label>
        <textarea
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Cole aqui a chave gerada pelo licenciador"
        />
        {error && <span className="loginError">{error}</span>}
        <button className="primary" onClick={activate}>
          Ativar licença
        </button>
      </div>
    </div>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@lebeef.local"),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      authToken = r.token;
      localStorage.setItem("lebeef_token", r.token);
      onLogin();
    } catch {
      setError("E-mail ou senha incorretos");
    }
  }
  return (
    <div className="loginPage">
      <form onSubmit={login}>
        <img
          className="loginBrandLogo"
          src="/atendeflow-logo-green.png"
          alt="AtendeFlow"
        />
        <h1>AtendeFlow</h1>
        <p>Entre para acessar as conversas.</p>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        {error && <span className="loginError">{error}</span>}
        <button className="primary">Entrar</button>
      </form>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<AuthGate />);
