/**
 * MiniLM-v2 Embedding Generator
 * Production-ready semantic embedding utility using Xenova/all-MiniLM-L6-v2
 * Generates 384-dimensional, mean-pooled, normalized embeddings
 */

import { pipeline, env } from "@xenova/transformers";

// Configure transformers to cache models locally
env.cacheDir = "./.model-cache";

// Global model cache to load model only once
let cachedPipeline = null;

/**
 * Get or initialize the feature extraction pipeline
 * Model loads once and is reused for all subsequent calls
 * @returns {Promise<Object>} Initialized pipeline
 */
async function getEmbeddingPipeline() {
  if (!cachedPipeline) {
    console.log("🔄 Loading MiniLM-L6-v2 model (one-time initialization)...");
    cachedPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { quantized: true } // Use quantized version for better performance
    );
    console.log("✅ MiniLM model loaded and cached");
  }
  return cachedPipeline;
}

/**
 * Generate semantic embeddings for text using MiniLM-v2
 * @param {string} text - Input text to embed
 * @param {string} prefix - Optional prefix (e.g., "Category: ", "Product title: ")
 * @returns {Promise<number[]>} 384-dimensional normalized embedding vector
 */
export async function generateEmbedding(text, prefix = "") {
  if (!text || typeof text !== "string") {
    console.warn("Invalid text input, returning zero vector");
    return new Array(384).fill(0);
  }

  try {
    const extractor = await getEmbeddingPipeline();
    const fullText = prefix ? `${prefix}${text}` : text;

    // Generate embeddings with mean pooling and normalization
    const output = await extractor(fullText, {
      pooling: "mean",
      normalize: true,
    });

    // Extract the embedding array
    const embedding = Array.from(output.data);

    // Verify dimensions
    if (embedding.length !== 384) {
      throw new Error(`Expected 384 dimensions, got ${embedding.length}`);
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings for categories
 * @param {string} categoryName - Category name
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateCategoryEmbedding(categoryName) {
  return generateEmbedding(categoryName, "Category: ");
}

/**
 * Generate embeddings for subcategories
 * @param {string} subcategoryName - Subcategory name
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateSubcategoryEmbedding(subcategoryName) {
  return generateEmbedding(subcategoryName, "Subcategory: ");
}

/**
 * Generate embeddings for part types
 * @param {string} partTypeName - Part type name
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generatePartTypeEmbedding(partTypeName) {
  return generateEmbedding(partTypeName, "Part type: ");
}

/**
 * Generate embeddings for products
 * @param {string} name - Product name/title
 * @param {string} description - Product description (optional)
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateProductEmbedding(name, description = "") {
  // Format: "Product title: {name} Product description: {description}"
  const productText = `Product title: ${name || ""} Product description: ${
    description || ""
  }`.trim();

  // Don't use the second prefix parameter - it's already included in productText
  return generateEmbedding(productText, "");
}

/**
 * Batch generate embeddings for multiple items
 * @param {Array<string>} texts - Array of texts to embed
 * @param {string} prefix - Prefix to apply to all texts
 * @returns {Promise<Array<number[]>>} Array of embedding vectors
 */
export async function generateEmbeddingBatch(texts, prefix = "") {
  const embeddings = [];

  for (let i = 0; i < texts.length; i++) {
    if (i % 50 === 0) {
      console.log(`📊 Generating embeddings: ${i}/${texts.length}`);
    }
    const embedding = await generateEmbedding(texts[i], prefix);
    embeddings.push(embedding);
  }

  console.log(`✅ Generated ${embeddings.length} embeddings`);
  return embeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {number[]} vecA - First embedding vector
 * @param {number[]} vecB - Second embedding vector
 * @returns {number} Similarity score between 0 and 1
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }

  // Vectors are already normalized, so dot product = cosine similarity
  return Math.max(0, Math.min(1, dotProduct)); // Clamp to [0, 1]
}

/**
 * Preload the model for immediate use
 * Call this at application startup
 */
export async function preloadModel() {
  console.log("🚀 Preloading MiniLM model...");
  await getEmbeddingPipeline();
  console.log("✅ Model ready for use");
}
