# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY apps/customer-uploader/package.json ./apps/customer-uploader/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Only browser-public values are admitted at build time. Server credentials are
# deliberately absent from this list and therefore cannot enter image metadata.
ARG NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY=
ARG NEXT_PUBLIC_AUTH_CAPTCHA_MODE=
ARG NEXT_PUBLIC_BANK_ACCOUNT_NAME=
ARG NEXT_PUBLIC_BANK_BIC=
ARG NEXT_PUBLIC_BANK_IBAN=
ARG NEXT_PUBLIC_BANK_NAME=
ARG NEXT_PUBLIC_GOOGLE_ADS_ID=
ARG NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=
ARG NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL=
ARG NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL=
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_WHATSAPP_NUMBER=

ENV NODE_ENV=production \
    NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY=${NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY} \
    NEXT_PUBLIC_AUTH_CAPTCHA_MODE=${NEXT_PUBLIC_AUTH_CAPTCHA_MODE} \
    NEXT_PUBLIC_BANK_ACCOUNT_NAME=${NEXT_PUBLIC_BANK_ACCOUNT_NAME} \
    NEXT_PUBLIC_BANK_BIC=${NEXT_PUBLIC_BANK_BIC} \
    NEXT_PUBLIC_BANK_IBAN=${NEXT_PUBLIC_BANK_IBAN} \
    NEXT_PUBLIC_BANK_NAME=${NEXT_PUBLIC_BANK_NAME} \
    NEXT_PUBLIC_GOOGLE_ADS_ID=${NEXT_PUBLIC_GOOGLE_ADS_ID} \
    NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=${NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL} \
    NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL=${NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL} \
    NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL=${NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL} \
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NEXT_PUBLIC_WHATSAPP_NUMBER=${NEXT_PUBLIC_WHATSAPP_NUMBER}

RUN case "${NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY}" in \
      ""|0|false|FALSE|off|OFF|no|NO) ;; \
      *) echo "Production image build refuses the CAPTCHA test-key bypass." >&2; exit 1 ;; \
    esac \
    && npm run build \
    && node scripts/vps/create-static-manifest.mjs

FROM base AS runner
ARG BUILD_REVISION=unknown
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

LABEL org.opencontainers.image.title="MG AutoTech File Service" \
      org.opencontainers.image.revision="${BUILD_REVISION}"

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./static-release
COPY --from=builder --chown=nextjs:nodejs /app/.next/static-release-manifest.json ./static-release-manifest.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/BUILD_ID ./release-build-id
COPY --from=builder --chown=nextjs:nodejs /app/scripts/vps/prepare-static-assets.mjs ./prepare-static-assets.mjs

RUN mkdir -p /app/.next/static /app/.next/cache /app/static-state \
    && chown -R nextjs:nodejs /app/.next /app/static-state

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready',{cache:'no-store'}).then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node /app/prepare-static-assets.mjs && exec node /app/server.js"]
