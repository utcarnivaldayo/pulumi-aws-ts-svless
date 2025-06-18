import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { NAME_PREFIX, createTags, getAwsRegion } from "../../utils";
import { clientBucketId, clientBucket } from "../../client/aws/s3";
import { viewerRequestLambda } from "../../edge/aws/viewer-request-lambda";
import { apiLambdaId, apiLambda, apiLambdaUrl } from "../../api/aws/lambda";

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

const apiLambdaOac = new aws.cloudfront.OriginAccessControl(
  `${apiLambdaId}-oac`,
  {
    description: "",
    name: apiLambda.name,
    originAccessControlOriginType: "lambda",
    signingBehavior: "always",
    signingProtocol: "sigv4",
  },
);

const MANAGED_CACHE_CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6";
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html#managed-cache-caching-optimized

const MANAGED_CACHE_CACHING_DISABLE = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
// https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html#managed-cache-policy-caching-disabled

const MANAGED_ORIGIN_REQUEST_ALL_VIEWER_EXCEPT_HOST_HEADER =
   "b689b0a8-53d0-40ab-baf2-68738e2966ac";
// https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/Deve

const apiLambdaPathPattern = "/api/*";
const createApiLambdaFunctionDomain = (lambdaUrlId: string) => {
  const region = getAwsRegion();
  return `${lambdaUrlId}.lambda-url.${region}.on.aws`;
};

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
    {
      domainName: apiLambdaUrl.urlId.apply(createApiLambdaFunctionDomain),
      originAccessControlId: apiLambdaOac.id,
      originId: apiLambda.name,
      customOriginConfig: {
        originProtocolPolicy: "https-only",
        originSslProtocols: ["TLSv1.2"],
        httpPort: 80,
        httpsPort: 443,
      },
    },
  ],
  orderedCacheBehaviors: [
    {
      pathPattern: apiLambdaPathPattern,
      allowedMethods: [
        "DELETE",
        "GET",
        "HEAD",
        "OPTIONS",
        "PATCH",
        "POST",
        "PUT",
      ],
      cachePolicyId: MANAGED_CACHE_CACHING_DISABLE,
      cachedMethods: ["GET", "HEAD"],
      originRequestPolicyId:
        MANAGED_ORIGIN_REQUEST_ALL_VIEWER_EXCEPT_HOST_HEADER,
      targetOriginId: apiLambda.name,
      viewerProtocolPolicy: "https-only",
      compress: false,
      lambdaFunctionAssociations: [
        {
          eventType: "viewer-request",
          lambdaArn: viewerRequestLambda.qualifiedArn,
          includeBody: true,
        },
      ],
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

// lambda の URL を CloudFront から呼び出せるようにする
const cloudfrontInvokeApiLambdaPermission = new aws.lambda.Permission(
  `${apiLambdaId}-cloudfront-invoke-permission`,
  {
    statementId: "AllowCloudFrontServicePrincipal",
    action: "lambda:InvokeFunctionUrl",
    principal: "cloudfront.amazonaws.com",
    sourceArn: distribution.arn,
    function: apiLambda.name,
  },
);

// stack output
export const CLOUD_FRONT_URL = pulumi.interpolate`https://${distribution.domainName}`;
