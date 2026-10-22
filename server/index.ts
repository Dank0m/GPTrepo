import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number.');
const app = createApp({ onError: () => console.error('Scopebook: an API request failed. Check payment configuration and Stripe dashboard for details.') });
const server = app.listen(port, '0.0.0.0', (error?: Error) => {
  if (error) {
    console.error(`Scopebook could not start on port ${port}. Check that the port is available.`);
    app.locals.purchaseStore.close();
    process.exitCode = 1;
    return;
  }
  console.log(`Scopebook API listening on port ${port}`);
});
const shutdown = () => {
  server.close(() => {
    app.locals.purchaseStore.close();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
