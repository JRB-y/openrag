import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = await buildApp();

await app.listen({ port: PORT, host: "0.0.0.0" });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
