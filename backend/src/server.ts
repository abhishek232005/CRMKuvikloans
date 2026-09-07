import { app } from "./app";
import { AppDataSource } from "./config/data-source";
import { env } from "./config/env";
async function start() {
  await AppDataSource.initialize();
  const server = app.listen(env.PORT, () =>
    console.log(`Kuvik CRM API listening on port ${env.PORT}`),
  );
  const shutdown = async () => {
    server.close();
    await AppDataSource.destroy();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
start().catch((error: unknown) => {
  console.error("Unable to start API", error);
  process.exit(1);
});
