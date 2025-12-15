// src/utils/embeddingUtils.js
// Professional vector embedding service for category and product matching

/**
 * EMBEDDING SYSTEM: Custom Hash-Based TF-IDF Implementation
 * Note: This is NOT a neural model like MiniLM-v2, but a fast hash-based system
 * For true semantic embeddings, consider:
 * - OpenAI Embeddings API (paid, best quality)
 * - Transformers.js with MiniLM (free, good quality, heavier)
 * - Sentence Transformers API (paid, excellent quality)
 *
 * Current system: Fast, free, deterministic, works well for keyword-based matching
 */

/**
 * Simple hash function for consistent feature mapping
 * @param {string} str - String to hash
 * @param {number} seed - Seed value for hashing
 * @returns {number} Hash value
 */
const hashString = (str, seed = 0) => {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Tokenize text into words and n-grams
 */
const tokenize = (text) => {
  if (!text) return [];

  // Convert to lowercase and remove special characters
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");

  // Split into words (skip very short words)
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);

  // Generate unigrams, bigrams, and trigrams
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

/**
 * Generate a 768-dimensional embedding vector using hash-based TF-IDF
 * @param {string} text - Input text to embed
 * @param {number} dimension - Vector dimension (default 768 for compatibility)
 * @param {boolean} verbose - Enable detailed logging
 * @returns {number[]} embedding vector
 */
export const generateEmbedding = (text, dimension = 384, verbose = false) => {
  if (!text || typeof text !== "string") {
    if (verbose) console.log("⚠️  Empty text provided, returning zero vector");
    return new Array(dimension).fill(0);
  }

  if (verbose)
    console.log(
      `\n🔤 Generating embedding for: "${text.substring(0, 100)}${
        text.length > 100 ? "..." : ""
      }"`
    );

  const tokens = tokenize(text);
  const embedding = new Array(dimension).fill(0);

  if (tokens.length === 0) {
    if (verbose) console.log("⚠️  No tokens extracted, returning zero vector");
    return embedding;
  }

  if (verbose)
    console.log(`📊 Extracted ${tokens.length} tokens (unigrams + bigrams)`);

  // Count token frequencies
  const tokenCounts = {};
  tokens.forEach((token) => {
    tokenCounts[token] = (tokenCounts[token] || 0) + 1;
  });

  if (verbose) {
    const topTokens = Object.entries(tokenCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([token, count]) => `${token}(${count})`)
      .join(", ");
    console.log(`🔝 Top tokens: ${topTokens}`);
  }

  // Calculate TF-IDF-like scores and map to vector positions
  Object.entries(tokenCounts).forEach(([token, count]) => {
    // TF (term frequency): normalized by total tokens
    const tf = count / tokens.length;

    // Use hash to determine multiple positions in the vector (more positions for better distribution)
    for (let i = 0; i < 5; i++) {
      const position = hashString(token, i) % dimension;
      // Add weighted contribution with gentler decay
      embedding[position] += tf * (1 - i * 0.15);
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

  if (verbose) {
    const nonZeroCount = embedding.filter((v) => v !== 0).length;
    console.log(
      `✅ Generated ${dimension}D vector with ${nonZeroCount} non-zero values (magnitude: ${magnitude.toFixed(
        4
      )})`
    );
  }

  return embedding;
};

/**
 * Generate embedding for category + subcategory + partType with logging
 * @param {string} category
 * @param {string} subcategory
 * @param {string} partType
 * @param {boolean} verbose - Enable detailed logging
 * @returns {number[]} 768-dimensional embedding vector
 */
export const generateCategoryEmbedding = (
  category,
  subcategory,
  partType,
  verbose = false
) => {
  const parts = [category || "", subcategory || "", partType || ""].filter(
    Boolean
  );
  const combinedText = parts.join(" ");

  if (verbose) {
    const hierarchy = parts.join(" > ");
    console.log(`\n📁 Category: ${hierarchy}`);
  }

  return generateEmbedding(combinedText, 384, verbose);
};

/**
 * Cosine similarity between two embeddings
 */
export const cosineSimilarity = (vec1, vec2) => {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

  let dot = 0,
    mag1 = 0,
    mag2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    dot += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
};
