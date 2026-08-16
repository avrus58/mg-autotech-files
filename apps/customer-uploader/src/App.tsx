import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  Bell,
  Car,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Gauge,
  HelpCircle,
  History,
  Home,
  Loader2,
  LogOut,
  MessageSquare,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wifi,
  X,
} from "lucide-react";
import {
  apiBaseUrl,
  apiFetch,
  assertAppCheckAllowsWork,
  checkDesktopApp,
  createSupabaseBrowserClient,
  desktopAppVersion,
  desktopBuildChannel,
  desktopPlatform,
  getDesktopConfigurationStatus,
  getDesktopInstallationId,
  setDesktopInstallationId,
  uploadToPrivateStorage,
  type AppCheckPayload,
  type BootstrapPayload,
  type CustomerVisibleMessage,
  type DesktopRequest,
  type ServiceCatalog,
  type UploadProgressSnapshot,
} from "./api";
import { en } from "./i18n/en";
import { desktopModules, resolveEnabledModules } from "./modules/registry";
import {
  allowedExtensions,
  createIdempotencyKey,
  maxUploadBytes,
  safeUploadPayload,
  sha256File,
  validateUploadFile,
} from "./validation";

type VehicleOption = { id: string; name: string };
type VehicleState = {
  brands: VehicleOption[];
  models: VehicleOption[];
  generations: VehicleOption[];
  engines: VehicleOption[];
};

type AppView = "dashboard" | "new_request" | "requests" | "history" | "support" | "settings";
type WizardStep = "vehicle" | "service" | "file" | "notes" | "review" | "success";
type GateState = "checking" | "configuration_missing" | "server_unavailable" | "update_required" | "maintenance" | "login_required" | "ready";
type UploadPhase = "idle" | "checking" | "hashing" | "preparing" | "uploading" | "verifying" | "finalizing" | "submitted" | "failed";

type DesktopUploadSession = {
  upload: { path: string; signedUploadUrl: string; contentType: string };
  uploadContract: string;
  uploadSessionId: string;
  idempotencyKey: string;
  creditsRequired?: number;
};

type ActiveSubmission = {
  idempotencyKey: string;
  uploadSession?: DesktopUploadSession;
};

const supportEmail = "support@mgautotech.de";
const DESKTOP_TEXT_LIMITS = {
  ecu: 200,
  gearbox: 200,
  readMethod: 120,
  notes: 4000,
} as const;

function statusLabel(value: string | null) {
  return (value || "new_request").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildDesktopNotesPayload(notes: string, specialRequest: string, contactPreference: string) {
  return [
    notes,
    specialRequest && `Special request: ${specialRequest}`,
    contactPreference && `Contact preference: ${contactPreference}`,
  ].filter(Boolean).join("\n\n");
}

function fieldLimitError(label: string, value: string, limit: number) {
  return value.length > limit ? `${label} must be ${limit} characters or less.` : null;
}

function remainingText(value: string, limit: number) {
  return limit - value.length;
}

function formatBytes(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  if (safe >= 1024 * 1024 * 1024) return `${(safe / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (safe >= 1024 * 1024) return `${(safe / 1024 / 1024).toFixed(2)} MB`;
  if (safe >= 1024) return `${(safe / 1024).toFixed(1)} KB`;
  return `${safe} B`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatSpeed(value: number | null | undefined) {
  if (!value) return "Calculating";
  return `${formatBytes(value)}/s`;
}

function formatEta(value: number | null | undefined) {
  if (!value || value <= 0) return "Almost done";
  if (value < 60) return `${value}s remaining`;
  return `${Math.ceil(value / 60)}m remaining`;
}

function creditIsVerified(profile: BootstrapPayload["profile"] | null) {
  if (!profile || (profile.account_status ?? "active") !== "active") return false;
  return Number.isFinite(Number(profile.credit_balance ?? 0));
}

function gateForAppCheck(app: AppCheckPayload): GateState | null {
  if (app.update_required) return "update_required";
  if (app.maintenance_mode || !app.desktop_upload_enabled) return "maintenance";
  return null;
}

function safeNotify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission !== "denied") {
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") new Notification(title, { body });
      });
    }
  } catch {
    // Desktop notifications are optional; UI status remains the source of truth.
  }
}

function uniqueServiceTitle(primary: string | undefined, extras: string[]) {
  return [primary, ...extras].filter(Boolean).join(" + ") || "Not available";
}

export default function App() {
  const [gate, setGate] = useState<GateState>("checking");
  const [view, setView] = useState<AppView>("dashboard");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>(en.startupChecking);
  const [loading, setLoading] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [appCheck, setAppCheck] = useState<AppCheckPayload | null>(null);
  const [history, setHistory] = useState<SafeUploadHistoryRow[]>([]);
  const [creditVerified, setCreditVerified] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [nativeUpdateStatus, setNativeUpdateStatus] = useState<string>("Not checked");
  const [toast, setToast] = useState("");
  const [dtcInfoOpen, setDtcInfoOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const verifyOnline = useCallback(async (activeSession?: Session | null) => {
    try {
      const result = await checkDesktopApp(activeSession ?? null);
      setAppCheck(result);
      const blockedGate = gateForAppCheck(result);
      if (blockedGate) {
        setGate(blockedGate);
        setMessage(blockedGate === "update_required" ? en.unsupportedVersion : en.maintenanceMessage);
        assertAppCheckAllowsWork(result);
      }
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes("no longer supported")) {
        setGate("update_required");
        setMessage(en.unsupportedVersion);
      } else if (error instanceof Error && error.message.includes("Maintenance mode")) {
        setGate("maintenance");
        setMessage(en.maintenanceMessage);
      } else {
        setGate("server_unavailable");
        setMessage(en.unavailableMessage);
      }
      throw error;
    }
  }, []);

  const loadBootstrap = useCallback(async (activeSession: Session) => {
    await verifyOnline(activeSession);
    const data = await apiFetch<BootstrapPayload>("/api/desktop/bootstrap", activeSession);
    setBootstrap(data);
    setCreditVerified(creditIsVerified(data.profile));
    setLastSyncAt(new Date().toISOString());
    setGate("ready");
    setMessage(en.connectionSuccessful);
  }, [verifyOnline]);

  const initialize = useCallback(async () => {
    setGate("checking");
    setMessage(en.startupChecking);
    setSession(null);
    setBootstrap(null);
    setCreditVerified(false);
    try {
      const configuration = getDesktopConfigurationStatus();
      if (!configuration.ok) {
        console.error("Desktop application configuration is missing:", configuration.missing.join(", "));
        setGate("configuration_missing");
        setMessage(en.configurationMissing);
        return;
      }
      const id = await window.mgDesktop?.getInstallationId();
      if (!id) throw new Error("Installation verification unavailable.");
      setDesktopInstallationId(id);
      const result = await verifyOnline(null);
      const blockedGate = gateForAppCheck(result);
      if (blockedGate) return;
      setGate("login_required");
      setMessage(en.loginRequired);
    } catch {
      // verifyOnline sets the visible gate and message.
    }
  }, [verifyOnline]);

  useEffect(() => {
    void window.mgDesktop?.readHistory().then((rows) => setHistory(Array.isArray(rows) ? rows : []));
    void Promise.resolve().then(initialize);
  }, [initialize]);

  async function login() {
    setLoading(true);
    setMessage("");
    try {
      await verifyOnline(null);
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.session) throw new Error(result.error?.message || "Login failed.");
      setSession(result.data.session);
      await loadBootstrap(result.data.session);
      setView("dashboard");
    } catch (error) {
      if (gate === "login_required") {
        setMessage(error instanceof Error ? error.message : "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch (error) {
      console.error("Desktop logout could not reach Supabase client:", error);
    }
    setSession(null);
    setBootstrap(null);
    setCreditVerified(false);
    setPassword("");
    setView("dashboard");
    setGate("login_required");
    setMessage(en.loginRequired);
  }

  async function refreshDashboard() {
    if (!session) return;
    setToast("Refreshing...");
    await loadBootstrap(session);
    setToast("Dashboard refreshed.");
  }

  async function rememberUpload(row: SafeUploadHistoryRow) {
    const next = [row, ...history.filter((item) => item.requestId !== row.requestId)].slice(0, 50);
    setHistory(next);
    await window.mgDesktop?.writeHistory(next);
  }

  async function clearLocalHistory() {
    if (!window.confirm("Clear local upload history? This only removes safe metadata stored on this computer.")) return;
    setHistory([]);
    await window.mgDesktop?.writeHistory([]);
    setToast("Local history cleared.");
  }

  async function checkNativeUpdate() {
    setNativeUpdateStatus("Checking...");
    const result = await window.mgDesktop?.checkNativeUpdate();
    if (!result) {
      setNativeUpdateStatus("Native update check is not available.");
      return;
    }
    if (!result.configured) setNativeUpdateStatus(result.message || "Native updater feed is not configured.");
    else if (result.error) setNativeUpdateStatus(result.error);
    else if (result.updateAvailable) setNativeUpdateStatus(`Update available: ${result.version || "latest"}`);
    else setNativeUpdateStatus("No native update package reported.");
  }

  if (gate === "checking" || gate === "configuration_missing" || gate === "server_unavailable" || gate === "update_required" || gate === "maintenance") {
    return <GateScreen gate={gate} message={message} app={appCheck} onRetry={initialize} />;
  }

  if (!session || !bootstrap) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">MG</div>
          <div className="eyebrow">MG AutoTech</div>
          <h1>File Upload Assistant</h1>
          <p className="muted">Secure Windows upload app for authenticated MG AutoTech customers. Online verification is required every session.</p>
          {appCheck && <div className="status-pill"><Wifi /> {en.connectionSuccessful}</div>}
          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" autoComplete="email" />
          <label>Password</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="********" autoComplete="current-password" />
          {message && message !== en.loginRequired && <div className="alert">{message}</div>}
          <button onClick={() => void login()} disabled={loading || !email || !password}>
            {loading ? <Loader2 className="spin" /> : <ShieldCheck />} {en.login}
          </button>
          <button className="ghost" onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/register`)}>
            Create Account <ExternalLink />
          </button>
        </section>
      </main>
    );
  }

  const allowedModuleIds = Array.from(new Set([...(bootstrap.app?.allowed_modules ?? []), "support", "dtc_tools_beta_visible"]));
  const enabledModules = resolveEnabledModules(allowedModuleIds);
  const activeApp = bootstrap.app ?? appCheck;

  return (
    <main className="app-shell">
      <aside>
        <div className="brand-row"><div className="brand-small">MG</div><div><strong>MG AutoTech</strong><span>File Upload Assistant</span></div></div>
        <div className="profile-box">
          <div className="muted">Customer</div>
          <strong>{bootstrap.profile.full_name || bootstrap.profile.customer_id || bootstrap.profile.email || "Not available"}</strong>
          <span>{bootstrap.profile.customer_id || "Customer ID not available"}</span>
          <span>{Number(bootstrap.profile.credit_balance ?? 0)} credits verified online</span>
        </div>
        <nav className="side-nav">
          <NavButton active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<Home />} label="Dashboard" />
          <NavButton active={view === "new_request"} onClick={() => setView("new_request")} icon={<UploadCloud />} label="New Request" />
          <NavButton active={view === "requests"} onClick={() => setView("requests")} icon={<FileText />} label="Requests" />
          <NavButton active={view === "history"} onClick={() => setView("history")} icon={<History />} label="Local History" />
          <NavButton active={view === "support"} onClick={() => setView("support")} icon={<HelpCircle />} label="Support" />
          <NavButton active={view === "settings"} onClick={() => setView("settings")} icon={<Settings />} label="Settings" />
        </nav>
        <ModuleList allowedModules={allowedModuleIds} />
        {!creditVerified && <div className="alert"><AlertTriangle /> {en.creditUnavailable}</div>}
        <button className="nav-action" onClick={() => void refreshDashboard()}><RefreshCcw /> Refresh Dashboard</button>
        <button className="nav-action" onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/dashboard`)}>Open Web Dashboard <ExternalLink /></button>
        <button className="nav-action danger" onClick={() => void logout()}><LogOut /> {en.logout}</button>
      </aside>
      <section className="workspace">
        {activeApp?.update_available && !activeApp.update_required && (
          <UpdateBanner app={activeApp} />
        )}
        <header>
          <div>
            <div className="eyebrow">Customer Upload Platform</div>
            <h1>{viewTitle(view)}</h1>
          </div>
          <div className="secure-note"><ShieldCheck /> Online Verified Private Upload</div>
        </header>
        {toast && <div className="toast" onAnimationEnd={() => setToast("")}>{toast}</div>}
        {view === "dashboard" && (
          <DashboardHome
            profile={bootstrap.profile}
            requests={bootstrap.requests}
            history={history}
            app={activeApp}
            creditVerified={creditVerified}
            lastSyncAt={lastSyncAt}
            enabledModules={enabledModules}
            onNewRequest={() => setView("new_request")}
            onRequests={() => setView("requests")}
            onSupport={() => setView("support")}
            onDtcInfo={() => setDtcInfoOpen(true)}
          />
        )}
        {view === "new_request" && (
          <RequestWizard
            session={session}
            catalog={bootstrap.services}
            limits={bootstrap.limits}
            creditVerified={creditVerified}
            history={history}
            verifyOnline={verifyOnline}
            onSuccess={(row) => {
              void rememberUpload(row);
              void refreshDashboard();
            }}
          />
        )}
        {view === "requests" && (
          <RequestsPanel
            session={session}
            requests={bootstrap.requests}
            onRefresh={refreshDashboard}
          />
        )}
        {view === "history" && (
          <HistoryPanel history={history} onClear={clearLocalHistory} />
        )}
        {view === "support" && (
          <SupportPanel
            profile={bootstrap.profile}
            app={activeApp}
            lastSyncAt={lastSyncAt}
            onCopied={(value) => setToast(value)}
          />
        )}
        {view === "settings" && (
          <SettingsPanel
            app={activeApp}
            theme={theme}
            onTheme={setTheme}
            nativeUpdateStatus={nativeUpdateStatus}
            onCheckNativeUpdate={checkNativeUpdate}
            onClearHistory={clearLocalHistory}
            onLogout={logout}
          />
        )}
        {dtcInfoOpen && <DtcComingSoonModal onClose={() => setDtcInfoOpen(false)} />}
      </section>
    </main>
  );
}

function viewTitle(view: AppView) {
  switch (view) {
    case "new_request": return "New File-Service Request";
    case "requests": return "Request Status";
    case "history": return "Local Upload History";
    case "support": return "Support";
    case "settings": return "Settings";
    default: return "Dashboard";
  }
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick(): void; icon: ReactNode; label: string }) {
  return <button className={active ? "nav-action active" : "nav-action"} onClick={onClick}>{icon}{label}</button>;
}

function UpdateBanner({ app }: { app: AppCheckPayload }) {
  return (
    <div className="update-banner">
      <div>
        <strong>{en.updateAvailable}</strong>
        <span>{en.optionalUpdate}</span>
      </div>
      <div className="banner-actions">
        {app.update_url && <button onClick={() => void window.mgDesktop?.openExternal(app.update_url || "")}>{en.updateNow}</button>}
        {app.release_notes_url && <button className="ghost" onClick={() => void window.mgDesktop?.openExternal(app.release_notes_url || "")}>{en.viewReleaseNotes}</button>}
      </div>
    </div>
  );
}

function ModuleList({ allowedModules }: { allowedModules: string[] }) {
  const modules = resolveEnabledModules(allowedModules);
  const future = desktopModules.filter((module) => !module.customerVisible);
  return (
    <div className="module-list">
      <div className="muted">Available modules</div>
      {modules.map((module) => (
        <span key={module.id}>{module.name}{module.badge ? ` - ${module.badge}` : ""}</span>
      ))}
      {!modules.length && <span>Core access only</span>}
      <div className="muted tiny">Future modules hidden: {future.length}</div>
    </div>
  );
}

function GateScreen({ gate, message, app, onRetry }: { gate: GateState; message: string; app: AppCheckPayload | null; onRetry(): Promise<void> }) {
  const title = gate === "checking"
    ? en.startupChecking
    : gate === "configuration_missing"
      ? en.configurationError
      : gate === "server_unavailable"
        ? en.serverUnavailable
        : gate === "update_required"
          ? en.updateRequired
          : en.maintenanceActive;

  return (
    <main className="login-shell">
      <section className="login-card status-card">
        <div className="brand-mark">MG</div>
        <div className="eyebrow">MG AutoTech</div>
        <h1>{title}</h1>
        <p className="muted preline">{message}</p>
        {gate === "checking" && <p className="muted">{en.checkingUpdates}</p>}
        {gate === "checking" && <Loader2 className="spin large-icon" />}
        {gate !== "checking" && (
          <div className="status-actions">
            {gate === "update_required" && (
              <button onClick={() => void window.mgDesktop?.openExternal(app?.update_url || `${apiBaseUrl}/desktop`)}>
                {en.updateNow}
              </button>
            )}
            {gate === "update_required" && app?.release_notes_url && (
              <button className="ghost" onClick={() => void window.mgDesktop?.openExternal(app.release_notes_url || "")}>
                {en.viewReleaseNotes}
              </button>
            )}
            <button onClick={() => void onRetry()}>{en.retry}</button>
            <button className="ghost" onClick={() => void window.mgDesktop?.closeApp()}>{en.closeApp}</button>
          </div>
        )}
      </section>
    </main>
  );
}

function DashboardHome({
  profile,
  requests,
  history,
  app,
  creditVerified,
  lastSyncAt,
  enabledModules,
  onNewRequest,
  onRequests,
  onSupport,
  onDtcInfo,
}: {
  profile: BootstrapPayload["profile"];
  requests: DesktopRequest[];
  history: SafeUploadHistoryRow[];
  app: AppCheckPayload | null;
  creditVerified: boolean;
  lastSyncAt: string | null;
  enabledModules: ReturnType<typeof resolveEnabledModules>;
  onNewRequest(): void;
  onRequests(): void;
  onSupport(): void;
  onDtcInfo(): void;
}) {
  return (
    <div className="dashboard-grid">
      <section className="panel span-2">
        <div className="section-head">
          <div>
            <h2><Home /> Welcome</h2>
            <p className="muted">{profile.full_name || profile.email || "Customer"} - secure desktop upload access is verified online.</p>
          </div>
          <button onClick={onNewRequest}><UploadCloud /> Upload File</button>
        </div>
        <div className="status-grid">
          <StatusCard icon={<Wifi />} title="Connected to MG AutoTech" value="Online" tone="ok" />
          <StatusCard icon={<CreditCard />} title="Credits verified" value={creditVerified ? `${Number(profile.credit_balance ?? 0)} credits` : "Please refresh"} tone={creditVerified ? "ok" : "warn"} />
          <StatusCard icon={<ShieldCheck />} title="Desktop uploads" value={app?.desktop_upload_enabled ? "Enabled" : "Disabled"} tone={app?.desktop_upload_enabled ? "ok" : "warn"} />
          <StatusCard icon={<Activity />} title="Update status" value={app?.update_available ? "Update available" : "Latest version installed"} tone={app?.update_available ? "warn" : "ok"} />
        </div>
      </section>
      <section className="panel">
        <h2><Gauge /> Account</h2>
        <InfoLine label="Customer ID" value={profile.customer_id || "Not available"} />
        <InfoLine label="Email" value={profile.email || "Not available"} />
        <InfoLine label="Account status" value={profile.account_status || "active"} />
        <InfoLine label="Last server sync" value={formatDate(lastSyncAt)} />
        <InfoLine label="App version" value={desktopAppVersion} />
      </section>
      <section className="panel">
        <h2><Activity /> Modules</h2>
        <div className="module-cards">
          {enabledModules.map((module) => (
            <article key={module.id} className={module.comingSoon ? "module-card coming-soon" : "module-card"}>
              <div className="module-title-row">
                <strong>{module.name}</strong>
                {module.badge && <span className="beta-badge">{module.badge}</span>}
              </div>
              <span>{module.description}</span>
              {module.id === "dtc_tools_beta_visible" ? (
                <button className="ghost locked-button" onClick={onDtcInfo}>{module.buttonLabel || "Coming Soon"}</button>
              ) : (
                <span className="module-state">Available</span>
              )}
            </article>
          ))}
        </div>
        <p className="muted tiny">Future diagnostics and tuning modules are hidden and cannot edit binaries or generate MOD files. DTC Tools is visible only as a non-functional beta preview.</p>
      </section>
      <section className="panel">
        <div className="section-head compact-head">
          <h2><FileText /> Recent Requests</h2>
          <button className="ghost" onClick={onRequests}>View All</button>
        </div>
        <RequestList requests={requests.slice(0, 5)} />
      </section>
      <section className="panel">
        <div className="section-head compact-head">
          <h2><History /> Local History</h2>
          <button className="ghost" onClick={onSupport}>Support</button>
        </div>
        <p className="muted">Local history only. Server status is verified online.</p>
        <div className="list compact">
          {history.slice(0, 4).map((item) => (
            <article key={item.requestId}>
              <strong>{item.fileName}</strong>
              <span>{statusLabel(item.status)} / {formatBytes(item.fileSize)}</span>
            </article>
          ))}
          {!history.length && <p className="muted">No local upload metadata stored yet.</p>}
        </div>
      </section>
    </div>
  );
}

function DtcComingSoonModal({ onClose }: { onClose(): void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dtc-coming-soon-title">
      <section className="modal-card">
        <div className="section-head compact-head">
          <h2 id="dtc-coming-soon-title">DTC Tools - Coming Soon</h2>
          <button className="ghost mini" onClick={onClose}><X /> Close</button>
        </div>
        <p className="muted">
          DTC Tools are currently in beta. This module will allow structured DTC request preparation in a future release. No file modification is performed in this version.
        </p>
        <button onClick={onClose}>Close</button>
      </section>
    </div>
  );
}

function StatusCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: string; tone: "ok" | "warn" | "neutral" }) {
  return (
    <article className={`status-tile ${tone}`}>
      {icon}
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RequestsPanel({ session, requests, onRefresh }: { session: Session; requests: DesktopRequest[]; onRefresh(): Promise<void> }) {
  const [selectedId, setSelectedId] = useState(requests[0]?.id ?? "");
  const [messages, setMessages] = useState<CustomerVisibleMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const selected = requests.find((request) => request.id === selectedId);

  async function loadMessages(requestId = selectedId) {
    if (!requestId) return;
    setLoadingMessages(true);
    try {
      const result = await apiFetch<{ messages: CustomerVisibleMessage[] }>(`/api/requests/${encodeURIComponent(requestId)}/messages`, session);
      setMessages(result.messages ?? []);
    } finally {
      setLoadingMessages(false);
    }
  }

  function selectRequest(requestId: string) {
    setSelectedId(requestId);
    setMessages([]);
    void loadMessages(requestId);
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="section-head compact-head">
          <h2><FileText /> Requests</h2>
          <button className="ghost" onClick={() => void onRefresh()}><RefreshCcw /> Refresh</button>
        </div>
        <RequestList requests={requests} selectedId={selectedId} onSelect={selectRequest} />
      </section>
      <section className="panel">
        <h2><MessageSquare /> Request Details</h2>
        {selected ? (
          <>
            <InfoLine label="Request" value={selected.id} />
            <InfoLine label="Vehicle" value={`${selected.vehicle_brand || ""} ${selected.vehicle_model || ""} ${selected.vehicle_generation || ""} ${selected.vehicle_engine || ""}`.trim() || "Not available"} />
            <InfoLine label="Services" value={selected.service_type || "Not available"} />
            <InfoLine label="Status" value={statusLabel(selected.status)} />
            <InfoLine label="Created" value={formatDate(selected.created_at)} />
            <button onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/dashboard/orders/${selected.id}`)}>Open Web Request <ExternalLink /></button>
            <div className="section-head compact-head messages-head">
              <h3>Customer-visible messages</h3>
              <button className="ghost" onClick={() => void loadMessages()} disabled={loadingMessages}>
                {loadingMessages ? <Loader2 className="spin" /> : <RefreshCcw />} Refresh
              </button>
            </div>
            <div className="list compact">
              {messages.map((message) => (
                <article key={message.id}>
                  <strong>{message.sender_role === "admin" ? "MG AutoTech" : "You"}</strong>
                  <span>{formatDate(message.created_at)}</span>
                  <p>{message.message}</p>
                </article>
              ))}
              {!messages.length && <p className="muted">No customer-visible messages found.</p>}
            </div>
          </>
        ) : (
          <p className="muted">No requests found.</p>
        )}
      </section>
    </div>
  );
}

function RequestList({ requests, selectedId, onSelect }: { requests: DesktopRequest[]; selectedId?: string; onSelect?(id: string): void }) {
  return (
    <div className="list">
      {requests.map((request) => (
        <button key={request.id} className={selectedId === request.id ? "request-row active" : "request-row"} onClick={() => onSelect?.(request.id)}>
          <span>
            <strong>{request.vehicle_brand || "Vehicle"} {request.vehicle_model || ""}</strong>
            <small>{request.service_type || "Service not available"} / {formatDate(request.created_at)}</small>
          </span>
          <em>{statusLabel(request.status)}</em>
        </button>
      ))}
      {!requests.length && <p className="muted">No requests yet.</p>}
    </div>
  );
}

function HistoryPanel({ history, onClear }: { history: SafeUploadHistoryRow[]; onClear(): Promise<void> }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? history : history.filter((row) => row.status === filter);
  const statuses = Array.from(new Set(history.map((row) => row.status))).sort();
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2><History /> Local Upload History</h2>
          <p className="muted">Local history only. Server status is verified online. No raw file content is stored here.</p>
        </div>
        <button className="ghost danger" onClick={() => void onClear()} disabled={!history.length}><Trash2 /> Clear Local History</button>
      </div>
      <div className="filter-row">
        <button className={filter === "all" ? "chip active" : "chip"} onClick={() => setFilter("all")}>All</button>
        {statuses.map((status) => <button key={status} className={filter === status ? "chip active" : "chip"} onClick={() => setFilter(status)}>{statusLabel(status)}</button>)}
      </div>
      <div className="history-table">
        {filtered.map((item) => (
          <article key={item.requestId}>
            <strong>{item.fileName}</strong>
            <span>{item.vehicleSummary || "Vehicle not available"}</span>
            <span>{item.serviceSummary || "Service not available"}</span>
            <code>{item.sha256}</code>
            <em>{statusLabel(item.status)} / {formatBytes(item.fileSize)}</em>
            {item.requestId && !item.requestId.startsWith("local-") && (
              <button className="ghost" onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/dashboard/orders/${item.requestId}`)}>Open Request <ExternalLink /></button>
            )}
          </article>
        ))}
        {!filtered.length && <p className="muted">No local history entries match this filter.</p>}
      </div>
    </section>
  );
}

function SupportPanel({
  profile,
  app,
  lastSyncAt,
  onCopied,
}: {
  profile: BootstrapPayload["profile"];
  app: AppCheckPayload | null;
  lastSyncAt: string | null;
  onCopied(value: string): void;
}) {
  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    onCopied(`${label} copied.`);
  }

  async function copyDiagnostics() {
    const diagnostic = {
      appVersion: desktopAppVersion,
      platform: desktopPlatform,
      buildChannel: desktopBuildChannel,
      installationId: getDesktopInstallationId(),
      apiBaseUrl,
      lastAppCheck: app ? {
        latestVersion: app.latest_version,
        minimumSupportedVersion: app.minimum_supported_version,
        updateRequired: app.update_required,
        updateAvailable: app.update_available,
        maintenanceMode: app.maintenance_mode,
        desktopUploadEnabled: app.desktop_upload_enabled,
      } : null,
      lastServerSync: lastSyncAt,
      customerId: profile.customer_id,
      email: profile.email,
    };
    await copy(JSON.stringify(diagnostic, null, 2), "Diagnostic info");
  }

  return (
    <div className="grid">
      <section className="panel">
        <h2><HelpCircle /> Support</h2>
        <p className="muted">Use these details when contacting MG AutoTech support. Diagnostic information never includes tokens, raw file content or private storage paths.</p>
        <InfoLine label="Support email" value={supportEmail} />
        <InfoLine label="Website" value={apiBaseUrl} />
        <InfoLine label="App version" value={desktopAppVersion} />
        <InfoLine label="Installation ID" value={getDesktopInstallationId() || "Not available"} />
        <div className="button-row wrap">
          <button onClick={() => void copy(supportEmail, "Support email")}><Copy /> Copy Email</button>
          <button className="ghost" onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/contact`)}>Open Contact Page <ExternalLink /></button>
          <button className="ghost" onClick={() => void copyDiagnostics()}><Copy /> Copy Diagnostic Info</button>
        </div>
      </section>
      <section className="panel">
        <h2><Bell /> Notifications</h2>
        <p className="muted">The app can show local notifications for upload success, upload failure, login expiry and server availability changes when Windows allows notifications.</p>
        <StatusCard icon={<ShieldCheck />} title="Notification safety" value="Customer-safe only" tone="ok" />
      </section>
    </div>
  );
}

function SettingsPanel({
  app,
  theme,
  onTheme,
  nativeUpdateStatus,
  onCheckNativeUpdate,
  onClearHistory,
  onLogout,
}: {
  app: AppCheckPayload | null;
  theme: "dark" | "light" | "system";
  onTheme(value: "dark" | "light" | "system"): void;
  nativeUpdateStatus: string;
  onCheckNativeUpdate(): Promise<void>;
  onClearHistory(): Promise<void>;
  onLogout(): Promise<void>;
}) {
  return (
    <div className="grid">
      <section className="panel">
        <h2><Settings /> Application</h2>
        <InfoLine label="API base URL" value={apiBaseUrl} />
        <InfoLine label="App version" value={desktopAppVersion} />
        <InfoLine label="Build channel" value={desktopBuildChannel} />
        <InfoLine label="Installation ID" value={getDesktopInstallationId() || "Not available"} />
        <label>Theme</label>
        <select value={theme} onChange={(event) => onTheme(event.target.value as "dark" | "light" | "system")}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
        <p className="muted tiny">Production builds are locked to MG AutoTech endpoints. API base URL changes are not available for customers.</p>
      </section>
      <section className="panel">
        <h2><Activity /> Updates</h2>
        <InfoLine label="Latest version" value={app?.latest_version || "Not available"} />
        <InfoLine label="Minimum supported" value={app?.minimum_supported_version || "Not available"} />
        <InfoLine label="Update required" value={app?.update_required ? "Yes" : "No"} />
        <InfoLine label="Native update check" value={nativeUpdateStatus} />
        <div className="button-row wrap">
          <button onClick={() => void onCheckNativeUpdate()}><RefreshCcw /> Check for Updates</button>
          {app?.update_url && <button className="ghost" onClick={() => void window.mgDesktop?.openExternal(app.update_url || "")}>Update Now <ExternalLink /></button>}
          {app?.release_notes_url && <button className="ghost" onClick={() => void window.mgDesktop?.openExternal(app.release_notes_url || "")}>Release Notes <ExternalLink /></button>}
        </div>
      </section>
      <section className="panel span-2">
        <h2><ShieldCheck /> Privacy and Session</h2>
        <p className="muted">Logout clears the in-memory session. Local history contains safe metadata only and cannot be used to create offline requests or spend credits.</p>
        <div className="button-row wrap">
          <button className="ghost danger" onClick={() => void onClearHistory()}><Trash2 /> Clear Local History</button>
          <button className="ghost" onClick={() => void window.mgDesktop?.openAppDataFolder()}><ExternalLink /> Open App Data Folder</button>
          <button className="danger" onClick={() => void onLogout()}><LogOut /> Logout</button>
        </div>
      </section>
    </div>
  );
}

function RequestWizard({
  session,
  catalog,
  limits,
  creditVerified,
  history,
  verifyOnline,
  onSuccess,
}: {
  session: Session;
  catalog: ServiceCatalog;
  limits: BootstrapPayload["limits"];
  creditVerified: boolean;
  history: SafeUploadHistoryRow[];
  verifyOnline(activeSession?: Session | null): Promise<AppCheckPayload>;
  onSuccess(row: SafeUploadHistoryRow): void;
}) {
  const [step, setStep] = useState<WizardStep>("vehicle");
  const [vehicleMode, setVehicleMode] = useState<"catalog" | "manual">("catalog");
  const [vehicle, setVehicle] = useState<VehicleState>({ brands: [], models: [], generations: [], engines: [] });
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [engineId, setEngineId] = useState("");
  const [manualVehicle, setManualVehicle] = useState({ brand: "", model: "", generation: "", engine: "" });
  const [primaryServiceId, setPrimaryServiceId] = useState("stage_1");
  const [extraServiceIds, setExtraServiceIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sha256, setSha256] = useState("");
  const [notes, setNotes] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [contactPreference, setContactPreference] = useState("Dashboard message");
  const [ecu, setEcu] = useState("");
  const [readMethod, setReadMethod] = useState("");
  const [gearbox, setGearbox] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgressSnapshot | null>(null);
  const [requestId, setRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [submission, setSubmission] = useState<ActiveSubmission | null>(null);

  const loadOptions = useCallback(async (type: "brands" | "models" | "generations" | "engines", params: Record<string, string> = {}) => {
    await verifyOnline(session);
    const search = new URLSearchParams({ type, ...params });
    const response = await fetch(`${apiBaseUrl}/api/vehicles?${search.toString()}`);
    if (!response.ok) throw new Error("Vehicle data could not be loaded.");
    return (await response.json()) as VehicleOption[];
  }, [session, verifyOnline]);

  useEffect(() => {
    void loadOptions("brands")
      .then((brands) => setVehicle((current) => ({ ...current, brands })))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Vehicle data could not be loaded."));
  }, [loadOptions]);

  useEffect(() => {
    if (!brandId) return;
    void loadOptions("models", { brandId })
      .then((models) => setVehicle((current) => ({ ...current, models, generations: [], engines: [] })))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Models could not be loaded."));
  }, [brandId, loadOptions]);

  useEffect(() => {
    if (!brandId || !modelId) return;
    void loadOptions("generations", { brandId, modelId })
      .then((generations) => setVehicle((current) => ({ ...current, generations, engines: [] })))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Generations could not be loaded."));
  }, [brandId, loadOptions, modelId]);

  useEffect(() => {
    if (!brandId || !modelId || !generationId) return;
    void loadOptions("engines", { brandId, modelId, generationId })
      .then((engines) => setVehicle((current) => ({ ...current, engines })))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Engines could not be loaded."));
  }, [brandId, generationId, loadOptions, modelId]);

  const selectedBrand = vehicle.brands.find((item) => item.id === brandId);
  const selectedModel = vehicle.models.find((item) => item.id === modelId);
  const selectedGeneration = vehicle.generations.find((item) => item.id === generationId);
  const selectedEngine = vehicle.engines.find((item) => item.id === engineId);
  const vehicleNames = vehicleMode === "manual"
    ? {
      brand: manualVehicle.brand.trim(),
      model: manualVehicle.model.trim(),
      generation: manualVehicle.generation.trim(),
      engine: manualVehicle.engine.trim(),
    }
    : {
      brand: selectedBrand?.name || "",
      model: selectedModel?.name || "",
      generation: selectedGeneration?.name || "",
      engine: selectedEngine?.name || "",
    };
  const vehicleSummary = `${vehicleNames.brand} ${vehicleNames.model} ${vehicleNames.generation} ${vehicleNames.engine}`.replace(/\s+/g, " ").trim();
  const selectedPrimary = catalog.primary.find((item) => item.id === primaryServiceId);
  const selectedExtras = catalog.extraCategories.flatMap((category) => category.services).filter((item) => extraServiceIds.includes(item.id));
  const totalCredits = (selectedPrimary?.credits ?? 0) + selectedExtras.reduce((sum, item) => sum + item.credits, 0);
  const serviceSummary = uniqueServiceTitle(selectedPrimary?.title, selectedExtras.map((item) => item.title));
  const duplicateFingerprint = Boolean(sha256 && history.some((item) => item.sha256 === sha256));
  const fileWarnings = useMemo(() => buildFileWarnings(file, sha256, duplicateFingerprint, limits), [file, sha256, duplicateFingerprint, limits]);
  const hasVehicle = Boolean(vehicleNames.brand && vehicleNames.model && vehicleNames.engine);
  const hasService = Boolean(selectedPrimary);
  const hasFile = Boolean(file && sha256);
  const draftFilled = Boolean(hasVehicle || hasService || file || notes || ecu || readMethod || specialRequest);
  const notesPayload = buildDesktopNotesPayload(notes, specialRequest, contactPreference);
  const textLimitError = fieldLimitError("ECU / TCU", ecu, DESKTOP_TEXT_LIMITS.ecu)
    ?? fieldLimitError("Gearbox / TCU details", gearbox, DESKTOP_TEXT_LIMITS.gearbox)
    ?? fieldLimitError("Read method", readMethod, DESKTOP_TEXT_LIMITS.readMethod)
    ?? fieldLimitError("Combined notes", notesPayload, DESKTOP_TEXT_LIMITS.notes);
  const notesPayloadRemaining = remainingText(notesPayload, DESKTOP_TEXT_LIMITS.notes);

  function chooseBrand(value: string) {
    setBrandId(value);
    setModelId("");
    setGenerationId("");
    setEngineId("");
    setVehicle((current) => ({ ...current, models: [], generations: [], engines: [] }));
  }

  function chooseModel(value: string) {
    setModelId(value);
    setGenerationId("");
    setEngineId("");
    setVehicle((current) => ({ ...current, generations: [], engines: [] }));
  }

  function chooseGeneration(value: string) {
    setGenerationId(value);
    setEngineId("");
    setVehicle((current) => ({ ...current, engines: [] }));
  }

  async function onFileSelected(nextFile: File) {
    setMessage("");
    const validation = validateUploadFile(nextFile);
    if (!validation.ok) {
      setMessage(validation.error);
      return;
    }
    if (file?.name === nextFile.name && file.size === nextFile.size) {
      setMessage("This file is already selected.");
      return;
    }
    setFile(nextFile);
    setSha256("");
    setSubmission(null);
    setBusy(true);
    setPhase("hashing");
    setStatusMessage(en.calculatingHash);
    try {
      const nextHash = await sha256File(nextFile);
      setSha256(nextHash);
      setStatusMessage("File fingerprint calculated locally.");
      setPhase("idle");
    } catch (error) {
      setPhase("failed");
      setMessage(error instanceof Error ? error.message : "SHA-256 could not be calculated.");
    } finally {
      setBusy(false);
    }
  }

  function resetWizard() {
    setStep("vehicle");
    setBrandId("");
    setModelId("");
    setGenerationId("");
    setEngineId("");
    setManualVehicle({ brand: "", model: "", generation: "", engine: "" });
    setPrimaryServiceId("stage_1");
    setExtraServiceIds([]);
    setFile(null);
    setSha256("");
    setNotes("");
    setSpecialRequest("");
    setEcu("");
    setReadMethod("");
    setGearbox("");
    setUploadProgress(null);
    setRequestId("");
    setMessage("");
    setStatusMessage("");
    setPhase("idle");
    setSubmission(null);
  }

  function cancelWizard() {
    if (draftFilled && !window.confirm("Cancel this request draft? The current in-memory draft will be cleared.")) return;
    resetWizard();
  }

  function continueFromNotes() {
    if (textLimitError) {
      setMessage(textLimitError);
      return;
    }
    setMessage("");
    setStep("review");
  }

  async function submit() {
    if (!creditVerified) {
      setMessage(en.creditUnavailable);
      return;
    }
    if (textLimitError) {
      setStep("notes");
      setMessage(textLimitError);
      return;
    }
    if (!file || !sha256 || !hasVehicle || !selectedPrimary) {
      setMessage("Please select a vehicle, service, and file before submitting.");
      return;
    }
    setBusy(true);
    setMessage("");
    setUploadProgress(null);
    const activeSubmission = submission ?? { idempotencyKey: createIdempotencyKey() };
    setSubmission(activeSubmission);
    try {
      setPhase("checking");
      await verifyOnline(session);

      let uploadSession = activeSubmission.uploadSession;
      if (!uploadSession) {
        setPhase("preparing");
        setStatusMessage(en.preparingUploadSession);
        uploadSession = await apiFetch<DesktopUploadSession>("/api/desktop/upload-session", session, {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: activeSubmission.idempotencyKey,
            fileName: file.name,
            fileSize: file.size,
            sha256,
            contentType: file.type || "application/octet-stream",
            service: { primaryServiceId, extraServiceIds },
          }),
        });
        activeSubmission.uploadSession = uploadSession;
        setSubmission({ ...activeSubmission });
      }

      setPhase("uploading");
      setStatusMessage(en.uploadInProgress);
      await uploadToPrivateStorage({
        signedUploadUrl: uploadSession.upload.signedUploadUrl,
        file,
        contentType: uploadSession.upload.contentType,
        onProgress: setUploadProgress,
      });

      setPhase("verifying");
      setStatusMessage("Verifying upload...");
      await verifyOnline(session);
      setPhase("finalizing");
      setStatusMessage(en.finalizingRequest);
      const finalizePayload = safeUploadPayload({
        idempotencyKey: uploadSession.idempotencyKey,
        uploadSessionId: uploadSession.uploadSessionId,
        uploadContract: uploadSession.uploadContract,
        upload: { path: uploadSession.upload.path, fileName: file.name, fileSize: file.size, sha256 },
        vehicle: {
          brand: vehicleNames.brand,
          model: vehicleNames.model,
          generation: vehicleNames.generation || null,
          engine: vehicleNames.engine,
        },
        service: { primaryServiceId, extraServiceIds },
        notes: notesPayload,
        ecu,
        gearbox,
        readMethod,
        masterSlave: "master",
      }, { maxStringLength: DESKTOP_TEXT_LIMITS.notes });
      const result = await apiFetch<{ request: { id: string; uploaded_file_name: string; credits_required: number; service_type: string }; duplicatePrevented?: boolean }>("/api/desktop/requests/finalize", session, {
        method: "POST",
        body: JSON.stringify(finalizePayload),
      });
      setRequestId(result.request.id);
      setStatusMessage(result.duplicatePrevented ? "Existing request returned safely." : en.uploadCompleted);
      setPhase("submitted");
      safeNotify("MG AutoTech", "Your request has been submitted successfully.");
      onSuccess({
        requestId: result.request.id,
        fileName: file.name,
        fileSize: file.size,
        sha256,
        status: "submitted",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        vehicleSummary,
        serviceSummary,
        localOnly: true,
        lastServerStatus: "submitted",
      });
      setStep("success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : en.uploadFailed;
      setPhase("failed");
      setStatusMessage(en.uploadFailed);
      setMessage(errorMessage);
      safeNotify("MG AutoTech upload failed", errorMessage);
      if (file && sha256) {
        onSuccess({
          requestId: `local-${activeSubmission.idempotencyKey}`,
          fileName: file.name,
          fileSize: file.size,
          sha256,
          status: "failed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vehicleSummary,
          serviceSummary,
          localOnly: true,
          lastServerStatus: null,
          errorMessage,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel wizard">
      <Progress step={step} />
      {message && <div className="alert"><AlertTriangle /> {message}</div>}
      {statusMessage && <div className={phase === "failed" ? "status-pill warn" : "status-pill"}><Wifi /> {statusMessage}</div>}
      {step === "vehicle" && (
        <div className="step">
          <div className="section-head">
            <h2><Car /> {en.selectVehicle}</h2>
            <button className="ghost" onClick={() => setVehicleMode(vehicleMode === "catalog" ? "manual" : "catalog")}>
              {vehicleMode === "catalog" ? "Use Manual Vehicle" : "Use Catalog"}
            </button>
          </div>
          {vehicleMode === "catalog" ? (
            <>
              <SearchableSelect label="Brand" value={brandId} onChange={chooseBrand} options={vehicle.brands} />
              <SearchableSelect label="Model" value={modelId} onChange={chooseModel} options={vehicle.models} disabled={!brandId} />
              <SearchableSelect label="Generation" value={generationId} onChange={chooseGeneration} options={vehicle.generations} disabled={!modelId} />
              <SearchableSelect label="Engine" value={engineId} onChange={setEngineId} options={vehicle.engines} disabled={!generationId} />
            </>
          ) : (
            <div className="manual-grid">
              <input value={manualVehicle.brand} onChange={(event) => setManualVehicle((current) => ({ ...current, brand: event.target.value }))} placeholder="Brand, e.g. Mercedes-Benz" />
              <input value={manualVehicle.model} onChange={(event) => setManualVehicle((current) => ({ ...current, model: event.target.value }))} placeholder="Model, e.g. E" />
              <input value={manualVehicle.generation} onChange={(event) => setManualVehicle((current) => ({ ...current, generation: event.target.value }))} placeholder="Generation, e.g. W214" />
              <input value={manualVehicle.engine} onChange={(event) => setManualVehicle((current) => ({ ...current, engine: event.target.value }))} placeholder="Engine, e.g. E 220 d" />
            </div>
          )}
          <div className="summary">Selected vehicle: <strong>{vehicleSummary || "Not available"}</strong></div>
          <div className="button-row"><button className="ghost" onClick={cancelWizard}><X /> {en.cancel}</button><button disabled={!hasVehicle} onClick={() => setStep("service")}>{en.continue}</button></div>
        </div>
      )}
      {step === "service" && (
        <div className="step">
          <h2><FileText /> {en.selectService}</h2>
          <div className="cards">
            {catalog.primary.map((service) => (
              <button key={service.id} className={primaryServiceId === service.id ? "choice active" : "choice"} onClick={() => setPrimaryServiceId(service.id)}>
                <strong>{service.title}</strong><span>{service.description || "Professional file-service request"}</span><em>{service.credits} credits</em>
              </button>
            ))}
          </div>
          <details>
            <summary>Advanced services</summary>
            {catalog.extraCategories.map((category) => (
              <div key={category.id} className="extra-group">
                <h3>{category.title}</h3>
                <p className="muted">{category.description}</p>
                <div className="chips">
                  {category.services.map((service) => (
                    <button key={service.id} className={extraServiceIds.includes(service.id) ? "chip active" : "chip"} onClick={() => setExtraServiceIds((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id])}>
                      {service.title} ({service.credits})
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </details>
          <div className="summary">Estimated requirement: <strong>{totalCredits} credits</strong><span className="muted"> Final validation happens on the MG AutoTech server.</span></div>
          <div className="button-row"><button className="ghost" onClick={() => setStep("vehicle")}>{en.back}</button><button disabled={!hasService} onClick={() => setStep("file")}>{en.continue}</button></div>
        </div>
      )}
      {step === "file" && (
        <div className="step">
          <h2><UploadCloud /> {en.uploadFile}</h2>
          <label className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const next = event.dataTransfer.files[0]; if (next) void onFileSelected(next); }}>
            <input type="file" onChange={(event) => { const next = event.target.files?.[0]; if (next) void onFileSelected(next); }} />
            <UploadCloud />
            <strong>{file?.name || "Choose a file or drop it here"}</strong>
            <span>{allowedExtensions.join(", ")} / max. {formatBytes(maxUploadBytes)}</span>
          </label>
          {file && (
            <div className="file-card">
              <button className="ghost mini" onClick={() => { setFile(null); setSha256(""); setSubmission(null); }}><X /> Remove File</button>
              <strong>{file.name}</strong>
              <span>{formatBytes(file.size)} / {file.name.split(".").pop()?.toUpperCase() || "Unknown"} file</span>
              <code>{sha256 || en.calculatingHash}</code>
            </div>
          )}
          {fileWarnings.map((warning) => <div className="alert" key={warning}><AlertTriangle /> {warning}</div>)}
          <div className="button-row"><button className="ghost" onClick={() => setStep("service")}>{en.back}</button><button disabled={!hasFile || busy} onClick={() => setStep("notes")}>{en.continue}</button></div>
        </div>
      )}
      {step === "notes" && (
        <div className="step">
          <h2>{en.notes}</h2>
          <label>
            ECU / TCU, if known
            <input value={ecu} maxLength={DESKTOP_TEXT_LIMITS.ecu} onChange={(event) => setEcu(event.target.value)} placeholder="ECU / TCU, if known" aria-describedby="ecu-limit" />
            <FieldLimitHint id="ecu-limit" value={ecu} limit={DESKTOP_TEXT_LIMITS.ecu} />
          </label>
          <label>
            Gearbox / TCU details, optional
            <input value={gearbox} maxLength={DESKTOP_TEXT_LIMITS.gearbox} onChange={(event) => setGearbox(event.target.value)} placeholder="Gearbox / TCU details, optional" aria-describedby="gearbox-limit" />
            <FieldLimitHint id="gearbox-limit" value={gearbox} limit={DESKTOP_TEXT_LIMITS.gearbox} />
          </label>
          <label>
            Read method
            <input value={readMethod} maxLength={DESKTOP_TEXT_LIMITS.readMethod} onChange={(event) => setReadMethod(event.target.value)} placeholder="Read method, e.g. Bench / OBD / Boot" aria-describedby="read-method-limit" />
            <FieldLimitHint id="read-method-limit" value={readMethod} limit={DESKTOP_TEXT_LIMITS.readMethod} />
          </label>
          <label>
            Customer notes
            <textarea value={notes} maxLength={DESKTOP_TEXT_LIMITS.notes} onChange={(event) => setNotes(event.target.value)} placeholder="Customer notes, DTCs, vehicle behavior, previous modifications..." aria-describedby="notes-field-limit notes-combined-limit" />
            <FieldLimitHint id="notes-field-limit" value={notes} limit={DESKTOP_TEXT_LIMITS.notes} />
          </label>
          <label>
            Special request, optional
            <textarea value={specialRequest} maxLength={DESKTOP_TEXT_LIMITS.notes} onChange={(event) => setSpecialRequest(event.target.value)} placeholder="Special request, optional" aria-describedby="special-request-field-limit notes-combined-limit" />
            <FieldLimitHint id="special-request-field-limit" value={specialRequest} limit={DESKTOP_TEXT_LIMITS.notes} />
          </label>
          <CombinedNotesLimitHint id="notes-combined-limit" remaining={notesPayloadRemaining} limit={DESKTOP_TEXT_LIMITS.notes} />
          <label>Contact preference</label>
          <select value={contactPreference} onChange={(event) => setContactPreference(event.target.value)}>
            <option>Dashboard message</option>
            <option>Email</option>
            <option>Phone if needed</option>
          </select>
          <div className="button-row"><button className="ghost" onClick={() => setStep("file")}>{en.back}</button><button disabled={Boolean(textLimitError)} onClick={continueFromNotes}>{en.continue}</button></div>
        </div>
      )}
      {step === "review" && (
        <div className="step">
          <h2>{en.reviewSubmit}</h2>
          {!creditVerified && <div className="alert"><AlertTriangle /> {en.creditUnavailable}</div>}
          <ReviewLine label="Vehicle" value={vehicleSummary || "Not available"} />
          <ReviewLine label="Service" value={serviceSummary} />
          <ReviewLine label="Estimated credits" value={`${totalCredits}`} />
          <ReviewLine label="File" value={`${file?.name} / ${file ? formatBytes(file.size) : "-"}`} />
          <ReviewLine label="SHA-256" value={sha256 || "Not available"} />
          <ReviewLine label="Upload mode" value="Retry-safe upload. True chunked resume is not enabled yet." />
          {uploadProgress && <UploadProgressCard progress={uploadProgress} phase={phase} />}
          <div className="button-row"><button className="ghost" onClick={() => setStep("notes")}>{en.back}</button><button disabled={busy || !creditVerified || Boolean(textLimitError)} onClick={() => void submit()}>{busy ? <Loader2 className="spin" /> : <CheckCircle2 />} {busy && phase === "failed" ? en.retryUpload : en.submitRequest}</button></div>
        </div>
      )}
      {step === "success" && (
        <div className="step success">
          <CheckCircle2 />
          <h2>Request submitted</h2>
          <p>{en.success}</p>
          <code>{requestId}</code>
          <button onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/dashboard/orders/${requestId}`)}>{en.openDashboard} <ExternalLink /></button>
          <button className="ghost" onClick={resetWizard}>New Request</button>
        </div>
      )}
    </section>
  );
}

function SearchableSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange(value: string): void; options: VehicleOption[]; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? options.filter((option) => option.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 80)
    : options.slice(0, 120);
  return (
    <label>
      {label}
      <div className="search-select">
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} disabled={disabled} />
      </div>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">Select</option>
        {filtered.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

function FieldLimitHint({ id, value, limit }: { id: string; value: string; limit: number }) {
  const remaining = remainingText(value, limit);
  const overLimit = remaining < 0;
  return (
    <span id={id} className={overLimit ? "field-help warn" : "field-help"} aria-live="polite">
      {overLimit ? `${Math.abs(remaining)} characters over the ${limit} character limit.` : `${remaining} of ${limit} characters remaining.`}
    </span>
  );
}

function CombinedNotesLimitHint({ id, remaining, limit }: { id: string; remaining: number; limit: number }) {
  const overLimit = remaining < 0;
  return (
    <div id={id} className={overLimit ? "field-help combined warn" : "field-help combined"} aria-live="polite">
      {overLimit ? `Combined notes are ${Math.abs(remaining)} characters over the ${limit} character limit.` : `Combined notes sent to MG AutoTech: ${remaining} characters remaining from ${limit}.`}
    </div>
  );
}

function Progress({ step }: { step: WizardStep }) {
  const steps: WizardStep[] = ["vehicle", "service", "file", "notes", "review"];
  const labels: Record<WizardStep, string> = { vehicle: "Vehicle", service: "Service", file: "File", notes: "Notes", review: "Review", success: "Done" };
  const activeIndex = Math.max(steps.indexOf(step), 0);
  return <div className="steps">{steps.map((item, index) => <span key={item} className={index <= activeIndex ? "active" : ""}>{index + 1}. {labels[item]}</span>)}</div>;
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return <div className="review-line"><span>{label}</span><strong>{value}</strong></div>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="info-line"><span>{label}</span><strong>{value}</strong></div>;
}

function UploadProgressCard({ progress, phase }: { progress: UploadProgressSnapshot; phase: UploadPhase }) {
  return (
    <div className="upload-progress-card">
      <div className="section-head compact-head">
        <strong>{phaseLabel(phase)}</strong>
        <span>{progress.percent}%</span>
      </div>
      <div className="progress-bar"><div style={{ width: `${progress.percent}%` }} /></div>
      <div className="progress-metrics">
        <span>{formatBytes(progress.loadedBytes)} / {formatBytes(progress.totalBytes)}</span>
        <span>{formatSpeed(progress.bytesPerSecond)}</span>
        <span>{formatEta(progress.etaSeconds)}</span>
      </div>
    </div>
  );
}

function phaseLabel(phase: UploadPhase) {
  switch (phase) {
    case "checking": return "Checking server";
    case "hashing": return "Calculating file hash";
    case "preparing": return "Preparing upload session";
    case "uploading": return "Uploading file";
    case "verifying": return "Verifying upload";
    case "finalizing": return "Finalizing request";
    case "submitted": return "Request submitted";
    case "failed": return "Upload failed";
    default: return "Ready";
  }
}

function buildFileWarnings(file: File | null, sha256: string, duplicateFingerprint: boolean, limits: BootstrapPayload["limits"]) {
  if (!file) return [];
  const warnings: string[] = [];
  const lower = file.name.toLowerCase();
  if (file.size < 1024) warnings.push("This file is unusually small. Please confirm it is the correct ECU/TCU read.");
  if (file.size > Math.min(limits.maxFileSize, maxUploadBytes) * 0.85) warnings.push("This file is close to the desktop upload size limit.");
  if (lower.endsWith(".zip")) warnings.push("Archive files are accepted, but the app does not extract archives locally.");
  if (duplicateFingerprint && sha256) warnings.push("This file fingerprint already exists in local history. Retry is safe, but avoid duplicate requests.");
  return warnings;
}
