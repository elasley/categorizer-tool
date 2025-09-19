import acesCategories from "../data/acesCategories.js";
import { suggestCategory } from "./categoryMatcher.js";

const BATCH_SIZE = Number(process.env.REACT_APP_BATCH_SIZE) || 200;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 2000;
const API_TIMEOUT_MS = 30000;
const PREFILTER_CONFIDENCE_THRESHOLD =
  Number(process.env.REACT_APP_PREFILTER_CONFIDENCE) || 95;
const OPENAI_MODEL = process.env.REACT_APP_OPENAI_MODEL || "gpt-4o-mini";

// Compact taxonomy prompt to reduce token size: list main categories and subcategories only
const getAcesCategoriesPrompt = (compact = true) => {
  const mainCategories = Object.keys(acesCategories);
  if (!compact) {
    // full verbose prompt (rarely used)
    let prompt = "ACES Automotive Categories (use exact names):\n";
    mainCategories.forEach((category) => {
      prompt += `- ${category}\n`;
      const subcategories = Object.keys(acesCategories[category]);
      subcategories.forEach((subcategory) => {
        prompt += `  * ${subcategory}\n`;
        const partTypes = acesCategories[category][subcategory];
        if (partTypes.length > 0) {
          prompt += `    - ${partTypes.join(", ")}\n`;
        }
      });
      prompt += "\n";
    });
    return prompt;
  }

  // compact: only categories and subcategories
  let prompt =
    "ACES Automotive Categories (main categories and subcategories only):\n";
  mainCategories.forEach((category) => {
    prompt += `- ${category}: `;
    const subcategories = Object.keys(acesCategories[category]);
    prompt += subcategories.join(", ");
    prompt += "\n";
  });
  return prompt;
};

// Helper function to validate and correct ACES categories
const validateAndCorrectCategory = (
  suggestedCategory,
  suggestedSubcategory = null,
  suggestedPartType = null
) => {
  if (!suggestedCategory)
    return { category: "", subcategory: "", partType: "" };

  const mainCategories = Object.keys(acesCategories);

  // Find closest matching main category
  let bestMatch = "";
  let bestScore = 0;

  for (const category of mainCategories) {
    const score = getSimilarityScore(
      suggestedCategory.toLowerCase(),
      category.toLowerCase()
    );
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  const finalCategory = bestMatch || mainCategories[0];

  let finalSubcategory = "";
  if (suggestedSubcategory && acesCategories[finalCategory]) {
    const availableSubcategories = Object.keys(acesCategories[finalCategory]);
    let subScore = 0;

    for (const subcategory of availableSubcategories) {
      const score = getSimilarityScore(
        suggestedSubcategory.toLowerCase(),
        subcategory.toLowerCase()
      );
      if (score > subScore) {
        subScore = score;
        finalSubcategory = subcategory;
      }
    }
  }

  // Find best matching part type
  let finalPartType = "";
  if (
    suggestedPartType &&
    finalSubcategory &&
    acesCategories[finalCategory][finalSubcategory]
  ) {
    const availableParts = acesCategories[finalCategory][finalSubcategory];
    let partScore = 0;

    for (const partType of availableParts) {
      const score = getSimilarityScore(
        suggestedPartType.toLowerCase(),
        partType.toLowerCase()
      );
      if (score > partScore) {
        partScore = score;
        finalPartType = partType;
      }
    }
  }

  return {
    category: finalCategory,
    subcategory: finalSubcategory,
    partType: finalPartType,
  };
};

// Simple string similarity scoring
const getSimilarityScore = (str1, str2) => {
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;

  const words1 = str1.split(" ");
  const words2 = str2.split(" ");
  const commonWords = words1.filter((word) => words2.includes(word)).length;

  return commonWords / Math.max(words1.length, words2.length);
};

// Keyword-based validation to catch obvious misclassifications
const validateCategoryWithKeywords = (
  product,
  suggestedCategory,
  suggestedSubcategory
) => {
  const productText = [
    product.name,
    product.title,
    product.description,
    product.brand,
    product.specifications,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Define keyword patterns for different categories
  const keywordPatterns = {
    "Tools & Equipment": {
      keywords: [
        "abrasive",
        "grinding",
        "cutting",
        "drill",
        "wrench",
        "hammer",
        "screwdriver",
        "pliers",
        "tool",
        "disc",
        "wheel",
        "brush",
        "polish",
        "sandpaper",
        "file",
        "saw",
      ],
      subcategories: {
        "Metal Working Abrasives": [
          "abrasive",
          "grinding",
          "cutting",
          "disc",
          "wheel",
          "brush",
          "polish",
        ],
      },
    },
    Electrical: {
      keywords: [
        "spark plug",
        "battery",
        "alternator",
        "starter",
        "sensor",
        "switch",
        "wire",
        "cable",
        "fuse",
        "relay",
        "coil",
        "ignition",
        "electrical",
      ],
      avoidKeywords: [
        "abrasive",
        "grinding",
        "cutting",
        "tool",
        "disc",
        "wheel",
      ],
    },
  };

  if (
    keywordPatterns["Tools & Equipment"].keywords.some((keyword) =>
      productText.includes(keyword)
    )
  ) {
    if (suggestedCategory !== "Tools & Equipment") {
      console.warn(
        `Potential misclassification: Product contains tool keywords but categorized as ${suggestedCategory}`
      );
      return {
        shouldOverride: true,
        overrideCategory: "Tools & Equipment",
        overrideSubcategory: keywordPatterns["Tools & Equipment"].subcategories[
          "Metal Working Abrasives"
        ].some((k) => productText.includes(k))
          ? "Metal Working Abrasives"
          : "Hand Tools",
        reason: "Product contains tool/abrasive keywords",
      };
    }
  }

  if (
    keywordPatterns["Electrical"].avoidKeywords.some((keyword) =>
      productText.includes(keyword)
    )
  ) {
    if (suggestedCategory === "Electrical") {
      console.warn(
        `Potential misclassification: Product contains non-electrical keywords but categorized as Electrical`
      );
      return {
        shouldOverride: true,
        overrideCategory: "Tools & Equipment",
        overrideSubcategory: "Metal Working Abrasives",
        reason:
          "Product contains abrasive/tool keywords incompatible with Electrical",
      };
    }
  }

  return { shouldOverride: false };
};

// Main batch processing function with senior-level architecture
export const batchCategorizeWithOpenAI = async (products, progressCallback) => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found. Please set REACT_APP_OPENAI_API_KEY in your environment."
    );
  }

  if (!products || products.length === 0) return [];

  console.info(`OpenAI categorization start: ${products.length} products`);

  // 1) Deterministic prefilter - fast local matcher to reduce LLM calls
  const prefilter = products.map((product) => {
    const suggestion = suggestCategory(
      product.name || "",
      product.description || "",
      product.brand || "",
      product.title || "",
      product.originalCategory || product.category || ""
    );
    return { product, suggestion };
  });

  console.info(
    "Bypassing deterministic prefilter: sending all products to OpenAI for classification"
  );

  const trusted = [];
  const uncertain = prefilter.map((p, idx) => ({
    index: idx,
    product: p.product,
    suggestion: p.suggestion,
  }));

  // 2) Build batches only for uncertain products
  const uncertainProducts = uncertain.map((u) => u.product);
  const totalBatches = Math.ceil(uncertainProducts.length / BATCH_SIZE);

  // Concurrency groups to avoid bursting API
  const concurrency = Number(process.env.REACT_APP_CONCURRENCY) || 4;
  const batchIndexes = Array.from({ length: totalBatches }, (_, i) => i);

  // Result holder initialized with original products
  const final = products.map((p) => ({ ...p }));

  const stats = {
    total: products.length,
    trusted: trusted.length,
    uncertain: uncertain.length,
    batches: totalBatches,
    retries: 0,
    startMs: Date.now(),
  };

  // populate trusted results
  trusted.forEach((t) => {
    final[t.index].suggestedCategory = t.suggestion.category || "";
    final[t.index].suggestedSubcategory = t.suggestion.subcategory || "";
    final[t.index].suggestedPartType = t.suggestion.partType || "";
    final[t.index].confidence = t.suggestion.confidence || 0;
    final[t.index].matchReasons = t.suggestion.matchReasons || [];
  });

  let processedUncertain = 0;
  let processedBatches = 0;

  for (let i = 0; i < batchIndexes.length; i += concurrency) {
    const group = batchIndexes.slice(i, i + concurrency);
    const promises = group.map(async (batchIdx) => {
      const start = batchIdx * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, uncertainProducts.length);
      const batch = uncertainProducts.slice(start, end);
      const aiResults = await processBatchWithRetry(
        batch,
        batchIdx,
        apiKey,
        progressCallback
      );
      if (aiResults && Array.isArray(aiResults)) stats.retries += 0; // placeholder for extension
      return { batchIdx, aiResults };
    });

    const resolved = await Promise.all(promises);

    // Merge group results
    resolved.forEach(({ batchIdx, aiResults }) => {
      const start = batchIdx * BATCH_SIZE;
      aiResults.forEach((aiRes, offset) => {
        const uncertainIdx = start + offset;
        const uncertainEntry = uncertain[uncertainIdx];
        if (!uncertainEntry) return;
        const originalIndex = uncertainEntry.index;

        final[originalIndex].suggestedCategory =
          aiRes.suggestedCategory || aiRes.category || "";
        final[originalIndex].suggestedSubcategory =
          aiRes.suggestedSubcategory || aiRes.subcategory || "";
        final[originalIndex].suggestedPartType =
          aiRes.suggestedPartType || aiRes.partType || "";
        final[originalIndex].confidence = aiRes.confidence || 0;

        if (!final[originalIndex].suggestedCategory) {
          const fallback = uncertainEntry.suggestion || {};
          final[originalIndex].suggestedCategory = fallback.category || "";
          final[originalIndex].suggestedSubcategory =
            fallback.subcategory || "";
          final[originalIndex].suggestedPartType = fallback.partType || "";
          final[originalIndex].confidence = fallback.confidence || 0;
          final[originalIndex].matchReasons = fallback.matchReasons || [];
        }

        processedUncertain++;
      });
    });

    // mark how many batches we've completed in this group
    processedBatches += group.length;

    if (progressCallback) {
      const processedProducts = trusted.length + processedUncertain;
      // Derive a user-friendly current batch number from processed products so
      // the batch display aligns with the processed product counts.
      const proportion =
        products.length > 0 ? processedProducts / products.length : 0;
      const currentBatchFromProgress = Math.min(
        Math.max(1, Math.ceil(proportion * totalBatches)),
        totalBatches
      );
      progressCallback(
        processedProducts,
        products.length,
        currentBatchFromProgress,
        totalBatches
      );
    }
  }
  stats.timeMs = Date.now() - stats.startMs;
  console.info(`OpenAI categorization finished. stats=`, stats);
  return { results: final, stats };
};

const processBatchWithRetry = async (
  batch,
  batchIndex,
  apiKey,
  progressCallback
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const results = await processSingleBatch(batch, apiKey);

      if (!Array.isArray(results)) {
        throw new Error("Invalid response from processSingleBatch");
      }

      if (results.length !== batch.length) {
        console.warn(
          `Batch ${batchIndex}: expected ${batch.length} results, got ${results.length}`
        );
      }

      return results;
    } catch (error) {
      lastError = error;
      const message = (error && error.message) || String(error);
      const isRateLimit = /rate limit|429|tokens/.test(message.toLowerCase());

      // If the error is marked fatal by processSingleBatch (e.g. insufficient_quota), rethrow
      if (error && error.isFatal) {
        console.error(`Batch ${batchIndex + 1} fatal error: ${message}`);
        throw error; // bubble up so caller/UI can handle immediately
      }

      const backoffBase = Math.min(1000 * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 1000;
      const delay = isRateLimit ? backoffBase + jitter : RETRY_DELAY_MS;

      console.warn(
        `Batch ${
          batchIndex + 1
        } attempt ${attempt} failed: ${message}. Retrying in ${Math.round(
          delay
        )}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error(
    `Batch ${
      batchIndex + 1
    } failed after ${MAX_RETRIES} attempts, using fallback`
  );
  return batch.map((product) => ({
    ...product,
    suggestedCategory: "",
    suggestedSubcategory: "",
    suggestedPartType: "",
    confidence: 0,
    error: `Failed after ${MAX_RETRIES} attempts: ${
      lastError?.message || "Unknown error"
    }`,
  }));
};

const processSingleBatch = async (batch, apiKey) => {
  const productsText = batch
    .map((product, index) => {
      const productText = [
        `Name: ${product.name || "N/A"}`,
        `Title: ${product.title || "N/A"}`,
        `Description: ${product.description || "N/A"}`,
        `Brand: ${product.brand || "N/A"}`,
        `Specifications: ${product.specifications || "N/A"}`,
        `Category: ${product.category || "N/A"}`,
        `UPC: ${product.upc || "N/A"}`,
      ]
        .filter((line) => !line.includes("N/A"))
        .join("\n");

      return `Product ${index + 1}:\n${productText}`;
    })
    .join("\n\n---\n\n");

  const acesPrompt = getAcesCategoriesPrompt(true); // compact

  // Use a short, precise system prompt to reduce token usage and enforce format
  const systemPrompt = `You are an expert ACES product classifier. Use only the ACES categories listed below. Be concise and return ONLY a JSON array with ${batch.length} objects corresponding to the input products.
${acesPrompt}
Return each object with keys: category, subcategory, partType, confidence (0-100). Do not include any explanation or extra text.`;

  const userPrompt = `${productsText}

Respond with ONLY a JSON array in this exact format:
[
  {
    "category": "exact ACES main category name",
    "subcategory": "exact ACES subcategory name",
    "partType": "exact ACES part type name",
    "confidence": 85
  },
  {
    "category": "another exact ACES main category",
    "subcategory": "another exact ACES subcategory",
    "partType": "another exact ACES part type",
    "confidence": 92
  }
]

Do not include any explanatory text, markdown formatting, or additional content. Only the JSON array.`;

  // Helper: robustly parse assistant content which may be plain JSON,
  // fenced code, or a string-escaped JSON blob. Returns null on failure.
  const tryParseAssistantContent = (content) => {
    if (!content || typeof content !== "string") return null;

    let s = content.trim();

    // Remove markdown code fences if present
    s = s.replace(/```json\s*|\s*```/g, "").trim();

    // Strategy 1: direct JSON.parse
    try {
      const parsed = JSON.parse(s);
      return parsed;
    } catch (e) {
      // continue to next strategies
    }

    // Strategy 2: extract first JSON array-like substring (from [ to ])
    const firstBracket = s.indexOf("[");
    const lastBracket = s.lastIndexOf("]");
    if (
      firstBracket !== -1 &&
      lastBracket !== -1 &&
      lastBracket > firstBracket
    ) {
      const slice = s.substring(firstBracket, lastBracket + 1);
      try {
        const parsed = JSON.parse(slice);
        return parsed;
      } catch (e) {
        // continue
      }
    }

    // Strategy 3: unescape common escape sequences (handles stringified JSON)
    try {
      const unescaped = s.replace(/\\n/g, "").replace(/\\"/g, '"');
      const parsed = JSON.parse(unescaped);
      return parsed;
    } catch (e) {
      // continue
    }

    // Strategy 4: sometimes the model returns a JSON string wrapped in quotes
    // e.g. "[ { ... } ]". Try to parse as JSON string then parse again.
    try {
      const firstParse = JSON.parse(s);
      if (typeof firstParse === "string") {
        return JSON.parse(firstParse);
      }
    } catch (e) {
      // give up
    }

    return null;
  };

  const maxTokens = Math.min(16000, 800 + Math.ceil(batch.length * 40));

  const fetchPromise = fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
      presence_penalty: 0,
      frequency_penalty: 0,
    }),
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Request timeout after ${API_TIMEOUT_MS}ms`)),
      API_TIMEOUT_MS
    )
  );

  const response = await Promise.race([fetchPromise, timeoutPromise]);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP ${response.status}`;

    const err = new Error(`OpenAI API error: ${response.status} - ${message}`);
    err.status = response.status;
    err.type = errorData.error?.type || null;
    err.code = errorData.error?.code || null;
    err.raw = errorData;

    const fatalTypes = [
      "insufficient_quota",
      "invalid_request_error",
      "invalid_api_key",
      "authentication_error",
    ];
    if (err.type && fatalTypes.includes(err.type)) {
      err.isFatal = true;
    }

    if ([400, 401, 402, 403].includes(response.status)) {
      err.isFatal = true;
    }

    if (response.status === 429 || /rate limit/i.test(message)) {
      err.isRetryable = true;
    }

    throw err;
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const resultsRaw = tryParseAssistantContent(
    typeof content === "string" ? content.trim() : content
  );

  if (!resultsRaw || !Array.isArray(resultsRaw)) {
    console.error("Failed to parse OpenAI response or not an array:", content);
    // Best-effort fallback: return items with no suggestion but keep product data
    return batch.map((product) => ({
      ...product,
      suggestedCategory: "",
      suggestedSubcategory: "",
      suggestedPartType: "",
      confidence: 0,
      error: "Invalid or unparsable response from AI",
    }));
  }

  // If assistant returned more items than products, try to reduce intelligently.
  let results = resultsRaw;

  // If we have duplicates, dedupe while preserving order
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    try {
      const key = JSON.stringify(r);
      if (!seen.has(key)) {
        deduped.push(r);
        seen.add(key);
      }
    } catch (e) {
      // On stringify failure just push
      deduped.push(r);
    }
  }

  if (deduped.length >= batch.length) {
    results = deduped.slice(0, batch.length);
  } else if (results.length >= batch.length) {
    // If dedupe made it shorter but raw had enough, fall back to raw slice
    results = results.slice(0, batch.length);
  } else if (results.length < batch.length) {
    // Not enough results: pad with empty entries so mapping keeps indexes
    const pad = Array.from(
      { length: batch.length - results.length },
      () => ({})
    );
    results = results.concat(pad);
  }

  // Validate and correct each result to ensure ACES compliance
  return results.map((result = {}, index) => {
    // Normalize fields
    const suggestedCategory = result.category || result.Category || "";
    const suggestedSubcategory =
      result.subcategory || result.Subcategory || result.subCategory || "";
    const suggestedPartType =
      result.partType || result.partType || result.part || "";
    const rawConfidence =
      Number(result.confidence || result.confidenceScore || 0) || 0;

    const corrected = validateAndCorrectCategory(
      suggestedCategory,
      suggestedSubcategory,
      suggestedPartType
    );

    // Apply keyword-based validation to catch obvious misclassifications
    const keywordValidation = validateCategoryWithKeywords(
      batch[index],
      corrected.category,
      corrected.subcategory
    );

    let finalCategory = corrected.category;
    let finalSubcategory = corrected.subcategory;
    let finalPartType = corrected.partType;

    if (keywordValidation.shouldOverride) {
      console.log(
        `Overriding AI classification for product ${index + 1}: ${
          keywordValidation.reason
        }`
      );
      finalCategory = keywordValidation.overrideCategory;
      finalSubcategory = keywordValidation.overrideSubcategory;
      finalPartType =
        acesCategories[finalCategory]?.[finalSubcategory]?.[0] || "";
    }

    return {
      ...batch[index],
      suggestedCategory: finalCategory,
      suggestedSubcategory: finalSubcategory,
      suggestedPartType: finalPartType,
      confidence: Math.min(100, Math.max(0, Math.round(rawConfidence) || 0)),
    };
  });
};

// Updated cost estimation for batch processing
export const estimateOpenAICost = (productCount) => {
  const numBatches = Math.ceil(productCount / BATCH_SIZE);
  const avgTokensPerBatch = 250 * BATCH_SIZE; // Adjusted for batch processing with system prompt
  const totalTokens = numBatches * avgTokensPerBatch;
  const costPer1kTokens = 0.0006;

  return {
    inputTokens: Math.round(totalTokens * 0.7),
    outputTokens: Math.round(totalTokens * 0.3),
    estimatedCost: (totalTokens / 1000) * costPer1kTokens,
    numBatches: numBatches,
    productsPerBatch: BATCH_SIZE,
    totalProducts: productCount,
    estimatedTimeMinutes: Math.ceil(numBatches * 1.5), // Rough estimate
  };
};
