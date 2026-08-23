# Trusted request network contract

Client IP and country are security/analytics hints, not authorization. The
application never trusts arbitrary `X-Forwarded-For`, `X-Real-IP`,
`CF-Connecting-IP` or `CF-IPCountry` request headers.

## Vercel

When `VERCEL=1` and `REQUEST_NETWORK_PROVIDER` is unset or `vercel`, the server
uses Vercel-owned `X-Vercel-Forwarded-For` and `X-Vercel-IP-Country` headers.
Explicit `vercel` mode outside Vercel fails closed.

## Cloudflare -> Caddy -> private Docker network

The File Service container uses:

```text
REQUEST_NETWORK_PROVIDER=cloudflare-caddy
REQUEST_NETWORK_PROXY_SECRET=<server-only random value, at least 32 characters>
```

Caddy and File Service receive the same server-only secret at runtime. It must
not be committed, logged or exposed through a public environment variable.
Caddy must overwrite, rather than append or pass through, these upstream
headers:

```text
X-MG-Proxy-Secret: <REQUEST_NETWORK_PROXY_SECRET>
X-MG-Client-IP: <validated Cloudflare client IP>
X-MG-Country: <validated Cloudflare two-letter country>
```

Before creating them, Caddy/firewall must verify that the immediate public peer
is an official Cloudflare address (or use an equivalently authenticated private
edge path). Requests must reach File Service only on the private Docker network;
port 3000 is not published publicly. Incoming client values for every `X-MG-*`
header are discarded and replaced.

If provider mode, proxy proof, IP or country validation fails, the application
returns `unknown` IP and no country. This safely coalesces local rate limiting
and leaves country selection manual instead of accepting spoofed metadata.

The shared resolver is used by rate-limit keys/fingerprints, widget IP hashing,
security signals, consented Growth attribution, client observability and the
public registration-country detector.
