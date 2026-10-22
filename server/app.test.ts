import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import Stripe from 'stripe';
import { createApp, hashToken, type PaymentGateway } from './app.js';
import { PurchaseStore } from './store.js';
import { readConfig, type ServerConfig } from './config.js';

const config: ServerConfig = {
  appUrl: 'https://scopebook.example', databasePath: ':memory:', production: true,
  stripeSecretKey: 'sk_test_not_a_real_key', stripeWebhookSecret: 'whsec_not_a_real_secret',
};
const sessionId = 'cs_test_examplecheckoutsession123';
const paidSession = {
  id: sessionId, mode: 'payment', status: 'complete', payment_status: 'paid',
  amount_total: 2900, currency: 'usd', metadata: { product: 'scopebook_pro' }, payment_intent: 'pi_examplepayment',
} as unknown as Stripe.Checkout.Session;
const succeededIntent = {
  id: 'pi_examplepayment', status: 'succeeded', amount: 2900, amount_received: 2900, currency: 'usd',
  metadata: { product: 'scopebook_pro' }, latest_charge: { id: 'ch_example', paid: true, refunded: false, disputed: false },
} as unknown as Stripe.PaymentIntent;
const stores: PurchaseStore[] = [];

function setup(overrides: Partial<ServerConfig> = {}) {
  const store = new PurchaseStore(':memory:');
  stores.push(store);
  const gateway = {
    createCheckout: vi.fn().mockResolvedValue({ id: sessionId, url: 'https://checkout.stripe.com/c/pay/test_session' }),
    retrieveCheckout: vi.fn().mockResolvedValue(paidSession),
    retrievePaymentIntent: vi.fn().mockResolvedValue(succeededIntent),
    retrievePrice: vi.fn().mockResolvedValue({ active: true, type: 'one_time', currency: 'usd', unit_amount: 2900 }),
    constructEvent: vi.fn(),
  } satisfies PaymentGateway;
  const app = createApp({ config: { ...config, ...overrides }, store, gateway });
  return { app, store, gateway };
}

function cookieValue(response: { headers: Record<string, unknown> }, name: string) {
  const cookies = response.headers['set-cookie'] as string[];
  return cookies?.find((entry) => entry.startsWith(`${name}=`))?.split(';')[0] || '';
}

async function purchase(app: ReturnType<typeof createApp>) {
  const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({});
  expect(checkout.status).toBe(200);
  const stateCookie = cookieValue(checkout, 'scopebook_checkout');
  const complete = await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', stateCookie);
  expect(complete.headers.location).toBe('/app?upgrade=success');
  const licenseCookie = cookieValue(complete, 'scopebook_license');
  return { checkout, complete, licenseCookie, stateCookie };
}

afterEach(() => stores.splice(0).forEach((store) => store.close()));

describe('Scopebook billing', () => {
  it('keeps checkout honestly unavailable without payment credentials', async () => {
    const { app, gateway } = setup({ stripeSecretKey: undefined, stripeWebhookSecret: undefined });
    const status = await request(app).get('/api/billing/status');
    expect(status.body).toEqual({ configured: false, pro: false, price: { amount: 29, currency: 'usd', type: 'one_time' } });
    const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({});
    expect(checkout.status).toBe(503);
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it('rejects cross-origin and missing-origin production writes', async () => {
    const { app } = setup();
    expect((await request(app).post('/api/billing/checkout').set('Origin', 'https://evil.example').send({})).status).toBe(403);
    expect((await request(app).post('/api/billing/checkout').send({})).status).toBe(403);
  });

  it('sets the price server-side and binds fulfilment to the checkout browser', async () => {
    const { app, gateway, store } = setup();
    const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({ amount: 1, currency: 'eur' });
    expect(checkout.body.url).toMatch(/^https:\/\/checkout.stripe.com\//);
    const parameters = gateway.createCheckout.mock.calls[0][0];
    expect(parameters.line_items?.[0].price_data?.unit_amount).toBe(2900);
    expect(parameters.success_url).toBe(`${config.appUrl}/api/billing/complete?session_id={CHECKOUT_SESSION_ID}`);
    expect((await request(app).get(`/api/billing/complete?session_id=${sessionId}`)).headers.location).toBe('/app?upgrade=error');
    expect(store.get(sessionId)?.status).toBe('pending');
    const completion = await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', cookieValue(checkout, 'scopebook_checkout'));
    expect(completion.headers.location).toBe('/app?upgrade=success');
    expect(completion.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(completion.headers['set-cookie'][0]).toContain('Secure');
    expect(store.get(sessionId)?.status).toBe('paid');
    const license = cookieValue(completion, 'scopebook_license');
    expect((await request(app).get('/api/billing/status').set('Cookie', license)).body.pro).toBe(true);
  });

  it('refuses unpaid or mismatched purchases', async () => {
    const { app, gateway, store } = setup();
    const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({});
    gateway.retrieveCheckout.mockResolvedValueOnce({ ...paidSession, amount_total: 100 });
    const result = await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', cookieValue(checkout, 'scopebook_checkout'));
    expect(result.headers.location).toBe('/app?upgrade=pending');
    expect(result.headers['set-cookie']).toBeUndefined();
    expect(store.get(sessionId)?.status).toBe('pending');
  });

  it('keeps recovery keys stable when a completed checkout URL is replayed', async () => {
    const { app, store } = setup();
    const { licenseCookie, stateCookie } = await purchase(app);
    const originalHash = store.get(sessionId)?.license_hash;
    expect((await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', `${stateCookie}; ${licenseCookie}`)).headers.location).toBe('/app?upgrade=success');
    const retryWithoutLicense = await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', stateCookie);
    expect(retryWithoutLicense.headers.location).toBe('/app?upgrade=success');
    expect(cookieValue(retryWithoutLicense, 'scopebook_license')).toBe(licenseCookie);
    expect(store.get(sessionId)?.license_hash).toBe(originalHash);
    expect((await request(app).get('/api/billing/status').set('Cookie', licenseCookie)).body.pro).toBe(true);
  });

  it('issues at most one recovery key for overlapping checkout-return requests', async () => {
    const { app, gateway, store } = setup();
    const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({});
    const stateCookie = cookieValue(checkout, 'scopebook_checkout');
    let entered = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    gateway.retrieveCheckout.mockImplementation(async () => {
      entered += 1;
      if (entered === 2) release();
      await gate;
      return paidSession;
    });
    const results = await Promise.all([0, 1].map(() => request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', stateCookie)));
    expect(results.filter(result => result.headers.location === '/app?upgrade=success')).toHaveLength(2);
    const licenses = results.map(result => cookieValue(result, 'scopebook_license'));
    expect(licenses[0]).toBe(licenses[1]);
    const license = licenses[0];
    expect((await request(app).get('/api/billing/status').set('Cookie', license)).body.pro).toBe(true);
    const savedHash = store.get(sessionId)?.license_hash;
    expect(store.activate(sessionId, hashToken('a different token'), 'pi_examplepayment')).toBe(false);
    expect(store.get(sessionId)?.license_hash).toBe(savedHash);
  });

  it('refuses a refunded current charge even before its webhook is delivered', async () => {
    const { app, gateway, store } = setup();
    const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({});
    gateway.retrievePaymentIntent.mockResolvedValueOnce({ ...succeededIntent, latest_charge: { ...succeededIntent.latest_charge as Stripe.Charge, refunded: true } });
    const complete = await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', cookieValue(checkout, 'scopebook_checkout'));
    expect(complete.headers.location).toBe('/app?upgrade=error');
    expect(complete.headers['set-cookie']).toBeUndefined();
    expect(store.get(sessionId)?.license_hash).toBeNull();
    store.markPaid(sessionId, 'pi_examplepayment');
    expect(store.get(sessionId)?.status).toBe('revoked');
  });

  it('does not grant a license without a verifiable settled payment intent', async () => {
    const { app, gateway } = setup();
    const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({});
    gateway.retrievePaymentIntent.mockResolvedValueOnce({ ...succeededIntent, status: 'processing' });
    const complete = await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', cookieValue(checkout, 'scopebook_checkout'));
    expect(complete.headers.location).toBe('/app?upgrade=pending');
    expect(complete.headers['set-cookie']).toBeUndefined();
  });

  it('recovers a genuine Pro license on a second browser without storing raw keys', async () => {
    const { app, store } = setup();
    const { licenseCookie } = await purchase(app);
    const recovery = await request(app).get('/api/billing/recovery').set('Cookie', licenseCookie);
    expect(recovery.headers['cache-control']).toBe('no-store');
    expect(recovery.body.key).toMatch(/^sbp_[A-Za-z0-9_-]{43}$/);
    expect(store.get(sessionId)?.license_hash).toBe(hashToken(recovery.body.key));
    expect(store.get(sessionId)?.license_hash).not.toContain(recovery.body.key);
    const recovered = await request(app).post('/api/billing/recover').set('Origin', config.appUrl).send({ key: recovery.body.key });
    expect(recovered.body.pro).toBe(true);
    const secondCookie = cookieValue(recovered, 'scopebook_license');
    expect((await request(app).get('/api/billing/status').set('Cookie', secondCookie)).body.pro).toBe(true);
    expect((await request(app).post('/api/billing/recover').set('Origin', config.appUrl).send({ key: 'sbp_invalid' })).status).toBe(400);
  });

  it('requires a valid webhook signature and does not consume unsigned JSON', async () => {
    const { app, gateway } = setup();
    gateway.constructEvent.mockImplementation(() => { throw new Error('Bad signature'); });
    expect((await request(app).post('/api/billing/webhook').send({ id: 'evt_1' })).status).toBe(400);
    expect((await request(app).post('/api/billing/webhook').set('stripe-signature', 'invalid').send({ id: 'evt_1' })).status).toBe(400);
  });

  it('verifies real Stripe signatures against the raw request body', async () => {
    const store = new PurchaseStore(':memory:');
    stores.push(store);
    store.create(sessionId, hashToken('checkout-state'));
    const app = createApp({ config, store });
    const payload = JSON.stringify({ id: 'evt_real_signature', type: 'checkout.session.completed', data: { object: paidSession } });
    const stripe = new Stripe(config.stripeSecretKey!);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: config.stripeWebhookSecret! });
    const verified = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
    expect(verified.status).toBe(200);
    expect(store.get(sessionId)?.status).toBe('paid');
    const tampered = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload.replace('evt_real_signature', 'evt_tampered'));
    expect(tampered.status).toBe(400);
  });

  it('revokes refunded purchases and blocks both completion replay and recovery', async () => {
    const { app, gateway, store } = setup();
    const { licenseCookie, stateCookie } = await purchase(app);
    const key = (await request(app).get('/api/billing/recovery').set('Cookie', licenseCookie)).body.key;
    gateway.constructEvent.mockReturnValue({ id: 'evt_refund_1', type: 'charge.refunded', data: { object: { refunded: true, payment_intent: 'pi_examplepayment' } } } as Stripe.Event);
    const webhook = await request(app).post('/api/billing/webhook').set('stripe-signature', 'valid').send({ event: 'mocked but signature checked by gateway' });
    expect(webhook.body.received).toBe(true);
    expect(store.get(sessionId)?.status).toBe('revoked');
    expect((await request(app).get('/api/billing/status').set('Cookie', licenseCookie)).body.pro).toBe(false);
    expect((await request(app).post('/api/billing/recover').set('Origin', config.appUrl).send({ key })).status).toBe(400);
    expect((await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', stateCookie)).headers.location).toBe('/app?upgrade=error');
    expect((await request(app).post('/api/billing/webhook').set('stripe-signature', 'valid').send({})).status).toBe(200);
  });

  it('preserves refund revocation when webhook events arrive out of order', async () => {
    const { app, gateway, store } = setup();
    const checkout = await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({});
    gateway.constructEvent.mockReturnValueOnce({ id: 'evt_refund_first', type: 'charge.refunded', data: { object: { refunded: true, payment_intent: 'pi_examplepayment' } } } as Stripe.Event);
    await request(app).post('/api/billing/webhook').set('stripe-signature', 'valid').send({});
    gateway.constructEvent.mockReturnValueOnce({ id: 'evt_paid_late', type: 'checkout.session.completed', data: { object: paidSession } } as Stripe.Event);
    await request(app).post('/api/billing/webhook').set('stripe-signature', 'valid').send({});
    expect(store.get(sessionId)?.status).toBe('revoked');
    expect((await request(app).get(`/api/billing/complete?session_id=${sessionId}`).set('Cookie', cookieValue(checkout, 'scopebook_checkout'))).headers.location).toBe('/app?upgrade=error');
  });

  it('refuses an incorrectly configured Stripe price', async () => {
    const { app, gateway } = setup({ stripePriceId: 'price_example' });
    gateway.retrievePrice.mockResolvedValueOnce({ active: true, currency: 'usd', unit_amount: 1000, type: 'one_time' });
    expect((await request(app).post('/api/billing/checkout').set('Origin', config.appUrl).send({})).status).toBe(503);
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it('rate limits recovery attempts', async () => {
    const { app } = setup();
    let status = 0;
    for (let i = 0; i < 11; i++) status = (await request(app).post('/api/billing/recover').set('Origin', config.appUrl).send({ key: 'no' })).status;
    expect(status).toBe(429);
  });

  it('rolls back failed webhook mutations before recording delivery, allowing a safe retry', () => {
    const { store } = setup();
    store.create(sessionId, hashToken('checkout-state'));
    expect(() => store.processEvent('evt_transaction', () => {
      store.markPaid(sessionId, 'pi_examplepayment');
      throw new Error('Simulated storage failure');
    })).toThrow('Simulated storage failure');
    expect(store.get(sessionId)?.status).toBe('pending');
    expect(store.hasEvent('evt_transaction')).toBe(false);
    expect(store.processEvent('evt_transaction', () => store.markPaid(sessionId, 'pi_examplepayment'))).toBe(true);
    expect(store.get(sessionId)?.status).toBe('paid');
    const duplicateMutation = vi.fn();
    expect(store.processEvent('evt_transaction', duplicateMutation)).toBe(false);
    expect(duplicateMutation).not.toHaveBeenCalled();
  });
});

describe('deployment URL safety', () => {
  it('requires an explicit origin in production', () => {
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('APP_URL');
    expect(readConfig({ NODE_ENV: 'production', APP_URL: 'https://scopebook.example' }).appUrl).toBe('https://scopebook.example');
  });
  it('allows HTTPS and local development origins, rejecting unsafe redirect bases', () => {
    expect(readConfig({ APP_URL: 'https://scopebook.example/' }).appUrl).toBe('https://scopebook.example');
    expect(readConfig({ APP_URL: 'http://localhost:5173' }).appUrl).toBe('http://localhost:5173');
    for (const value of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/app', 'javascript:alert(1)']) {
      expect(() => readConfig({ APP_URL: value })).toThrow();
    }
  });
});
