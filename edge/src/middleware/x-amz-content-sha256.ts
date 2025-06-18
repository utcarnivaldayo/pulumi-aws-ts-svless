import { createMiddleware } from "hono/factory";

async function calculateSHA256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

export const xAmzContentSha256Middleware = createMiddleware(async (c, next) => {
  const method = c.req.method;
  if (method === "POST" || method === "PUT") {
    const request = c.req.raw.clone();
    const body = await request.text();
    const hash = await calculateSHA256(body);

    // NOTE: c.env.request は lambda@edge オリジナルのプロパティ
    c.env.request.headers["x-amz-content-sha256"] = [
      { key: "x-amz-content-sha256", value: hash },
    ];
  }
  await next();
});
