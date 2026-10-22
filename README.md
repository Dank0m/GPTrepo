# Scopebook

[Инструкция на русском](README.ru.md)

A private proposal workspace for independent designers and developers. Estimate a project, check whether its fee covers your time, define the scope, and export a client-ready proposal. Price extra requests with a separate change order.

The full interface, proposal templates, client exports, and sample downloads support English and Russian. Language follows the browser's first supported language; the RU/EN switch saves an explicit choice. Switching languages preserves existing proposals and unsaved client text. Numbers and dates follow the selected locale; currency codes and amounts are never converted automatically.

**Business model:** one saved proposal free; $29 once for Pro (up to 500 saved proposals, clean exports, and workspace backups). This is a prelaunch pricing experiment. No sales or customer demand have been demonstrated. The [research](docs/MARKET_RESEARCH.md) explains the decision and its limits; the [launch experiment](docs/LAUNCH.md) gives a concrete path to the first paying users.

## Run locally

Requires **Node 24** and npm. No API keys or external services are needed for the free product.

```sh
npm ci
npm run dev
```

Vite runs on port 5173 and proxies `/api` to the Express server on port 3001. Local development defaults to the `http://localhost:5173` origin. Use that host consistently for cookie and origin checks; if using a different origin, set `APP_URL` to match it. For the built application:

```sh
npm run build
APP_URL=http://localhost:3001 NODE_ENV=production npm start
```

The built server serves the landing page, workspace, assets, and API on port 3001. `PORT` changes the listening port. `APP_URL` must be the exact public HTTPS origin when deployed; local HTTP is supported for development. The server listens on `0.0.0.0`.

## What works

- Original responsive landing page, interactive pricing calculator, and example proposal.
- Line-item estimates in USD, EUR, or GBP, with deposits and sales tax.
- Internal hourly target, time contingency, effective rate, and projected margin. These internal numbers are omitted from client exports.
- Included deliverables, exclusions, revision rounds, validity, timeline, and studio defaults.
- Client preview, browser Print / Save as PDF, downloadable standalone HTML, and priced change orders. The sample download is illustrative, not a customer project.
- Browser storage with explicit saves, validated JSON import, Pro workspace backups, duplicate/delete/search, and storage-error handling.
- Optional Stripe checkout, verified paid entitlements, recovery keys, and refund/dispute revocation.

Project fees are estimates, not booked revenue. Margin compares the fee with your target hourly time budget and buffer; it excludes overhead, payment fees, and income tax. Sales tax is not treated as profit. Exported proposals are not signed contracts, invoices, or legal advice. Client e-signatures, invoice collection, cloud sync, and automated outreach are outside this version.

## Data and licenses

Proposal and studio data stay in browser local storage. No proposal content is sent to the API. Clearing browser site data deletes it. Print/export important proposals and keep private backups; Pro JSON backups include client information and should be stored securely. Imports validate the entire file before changing existing data. Matching proposal IDs are replaced only after confirmation; other saved proposals are retained. Backups are bounded to 500 proposals / 5 MB for browser storage reliability.

Pro uses a private recovery key in an HttpOnly, SameSite cookie; production HTTPS sets Secure. The server stores only the key hash in SQLite, with payment/session identifiers and webhook receipts. Save the recovery key in Settings before clearing cookies. It restores the license in another browser, but **does not restore proposal data**. Anyone with that key can use the license. Client-side feature gating is a pragmatic distribution choice, not tamper-proof DRM.

## Connect payments when ready to sell

Checkout is deliberately unavailable without credentials; clicking a pricing button never simulates a charge or grants Pro. The owner must supply their own merchant account. First complete the [launch prerequisites](docs/LAUNCH.md), including support/refund/privacy terms and eligibility for the processor.

1. Configure the variables shown in `.env.example` using your host's secure secrets settings (or a local untracked `.env`). Never commit real keys. Set `APP_URL` to your actual HTTPS origin.
2. Set **both** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Use Stripe test mode first. `STRIPE_PRICE_ID` is optional; if supplied it must be an active, one-time USD 29.00 price. Otherwise the server creates a fixed $29 checkout line item. Prices supplied by the browser are ignored.
3. Register `POST /api/billing/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`. Signature validation uses the unmodified request body. The server requires egress to `api.stripe.com`.
4. Complete a real **test-mode** purchase, cancellation, refund, and recovery on the deployment before enabling live payments. Automated tests use a mocked gateway plus actual Stripe signature generation; they do not replace that provider integration test. Payments and taxes for the owner's jurisdiction remain their responsibility.

Licensing is granted only after verifying a paid $29 USD session and settled, unrefunded, undisputed payment intent, tied to the browser that started checkout. Webhook mutations are transactional and idempotent; refunds/disputes revoke the recovery key. A full refund revokes the license; partial refunds retain it. Lost return responses and concurrent return requests safely reissue the same key. Recovery survives server restarts only when the database is retained.

Proxy-injected Stripe API credentials can work for HTTPS requests to `api.stripe.com`. The webhook signing secret must be available to the process as its **actual secret**, because signature verification is local; an outbound proxy placeholder is insufficient. Configure it through the deployment's runtime secret mechanism, never in chat or checked-in files.

## Deployment

The production runtime needs only Node 24 and production npm dependencies; the TypeScript server is compiled during `npm run build`.

```sh
npm ci
npm run build
npm prune --omit=dev
APP_URL=https://your-real-domain.example NODE_ENV=production npm start
```

`.example` is a placeholder; replace it with the registered domain. Deploy behind HTTPS, preserve **`.data` on a durable writable volume**, and back up the SQLite database. Set `DATABASE_PATH` to a durable path when needed. A single persistent Node process is the intended initial deployment. An ephemeral serverless filesystem loses purchase records; do not use it for live payments. Rate limits are in-process and intended for this single-instance setup. Do not run unrelated replicas against uncoordinated database copies.

`Dockerfile` provides a Node 24 multi-stage image, a non-root runtime, and `/app/.data` as its data volume. Pass `APP_URL` and credentials at runtime. The container recipe is provided but was not built in this environment; the compiled production server itself was exercised. `GET /api/health` returns `{ "ok": true, "service": "scopebook" }`. `GET /api/billing/status` reports payment configuration and the current license without exposing secrets.

## Validation

```sh
npm run build        # TypeScript, client bundle, compiled server
npm test             # Calculations, import/export, payment verification and recovery
npm run test:e2e     # Desktop + mobile Chromium user workflows
npm run samples      # Regenerate English/Russian sample HTML and PDFs (requires Chromium)
```

Browser tests use system Chromium at `/usr/bin/chromium` when present. Otherwise install Playwright's browser with `npx playwright install chromium`; `CHROMIUM_PATH` can select another executable. The test runner starts the built server automatically. Build first. Pro browser tests mock only the entitlement response to exercise exports/backups; backend tests independently verify payment authorization. No real payments, deployment, outreach, or purchases were performed during development.

## Repository map

- `src/App.tsx`: workspace, editor, export UI, and license flow.
- `src/lib/proposals.ts`: proposal schema, arithmetic, safe printable documents, backups.
- `server/`: Express API, Stripe integration, SQLite purchase store.
- `docs/`: sourced market research and the launch experiment.
- `tests/`: desktop/mobile browser checks.

Cloud tasks already have isolated environments. Use this checkout directly; there is no need to create another Git worktree for normal development.
