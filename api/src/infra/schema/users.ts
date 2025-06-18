import { pgSchema, integer, char } from 'drizzle-orm/pg-core';

// NOTE: lambda ユーザーのために api スキーマを指定
export const apiSchema = pgSchema('api');
export const users = apiSchema.table(
  'users',
  {
    id: integer("id").primaryKey(),
    name: char('name', { length: 24 }).notNull(),
  },
);
