import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDeterministicDtcFallback,
  buildInvalidDtcInputResponse,
  buildProviderUnavailableDtcResponse,
  erroredDtcProviderIdentity,
  unavailableDtcProviderIdentity,
} from "../src/lib/dtcAnalyzer/fallback";
import {
  buildRequestDtcAnalyzerRequest,
  projectCustomerDtcAnalysis,
} from "../src/lib/dtcAnalyzer/requestIntegration";
import type {
  DtcAnalyzerMessageDescriptor,
  DtcAnalyzerResponse,
} from "../src/lib/dtcAnalyzer/types";
import {
  dtcAnalyzerLocaleOrder,
  dtcAnalyzerMessageCatalog,
  dtcAnalyzerMessageRows,
  localizeDtcAnalyzerMessage,
  localizeDtcConfidence,
} from "../src/lib/i18n/dtc-analyzer-translations";

function placeholders(value: string) {
  return [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

function responseDescriptors(response: DtcAnalyzerResponse) {
  const descriptors: DtcAnalyzerMessageDescriptor[] = [
    response.summaryMessage,
    ...response.missingInformationMessages,
    ...response.humanReview.requiredBeforeMessages,
    ...response.safetyBoundaryMessages,
  ];

  for (const code of response.codes) {
    descriptors.push(
      code.systemLabelMessage,
      code.titleMessage,
      code.customerExplanationMessage,
      ...code.missingInformationMessages,
      ...code.evidence.flatMap((item) => item.message ? [item.message] : []),
      ...code.recommendations.flatMap((item) => item.message ? [item.message] : []),
    );
  }

  return descriptors;
}

function projectionDescriptors(response: DtcAnalyzerResponse) {
  const projection = projectCustomerDtcAnalysis(response);
  return [projection.stateLabelMessage, projection.providerNoticeMessage];
}

function scenarioResponses() {
  const allCodes = buildDeterministicDtcFallback({
    source: "local_test",
    text: "P0101 P0299 P0401 P0402 P0420 P0087 P2002 P2453 U0100 P1234 P2234 C1234 B1234 U1234",
  });
  const deterministic = buildDeterministicDtcFallback({ source: "local_test", text: "P0401" });
  const unavailable = buildProviderUnavailableDtcResponse({ source: "local_test", text: "P0401" });
  const invalidEmpty = buildInvalidDtcInputResponse({ source: "local_test", text: "" });
  const invalidCode = buildInvalidDtcInputResponse({ source: "local_test", text: "not-a-code" });
  const providerError = buildDeterministicDtcFallback(
    { source: "local_test", text: "P0401" },
    undefined,
    {
      provider: erroredDtcProviderIdentity({
        providerId: "local-provider",
        providerKind: "mock",
        modelName: null,
      }),
    },
  );
  const providerUnavailableFallback = buildDeterministicDtcFallback(
    { source: "local_test", text: "P0401" },
    undefined,
    { provider: unavailableDtcProviderIdentity("Provider unavailable in test.") },
  );
  const providerSuccess: DtcAnalyzerResponse = {
    ...deterministic,
    status: "success",
    isAiGenerated: true,
    fallback: { ...deterministic.fallback, used: false },
  };

  return [
    allCodes,
    deterministic,
    unavailable,
    invalidEmpty,
    invalidCode,
    providerError,
    providerUnavailableFallback,
    providerSuccess,
  ];
}

test("DTC result catalog has complete unique 12-locale rows with placeholder parity", () => {
  assert.deepEqual(
    dtcAnalyzerLocaleOrder,
    ["en", "nl", "de", "fr", "it", "ru", "es", "tr", "pt", "zh", "pl", "sq"],
  );
  assert.equal(dtcAnalyzerMessageRows.length, 109);
  assert.equal(new Set(dtcAnalyzerMessageRows.map(([key]) => key)).size, 109);

  for (const [key, english, ...localized] of dtcAnalyzerMessageRows) {
    assert.equal(localized.length, 11, key);
    const expectedPlaceholders = placeholders(english);
    for (const [index, translation] of localized.entries()) {
      assert.ok(translation.trim(), `${dtcAnalyzerLocaleOrder[index + 1]}.${key}`);
      assert.deepEqual(
        placeholders(translation),
        expectedPlaceholders,
        `${dtcAnalyzerLocaleOrder[index + 1]}.${key} placeholder mismatch`,
      );
      if (english.trim().split(/\s+/).length >= 3) {
        assert.notEqual(translation, english, `${dtcAnalyzerLocaleOrder[index + 1]}.${key} English leak`);
      }
    }
    assert.equal(dtcAnalyzerMessageCatalog[key].en, english);
  }
});

test("reviewed DTC pressure and human-review copy keeps native technical grammar", () => {
  const exactGoldens = {
    "code.P0087.title": {
      fr: "Contexte de pression trop basse dans la rampe ou le système",
      it: "Contesto di pressione troppo bassa nel rail o nel sistema",
      es: "Contexto de presión demasiado baja en el raíl o en el sistema",
      tr: "Yakıt rampasında veya sistemde çok düşük basınç bağlamı",
      sq: "Kontekst i presionit tepër të ulët në shinë ose në sistemin e karburantit",
    },
    "code.P2002.title": {
      sq: "Kontekst i efikasitetit të filtrit të grimcave dizel",
    },
    "human.required_before": {
      fr: "Une vérification humaine est requise avant les activités suivantes : {items}.",
      it: "È necessaria una verifica umana prima delle seguenti attività: {items}.",
      es: "Se requiere revisión humana antes de las siguientes acciones: {items}.",
      pt: "É necessária revisão humana antes das seguintes ações: {items}.",
      pl: "Przed następującymi działaniami wymagana jest weryfikacja przez człowieka: {items}.",
    },
    "safety.human_review": {
      de: "Vor jeder Aktion an einer Kundendatei ist eine Prüfung durch einen Diagnosespezialisten und einen Tuner erforderlich.",
      it: "Prima di qualsiasi azione sul file del cliente è necessaria una verifica da parte di un diagnostico e di un preparatore.",
      tr: "Herhangi bir müşteri dosyası işleminden önce bir teşhis uzmanı ve tuner tarafından inceleme yapılması gerekir.",
      pl: "Przed każdą operacją na pliku klienta wymagana jest weryfikacja przez diagnostę i tunera.",
    },
  } as const;

  for (const [key, localizedGoldens] of Object.entries(exactGoldens)) {
    for (const [locale, expected] of Object.entries(localizedGoldens)) {
      assert.equal(
        dtcAnalyzerMessageCatalog[
          key as keyof typeof dtcAnalyzerMessageCatalog
        ][locale as keyof (typeof dtcAnalyzerMessageCatalog)[keyof typeof dtcAnalyzerMessageCatalog]],
        expected,
        `${locale}.${key}`,
      );
    }
  }

  const requiredItems = "DTC-off, checksum";
  for (const [locale, expected] of Object.entries(
    exactGoldens["human.required_before"],
  )) {
    assert.equal(
      localizeDtcAnalyzerMessage(
        locale as keyof typeof dtcAnalyzerMessageCatalog["human.required_before"],
        {
          key: "human.required_before",
          fallback: "Human review is required before {items}.",
          params: { items: requiredItems },
        },
      ),
      expected.replace("{items}", requiredItems),
      `${locale}.human.required_before interpolation`,
    );
  }
});

test("every stable descriptor emitted by DTC producers is covered by the typed catalog", () => {
  const responses = scenarioResponses();
  const descriptors = responses.flatMap((response) => [
    ...responseDescriptors(response),
    ...projectionDescriptors(response),
  ]);
  const emittedKeys = new Set(descriptors.map((descriptor) => descriptor.key));
  const catalogKeys = new Set(dtcAnalyzerMessageRows.map(([key]) => key));
  const renderOnlyKeys = new Set([
    "summary.invalid_generic",
    "confidence.none",
    "confidence.low",
    "confidence.medium",
    "confidence.high",
    "evidence.generic",
    "recommendation.generic",
    "human.required_before",
  ]);

  assert.deepEqual(
    [...catalogKeys].filter((key) => !emittedKeys.has(key) && !renderOnlyKeys.has(key)).sort(),
    [],
  );
  for (const descriptor of descriptors) {
    assert.ok(dtcAnalyzerMessageCatalog[descriptor.key], descriptor.key);
  }
});

test("all dynamic customer DTC results localize without unresolved tokens or English fallback", () => {
  const descriptors = scenarioResponses().flatMap((response) => [
    ...responseDescriptors(response),
    ...projectionDescriptors(response),
  ]);

  for (const locale of dtcAnalyzerLocaleOrder) {
    for (const descriptor of descriptors) {
      const localized = localizeDtcAnalyzerMessage(locale, descriptor);
      assert.doesNotMatch(localized, /\{[a-zA-Z][a-zA-Z0-9]*\}/, `${locale}.${descriptor.key}`);
      if (locale !== "en" && descriptor.fallback.trim().split(/\s+/).length >= 3) {
        assert.notEqual(localized, descriptor.fallback, `${locale}.${descriptor.key}`);
      }
    }
    for (const confidence of ["none", "low", "medium", "high"] as const) {
      assert.ok(localizeDtcConfidence(locale, confidence));
    }
  }
});

test("DTC codes and raw vehicle or ECU values remain byte-identical leaves", () => {
  const raw = {
    id: "order-raw",
    vehicle_brand: "BMW-ÄΩ",
    vehicle_model: "M340i xDrive / G20",
    vehicle_engine: "B58B30M1 🔧",
    ecu: "Bosch MG1CS003 [RAW]",
    notes: "Workshop note: U0100",
    hw_sw: "HW-α/SW-ß",
  };
  const request = buildRequestDtcAnalyzerRequest(raw, "customer");
  for (const value of [raw.vehicle_brand, raw.vehicle_model, raw.vehicle_engine, raw.ecu, raw.notes, raw.hw_sw]) {
    assert.ok(request.text.includes(value) || Object.values(request.vehicle ?? {}).includes(value), value);
  }

  const response = buildDeterministicDtcFallback({ source: "local_test", text: "U0100 P0401" });
  assert.deepEqual(response.normalizedInput.normalizedCodes, ["U0100", "P0401"]);
  for (const locale of dtcAnalyzerLocaleOrder) {
    const localized = localizeDtcAnalyzerMessage(locale, response.summaryMessage);
    assert.match(localized, /U0100, P0401/);
  }

  const source = readFileSync("src/app/dashboard/orders/[id]/page.tsx", "utf8");
  const panel = source.slice(source.indexOf("function CustomerDtcAnalysisPanel"), source.indexOf("function CustomerSourceFileRow"));
  assert.match(panel, /analysis\.detectedCodes\.join\(", "\)/);
  assert.match(panel, /translate="no" data-no-translate>\{code\.code\}/);
  assert.doesNotMatch(panel, /\{analysis\.(?:stateLabel|providerNotice|summary)\}/);
  assert.doesNotMatch(panel, /\{code\.(?:systemLabel|title|customerExplanation|confidence)\}/);
  assert.match(panel, /analysis\.missingInformationMessages/);
  assert.match(panel, /analysis\.safetyBoundaryMessages/);
  assert.match(panel, /analysis\.humanReview\.requiredBeforeMessages/);
});
