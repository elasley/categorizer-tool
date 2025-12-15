#!/usr/bin/env node
/**
 * Batch Embedding Generation Script
 * Regenerates all taxonomy embeddings using MiniLM-v2 model
 * Run: node scripts/generate-taxonomy-embeddings.js
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  generateCategoryEmbedding,
  generateSubcategoryEmbedding,
  generatePartTypeEmbedding,
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
 * Generate embeddings for all categories
 */
async function generateCategoryEmbeddings() {
  console.log("\n📦 Generating category embeddings...");

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  console.log(`Found ${categories.length} categories`);

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];

    if (i % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${categories.length}`);
    }

    const embedding = await generateCategoryEmbedding(category.name);

    const { error: updateError } = await supabase
      .from("categories")
      .update({ embedding })
      .eq("id", category.id);

    if (updateError) {
      console.error(
        `❌ Failed to update category "${category.name}":`,
        updateError.message
      );
    }
  }

  console.log(`✅ Generated embeddings for ${categories.length} categories`);
}

/**
 * Generate embeddings for all subcategories
 */
async function generateSubcategoryEmbeddings() {
  console.log("\n📦 Generating subcategory embeddings...");

  const { data: subcategories, error } = await supabase
    .from("subcategories")
    .select("id, name, category_id")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch subcategories: ${error.message}`);
  }

  console.log(`Found ${subcategories.length} subcategories`);

  for (let i = 0; i < subcategories.length; i++) {
    const subcategory = subcategories[i];

    if (i % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${subcategories.length}`);
    }

    const embedding = await generateSubcategoryEmbedding(subcategory.name);

    const { error: updateError } = await supabase
      .from("subcategories")
      .update({ embedding })
      .eq("id", subcategory.id);

    if (updateError) {
      console.error(
        `❌ Failed to update subcategory "${subcategory.name}":`,
        updateError.message
      );
    }
  }

  console.log(
    `✅ Generated embeddings for ${subcategories.length} subcategories`
  );
}

/**
 * Generate embeddings for all part types
 */
async function generatePartTypeEmbeddings() {
  console.log("\n📦 Generating part type embeddings...");

  const { data: parttypes, error } = await supabase
    .from("parttypes")
    .select("id, name, subcategory_id")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch part types: ${error.message}`);
  }

  console.log(`Found ${parttypes.length} part types`);

  for (let i = 0; i < parttypes.length; i++) {
    const parttype = parttypes[i];

    if (i % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${parttypes.length}`);
    }

    const embedding = await generatePartTypeEmbedding(parttype.name);

    const { error: updateError } = await supabase
      .from("parttypes")
      .update({ embedding })
      .eq("id", parttype.id);

    if (updateError) {
      console.error(
        `❌ Failed to update part type "${parttype.name}":`,
        updateError.message
      );
    }
  }

  console.log(`✅ Generated embeddings for ${parttypes.length} part types`);
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Starting taxonomy embedding generation with MiniLM-v2");
  console.log("Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)");

  try {
    // Preload model once at startup
    await preloadModel();

    // Generate embeddings for all taxonomy levels
    await generateCategoryEmbeddings();
    await generateSubcategoryEmbeddings();
    await generatePartTypeEmbeddings();

    console.log("\n✅ All taxonomy embeddings generated successfully!");
    console.log(
      "Next step: Use these embeddings for semantic product categorization"
    );
  } catch (error) {
    console.error("\n❌ Error during embedding generation:", error);
    process.exit(1);
  }
}

main();
