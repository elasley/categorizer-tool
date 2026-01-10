/**
 * Classification Cache Utility with Embedding Similarity Search
 *
 * This module provides intelligent caching for product classifications:
 * 1. EXACT MATCH: First checks for exact hash matches (fastest)
 * 2. SIMILARITY SEARCH: Falls back to vector embedding similarity (≥85% threshold)
 * 3. AUTO-SAVE: Automatically caches new classifications with embeddings
 *
 * Benefits:
 * - Reuses classifications for identical products (exact match)
 * - Reuses classifications for similar products with different wording (semantic match)
 * - Tracks usage statistics for cache optimization
 * - Reduces AI API calls and improves response time
 */

import { supabase } from "../config/supabase";
import { generateEmbedding } from "./embeddingGenerator";

/**
 * Generate a simple hash for browser environment
 */
const simpleHash = async (text) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Fetch all categories from Supabase database
 * Returns in the same format as acesCategories for compatibility
 */
export const fetchDatabaseCategories = async () => {
  try {
    console.log("📦 Fetching categories from database...");

    const [categoriesRes, subcategoriesRes, parttypesRes] = await Promise.all([
      supabase.from("categories").select("id, name").order("name"),
      supabase
        .from("subcategories")
        .select("id, name, category_id")
        .order("name"),
      supabase
        .from("parttypes")
        .select("id, name, subcategory_id")
        .order("name"),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (subcategoriesRes.error) throw subcategoriesRes.error;
    if (parttypesRes.error) throw parttypesRes.error;

    const categories = categoriesRes.data || [];
    const subcategories = subcategoriesRes.data || [];
    const parttypes = parttypesRes.data || [];

    // Build category structure
    const categoryMap = {};

    categories.forEach((cat) => {
      categoryMap[cat.name] = {};
    });

    // Group subcategories by category
    const subcategoryGroups = {};
    subcategories.forEach((sub) => {
      const category = categories.find((c) => c.id === sub.category_id);
      if (category) {
        if (!subcategoryGroups[category.name]) {
          subcategoryGroups[category.name] = {};
        }
        subcategoryGroups[category.name][sub.name] = {
          id: sub.id,
          parttypes: [],
        };
      }
    });

    // Group parttypes by subcategory
    parttypes.forEach((pt) => {
      const subcategory = subcategories.find((s) => s.id === pt.subcategory_id);
      if (subcategory) {
        const category = categories.find(
          (c) => c.id === subcategory.category_id
        );
        if (category && subcategoryGroups[category.name]?.[subcategory.name]) {
          subcategoryGroups[category.name][subcategory.name].parttypes.push(
            pt.name
          );
        }
      }
    });

    // Convert to acesCategories format (just arrays of part types)
    Object.keys(subcategoryGroups).forEach((catName) => {
      categoryMap[catName] = {};
      Object.keys(subcategoryGroups[catName]).forEach((subName) => {
        categoryMap[catName][subName] =
          subcategoryGroups[catName][subName].parttypes;
      });
    });

    console.log(
      `✅ Fetched ${categories.length} categories, ${subcategories.length} subcategories, ${parttypes.length} part types`
    );
    return categoryMap;
  } catch (error) {
    console.error("❌ Error fetching database categories:", error);
    throw error;
  }
};

/**
 * Generate a unique hash for a product (for caching)
 */
export const generateProductHash = async (name, description) => {
  const text = `${(name || "").trim().toLowerCase()} ${(description || "")
    .trim()
    .toLowerCase()}`;
  return await simpleHash(text);
};

/**
 * Check if product classification exists in cache (with embedding similarity fallback)
 */
export const getCachedClassification = async (
  productName,
  productDescription
) => {
  try {
    const SIMILARITY_THRESHOLD = 0.85; // 85% similarity for cache hit
    const hash = await generateProductHash(productName, productDescription);

    // Step 1: Try exact hash match first
    const { data, error } = await supabase
      .from("product_classifications")
      .select("*")
      .eq("product_hash", hash)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No exact match found, try similarity search
        console.log(
          `🔍 No exact match for "${productName}", trying similarity search...`
        );

        // Generate embedding and search for similar products
        const text = `${productName || ""} ${productDescription || ""}`.trim();
        const embeddingArray = await generateEmbedding(text);

        const { data: similarMatches, error: simError } = await supabase.rpc(
          "match_product_classifications",
          {
            query_embedding: embeddingArray,
            match_threshold: SIMILARITY_THRESHOLD,
            match_count: 1,
          }
        );

        if (simError) {
          console.warn("⚠️ Similarity search error:", simError.message);
          return null;
        }

        if (similarMatches && similarMatches.length > 0) {
          const match = similarMatches[0];
          const similarity = match.similarity || 0;

          if (similarity >= SIMILARITY_THRESHOLD) {
            console.log(
              `♻️ Found similar product: "${productName}" ↔ "${
                match.product_name
              }" (${(similarity * 100).toFixed(1)}%)`
            );

            // Update usage stats
            await supabase
              .from("product_classifications")
              .update({
                usage_count: match.usage_count + 1,
                last_used_at: new Date().toISOString(),
              })
              .eq("id", match.id);

            return {
              category: match.suggested_category,
              subcategory: match.suggested_subcategory,
              partType: match.suggested_parttype,
              confidence: match.confidence,
              validationReason: `Cached (${(similarity * 100).toFixed(
                0
              )}% similar to "${match.product_name}"): ${
                match.validation_reason
              }`,
              cached: true,
              matchType: "similar",
              similarity: Math.round(similarity * 100),
            };
          }
        }

        return null;
      }
      throw error;
    }

    // Exact match found
    // Update usage stats
    await supabase
      .from("product_classifications")
      .update({
        usage_count: data.usage_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return {
      category: data.suggested_category,
      subcategory: data.suggested_subcategory,
      partType: data.suggested_parttype,
      confidence: data.confidence,
      validationReason: `Cached (exact): ${data.validation_reason}`,
      cached: true,
      matchType: "exact",
    };
  } catch (error) {
    console.error("❌ Error checking cache:", error);
    return null;
  }
};

/**
 * Save classification result to cache with embedding
 */
export const saveClassificationToCache = async (product, classification) => {
  try {
    const hash = await generateProductHash(product.name, product.description);

    // Generate embedding for the product
    const text = `${product.name || ""} ${product.description || ""}`.trim();
    const embeddingArray = await generateEmbedding(text);
    const embeddingStr = `[${embeddingArray.join(",")}]`;

    const classificationData = {
      product_name: product.name || "",
      product_description: product.description || "",
      product_hash: hash,
      suggested_category: classification.suggestedCategory || "",
      suggested_subcategory: classification.suggestedSubcategory || "",
      suggested_parttype: classification.suggestedPartType || "",
      confidence: classification.confidence || 0,
      validation_reason: classification.validationReason || "AI classification",
      embedding: embeddingStr,
    };

    // Upsert (insert or update if exists)
    const { error } = await supabase
      .from("product_classifications")
      .upsert(classificationData, {
        onConflict: "product_hash",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("Error saving to cache:", error);
      // Don't throw - caching failure shouldn't stop the process
    } else {
      console.log(`✅ Cached classification for: ${product.name}`);
    }
  } catch (error) {
    console.error("Error in saveClassificationToCache:", error);
    // Don't throw - caching is optional
  }
};

/**
 * Batch check for cached classifications using embedding similarity
 */
/**
 * Get cached classifications for products using EXACT hash match only
 * Used by OpenAI Auto-Suggest to check if products were already classified
 * Does NOT perform similarity search - only exact matches
 *
 * @param {Array} products - Products to check cache for
 * @returns {Map} Map of product_hash -> classification data
 */
export const batchGetCachedClassifications = async (products) => {
  try {
    const cacheMap = new Map();
    const foundProductHashes = new Set();

    console.log(
      `📦 Checking cache for ${products.length} products (EXACT match only)...`
    );

    // Validate input
    if (!products || products.length === 0) {
      console.log(`ℹ️  No products to check cache for`);
      return cacheMap;
    }

    // ONLY try exact hash matches - no similarity search
    const hashes = await Promise.all(
      products.map((p) =>
        generateProductHash(p.name || "", p.description || "")
      )
    );

    // ✅ FIX: Split hashes into chunks to avoid URL length limits (max ~500 hashes per request)
    const CHUNK_SIZE = 500;
    const hashChunks = [];
    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
      hashChunks.push(hashes.slice(i, i + CHUNK_SIZE));
    }

    console.log(`📦 Split ${hashes.length} hashes into ${hashChunks.length} chunks`);

    // Process each chunk
    const allExactMatches = [];
    for (let i = 0; i < hashChunks.length; i++) {
      const chunk = hashChunks[i];
      console.log(`📦 Processing chunk ${i + 1}/${hashChunks.length} (${chunk.length} hashes)...`);
      
      const { data: chunkMatches, error: chunkError } = await supabase
        .from("product_classifications")
        .select("*")
        .in("product_hash", chunk);

      if (chunkError) {
        console.warn(`⚠️ Error in chunk ${i + 1} hash lookup:`, chunkError);
        continue; // Skip this chunk, continue with others
      }

      if (chunkMatches && chunkMatches.length > 0) {
        allExactMatches.push(...chunkMatches);
      }
    }

    const exactMatches = allExactMatches;
    console.log(`✅ Found ${exactMatches.length} cached classifications across all chunks`);

    // Store exact matches
    if (exactMatches && exactMatches.length > 0) {
      exactMatches.forEach((item, index) => {
        // Validate item structure
        if (!item || typeof item !== "object" || !item.product_hash) {
          console.warn(`⚠️ Invalid cache item at index ${index}:`, item);
          return;
        }

        foundProductHashes.add(item.product_hash);

        // Only add to cache if we have valid category data
        if (item.suggested_category && item.suggested_category.trim() !== "") {
          const cacheEntry = {
            category: item.suggested_category || "",
            subcategory: item.suggested_subcategory || "",
            partType: item.suggested_parttype || "",
            confidence: Number(item.confidence) || 0,
            validationReason: `Cached (exact): ${
              item.validation_reason || "N/A"
            }`,
            cached: true,
            matchType: "exact",
          };

          cacheMap.set(item.product_hash, cacheEntry);
          console.log(
            `✅ Cached: "${item.product_name}" -> ${cacheEntry.category}/${cacheEntry.subcategory}`
          );
        } else {
          console.warn(
            `⚠️ Skipping cache entry with NULL/empty category for: ${item.product_name}`
          );
          foundProductHashes.delete(item.product_hash);
        }
      });

      console.log(`✅ Found ${exactMatches.length} exact cache matches`);
    } else {
      console.log(`ℹ️  No exact cache matches found`);
    }

    // OpenAI Auto-Suggest uses EXACT match only - no similarity search
    // Similarity search is handled by Vector Categorization (edge function)
    console.log(
      `🎯 OpenAI cache strategy: EXACT match only (no similarity search)`
    );

    // Update usage stats for exact matches only
    if (foundProductHashes.size > 0) {
      const allFoundHashes = Array.from(foundProductHashes);
      const { data: itemsToUpdate } = await supabase
        .from("product_classifications")
        .select("id, product_hash")
        .in("product_hash", allFoundHashes);

      if (itemsToUpdate && itemsToUpdate.length > 0) {
        // Get full records to access current usage_count
        const { data: fullRecords } = await supabase
          .from("product_classifications")
          .select("id, usage_count")
          .in(
            "id",
            itemsToUpdate.map((d) => d.id)
          );

        if (fullRecords) {
          // Update each record with incremented count
          for (const record of fullRecords) {
            await supabase
              .from("product_classifications")
              .update({
                usage_count: record.usage_count + 1,
                last_used_at: new Date().toISOString(),
              })
              .eq("id", record.id);
          }
        }
      }
    }

    const exactCount = foundProductHashes.size;
    const totalCached = foundProductHashes.size;

    console.log(
      `📊 Cache results: ${totalCached} exact matches out of ${products.length} products`
    );

    return cacheMap;
  } catch (error) {
    console.error("❌ Error in batchGetCachedClassifications:", error);
    return new Map();
  }
};

/**
 * Batch save classifications to cache
 */
export const batchSaveClassificationsToCache = async (
  productsWithClassifications
) => {
  try {
    // Generate embeddings and prepare data
    const classificationData = [];

    for (const item of productsWithClassifications) {
      const hash = await generateProductHash(item.name, item.description);
      const text = `${item.name || ""} ${item.description || ""}`.trim();

      try {
        const embeddingArray = await generateEmbedding(text);
        const embeddingStr = `[${embeddingArray.join(",")}]`;

        classificationData.push({
          product_name: item.name || "",
          product_description: item.description || "",
          product_hash: hash,
          suggested_category: item.suggestedCategory || "",
          suggested_subcategory: item.suggestedSubcategory || "",
          suggested_parttype: item.suggestedPartType || "",
          confidence: item.confidence || 0,
          validation_reason: item.validationReason || "AI classification",
          embedding: embeddingStr,
        });
      } catch (embError) {
        console.error(
          `Failed to generate embedding for: ${item.name}`,
          embError
        );
        // Skip this item
      }
    }

    if (classificationData.length === 0) {
      console.log("⚠️ No valid classifications to cache");
      return;
    }

    // Batch upsert
    const { error } = await supabase
      .from("product_classifications")
      .upsert(classificationData, {
        onConflict: "product_hash",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("Error batch saving to cache:", error);
    } else {
      console.log(`✅ Cached ${classificationData.length} classifications`);
    }
  } catch (error) {
    console.error("Error in batchSaveClassificationsToCache:", error);
  }
};
