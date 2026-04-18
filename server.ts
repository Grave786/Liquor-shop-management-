import { startServer } from "./backend/src/server";

export { app, startServer } from "./backend/src/server";

// In Vercel serverless, the module is imported as a handler and must not open a listener.
if (!process.env.VERCEL) {
  startServer();
}
