/**
 * Client-side embedding generation using Transformers.js
 * Generates MiniLM-v2 embeddings (384 dimensions) for products in the browser
 */

let pipeline = null;

/**
 * Lazy-load the MiniLM-v2 pipeline (singleton pattern)
 */
const getEmbeddingPipeline = async () => {
  if (!pipeline) {
    console.log("🔄 Loading MiniLM-v2 model for embeddings...");
    const { pipeline: createPipeline } = await import("@xenova/transformers");
    pipeline = await createPipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    console.log("✅ MiniLM-v2 model loaded successfully");
  }
  return pipeline;
};

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 384-dimensional embedding
 */
export const generateEmbedding = async (text) => {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
};

/**
 * Generate embeddings for multiple products (FAST batch processing)
 * @param {Array} products - Array of products with name and description
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Array>} - Products with embeddings added
 */
export const generateProductEmbeddings = async (
  products,
  progressCallback = null
) => {
  console.log(
    `\n🔧 Generating embeddings for ${products.length} products using BATCH processing...`
  );

  const pipe = await getEmbeddingPipeline();
  const BATCH_SIZE = 64; // Process 64 products at once (optimal for browser memory)
  const productsWithEmbeddings = [];

  // Prepare texts array
  const validProducts = [];
  const texts = [];

  for (const product of products) {
    const text = `${product.name || ""} ${product.description || ""}`.trim();
    if (text) {
      validProducts.push(product);
      texts.push(text);
    }
  }

  console.log(
    `   Processing ${validProducts.length} valid products in batches of ${BATCH_SIZE}...`
  );

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, texts.length);
    const batchTexts = texts.slice(i, batchEnd);

    try {
      // Process entire batch at once
      const outputs = await pipe(batchTexts, {
        pooling: "mean",
        normalize: true,
      });

      // Add embeddings to products
      for (let j = 0; j < batchTexts.length; j++) {
        const productIndex = i + j;
        productsWithEmbeddings.push({
          ...validProducts[productIndex],
          embedding: Array.from(outputs[j].data),
        });
      }

      if (progressCallback) {
        progressCallback(batchEnd, texts.length);
      }

      console.log(
        `   Batch progress: ${batchEnd}/${texts.length} embeddings generated`
      );
    } catch (error) {
      console.error(`❌ Failed to generate batch ${i}-${batchEnd}:`, error);

      // Fallback: process one by one for this batch
      for (let j = 0; j < batchTexts.length; j++) {
        try {
          const output = await pipe(batchTexts[j], {
            pooling: "mean",
            normalize: true,
          });
          productsWithEmbeddings.push({
            ...validProducts[i + j],
            embedding: Array.from(output.data),
          });
        } catch (e) {
          console.error(`❌ Failed product ${i + j + 1}:`, e);
        }
      }
    }
  }

  console.log(
    `✅ Generated embeddings for ${productsWithEmbeddings.length}/${products.length} products`
  );
  return productsWithEmbeddings;
};

/**
 * Check if products already have embeddings
 * @param {Array} products - Array of products
 * @returns {boolean} - True if all products have valid embeddings
 */
export const hasEmbeddings = (products) => {
  return products.every(
    (p) =>
      p.embedding && Array.isArray(p.embedding) && p.embedding.length === 384
  );
};
