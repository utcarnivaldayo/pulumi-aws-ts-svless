import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as synced from "@pulumi/synced-folder";
import { local } from "@pulumi/command";
import * as fs from "node:fs";

import {
  NAME_PREFIX,
  createTags,
  getAwsAccountId,
  getAwsRegion,
  selfStack,
  jstDate,
} from "../../utils";

export const clientBucketId: string = `${NAME_PREFIX}-client-bucket-${getAwsAccountId()}`;

// Create an AWS resource (S3 Bucket)
export const clientBucket = new aws.s3.BucketV2(clientBucketId, {
  bucket: clientBucketId,
  forceDestroy: true, // 開発環境向け
  objectLockEnabled: false, // 開発環境向け
  tags: createTags(clientBucketId),
});

// Build client and sync to S3
const CLIENT_DIR = "client";
const DIST_DIR = "dist";
const DIST_PATH = `./${CLIENT_DIR}/${DIST_DIR}`;
export const EXISTS_CLIENT_DIST =
  (fs.existsSync(DIST_PATH)
    ? selfStack.getOutput("EXISTS_CLIENT_DIST")
    : pulumi.output(jstDate(new Date())).apply(date => date || jstDate(new Date())));

const clientBuildCommand = new local.Command(`${clientBucketId}-build`, {
  create: "pnpm install --frozen-lockfile && pnpm build",
  dir: `./${CLIENT_DIR}`,
  triggers: [
    new pulumi.asset.FileAsset(`./${CLIENT_DIR}/index.html`),
    new pulumi.asset.FileAsset(`./${CLIENT_DIR}/vite.config.ts`),
    new pulumi.asset.FileAsset(`./${CLIENT_DIR}/package.json`),
    new pulumi.asset.FileArchive(`./${CLIENT_DIR}/src`),
    EXISTS_CLIENT_DIST,
  ],
});

const s3BucketSync = new synced.S3BucketFolder(
  `${clientBucketId}-synced-folder`,
  {
    bucketName: clientBucket.id,
    path: DIST_PATH,
    acl: "private",
    managedObjects: false,
  },
  {
    dependsOn: [clientBuildCommand],
  }
);

export const CLIENT_BUCKET_NAME = pulumi.interpolate`https://${getAwsRegion()}.amazonaws.com/${
  clientBucket.id
}`;
