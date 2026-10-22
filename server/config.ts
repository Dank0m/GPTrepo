import path from 'node:path';

export interface ServerConfig {
  appUrl: string;
  databasePath: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePriceId?: string;
  production: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  if (production && !env.APP_URL) throw new Error('Set APP_URL to the public HTTPS origin before starting production.');
  const appUrl = env.APP_URL || 'http://localhost:5173';
  const parsed = new URL(appUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('APP_URL must be an HTTPS origin, or HTTP localhost for local development.');
  }
  return {
    appUrl: parsed.origin,
    databasePath: env.DATABASE_PATH || path.resolve('.data/scopebook.sqlite'),
    stripeSecretKey: env.STRIPE_SECRET_KEY || undefined,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || undefined,
    stripePriceId: env.STRIPE_PRICE_ID || undefined,
    production,
  };
}
