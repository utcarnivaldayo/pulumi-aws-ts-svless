import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { Client } from 'pg';

const REGION = process.env.REGION || "ap-northeast-1";
const PG_USER = process.env.PG_USER || 'admin';
const PG_HOST = process.env.PG_HOST || '';
const PG_PORT = Number(process.env.PG_PORT || 5432);
const PG_DATABASE = process.env.PG_DATABASE || 'postgres';
const PG_TOKEN_EXPIRE_SECONDS = Number(process.env.PG_TOKEN_EXPIRE_SECONDS || 30); // 30 seconds

const generateToken = async () => {
  const signer = new DsqlSigner({
    hostname: PG_HOST,
    region: REGION,
    expiresIn: PG_TOKEN_EXPIRE_SECONDS,
  });
  try {
    const token = await signer.getDbConnectAuthToken();
    return token;
  } catch (error) {
    console.error('Failed to generate token: ', error);
    throw error;
  }
};

export const createDsqlClient = async () => {
  const token = await generateToken();
  const client = new Client({
    host: PG_HOST,
    user: PG_USER,
    password: token,
    database: PG_DATABASE,
    port: PG_PORT,
    ssl: true,
  });

  try {
    await client.connect();
    console.log('Connected to DSQL cluster successfully');
    return client;
  } catch (error) {
    console.error('Failed to connect to DSQL cluster: ', error);
    throw error;
  }
};
