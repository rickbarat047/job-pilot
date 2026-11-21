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
  console.log("Connected to Postgres");

  // Do NOT drop the schema. Preserve existing tables and records.
  await client.query("CREATE SCHEMA IF NOT EXISTS public;");
  await client.query("GRANT ALL ON SCHEMA public TO postgres;");
  await client.query("GRANT ALL ON SCHEMA public TO public;");
  console.log("Ensured public schema (non-destructive)");

  for (const file of ["0001_schema.sql", "0002_rls.sql"]) {
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
