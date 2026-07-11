import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  ShieldCheck,
  UploadCloud,
  Wifi,
} from "lucide-react";
import {
  apiBaseUrl,
  apiFetch,
  assertAppCheckAllowsWork,
  checkDesktopApp,
  createSupabaseBrowserClient,
  setDesktopInstallationId,
  supabaseAnonKey,
  uploadToPrivateStorage,
  type AppCheckPayload,
  type BootstrapPayload,
  type DesktopRequest,
  type ServiceCatalog,
} from "./api";
import { en } from "./i18n/en";
import { resolveEnabledModules } from "./modules/registry";
import { createIdempotencyKey, safeUploadPayload, sha256File, validateUploadFile } from "./validation";

type VehicleOption = { id: string; name: string };
type VehicleState = {
  brands: VehicleOption[];
  models: VehicleOption[];
  generations: VehicleOption[];
  engines: VehicleOption[];
};

type WizardStep = "vehicle" | "service" | "file" | "notes" | "review" | "success";
type GateState = "checking" | "server_unavailable" | "update_required" | "maintenance" | "login_required" | "ready";

const supabase = createSupabaseBrowserClient();

function statusLabel(value: string | null) {
  return (value || "new_request").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBytes(value: number) {
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
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

export default function App() {
  const [gate, setGate] = useState<GateState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>(en.startupChecking);
  const [loading, setLoading] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [appCheck, setAppCheck] = useState<AppCheckPayload | null>(null);
  const [history, setHistory] = useState<SafeUploadHistoryRow[]>([]);
  const [creditVerified, setCreditVerified] = useState(false);

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
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.session) throw new Error(result.error?.message || "Login failed.");
      setSession(result.data.session);
      await loadBootstrap(result.data.session);
    } catch (error) {
      if (gate === "login_required") {
        setMessage(error instanceof Error ? error.message : "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setBootstrap(null);
    setCreditVerified(false);
    setPassword("");
    setGate("login_required");
    setMessage(en.loginRequired);
  }

  async function refreshDashboard() {
    if (!session) return;
    await loadBootstrap(session);
  }

  async function rememberUpload(row: SafeUploadHistoryRow) {
    const next = [row, ...history.filter((item) => item.requestId !== row.requestId)].slice(0, 30);
    setHistory(next);
    await window.mgDesktop?.writeHistory(next);
  }

  if (gate === "checking" || gate === "server_unavailable" || gate === "update_required" || gate === "maintenance") {
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
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" />
          <label>Password</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="********" />
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

  return (
    <main className="app-shell">
      <aside>
        <div className="brand-row"><div className="brand-small">MG</div><div><strong>MG AutoTech</strong><span>Upload Assistant</span></div></div>
        <div className="profile-box">
          <div className="muted">Customer</div>
          <strong>{bootstrap.profile.full_name || bootstrap.profile.customer_id || bootstrap.profile.email}</strong>
          <span>{Number(bootstrap.profile.credit_balance ?? 0)} credits verified online</span>
        </div>
        <ModuleList allowedModules={bootstrap.app?.allowed_modules ?? []} />
        {!creditVerified && <div className="alert"><AlertTriangle /> {en.creditUnavailable}</div>}
        <button className="nav-action" onClick={() => void refreshDashboard()}>Refresh Dashboard</button>
        <button className="nav-action" onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/dashboard`)}>Open Web Dashboard <ExternalLink /></button>
        <button className="nav-action danger" onClick={() => void logout()}><LogOut /> {en.logout}</button>
      </aside>
      <section className="workspace">
        {bootstrap.app?.update_available && !bootstrap.app.update_required && (
          <UpdateBanner app={bootstrap.app} />
        )}
        <header>
          <div>
            <div className="eyebrow">Customer Portal</div>
            <h1>New File-Service Request</h1>
          </div>
          <div className="secure-note"><ShieldCheck /> Online Verified Private Upload</div>
        </header>
        <div className="grid">
          <RequestWizard
            session={session}
            catalog={bootstrap.services}
            creditVerified={creditVerified}
            verifyOnline={verifyOnline}
            onSuccess={rememberUpload}
          />
          <DashboardPanel requests={bootstrap.requests} history={history} />
        </div>
      </section>
    </main>
  );
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
  return (
    <div className="module-list">
      <div className="muted">Enabled modules</div>
      {modules.map((module) => (
        <span key={module.id}>{module.name}</span>
      ))}
      {!modules.length && <span>Core access only</span>}
    </div>
  );
}

function GateScreen({ gate, message, app, onRetry }: { gate: GateState; message: string; app: AppCheckPayload | null; onRetry(): Promise<void> }) {
  const title = gate === "checking"
    ? en.startupChecking
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

function DashboardPanel({ requests, history }: { requests: DesktopRequest[]; history: SafeUploadHistoryRow[] }) {
  return (
    <section className="panel">
      <h2>Dashboard</h2>
      <div className="stat-row">
        <div><strong>{requests.length}</strong><span>recent requests</span></div>
        <div><strong>{history.length}</strong><span>local read-only history</span></div>
      </div>
      <h3>Recent Requests</h3>
      <div className="list">
        {requests.slice(0, 6).map((request) => (
          <article key={request.id}>
            <strong>{request.vehicle_brand} {request.vehicle_model}</strong>
            <span>{request.service_type || "-"} / {statusLabel(request.status)}</span>
          </article>
        ))}
        {!requests.length && <p className="muted">No requests yet.</p>}
      </div>
      <h3>Local History</h3>
      <p className="muted">Read-only local metadata. It cannot be used for offline credits or offline request creation.</p>
      <div className="list compact">
        {history.slice(0, 5).map((item) => (
          <article key={item.requestId}>
            <strong>{item.fileName}</strong>
            <span>{item.status} / {formatBytes(item.fileSize)}</span>
          </article>
        ))}
        {!history.length && <p className="muted">No local uploads stored yet.</p>}
      </div>
    </section>
  );
}

function RequestWizard({
  session,
  catalog,
  creditVerified,
  verifyOnline,
  onSuccess,
}: {
  session: Session;
  catalog: ServiceCatalog;
  creditVerified: boolean;
  verifyOnline(activeSession?: Session | null): Promise<AppCheckPayload>;
  onSuccess(row: SafeUploadHistoryRow): Promise<void>;
}) {
  const [step, setStep] = useState<WizardStep>("vehicle");
  const [vehicle, setVehicle] = useState<VehicleState>({ brands: [], models: [], generations: [], engines: [] });
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [engineId, setEngineId] = useState("");
  const [primaryServiceId, setPrimaryServiceId] = useState("stage_1");
  const [extraServiceIds, setExtraServiceIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sha256, setSha256] = useState("");
  const [notes, setNotes] = useState("");
  const [ecu, setEcu] = useState("");
  const [readMethod, setReadMethod] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [requestId, setRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
  const selectedPrimary = catalog.primary.find((item) => item.id === primaryServiceId);
  const selectedExtras = catalog.extraCategories.flatMap((category) => category.services).filter((item) => extraServiceIds.includes(item.id));
  const totalCredits = (selectedPrimary?.credits ?? 0) + selectedExtras.reduce((sum, item) => sum + item.credits, 0);

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
    setFile(nextFile);
    setSha256("");
    setBusy(true);
    setStatusMessage(en.calculatingHash);
    try {
      setSha256(await sha256File(nextFile));
      setStatusMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SHA-256 could not be calculated.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!creditVerified) {
      setMessage(en.creditUnavailable);
      return;
    }
    if (!file || !sha256 || !selectedBrand || !selectedModel || !selectedEngine || !selectedPrimary) {
      setMessage("Please select a vehicle, service, and file before submitting.");
      return;
    }
    setBusy(true);
    setMessage("");
    setUploadProgress(0);
    const idempotencyKey = createIdempotencyKey();
    try {
      await verifyOnline(session);
      setStatusMessage(en.preparingUploadSession);
      const uploadSession = await apiFetch<{
        upload: { path: string; storageObjectUrl: string; contentType: string };
        uploadSessionId: string;
        idempotencyKey: string;
      }>("/api/desktop/upload-session", session, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey,
          fileName: file.name,
          fileSize: file.size,
          sha256,
          contentType: file.type || "application/octet-stream",
          service: { primaryServiceId, extraServiceIds },
        }),
      });

      setStatusMessage(en.uploadInProgress);
      await uploadToPrivateStorage({
        storageObjectUrl: uploadSession.upload.storageObjectUrl,
        token: session.access_token,
        anonKey: supabaseAnonKey,
        file,
        contentType: uploadSession.upload.contentType,
        onProgress: setUploadProgress,
      });

      await verifyOnline(session);
      setStatusMessage(en.finalizingRequest);
      const finalizePayload = safeUploadPayload({
        idempotencyKey: uploadSession.idempotencyKey,
        uploadSessionId: uploadSession.uploadSessionId,
        upload: { path: uploadSession.upload.path, fileName: file.name, fileSize: file.size, sha256 },
        vehicle: {
          brand: selectedBrand.name,
          model: selectedModel.name,
          generation: selectedGeneration?.name ?? null,
          engine: selectedEngine.name,
        },
        service: { primaryServiceId, extraServiceIds },
        notes,
        ecu,
        readMethod,
        masterSlave: "master",
      });
      const result = await apiFetch<{ request: { id: string; uploaded_file_name: string; credits_required: number; service_type: string } }>("/api/desktop/requests/finalize", session, {
        method: "POST",
        body: JSON.stringify(finalizePayload),
      });
      setRequestId(result.request.id);
      setStatusMessage(en.uploadCompleted);
      await onSuccess({ requestId: result.request.id, fileName: file.name, fileSize: file.size, sha256, status: "uploaded", createdAt: new Date().toISOString() });
      setStep("success");
    } catch (error) {
      setStatusMessage(en.uploadFailed);
      setMessage(error instanceof Error ? error.message : en.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel wizard">
      <Progress step={step} />
      {message && <div className="alert"><AlertTriangle /> {message}</div>}
      {statusMessage && <div className="status-pill"><Wifi /> {statusMessage}</div>}
      {step === "vehicle" && (
        <div className="step">
          <h2><Car /> {en.selectVehicle}</h2>
          <Select label="Brand" value={brandId} onChange={chooseBrand} options={vehicle.brands} />
          <Select label="Model" value={modelId} onChange={chooseModel} options={vehicle.models} disabled={!brandId} />
          <Select label="Generation" value={generationId} onChange={chooseGeneration} options={vehicle.generations} disabled={!modelId} />
          <Select label="Engine" value={engineId} onChange={setEngineId} options={vehicle.engines} disabled={!generationId} />
          <button disabled={!selectedBrand || !selectedModel || !selectedEngine} onClick={() => setStep("service")}>{en.continue}</button>
        </div>
      )}
      {step === "service" && (
        <div className="step">
          <h2><FileText /> {en.selectService}</h2>
          <div className="cards">
            {catalog.primary.map((service) => (
              <button key={service.id} className={primaryServiceId === service.id ? "choice active" : "choice"} onClick={() => setPrimaryServiceId(service.id)}>
                <strong>{service.title}</strong><span>{service.credits} credits</span>
              </button>
            ))}
          </div>
          <details>
            <summary>Advanced services</summary>
            {catalog.extraCategories.map((category) => (
              <div key={category.id} className="extra-group">
                <h3>{category.title}</h3>
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
          <div className="button-row"><button className="ghost" onClick={() => setStep("vehicle")}>{en.back}</button><button onClick={() => setStep("file")}>{en.continue}</button></div>
        </div>
      )}
      {step === "file" && (
        <div className="step">
          <h2><UploadCloud /> {en.uploadFile}</h2>
          <label className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const next = event.dataTransfer.files[0]; if (next) void onFileSelected(next); }}>
            <input type="file" onChange={(event) => { const next = event.target.files?.[0]; if (next) void onFileSelected(next); }} />
            <UploadCloud />
            <strong>{file?.name || "Choose a file or drop it here"}</strong>
            <span>.bin, .ori, .mod, .frf, .hex, .zip, .sgo / max. 32 MB</span>
          </label>
          {file && <div className="file-card"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span><code>{sha256 || en.calculatingHash}</code></div>}
          <div className="button-row"><button className="ghost" onClick={() => setStep("service")}>{en.back}</button><button disabled={!file || !sha256 || busy} onClick={() => setStep("notes")}>{en.continue}</button></div>
        </div>
      )}
      {step === "notes" && (
        <div className="step">
          <h2>{en.notes}</h2>
          <input value={ecu} onChange={(event) => setEcu(event.target.value)} placeholder="ECU / TCU, if known" />
          <input value={readMethod} onChange={(event) => setReadMethod(event.target.value)} placeholder="Read method, e.g. Bench / OBD / Boot" />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes, DTCs, customer request..." />
          <div className="button-row"><button className="ghost" onClick={() => setStep("file")}>{en.back}</button><button onClick={() => setStep("review")}>{en.continue}</button></div>
        </div>
      )}
      {step === "review" && (
        <div className="step">
          <h2>{en.reviewSubmit}</h2>
          {!creditVerified && <div className="alert"><AlertTriangle /> {en.creditUnavailable}</div>}
          <ReviewLine label="Vehicle" value={`${selectedBrand?.name} ${selectedModel?.name} ${selectedGeneration?.name || ""} ${selectedEngine?.name}`} />
          <ReviewLine label="Service" value={[selectedPrimary?.title, ...selectedExtras.map((item) => item.title)].filter(Boolean).join(" + ")} />
          <ReviewLine label="Estimated credits" value={`${totalCredits}`} />
          <ReviewLine label="File" value={`${file?.name} / ${file ? formatBytes(file.size) : "-"}`} />
          {uploadProgress > 0 && <div className="progress-bar"><div style={{ width: `${uploadProgress}%` }} /></div>}
          <div className="button-row"><button className="ghost" onClick={() => setStep("notes")}>{en.back}</button><button disabled={busy || !creditVerified} onClick={() => void submit()}>{busy ? <Loader2 className="spin" /> : <CheckCircle2 />} {en.submitRequest}</button></div>
        </div>
      )}
      {step === "success" && (
        <div className="step success">
          <CheckCircle2 />
          <h2>Request submitted</h2>
          <p>{en.success}</p>
          <code>{requestId}</code>
          <button onClick={() => void window.mgDesktop?.openExternal(`${apiBaseUrl}/dashboard/orders/${requestId}`)}>{en.openDashboard} <ExternalLink /></button>
          <button className="ghost" onClick={() => { setStep("vehicle"); setFile(null); setSha256(""); setUploadProgress(0); }}>New Request</button>
        </div>
      )}
    </section>
  );
}

function Select({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange(value: string): void; options: VehicleOption[]; disabled?: boolean }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">Select</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

function Progress({ step }: { step: WizardStep }) {
  const steps: WizardStep[] = ["vehicle", "service", "file", "notes", "review"];
  const labels: Record<WizardStep, string> = { vehicle: en.selectVehicle, service: en.selectService, file: en.uploadFile, notes: en.notes, review: en.reviewSubmit, success: "Done" };
  return <div className="steps">{steps.map((item) => <span key={item} className={item === step ? "active" : ""}>{labels[item]}</span>)}</div>;
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return <div className="review-line"><span>{label}</span><strong>{value}</strong></div>;
}
