# MG AutoTech Platform Roadmap

## Current Level

The platform is commercially close: customer file requests, credits, Stripe/Card, Bank Transfer, admin work orders, vehicle database, File Expert, AI evidence, similarity and pattern clustering are in place.

The main rule remains: AI is evidence-only. It must not generate MOD files, edit bytes, auto-approve files or expose private customer/source data.

## Phase A - Must Keep Tight Before Public Scale

- Keep admin/customer API guards tested.
- Keep public vehicle selector projection customer-safe.
- Keep File Expert customer reports free of paths, hashes, raw binary, hex, private offsets and admin notes.
- Keep manual bank transfer crediting auditable and double-credit safe.
- Keep production smoke checks part of every deploy.

## Phase B - First 100 Customers

- Add safer large-file upload proxy or signed-upload abstraction that avoids exposing storage paths to the browser.
- Expand customer settings and invoice profile completeness if real invoices require more fields.
- Add admin saved filters for daily work order queues.
- Add request-level SLA/priority automation from customer commercial policy.
- Add operational email templates for customer-visible notes and delivery events.

## Phase C - 1,000 Customers

- Move heavy File Expert and AI analysis to background jobs with retry and queue visibility.
- Add centralized audit log search across requests, payments, vehicles and AI training.
- Add database performance dashboards for vehicle selector, request list and AI evidence.
- Add rate-limit observability for auth, uploads and email endpoints.

## Phase D - 10,000+ Customers

- Dedicated worker service for binary analysis.
- Object storage lifecycle policies and archival.
- Advanced RBAC roles for owner, manager, tuner, support and finance.
- Multi-region caching for public vehicle selector and service SEO pages.
- Formal data retention and customer export/delete workflows.

