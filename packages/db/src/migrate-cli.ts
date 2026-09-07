import { config } from "dotenv";
import { join } from "node:path";
import { migrate, migrationStatus } from "./migrate.js";
import { closePools } from "./client.js";

// Load env from the repo root (../../.env) then from cwd, without overriding
// values already present in the environment (e.g. inside Docker).
config({ path: join(process.cwd(), "..", "..", ".env") });
config();

const command = process.argv[2] ?? "up";

async function main(): Promise<void> {
  if (command === "status") {
    await migrationStatus();
  } else if (command === "up") {
    await migrate();
  } else {
    console.error(`Unknown command: ${command}. Use "up" or "status".`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    void closePools();
  });
