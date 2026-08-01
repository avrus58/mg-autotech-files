# MG AutoTech World-Class File Service Program

Status: active product program
Research snapshot: 2026-07-30
Scope: public discovery, workshop intake, customer workspace, admin operations, quality evidence, secure delivery and platform reliability

## Objective

The goal is not to accumulate more cards, pages or unverified automation claims. A world-class file service should let a workshop submit the right source file with the right context, understand what happens next, communicate without losing order context, receive clearly versioned delivery and repeat the workflow quickly. MG AutoTech must do this while preserving human review, private storage, tenant isolation and server-side commercial controls.

No single feature proves this standard. The product must perform as one continuous operating system from search intent to repeat business.

## Evidence used

This program combines repository evidence with current public product and engineering guidance:

- [Google Search Central: people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) prioritizes original, substantial and satisfying content with clear expertise and trust. It does not support mass-producing pages primarily for rankings.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) recommends authenticated upload, extension allowlists, independent validation, size limits, generated storage names and storage isolation.
- Current file-service product surfaces reviewed for workflow patterns: [Tuning ECU](https://www.tuningecu.net/), [Tuning File Service](https://www.tuning-fileservice.com/), [File Service](https://file-service.org/?locale=en), [ECU Tune](https://ecu-tune.com/), [ECU File Service UK](https://ecufileservice.co.uk/) and [Factory Solutions](https://factory-solutions.pl/?lang=en).

Competitor content is used only to identify common customer expectations. Text, catalog data, artwork and private product behavior must not be copied.

## What the market now treats as baseline

Common expectations across professional workshop-oriented services are:

1. Vehicle-first request intake rather than an unexplained file drop.
2. Secure original-file upload with clear supported-file rules.
3. Understandable service selection and current commercial validation.
4. Order status tracking and engineer/customer communication in one request.
5. Versioned file delivery and accessible request history.
6. Fast repeat workflow for recurring workshops.
7. Human support when identity, read method or requested work is uncertain.

MG AutoTech already has strong foundations in these areas: authenticated requests, vehicle context, credits, customer order workspaces, messaging, delivery versions, admin work orders, File Expert evidence, notifications and private metadata boundaries. The next gains come from making those capabilities feel like one coherent workflow.

## Product standard

Every customer-facing workflow should answer five questions without support intervention:

1. **Am I submitting the correct vehicle and controller context?**
2. **Is the original file acceptable for this request?**
3. **What exactly did I request and what will it cost now?**
4. **What is happening, and does MG AutoTech need anything from me?**
5. **Which delivered version is current, and how do I start the next job safely?**

Every admin workflow should answer five corresponding questions:

1. **What needs attention first?**
2. **Is the identity and source evidence sufficient?**
3. **What did the customer request versus what was actually performed?**
4. **What communication, payment and delivery state applies?**
5. **Can the decision be audited without exposing private data?**

## Delivery roadmap

### P0: Reliability and trust

- Preserve verified UI snapshots during silent refresh failures.
- Use authenticated server projections for protected workspaces.
- Add non-sensitive correlation IDs and operational failure categories.
- Define availability, upload success and order-sync service-level indicators.
- Keep public, customer and admin projections separately allowlisted.
- Maintain responsive QA at phone, tablet, short laptop and desktop sizes.

Success measures: protected-page false logout rate, order sync failure rate, upload completion rate, API p95 latency and critical error recovery time.

### P1: Workshop velocity

- **Safe repeat request:** prepare a new request from an owned previous order without copying files, notes, plates, payment state or approvals. Implemented in this phase.
- Saved workshop vehicle profiles with explicit customer ownership and editable controller context.
- Reusable request templates for common service combinations, with current prices recalculated on use.
- Batch intake preparation for workshops, without bypassing per-file validation.
- Clear recent vehicles, recent requests and action-needed work on the customer dashboard.

Success measures: median repeat-request completion time, abandoned intake rate, clarification-message rate and requests completed per active workshop.

### P1: File readiness and exact identity

- Show a customer-safe preflight result before submission.
- Separate customer-entered identity, Vehicle DB match and File Expert evidence.
- Surface conflicts rather than silently choosing one identity.
- Require human review for uncertain read method, already-modified sources and mismatched vehicle/controller context.
- Never imply that advisory evidence generated or modified a file.

Success measures: first-pass accepted-file rate, identity conflict rate, re-upload rate and manual clarification time.

### P1: Transparent work order and delivery

- Use a compact, consistent status language across portal and email.
- Show customer action needed separately from internal queue state.
- Keep customer-visible conversation attached to the request.
- Preserve delivery version, delivered time, download count and revision state.
- Add a concise completion summary based only on verified work-order data.

Success measures: status-related support contacts, time waiting for customer, delivery-to-download time and revision rate.

### P2: Workshop account operating layer

- Company profile, VAT/invoice context and explicit billing contact.
- Team seats with customer-side roles and request ownership.
- Customer ID and bank reference consistency.
- Credit ledger explanation without exposing payment provider internals.
- Account activity and security controls.

Success measures: multi-user workshop adoption, billing clarification rate, repeat purchase rate and account recovery completion.

### P2: Evidence-led expertise

- Publish fewer, stronger workshop guides with named review ownership and update dates.
- Add verified case studies only when customer consent and evidence exist.
- Connect service pages to preparation tools and exact workflow answers.
- Keep schema markup aligned with visible content.
- Consolidate or remove thin/duplicated homepage sections instead of expanding the homepage indefinitely.

Success measures: qualified organic sessions, guide-to-request conversion, branded search growth and indexed-page quality rather than raw page count.

### P2: Admin operational excellence

- Unified attention queue across new requests, file check, customer response, revision and delivery.
- Saved filters and handoff views for support, calibrator and owner roles.
- Non-sensitive audit timeline for every consequential mutation.
- Workload and turnaround reporting from verified order events.
- Alerting that is actionable, deduplicated and stable during session refresh.

Success measures: time to first review, queue age, handoff delay, duplicate action rate and missed-SLA count.

### P3: Controlled integrations

- Customer-scoped API or desktop workflows only after the browser flow remains the source of truth.
- Idempotent request creation and upload sessions.
- Private storage, server-generated paths and strict ownership checks.
- Signed and controlled desktop distribution before public installer access.
- No automated ECU output or customer delivery without separate technical and business approval gates.

## Phase 1: Safe Repeat Request

The first implementation reduces repetitive workshop effort while retaining every security and commercial gate.

### Copied as editable context

- Brand
- Model
- Generation
- Engine
- ECU / TCU text
- Gearbox
- Vehicle year
- Explicit read method
- HW / SW text
- Master/slave selection
- Only service names that still map exactly to the current service catalog

### Deliberately not copied

- Original, additional or delivered files
- File names and storage paths
- Customer/admin notes and messages
- Number plate
- Previous credit amount or payment state
- Previous acceptance checkboxes
- Delivery state, download history or revisions
- AI, File Expert, source-provider, audit or internal metadata

The new request always requires a new original file, current service confirmation, current credit validation and fresh customer approvals. Unknown legacy service text does not receive a guessed replacement.

## Engineering principles

- Prefer an allowlist projection over deleting forbidden fields after the fact.
- Reuse the existing ownership-bound customer order API rather than opening another data surface.
- Recalculate commercial values from the current catalog.
- Make uncertainty visible and recoverable.
- Preserve keyboard access, 44 px touch targets, visible labels and responsive layouts.
- Do not hide failures behind a fake success state.
- Do not claim automation, quality or turnaround that the system cannot prove.

## Next recommended implementation

After production validation of repeat requests, the next coherent package should be **Workshop Garage and Request Templates**:

1. Customer-owned saved vehicle profiles.
2. Explicit distinction between catalog-matched and manual vehicle data.
3. Named service templates that reference current catalog IDs, never copied prices.
4. A one-screen recent vehicle/template launcher.
5. Tenant-isolation, stale-template and current-credit tests.

This provides a larger speed gain than adding another standalone marketing page and creates the foundation for carefully designed batch intake later.
