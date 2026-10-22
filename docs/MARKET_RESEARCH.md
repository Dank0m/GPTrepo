# Scopebook: desk research and decision

Research date: 22 October 2026. No interviews, sales, demand tests, or willingness-to-pay tests have been performed.

## What was observed

1. **Midday targets freelancers, contractors, consultants, and solo entrepreneurs.** Its public README describes time tracking, invoices, receipts, exports, and contract/document storage. This is evidence of competitors investing in financial workflows for this audience, not evidence that they will buy Scopebook. Source retrieved: https://raw.githubusercontent.com/midday-ai/midday/main/README.md
2. **Midday's public pricing implementation specifies Starter at $19/month ($15/month billed annually) and Pro at $49/month ($39/month billed annually), with equivalent numeric EUR prices for Europe.** Its Starter feature list includes invoicing/payment, time tracking, and customer management. These are source-code figures, not a completed checkout or independently verified live offer. Source retrieved: https://raw.githubusercontent.com/midday-ai/midday/main/packages/plans/src/index.ts
3. **InvoicePlane already covers quotes, invoices, clients, products, projects/tasks, payment tracking, reminders, and customization.** A generic invoice app would compete with substantial free/self-hosted functionality. Source retrieved: https://raw.githubusercontent.com/InvoicePlane/InvoicePlane/master/README.md
4. **SolidInvoice explicitly targets small businesses and freelancers and supports quotes, invoices, online payment acceptance, taxes, discounts, and client management.** Source retrieved: https://raw.githubusercontent.com/SolidInvoice/SolidInvoice/2.3.x/README.md
5. **InvoiceShelf covers invoices, estimates, payments, and expenses.** This independently reinforces that generic estimate/invoice generation is an established, crowded feature set. Source retrieved: https://raw.githubusercontent.com/InvoiceShelf/InvoiceShelf/master/README.md

Direct pricing pages at Bonsai, Better Proposals, and PandaDoc could not be retrieved because the environment network proxy denied their hosts (HTTP tunnel 403). No claims about their current pricing are made. No competitor application code was copied.

## Decision and hypothesis

Build **Scopebook**, a local-first proposal and scope-control workspace for independent web designers and developers. The specific job is turning a project brief into a priced, client-ready proposal with clear deliverables, revision limits, exclusions, deposit terms, and a consistent method for pricing later changes.

The inference: specialists may prefer a small, one-time-purchase tool to recurring all-in-one finance software. Scope clarity and margin visibility are a narrower entry point than invoices. This remains a hypothesis: the sources do not prove pain severity, willingness to pay, market size, or demand for Scopebook.

Test a free version with one saved proposal and **$29 one-time Pro**, offering up to 500 saved proposals, clean PDF export, and backups. $29 is an experimental price chosen for low purchase friction, not a competitor-derived optimum. Do not claim savings, income improvements, customers, reviews, or conversion rates until measured.
