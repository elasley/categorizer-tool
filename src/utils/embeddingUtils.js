// src/utils/embeddingUtils.js
// Generate embeddings using a simple TF-IDF approach without external dependencies

/**
 * Generate a simple embedding vector for text using TF-IDF approach
 * @param {string} text - The text to embed
 * @param {number} dimension - Vector dimension (default 768 for Supabase compatibility)
 * @returns {number[]} - Embedding vector
 */
export const generateEmbedding = (text, dimension = 768) => {
  if (!text || typeof text !== "string") {
    return new Array(dimension).fill(0);
  }

  // Normalize text
  const normalizedText = text.toLowerCase().trim();

  // Create a simple hash-based embedding
  const vector = new Array(dimension).fill(0);

  // Split into words and generate features
  const words = normalizedText.split(/\s+/);

  words.forEach((word, idx) => {
    // Create multiple hash values for each word
    for (let i = 0; i < 3; i++) {
      const hash = simpleHash(word + i);
      const index = Math.abs(hash) % dimension;
      vector[index] += 1.0 / Math.sqrt(words.length);
    }
  });

  // Normalize the vector (L2 normalization)
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return vector.map((val) => val / magnitude);
  }

  return vector;
};

/**
 * Simple hash function for strings
 */
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
};

/**
 * Generate embedding for category data by combining all fields
 * @param {string} category
 * @param {string} subcategory
 * @param {string} partType
 * @returns {number[]}
 */
export const generateCategoryEmbedding = (category, subcategory, partType) => {
  // Combine all fields with weights
  const combinedText = [category || "", subcategory || "", partType || ""]
    .filter(Boolean)
    .join(" ");

  return generateEmbedding(combinedText);
};

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vec1
 * @param {number[]} vec2
 * @returns {number} - Similarity score between 0 and 1
 */
export const cosineSimilarity = (vec1, vec2) => {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
};
