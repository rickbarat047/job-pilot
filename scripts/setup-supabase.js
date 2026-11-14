const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    console.log("Connected to Postgres");

    const migrationTable = await client.query("SELECT to_regclass('public.jobpilot_schema_migrations') AS name");
    if (!migrationTable.rows[0]?.name) {
      const existingTables = await client.query(
        "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      );
      if (Number(existingTables.rows[0]?.count ?? 0) > 0) {
        throw new Error("Refusing to initialize a populated database without JobPilot migration history. No changes were made; use the reviewed migrations for that database.");
      }
    }

    await client.query(`CREATE TABLE IF NOT EXISTS public.jobpilot_schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    for (const file of ["0001_schema.sql", "0002_rls.sql"]) {
      const applied = await client.query("SELECT 1 FROM public.jobpilot_schema_migrations WHERE name=$1", [file]);
      if (applied.rowCount) {
        console.log(`Already applied: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join("supabase", "migrations", file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public.jobpilot_schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "jobpilot";
  if (url && key) {
    const response = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
    const body = await response.text();
    if (response.ok) {
      console.log(`Created storage bucket: ${bucket}`);
    } else if (response.status === 409 || body.includes("already exists") || body.includes("Duplicate")) {
      console.log(`Storage bucket already exists: ${bucket}`);
    } else {
      throw new Error(`Bucket creation failed: ${response.status} ${body}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
