# Mobile admin usability update

Scope: owner-requested mobile admin update, plus the homepage mobile account
entry. Baseline `500bdde`; application candidate
`5dea0bcb549600783bbd72baac6f1b4308c9a6ff`, final validation candidate
`def5538ff58c83d84d28d5d98f3713866fd86c06` (test-only follow-up).
Worktree `mg-autotech-files-admin-mobile`, branch
`codex/admin-mobile-navigation-20260906`. Implementation only; not published.

## Changes

- Below 1024px, persistent top Menu opens a native modal drawer containing the
  existing 14 destinations, filtered to the signed-in staff member's permissions.
  Escape, backdrop, close, selection and desktop resize release the scroll lock.
  Keyboard focus wraps inside the menu and returns appropriately.
- Orders/Customers selection, browser history, desktop tab actions and queue
  shortcuts keep the hash, active section and displayed panel synchronized.
  The mobile bottom sidebar is replaced, not duplicated; desktop remains intact.
- Mobile activity overview is expandable; compact order groups and the native
  status selector keep all filters. Current loading/error/stale-data recovery,
  order/customer actions, file operations and permissions remain in place.
- Vehicle catalog statistics are expandable on mobile. The vehicle editor has
  a sticky section selector including Stage 1-2-3, ECU, notes and publishing.
- Mobile commercial settings have a persistent save action using the exact
  existing save function and disable/validation guards. Prices, payment policy
  and business rules are unchanged.
- Mobile headings/inputs/sticky offsets and notification scrolling are scoped
  to the admin layout. Menu/dock remain below existing confirmation backdrops.
- The homepage mobile header exposes Login or My Account directly, using the
  existing session bridge and existing translations. Customer dashboard code
  and all desktop layout rules are unchanged.

## Security and release impact

One new read-only endpoint, `/api/admin/navigation`, returns only the caller's
allowlisted destination hrefs. It uses existing `requireApiUser` and
`isStaffMember`; no identities, permission objects or operational data are
returned. Finance-only/vehicle-only staff work without `orders.view`; the
Customers destination requires both `orders.view` and `customers.view`, matching
the root dashboard's existing gate. The client rejects malformed, duplicated or
unknown destinations and does not prefetch admin routes.

No changes to existing authentication/authorization gates, migrations, RLS,
environment variables, dependencies, customer data, payment configuration or
firmware functionality. No Production/Preview deployment, push or live API test.

## Review and evidence

Independent immutable review closed all findings on `5dea0bc`: original loader
permission coupling, current-section/hash divergence, modal stacking and the
Customers implicit root permission. The exact-file security-contract test update
in `def5538` received a separate bounded GO; application source is unchanged.
The route/client integration tests use the
real modules with a synthetic authenticated-identity boundary, not a live DB.

Browser verification uses local synthetic React fixtures at 127.0.0.1:3199;
existing components are bundled with read-only fixture adapters. Auth, payments,
mail and real mutations are deliberately unavailable. This is NOT authenticated
Next.js E2E or an actual mobile-device test.

- 38 interaction/localization scenarios: menu/focus/Escape/backdrop/resize,
  scrolling, hashes/back, support permissions, access outage/retry/denial,
  overview/status filters, vehicle sections, save visibility and both account
  states at 320px in all 12 supported locales.
- 5 additional regressions: finance-only/vehicle-only menu access, real widget
  confirmation backdrop, root notification/queue switch after scrolling and
  short tablet notification viewport containment.
- Route-width matrix: 15 admin routes at 390x844, 768x844 and 1366x844. Loaded
  fixtures cover root Orders/Customers, vehicle catalog/editor, payments,
  commercial settings, operations and team; requests include an empty state.
  External report/tool data deliberately uses service-unavailable responses;
  these checks do not establish success for live reports or external providers.
- Desktop comparison: 8 views at 1024x768 and 1366x768 against the baseline,
  using identical synthetic fixtures and masking dynamic status text; all 16
  comparisons had zero changed pixels.
- Detailed receipts and screenshots: `.autopilot/runtime/mobile-*` (gitignored).

## Final validation

- `npm test`: 1517/1517 passed, zero failures/skips, on `def5538`.
- `npm run lint -- --ignore-pattern '.autopilot/runtime/**'`: passed; only the
  generated, gitignored synthetic-browser bundles are excluded.
- `npm run typecheck`: web and customer-uploader checks passed.
- `npm run build -- --webpack`: passed, 281/281 generated pages. Application
  source stayed frozen at `5dea0bc`; the later `def5538` commit is test-only.
- Build preflight `npm run check:i18n`: all 12 locales and 2448 sources, zero
  clean English fallback; 37/37 bundle tests passed.
- `npm run check:performance`: passed, including localization payload budgets
  and all 48 required public prerender routes.
- Browser receipts: all 38 + 5 scenarios and 45 route-width checks passed;
  all 16 desktop comparisons had zero changed pixels.

Final log names and remaining integration/device boundaries are recorded in
`.autopilot/STATUS.md`. Failed or interrupted intermediate runs are not accepted
receipts. This completes the local implementation, not a Production release.
