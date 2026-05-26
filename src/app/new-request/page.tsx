"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  BadgeCheck,
  Car,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileCode2,
  Gauge,
  Home,
  Loader2,
  ShieldCheck,
  Upload,
  Wrench,
} from "lucide-react";

type MainService = {
  id: string;
  title: string;
  credits: number;
  description: string;
};

type ExtraService = {
  id: string;
  title: string;
  credits: number;
};

const mainServices: MainService[] = [
  {
    id: "only_options",
    title: "Only Options",
    credits: 0,
    description: "Only selected software options without stage tuning.",
  },
  {
    id: "stage_1",
    title: "Stage 1",
    credits: 10,
    description: "Safe performance optimization for stock vehicles.",
  },
  {
    id: "stage_2",
    title: "Stage 2",
    credits: 15,
    description: "For vehicles with hardware modifications.",
  },
  {
    id: "stage_3",
    title: "Stage 3",
    credits: 30,
    description: "For heavily modified setups, manual review recommended.",
  },
  {
    id: "original_file",
    title: "Original File",
    credits: 4,
    description: "Original / stock file request.",
  },
];

const extraServices: ExtraService[] = [
  { id: "dpf_off", title: "DPF OFF", credits: 6 },
  { id: "egr_off", title: "EGR / AGR OFF", credits: 6 },
  { id: "adblue_off", title: "AdBlue / SCR OFF", credits: 11 },
  { id: "dpf_egr_off", title: "DPF + EGR OFF", credits: 9 },
  { id: "adblue_dpf_egr", title: "AdBlue + DPF + EGR OFF", credits: 15 },
  { id: "adblue_dpf", title: "AdBlue + DPF OFF", credits: 14 },
  { id: "decat", title: "Decat / CAT OFF", credits: 6 },
  { id: "o2_lambda", title: "O2 / Lambda OFF", credits: 5 },
  { id: "dtc_off", title: "DTC OFF", credits: 4 },
  { id: "maf_off", title: "MAF OFF", credits: 5 },
  { id: "additive", title: "Additive OFF", credits: 6 },
  { id: "vmax_off", title: "VMAX OFF", credits: 5 },
  { id: "hot_start", title: "Hot Start / Cold Start", credits: 5 },
  { id: "flap_off", title: "Swirl Flap OFF", credits: 7 },
  { id: "e85_flex", title: "E85 Flex-Fuel", credits: 10 },
  { id: "water_pump", title: "Water Pump OFF", credits: 5 },
  { id: "start_stop", title: "Start & Stop OFF", credits: 1 },
  { id: "pops_bangs", title: "Pops & Bangs", credits: 8 },
  { id: "hardcut", title: "Hardcut Limiter", credits: 8 },
  { id: "launch_control", title: "Launch Control", credits: 10 },
  { id: "special_request", title: "Special Request", credits: 0 },
  { id: "file_check", title: "File Check", credits: 4 },
  { id: "checksum", title: "Checksum Correction", credits: 2 },
  { id: "tva_off", title: "TVA OFF", credits: 5 },
  { id: "opf_off", title: "OPF / GPF OFF", credits: 12 },
  { id: "thermostat", title: "Thermostat Fix", credits: 6 },
  { id: "file_expertise", title: "File Expertise", credits: 17 },
];

function SelectBox({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
        {required && <span className="text-red-600">*</span>} {label}
      </div>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition focus:border-red-700"
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option} value={option} className="bg-[#111]">
              {option}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      </div>
    </label>
  );
}

function InputBox({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
        {required && <span className="text-red-600">*</span>} {label}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
      />
    </label>
  );
}

export default function NewRequestPage() {
  const router = useRouter();

  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleGeneration, setVehicleGeneration] = useState("");
  const [vehicleEngine, setVehicleEngine] = useState("");
  const [ecu, setEcu] = useState("");
  const [gearbox, setGearbox] = useState("");
  const [year, setYear] = useState("");
  const [readMethod, setReadMethod] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [hwSw, setHwSw] = useState("");
  const [mainService, setMainService] = useState("stage_1");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [masterSlave, setMasterSlave] = useState<"master" | "slave">("master");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const selectedMainService = mainServices.find(
    (service) => service.id === mainService
  );

  const totalCredits = useMemo(() => {
    const mainCredits = selectedMainService?.credits ?? 0;

    const extrasCredits = selectedExtras.reduce((sum, id) => {
      const service = extraServices.find((item) => item.id === id);
      return sum + (service?.credits ?? 0);
    }, 0);

    return mainCredits + extrasCredits;
  }, [selectedExtras, selectedMainService]);

  const serviceSummary = useMemo(() => {
    const main = selectedMainService?.title ?? "Service";
    const extras = selectedExtras
      .map((id) => extraServices.find((item) => item.id === id)?.title)
      .filter(Boolean);

    return [main, ...extras].join(" + ");
  }, [selectedExtras, selectedMainService]);

  const toggleExtra = (id: string) => {
    setSelectedExtras((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const handleSubmit = async () => {
    setMessage("");

    if (!vehicleBrand || !vehicleModel || !vehicleEngine) {
      setMessage("Please fill in brand, model and engine.");
      return;
    }

    if (!selectedFile) {
      setMessage("Please upload your original ECU / TCU file.");
      return;
    }

    if (!paymentAccepted || !responsibilityAccepted) {
      setMessage("Please accept payment and responsibility confirmation.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const customerEmail = userData.user.email ?? "";

    let originalFilePath: string | null = null;

    if (selectedFile) {
      const safeFileName = selectedFile.name
        .replaceAll(" ", "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const filePath = `${userData.user.id}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("customer-files")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setSubmitting(false);
        setMessage(uploadError.message);
        return;
      }

      originalFilePath = filePath;
    }

    const { error } = await supabase.rpc("create_order_with_credit_deduction", {
      p_customer_email: customerEmail,
      p_vehicle_brand: vehicleBrand,
      p_vehicle_model: vehicleModel,
      p_vehicle_generation: vehicleGeneration,
      p_vehicle_engine: vehicleEngine,
      p_service_type: serviceSummary,
      p_credits_required: totalCredits,
      p_notes: notes || "-",
      p_ecu: ecu || null,
      p_gearbox: gearbox || null,
      p_vehicle_year: year || null,
      p_read_method: readMethod || null,
      p_license_plate: licensePlate || null,
      p_hw_sw: hwSw || null,
      p_master_slave: masterSlave,
      p_uploaded_file_name: fileName || null,
      p_original_file_path: originalFilePath,
    });

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
              <Upload className="h-7 w-7 text-red-600" />
            </div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">New File Request</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 inline h-4 w-4" />
              Dashboard
            </Link>

            <Link
              href="/"
              className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 md:inline-block"
            >
              <Home className="mr-2 inline h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional ECU / TCU request form
            </div>

            <h1 className="text-4xl font-black md:text-5xl">
              Create New
              <span className="block text-red-600">File Service Request</span>
            </h1>

            <p className="mt-5 max-w-3xl leading-8 text-zinc-400">
              Select vehicle information, choose the required software solution,
              upload your original file and submit the request to MG AutoTech.
            </p>
          </div>

          <div className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-7">
            <CreditCard className="mb-5 h-9 w-9 text-red-500" />
            <div className="text-sm text-zinc-400">Estimated Total</div>
            <div className="mt-2 text-5xl font-black">{totalCredits}</div>
            <div className="mt-1 text-sm font-bold text-red-300">Credits</div>

            <div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm leading-6 text-zinc-300">
              {serviceSummary || "Select service"}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Car className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">Vehicle Information</h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <SelectBox
                  label="Brand"
                  value={vehicleBrand}
                  onChange={setVehicleBrand}
                  required
                  options={[
  "Mercedes-Benz",
  "BMW",
  "Audi",
  "Volkswagen",
  "Skoda",
  "Seat",
  "Cupra",
  "Porsche",
  "Opel",
  "Ford",
  "Peugeot",
  "Citroen",
  "DS Automobiles",
  "Renault",
  "Dacia",
  "Fiat",
  "Abarth",
  "Alfa Romeo",
  "Lancia",
  "Jeep",
  "Chrysler",
  "Dodge",
  "Toyota",
  "Lexus",
  "Nissan",
  "Infiniti",
  "Honda",
  "Acura",
  "Mazda",
  "Mitsubishi",
  "Subaru",
  "Suzuki",
  "Hyundai",
  "Kia",
  "Genesis",
  "Volvo",
  "Polestar",
  "Mini",
  "Smart",
  "Land Rover",
  "Range Rover",
  "Jaguar",
  "Maserati",
  "Bentley",
  "Lamborghini",
  "Ferrari",
  "Aston Martin",
  "McLaren",
  "Rolls-Royce",
  "Tesla",
  "BYD",
  "MG",
  "Lynk & Co",
  "Iveco",
  "MAN",
  "DAF",
  "Scania",
  "Volvo Trucks",
  "Mercedes-Benz Trucks",
  "Other",
]}
                />

                <InputBox
                  label="Model"
                  value={vehicleModel}
                  onChange={setVehicleModel}
                  required
                  placeholder="e.g. E-Class, Golf 7, A6"
                />

                <InputBox
                  label="Generation"
                  value={vehicleGeneration}
                  onChange={setVehicleGeneration}
                  placeholder="e.g. W212, F30, 4G"
                />

                <InputBox
                  label="Engine"
                  value={vehicleEngine}
                  onChange={setVehicleEngine}
                  required
                  placeholder="e.g. 2.0 TDI 150HP"
                />

                <InputBox
                  label="Year"
                  value={year}
                  onChange={setYear}
                  placeholder="e.g. 2016"
                />

                <InputBox
                  label="License Plate"
                  value={licensePlate}
                  onChange={setLicensePlate}
                  placeholder="Optional"
                />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Gauge className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">ECU / Read Information</h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <InputBox
                  label="ECU / TCU"
                  value={ecu}
                  onChange={setEcu}
                  placeholder="e.g. Bosch EDC17C46"
                />

                <SelectBox
                  label="Gearbox"
                  value={gearbox}
                  onChange={setGearbox}
                  options={[
                    "Manual",
                    "Automatic",
                    "DSG",
                    "ZF 8HP",
                    "Mercedes 7G",
                    "Mercedes 9G",
                    "Other",
                  ]}
                />

                <InputBox
                  label="HW / SW Number"
                  value={hwSw}
                  onChange={setHwSw}
                  placeholder="Optional"
                />

                <SelectBox
                  label="Read Method"
                  value={readMethod}
                  onChange={setReadMethod}
                  options={["OBD", "Bench", "Boot", "Virtual Read", "Other"]}
                />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <FileCode2 className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">Main Service</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {mainServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setMainService(service.id)}
                    className={`rounded-2xl border p-5 text-left transition hover:-translate-y-1 ${
                      mainService === service.id
                        ? "border-red-700 bg-red-950/35"
                        : "border-white/10 bg-black/30 hover:border-red-800/60"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-black">{service.title}</span>
                      {mainService === service.id && (
                        <CheckCircle2 className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="text-sm font-black text-red-400">
                      {service.credits} Credits
                    </div>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                      {service.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Wrench className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">Actions To Be Taken</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {extraServices.map((service) => {
                  const active = selectedExtras.includes(service.id);

                  return (
                    <button
                      key={service.id}
                      onClick={() => toggleExtra(service.id)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition hover:-translate-y-0.5 ${
                        active
                          ? "border-red-700 bg-red-950/35 text-white"
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-red-800/60 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? "border-red-500 bg-red-600"
                            : "border-zinc-600"
                        }`}
                      >
                        {active && <CheckCircle2 className="h-4 w-4" />}
                      </span>
                      <span>
                        {service.title}{" "}
                        <span className="text-zinc-500">
                          ({service.credits} Credit)
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Upload className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">Your File</h2>
              </div>

              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-black/30 p-8 text-center transition hover:border-red-700 hover:bg-red-950/20">
                <Upload className="mb-4 h-10 w-10 text-red-600" />
                <div className="font-black">
                  {fileName || "Drag and drop a file here or click"}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Supported later: .bin, .ori, .zip, .frf, .sgo, diagnostic
                  reports and screenshots.
                </p>

                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    setFileName(file?.name ?? "");
                  }}
                />
              </label>

              <div className="mt-5">
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                  If you have a note / DTC code
                </div>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={6}
                  placeholder="Example: Please clear code P0420. Customer wants Stage 1 + EGR OFF..."
                  className="w-full rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setMasterSlave("master")}
                  className={`rounded-xl px-5 py-3 text-sm font-black ${
                    masterSlave === "master"
                      ? "bg-[#b1121b] text-white"
                      : "bg-white/10 text-zinc-400"
                  }`}
                >
                  Master File
                </button>

                <button
                  onClick={() => setMasterSlave("slave")}
                  className={`rounded-xl px-5 py-3 text-sm font-black ${
                    masterSlave === "slave"
                      ? "bg-[#b1121b] text-white"
                      : "bg-white/10 text-zinc-400"
                  }`}
                >
                  Slave File
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-28 rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <ShieldCheck className="mb-5 h-9 w-9 text-red-500" />
              <h3 className="text-2xl font-black">Request Summary</h3>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Vehicle</span>
                  <span className="text-right font-bold">
                    {vehicleBrand || "-"} {vehicleModel || ""}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Service</span>
                  <span className="text-right font-bold">
                    {selectedMainService?.title}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Extra Options</span>
                  <span className="text-right font-bold">
                    {selectedExtras.length}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl border border-red-900/40 bg-red-950/25 p-4">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-right text-xl font-black text-red-400">
                    {totalCredits} Credits
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={paymentAccepted}
                    onChange={(event) =>
                      setPaymentAccepted(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>I accept that the required credits will be used.</span>
                </label>

                <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={responsibilityAccepted}
                    onChange={(event) =>
                      setResponsibilityAccepted(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    I confirm that I am responsible for legal use of the file.
                  </span>
                </label>
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">
                  {message}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Request...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Create Request
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
                Your original file will be uploaded privately and connected to
                this order.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}