// Quick test to check if embeddings are actually in the database
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://ckyqtxfojawclxkejbcr.supabase.co";
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "YOUR_KEY_HERE";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEmbeddings() {
  console.log("\n🔍 Testing Database Embeddings...\n");

  // Check categories
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, name, embedding")
    .limit(3);

  if (catError) {
    console.error("❌ Error fetching categories:", catError);
    return;
  }

  console.log(`📁 Found ${categories.length} categories`);
  categories.forEach((cat, idx) => {
    console.log(`\n${idx + 1}. Category: ${cat.name}`);
    console.log(`   Embedding type: ${typeof cat.embedding}`);
    console.log(`   Is array: ${Array.isArray(cat.embedding)}`);
    console.log(`   Is null: ${cat.embedding === null}`);
    if (cat.embedding) {
      if (Array.isArray(cat.embedding)) {
        console.log(`   Length: ${cat.embedding.length}`);
        const nonZero = cat.embedding.filter((v) => v !== 0).length;
        console.log(`   Non-zero values: ${nonZero}`);
        console.log(
          `   First 5 values: [${cat.embedding.slice(0, 5).join(", ")}]`
        );
      } else if (typeof cat.embedding === "string") {
        console.log(`   ⚠️  PROBLEM: Embedding is a string! First 100 chars:`);
        console.log(`   "${cat.embedding.substring(0, 100)}"`);
      } else {
        console.log(`   ⚠️  PROBLEM: Unexpected type!`);
        console.log(`   Value:`, cat.embedding);
      }
    } else {
      console.log(`   ❌ Embedding is NULL or undefined!`);
    }
  });
}

testEmbeddings();
