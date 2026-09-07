import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminPool } from "./client.js";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

async function listMigrationFiles(): Promise<string[]> {
  const files = await readdir(migrationsDir);
  return files.filter((f) => f.endsWith(".sql")).sort();
}

/** Apply all pending migrations in filename order, each in its own transaction. */
export async function migrate(): Promise<void> {
  const client = await getAdminPool().connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )`);

    const files = await listMigrationFiles();
    let applied = 0;
    for (const file of files) {
      const seen = await client.query(
        "select 1 from schema_migrations where filename = $1",
        [file],
      );
      if (seen.rowCount) {
        console.log(`  skip   ${file}`);
        continue;
      }
      const sql = await readFile(join(migrationsDir, file), "utf8");
      console.log(`  apply  ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into schema_migrations(filename) values ($1)",
          [file],
        );
        await client.query("commit");
        applied += 1;
      } catch (err) {
        await client.query("rollback");
        throw new Error(
          `Migration ${file} failed: ${(err as Error).message}`,
        );
      }
    }
    console.log(
      applied === 0
        ? "Database already up to date."
        : `Applied ${applied} migration(s).`,
    );
  } finally {
    client.release();
  }
}

/** Print which migrations are applied vs pending. */
export async function migrationStatus(): Promise<void> {
  const client = await getAdminPool().connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )`);
    const [{ rows: appliedRows }, files] = await Promise.all([
      client.query<{ filename: string }>(
        "select filename from schema_migrations",
      ),
      listMigrationFiles(),
    ]);
    const appliedSet = new Set(appliedRows.map((r) => r.filename));
    for (const file of files) {
      console.log(`${appliedSet.has(file) ? "[x]" : "[ ]"} ${file}`);
    }
  } finally {
    client.release();
  }
}
