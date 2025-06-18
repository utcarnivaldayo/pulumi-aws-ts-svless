import * as pulumi from "@pulumi/pulumi";
import * as native from "@pulumi/aws-native";
import * as aws from "@pulumi/aws";
import { NAME_PREFIX, createNativeTags } from "../../utils";

const dsqlClusterId = `${NAME_PREFIX}-aurora-dsql-cluster`;
const dsqlCluster = new native.dsql.Cluster(dsqlClusterId, {
  deletionProtectionEnabled: false, // 開発環境向け
  tags: createNativeTags(dsqlClusterId),
});

export const dsqlAccessPolicy = new aws.iam.Policy(
  `${dsqlClusterId}-access-policy`,
  {
    description: "Policy for Lambda to access Aurora DSQL",
    policy: dsqlCluster.resourceArn.apply((arn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: [
              "dsql:DbConnect"
            ],
            Effect: "Allow",
            Resource: [arn],
          },
        ],
      }),
    ),
  },
);

export const DSQL_CLUSTER_ENDPOINT = dsqlCluster.id.apply((id) => {
  const awsConfig = new pulumi.Config("aws");
  const region = awsConfig.require("region");
  return `${id}.dsql.${region}.on.aws`;
});

export const DSQL_CLUSTER_STATUS = dsqlCluster.status;
