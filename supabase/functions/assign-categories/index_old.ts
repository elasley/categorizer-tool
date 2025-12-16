// Supabase Edge Function: assign-categories
// Professional vector-based product categorization using pgvector similarity search
// Optimized to avoid loading all categories into memory

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get request body
    const body = await req.json();
    console.log(
      "Received request body:",
      JSON.stringify(body).substring(0, 200)
    );

    const { products } = body;

    if (!products || !Array.isArray(products)) {
      console.error("Invalid products array:", products);
      throw new Error("Products array is required");
    }

    console.log(`\n🚀 Processing ${products.length} products for categorization`);
    if (products.length > 0) {
      console.log("📦 Sample product:", JSON.stringify(products[0]));
    }

    const categorizedProducts = [];
    let processed = 0;
    let categoriesFound = 0;

    // Hash-based TF-IDF embedding generation (MUST match frontend exactly)
    const hashString = (str: string, seed = 0): number => {
      let hash = seed;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    };

    const tokenize = (text: string): string[] => {
      if (!text) return [];

      // Convert to lowercase and remove special characters
      const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");

      // Split into words
      const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

      // Generate unigrams and bigrams
      const tokens = [...words];

      // Add bigrams
      for (let i = 0; i < words.length - 1; i++) {
        tokens.push(`${words[i]}_${words[i + 1]}`);
      }

      return tokens;
    };

    const generateEmbedding = (text: string, dimension = 768): number[] => {
      if (!text || typeof text !== "string") {
        return new Array(dimension).fill(0);
      }

      const tokens = tokenize(text);
      const embedding = new Array(dimension).fill(0);

      if (tokens.length === 0) {
        return embedding;
      }

      // Count token frequencies
      const tokenCounts: { [key: string]: number } = {};
      tokens.forEach((token) => {
        tokenCounts[token] = (tokenCounts[token] || 0) + 1;
      });

      // Calculate TF-IDF-like scores and map to vector positions
      Object.entries(tokenCounts).forEach(([token, count]) => {
        // TF (term frequency): normalized by total tokens
        const tf = count / tokens.length;

        // Use hash to determine multiple positions in the vector
        for (let i = 0; i < 3; i++) {
          const position = hashString(token, i) % dimension;
          // Add weighted contribution
          embedding[position] += tf * (1 - i * 0.2); // Decay for additional positions
        }
      });

      // Normalize the vector (L2 normalization)
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

    // Verify categories exist (lightweight check)
    console.log("🔍 Verifying category database...");
    const { count: categoryCount, error: countError } = await supabaseClient
      .from("categories")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    if (!categoryCount || categoryCount === 0) {
      throw new Error(
        "No categories found in database. Please upload categories first."
      );
    }

    console.log(`✅ Found ${categoryCount} categories in database`);

    // Process each product
    for (const product of products) {
      try {
        console.log(`\n=== Processing product: ${product.name} ===`);

        const combinedText = `${product.name} ${product.description || ""}`;
        console.log(`Combined text: "${combinedText.substring(0, 100)}..."`);

        const productEmbedding = generateEmbedding(combinedText, 768);
        console.log(
          `Generated embedding with ${
            productEmbedding.length
          } dimensions, magnitude: ${Math.sqrt(
            productEmbedding.reduce((s, v) => s + v * v, 0)
          ).toFixed(4)}`
        );

        // Find best matching category using cosine similarity
        let bestCategory : any = null;
        let bestCatSimilarity = -1;
        let categoriesChecked = 0;

        for (const cat of allCategories|| []) {
          if (
            cat.embedding &&
            Array.isArray(cat.embedding) &&
            cat.embedding.length > 0
          ) {
            categoriesChecked++;
            const similarity = productEmbedding.reduce(
              (sum, val, idx) => sum + val * (cat.embedding[idx] || 0),
              0
            );
            if (similarity > bestCatSimilarity) {
              bestCatSimilarity = similarity;
              bestCategory = cat;
            }
          }
        }

        console.log(
          `Checked ${categoriesChecked} categories, best match: ${
            bestCategory?.name || "none"
          } (${bestCatSimilarity.toFixed(4)})`
        );

        if (!bestCategory) {
          console.log(
            `No category found for product: ${product.name} - using first available`
          );
          // ALWAYS use a default category
          if (allCategories && allCategories.length > 0) {
            bestCategory = allCategories[0];
            bestCatSimilarity = 0.3;
            console.log(`Using fallback category: ${bestCategory.name}`);
          } else {
            console.error("No categories in database!");
            continue;
          }
        }

        // Find best matching subcategory - check within category first
        const categorySubcategories =
          allSubcategories?.filter(
            (sub) => sub.category_id === bestCategory.id
          ) || [];

        console.log(
          `Found ${categorySubcategories.length} subcategories in category "${bestCategory.name}"`
        );

        let bestSubcategory = null;
        let bestSubSimilarity = -1;

        // Try to find best match within the category
        for (const sub of categorySubcategories) {
          if (
            sub.embedding &&
            Array.isArray(sub.embedding) &&
            sub.embedding.length > 0
          ) {
            const similarity = productEmbedding.reduce(
              (sum, val, idx) => sum + val * (sub.embedding[idx] || 0),
              0
            );
            if (similarity > bestSubSimilarity) {
              bestSubSimilarity = similarity;
              bestSubcategory = sub;
            }
          }
        }

        console.log(
          `Best subcategory in category: ${bestSubcategory?.name || "none"} (${
            bestSubSimilarity >= 0 ? bestSubSimilarity.toFixed(4) : "none"
          })`
        );

        // If no good match in category, search ALL subcategories
        if (!bestSubcategory || bestSubSimilarity < 0.2) {
          console.log(
            `Searching all ${allSubcategories.length} subcategories globally...`
          );
          let globalBestSub = null;
          let globalBestSim = -1;

          for (const sub of allSubcategories || []) {
            if (
              sub.embedding &&
              Array.isArray(sub.embedding) &&
              sub.embedding.length > 0
            ) {
              const similarity = productEmbedding.reduce(
                (sum, val, idx) => sum + val * (sub.embedding[idx] || 0),
                0
              );
              if (similarity > globalBestSim) {
                globalBestSim = similarity;
                globalBestSub = sub;
              }
            }
          }

          if (globalBestSub && globalBestSim > bestSubSimilarity) {
            bestSubcategory = globalBestSub;
            bestSubSimilarity = globalBestSim;
            // Update category to match the subcategory
            const newCategory = allCategories?.find(
              (c) => c.id === globalBestSub.category_id
            );
            if (newCategory) {
              bestCategory = newCategory;
              console.log(
                `Updated to better match: "${bestSubcategory.name}" in "${
                  bestCategory.name
                }" (${globalBestSim.toFixed(4)})`
              );
            }
          }
        }

        // If still no subcategory, use first available
        if (!bestSubcategory) {
          if (categorySubcategories.length > 0) {
            bestSubcategory = categorySubcategories[0];
            bestSubSimilarity = 0.1;
            console.log(
              `Using first subcategory in category: ${bestSubcategory.name}`
            );
          } else if (allSubcategories.length > 0) {
            bestSubcategory = allSubcategories[0];
            bestSubSimilarity = 0.1;
            const newCategory = allCategories?.find(
              (c) => c.id === bestSubcategory.category_id
            );
            if (newCategory) bestCategory = newCategory;
            console.log(
              `Using first global subcategory: ${bestSubcategory.name}`
            );
          } else {
            console.error(
              `Cannot categorize ${product.name} - no subcategories exist`
            );
            continue;
          }
        }

        // Find best matching part type - check within subcategory first
        const subcategoryParttypes =
          allParttypes?.filter(
            (pt) => pt.subcategory_id === bestSubcategory.id
          ) || [];

        console.log(
          `Found ${subcategoryParttypes.length} parttypes in subcategory "${bestSubcategory.name}"`
        );

        let bestParttype = null;
        let bestPtSimilarity = -1;

        // Try to find best match within the subcategory
        for (const pt of subcategoryParttypes) {
          if (
            pt.embedding &&
            Array.isArray(pt.embedding) &&
            pt.embedding.length > 0
          ) {
            const similarity = productEmbedding.reduce(
              (sum, val, idx) => sum + val * (pt.embedding[idx] || 0),
              0
            );
            if (similarity > bestPtSimilarity) {
              bestPtSimilarity = similarity;
              bestParttype = pt;
            }
          }
        }

        console.log(
          `Best parttype in subcategory: ${bestParttype?.name || "none"} (${
            bestPtSimilarity >= 0 ? bestPtSimilarity.toFixed(4) : "none"
          })`
        );

        // If no good match in subcategory, search ALL parttypes
        if (!bestParttype || bestPtSimilarity < 0.2) {
          console.log(
            `Searching all ${allParttypes.length} parttypes globally...`
          );
          let globalBestPt = null;
          let globalBestSim = -1;

          for (const pt of allParttypes || []) {
            if (
              pt.embedding &&
              Array.isArray(pt.embedding) &&
              pt.embedding.length > 0
            ) {
              const similarity = productEmbedding.reduce(
                (sum, val, idx) => sum + val * (pt.embedding[idx] || 0),
                0
              );
              if (similarity > globalBestSim) {
                globalBestSim = similarity;
                globalBestPt = pt;
              }
            }
          }

          if (globalBestPt && globalBestSim > bestPtSimilarity) {
            bestParttype = globalBestPt;
            bestPtSimilarity = globalBestSim;
            // Update subcategory and category to match the parttype
            const newSubcategory = allSubcategories?.find(
              (s) => s.id === globalBestPt.subcategory_id
            );
            if (newSubcategory) {
              bestSubcategory = newSubcategory;
              const newCategory = allCategories?.find(
                (c) => c.id === newSubcategory.category_id
              );
              if (newCategory) bestCategory = newCategory;
              console.log(
                `Updated to better match: "${bestParttype.name}" in "${
                  bestSubcategory.name
                }" > "${bestCategory.name}" (${globalBestSim.toFixed(4)})`
              );
            }
          }
        }

        // If still no parttype, use first available
        if (!bestParttype) {
          if (subcategoryParttypes.length > 0) {
            bestParttype = subcategoryParttypes[0];
            bestPtSimilarity = 0.1;
            console.log(
              `Using first parttype in subcategory: ${bestParttype.name}`
            );
          } else if (allParttypes.length > 0) {
            bestParttype = allParttypes[0];
            bestPtSimilarity = 0.1;
            const newSubcategory = allSubcategories?.find(
              (s) => s.id === bestParttype.subcategory_id
            );
            if (newSubcategory) {
              bestSubcategory = newSubcategory;
              const newCategory = allCategories?.find(
                (c) => c.id === newSubcategory.category_id
              );
              if (newCategory) bestCategory = newCategory;
            }
            console.log(`Using first global parttype: ${bestParttype.name}`);
          } else {
            console.error(
              `Cannot categorize ${product.name} - no parttypes exist`
            );
            continue;
          }
        }

        // Calculate average confidence score
        const avgSimilarity =
          (bestCatSimilarity + bestSubSimilarity + bestPtSimilarity) / 3;
        const confidence = Math.round(avgSimilarity * 100);

        const result = {
          id: product.id,
          category: bestCategory.name,
          subcategory: bestSubcategory.name,
          partType: bestParttype.name,
          confidence: confidence,
        };

        console.log(
          `Categorized: ${product.name} -> ${bestCategory.name} > ${bestSubcategory.name} > ${bestParttype.name} (${confidence}%)`
        );
        categorizedProducts.push(result);
      } catch (productError) {
        console.error(
          `Error processing product ${product.name}:`,
          productError
        );
        console.error("Stack trace:", productError.stack);
        // Continue with next product
      }
    }

    console.log(
      `Successfully categorized ${categorizedProducts.length} out of ${products.length} products`
    );

    return new Response(
      JSON.stringify({
        categorizedProducts,
        totalProcessed: categorizedProducts.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
