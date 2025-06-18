import { handle } from "hono/aws-lambda";
import { app } from "./routes";

module.exports.handler = handle(app);
