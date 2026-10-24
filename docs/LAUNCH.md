# Scopebook launch experiment

[Русская версия](LAUNCH.ru.md)

## Current status

Scopebook is a working prelaunch product. There are no verified customers, sales, testimonials, or income results. The offer is a free version with one saved proposal and **Pro for $29 once**, with up to 500 proposals, clean PDF export, and backups. This is a testable pricing hypothesis, not proven demand. See [the research](MARKET_RESEARCH.md) for sources and limitations.

Server-created Stripe Checkout, payment verification, refund handling, SQLite-backed licenses, and recovery-key flows are implemented and covered by local tests. Real Stripe test-mode and live payments have not been exercised because the owner's credentials are not configured. No external deployment or outreach has occurred, and no merchant identity has been invented.

## Positioning

**For independent web designers and developers who want to quote profitable projects without vague scope.** Draft deliverables, set revision limits, list exclusions, choose a deposit, and price change requests from the same workspace. Proposals are stored privately in the browser's localStorage; exports are deliberate user actions. License and payment records are stored server-side in SQLite. The browser's Pro license uses an HttpOnly cookie, and the recovery key is a secret the buyer must keep safe. Cloud sync and client signatures are not part of the current offer.

Suggested landing-page headline: “A clear scope. A profitable project.”

Suggested offer: “Build your next web design proposal, know your margin, and put revision limits in writing. Try one proposal free. $29 once for Pro.”

Use original screenshots with clearly marked sample data. Never present sample business names or project values as actual customers or revenue.

## Before accepting money

1. Register a domain and deploy over HTTPS. Verify the deployment with a real browser on mobile and desktop.
2. Connect a payment processor account the owner can legally use in their jurisdiction. Complete business verification, tax decisions, currency, refund terms, and receipt/support contact settings. Never claim these are already configured.
3. Configure this implementation's Stripe integration: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and set `APP_URL` to the exact public HTTPS origin. Checkout creates a fixed $29 one-time inline product by default; optionally set `STRIPE_PRICE_ID` to the owner's corresponding Stripe price. The server verifies payment before issuing a license; a return URL or client-side flag is not proof of payment. Register `/api/billing/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`. First verify successful, failed, and canceled test payments; duplicate event delivery; license recovery; refunds; and disputes against Stripe test mode. Repeat a controlled live check only after the owner's live account is ready.
4. Deploy the Node server with persistent storage for `.data` and back up its SQLite database. An ephemeral/serverless filesystem without a persistent volume cannot retain licenses. Verify restoration from a database backup. Keep browser proposal backups separate: they do not replace the license database.
5. Publish accurate terms, refund policy, privacy/data-storage explanation, and owner contact information. Browser storage can be cleared, so verify proposal backup/restore and explain its limits. Have a support process for lost recovery keys and never expose them in logs or public screenshots.
6. Walk through the exact free-to-paid flow, PDF output, license recovery, and proposal backup restoration on the production domain. Never advertise a working purchase path before it actually works.

These are launch prerequisites, not reasons to delay a local working build. Do not add fictional API keys, merchant identities, testimonials, or paid-order counters.

## First 14 days: test the buyer, not vanity traffic

- **Days 1–2:** Record a 60-second walkthrough: start a small business website proposal, set included revisions, inspect the project economics, and export the client document. Create one useful downloadable sample proposal using original content.
- **Days 3–5:** Publish the walkthrough and sample in the owner's own channels. Manually identify two freelancer communities that permit product posts and read their rules. The owner can share there with clear disclosure. No automated outreach or messages have been sent.
- **Days 6–10:** Offer five voluntary 15-minute feedback sessions. Ask buyers to bring a real previous quote; observe whether they can produce a usable replacement. Do not collect their confidential documents without permission. Track completion, confusing steps, and whether they independently mention paying.
- **Days 11–14:** Run a small price test using the actual $29 checkout only after the above prerequisites. Keep price consistent during each measured cohort. Record the funnel in a simple sheet: source, qualified visitor, first proposal completed, checkout started, purchase, refund, and feedback. Count only settled payments as revenue.

**Initial decision rule:** seek 50 qualified visitors, 10 completed proposals, and 3 purchases. These are chosen experiment thresholds, not forecasts or industry benchmarks. If nobody completes a proposal, improve usability. If users finish but nobody buys, interview volunteers about missing value and price before expanding features. With fewer than 50 qualified visitors, do not conclude the market rejected the idea.

## Economics: assumptions to replace with actuals

At $29, 35 purchases would produce **$1,015 gross**, before payment fees, taxes, refunds, acquisition, hosting, and support. As an illustrative calculation only, assuming fees of 3% + $0.30 per purchase leaves $27.83 per nonrefunded sale before other costs. This is not a quoted payment-processing rate; use the owner's actual country/provider rates.

Keep initial hosting inexpensive and avoid paid acquisition until organic users complete and buy. A $10 acquisition cost would leave $17.83 under that illustrative fee assumption. A $30 acquisition cost would lose money before support. A one-time license requires ongoing sales to fund ongoing maintenance; do not describe it as recurring revenue.

## Expansion only after evidence

Multi-currency proposals and priced change orders are already part of the initial product. If real paying users request it, consider additional niche templates and deeper branding controls. Cloud sync, automated client email, legally reviewed contract terms, client approval, and subscription billing add costs and operational work. Keep them separate from the initial promise until implemented and tested.
