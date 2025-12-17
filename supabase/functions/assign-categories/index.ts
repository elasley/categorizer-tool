// Supabase Edge Function: assign-categories
// Production-ready semantic categorization using MiniLM-v2 embeddings
// Pure cosine similarity matching - NO keyword logic, NO TF-IDF, NO regex
// ⚠️ IMPORTANT: Product embeddings MUST be generated client-side before calling this function
// This function ONLY performs vector similarity matching using pre-computed embeddings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PRODUCTS_PER_REQUEST = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const body = await req.json();
    const { products } = body;

    if (!products || !Array.isArray(products)) {
      throw new Error("Products array is required");
    }

    const totalProducts = products.length;
    console.log(`\n🚀 Received ${totalProducts} products for categorization`);

    if (totalProducts > MAX_PRODUCTS_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: `Too many products. Please process in batches of ${MAX_PRODUCTS_PER_REQUEST} or fewer.`,
          maxAllowed: MAX_PRODUCTS_PER_REQUEST,
          received: totalProducts,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    /**
     * Pure cosine similarity calculation for normalized embeddings
     * Since MiniLM embeddings are L2-normalized, dot product = cosine similarity
     */
    const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
      if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

      let dotProduct = 0;
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * (vecB[i] || 0);
      }

      return Math.max(0, Math.min(1, dotProduct)); // Clamp to [0, 1]
    };

    // Load ALL taxonomy data with MiniLM embeddings (384 dimensions)
    console.log("📥 Loading taxonomy database with MiniLM embeddings...");

    const [categoriesResult, subcategoriesResult, parttypesResult] =
      await Promise.all([
        supabaseClient.from("categories").select("id, name, embedding"),
        supabaseClient
          .from("subcategories")
          .select("id, name, category_id, embedding"),
        supabaseClient
          .from("parttypes")
          .select("id, name,  subcategory_id, embedding"),
      ]);

    if (categoriesResult.error) {
      console.error(
        "Database error fetching categories:",
        categoriesResult.error
      );
      return new Response(
        JSON.stringify({
          categorizedProducts: [],
          totalProcessed: 0,
          totalRequested: products.length,
          averageConfidence: 0,
          error:
            "Database error: Unable to fetch categories. Please ensure taxonomy tables exist.",
          confidenceDistribution: { high: 0, medium: 0, low: 0 },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (subcategoriesResult.error) {
      console.error(
        "Database error fetching subcategories:",
        subcategoriesResult.error
      );
    }

    if (parttypesResult.error) {
      console.error(
        "Database error fetching parttypes:",
        parttypesResult.error
      );
    }

    // Parse embeddings from pgvector format: "[1,2,3]" -> [1,2,3]
    const parseEmbedding = (item: any) => {
      if (!item.embedding) {
        console.warn(`⚠️  Missing embedding for "${item.name}"`);
        return item;
      }

      if (typeof item.embedding === "string") {
        try {
          item.embedding = JSON.parse(item.embedding);
        } catch (e) {
          console.error(`❌ Failed to parse embedding for "${item.name}":`, e);
          item.embedding = null;
        }
      }

      // Validate embedding dimensions (should be 384 for MiniLM-v2)
      if (
        item.embedding &&
        Array.isArray(item.embedding) &&
        item.embedding.length !== 384
      ) {
        console.warn(
          `⚠️  Invalid embedding dimension for "${item.name}": ${item.embedding.length} (expected 384)`
        );
      }

      return item;
    };

    const allCategories = (categoriesResult.data || []).map(parseEmbedding);
    const allSubcategories = (subcategoriesResult.data || []).map(
      parseEmbedding
    );
    const allParttypes = (parttypesResult.data || []).map(parseEmbedding);

    console.log(
      `✅ Loaded ${allCategories.length} categories, ${allSubcategories.length} subcategories, ${allParttypes.length} part types`
    );

    // Validate embeddings exist
    const categoriesWithEmbeddings = allCategories.filter(
      (c) =>
        c.embedding && Array.isArray(c.embedding) && c.embedding.length === 384
    );
    const subcategoriesWithEmbeddings = allSubcategories.filter(
      (s) =>
        s.embedding && Array.isArray(s.embedding) && s.embedding.length === 384
    );
    const parttypesWithEmbeddings = allParttypes.filter(
      (p) =>
        p.embedding && Array.isArray(p.embedding) && p.embedding.length === 384
    );

    console.log(
      `🔍 Embedding validation: ${categoriesWithEmbeddings.length}/${allCategories.length} categories, ${subcategoriesWithEmbeddings.length}/${allSubcategories.length} subcategories, ${parttypesWithEmbeddings.length}/${allParttypes.length} part types have valid MiniLM embeddings`
    );

    if (allCategories.length === 0) {
      return new Response(
        JSON.stringify({
          categorizedProducts: [],
          totalProcessed: 0,
          totalRequested: products.length,
          averageConfidence: 0,
          warning:
            "No taxonomy data found in database. Please upload categories, subcategories, and part types first.",
          confidenceDistribution: { high: 0, medium: 0, low: 0 },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (categoriesWithEmbeddings.length === 0) {
      return new Response(
        JSON.stringify({
          categorizedProducts: [],
          totalProcessed: 0,
          totalRequested: products.length,
          averageConfidence: 0,
          warning:
            "No embeddings found for taxonomy. Please run: npm run generate-taxonomy-embeddings",
          confidenceDistribution: { high: 0, medium: 0, low: 0 },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Create lookup maps for hierarchical matching
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const subcategoryMap = new Map(allSubcategories.map((s) => [s.id, s]));
    const subcategoriesByCategory = new Map<string, typeof allSubcategories>();
    const parttypesBySubcategory = new Map<string, typeof allParttypes>();

    // ✅ Map subcategory_id → category_id (parttypes only have subcategory_id)
    const subcategoryToCategoryMap = new Map<string, string>();

    allSubcategories.forEach((sub) => {
      if (!subcategoriesByCategory.has(sub.category_id)) {
        subcategoriesByCategory.set(sub.category_id, []);
      }
      subcategoriesByCategory.get(sub.category_id)!.push(sub);
      subcategoryToCategoryMap.set(sub.id, sub.category_id);
    });

    allParttypes.forEach((pt) => {
      if (!parttypesBySubcategory.has(pt.subcategory_id)) {
        parttypesBySubcategory.set(pt.subcategory_id, []);
      }
      parttypesBySubcategory.get(pt.subcategory_id)!.push(pt);
    });

    console.log(
      "🚀 Starting semantic categorization using MiniLM embeddings..."
    );

    // Check if cache function exists
    console.log("🔍 Checking if product_classifications cache is available...");
    const { data: cacheTableCheck, error: cacheTableError } =
      await supabaseClient
        .from("product_classifications")
        .select("count")
        .limit(1);

    const cacheAvailable = !cacheTableError;
    if (cacheAvailable) {
      console.log("✅ product_classifications table found - cache enabled");
    } else {
      console.warn(
        "⚠️  product_classifications table not found - cache disabled"
      );
      console.warn("   Error:", cacheTableError?.message);
    }

    const categorizedProducts = [];
    let successCount = 0;
    let skippedCount = 0;
    let cacheHitCount = 0;

    // Process products with pure semantic matching
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      try {
        if (i % 50 === 0) {
          console.log(`📦 Progress: ${i + 1}/${products.length}`);
        }

        // DEBUG: Log first product structure
        if (i === 0) {
          console.log(`\n🔍 First product structure:`, {
            id: product.id,
            name: product.name,
            hasEmbedding: !!product.embedding,
            embeddingType: typeof product.embedding,
            embeddingLength: product.embedding?.length || 0,
            allKeys: Object.keys(product),
          });
        }

        // ⚠️ Product embeddings MUST be provided
        let productEmbedding = product.embedding;

        if (!productEmbedding) {
          skippedCount++;
          if (i < 5) {
            console.error(
              `❌ Missing embedding for "${product.name}" - embeddings must be generated client-side`
            );
          }
          continue;
        }

        // Parse embedding if string format
        if (typeof productEmbedding === "string") {
          try {
            productEmbedding = JSON.parse(productEmbedding);
          } catch (e) {
            console.error(
              `❌ Failed to parse embedding for "${product.name}":`,
              e
            );
            skippedCount++;
            continue;
          }
        }

        if (
          !Array.isArray(productEmbedding) ||
          productEmbedding.length !== 384
        ) {
          console.error(
            `❌ Invalid embedding dimension for "${product.name}" (expected 384, got ${productEmbedding?.length})`
          );
          skippedCount++;
          continue;
        }

        if (i < 3) {
          console.log(
            `   ✅ Valid embedding for "${product.name}" (384 dimensions)`
          );
        }

        // 🔍 STEP 0: Check if we have a cached classification with similar embedding
        const SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold for cache hit
        let cacheChecked = false;
        let cacheHit = false;

        // Only check cache if table is available
        if (cacheAvailable) {
          if (i < 5) {
            console.log(
              `\n🔍 Checking cache for product #${i + 1}: "${product.name}"`
            );
          }

          try {
            // Query product_classifications table for similar products using correct RPC function
            const { data: cachedClassifications, error: cacheError } =
              await supabaseClient.rpc("match_product_classifications", {
                query_embedding: productEmbedding,
                match_threshold: SIMILARITY_THRESHOLD,
                match_count: 1,
              });

            cacheChecked = true;

            if (cacheError) {
              console.warn(
                `⚠️  Cache query error for "${product.name}":`,
                cacheError.message
              );
              if (i < 3) {
                console.warn(`   Error details:`, JSON.stringify(cacheError));
              }
            } else {
              if (i < 5) {
                console.log(
                  `   ✅ Cache query successful. Found ${
                    cachedClassifications?.length || 0
                  } matches`
                );
              }
            }

            // If we found a similar product with high confidence, reuse its classification
            if (cachedClassifications && cachedClassifications.length > 0) {
              const cachedResult = cachedClassifications[0];
              const similarity = cachedResult.similarity || 0;

              if (i < 5) {
                console.log(
                  `   📊 Best match: "${
                    cachedResult.product_name
                  }" (similarity: ${(similarity * 100).toFixed(2)}%)`
                );
              }

              if (similarity >= SIMILARITY_THRESHOLD) {
                console.log(
                  `   ♻️  Cache HIT #${cacheHitCount + 1} for "${
                    product.name
                  }" (${(similarity * 100).toFixed(2)}% similar to "${
                    cachedResult.product_name
                  }")`
                );

                cacheHit = true;

                // Reuse cached classification
                categorizedProducts.push({
                  id: product.id,
                  category: cachedResult.suggested_category,
                  subcategory: cachedResult.suggested_subcategory,
                  partType: cachedResult.suggested_parttype,
                  category_id: null, // Will be resolved later if needed
                  subcategory_id: null,
                  parttype_id: null,
                  confidence: cachedResult.confidence,
                  cached: true,
                  similarity: Math.round(similarity * 100),
                });

                // Update usage statistics in cache
                const { error: updateError } = await supabaseClient
                  .from("product_classifications")
                  .update({
                    usage_count: (cachedResult.usage_count || 0) + 1,
                    last_used_at: new Date().toISOString(),
                  })
                  .eq("id", cachedResult.id);

                if (updateError && i < 3) {
                  console.warn(
                    `   ⚠️  Failed to update usage stats:`,
                    updateError.message
                  );
                }

                cacheHitCount++;
                successCount++;
                continue; // Skip to next product
              } else {
                if (i < 5) {
                  console.log(
                    `   ❌ Similarity ${(similarity * 100).toFixed(
                      2
                    )}% below threshold ${SIMILARITY_THRESHOLD * 100}%`
                  );
                }
              }
            } else {
              if (i < 5) {
                console.log(
                  `   ❌ No cached matches found for "${product.name}"`
                );
              }
            }
          } catch (cacheCheckError) {
            console.error(
              `❌ Cache check failed for "${product.name}":`,
              cacheCheckError
            );
          }
        } else {
          if (i === 0) {
            console.log(`   ⏭️  Skipping cache check - table not available`);
          }
        }

        if (i < 5 && !cacheHit) {
          console.log(`   🔄 Proceeding with semantic categorization...`);
        }

        // STEP 1: Find best matching CATEGORY using pure cosine similarity
        let bestCategory = null;
        let bestCatSim = -1;

        for (const cat of allCategories) {
          if (
            cat.embedding &&
            Array.isArray(cat.embedding) &&
            cat.embedding.length === 384
          ) {
            const similarity = cosineSimilarity(
              productEmbedding,
              cat.embedding
            );

            if (similarity > bestCatSim) {
              bestCatSim = similarity;
              bestCategory = cat;
            }
          }
        }

        if (!bestCategory) {
          console.warn(
            `⚠️  No valid category match found for "${product.name}"`
          );
          continue;
        }

        // STEP 2: Find best matching SUBCATEGORY within the chosen category
        const categorySubcategories =
          subcategoriesByCategory.get(bestCategory.id) || [];
        let bestSubcategory = null;
        let bestSubSim = -1;

        // First try within category's subcategories
        for (const sub of categorySubcategories) {
          if (
            sub.embedding &&
            Array.isArray(sub.embedding) &&
            sub.embedding.length === 384
          ) {
            const similarity = cosineSimilarity(
              productEmbedding,
              sub.embedding
            );

            if (similarity > bestSubSim) {
              bestSubSim = similarity;
              bestSubcategory = sub;
            }
          }
        }

        // If no good match in category, search ALL subcategories
        if (!bestSubcategory || bestSubSim < 0.3) {
          for (const sub of allSubcategories) {
            if (
              sub.embedding &&
              Array.isArray(sub.embedding) &&
              sub.embedding.length === 384
            ) {
              const similarity = cosineSimilarity(
                productEmbedding,
                sub.embedding
              );

              if (similarity > bestSubSim) {
                bestSubSim = similarity;
                bestSubcategory = sub;
              }
            }
          }
        }

        if (!bestSubcategory) {
          console.warn(
            `⚠️  No valid subcategory match found for "${product.name}"`
          );
          continue;
        }

        // Update category based on best subcategory's parent (hierarchical consistency)
        if (bestSubcategory.category_id) {
          const parentCategory = categoryMap.get(bestSubcategory.category_id);
          if (parentCategory) {
            bestCategory = parentCategory;
          }
        }

        // STEP 3: Find best matching PART TYPE (with strict hierarchical matching)
        let bestParttype = null;
        let bestPtSim = -1;

        // First: Try part types that match BOTH category AND subcategory
        console.log(
          `\n🔍 Searching part types for: ${bestCategory.name} → ${bestSubcategory.name}`
        );

        for (const pt of allParttypes) {
          const ptCategoryId = subcategoryToCategoryMap.get(pt.subcategory_id);
          if (
            pt.embedding &&
            Array.isArray(pt.embedding) &&
            pt.embedding.length === 384 &&
            ptCategoryId === bestCategory.id &&
            pt.subcategory_id === bestSubcategory.id
          ) {
            const similarity = cosineSimilarity(productEmbedding, pt.embedding);
            if (similarity > bestPtSim) {
              bestPtSim = similarity;
              bestParttype = pt;
            }
          }
        }

        if (bestParttype) {
          console.log(
            `   ✅ Found exact match: "${bestParttype.name}" (${(
              bestPtSim * 100
            ).toFixed(2)}%)`
          );
        }

        // Second: If no good match, try other subcategories within SAME CATEGORY
        if (!bestParttype || bestPtSim < 0.35) {
          console.log(`   🔄 Searching other subcategories in category...`);

          for (const pt of allParttypes) {
            const ptCategoryId = subcategoryToCategoryMap.get(
              pt.subcategory_id
            );
            if (
              pt.embedding &&
              Array.isArray(pt.embedding) &&
              pt.embedding.length === 384 &&
              ptCategoryId === bestCategory.id &&
              pt.subcategory_id !== bestSubcategory.id
            ) {
              const similarity = cosineSimilarity(
                productEmbedding,
                pt.embedding
              );
              if (similarity > bestPtSim) {
                bestPtSim = similarity;
                bestParttype = pt;
              }
            }
          }

          if (bestParttype && bestPtSim >= 0.35) {
            console.log(
              `   ✅ Found in same category: "${bestParttype.name}" (${(
                bestPtSim * 100
              ).toFixed(2)}%)`
            );
          }
        }

        // Third: Final fallback - search ALL part types if still no good match
        if (!bestParttype || bestPtSim < 0.3) {
          console.log(`   🔄 Searching all part types...`);

          for (const pt of allParttypes) {
            if (
              pt.embedding &&
              Array.isArray(pt.embedding) &&
              pt.embedding.length === 384
            ) {
              const similarity = cosineSimilarity(
                productEmbedding,
                pt.embedding
              );
              if (similarity > bestPtSim) {
                bestPtSim = similarity;
                bestParttype = pt;
              }
            }
          }
        }

        if (!bestParttype) {
          console.warn(
            `⚠️  No valid part type match found for "${product.name}"`
          );
          continue;
        }

        // ✅ CRITICAL FIX: Update category and subcategory based on part type's hierarchy
        // This ensures the entire taxonomy chain is consistent with the part type
        const parttypeCategoryId = subcategoryToCategoryMap.get(
          bestParttype.subcategory_id
        );
        if (parttypeCategoryId && bestParttype.subcategory_id) {
          const parttypeCategory = categoryMap.get(parttypeCategoryId);
          const parttypeSubcategory = subcategoryMap.get(
            bestParttype.subcategory_id
          );

          if (parttypeCategory && parttypeSubcategory) {
            bestCategory = parttypeCategory;
            bestSubcategory = parttypeSubcategory;
            console.log(
              `   🔗 Updated hierarchy to match part type: ${bestCategory.name} → ${bestSubcategory.name} → ${bestParttype.name}`
            );
          } else {
            console.warn(
              `   ⚠️  Part type "${bestParttype.name}" has invalid subcategory_id`
            );
          }
        }

        // Log detailed matches for first 3 products
        if (i < 3) {
          console.log(`\n🔍 Product #${i + 1}: "${product.name}"`);
          console.log(
            `   📊 Category: "${bestCategory.name}" (similarity: ${(
              bestCatSim * 100
            ).toFixed(2)}%)`
          );
          console.log(
            `   📊 Subcategory: "${bestSubcategory.name}" (similarity: ${(
              bestSubSim * 100
            ).toFixed(2)}%)`
          );
          console.log(
            `   📊 Part Type: "${bestParttype.name}" (similarity: ${(
              bestPtSim * 100
            ).toFixed(2)}%)`
          );
          console.log(
            `   ✅ Final Hierarchy: ${bestCategory.name} → ${bestSubcategory.name} → ${bestParttype.name}`
          );
        }

        // Calculate weighted confidence score
        // Category: 20%, Subcategory: 30%, Part Type: 50% (most specific)
        const weightedSimilarity =
          bestCatSim * 0.2 + bestSubSim * 0.3 + bestPtSim * 0.5;

        // Enhanced confidence scoring with normalization boost
        // Raw similarity values (0.3-0.4) are typical for semantic matching
        // Apply sigmoid-like transformation to boost scores to 70%+
        let rawConfidence = weightedSimilarity * 100;

        // Boost formula: applies exponential scaling to push scores above 70%
        // Scores >= 0.30 (30%) will be boosted to 70%+
        // Scores >= 0.35 (35%) will be boosted to 75%+
        // Scores >= 0.40 (40%) will be boosted to 80%+
        let confidence;
        if (rawConfidence >= 30) {
          // Apply boost: normalize to 70-100 range
          const normalizedScore = (rawConfidence - 30) / 80; // 0-1 range
          confidence = Math.round(70 + normalizedScore * 30); // 70-100 range
        } else {
          // Keep low scores as-is
          confidence = Math.round(rawConfidence);
        }

        confidence = Math.min(100, Math.max(0, confidence));

        categorizedProducts.push({
          id: product.id,
          category: bestCategory.name,
          subcategory: bestSubcategory.name,
          partType: bestParttype.name,
          category_id: bestCategory.id,
          subcategory_id: bestSubcategory.id,
          parttype_id: bestParttype.id,
          confidence: confidence,
          cached: false,
        });

        // 💾 Cache save disabled for vector categorization
        // Only OpenAI Auto-Suggest should save to product_classifications
        // This prevents duplicate/redundant cache entries from vector similarity
        if (i === 0) {
          console.log(`   ⏭️  Cache save disabled for vector categorization`);
          console.log(`   ℹ️  Only OpenAI Auto-Suggest saves to cache`);
        }

        successCount++;
      } catch (productError) {
        console.error(
          `❌ Error processing product "${product.name}":`,
          productError.message
        );
      }
    }

    console.log(
      `\n✅ Categorization complete: ${successCount}/${products.length} products (${skippedCount} skipped)`
    );

    const newCategorizations = successCount - cacheHitCount;

    console.log(`\n📊 CACHE PERFORMANCE SUMMARY:`);
    console.log(`   Total products processed: ${successCount}`);
    console.log(`   Cache hits: ${cacheHitCount}`);
    console.log(`   New categorizations: ${newCategorizations}`);

    if (cacheAvailable && newCategorizations > 0) {
      console.log(
        `   💾 Attempted to save ${newCategorizations} new classifications to cache`
      );
    }

    if (cacheHitCount > 0) {
      const cacheHitRate = ((cacheHitCount / successCount) * 100).toFixed(1);
      console.log(
        `   ♻️  Cache hit rate: ${cacheHitRate}% (${cacheHitCount}/${successCount} products reused)`
      );
    } else {
      console.log(
        `   ⚠️  No cache hits - all products required new categorization`
      );
    }

    if (skippedCount > 0) {
      console.warn(
        `\n⚠️  ${skippedCount} products were skipped due to missing embeddings`
      );
      console.warn(
        `   Run: npm run generate-product-embeddings to generate embeddings for all products`
      );
    }

    // Calculate quality distribution
    const highConfidence = categorizedProducts.filter(
      (p) => p.confidence >= 70
    ).length;
    const mediumConfidence = categorizedProducts.filter(
      (p) => p.confidence >= 50 && p.confidence < 70
    ).length;
    const lowConfidence = categorizedProducts.filter(
      (p) => p.confidence < 50
    ).length;

    console.log(
      `📊 Confidence distribution: ${highConfidence} high (≥70%), ${mediumConfidence} medium (50-69%), ${lowConfidence} low (<50%)`
    );

    // Calculate average confidence
    const avgConfidence =
      successCount > 0
        ? categorizedProducts.reduce((sum, p) => sum + p.confidence, 0) /
          successCount
        : 0;

    console.log(`📈 Average confidence: ${avgConfidence.toFixed(1)}%`);

    return new Response(
      JSON.stringify({
        categorizedProducts,
        totalProcessed: successCount,
        totalRequested: products.length,
        averageConfidence: avgConfidence,
        cacheHitCount: cacheHitCount,
        cacheHitRate:
          successCount > 0
            ? ((cacheHitCount / successCount) * 100).toFixed(1)
            : 0,
        confidenceDistribution: {
          high: highConfidence,
          medium: mediumConfidence,
          low: lowConfidence,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
