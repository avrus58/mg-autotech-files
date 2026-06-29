import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const script = String.raw`(function () {
  "use strict";
  var current = document.currentScript;
  if (!current) return;
  var key = current.getAttribute("data-client-key") || "";
  var selector = current.getAttribute("data-target") || "#mga-vehicle-lookup";
  var lang = current.getAttribute("data-lang") || "";
  var base = new URL(current.src).origin;
  var host = document.querySelector(selector);
  if (!host) {
    host = document.createElement("div");
    host.id = selector.charAt(0) === "#" ? selector.slice(1) : "mga-vehicle-lookup";
    current.parentNode.insertBefore(host, current.nextSibling);
  }
  host.setAttribute("data-mga-widget", "vehicle-selector");
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  var state = { make: "", model: "", year: "", engine: "", session: "", config: null };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>\"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[c];
    });
  }
  function unavailable(message) {
    root.innerHTML = '<div style="font:600 14px Arial,sans-serif;padding:28px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#333;text-align:center">' + esc(message || "Vehicle selector temporarily unavailable.") + '</div>';
  }
  function options(items, placeholder) {
    return '<option value="">' + esc(placeholder) + '</option>' + (items || []).map(function (item) {
      return '<option value="' + esc(item.value) + '">' + esc(item.label + (item.fuelType ? " · " + item.fuelType : "")) + '</option>';
    }).join("");
  }
  function endpoint(path, extra) {
    var url = new URL(base + path);
    url.searchParams.set("key", key);
    url.searchParams.set("session", state.session);
    url.searchParams.set("lang", state.config.language);
    Object.keys(extra || {}).forEach(function (name) { url.searchParams.set(name, extra[name]); });
    return url.toString();
  }
  function load(path, extra) {
    return fetch(endpoint(path, extra), { credentials: "omit" }).then(function (response) {
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    });
  }
  function setBusy(value) {
    var shell = root.querySelector(".mga-shell");
    if (shell) shell.setAttribute("data-loading", value ? "true" : "false");
  }
  function render(config) {
    state.config = config;
    state.session = config.sessionToken;
    var l = config.labels || {};
    var dark = config.theme_mode === "dark" || config.theme_mode === "auto";
    var bg = dark ? "#111317" : "#ffffff";
    var fg = dark ? "#ffffff" : "#15171b";
    var field = dark ? "#08090b" : "#f5f6f8";
    var border = dark ? "rgba(255,255,255,.12)" : "#dfe2e7";
    root.innerHTML = '<style>' +
      ':host{display:block;width:100%;contain:content}.mga-shell{box-sizing:border-box;width:100%;overflow:hidden;border:1px solid ' + border + ';border-radius:12px;background:' + bg + ';color:' + fg + ';font-family:Arial,Helvetica,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.16)}' +
      '.mga-top{height:6px;background:' + esc(config.main_color) + '}.mga-body{padding:24px}.mga-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}.mga-brand{color:' + esc(config.difference_color) + ';font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:7px}.mga-title{font-size:24px;line-height:1.15;font-weight:900}.mga-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mga-field{display:block}.mga-field-wide{grid-column:1/-1}.mga-label{display:block;margin-bottom:6px;font-size:11px;font-weight:800;opacity:.62}.mga-select{box-sizing:border-box;width:100%;height:48px;border:1px solid ' + border + ';border-radius:8px;background:' + field + ';color:' + fg + ';padding:0 12px;font-size:14px;font-weight:700;outline:none}.mga-select:focus{border-color:' + esc(config.main_color) + '}.mga-select:disabled{opacity:.45}.mga-button{box-sizing:border-box;width:100%;height:54px;margin-top:14px;border:0;border-radius:8px;background:' + esc(config.main_color) + ';color:' + esc(config.button_text_color) + ';font-size:14px;font-weight:900;cursor:pointer}.mga-button:disabled{cursor:not-allowed;opacity:.45}.mga-result{display:none;margin-top:14px;padding:14px;border:1px solid ' + esc(config.difference_color) + ';border-radius:8px;background:' + esc(config.difference_color) + '16;font-size:13px;font-weight:800}.mga-powered{text-align:center;margin-top:18px;font-size:11px;font-weight:700;opacity:.5}.mga-loader{display:none;width:18px;height:18px;border:2px solid ' + border + ';border-top-color:' + esc(config.main_color) + ';border-radius:50%;animation:mga-spin .8s linear infinite}.mga-shell[data-loading=true] .mga-loader{display:block}@keyframes mga-spin{to{transform:rotate(360deg)}}' +
      '@media(max-width:560px){.mga-body{padding:18px}.mga-grid{grid-template-columns:1fr}.mga-field-wide{grid-column:auto}.mga-title{font-size:21px}}' +
      '</style><div class="mga-shell" dir="' + (config.direction === "rtl" ? "rtl" : "ltr") + '"><div class="mga-top"></div><div class="mga-body"><div class="mga-head"><div><div class="mga-brand">MG AutoTech</div><div class="mga-title">' + esc(config.widget_title || l.selectVehicle) + '</div></div><div class="mga-loader"></div></div><div class="mga-grid">' +
      '<label class="mga-field"><span class="mga-label">' + esc(l.selectVehicleType) + '</span><select class="mga-select" disabled><option>' + esc(config.vehicleTypeLabel || "Car / Light commercial") + '</option></select></label>' +
      '<label class="mga-field"><span class="mga-label">' + esc(l.selectMake) + '</span><select class="mga-select" data-name="make"><option>' + esc(l.loading) + '</option></select></label>' +
      '<label class="mga-field"><span class="mga-label">' + esc(l.selectModel) + '</span><select class="mga-select" data-name="model" disabled>' + options([], l.selectModel) + '</select></label>' +
      '<label class="mga-field"><span class="mga-label">' + esc(l.selectYear) + '</span><select class="mga-select" data-name="year" disabled>' + options([], l.selectYear) + '</select></label>' +
      '<label class="mga-field mga-field-wide"><span class="mga-label">' + esc(l.selectEngine) + '</span><select class="mga-select" data-name="engine" disabled>' + options([], l.selectEngine) + '</select></label></div>' +
      '<button class="mga-button" disabled>' + esc(config.button_text || l.showTuningOptions) + '</button><div class="mga-result"></div>' +
      (config.show_branding ? '<div class="mga-powered">' + esc(l.poweredBy) + '</div>' : '') + '</div></div>';

    var make = root.querySelector('[data-name="make"]');
    var model = root.querySelector('[data-name="model"]');
    var year = root.querySelector('[data-name="year"]');
    var engine = root.querySelector('[data-name="engine"]');
    var button = root.querySelector('.mga-button');
    var result = root.querySelector('.mga-result');
    setBusy(true);
    load("/api/widget/makes").then(function (data) { make.innerHTML = options(data.items, l.selectMake); }).catch(function () { unavailable(l.unavailable); }).finally(function () { setBusy(false); });
    make.addEventListener("change", function () {
      state.make = make.value; state.model = state.year = state.engine = ""; button.disabled = true;
      model.disabled = true; year.disabled = true; engine.disabled = true; model.innerHTML = options([], l.loading);
      if (!state.make) { model.innerHTML = options([], l.selectModel); return; }
      setBusy(true); load("/api/widget/models", { make: state.make }).then(function (data) { model.innerHTML = options(data.items, l.selectModel); model.disabled = false; }).catch(function () { unavailable(l.unavailable); }).finally(function () { setBusy(false); });
    });
    model.addEventListener("change", function () {
      state.model = model.value; state.year = state.engine = ""; button.disabled = true; year.disabled = true; engine.disabled = true; year.innerHTML = options([], l.loading);
      if (!state.model) { year.innerHTML = options([], l.selectYear); return; }
      setBusy(true); load("/api/widget/years", { make: state.make, model: state.model }).then(function (data) { year.innerHTML = options(data.items, l.selectYear); year.disabled = false; }).catch(function () { unavailable(l.unavailable); }).finally(function () { setBusy(false); });
    });
    year.addEventListener("change", function () {
      state.year = year.value; state.engine = ""; button.disabled = true; engine.disabled = true; engine.innerHTML = options([], l.loading);
      if (!state.year) { engine.innerHTML = options([], l.selectEngine); return; }
      setBusy(true); load("/api/widget/engines", { make: state.make, model: state.model, year: state.year }).then(function (data) { engine.innerHTML = options(data.items, l.selectEngine); engine.disabled = false; }).catch(function () { unavailable(l.unavailable); }).finally(function () { setBusy(false); });
    });
    engine.addEventListener("change", function () { state.engine = engine.value; button.disabled = !state.engine; result.style.display = "none"; });
    button.addEventListener("click", function () {
      if (!state.engine) return; setBusy(true); button.disabled = true;
      fetch(base + "/api/widget/vehicle-selected", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", body: JSON.stringify({ key: key, session: state.session, lang: config.language, make: state.make, model: state.model, year: state.year, engine: state.engine }) })
        .then(function (response) { if (!response.ok) throw new Error("unavailable"); return response.json(); })
        .then(function (data) { if (!data.vehicle) throw new Error("unavailable"); result.textContent = data.vehicle.vehicleName; result.style.display = "block"; var payload = Object.assign({ dataType: "mga-vehicle-data" }, data.vehicle); window.postMessage(payload, window.location.origin); window.dispatchEvent(new CustomEvent("mga-vehicle-data", { detail: data.vehicle })); })
        .catch(function () { unavailable(l.unavailable); }).finally(function () { setBusy(false); button.disabled = false; });
    });
  }

  var configUrl = new URL(base + "/api/widget/config");
  configUrl.searchParams.set("key", key); configUrl.searchParams.set("mode", "script"); if (lang) configUrl.searchParams.set("lang", lang);
  fetch(configUrl.toString(), { credentials: "omit" }).then(function (response) { if (!response.ok) return response.json().then(function (data) { throw new Error(data.error); }); return response.json(); }).then(render).catch(function (error) { unavailable(error.message); });
})();`;

export async function GET() {
  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
