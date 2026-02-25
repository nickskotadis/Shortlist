/**
 * Run once to verify Supabase connection and schema.
 * Usage: npx tsx supabase/verify.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function verify() {
  const tables = ["profiles", "job_applications", "generations"];
  let allGood = true;

  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(0);
    if (error) {
      console.error(`✗ ${table}: ${error.message}`);
      allGood = false;
    } else {
      console.log(`✓ ${table}`);
    }
  }

  if (allGood) {
    console.log("\nSupabase connection verified. Schema is ready.");
  } else {
    console.log("\nSome tables are missing — make sure you ran schema.sql in the SQL Editor.");
    process.exit(1);
  }
}

verify();
