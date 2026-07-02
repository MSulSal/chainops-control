import { randomUUID } from "node:crypto";
import { newDb } from "pg-mem";
import { runSeededDemoSmokeTest } from "../src/demo-smoke.ts";
import { createApp } from "../src/server.ts";
import { PostgresAuditStore } from "../src/store.ts";

async function main() {
  const schema = `smoke_${randomUUID().replaceAll("-", "_")}`;
  const db = newDb();
  const pgAdapter = db.adapters.createPg();
  const pool = new pgAdapter.Pool();
  const store = new PostgresAuditStore({ pool, schema });
  const app = createApp(store);

  await store.init();

  await new Promise<void>((resolve) => app.listen(0, resolve));

  try {
    const address = app.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to bind smoke-test server");
    }

    const result = await runSeededDemoSmokeTest(`http://127.0.0.1:${address.port}`);
    console.log(
      `demo smoke passed: ${result.scenario} | failed case ${result.failedCaseId} | traces ${result.traceIds.join(", ")}`
    );
  } finally {
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
