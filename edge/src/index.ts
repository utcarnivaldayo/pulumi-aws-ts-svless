import { Hono } from "hono";
import { handle } from 'hono/lambda-edge';
import { basicAuth } from 'hono/basic-auth';
import { ipRestriction } from 'hono/ip-restriction';
import { logger } from "hono/logger";
import { type CloudFrontRequest, type Callback, getConnInfo } from 'hono/lambda-edge';

import { xAmzContentSha256Middleware } from "./middleware/x-amz-content-sha256";

type Bindings = {
  callback: Callback
  request: CloudFrontRequest
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());

if (process.env.ENABLE_BASIC_AUTH === "true") {
  app.use(
    '*',
    basicAuth({
      username: process.env.BASIC_AUTH_USERNAME || 'dev',
      password: process.env.BASIC_AUTH_PASSWORD || 'pw1234',
    })
  );
}

const createAllowIpList = () => {
  const rawAllowIpList: string = process.env.IP_RESTRICTION_ALLOW_IP_LIST || '';
  const allowIpList: string[] = rawAllowIpList ? rawAllowIpList.split(',').map(ip => ip.trim()) : [];
  return allowIpList;
};

if (process.env.ENABLE_IP_RESTRICTION === "true") {
  app.use(
    '*',
    ipRestriction(
      getConnInfo,
      {
        denyList: [],
        allowList: createAllowIpList(),
      }
    )
  )
}

app.use("/api/*", xAmzContentSha256Middleware);

app.all("*", async (c, next) => {
  await next();
  // NOTE: lambda@edge にフローを戻す
  c.env.callback(null, c.env.request);
});

export const handler = handle(app);
