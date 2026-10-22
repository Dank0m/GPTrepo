import express, { type ErrorRequestHandler, type Request, type RequestHandler, type Response } from 'express';
import Stripe from 'stripe';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readConfig, type ServerConfig } from './config.js';
import { PurchaseStore } from './store.js';

const LICENSE_COOKIE = 'scopebook_license';
const CHECKOUT_COOKIE = 'scopebook_checkout';
const LICENSE_PATTERN = /^sbp_[A-Za-z0-9_-]{43}$/;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const PRO_PRICE = { amount: 29, currency: 'usd', type: 'one_time' } as const;

export interface PaymentGateway {
  createCheckout(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session>;
  retrieveCheckout(id: string): Promise<Stripe.Checkout.Session>;
  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent>;
  retrievePrice(id: string): Promise<Stripe.Price>;
  constructEvent(body: Buffer, signature: string, secret: string): Stripe.Event;
}

function stripeGateway(secret: string): PaymentGateway {
  const stripe = new Stripe(secret, { maxNetworkRetries: 2, timeout: 15000 });
  return {
    createCheckout: (params) => stripe.checkout.sessions.create(params),
    retrieveCheckout: (id) => stripe.checkout.sessions.retrieve(id),
    retrievePaymentIntent: (id) => stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] }),
    retrievePrice: (id) => stripe.prices.retrieve(id),
    constructEvent: (body, signature, secret) => stripe.webhooks.constructEvent(body, signature, secret),
  };
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function cookie(req: Request, name: string): string | undefined {
  const entry = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}

function paidScopebookSession(session: Stripe.Checkout.Session) {
  return session.mode === 'payment' && session.payment_status === 'paid' && session.status === 'complete'
    && session.amount_total === 2900 && session.currency === 'usd' && session.metadata?.product === 'scopebook_pro'
    && Boolean(paymentIntent(session));
}

function paymentIntent(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;
}

interface AppOptions {
  config?: ServerConfig;
  store?: PurchaseStore;
  gateway?: PaymentGateway;
  staticDirectory?: string;
  onError?: (error: unknown) => void;
}

export function createApp(options: AppOptions = {}) {
  const config = options.config || readConfig();
  const store = options.store || new PurchaseStore(config.databasePath);
  const gateway = options.gateway || (config.stripeSecretKey ? stripeGateway(config.stripeSecretKey) : undefined);
  const configured = Boolean(gateway && config.stripeSecretKey && config.stripeWebhookSecret);
  const app = express();
  app.disable('x-powered-by');
  app.locals.purchaseStore = store;
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.appUrl.startsWith('https:'), path: '/' };
  const noStore: RequestHandler = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
  const validLicense = (req: Request) => {
    const token = cookie(req, LICENSE_COOKIE);
    return token && LICENSE_PATTERN.test(token) ? store.license(hashToken(token)) : undefined;
  };
  const setLicense = (res: Response, token: string) => res.cookie(LICENSE_COOKIE, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });

  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  app.get('/api/health', noStore, (_req, res) => res.json({ ok: true, service: 'scopebook' }));

  app.post('/api/billing/webhook', noStore, express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
    if (!configured || !config.stripeWebhookSecret || !gateway) {
      res.status(503).json({ error: 'Payments are not connected yet.' });
      return;
    }
    const signature = req.get('stripe-signature');
    if (!signature || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'A valid Stripe signature is required.' });
      return;
    }
    let event: Stripe.Event;
    try { event = gateway.constructEvent(req.body, signature, config.stripeWebhookSecret); }
    catch { res.status(400).json({ error: 'Invalid webhook signature.' }); return; }
    store.processEvent(event.id, () => {
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object as Stripe.Checkout.Session;
        if (paidScopebookSession(session)) store.markPaid(session.id, paymentIntent(session));
      } else if (event.type === 'checkout.session.expired') {
        store.expire((event.data.object as Stripe.Checkout.Session).id);
      } else if (event.type === 'charge.refunded') {
        const charge = event.data.object as Stripe.Charge;
        const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (charge.refunded && intent) store.revoke(intent);
      } else if (event.type === 'charge.dispute.created') {
        const dispute = event.data.object as Stripe.Dispute;
        const intent = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
        if (intent) store.revoke(intent);
      }
    });
    res.json({ received: true });
  });

  const limits = new Map<string, { count: number; reset: number }>();
  const rateLimit: RequestHandler = (req, res, next) => {
    const now = Date.now();
    if (limits.size > 10000) for (const [key, value] of limits) if (value.reset <= now) limits.delete(key);
    const recovering = req.path === '/billing/recover';
    const key = `${req.ip || 'unknown'}:${recovering ? 'recover' : 'api'}`;
    const current = limits.get(key);
    const item = current && current.reset > now ? current : { count: 0, reset: now + 60000 };
    item.count += 1;
    limits.set(key, item);
    if (item.count > (recovering ? 10 : 90)) {
      res.set('Retry-After', String(Math.ceil((item.reset - now) / 1000)));
      res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
      return;
    }
    next();
  };
  app.use('/api', noStore);
  app.use('/api', rateLimit);
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const origin = req.get('origin');
      if ((origin && origin !== config.appUrl) || (!origin && config.production)) {
        res.status(403).json({ error: 'This request must come from the Scopebook website.' });
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/billing/status', (req, res) => res.json({ configured, pro: Boolean(validLicense(req)), price: PRO_PRICE }));

  app.post('/api/billing/checkout', async (req, res) => {
    if (!configured || !gateway) {
      res.status(503).json({ error: 'Checkout is not available yet. Keep using the free plan; no payment has been taken.' });
      return;
    }
    if (validLicense(req)) { res.status(409).json({ error: 'Pro is already active in this browser.' }); return; }
    const language = req.get('Accept-Language') && req.acceptsLanguages('ru', 'en') === 'ru' ? 'ru' : 'en';
    let state = cookie(req, CHECKOUT_COOKIE);
    if (!state || !STATE_PATTERN.test(state)) state = randomBytes(32).toString('base64url');
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    if (config.stripePriceId) {
      const price = await gateway.retrievePrice(config.stripePriceId);
      if (!price.active || price.type !== 'one_time' || price.unit_amount !== 2900 || price.currency !== 'usd') {
        res.status(503).json({ error: 'Checkout pricing is being configured. No payment has been taken.' });
        return;
      }
      lineItem = { price: config.stripePriceId, quantity: 1 };
    } else {
      lineItem = {
        price_data: { currency: 'usd', unit_amount: 2900, product_data: { name: 'Scopebook Pro', description: language === 'ru' ? 'Разовая лицензия Pro: до 500 предложений, экспорт без водяного знака и резервные копии.' : 'One-time Pro license: up to 500 saved proposals, clean exports, and backups.' } },
        quantity: 1,
      };
    }
    const session = await gateway.createCheckout({
      mode: 'payment',
      locale: language,
      payment_method_types: ['card'],
      line_items: [lineItem],
      metadata: { product: 'scopebook_pro' },
      payment_intent_data: { metadata: { product: 'scopebook_pro' } },
      success_url: `${config.appUrl}/api/billing/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/pricing?checkout=cancelled`,
    });
    if (!session.url || !session.url.startsWith('https://checkout.stripe.com/')) throw new Error('Invalid Stripe checkout response');
    store.create(session.id, hashToken(state));
    res.cookie(CHECKOUT_COOKIE, state, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ url: session.url });
  });

  app.get('/api/billing/complete', async (req, res) => {
    const sessionId = req.query.session_id;
    const state = cookie(req, CHECKOUT_COOKIE);
    if (!configured || !gateway || typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{8,250}$/.test(sessionId) || !state || !STATE_PATTERN.test(state)) {
      res.redirect('/app?upgrade=error');
      return;
    }
    const purchase = store.get(sessionId);
    const stateHash = hashToken(state);
    if (!purchase || purchase.status === 'revoked' || !timingSafeEqual(Buffer.from(purchase.state_hash), Buffer.from(stateHash))) {
      res.redirect('/app?upgrade=error');
      return;
    }
    const session = await gateway.retrieveCheckout(sessionId);
    if (session.id !== sessionId || !paidScopebookSession(session)) { res.redirect('/app?upgrade=pending'); return; }
    const intentId = paymentIntent(session)!;
    const intent = await gateway.retrievePaymentIntent(intentId);
    const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    // A Checkout Session stays "paid" after refunds. Check the current charge
    // before issuing a license instead of waiting for a refund webhook.
    if (intent.id === intentId && charge && (charge.refunded || charge.disputed)) {
      store.revoke(intentId);
      res.redirect('/app?upgrade=error');
      return;
    }
    if (intent.id !== intentId || intent.status !== 'succeeded' || intent.amount !== 2900 || intent.amount_received !== 2900
      || intent.currency !== 'usd' || intent.metadata?.product !== 'scopebook_pro' || !charge || !charge.paid) {
      res.redirect('/app?upgrade=pending');
      return;
    }
    const currentPurchase = store.get(sessionId);
    if (!currentPurchase || currentPurchase.status === 'revoked') { res.redirect('/app?upgrade=error'); return; }
    const existingToken = cookie(req, LICENSE_COOKIE);
    if (existingToken && LICENSE_PATTERN.test(existingToken) && currentPurchase.license_hash === hashToken(existingToken) && currentPurchase.status === 'paid') {
      setLicense(res, existingToken);
      res.redirect('/app?upgrade=success');
      return;
    }
    // The private checkout nonce has 256 bits of randomness. Deriving the key
    // from it makes a retried return idempotent even if the first response was
    // lost. Neither the nonce nor the recoverable license is stored in SQLite.
    const token = `sbp_${createHmac('sha256', state).update(`scopebook-license:v1:${sessionId}`).digest('base64url')}`;
    const tokenHash = hashToken(token);
    if (currentPurchase.license_hash) {
      if (currentPurchase.status !== 'paid' || currentPurchase.license_hash !== tokenHash) { res.redirect('/app?upgrade=error'); return; }
    } else if (!store.activate(sessionId, tokenHash, paymentIntent(session))) {
      // Another request/process may have completed the same purchase while the
      // Stripe request was in flight. Only its identical active key can win.
      const latest = store.get(sessionId);
      if (latest?.status !== 'paid' || latest.license_hash !== tokenHash) { res.redirect('/app?upgrade=error'); return; }
    }
    setLicense(res, token);
    res.redirect('/app?upgrade=success');
  });

  app.get('/api/billing/recovery', (req, res) => {
    if (!validLicense(req)) { res.status(403).json({ error: 'An active Pro license is required.' }); return; }
    res.json({ key: cookie(req, LICENSE_COOKIE) });
  });

  app.post('/api/billing/recover', (req, res) => {
    const key = req.body?.key;
    if (typeof key !== 'string' || !LICENSE_PATTERN.test(key) || !store.license(hashToken(key))) {
      res.status(400).json({ error: 'That recovery key is invalid or no longer active.' });
      return;
    }
    setLicense(res, key);
    res.json({ pro: true });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  const staticDirectory = options.staticDirectory || path.resolve('dist');
  if (existsSync(path.join(staticDirectory, 'index.html'))) {
    app.use(express.static(staticDirectory, { index: false, maxAge: config.production ? '1h' : 0 }));
    app.get(['/', '/app', '/pricing', '/privacy', '/terms'], (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDirectory, 'index.html'));
    });
  }
  app.use((_req, res) => res.status(404).json({ error: 'Page not found.' }));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    options.onError?.(error);
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'Request is too large.' }); return; }
    if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ error: 'Invalid JSON request.' }); return; }
    res.status(502).json({ error: 'This request could not be completed. Please try again shortly.' });
  };
  app.use(errors);
  return app;
}
