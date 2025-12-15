#!/usr/bin/env node
/**
 * Generate Product Embeddings Script
 * Generates MiniLM-v2 embeddings for products before categorization
 * Run: node scripts/generate-product-embeddings.js
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  generateProductEmbedding,
  preloadModel,
} from "../utils/miniLmEmbeddings.mjs";

dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate embeddings for all products
 * @param {number} batchSize - Number of products to process at once
 */
async function generateProductEmbeddings(batchSize = 100) {
  console.log("\n📦 Generating product embeddings...");

  // Get total count
  const { count, error: countError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Failed to count products: ${countError.message}`);
  }

  console.log(`Found ${count} products total`);

  let processed = 0;
  let offset = 0;

  while (offset < count) {
    console.log(
      `\n📊 Fetching products ${offset + 1} to ${Math.min(
        offset + batchSize,
        count
      )}...`
    );

    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description")
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    console.log(`Processing ${products.length} products...`);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      if (i % 10 === 0 && i > 0) {
        console.log(`  Progress in batch: ${i}/${products.length}`);
      }

      try {
        const embedding = await generateProductEmbedding(
          product.name || "",
          product.description || ""
        );

        const { error: updateError } = await supabase
          .from("products")
          .update({ embedding })
          .eq("id", product.id);

        if (updateError) {
          console.error(
            `❌ Failed to update product "${product.name}":`,
            updateError.message
          );
        } else {
          processed++;
        }
      } catch (embedError) {
        console.error(
          `❌ Error generating embedding for "${product.name}":`,
          embedError.message
        );
      }
    }

    offset += batchSize;
    console.log(`✅ Processed ${processed}/${count} products so far`);
  }

  console.log(`\n✅ Generated embeddings for ${processed} products`);
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Starting product embedding generation with MiniLM-v2");
  console.log("Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)");

  try {
    // Preload model once at startup
    await preloadModel();

    // Generate embeddings for all products
    await generateProductEmbeddings();

    console.log("\n✅ All product embeddings generated successfully!");
    console.log("Products are now ready for semantic categorization");
  } catch (error) {
    console.error("\n❌ Error during embedding generation:", error);
    process.exit(1);
  }
}

main();
