import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { NAME_PREFIX, createTags } from "../../utils";
import { clientBucketId, clientBucket } from "../../client/aws/s3";
import { viewerRequestLambda } from "../../edge/aws/viewer-request-lambda";

// client S3 bucket OAC
const clientBucketOac = new aws.cloudfront.OriginAccessControl(
  `${clientBucketId}-oac`,
  {
    description: "OAC for client bucket",
    name: clientBucket.bucket,
    originAccessControlOriginType: "s3",
    signingBehavior: "always",
    signingProtocol: "sigv4",
  }
);

const MANAGED_CACHE_CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6";
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html#managed-cache-caching-optimized

const distributionId: string = `${NAME_PREFIX}-distribution`;
export const distribution = new aws.cloudfront.Distribution(distributionId, {
  // NOTE: SPA の存在しないパスへのリダイレクト用
  customErrorResponses: [
    {
      errorCode: 403,
      responseCode: 200,
      responsePagePath: "/",
    },
    {
      errorCode: 404,
      responseCode: 200,
      responsePagePath: "/",
    },
  ],
  defaultCacheBehavior: {
    allowedMethods: ["GET", "HEAD"],
    cachedMethods: ["GET", "HEAD"],
    compress: true,
    targetOriginId: clientBucket.bucket,
    viewerProtocolPolicy: "https-only",
    cachePolicyId: MANAGED_CACHE_CACHING_OPTIMIZED,
    lambdaFunctionAssociations: [
      {
           eventType: "viewer-request",
           lambdaArn: viewerRequestLambda.qualifiedArn,
           includeBody: true,
      },
    ],
  },
  defaultRootObject: "index.html",
  enabled: true,
  // NOTE: http3, http2and3 は cloudfront の staging 環境をサポートしない
  httpVersion: "http2",
  // NOTE: 東京は、PriceClass_200
  priceClass: "PriceClass_200",
  // NOTE: アクセスは国内限定
  restrictions: {
    geoRestriction: {
      locations: ["JP"],
      restrictionType: "whitelist",
    },
  },
  origins: [
    {
      domainName: clientBucket.bucketRegionalDomainName,
      originAccessControlId: clientBucketOac.id,
      originId: clientBucket.bucket,
    },
  ],
  viewerCertificate: {
    // NOTE: デフォルトのドメインを利用する。Route53 などのドメインを利用する場合は設定変更が必要
    cloudfrontDefaultCertificate: true,
    minimumProtocolVersion: "TLSv1",
  },
  comment: "",
  tags: createTags(distributionId),
});

// S3 バケットポリシー
const clientBucketPolicy = new aws.s3.BucketPolicy(`${clientBucketId}-policy`, {
  bucket: clientBucket.id,
  policy: pulumi
    .all([clientBucket.arn, distribution.arn])
    .apply(([bucketArn, distributionArn]) => {
      return JSON.stringify({
        Id: "PolicyForCloudFrontPrivateContent",
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowCloudFrontServicePrincipal",
            Effect: "Allow",
            Principal: {
              Service: "cloudfront.amazonaws.com",
            },
            Action: "s3:GetObject",
            Resource: `${bucketArn}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": distributionArn,
              },
            },
          },
        ],
      });
    }),
});

// stack output
export const CLOUD_FRONT_URL = pulumi.interpolate`https://${distribution.domainName}`;
