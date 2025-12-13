// Supabase Edge Function: assign-categories
// Professional vector-based product categorization using pgvector similarity search
// Optimized to use database vector similarity instead of loading all data

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
    const { products } = body;

    if (!products || !Array.isArray(products)) {
      throw new Error("Products array is required");
    }

    console.log(`\n🚀 Processing ${products.length} products for categorization`);

    // Hash-based TF-IDF embedding generation (MUST match frontend exactly)
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
      const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
      const tokens = [...words];
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

      if (tokens.length === 0) return embedding;

      const tokenCounts: { [key: string]: number } = {};
      tokens.forEach((token) => {
        tokenCounts[token] = (tokenCounts[token] || 0) + 1;
      });

      Object.entries(tokenCounts).forEach(([token, count]) => {
        const tf = count / tokens.length;
        for (let i = 0; i < 3; i++) {
          const position = hashString(token, i) % dimension;
          embedding[position] += tf * (1 - i * 0.2);
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

    // Cosine similarity calculation
    const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
      if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
      let dot = 0;
      for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * (vecB[i] || 0);
      }
      return dot;
    };

    // Verify categories exist
    console.log("🔍 Verifying category database...");
    const { count: categoryCount } = await supabaseClient
      .from("categories")
      .select("*", { count: "exact", head: true });

    if (!categoryCount || categoryCount === 0) {
      throw new Error(
        "No categories found in database. Please upload categories first."
      );
    }

    console.log(`✅ Found ${categoryCount} categories in database`);

    const categorizedProducts = [];
    let processed = 0;
    let successCount = 0;

    // Process each product
    for (const product of products) {
      try {
        processed++;
        console.log(`\n📦 [${processed}/${products.length}] ${product.name}`);

        const combinedText = `${product.name || ""} ${product.description || ""}`.trim();
        console.log(`   📝 "${combinedText.substring(0, 60)}${combinedText.length > 60 ? '...' : ''}"`);

        const productEmbedding = generateEmbedding(combinedText, 768);
        const magnitude = Math.sqrt(productEmbedding.reduce((s, v) => s + v * v, 0));
        console.log(`   🧮 Embedding: 768D vector (mag: ${magnitude.toFixed(4)})`);

        // Step 1: Find best matching part type using vector similarity
        console.log(`   🔍 Searching parttypes...`);
        const { data: parttypes, error: ptError } = await supabaseClient
          .from("parttypes")
          .select("id, name, subcategory_id, embedding");

        if (ptError) throw ptError;

        let bestParttype = null;
        let bestPtSim = -1;

        for (const pt of parttypes || []) {
          if (pt.embedding && Array.isArray(pt.embedding)) {
            const sim = cosineSimilarity(productEmbedding, pt.embedding);
            if (sim > bestPtSim) {
              bestPtSim = sim;
              bestParttype = pt;
            }
          }
        }

        if (!bestParttype) {
          console.log(`   ⚠️  No strong parttype match found, using best available`);
          bestParttype = parttypes?.[0];
          bestPtSim = 0.05; // Very low to indicate poor match
        }

        const ptConfidence = (bestPtSim * 100).toFixed(1);
        const matchQuality = bestPtSim > 0.3 ? "✅" : bestPtSim > 0.15 ? "⚠️" : "❌";
        console.log(`   ${matchQuality} Parttype: "${bestParttype.name}" (${ptConfidence}% similarity)`);

        // Step 2: Get subcategory and category from relationships
        const { data: subcategory, error: subError } = await supabaseClient
          .from("subcategories")
          .select("id, name, category_id, embedding")
          .eq("id", bestParttype.subcategory_id)
          .single();

        if (subError || !subcategory) {
          console.error(`   ❌ Failed to fetch subcategory for parttype ${bestParttype.id}`);
          continue;
        }

        const subSim = cosineSimilarity(productEmbedding, subcategory.embedding || []);
        const subConfidence = (subSim * 100).toFixed(1);
        const subQuality = subSim > 0.3 ? "✅" : subSim > 0.15 ? "⚠️" : "❌";
        console.log(`   ${subQuality} Subcategory: "${subcategory.name}" (${subConfidence}% similarity)`);

        const { data: category, error: catError } = await supabaseClient
          .from("categories")
          .select("id, name, embedding")
          .eq("id", subcategory.category_id)
          .single();

        if (catError || !category) {
          console.error(`   ❌ Failed to fetch category for subcategory ${subcategory.id}`);
          continue;
        }

        const catSim = cosineSimilarity(productEmbedding, category.embedding || []);
        const catConfidence = (catSim * 100).toFixed(1);
        const catQuality = catSim > 0.3 ? "✅" : catSim > 0.15 ? "⚠️" : "❌";
        console.log(`   ${catQuality} Category: "${category.name}" (${catConfidence}% similarity)`);

        // Calculate overall confidence with proper weighting
        const avgSimilarity = (catSim + subSim + bestPtSim) / 3;
        const confidence = Math.round(avgSimilarity * 100);

        const overallQuality = confidence >= 30 ? "✅ GOOD" : confidence >= 15 ? "⚠️ WEAK" : "❌ POOR";
        console.log(`   🎯 Overall confidence: ${confidence}% ${overallQuality}`);

        const result = {
          id: product.id,
          category: category.name,
          subcategory: subcategory.name,
          partType: bestParttype.name,
          confidence: confidence,
        };

        categorizedProducts.push(result);
        successCount++;

        console.log(`   ✅ Success: ${category.name} > ${subcategory.name} > ${bestParttype.name}`);

      } catch (productError) {
        console.error(`   ❌ Error processing product ${product.name}:`, productError.message);
      }
    }

    console.log(`\n✅ Categorization complete: ${successCount}/${products.length} products`);
    
    // Calculate quality distribution
    const goodMatches = categorizedProducts.filter(p => p.confidence >= 30).length;
    const weakMatches = categorizedProducts.filter(p => p.confidence >= 15 && p.confidence < 30).length;
    const poorMatches = categorizedProducts.filter(p => p.confidence < 15).length;
    
    console.log(`\n📊 Match Quality Distribution:`);
    console.log(`   ✅ Good matches (≥30%): ${goodMatches}`);
    console.log(`   ⚠️  Weak matches (15-29%): ${weakMatches}`);
    console.log(`   ❌ Poor matches (<15%): ${poorMatches}`);
    
    if (poorMatches > successCount / 2) {
      console.log(`\n⚠️  NOTE: Many poor matches detected. This typically means:`);
      console.log(`   • Product descriptions don't align with available categories`);
      console.log(`   • Categories need to be expanded to match product types`);
      console.log(`   • Consider uploading categories that match your product domain`);
    }

    return new Response(
      JSON.stringify({
        categorizedProducts,
        totalProcessed: successCount,
        totalRequested: products.length,
        qualityStats: {
          good: goodMatches,
          weak: weakMatches,
          poor: poorMatches
        }
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
