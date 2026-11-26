const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS = [
  "0001_schema.sql",
  "0002_rls.sql",
  "0003_push_subscriptions.sql",
  "0004_push_subscriptions_rls.sql",
  "0005_rls_hardening.sql",
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to Postgres");
  await client.query("CREATE SCHEMA IF NOT EXISTS public;");
  await client.query("GRANT ALL ON SCHEMA public TO postgres;");
  console.log("Ensured public schema (no broad PUBLIC grant)");
  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(path.join("supabase", "migrations", file), "utf8");
    await client.query(sql);
    console.log(`Applied ${file}`);
  }
  await client.end();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "jobpilot";
  if (url && key) {
    const response = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
    const body = await response.text();
    if (response.ok) console.log(`Created private storage bucket: ${bucket}`);
    else if (response.status === 409 || body.includes("already exists") || body.includes("Duplicate"))
      console.log(`Storage bucket already exists: ${bucket}`);
    else throw new Error(`Bucket creation failed: ${response.status}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
