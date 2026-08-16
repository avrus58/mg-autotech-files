# MG AutoTech Files

Private codebase for the MG AutoTech file platform at `file.mgautotech.de`.
The repository contains the public site, customer file workflows, internal
operations surfaces, desktop uploader support, and an optional File Expert
analysis service.

## Repository Layout

- `src/app`: Next.js App Router pages, layouts, API routes, widget routes, and
  embed routes.
- `src/components`: Shared React UI components for public, customer, admin, and
  analysis screens.
- `src/lib`: Domain logic for auth, Supabase clients, payments, credits, email,
  File Expert, ECU intelligence, vehicles, widgets, i18n, and SEO.
- `data`: Vehicle catalogue fallback data and performance override data used by
  the application.
- `tests`: Node `node:test` coverage run through `tsx`.
- `apps/customer-uploader`: Separate Electron/Vite/React desktop uploader app
  with its own `package-lock.json`.
- `file-expert-analyzer`: Isolated FastAPI binary analyzer used by production
  File Expert jobs; the in-process TypeScript implementation is local/test only.
- `scripts`: Local checks, fixtures, smoke scripts, scraper utilities, and SQL
  files. Some scripts touch sensitive boundaries; see the safety notes below.

## Stack

- Root app: Next.js App Router, React, TypeScript strict mode, Tailwind CSS,
  ESLint, Supabase, Stripe, Resend, and zod.
- Desktop app: Electron, Vite, React, TypeScript, and electron-builder.
- Analyzer: FastAPI with Python dependencies listed in
  `file-expert-analyzer/requirements.txt`.
- Package manager: npm. The root app and `apps/customer-uploader` are separate
  npm projects and each has its own lockfile.

## Local Setup

Install dependencies from the existing lockfiles when setting up a development
machine:

```bash
npm install
cd apps/customer-uploader
npm install
```

Do not add new production dependencies unless there is an approved task for
that change.

Environment files are intentionally not documented with real values here. Do
not commit, print, copy into logs, or inspect secrets from `.env`, `.env.local`,
or related files. Production credentials and live third-party services require
explicit human approval.

## Root App Commands

Run these from the repository root:

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:ecu-intelligence
```

- `npm run dev`: Starts the local Next.js development server.
- `npm run lint`: Runs ESLint.
- `npm run typecheck`: Runs `tsc --noEmit`.
- `npm test`: Runs the full `tests/*.test.ts` suite through `tsx`.
- `npm run test:ecu-intelligence`: Runs the focused ECU intelligence test.

`npm run build` runs `next build`. In restricted or offline automation it may
fail while `next/font/google` tries to fetch Google Fonts. Do not change the
font strategy as part of unrelated work; moving to local fonts should be a
separate approved task.

## Commands With Sensitive Boundaries

These commands are not safe for autonomous or unreviewed runs because they may
read env files, use network access, target production URLs, package release
artifacts, or depend on live services:

- `npm run check:payments`
- `apps/customer-uploader` `npm run check-env`
- `apps/customer-uploader` `npm run dev`
- `apps/customer-uploader` `npm run build`
- `apps/customer-uploader` `npm run package:win`
- `scripts/*.sql`
- `scripts/carecufile-scraper.mjs`
- `scripts/scrape-all-brands.mjs`
- Smoke scripts when pointed at anything other than localhost

SQL files are for Supabase migration or verification workflows, but migrations
must not be run from this repository without explicit human control. Deployment,
Vercel project state, production smoke checks, payment operations, email sends,
and database mutations are also human-controlled operations.

## Desktop Uploader

The desktop uploader under `apps/customer-uploader` supports customer-side file
upload assistance. It is maintained as a separate npm project. Treat desktop
environment checks, packaging, signing, and release outputs as sensitive
operations unless a task explicitly asks for them.

## File Expert Analyzer

`file-expert-analyzer` is independently deployable as a FastAPI Vercel project.
It is optional for local development, but production File Expert analysis fails
closed unless this service and the distributed admission lease are configured.
The lease uses Redis server time and treats a timed-out, stalled, malformed, or
oversized provider response as an unknown acquire that remains fail-closed to
its TTL.
Do not test it with real customer files, signed production URLs, or production
storage paths outside the reviewed release procedure.

## Development Rules

- Keep changes small, reviewable, and aligned with the existing architecture.
- Do not invent prices, legal claims, warranty terms, service scope, catalogue
  facts, or product promises.
- Do not connect to production Supabase, Stripe, Resend, PayPal, Vercel, or any
  other live third-party service from autonomous local work.
- Do not run deploys, Git pushes, branch changes, production migrations, or
  production smoke tests from autonomous local work.
- Do not edit vehicle catalogue data or scraper outputs without evidence and a
  task that explicitly covers that data change.
- Prefer the existing npm scripts and tests over ad hoc commands.
