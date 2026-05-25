"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Gauge,
  ShieldCheck,
  CreditCard,
  FileCode2,
  Settings,
  Car,
  Database,
  Languages,
  User,
  LogIn,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Download,
  Wrench,
  Cpu,
  Zap,
  Activity,
  MessageCircle,
  ReceiptText,
  Lock,
  Server,
  BarChart3,
  ClipboardList,
  Users,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Star,
  PackageCheck,
  History,
  FileText,
  ShoppingCart,
  KeyRound,
  SlidersHorizontal,
  RefreshCcw,
  TimerReset,
  ShieldAlert,
  Layers3,
  BadgeEuro,
  HardDrive,
  TerminalSquare,
  Workflow,
  PanelTop,
} from "lucide-react";

const brands = [
  "Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Skoda", "SEAT", "Cupra", "Porsche", "Opel", "Ford", "Peugeot", "Citroën", "Renault", "Dacia", "Fiat", "Alfa Romeo", "Jeep", "Volvo", "Toyota", "Lexus", "Nissan", "Hyundai", "Kia", "Mazda", "Honda", "Mitsubishi", "Land Rover", "Jaguar", "Mini", "Smart", "Iveco", "MAN", "DAF", "Scania", "Volvo Trucks"
];

const ecuFamilies = [
  "Bosch EDC15", "Bosch EDC16", "Bosch EDC17", "Bosch MD1", "Bosch MG1", "Bosch MED9", "Bosch MED17", "Bosch MEVD", "Continental SID", "Continental SIMOS", "Continental PCR2.1", "Continental EMS", "Delphi DCM", "Delphi CRD", "Delphi MT", "Siemens MSD/MSV", "Magneti Marelli", "Marelli 8GM/9DF", "Denso Diesel", "Denso Petrol", "TRW", "Temic", "Valeo", "Vitesco", "ZF TCU", "Bosch TCU", "DQ200", "DQ250", "DQ381", "DQ500", "DL501", "ZF 6HP", "ZF 8HP", "Mercedes VGS", "Mercedes CRD", "Mercedes SIM4", "BMW DDE", "BMW DME", "VAG Simos 18", "VAG MG1/MD1", "PSA SID/EDC", "Renault SID/EDC/DCM"
];

const stageServices = [
  {
    name: "Stage 1 Tuning File",
    credits: "25 Credits",
    icon: Gauge,
    text: "For stock vehicles with original hardware. Safe performance optimization with more torque, improved throttle response and clean drivability.",
    details: ["Stock hardware", "Individual map calibration", "No generic files", "Clean torque limit calibration"]
  },
  {
    name: "Stage 2 Tuning File",
    credits: "35 Credits",
    icon: Zap,
    text: "For vehicles with hardware upgrades such as downpipe, intake, intercooler or exhaust. Calibration based on installed hardware.",
    details: ["Hardware upgrades", "Boost & torque optimization", "Log analysis recommended", "More performance"]
  },
  {
    name: "Stage 3 Tuning File",
    credits: "Manual Review",
    icon: Activity,
    text: "For heavily modified vehicles with big turbo, injectors, fuel system upgrades or complex engine builds.",
    details: ["Big Turbo", "Fuel-System-Upgrades", "Log-based development", "Technical pre-check"]
  }
];

const solutionServices = [
  "ECU Tuning", "TCU Tuning", "DPF OFF", "EGR / AGR OFF", "AdBlue / SCR OFF", "OPF / GPF Solutions", "VMAX OFF", "Start-Stop OFF", "Swirl Flap OFF", "Lambda / O2 Solutions", "Pops & Bangs", "Crackle Map", "Hardcut", "Popcorn Limiter", "Launch Control", "DTC OFF", "ECU Clone Support", "IMMO Solutions", "Special Coding", "Eco Tuning", "Torque Monitoring", "Cold Start Adjustment", "Gearbox Torque Limit", "Readiness Solutions"
];

const statuses = [
  { label: "New Request", icon: ClipboardList, desc: "Datei und Fahrzeugdaten wurden eingereicht." },
  { label: "File Check", icon: Search, desc: "Originaldatei, ECU-Typ und Kundenwunsch werden geprüft." },
  { label: "In Progress", icon: Settings, desc: "Softwarelösung wird individuell vorbereitet." },
  { label: "Customer Info Needed", icon: AlertTriangle, desc: "Zusätzliche Infos, Logs oder DTCs werden benötigt." },
  { label: "Completed", icon: CheckCircle2, desc: "Modifizierte Datei ist bereit zum Download." },
  { label: "Revision", icon: RefreshCcw, desc: "Kunde kann eine technische Nachbearbeitung anfragen." }
];

const creditPackages = [
  { name: "Starter", credits: "50", target: "For single orders and platform testing", price: "Pay as you go" },
  { name: "Workshop", credits: "150", target: "For workshops with regular requests", price: "B2B geeignet" },
  { name: "Professional", credits: "300", target: "For active tuning and service partners", price: "Better conditions" },
  { name: "Partner", credits: "500+", target: "For resellers and high volume", price: "Individual offer" }
];

const uploadFields = [
  "Name", "Firma", "E-Mail", "Telefon / WhatsApp", "Land", "Fahrzeugmarke", "Modell", "Baujahr", "Motor", "Leistung", "Kraftstoff", "Getriebe", "Kilometerstand", "VIN optional", "ECU/TCU Typ", "HW Nummer", "SW Nummer", "Lesegerät", "Lesemethode", "Originaldatei", "Diagnosebericht", "Logs", "Screenshots", "Notizen / Kundenwunsch"
];

const adminItems = [
  "Kunden verwalten", "Aufträge prüfen", "Originaldateien downloaden", "Modifizierte Dateien hochladen", "Status ändern", "Credits manuell buchen", "Preise bearbeiten", "Credit-Pakete verwalten", "Rechnungen verwalten", "Zahlungen prüfen", "Support-Tickets", "Mehrsprachige Inhalte", "Interne Notizen", "Kunden-Notizen", "Datei-Logs", "Partnerkonten"
];

function Pill({ children }) {
  return <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">{children}</span>;
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">{eyebrow}</div>
      <h2 className="text-3xl font-bold text-white md:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-7 text-slate-300">{text}</p>}
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 backdrop-blur ${className}`}>{children}</div>;
}

export default function MGAutoTechFileService() {
  const [selectedServices, setSelectedServices] = useState(["Stage 1 Tuning File", "DTC OFF"]);
  const [language, setLanguage] = useState("EN");
  const [query, setQuery] = useState("");

  const filteredEcus = useMemo(() => {
    if (!query) return ecuFamilies;
    return ecuFamilies.filter((e) => e.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const creditEstimate = selectedServices.includes("Stage 1 Tuning File") ? 35 : 10;

  const toggleService = (service) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((x) => x !== service) : [...prev, service]
    );
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(148,163,184,0.18),transparent_25%),linear-gradient(135deg,#05070b,#0b1220_45%,#030712)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b12]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30"><Cpu className="h-6 w-6" /></div>
            <div>
              <div className="text-lg font-black tracking-wide">MG AutoTech</div>
              <div className="text-xs text-slate-400">Professional ECU / TCU File Service Platform</div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            {['Home','File Service','Services','Credits','How It Works','FAQ','Contact'].map((item) => <a key={item} className="hover:text-white" href={`#${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-white/10 bg-white/5 p-1 md:flex">
              {['EN','DE','TR'].map((l) => <button key={l} onClick={() => setLanguage(l)} className={`rounded-full px-3 py-1 text-xs ${language === l ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{l}</button>)}
            </div>
            <button className="hidden rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 md:block"><LogIn className="mr-2 inline h-4 w-4" />Login</button>
            <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30">Register</button>
          </div>
        </div>
      </header>

      <main>
        <section id="home" className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:py-24 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 flex flex-wrap gap-2">
              <Pill>Made in Germany</Pill><Pill>No Generic Files</Pill><Pill>Workshop Partner Ready</Pill>
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-tight text-white md:text-7xl">
              Professional <span className="bg-gradient-to-r from-blue-300 to-white bg-clip-text text-transparent">ECU & TCU</span> File Service
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              A complete file service platform for MG AutoTech: customer account, credit system, file upload, service selection, order tracking, logs, invoices, support and download area.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button className="rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white shadow-xl shadow-blue-600/30"><Upload className="mr-2 inline h-5 w-5" />Upload File</button>
              <button className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-bold text-white"><CreditCard className="mr-2 inline h-5 w-5" />Buy Credits</button>
              <button className="rounded-2xl border border-white/15 px-6 py-4 font-bold text-slate-200"><MessageCircle className="mr-2 inline h-5 w-5" />WhatsApp Support</button>
            </div>
            <div className="mt-10 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
              {['Stage 1/2/3','DPF/EGR/AdBlue','ECU/TCU','DTC/IMMO'].map((x) => <div key={x} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm font-semibold text-slate-200">{x}</div>)}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <Card className="relative overflow-hidden p-0">
              <div className="border-b border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-400">Customer Dashboard</div>
                    <div className="text-xl font-bold">File Request #MGA-2405</div>
                  </div>
                  <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Completed</div>
                </div>
              </div>
              <div className="grid gap-4 p-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-blue-600/15 p-4"><CreditCard className="mb-2 h-5 w-5 text-blue-300" /><div className="text-2xl font-black">125</div><div className="text-xs text-slate-400">Credits</div></div>
                  <div className="rounded-2xl bg-white/5 p-4"><Clock3 className="mb-2 h-5 w-5 text-slate-300" /><div className="text-2xl font-black">4</div><div className="text-xs text-slate-400">Pending</div></div>
                  <div className="rounded-2xl bg-white/5 p-4"><Download className="mb-2 h-5 w-5 text-slate-300" /><div className="text-2xl font-black">18</div><div className="text-xs text-slate-400">Completed</div></div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between"><span className="font-semibold">Selected Services</span><span className="text-sm text-blue-300">35 Credits</span></div>
                  <div className="flex flex-wrap gap-2">{selectedServices.map((s) => <Pill key={s}>{s}</Pill>)}</div>
                </div>
                <div className="space-y-3">
                  {['Original file uploaded','Credits deducted','Software modification completed','Ready for download'].map((x, i) => <div key={x} className="flex items-center gap-3 text-sm"><CheckCircle2 className="h-5 w-5 text-emerald-300" /><span className="text-slate-300">{x}</span><span className="ml-auto text-xs text-slate-500">{10+i}:2{i}</span></div>)}
                </div>
              </div>
            </Card>
          </motion.div>
        </section>

        <section id="file-service" className="border-y border-white/10 bg-white/[0.025] py-16">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle eyebrow="File Service Workflow" title="From original file to completed download" text="Customers upload original ECU/TCU files, choose the requested solution and track every step transparently in their dashboard." />
            <div className="grid gap-5 md:grid-cols-4">
              {[
                [User, 'Create Account', 'The customer registers with private or company details.'],
                [ShoppingCart, 'Buy Credits', 'Credit packages via PayPal, card, bank transfer, Stripe or Klarna.'],
                [Upload, 'Upload File', 'Original ECU/TCU file, logs, diagnostic report and vehicle data.'],
                [Download, 'Download Completed File', 'Check status, read logs and download the modified file.']
              ].map(([Icon, title, text], i) => <Card key={title}><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-300"><Icon /></div><div className="mb-2 text-lg font-bold">{i+1}. {title}</div><p className="text-sm leading-6 text-slate-400">{text}</p></Card>)}
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle eyebrow="Services" title="Stage 1, Stage 2, Stage 3 and technical software solutions" text="Every file is prepared individually according to the vehicle, ECU type, technical data and customer request. No generic files." />
          <div className="grid gap-6 lg:grid-cols-3">
            {stageServices.map((s) => {
              const Icon = s.icon;
              return <Card key={s.name} className="relative overflow-hidden"><div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-600/10 blur-3xl" /><div className="mb-5 flex items-center justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-300"><Icon /></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">{s.credits}</span></div><h3 className="text-2xl font-black text-white">{s.name}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{s.text}</p><div className="mt-5 grid gap-2">{s.details.map((d) => <div key={d} className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-300" />{d}</div>)}</div></Card>
            })}
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {solutionServices.map((service) => (
              <button key={service} onClick={() => toggleService(service)} className={`rounded-2xl border p-4 text-left text-sm transition ${selectedServices.includes(service) ? 'border-blue-400 bg-blue-600/20 text-white' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25'}`}>
                <FileCode2 className="mb-3 h-5 w-5 text-blue-300" />
                <span className="font-semibold">{service}</span>
              </button>
            ))}
          </div>
        </section>

        <section id="credits" className="border-y border-white/10 bg-white/[0.025] py-16">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle eyebrow="Credit System" title="Simple system for customers, workshops and partners" text="Customers buy credits in advance and use them flexibly for different software solutions. Required credits are shown before submitting the order." />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {creditPackages.map((p) => <Card key={p.name}><div className="mb-3 text-sm uppercase tracking-widest text-blue-300">{p.name}</div><div className="text-5xl font-black text-white">{p.credits}</div><div className="mt-1 text-sm text-slate-400">Credits</div><p className="mt-5 min-h-12 text-sm leading-6 text-slate-300">{p.target}</p><div className="mt-5 rounded-2xl bg-white/5 p-3 text-sm text-slate-300">{p.price}</div><button className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white">Buy Credits</button></Card>)}
            </div>
            <Card className="mt-8">
              <div className="grid gap-4 md:grid-cols-4">
                {['Stage 1 = 25', 'Stage 2 = 35', 'DPF OFF = 20', 'AdBlue OFF = 25'].map((x) => <div key={x} className="rounded-2xl bg-black/20 p-4 text-center font-semibold text-slate-200">{x}</div>)}
              </div>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle eyebrow="Upload Form" title="All important vehicle, ECU and customer data" text="The form is structured so MG AutoTech can check and process every request professionally." />
          <Card>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {uploadFields.map((f) => <div key={f} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">{f}</div>)}
            </div>
            <div className="mt-6 rounded-3xl border border-dashed border-blue-400/40 bg-blue-600/10 p-10 text-center">
              <Upload className="mx-auto mb-3 h-10 w-10 text-blue-300" />
              <div className="text-xl font-bold text-white">Upload original ECU/TCU file here</div>
              <p className="mt-2 text-sm text-slate-400">Supported: .bin, .ori, .frf, .sgo, .dat, .zip, diagnostic reports, logs, photos and screenshots</p>
            </div>
          </Card>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025] py-16">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle eyebrow="Vehicle & ECU Coverage" title="Wide vehicle and ECU/TCU coverage" text="The platform clearly shows customers which vehicle brands, ECU families and TCU systems are supported for file service requests." />
            <div className="grid gap-8 lg:grid-cols-2">
              <Card>
                <div className="mb-5 flex items-center gap-3"><Car className="text-blue-300" /><h3 className="text-2xl font-bold">Vehicle Brands</h3></div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{brands.map((b) => <div key={b} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">{b}</div>)}</div>
              </Card>
              <Card>
                <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Cpu className="text-blue-300" /><h3 className="text-2xl font-bold">ECU / TCU Families</h3></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ECU" className="w-36 rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm outline-none" /></div></div>
                <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-auto pr-2 md:grid-cols-2">{filteredEcus.map((e) => <div key={e} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">{e}</div>)}</div>
              </Card>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle eyebrow="Status & Logs" title="Transparent processing with order status system" text="Every order receives a clear timeline. The customer can see what is happening with the file at any time." />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {statuses.map((s) => { const Icon = s.icon; return <Card key={s.label}><Icon className="mb-4 h-8 w-8 text-blue-300" /><h3 className="text-lg font-bold text-white">{s.label}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{s.desc}</p></Card> })}
          </div>
          <Card className="mt-8">
            <div className="mb-5 flex items-center gap-3"><History className="text-blue-300" /><h3 className="text-2xl font-bold">Example File Log</h3></div>
            <div className="space-y-4">
              {['10:24 Original file uploaded', '10:25 Vehicle information submitted', '10:26 35 credits deducted', '10:40 File check started', '11:20 Software modification in progress', '12:05 Modified file uploaded', '12:08 Customer downloaded file'].map((log) => <div key={log} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-sm text-slate-300"><CheckCircle2 className="h-5 w-5 text-emerald-300" />{log}</div>)}
            </div>
          </Card>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025] py-16">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle eyebrow="Admin Panel" title="MG AutoTech Admin Area" text="The admin area manages orders, customers, credits, prices, invoices, support tickets and content." />
            <div className="grid gap-3 md:grid-cols-4">
              {adminItems.map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300"><PanelTop className="mb-2 h-5 w-5 text-blue-300" />{item}</div>)}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle eyebrow="FAQ & Legal" title="Clear information before every order" text="The platform answers important questions about credits, files, tools, processing, revisions and legal use." />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              {['Wie funktioniert der File Service?', 'Wann werden Credits abgezogen?', 'Welche Datei muss ich hochladen?', 'Welche Tools werden unterstützt?', 'Was ist der Unterschied zwischen Stage 1, 2 und 3?', 'Kann ich eine Revision anfragen?', 'Gibt es Partnerpreise für Werkstätten?', 'Werden Standardfiles verwendet?'].map((q) => <div key={q} className="border-b border-white/10 py-4 last:border-0"><div className="flex items-center justify-between font-semibold text-white">{q}<ChevronRight className="h-4 w-4 text-slate-500" /></div></div>)}
            </Card>
            <Card className="border-amber-400/20 bg-amber-500/[0.05]">
              <ShieldAlert className="mb-4 h-10 w-10 text-amber-300" />
              <h3 className="text-2xl font-bold text-white">Legal Disclaimer</h3>
              <p className="mt-4 leading-7 text-slate-300">Alle Softwarelösungen werden ausschließlich auf Kundenwunsch erstellt. Der Kunde ist selbst für die Einhaltung gesetzlicher Vorschriften verantwortlich. Einige Lösungen sind ausschließlich für Motorsport, Export, Prüfstand, Diagnosezwecke oder Offroad-Nutzung bestimmt.</p>
              <label className="mt-6 flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300"><input type="checkbox" className="mt-1" />Ich bestätige, dass ich für die rechtmäßige Nutzung selbst verantwortlich bin und die Hinweise gelesen habe.</label>
            </Card>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-4 pb-16">
          <Card className="overflow-hidden p-0">
            <div className="grid lg:grid-cols-[1fr_.8fr]">
              <div className="p-8 md:p-12">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">Contact</div>
                <h2 className="text-4xl font-black text-white">Ready for the next file service order?</h2>
                <p className="mt-4 max-w-2xl leading-7 text-slate-300">Customers can contact MG AutoTech through the dashboard, support ticket, WhatsApp or email.</p>
                <div className="mt-8 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-4"><MessageCircle className="mb-2 text-blue-300" />WhatsApp Support</div>
                  <div className="rounded-2xl bg-white/5 p-4"><Mail className="mb-2 text-blue-300" />E-Mail Anfrage</div>
                  <div className="rounded-2xl bg-white/5 p-4"><ReceiptText className="mb-2 text-blue-300" />Rechnung & Auftrag</div>
                </div>
              </div>
              <div className="bg-blue-600/10 p-8 md:p-12">
                <div className="space-y-4">
                  <input placeholder="Name / Firma" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 outline-none" />
                  <input placeholder="E-Mail" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 outline-none" />
                  <textarea placeholder="Nachricht" rows={5} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 outline-none" />
                  <button className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white">Send Request</button>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
