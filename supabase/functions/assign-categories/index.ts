// Supabase Edge Function: assign-categories
// Optimized for large-scale product categorization with caching

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PRODUCTS_PER_REQUEST = 500; // Process in batches to avoid timeouts

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

    // Limit products per request
    if (totalProducts > MAX_PRODUCTS_PER_REQUEST) {
      console.log(
        `⚠️  Request exceeds limit of ${MAX_PRODUCTS_PER_REQUEST} products`
      );
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

    // Embedding generation functions
    const hashString = (str: string, seed = 0): number => {
      let hash = seed;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    const tokenize = (text: string): string[] => {
      if (!text) return [];
      const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      const words = cleaned.split(/\s+/).filter((w) => w.length > 2); // Skip very short words
      const tokens = [...words];

      // Add bigrams
      for (let i = 0; i < words.length - 1; i++) {
        tokens.push(`${words[i]}_${words[i + 1]}`);
      }

      // Add trigrams for better matching
      for (let i = 0; i < words.length - 2; i++) {
        tokens.push(`${words[i]}_${words[i + 1]}_${words[i + 2]}`);
      }

      return tokens;
    };

    const generateEmbedding = (text: string, dimension = 768): number[] => {
      if (!text || typeof text !== "string") {
        return new Array(dimension).fill(0);
      }

      const tokens = tokenize(text);
      const embedding = new Array(dimension).fill(0);

      if (tokens.length === 0) return embedding;

      const tokenCounts: { [key: string]: number } = {};
      tokens.forEach((token) => {
        tokenCounts[token] = (tokenCounts[token] || 0) + 1;
      });

      Object.entries(tokenCounts).forEach(([token, count]) => {
        const tf = count / tokens.length;
        // Use more hash positions for better distribution
        for (let i = 0; i < 5; i++) {
          const position = hashString(token, i) % dimension;
          embedding[position] += tf * (1 - i * 0.15); // Gentler decay
        }
      });

      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );

      if (magnitude > 0) {
        for (let i = 0; i < dimension; i++) {
          embedding[i] = embedding[i] / magnitude;
        }
      }

      return embedding;
    };

    const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
      if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
      let dot = 0;
      for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * (vecB[i] || 0);
      }
      return dot;
    };

    // OPTIMIZATION: Load ALL data ONCE and cache it
    console.log("📥 Loading category database...");

    const [categoriesResult, subcategoriesResult, parttypesResult] =
      await Promise.all([
        supabaseClient.from("categories").select("id, name, embedding"),
        supabaseClient
          .from("subcategories")
          .select("id, name, category_id, embedding"),
        supabaseClient
          .from("parttypes")
          .select("id, name, subcategory_id, embedding"),
      ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (subcategoriesResult.error) throw subcategoriesResult.error;
    if (parttypesResult.error) throw parttypesResult.error;

    // Parse embeddings if they come as strings (pgvector format)
    const parseEmbedding = (item: any) => {
      if (item.embedding && typeof item.embedding === "string") {
        try {
          item.embedding = JSON.parse(item.embedding);
        } catch (e) {
          console.error(`Failed to parse embedding for ${item.name}:`, e);
          item.embedding = null;
        }
      }
      return item;
    };

    const allCategories = (categoriesResult.data || []).map(parseEmbedding);
    const allSubcategories = (subcategoriesResult.data || []).map(
      parseEmbedding
    );
    const allParttypes = (parttypesResult.data || []).map(parseEmbedding);

    console.log(
      `✅ Loaded ${allCategories.length} categories, ${allSubcategories.length} subcategories, ${allParttypes.length} parttypes`
    );

    // DEBUG: Check if embeddings exist
    const categoriesWithEmbeddings = allCategories.filter(
      (c) => c.embedding && Array.isArray(c.embedding) && c.embedding.length > 0
    );
    const subcategoriesWithEmbeddings = allSubcategories.filter(
      (s) => s.embedding && Array.isArray(s.embedding) && s.embedding.length > 0
    );
    const parttypesWithEmbeddings = allParttypes.filter(
      (p) => p.embedding && Array.isArray(p.embedding) && p.embedding.length > 0
    );

    console.log(
      `🔍 Embeddings check: ${categoriesWithEmbeddings.length}/${allCategories.length} categories, ${subcategoriesWithEmbeddings.length}/${allSubcategories.length} subcategories, ${parttypesWithEmbeddings.length}/${allParttypes.length} parttypes have valid embeddings`
    );

    if (categoriesWithEmbeddings.length === 0) {
      throw new Error(
        "❌ No category embeddings found! Please re-upload categories to generate embeddings."
      );
    }

    if (allCategories.length === 0) {
      throw new Error("No categories found. Please upload categories first.");
    }

    // Create lookup maps for faster access
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const subcategoryMap = new Map(allSubcategories.map((s) => [s.id, s]));
    const subcategoriesByCategory = new Map<string, typeof allSubcategories>();
    const parttypesBySubcategory = new Map<string, typeof allParttypes>();

    allSubcategories.forEach((sub) => {
      if (!subcategoriesByCategory.has(sub.category_id)) {
        subcategoriesByCategory.set(sub.category_id, []);
      }
      subcategoriesByCategory.get(sub.category_id)!.push(sub);
    });

    allParttypes.forEach((pt) => {
      if (!parttypesBySubcategory.has(pt.subcategory_id)) {
        parttypesBySubcategory.set(pt.subcategory_id, []);
      }
      parttypesBySubcategory.get(pt.subcategory_id)!.push(pt);
    });

    console.log("🚀 Starting batch categorization...");

    const categorizedProducts = [];
    let successCount = 0;

    // Process products
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      try {
        if (i % 50 === 0) {
          console.log(`📦 Progress: ${i + 1}/${products.length}`);
        }

        const combinedText = `${product.name || ""} ${
          product.description || ""
        }`.trim();
        const productEmbedding = generateEmbedding(combinedText, 768);
        const productTextLower = combinedText.toLowerCase();

        // Helper function: Check if product text contains keywords from category name
        const getKeywordBoost = (
          productText: string,
          categoryName: string
        ): number => {
          const categoryWords = categoryName
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2); // Skip short words like "and", "or"

          let matchedWords = 0;
          for (const word of categoryWords) {
            if (productText.includes(word)) {
              matchedWords++;
            }
          }

          // Return boost: 0 to 0.4 based on keyword matches
          return matchedWords > 0 ? Math.min(matchedWords * 0.15, 0.4) : 0;
        };

        // HIERARCHICAL MATCHING WITH KEYWORD BOOSTING

        // Step 1: Find best matching CATEGORY
        let bestCategory = null;
        let bestCatSim = -1;
        const TOP_CATEGORIES_TO_LOG = 3;
        const topCategories: Array<{
          name: string;
          score: number;
          boost: number;
        }> = [];

        for (const cat of allCategories) {
          if (cat.embedding && Array.isArray(cat.embedding)) {
            const vectorSim = cosineSimilarity(productEmbedding, cat.embedding);
            const keywordBoost = getKeywordBoost(productTextLower, cat.name);
            const boostedSim = Math.min(vectorSim + keywordBoost, 1.0); // Cap at 100%

            topCategories.push({
              name: cat.name,
              score: boostedSim,
              boost: keywordBoost,
            });
            if (boostedSim > bestCatSim) {
              bestCatSim = boostedSim;
              bestCategory = cat;
            }
          }
        }

        topCategories.sort((a, b) => b.score - a.score);
        if (i < 3) {
          // Log first 3 products in detail
          console.log(`\n🔍 Product: "${product.name}"`);
          console.log(`   Top ${TOP_CATEGORIES_TO_LOG} category matches:`);
          topCategories.slice(0, TOP_CATEGORIES_TO_LOG).forEach((cat, idx) => {
            const boostStr =
              cat.boost > 0 ? ` (+${(cat.boost * 100).toFixed(0)}% boost)` : "";
            console.log(
              `   ${idx + 1}. ${cat.name}: ${(cat.score * 100).toFixed(
                1
              )}%${boostStr}`
            );
          });
        }

        if (!bestCategory) {
          bestCategory = allCategories[0];
          bestCatSim = 0.05;
        }

        // Step 2: Find best matching SUBCATEGORY within the chosen category (with keyword boosting)
        const categorySubcategories =
          subcategoriesByCategory.get(bestCategory.id) || allSubcategories;
        let bestSubcategory = null;
        let bestSubSim = -1;
        const topSubcategories: Array<{
          name: string;
          score: number;
          boost: number;
        }> = [];

        for (const sub of categorySubcategories) {
          if (sub.embedding && Array.isArray(sub.embedding)) {
            const vectorSim = cosineSimilarity(productEmbedding, sub.embedding);
            const keywordBoost = getKeywordBoost(productTextLower, sub.name);
            const boostedSim = Math.min(vectorSim + keywordBoost, 1.0);

            topSubcategories.push({
              name: sub.name,
              score: boostedSim,
              boost: keywordBoost,
            });
            if (boostedSim > bestSubSim) {
              bestSubSim = boostedSim;
              bestSubcategory = sub;
            }
          }
        }

        topSubcategories.sort((a, b) => b.score - a.score);
        if (i < 3) {
          console.log(
            `   Selected category: "${bestCategory.name}" (${(
              bestCatSim * 100
            ).toFixed(1)}%)`
          );
          console.log(
            `   Top ${TOP_CATEGORIES_TO_LOG} subcategory matches in "${bestCategory.name}":`
          );
          topSubcategories
            .slice(0, TOP_CATEGORIES_TO_LOG)
            .forEach((sub, idx) => {
              const boostStr =
                sub.boost > 0
                  ? ` (+${(sub.boost * 100).toFixed(0)}% boost)`
                  : "";
              console.log(
                `   ${idx + 1}. ${sub.name}: ${(sub.score * 100).toFixed(
                  1
                )}%${boostStr}`
              );
            });
        }

        if (!bestSubcategory) {
          bestSubcategory = categorySubcategories[0] || allSubcategories[0];
          bestSubSim = 0.05;
        }

        // Step 3: Find best matching PARTTYPE within the chosen subcategory (with keyword boosting)
        const subcategoryParttypes =
          parttypesBySubcategory.get(bestSubcategory.id) || allParttypes;
        let bestParttype = null;
        let bestPtSim = -1;
        const topParttypes: Array<{
          name: string;
          score: number;
          boost: number;
        }> = [];

        for (const pt of subcategoryParttypes) {
          if (pt.embedding && Array.isArray(pt.embedding)) {
            const vectorSim = cosineSimilarity(productEmbedding, pt.embedding);
            const keywordBoost = getKeywordBoost(productTextLower, pt.name);
            const boostedSim = Math.min(vectorSim + keywordBoost, 1.0);

            topParttypes.push({
              name: pt.name,
              score: boostedSim,
              boost: keywordBoost,
            });
            if (boostedSim > bestPtSim) {
              bestPtSim = boostedSim;
              bestParttype = pt;
            }
          }
        }

        topParttypes.sort((a, b) => b.score - a.score);
        if (i < 3) {
          console.log(
            `   Selected subcategory: "${bestSubcategory.name}" (${(
              bestSubSim * 100
            ).toFixed(1)}%)`
          );
          console.log(
            `   Top ${TOP_CATEGORIES_TO_LOG} parttype matches in "${bestSubcategory.name}":`
          );
          topParttypes.slice(0, TOP_CATEGORIES_TO_LOG).forEach((pt, idx) => {
            const boostStr =
              pt.boost > 0 ? ` (+${(pt.boost * 100).toFixed(0)}% boost)` : "";
            console.log(
              `   ${idx + 1}. ${pt.name}: ${(pt.score * 100).toFixed(
                1
              )}%${boostStr}`
            );
          });
        }

        if (!bestParttype) {
          bestParttype = subcategoryParttypes[0] || allParttypes[0];
          bestPtSim = 0.05;
        }

        const category = bestCategory;
        const subcategory = bestSubcategory;
        const catSim = bestCatSim;
        const subSim = bestSubSim;

        // Calculate confidence with weighted hierarchy (parttype is most specific, so weight it more)
        // Weight: Category 25%, Subcategory 30%, Parttype 45%
        const weightedSimilarity =
          catSim * 0.25 + subSim * 0.3 + bestPtSim * 0.45;
        const confidence = Math.round(weightedSimilarity * 100);

        categorizedProducts.push({
          id: product.id,
          category: category.name,
          subcategory: subcategory.name,
          partType: bestParttype.name,
          confidence: confidence,
        });

        successCount++;
      } catch (productError) {
        console.error(
          `❌ Error processing product ${product.name}:`,
          productError.message
        );
      }
    }

    console.log(
      `\n✅ Categorization complete: ${successCount}/${products.length} products`
    );

    // Calculate quality distribution (updated thresholds for keyword-boosted scoring)
    const excellentMatches = categorizedProducts.filter(
      (p) => p.confidence >= 70
    ).length;
    const goodMatches = categorizedProducts.filter(
      (p) => p.confidence >= 50 && p.confidence < 70
    ).length;
    const weakMatches = categorizedProducts.filter(
      (p) => p.confidence >= 30 && p.confidence < 50
    ).length;
    const poorMatches = categorizedProducts.filter(
      (p) => p.confidence < 30
    ).length;

    console.log(
      `📊 Quality: ${excellentMatches} excellent (≥70%), ${goodMatches} good (50-69%), ${weakMatches} weak (30-49%), ${poorMatches} poor (<30%)`
    );

    if (excellentMatches + goodMatches > successCount / 2) {
      console.log("✅ High quality matches achieved!");
    } else if (poorMatches > successCount / 2) {
      console.log(
        "⚠️ Many poor matches - categories may not align with product domain"
      );
    }

    return new Response(
      JSON.stringify({
        categorizedProducts,
        totalProcessed: successCount,
        totalRequested: products.length,
        qualityStats: {
          good: goodMatches,
          weak: weakMatches,
          poor: poorMatches,
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
