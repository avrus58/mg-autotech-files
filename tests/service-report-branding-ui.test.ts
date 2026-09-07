import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { serviceReportT } from "../src/lib/i18n/service-report-translations";

const source = readFileSync("src/components/account/ReportBrandingCard.tsx", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const localRequire = createRequire(import.meta.url);
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
type Ticket = { ownerId: string; version: number; signal: AbortSignal; abort(): void };
type Gate = { owner(): string | null; setOwner(id: string | null): void; begin(): Ticket | null; isCurrent(ticket: Ticket): boolean; dispose(): void };
type UiModule = { createReportBrandingRequestGate(): Gate; parseReportBrandingPreview(payload: unknown): string | null; ReportBrandingCard: React.ComponentType };
type Phase = "loading" | "ready" | "error" | "uploading" | "removing";
type EffectHarness = { effect?: () => () => void; writes: { index: number; value: unknown }[]; result: { session: null; error: Error | null } };

function loadUi(locale: LocaleCode = "en", state: { phase?: Phase; image?: string | null; feedback?: { key: string; error: boolean } | null; signedOut?: boolean } = {}, harness?: EffectHarness) {
  let stateIndex = 0;
  const fakeStates = [undefined, state.signedOut ? null : owner, true, state.image ?? null, state.phase ?? "ready", state.feedback ?? null, 0];
  const exports: Record<string, unknown> = {};
  const noNetwork = () => { throw new Error("No auth/storage/network may execute in this UI test."); };
  const modules: Record<string, unknown> = {
    react: { ...React, useState: (initial: unknown) => {
      const index = stateIndex++;
      return [index === 0 && typeof initial === "function" ? initial() : fakeStates[index], (value: unknown) => harness?.writes.push({ index, value })];
    }, ...(harness ? { useEffect: (effect: () => () => void) => { harness.effect = effect; } } : {}) },
    "next/image": { default: ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className: string }) => React.createElement("img", { src, alt, width, height, className }) },
    "@/lib/authGuards": { authenticatedFetchForUser: noNetwork, getStableSession: harness ? async () => harness.result : noNetwork },
    "@/lib/supabaseClient": { supabase: { auth: { onAuthStateChange: harness ? () => ({ data: { subscription: { unsubscribe() {} } } }) : noNetwork } } },
    "@/lib/useActiveLocale": { useActiveLocale: () => locale },
    "@/lib/i18n/service-report-translations": { serviceReportT },
  };
  runInNewContext(compiled, { exports, AbortController, require: (name: string) => {
    if (name in modules) return modules[name];
    if (name === "react/jsx-runtime" || name === "lucide-react") return localRequire(name);
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports as unknown as UiModule;
}

test("branding request gate aborts replaced requests and ignores account-switch/unmount completions", () => {
  const { createReportBrandingRequestGate } = loadUi();
  const gate = createReportBrandingRequestGate();
  assert.equal(gate.begin(), null);
  gate.setOwner(owner);
  const load = gate.begin();
  assert.ok(load && gate.isCurrent(load));
  const upload = gate.begin();
  assert.ok(upload && gate.isCurrent(upload));
  assert.equal(load.signal.aborted, true);
  assert.equal(gate.isCurrent(load), false);
  gate.setOwner(other);
  assert.equal(upload.signal.aborted, true);
  assert.equal(gate.isCurrent(upload), false);
  const nextAccount = gate.begin();
  assert.ok(nextAccount && nextAccount.ownerId === other);
  gate.dispose();
  assert.equal(nextAccount.signal.aborted, true);
  assert.equal(gate.isCurrent(nextAccount), false);
  assert.equal(gate.begin(), null);
  gate.setOwner(owner);
  const remount = gate.begin();
  assert.ok(remount && gate.isCurrent(remount));
  assert.equal(gate.isCurrent(load), false);
  remount.abort();
  assert.equal(remount.signal.aborted, true);
  assert.equal(gate.isCurrent(remount), true, "A current timeout must be able to show its retryable error.");
});

test("branding previews accept bounded PNG data only, never remote or executable URLs", () => {
  const { parseReportBrandingPreview } = loadUi();
  assert.equal(parseReportBrandingPreview({ logoDataUrl: null }), null);
  assert.equal(parseReportBrandingPreview({ logoDataUrl: "data:image/png;base64,AAAA" }), "data:image/png;base64,AAAA");
  for (const payload of [null, {}, { logoDataUrl: undefined }, { logoDataUrl: "https://example.com/logo.png" },
    { logoDataUrl: "data:image/svg+xml;base64,AAAA" }, { logoDataUrl: "javascript:alert(1)" },
    { logoDataUrl: `data:image/png;base64,${"A".repeat(800000)}` }, { logoDataUrl: "data:image/png;base64,<svg>" }]) {
    assert.throws(() => parseReportBrandingPreview(payload));
  }
});

test("compact branding card renders localized loading/empty/error/upload/remove states in every locale", () => {
  for (const { code } of supportedLocales) {
    for (const phase of ["loading", "ready", "error", "uploading", "removing"] as const) {
      const component = loadUi(code, { phase });
      const html = renderToStaticMarkup(React.createElement(component.ReportBrandingCard));
      assert.ok(html.includes(serviceReportT(code, "brandingTitle")));
      assert.ok(html.includes(serviceReportT(code, "brandingDescription")));
      assert.match(html, /accept="image\/png,image\/jpeg"/);
      assert.match(html, /type="button"/);
      assert.doesNotMatch(html, /<form\b|type="submit"|<h1\b/);
      if (phase !== "ready") assert.match(html, /disabled=""/);
      if (phase === "error") assert.ok(html.includes(serviceReportT(code, "brandingRetry")));
      if (phase === "uploading") assert.ok(html.includes(serviceReportT(code, "brandingUploading")));
      if (phase === "removing") assert.ok(html.includes(serviceReportT(code, "brandingRemoving")));
      if (code !== "en") assert.ok(!html.includes(serviceReportT("en", "brandingTitle")));
    }
  }
});

test("saved preview uses an accessible local data image; success/error feedback and signed-out hiding are preserved", () => {
  for (const { code } of supportedLocales) {
    const loaded = loadUi(code, { image: "data:image/png;base64,AAAA", feedback: { key: "brandingSaved", error: false } });
    const html = renderToStaticMarkup(React.createElement(loaded.ReportBrandingCard));
    assert.ok(html.includes(serviceReportT(code, "brandingImageAlt")));
    assert.ok(html.includes(serviceReportT(code, "brandingReplace")));
    assert.ok(html.includes(serviceReportT(code, "brandingRemove")));
    assert.match(html, /role="status"/);
    const failed = loadUi(code, { feedback: { key: "brandingInvalidImage", error: true } });
    assert.match(renderToStaticMarkup(React.createElement(failed.ReportBrandingCard)), /role="alert"/);
  }
  const signedOut = loadUi("en", { signedOut: true });
  assert.equal(renderToStaticMarkup(React.createElement(signedOut.ReportBrandingCard)), "");
});

test("branding UI binds requests to exact account, invalidates on auth change, and has no browser storage URL writes", () => {
  assert.match(source, /authenticatedFetchForUser\(ticket\.ownerId/);
  assert.match(source, /"X-MG-Expected-User-Id": ticket\.ownerId/);
  assert.match(source, /gate\.isCurrent\(ticket\)/);
  assert.match(source, /subscription\.unsubscribe\(\); gate\.dispose\(\)/);
  assert.match(source, /onAuthStateChange/);
  assert.match(source, /getStableSession\(\)/);
  assert.match(source, /file\.size > inputMaxBytes/);
  assert.doesNotMatch(source, /\.storage\.|localStorage|sessionStorage|fetch\(|createObjectURL|dangerouslySetInnerHTML/);
  const settings = readFileSync("src/app/dashboard/settings/page.tsx", "utf8");
  assert.match(settings, /<ReportBrandingCard\s*\/>/);
  assert.match(settings, /<TrustedDevicesCard\s*\/>/);
});

test("resolved session errors remain retryable instead of hiding the branding card as signed out", async () => {
  for (const error of [new Error("synthetic auth timeout"), null]) {
    const harness: EffectHarness = { writes: [], result: { session: null, error } };
    const component = loadUi("en", {}, harness);
    renderToStaticMarkup(React.createElement(component.ReportBrandingCard));
    assert.ok(harness.effect);
    const cleanup = harness.effect();
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (error) {
      assert.deepEqual(structuredClone(harness.writes), [
        { index: 4, value: "error" },
        { index: 5, value: { key: "brandingLoadError", error: true } },
      ]);
    } else {
      assert.ok(harness.writes.some(({ index, value }) => index === 2 && value === true));
      assert.ok(harness.writes.some(({ index, value }) => index === 1 && value === null));
    }
    cleanup();
  }
});
