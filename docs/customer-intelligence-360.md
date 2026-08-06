# Customer Intelligence 360

## Purpose

Customer Intelligence 360 is a private, read-only admin projection that joins the customer evidence already held by MG AutoTech into one operational view. It is designed to answer four practical questions:

1. Who is the customer and how complete is the service profile?
2. Which consented acquisition touch brought the customer, when that evidence exists?
3. What is the customer's verified request, service, vehicle, revenue and communication history?
4. Which transparent customer-success or data-quality action should an admin review next?

Admin route:

`/admin/growth/customers/[customer-user-id]`

Read-only API:

`GET /api/admin/growth/customers/[customer-user-id]`

The API requires `customers.view`. Customer classification changes remain a separate `customers.manage` action. The report itself performs no insert, update, delete, payment, email or request mutation.

## Existing system and new layer

The repository already had a strong Growth & Customer Success foundation:

- consented first-party acquisition;
- registration, request and payment funnel metrics;
- explicit real/internal/test account classification;
- request and service demand;
- email delivery reliability;
- repeat-customer and inactivity signals;
- aggregate Search Console and GA4 reporting.

The missing layer was a single-customer evidence view. Customer Intelligence 360 adds that projection without creating another CRM and without duplicating stored data.

## Data sources

The report reads the minimum fields needed from:

- `profiles`: customer reference, contact/service profile, account state and balance;
- Supabase Auth admin user lookup: provider names and account timestamps only;
- `growth_customer_classifications`: explicit admin-reviewed customer truth;
- `growth_attribution_sessions`: consented first/last touch and coarse locale/country;
- `orders`: vehicle/service/status/read context and whether a customer file exists;
- `credit_transactions`: verified purchase/refund ledger and credit movement;
- `payment_records`: operational payment state counts;
- `email_events`: event and delivery status timestamps;
- `request_messages`: role, visibility and timestamp only;
- `request_work_order_events`: event name, visibility and timestamp only;
- `growth_journey_events`: safe account/request milestones;
- `growth_customer_preferences`: optional reminder preference and consent state.

No new database table or migration is required. The page is a live read-only projection over existing private evidence.

## What the admin sees

- customer/account identity and profile completeness;
- explicit real/internal/test classification and analytics exclusion state;
- consented first and last acquisition touch;
- request total, completion, open work and repeat-customer state;
- service and vehicle-brand frequency;
- verified ledger revenue per currency, refunds and credits;
- first/last request and payment dates;
- registration-to-request and registration-to-payment duration;
- customer-visible message counts and median first response time;
- transactional email delivery health;
- chronological request, payment, email, message and workflow milestones;
- deterministic next actions with a visible reason;
- source availability and privacy exclusions.

The signals are descriptive. They are not an opaque customer score, automated sales decision, eligibility decision or prediction of a person's behaviour.

## Acquisition truth

Authentication provider is not acquisition source. A Google login proves that Google was used for authentication; it does not prove Google Search produced the customer.

The report has four explicit acquisition states:

- `captured`: consented first-party evidence exists;
- `not_captured`: tracking was available, but no consented touch was linked;
- `tracking_not_available_at_registration`: the account predates the recorded attribution system;
- `not_configured`: no trustworthy tracking baseline exists.

Missing historical source is never reconstructed from authentication provider, country, language, payment method, email domain or assumptions. For an account created before attribution started, the correct result is “historical source cannot be reconstructed safely.”

Search Console queries remain aggregate. They are never joined to this customer view.

## Privacy boundary

The customer intelligence response excludes:

- raw IP address, device fingerprint and visitor identifier/hash;
- full referrer URL and raw query string;
- payment provider IDs, bank/card details and provider payloads;
- email bodies, errors, recipient data and provider message IDs;
- message content, hidden messages and internal notes;
- filenames, storage paths, signed URLs and firmware bytes;
- AI samples, binary offsets, raw analysis and source metadata.

Message response timing uses only visible, non-internal message timestamps and sender roles. The content is not selected.

The design follows data minimisation, purpose limitation and privacy-by-design principles. Operational access remains limited by the existing staff permission system and private no-store API headers.

## Relationship states

Relationship state is deterministic and explainable:

- `registered`: no request yet;
- `active_work`: at least one open request;
- `first_time`: one recorded completed request;
- `recent_customer`: one recent request;
- `repeat_active`: two or more requests with recent activity;
- `dormant`: no recent request under the documented recency rule;
- `excluded`: explicitly excluded from growth analytics.

Dormancy is a recency indicator, not a churn prediction. Any outreach must respect communication preference and existing consent rules.

## Admin workflow

1. Open `/admin/growth`.
2. Find the customer in Customer truth review.
3. Select **View Customer 360**.
4. Review the source status before using a metric.
5. Resolve classification or profile evidence gaps using the linked admin actions.
6. Open individual work orders from Request portfolio when operational detail is required.
7. Never infer a missing source or overwrite an admin-reviewed classification from behavioural signals.

The same view is linked from the existing customer management modal in `/admin`.

## Future analysis enabled by this foundation

When enough verified-real customers and consented acquisition records exist, aggregate reports can safely compare:

- source/country/language to registration, request and paid conversion;
- service and vehicle-brand demand by cohort;
- time from registration to first request/payment;
- first-time to repeat-customer conversion;
- response time and completion outcomes;
- email delivery health and approved reminder follow-through;
- revenue per paying customer and repeat-order rate by currency.

Small cohorts must remain suppressed or presented carefully. Individual-level data must never be exported to public analytics tools merely to improve reporting.

## Verification checklist

1. Anonymous GET returns `401`.
2. A normal customer receives `403`.
3. Staff without `customers.view` receives `403`.
4. Staff with `customers.view` can open the report.
5. A consented test attribution shows exact first/last touch.
6. A pre-tracking synthetic account shows `tracking_not_available_at_registration`.
7. Google authentication is displayed separately and never becomes acquisition source.
8. Hidden/internal messages do not affect message counts or response time.
9. Request rows expose no filename or storage path.
10. Revenue reconciles with the credit ledger by currency and recorded refunds.
11. Missing source tables degrade to a warning without fabricating values.
12. Browser network responses contain none of the excluded private fields.
13. Check 390x844, 768x1024, 1366x768 and 1920x1080 layouts for overflow.

## Known limits

- Existing customers who predate consented attribution cannot receive a reliable historical source.
- Read-method, ECU and profile completeness depend on fields explicitly collected in the order/profile flow.
- Median response time is based on stored customer-visible message timestamps, not live-chat presence.
- This report does not send campaigns, change prices, mutate credits or automatically classify a customer.
