import * as pulumi from "@pulumi/pulumi";

export enum Environment {
  Production = "prod",
  Staging = "stg",
  QualityAssessment = "qa",
  Development = "dev",
}

export const getEnvironment = (): string => {
  const stack: string = pulumi.getStack();

  switch (stack) {
    case Environment.Production.toString():
      return Environment.Production.toString();
    case Environment.Staging.toString():
      return Environment.Staging.toString();
    case Environment.QualityAssessment.toString():
      return Environment.QualityAssessment.toString();
    default:
      return Environment.Development.toString();
  }
};

// @pulumi/aws のタグ形式でタグを作成
export const createTags = (name: string) => {
  return {
    Name: name,
    Project: pulumi.getProject(),
    Stack: pulumi.getStack(),
    Environment: getEnvironment(),
    ManagedBy: "pulumi",
  };
};

// @puliumi/aws-native のタグ形式でタグを作成
export const createNativeTags = (name: string) => {
  return [
    { key: "Name", value: name },
    { key: "Project", value: pulumi.getProject() },
    { key: "Stack", value: pulumi.getStack() },
    { key: "Environment", value: getEnvironment() },
    { key: "ManagedBy", value: "pulumi" },
  ];
};

export const getAwsAccountId = (): string => {
  const config = new pulumi.Config("stack");
  const accountId = config.require("aws-account-id");
  return accountId;
};

export const getAwsRegion = (): string => {
  const config = new pulumi.Config("aws");
  const region = config.require("region");
  return region;
};

export const selfStack = new pulumi.StackReference(
  `organization/${pulumi.getProject()}/${pulumi.getStack()}`,
);

export const jstDate = (date: Date): string => {
  const utcDateString: string = date.toISOString();

  // UTC形式の日時文字列からUTCのDateオブジェクトを生成
  const utcDate: Date = new Date(utcDateString);

  // JST（日本標準時）のオフセットを計算（9時間 * 60分）
  const jstOffset = 9 * 60;

  // UTCのDateオブジェクトにオフセットを加算してJSTのDateオブジェクトを生成
  const jstDate: Date = new Date(utcDate.getTime() + jstOffset * 60000);

  // JSTのDateオブジェクトをISO 8601形式の文字列に変換
  const jstDateString: string = jstDate.toISOString();

  // JST形式の日時文字列を返す
  return jstDateString;
};

export const NAME_PREFIX: string = `${pulumi.getStack()}-${pulumi.getProject()}`;
