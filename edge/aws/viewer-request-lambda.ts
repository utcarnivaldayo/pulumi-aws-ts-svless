import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { local } from "@pulumi/command";
import * as fs from "node:fs";

import { NAME_PREFIX, virginiaProvider, selfStack, jstDate } from "../../utils";

export const viewerRequestLambdaId: string = `${NAME_PREFIX}-viewer-request-lambda`;

const viewerRequestLambdaRole = new aws.iam.Role(
  `${viewerRequestLambdaId}-role`,
  {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          },
        },
      ],
    }),
    managedPolicyArns: [
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    ],
    name: `${viewerRequestLambdaId}-role`,
  },
  {
    provider: virginiaProvider,
  },
);

const authConfig = new pulumi.Config("edge-auth");
const enableBasicAuth = authConfig.requireBoolean("enable-basic-auth") ?? true;
const basicAuthUsername = authConfig.require("basic-auth-username");
const basicAuthPassword = authConfig.requireSecret("basic-auth-password");

const ipRestrictionConfig = new pulumi.Config("edge-ip-restriction");
const enableIpRestriction =
  ipRestrictionConfig.requireBoolean("enable-ip-restriction") ?? false;
const allowIpList =
  ipRestrictionConfig.getObject<string[]>("allow-ip-list") || [];

const EDGE_DIR = "edge";
const DIST_DIR = "dist";

const DIST_PATH = `./${EDGE_DIR}/${DIST_DIR}`;
export const EXISTS_EDGE_DIST =
  (fs.existsSync(DIST_PATH)
    ? selfStack.getOutput("EXISTS_EDGE_DIST")
    : pulumi.output(jstDate(new Date())).apply(date => date || jstDate(new Date())));

const ZIP_PATH = `./${EDGE_DIR}/lambda.zip`;
export const EXISTS_EDGE_LAMBDA_ZIP =
  (fs.existsSync(ZIP_PATH) ? selfStack.getOutput("EXISTS_EDGE_LAMBDA_ZIP")
    : pulumi.output(jstDate(new Date()))).apply(date => date || jstDate(new Date()));

const viewerRequestBuildCommand = new local.Command(
  `${viewerRequestLambdaId}-build`,
  {
    create: "pnpm install --frozen-lockfile && pnpm build && pnpm zip",
    dir: `./${EDGE_DIR}`,
    triggers: [
      new pulumi.asset.FileArchive(`./${EDGE_DIR}/src`),
      new pulumi.asset.FileAsset(`./${EDGE_DIR}/package.json`),
      EXISTS_EDGE_DIST,
      EXISTS_EDGE_LAMBDA_ZIP,
    ],
    environment: {
      ENABLE_BASIC_AUTH: enableBasicAuth.toString(),
      ENABLE_IP_RESTRICTION: enableIpRestriction.toString(),
      IP_RESTRICTION_ALLOW_IP_LIST: allowIpList.join(","),
      BASIC_AUTH_USERNAME: basicAuthUsername || "dev",
      BASIC_AUTH_PASSWORD: basicAuthPassword || "pw1234",
    },
  },
);

export const viewerRequestLambda = new aws.lambda.Function(
  viewerRequestLambdaId,
  {
    architectures: ["x86_64"],
    code: viewerRequestBuildCommand.stdout.apply((_) => {
      return new pulumi.asset.FileArchive(ZIP_PATH);
    }),
    ephemeralStorage: {
      size: 512, // [MB]
    },
    memorySize: 128, // [MB]
    handler: "index.handler",
    name: viewerRequestLambdaId,
    packageType: "Zip",
    role: viewerRequestLambdaRole.arn,
    runtime: aws.lambda.Runtime.NodeJS22dX,
    loggingConfig: {
      applicationLogLevel: "INFO",
      logFormat: "JSON",
      logGroup: `/aws/lambda/${viewerRequestLambdaId}`,
      systemLogLevel: "INFO",
    },
    timeout: 5,
    publish: true,
  },
  {
    provider: virginiaProvider,
  },
);
