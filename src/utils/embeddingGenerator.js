/**
 * Client-side embedding generation using Transformers.js
 * Generates MiniLM-v2 embeddings (384 dimensions) for products in the browser
 */

import { pipeline, env } from "@xenova/transformers";

// Configure environment BEFORE any pipeline creation
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

let pipelineInstance = null;
let isInitializing = false;
let initializationPromise = null;

/**
 * Lazy-load the MiniLM-v2 pipeline (singleton pattern)
 */
const getEmbeddingPipeline = async () => {
  // Return existing pipeline
  if (pipelineInstance) {
    return pipelineInstance;
  }

  // If already initializing, wait for that initialization
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  isInitializing = true;

  initializationPromise = (async () => {
    try {
      console.log("🔄 Loading MiniLM-v2 model for embeddings...");
      console.log("   This may take 30-60 seconds on first load...");

      // Create pipeline with proper error handling
      pipelineInstance = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          quantized: true,
          progress_callback: (data) => {
            if (data.status === "downloading") {
              const percent = data.progress ? Math.round(data.progress) : 0;
              console.log(`   Downloading ${data.file}: ${percent}%`);
            } else if (data.status === "done") {
              console.log(`   ✓ ${data.file} loaded`);
            }
          },
        }
      );

      console.log("✅ MiniLM-v2 model loaded successfully");
      return pipelineInstance;
    } catch (error) {
      pipelineInstance = null;
      console.error("❌ Failed to load MiniLM-v2 model:", error);

      // Provide specific error messages
      let errorMsg = error.message || "Unknown error";

      if (
        errorMsg.includes("not valid JSON") ||
        errorMsg.includes("<!doctype") ||
        errorMsg.includes("<!DOCTYPE")
      ) {
        throw new Error(
          "Failed to download AI model from CDN. This could be due to:\n" +
            "1. Internet connection issues\n" +
            "2. Firewall or antivirus blocking the download\n" +
            "3. Corporate proxy blocking HuggingFace CDN\n" +
            "Please check your network settings and try again."
        );
      } else if (errorMsg.includes("CORS")) {
        throw new Error(
          "CORS error: Browser is blocking model download. Try using a different browser or check browser extensions."
        );
      } else if (errorMsg.includes("timeout") || errorMsg.includes("network")) {
        throw new Error(
          "Network timeout: The model download is taking too long. Please check your internet speed and try again."
        );
      }

      throw new Error(`Failed to load AI model: ${errorMsg}`);
    } finally {
      isInitializing = false;
      initializationPromise = null;
    }
  })();

  return initializationPromise;
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
