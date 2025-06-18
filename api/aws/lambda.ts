import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "node:fs";
import { local } from "@pulumi/command";

import { NAME_PREFIX, selfStack, jstDate } from "../../utils";
import { dsqlAccessPolicy } from "./dsql";

export const apiLambdaId: string = `${NAME_PREFIX}-api-lambda`;

const apiLambdaRole = new aws.iam.Role(`${apiLambdaId}-role`, {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
      },
    ],
  }),
  managedPolicyArns: [
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    "arn:aws:iam::aws:policy/CloudWatchLambdaApplicationSignalsExecutionRolePolicy",
  ],
  name: `${apiLambdaId}-role`,
});

const dsqlRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
  `${apiLambdaId}-dsql-role-attachment`,
  {
     role: apiLambdaRole.name,
     policyArn: dsqlAccessPolicy.arn,
  },
);

const API_DIR = "api";
const DIST_DIR = "dist";
const DIST_PATH = `./${API_DIR}/${DIST_DIR}`;
export const EXISTS_API_DIST =
  (fs.existsSync(DIST_PATH)
    ? selfStack.getOutput("EXISTS_API_DIST")
    : pulumi.output(jstDate(new Date()))).apply(date => date || jstDate(new Date()));

const ZIP_PATH = `./${API_DIR}/lambda.zip`;
export const EXISTS_API_LAMBDA_ZIP =
  (fs.existsSync(ZIP_PATH) ? selfStack.getOutput("EXISTS_API_LAMBDA_ZIP")
    : pulumi.output(jstDate(new Date()))).apply(date => date || jstDate(new Date()));

const apiBuildCommand = new local.Command(`${apiLambdaId}-build`, {
  create: "pnpm install --frozen-lockfile && pnpm build && pnpm zip",
  dir: `./${API_DIR}`,
  triggers: [
    new pulumi.asset.FileArchive(`./${API_DIR}/src`),
    new pulumi.asset.FileAsset(`./${API_DIR}/package.json`),
    EXISTS_API_DIST,
    EXISTS_API_LAMBDA_ZIP,
  ],
});

export const apiLambda = new aws.lambda.Function(apiLambdaId, {
  architectures: ["arm64"],
  environment: {
    variables: {
      AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument",
      // NOTE: CloudFront リソースが作成されて、次回以降の pulumi up で参照可能
      CLOUD_FRONT_URL: selfStack.getOutput("CLOUD_FRONT_URL"),
      PG_USER: "lambda", // データベースロールの名前
      PG_HOST: selfStack.getOutput("DSQL_CLUSTER_ENDPOINT"),
      PG_PORT: "5432",
      PG_DATABASE: "postgres",
    },
  },
  code: apiBuildCommand.stdout.apply((_) => {
    return new pulumi.asset.FileArchive(ZIP_PATH);
  }),
  ephemeralStorage: {
    size: 512,
  },
  memorySize: 128,
  handler: "index.handler",
  layers: [
    "arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroJs:8",
  ],
  loggingConfig: {
    applicationLogLevel: "INFO",
    logFormat: "JSON",
    logGroup: `/aws/lambda/${apiLambdaId}`,
    systemLogLevel: "INFO",
  },
  name: apiLambdaId,
  packageType: "Zip",
  role: apiLambdaRole.arn,
  runtime: aws.lambda.Runtime.NodeJS22dX,
  timeout: 10,
  tracingConfig: {
    mode: "Active",
  },
});

export const apiLambdaUrl = new aws.lambda.FunctionUrl(`${apiLambdaId}-url`, {
  authorizationType: "AWS_IAM",
  functionName: apiLambda.name,
  invokeMode: "BUFFERED",
});

export const API_LAMBDA_FUNCTION_URL = apiLambdaUrl.functionUrl.apply((url: string) => {
  // NOTE: url の末尾の / を消す
  return url.replace(/\/$/, '');
});

export const API_LAMBDA_ROLE_ARN = pulumi.interpolate`${apiLambdaRole.arn}`;
