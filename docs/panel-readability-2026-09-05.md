# Panel readability and containment audit

Owner-directed UI refinement; no Production deployment. The earlier localization
package at `1e35189` is preserved. Final code candidate: `a15e0e6` (test-only
follow-up to application build `5b0eda2`, including `2521ad4`, `82fd1d7`,
`580b362` and `e5b8235`). No auth behavior, API, price, payment, database,
dependency or service changes.

## Findings and corrections

| Area | Reproduced finding | Correction |
| --- | --- | --- |
| Customer dashboard | Long action banner truncated; missing profile fields repeated in welcome | Short keyboard-operable disclosure, complete guidance inside, persistent CTA; urgent response guidance starts expanded |
| Customer navigation / page headers | Datalog label and long headings cut off | Wrapping labels, protected icons and wrapping action groups; all destinations retained |
| Credit history preview | Description/type/date truncated beside amount | Full wrapping description with amount/balance on a separate compact line |
| Customer orders / notifications | German archive filter overflow at 1024px; mobile filters offscreen | Emergency word wrapping and visible wrapping filter rows |
| Admin navigation | Four links wider than the 194px inner navigation at laptop/desktop | Bounded label area, smaller gaps, non-shrinking icons/badges |
| Admin customers | Fixed 96px balance overflowed 106px padded cell; mobile modal fields offscreen | Fluid balance, two-column laptop cards, shared grid child containment and wrapping modal heading/actions |
| Laptop customer-card parity | Review identified missing table context in replacement cards | Preserve account type/status, negative-credit limit, internal note and direct ID copy next to quick-credit actions |
| Vehicle / widget admin headings | Long identifiers hidden behind ellipsis | Wrap titles/identifiers and keep vehicle Save/Reset controls reachable; compact vehicle editor |
| Shared panels | Auto minimum grid tracks can grow to long content width | Scoped `min-width: 0` for grid children, without clipping or CSS zoom |
| Localization release check | Fresh emitted builds triggered an invalid Unicode regexp; source-only checks had hidden actual compression overhead | Escape closing braces, test the parser, resolve named chunks by their real registration, and bundle paired auth/overview/credits catalogs together without raising budgets or dropping translations |

The final catalog optimization also uses the established compact column encoding
for overview/credits and shares the existing auth locale-order constant. This
changes storage/packaging only, not translated values or route-group boundaries.
Identical auth observer rows reuse primary translations, but retain every observer
key. Equality is checked across all locales before sharing; the existing observer
ceilings remain unchanged. The master-parity and shared-row identity tests pass.

## Coverage and boundaries

- Geometry/source scan: all 49 `page.tsx` routes under admin/dashboard, plus shared
  customer components and new-request grid patterns. This is not a claim that
  every backend operation or every populated state on those routes was tested.
- Real component rendering in headless Chrome, synthetic local-only fixtures,
  fresh Tailwind CSS and actual locale renderer. External browser requests denied;
  mutations in the fixture service adapters throw. No real accounts/files used.
- Responsive matrix: 390, 1024, 1366 and 1920px widths; customer EN/DE/TR/ZH.
  Main dashboard; customer settings, credits, ledger, orders and notifications;
  admin orders/customers/customer dialog, vehicles/list/editor, team and payments.
- Existing intentionally scrollable tables and mobile navigation retain scrolling.
  Native one-line editable inputs retain their native horizontal text scrolling.
- Widget-client title changes and the customer order-detail status header were
  source-reviewed; no real authenticated service workflow was executed for them.
- Locale inventory remains 12 languages. Retired `Next best action -` was added
  only to the permitted tombstone list and removed from the generated DOM catalog;
  no translation ceiling, fallback or exemption was broadened.

## Validation

Browser QA passed 124 responsive route/dialog cases and 18 interactions, with
zero measured unintended overflow or browser errors. Results and synthetic
screenshots are stored under ignored `.autopilot/runtime/panel-*`.

- `npm run lint`: passed, including the final test-only follow-up.
- `npm run typecheck`: passed (web and all customer-uploader TypeScript projects).
- `npm test`: final candidate1493/1493 passed, zero failures or skips, including
  the completed-build emitted-budget check (`panel-release-tests.log`).
- `npm run build -- --webpack`: passed, including `prebuild` / `check:i18n`,
  2447 reviewed strings in all11 non-English locales, zero clean English fallback,
  24 dynamic occurrences/21 signatures, and35 catalog tests.
- Fresh completed artifact:4 focused parser/filename/emitted-budget tests passed,
  with all10 route groups within their unchanged gzip caps. Unlike the prebuild
  source fallback, this receipt measures actual files selected by Webpack's chunk
  filename mapper, not duplicate registrations embedded in route entry chunks.
- `npm run check:performance`: passed after build. Homepage initial JS15.5KiB
  gzip against80KiB; public datalog worker6.5KiB against12KiB; locale Flight
  payloads within28KiB raw/12KiB gzip;139 prerendered routes,48 required routes
  covered, no missing public routes.
- `git diff --check`: passed.

The 124-case receipt uses `panel-final-results.json` (28),
`panel-extended-results.json` excluding credits/orders/notifications (48),
`panel-recheck-results.json` orders/notifications only (32), and
`panel-credits-results.json` (16). Intermediate fixture failures were corrected
and rerun; they are not counted as passing results. Interactions are recorded in
`panel-interactions-results.json` (18).
Independent immutable review identified and then accepted the card-parity fix:
`82fd1d74cf1e526414fc9f265d66d81ce81b2d30`, GO for the focused remediation.
Further focused reviews approved `580b362` and `e5b8235`. Independent comparison
confirmed unchanged overview 38 exact rows x11 locales/14 templates, credits
40 exact rows x11 locales/9 templates, and auth locale order.
Final focused review of `5b0eda2` also approved all 93 auth observer rows x11
locales: 89 stored rows plus4 equal primary-row references, no value differences.
Test-only exact runtime filename mapping in `a15e0e6` received a final GO; it
validates paths and registration IDs and rejects missing/ambiguous runtimes.

Future release checks must repeat the emitted-budget test after a completed
fresh build; prebuild can legitimately measure the source graph before build
artifacts exist. No raised cap or forced source fallback is an acceptable substitute.

This package is local only. Deployment needs a separate explicit owner request.
