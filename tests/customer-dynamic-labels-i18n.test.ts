import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatCustomerMessageCount,
  formatCustomerNewMessageCount,
  formatFileExpertJobCount,
  localizeCreditTransactionType,
  localizeCustomerOrderStatus,
  localizeFileExpertDetection,
  localizeFileExpertReadiness,
  localizeFileExpertReview,
  localizeFileExpertStatus,
} from "../src/lib/i18n/customer-runtime-translations";
import { supportedLocales } from "../src/lib/i18nConfig";

test("customer workflow enums use typed localized labels and fail closed", () => {
  for (const { code } of supportedLocales) {
    assert.doesNotMatch(localizeCustomerOrderStatus(code, "customer_info_needed"), /_/u);
    assert.doesNotMatch(localizeCreditTransactionType(code, "admin_adjustment"), /_/u);
    assert.doesNotMatch(localizeFileExpertStatus(code, "processing"), /_/u);
    assert.doesNotMatch(localizeFileExpertDetection(code, "not_detected"), /_/u);
    assert.doesNotMatch(localizeFileExpertReadiness(code, "mature"), /_/u);
    assert.doesNotMatch(localizeFileExpertReview(code, "high"), /_/u);

    assert.doesNotMatch(localizeCustomerOrderStatus(code, "future_internal_state"), /future|internal|state/iu);
    assert.doesNotMatch(localizeCreditTransactionType(code, "future_ledger_type"), /future|ledger|type/iu);
    assert.doesNotMatch(localizeFileExpertStatus(code, "future_analyzer_state"), /future|analyzer|state/iu);
    assert.equal(localizeFileExpertStatus(code, "__proto__"), localizeCustomerOrderStatus(code, "future_internal_state"));
  }

  assert.equal(localizeCustomerOrderStatus("tr", "new_request"), "Yeni talep");
  assert.equal(localizeCustomerOrderStatus("de", "canceled"), "Storniert");
  assert.equal(localizeCreditTransactionType("zh", "refund"), "退款");
  assert.equal(localizeCreditTransactionType("tr", "order_usage"), "Kredi kullanımı");
  assert.equal(localizeFileExpertStatus("fr", "processing"), "En cours");
  assert.equal(localizeFileExpertDetection("de", "probable"), "Wahrscheinlich");
  assert.equal(localizeFileExpertReadiness("sq", "none"), "Pa prova");
});

test("message and analysis counts follow locale plural rules and word order", () => {
  assert.equal(formatCustomerMessageCount("en", 1), "1 message");
  assert.equal(formatCustomerMessageCount("en", 2), "2 messages");
  assert.equal(formatCustomerMessageCount("tr", 2), "2 mesaj");
  assert.equal(formatCustomerNewMessageCount("ru", 1), "1 новое сообщение");
  assert.equal(formatCustomerNewMessageCount("ru", 2), "2 новых сообщения");
  assert.equal(formatCustomerNewMessageCount("ru", 5), "5 новых сообщений");
  assert.equal(formatFileExpertJobCount("pl", 1), "1 analiza");
  assert.equal(formatFileExpertJobCount("pl", 2), "2 analizy");
  assert.equal(formatFileExpertJobCount("pl", 5), "5 analiz");
  assert.equal(formatCustomerNewMessageCount("zh", 2), "2 条新消息");
});

test("customer screens consume typed labels instead of formatting raw enums", () => {
  const orders = readFileSync("src/app/dashboard/orders/page.tsx", "utf8");
  const dashboard = readFileSync("src/components/dashboard/DashboardClient.tsx", "utf8");
  const orderDetail = readFileSync("src/app/dashboard/orders/[id]/page.tsx", "utf8");
  const creditHistory = readFileSync("src/app/dashboard/credits/history/page.tsx", "utf8");
  const fileExpert = readFileSync("src/app/dashboard/file-expert/page.tsx", "utf8");
  const fileExpertDetail = readFileSync("src/app/dashboard/file-expert/[id]/page.tsx", "utf8");
  const requestChat = readFileSync("src/components/RequestChat.tsx", "utf8");

  assert.match(orders, /localizeCustomerOrderStatus\(locale, order\.status\)/u);
  assert.match(dashboard, /localizeCustomerOrderStatus\(locale, order\.status\)/u);
  assert.match(dashboard, /localizeCreditTransactionType\(locale, item\.type\)/u);
  assert.match(orderDetail, /localizeCustomerOrderStatus\(locale, order\.status\)/u);
  assert.match(creditHistory, /localizeCreditTransactionType\(locale, item\.type\)/u);
  assert.match(fileExpert, /localizeFileExpertStatus\(locale, job\.status\)/u);
  assert.match(fileExpert, /formatFileExpertJobCount\(locale, jobs\.length\)/u);
  assert.match(fileExpertDetail, /localizeFileExpertReview\(locale, job\.risk_level\)/u);
  assert.match(fileExpertDetail, /localizeFileExpertDetection\(locale, identity\.status\)/u);
  assert.match(fileExpertDetail, /localizeFileExpertReadiness\(locale, clusterEvidence\.bestStatus\)/u);
  assert.match(requestChat, /formatCustomerMessageCount\(locale, messages\.length\)/u);
  assert.match(requestChat, /formatCustomerNewMessageCount\(locale, newMessageCount\)/u);

  for (const source of [orders, dashboard, orderDetail, creditHistory, fileExpert]) {
    assert.doesNotMatch(source, /replaceAll\("_", " "\)/u);
  }
  assert.doesNotMatch(fileExpert, /job\{jobs\.length === 1 \? "" : "s"\}/u);
  assert.doesNotMatch(requestChat, /newMessageCount\} new/u);
});
