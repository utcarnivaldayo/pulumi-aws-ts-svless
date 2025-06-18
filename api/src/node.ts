import { serve } from "@hono/node-server";
import { app } from "./routes";

const API_PORT = Number(process.env.API_PORT || 3030);

serve({
  fetch: app.fetch,
  port: API_PORT,
});
