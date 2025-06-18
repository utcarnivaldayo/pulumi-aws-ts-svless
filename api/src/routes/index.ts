import { Hono } from "hono";
import { logger } from "hono/logger";
import { usersRouter } from "./users";

const API_VERSION = process.env.API_VERSION || 1;
export const app = new Hono().basePath(`/api/v${API_VERSION}`);

app.use("*", logger());

// ヘルスチェック用のエンドポイント
app.get("/hello", (c) => {
  return c.text("Hello Hono!");
});

// x-amz-content-sha256 チェック用エンドポイント
app.post("/greet", async (c) => {
  const { username } = await c.req.json();
  return c.text(`Hello ${username}!`);
});

app.route("/users", usersRouter);
