import { Hono } from "hono";
import { users } from "../infra/schema/users";
import { createDsqlClient  } from "../infra/dsql";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from "drizzle-orm";

export const usersRouter = new Hono();

usersRouter.get("/all", async (c) => {
  let client;
  try {
    client = await createDsqlClient();
    const db = drizzle(client, { schema: { users } });
    const allUser = await db.select().from(users);
    return c.json(allUser);
  }
  catch (error) {
    return c.json({ error: "Failed to connect to the database" }, 500);
  } finally {
    client?.end();
  }
});


usersRouter.post('/new',  async (c) => {
  let client;
  try {
    // リクエストボディからデータを取得
    const { id, name } = await c.req.json();
    // データの検証
    if (!id || name === undefined) {
      return c.json({ error: '必須パラメータが不足しています' }, 400);
    }

    // データベースに登録
    client = await createDsqlClient();
    const db = drizzle(client, { schema: { users } });
    const result = await db.insert(users).values({ id, name }).returning();

    // 成功レスポンス
    return c.json(result, 200);
  } catch (error) {
    console.error('Error registering data:', error);
    return c.json({ error: 'An error occurred while registering data' }, 500);
  } finally {
    client?.end();
  }
});


usersRouter.post('/update/:id', async (c) => {
  let client;
  try {
    // パスパラメータからIDを取得
    const idParam = c.req.param('id');
    if (!idParam) {
      return c.json({ error: 'IDが必要です' }, 400);
    }

    // Convert string ID to number
    const id = Number(idParam);

    // リクエストボディから新しい値を取得
    const { name } = await c.req.json();
    if (name === undefined) {
      return c.json({ error: '更新する値が必要です' }, 400);
    }

    // データベースの更新
    client = await createDsqlClient();
    const db = drizzle(client, { schema: { users } });
    const result = await db.update(users).set({ name }).where(eq(users.id, id)).returning();

    // 成功レスポンス
    return c.json(result, 200);
  } catch (error) {
    console.error('Error updating data:', error);
    return c.json({ error: 'An error occurred while updating data' }, 500);
  } finally {
    client?.end();
  }
});
