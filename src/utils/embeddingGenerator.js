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
 * Generate embeddings for multiple products
 * @param {Array} products - Array of products with name and description
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Array>} - Products with embeddings added
 */
export const generateProductEmbeddings = async (
  products,
  progressCallback = null
) => {
  console.log(`\n🔧 Generating embeddings for ${products.length} products...`);

  const pipe = await getEmbeddingPipeline();
  const productsWithEmbeddings = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const text = `${product.name || ""} ${product.description || ""}`.trim();

    if (!text) {
      console.warn(`⚠️ Skipping product ${i + 1}: empty name and description`);
      continue;
    }

    try {
      const output = await pipe(text, {
        pooling: "mean",
        normalize: true,
      });

      productsWithEmbeddings.push({
        ...product,
        embedding: Array.from(output.data),
      });

      if (progressCallback) {
        progressCallback(i + 1, products.length);
      }

      if ((i + 1) % 10 === 0) {
        console.log(`   Generated ${i + 1}/${products.length} embeddings`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to generate embedding for product ${i + 1}:`,
        error
      );
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
