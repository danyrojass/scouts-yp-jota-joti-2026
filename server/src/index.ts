import { createApp } from "@/app";
import { env } from "@/config/env";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API de Exploracion de Ypacarai escuchando en http://localhost:${env.PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);