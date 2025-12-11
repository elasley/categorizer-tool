// src/utils/embeddingUtils.js
// Custom NLP embedding implementation without external dependencies

/**
 * Simple hash function for consistent feature mapping
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

/**
 * Generate a 768-dimensional embedding vector using hash-based TF-IDF
 * @param {string} text - Input text to embed
 * @param {number} dimension - Vector dimension (default 768 for compatibility)
 * @returns {number[]} embedding vector
 */
export const generateEmbedding = (text, dimension = 768) => {
  if (!text || typeof text !== "string") {
    return new Array(dimension).fill(0);
  }

  const tokens = tokenize(text);
  const embedding = new Array(dimension).fill(0);

  if (tokens.length === 0) {
    return embedding;
  }

  // Count token frequencies
  const tokenCounts = {};
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

/**
 * Generate embedding for category + subcategory + partType
 * @param {string} category
 * @param {string} subcategory
 * @param {string} partType
 * @returns {number[]} 768-dimensional embedding vector
 */
export const generateCategoryEmbedding = (category, subcategory, partType) => {
  const combinedText = [category || "", subcategory || "", partType || ""]
    .filter(Boolean)
    .join(" ");
  return generateEmbedding(combinedText, 768);
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
