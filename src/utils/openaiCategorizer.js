import acesCategories from "../data/acesCategories.js";

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const API_TIMEOUT_MS = 30000;

const getAcesCategoriesPrompt = () => {
  const mainCategories = Object.keys(acesCategories);
  let prompt = "ACES Automotive Categories (use exact names):\n";

  mainCategories.forEach((category) => {
    prompt += `- ${category}\n`;
    const subcategories = Object.keys(acesCategories[category]);
    subcategories.forEach((subcategory) => {
      // Show all subcategories instead of limiting to 5
      prompt += `  * ${subcategory}\n`;
      const partTypes = acesCategories[category][subcategory];
      if (partTypes.length > 0) {
        prompt += `    - ${partTypes.join(", ")}\n`;
      }
    });
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

  // Check if product contains strong indicators for Tools & Equipment
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

  // Check if product should NOT be Electrical
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

  if (!products || products.length === 0) {
    return [];
  }

  const totalBatches = Math.ceil(products.length / BATCH_SIZE);
  const categorizedProducts = [];
  const batchPromises = [];

  // Create batches and process them concurrently for better performance
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, products.length);
    const batch = products.slice(startIdx, endIdx);

    const batchPromise = processBatchWithRetry(
      batch,
      batchIndex,
      apiKey,
      progressCallback
    );
    batchPromises.push(batchPromise);
  }

  // Process all batches concurrently but limit concurrency to avoid rate limits
  const concurrencyLimit = 4; // Process 4 batches at a time
  const results = [];

  for (let i = 0; i < batchPromises.length; i += concurrencyLimit) {
    const batchSlice = batchPromises.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(batchSlice);
    results.push(...batchResults.flat());

    // Update overall progress
    if (progressCallback) {
      const processedProducts = Math.min(
        (i + concurrencyLimit) * BATCH_SIZE,
        products.length
      );
      progressCallback(
        processedProducts,
        products.length,
        Math.min(i + concurrencyLimit, totalBatches),
        totalBatches
      );
    }
  }

  return results;
};

// Process a single batch with retry logic
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

      // Validate results match batch size
      if (results.length !== batch.length) {
        throw new Error(
          `Expected ${batch.length} results, got ${results.length}`
        );
      }

      return results;
    } catch (error) {
      lastError = error;
      console.error(
        `❌ Batch ${batchIndex + 1} attempt ${attempt} failed:`,
        error.message
      );

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  // All retries failed, return fallback results
  console.error(
    `💥 Batch ${
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

// Process a single batch of products
const processSingleBatch = async (batch, apiKey) => {
  // Create comprehensive product descriptions
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

  const acesPrompt = getAcesCategoriesPrompt();

  const systemPrompt = `You are an expert product classifier with deep knowledge of the ACES (Automotive Aftermarket Industry Association) standard categorization system.

Your task is to categorize ${batch.length} products using ONLY the ACES categories provided below. You must analyze the COMPLETE product information including name, title, description, brand, and specifications to determine the most appropriate category.

${acesPrompt}

CRITICAL REQUIREMENTS:
1. ALWAYS analyze the FULL product description, specifications, and intended use
2. ONLY use the main categories listed above (exactly as spelled)
3. Choose the BEST matching category based on product function and application, not just keywords
4. For industrial tools and abrasives, use "Tools & Equipment > Metal Working Abrasives"
5. For electrical components, use appropriate Electrical subcategories
6. If a product doesn't perfectly match any category, choose the closest available option based on function
7. Provide confidence scores: 90+ for excellent matches, 70-89 for good matches, 50-69 for reasonable matches, below 50 for poor matches
8. Never invent new categories or modify the provided category names

EXAMPLES:
- "3M Scotch-Brite Surface Conditioning Disc" → Tools & Equipment > Metal Working Abrasives > Grinding Wheels
- "NGK Spark Plug" → Electrical > Ignition System > Spark Plugs
- "Bosch Oxygen Sensor" → Electrical > Sensors > Oxygen Sensors

Return your response as a valid JSON array with exactly ${batch.length} objects.`;

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

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 10000, // Increased for batch responses
        presence_penalty: 0,
        frequency_penalty: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${
          errorData.error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Clean the response (remove potential markdown formatting)
    const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();

    let results;
    try {
      results = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", cleanContent);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }

    if (!Array.isArray(results)) {
      throw new Error("Response is not an array");
    }

    if (results.length !== batch.length) {
      throw new Error(
        `Expected ${batch.length} results, got ${results.length}`
      );
    }

    // Validate and correct each result to ensure ACES compliance
    return results.map((result, index) => {
      const corrected = validateAndCorrectCategory(
        result.category,
        result.subcategory,
        result.partType
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
        confidence: Math.min(100, Math.max(0, result.confidence || 0)),
      };
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${API_TIMEOUT_MS}ms`);
    }

    throw error;
  }
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
