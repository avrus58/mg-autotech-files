# Homepage hero polish — local acceptance, 5 October 2026

Status: **locally validated, not pushed or published**.

Owner request: `hadi basla`, following first-screen design advice. One bounded
homepage task, not a panel/auth overhaul or commercial outcome guarantee.

- Branch: `codex/homepage-polish-20261005`.
- Baseline: `5e6213b3fa9e4f6fcd0f800dc0a185089894190a`.
- Immutable UI candidate: `6263cf1341eeb194a9936c052fa9a64cfb687be6`.
- Follow-up receipt changes are documentation only. Dirty primary checkout is
  preserved; no unrelated changes are mixed into the candidate.

## Changes

The black/red identity stays. Hero title maximum decreases from6.5rem to4.4rem,
with tighter gaps and two44px primary actions. At1366×768, title, both actions,
full preview and proof strip fit; hero ends at690px.

The generic four-cell workflow and static `Portal online` badge are replaced by
a clearly labelled illustrative request: Stage1, completion status, upload/review/
delivery progression, status message, completed-file and PDF-report context.
No customer data, fabricated measured result, fake download button, availability
promise, network call or live request is introduced. Its only interactive link
opens the existing localized workflow page.

All12 locales are complete in the scoped catalog, including the Stage1 heading.
Obsolete hero-only catalog rows and the exact online-badge exception are removed.
Both existing hero CTAs, all lower sections, vehicle/datalog tools, SEO, services
and session behavior remain. No new dependency, schema or commercial rule.

## Validation

All final gates apply to the frozen corrected candidate:

| Gate | Result |
|---|---|
| Focused hero / localized parity / first-paint / runtime tests |27/27 PASS|
| Full `npm test` |1870/1870 PASS, exit0|
| `npm run check:i18n` |37/37 PASS, all12;2474 rows/non-English locale; zero clean English fallback|
| Lint and web+desktop types |PASS|
| `npm run build -- --webpack` |PASS,282/282 pages; strict postbuild unchanged|
| Artifact verification |43 assets;5 report fonts;30 PDFKit;8 sharp; compiled anonymous401; valid PNG/PDF; external fetch0 in checker|
| `npm run check:performance` |PASS; checked3 initial chunks15.7KB gzip/80KB budget; bounded locale bundles;139 prerendered routes/languages|
| Local raw initial HTTP HTML |12/12 PASS;17 preview-copy checks each; correct lang, canonical/alternates and preserved anchors|
| Browser EN/DE/TR/ZH |1366×768 laptop +390×844 mobile; zero document/preview-child horizontal overflow|
| Boundary wrapping |DE1024×720; DE/RU/SQ320px; zero horizontal overflow|
| Language selector |ZH→EN→DE→TR→ZH: correct route, language and preview|
| Navigation/accessibility |TR workflow link and Back; vehicle anchor; visible preview-link keyboard focus;44px actions|
| Captured browser warn/error log |Empty|
| Immutable independent review |GO; no P0/P1/P2 blocker; source,13 screenshots, rawHTML and final test/i18n logs inspected|

Ignored evidence folder:
`.autopilot/runtime/homepage-hero-qa-20261005/`.
`first-html.json` and `browser-qa.json` record the checks. Selected screenshots:
`tr-laptop.png`, `de-mobile.png`, `zh-mobile-product-card.png`.
Final logs: `.autopilot/runtime/homepage-full-final-20261005.log` and
`.autopilot/runtime/homepage-i18n-final-20261005.log`.

## Boundaries and remaining observations

- Validation uses an OS-only child environment, no dotenv contents or inherited
  secrets, and a synthetic invalid backend. Existing dependencies are reused.
  No real customer/auth persistence, registration/email delivery, payment,
  conversion, firmware or database operation is tested or claimed.
- The synthetic environment intentionally cannot retrieve live credit quotes;
  the existing unavailable/retry state remains visible. No old price is faked.
- German1024×720 hero ends750px, so some normal vertical scroll is needed.
  At320px RU/SQ long heading words wrap midword but remain legible/unclipped.
- Existing shared floating availability/language controls can cover some proof
  text at320px. Unchanged and outside this hero-only package, not claimed fixed.
- Local Next server emits the known `output: standalone` start advisory;
  successful local QA is not a deployed standalone-runtime verification.
- No push, Preview, Production, service/account/Ads configuration or payment
  change. Local review URL: http://127.0.0.1:3190/tr . Browser viewport restored.

Release requires a separate explicit owner instruction and the normal scoped
release checks. Code-only rollback would restore the preceding application;
there is no database/environment migration to reverse.
