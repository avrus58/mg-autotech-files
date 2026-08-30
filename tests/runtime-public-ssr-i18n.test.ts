import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildFooterWhatsAppHref,
  FooterLocalizationBoundary,
} from "../src/components/Footer";
import {
  runtimePublicFooterExact,
  runtimePublicFooterWhatsAppMessage,
  runtimePublicFooterWhatsAppMessages,
} from "../src/components/RuntimePublicFooter";
import { RuntimePublicLocalization } from "../src/components/RuntimePublicLocalization";
import { FileServiceSearchNavigator } from "../src/components/FileServiceSearchNavigator";
import { Stage1Authority } from "../src/components/Stage1Authority";
import { StageComparison } from "../src/components/StageComparison";
import {
  DetailPanel,
  SolutionCategoryCard,
} from "../src/components/LocalizedServiceCards";
import { PublicSeoHeader } from "../src/components/PublicSeoHeader";
import { FileReadinessAssistant } from "../src/components/tools/FileReadinessAssistant";
import { EcuReadMethodAdvisor } from "../src/components/tools/EcuReadMethodAdvisor";
import { PerformanceTools } from "../src/components/tools/PerformanceTools";
import { CountrySelect } from "../src/components/CountrySelect";
import { InternationalPhoneField } from "../src/components/InternationalPhoneField";
import { OnlineStatus } from "../src/components/OnlineStatus";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";
import {
  buildEcuReadAdvisorCopy,
  buildFileReadinessCopy,
  buildPerformanceCalculatorCopy,
} from "../src/lib/i18n/tool-client-copy";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicInLanguage,
  runtimePublicMetadataCopy,
  runtimePublicOpenGraphLocale,
  runtimePublicText,
  type RuntimePublicScope,
} from "../src/lib/i18n/runtime-public";
import { Rocket } from "lucide-react";
import { getLocalizedPublicHref } from "../src/lib/i18nRoutes";
import { buildServicesMetadata } from "../src/lib/servicesPageMetadata";
import { fileServiceSearchIntentGroups } from "../src/lib/fileServiceSearchIntents";
import { stageTuningComparisons } from "../src/lib/stageTuning";

const aboutTitle = "About MG AutoTech File Service";
const aboutDescription =
  "Learn how MG AutoTech structures ECU and TCU file requests, technical checks, secure delivery, file versions and workshop support.";

const auditedMetadataCases: Array<{
  title: string;
  description: string;
  scopes: readonly RuntimePublicScope[];
}> = [
  { title: aboutTitle, description: aboutDescription, scopes: ["core"] },
  { title: "Contact MG AutoTech", description: "Contact MG AutoTech in Stuttgart for ECU and TCU file-service questions, order support, compatibility checks and customer-account assistance.", scopes: ["core"] },
  { title: "Vehicle ECU & TCU File Service by Brand", description: "Technical ECU and TCU file-service guides for BMW, Mercedes-Benz, Audi, Volkswagen, Porsche, Opel, Renault and Peugeot workshop requests.", scopes: ["core", "vehicle"] },
  { title: "ECU & TCU Platform File-Service Guides", description: "Technical workshop guides for Bosch EDC17, MD1, MG1, Continental SIMOS and SID, Delphi DCM, Denso and transmission controllers.", scopes: ["core", "vehicle"] },
  { title: "Free ECU Workshop Tools", description: "Free automotive workshop tools from MG AutoTech: check file readiness, build request briefs, plan ECU read methods and run safe browser-based calculations.", scopes: ["core", "tools"] },
  { title: "ECU File Readiness Check", description: "Check whether your ECU or TCU file-service request is ready before upload. Get a safe preparation score, next steps and warnings without uploading a file.", scopes: ["core", "tools"] },
  { title: "ECU Request Brief Builder", description: "Create a structured ECU or TCU file-service request brief before upload. Build a clear note with vehicle, service, read method and diagnostic context without uploading files.", scopes: ["core", "tools"] },
  { title: "ECU Read Method Advisor", description: "Plan safer ECU or TCU read preparation before upload. Get a customer-safe OBD, bench, boot or unknown-read checklist without opening or uploading a file.", scopes: ["core", "tools"] },
  { title: "Torque to HP & kW Calculator", description: "Calculate estimated engine power from torque and RPM. Convert Nm and engine speed into kW, mechanical HP and metric PS with transparent formulas.", scopes: ["core", "tools"] },
  { title: "ECU & TCU Workshop Knowledge Center", description: "A practical MG AutoTech knowledge center for ECU and TCU file-service preparation, vehicle and controller identification, read methods, service selection and workshop tools.", scopes: ["core", "workshop-guides"] },
  { title: "MG AutoTech Windows Upload Assistant Beta", description: "The MG AutoTech File Upload Assistant for Windows is currently available only for selected beta customers. Public downloads are not enabled yet.", scopes: ["core"] },
];

test("runtime public metadata and JSON-LD use the server-selected DE/TR locale", () => {
  for (const locale of ["de", "tr"] as const) {
    for (const entry of auditedMetadataCases) {
      const metadata = runtimePublicMetadataCopy(
        locale,
        entry.title,
        entry.description,
        entry.scopes
      );
      assert.notEqual(metadata.title, entry.title, `${locale}: ${entry.title}`);
      assert.notEqual(
        metadata.description,
        entry.description,
        `${locale}: ${entry.description}`
      );
    }

    const servicesMetadata = buildServicesMetadata(locale);
    assert.notEqual(servicesMetadata.title, "ECU & TCU File Service Catalog for Workshops");
    assert.notEqual(
      servicesMetadata.description,
      "Find the right ECU or TCU file service for Stage 1-3, gearbox tuning, DPF, EGR, AdBlue, DTC, file checks and workshop read-method guidance."
    );

    const localized = localizeRuntimePublicJsonLd(
      {
        "@type": "AboutPage",
        name: aboutTitle,
        description: aboutDescription,
        inLanguage: runtimePublicInLanguage(locale),
      },
      locale,
      ["core"]
    );
    assert.notEqual(localized.name, aboutTitle);
    assert.notEqual(localized.description, aboutDescription);
    assert.equal(localized.inLanguage, locale === "de" ? "de-DE" : "tr-TR");
    assert.equal(
      runtimePublicOpenGraphLocale(locale),
      locale === "de" ? "de_DE" : "tr_TR"
    );
  }
});

test("runtime public initial HTML and locale-aware links do not flash English", () => {
  for (const locale of ["de", "tr"] as const) {
    const html = renderToStaticMarkup(
      createElement(
        RuntimePublicLocalization,
        { locale, scopes: ["core"] },
        createElement(
          "main",
          null,
          createElement("h1", null, aboutTitle),
          createElement("a", { href: "/file-service" }, "File service")
        )
      )
    );

    assert.doesNotMatch(html, new RegExp(`>${aboutTitle}<`));
    assert.match(html, new RegExp(`href="/${locale}/file-service"`));
    assert.equal(
      getLocalizedPublicHref("/about", locale),
      "/about",
      "single-URL runtime routes must not gain a duplicate locale prefix"
    );

    const headerHtml = renderToStaticMarkup(
      createElement(PublicSeoHeader, { locale })
    );
    assert.match(headerHtml, new RegExp(`href="/${locale}/file-service"`));
    assert.doesNotMatch(headerHtml, />How it works</);
  }
});

test("nested public service components localize their first server-rendered HTML", () => {
  const locale = "de" as const;
  const scopes = ["core", "services"] as const;

  const navigator = renderToStaticMarkup(
    createElement(FileServiceSearchNavigator, { locale }),
  );
  assert.doesNotMatch(navigator, />Workshop search navigator</u);
  assert.match(
    navigator,
    new RegExp(runtimePublicText(locale, "Workshop search navigator", scopes)),
  );
  assert.doesNotMatch(navigator, />Also described as</u);
  assert.doesNotMatch(
    navigator,
    /ECU file service \/ online ECU file service/u,
  );
  assert.match(
    renderToStaticMarkup(createElement(FileServiceSearchNavigator)),
    /ECU file service \/ online ECU file service/u,
  );
  for (const group of fileServiceSearchIntentGroups) {
    for (const source of [group.title, group.summary]) {
      assert.notEqual(runtimePublicText(locale, source, scopes), source, source);
      assert.ok(!navigator.includes(source), source);
    }
    for (const destination of group.destinations) {
      for (const source of [destination.title, destination.decision]) {
        assert.notEqual(runtimePublicText(locale, source, scopes), source, source);
        assert.ok(!navigator.includes(source), source);
      }
    }
  }

  const stageAuthority = renderToStaticMarkup(
    createElement(Stage1Authority, { locale }),
  );
  assert.doesNotMatch(stageAuthority, />Is this a Stage 1 file-service request\?</u);
  assert.match(
    stageAuthority,
    new RegExp(
      runtimePublicText(
        locale,
        "Is this a Stage 1 file-service request?",
        scopes,
      ).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
    ),
  );

  const comparison = renderToStaticMarkup(
    createElement(StageComparison, { compact: true, locale }),
  );
  assert.doesNotMatch(
    comparison,
    />Stage 1 vs Stage 2 vs Stage 3 ECU tuning files\.</u,
  );
  for (const stage of stageTuningComparisons) {
    for (const source of [
      stage.name,
      stage.summary,
      stage.hardwareCondition,
      stage.calibrationScope,
      stage.supportingModifications,
      stage.logging,
      stage.intendedFor,
      stage.reviewRequirement,
      stage.orderingMethod,
    ]) {
      assert.notEqual(runtimePublicText(locale, source, scopes), source, source);
      assert.ok(!comparison.includes(source), source);
    }
  }

  const category = renderToStaticMarkup(
    createElement(SolutionCategoryCard, {
      locale,
      category: {
        title: "Performance & drivability",
        eyebrow: "Power delivery",
        text: "Performance-oriented request paths for vehicles where the workshop needs clean notes, vehicle data and file context before review.",
        icon: Rocket,
        tone: "red",
        services: ["Stage 3 manual review", "ECO tuning"],
      },
    }),
  );
  assert.doesNotMatch(category, />Performance &amp; drivability</u);
  assert.match(
    category,
    new RegExp(
      runtimePublicText(locale, "Performance & drivability", scopes).replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&",
      ),
    ),
  );

  const detail = renderToStaticMarkup(
    createElement(DetailPanel, {
      locale,
      title: "Supported vehicle focus",
      items: ["Original ECU file"],
      icon: Rocket,
    }),
  );
  assert.doesNotMatch(detail, />Supported vehicle focus</u);
  assert.doesNotMatch(detail, />Original ECU file</u);
});

test("client component boundaries render the server-selected locale before hydration", () => {
  const locale = "de" as const;
  const LocaleProvider = ActiveLocaleProvider as FunctionComponent<{
    initialLocale: typeof locale;
    children?: ReactNode;
  }>;
  const renderLocalized = (child: ReactNode) =>
    renderToStaticMarkup(
      createElement(LocaleProvider, { initialLocale: locale }, child)
    );

  const readinessCopy = buildFileReadinessCopy(locale);
  const readiness = renderLocalized(
    createElement(FileReadinessAssistant, { copy: readinessCopy })
  );
  assert.doesNotMatch(readiness, />Vehicle information</u);
  assert.match(readiness, new RegExp(readinessCopy["Vehicle information"]));

  const advisorCopy = buildEcuReadAdvisorCopy(locale);
  const advisor = renderLocalized(
    createElement(EcuReadMethodAdvisor, { copy: advisorCopy })
  );
  assert.doesNotMatch(advisor, />Control unit type</u);
  assert.match(advisor, new RegExp(advisorCopy["Control unit type"]));

  const calculatorCopy = buildPerformanceCalculatorCopy(locale);
  const calculator = renderLocalized(
    createElement(PerformanceTools, { copy: calculatorCopy })
  );
  assert.doesNotMatch(calculator, />Performance Tools</u);
  assert.match(calculator, new RegExp(calculatorCopy["Performance Tools"]));

  const country = renderLocalized(
    createElement(CountrySelect, {
      value: "",
      onChange: () => undefined,
    })
  );
  assert.match(country, /Deutschland/u);
  assert.doesNotMatch(country, />Germany</u);

  const phone = renderLocalized(
    createElement(InternationalPhoneField, {
      countryCode: "DE",
      nationalNumber: "",
      onCountryCodeChange: () => undefined,
      onNationalNumberChange: () => undefined,
    })
  );
  assert.match(phone, /Deutschland/u);
  assert.doesNotMatch(phone, />Germany/u);

  const status = renderLocalized(createElement(OnlineStatus));
  assert.match(status, /Live-Status|Verfügbarkeit prüfen/u);
  assert.doesNotMatch(status, /Checking availability/u);
});

test("runtime public footer is localized in initial HTML and WhatsApp intent", () => {
  for (const locale of ["de", "tr"] as const) {
    const exact = runtimePublicFooterExact(locale);
    const html = renderToStaticMarkup(
      createElement(
        FooterLocalizationBoundary,
        { activeLocale: locale, initialLocalization: { locale, exact } },
        createElement("footer", null, "Ready to upload a file?")
      )
    );
    assert.doesNotMatch(html, /Ready to upload a file\?/);

    const message = runtimePublicFooterWhatsAppMessage(locale);
    assert.equal(runtimePublicFooterWhatsAppMessages()[locale], message);
    assert.notEqual(
      message,
      "Hello MG AutoTech, I need help with a file service request."
    );
    const href = buildFooterWhatsAppHref("4915151561670", message);
    assert.ok(href);
    assert.equal(new URL(href).searchParams.get("text"), message);
  }
});

test("runtime canonical contract keeps one stable URL and every audited route opts in", () => {
  assert.deepEqual(runtimePublicAlternates("/about"), {
    canonical: "https://file.mgautotech.de/about",
  });
  assert.equal("languages" in (runtimePublicAlternates("/about") ?? {}), false);

  for (const route of [
    "about",
    "contact",
    "brands",
    "ecu-platforms",
    "tools",
    "services",
    "widget",
    "workshop-guides",
    "download/windows",
    "tools/file-readiness-check",
    "tools/request-brief-builder",
    "tools/ecu-read-method-advisor",
    "tools/torque-power-calculator",
  ]) {
    const source = readFileSync(`src/app/${route}/page.tsx`, "utf8");
    assert.match(source, /getServerLocale/);
    assert.match(source, /generateMetadata/);
    if (route !== "widget") {
      assert.match(source, /RuntimePublic(?:Localization|Footer)/);
    }
  }
});
