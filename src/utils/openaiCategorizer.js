import acesCategories from "../data/acesCategories.js";
import { suggestCategory } from "./categoryMatcher.js";
import {
  fetchDatabaseCategories,
  batchGetCachedClassifications,
  batchSaveClassificationsToCache,
} from "./classificationCache.js";

// Professional-grade batch configuration for optimal API performance
const BATCH_SIZE = Number(process.env.REACT_APP_BATCH_SIZE) || 30; // ✅ OPTIMIZED: 30 products per batch (prevents timeouts)
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 2000;
const API_TIMEOUT_MS = 90000; // ✅ 90 seconds timeout (increased from 30s)
const PREFILTER_CONFIDENCE_THRESHOLD =
  Number(process.env.REACT_APP_PREFILTER_CONFIDENCE) || 95;
const OPENAI_MODEL = process.env.REACT_APP_OPENAI_MODEL || "gpt-4o-mini";

// Professional automotive parts categorization prompt with domain expertise
const getAcesCategoriesPrompt = (categories = acesCategories) => {
  const mainCategories = Object.keys(categories);

  let prompt = "AUTOMOTIVE PARTS CATEGORIZATION REFERENCE\n\n";

  // Add automotive context and common part patterns
  prompt += "AUTOMOTIVE CATEGORIZATION RULES:\n";
  prompt += "• Brake components → 'Brake System' category\n";
  prompt += "• Engine/motor oil, filters, cooling → 'Engine' category\n";
  prompt +=
    "• Electrical items (batteries, alternators, spark plugs) → 'Electrical' category\n";
  prompt +=
    "• Tools, abrasives, cutting/grinding → 'Tools & Equipment' category\n";
  prompt +=
    "• Body supplies, paint, sandpaper → 'Fluids & Chemicals' category\n";
  prompt +=
    "• Steering, suspension, shocks → 'Steering & Suspension' category\n\n";

  // Add comprehensive ACES categories with part types
  prompt += "COMPLETE ACES CATEGORIES (use exact names):\n\n";

  mainCategories.forEach((category) => {
    prompt += `${category}:\n`;
    const subcategories = Object.keys(categories[category]);
    subcategories.forEach((subcategory) => {
      const partTypes = categories[category][subcategory];
      if (partTypes && partTypes.length > 0) {
        prompt += `  ▶ ${subcategory}: ${partTypes.join(", ")}\n`;
      }
    });
    prompt += "\n";
  });

  return prompt;
};

// Professional automotive categorization validation with domain expertise
const validateAndCorrectCategory = (
  suggestedCategory,
  suggestedSubcategory = null,
  suggestedPartType = null
) => {
  if (!suggestedCategory) {
    return { category: "", subcategory: "", partType: "" };
  }

  const mainCategories = Object.keys(acesCategories);

  // Step 1: Validate main category with exact matching priority
  let finalCategory = "";
  if (acesCategories[suggestedCategory]) {
    finalCategory = suggestedCategory;
  } else {
    // Use automotive domain knowledge for better matching
    const categoryMap = {
      brake: "Brake System",
      engine: "Engine",
      motor: "Engine",
      electrical: "Electrical",
      electric: "Electrical",
      tool: "Tools & Equipment",
      equipment: "Tools & Equipment",
      abrasive: "Tools & Equipment",
      fluid: "Fluids & Chemicals",
      chemical: "Fluids & Chemicals",
      paint: "Fluids & Chemicals",
      steering: "Steering & Suspension",
      suspension: "Steering & Suspension",
      air: "Air System",
      fuel: "Fuel System",
      exhaust: "Exhaust & Aftertreatment",
      body: "Body & Cab",
      trailer: "Trailer Parts",
      wheel: "Wheel End",
      tire: "Wheel End",
    };

    const lowerSuggested = suggestedCategory.toLowerCase();
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (lowerSuggested.includes(keyword)) {
        finalCategory = category;
        break;
      }
    }

    // If still no match, find best similarity match
    if (!finalCategory) {
      let bestScore = 0;
      for (const category of mainCategories) {
        const score = getSimilarityScore(
          lowerSuggested,
          category.toLowerCase()
        );
        if (score > bestScore && score > 0.3) {
          // Minimum threshold
          bestScore = score;
          finalCategory = category;
        }
      }
    }

    // Fallback to first category if no good match
    finalCategory = finalCategory || mainCategories[0];
  }

  // Step 2: Validate subcategory with automotive logic
  let finalSubcategory = "";
  if (suggestedSubcategory && acesCategories[finalCategory]) {
    const availableSubcategories = Object.keys(acesCategories[finalCategory]);

    if (availableSubcategories.includes(suggestedSubcategory)) {
      finalSubcategory = suggestedSubcategory;
    } else {
      // Find best match with higher threshold
      let bestScore = 0;
      for (const subcategory of availableSubcategories) {
        const score = getSimilarityScore(
          suggestedSubcategory.toLowerCase(),
          subcategory.toLowerCase()
        );
        if (score > bestScore && score > 0.4) {
          bestScore = score;
          finalSubcategory = subcategory;
        }
      }
    }
  }

  // Use first subcategory if no match
  if (!finalSubcategory && acesCategories[finalCategory]) {
    finalSubcategory = Object.keys(acesCategories[finalCategory])[0];
  }

  // Step 3: Validate part type with exact matching priority
  let finalPartType = "";
  if (
    suggestedPartType &&
    finalSubcategory &&
    acesCategories[finalCategory][finalSubcategory]
  ) {
    const availableParts = acesCategories[finalCategory][finalSubcategory];

    if (availableParts.includes(suggestedPartType)) {
      finalPartType = suggestedPartType;
    } else {
      // Find best match with automotive context - be more conservative
      let bestScore = 0;
      let bestMatch = "";
      for (const partType of availableParts) {
        const score = getSimilarityScore(
          suggestedPartType.toLowerCase(),
          partType.toLowerCase()
        );
        if (score > bestScore && score > 0.7) {
          // Much higher threshold - only very close matches
          bestScore = score;
          bestMatch = partType;
        }
      }
      finalPartType = bestMatch;
    }
  }

  // Only use first part type as absolute last resort, prefer to keep the suggested part type
  if (
    !finalPartType &&
    finalSubcategory &&
    acesCategories[finalCategory][finalSubcategory]
  ) {
    // If the AI suggested a reasonable part type but it's not in our ACES list,
    // prefer the AI suggestion over forcing a wrong ACES part type
    if (suggestedPartType && suggestedPartType.trim()) {
      finalPartType = suggestedPartType; // Keep AI suggestion even if not in ACES
    } else {
      const availableParts = acesCategories[finalCategory][finalSubcategory];
      finalPartType = availableParts[0] || "";
    }
  }

  return {
    category: finalCategory,
    subcategory: finalSubcategory,
    partType: finalPartType,
  };
};

// Professional product data analysis with weighted importance
const analyzeProductData = (product) => {
  // Weight different fields by importance for automotive categorization
  const weights = {
    name: 1.0, // Product name is most important
    title: 0.9, // Title is nearly as important
    description: 0.7, // Description provides context
    brand: 0.5, // Brand can indicate category patterns
    specifications: 0.6, // Specs help with technical details
    category: 0.3, // Original category may be unreliable
    partNumber: 0.4, // Part numbers sometimes contain hints
  };

  // Extract and clean text from each field
  const fields = {
    name: (product.name || "").trim(),
    title: (product.title || "").trim(),
    description: (product.description || "").replace(/<[^>]*>/g, " ").trim(), // Remove HTML
    brand: (product.brand || "").trim(),
    specifications: (product.specifications || "").trim(),
    category: (product.originalCategory || product.category || "").trim(),
    partNumber: (product.partNumber || product.sku || product.mpn || "").trim(),
  };

  // Create weighted text for analysis
  let weightedText = "";
  let totalWeight = 0;

  for (const [field, text] of Object.entries(fields)) {
    if (text && weights[field]) {
      const weight = weights[field];
      // Repeat text based on weight (round to whole number)
      const repetitions = Math.max(1, Math.round(weight * 3));
      for (let i = 0; i < repetitions; i++) {
        weightedText += text + " ";
      }
      totalWeight += weight;
    }
  }

  // Extract key automotive indicators
  const indicators = extractAutomotiveIndicators(weightedText.toLowerCase());

  return {
    weightedText: weightedText.trim(),
    primaryText: fields.name || fields.title || fields.description || "",
    brand: fields.brand,
    totalWeight,
    indicators,
    cleanFields: fields,
  };
};

// Extract automotive-specific indicators from product text
const extractAutomotiveIndicators = (text) => {
  const indicators = {
    partType: null,
    category: null,
    confidence: 0,
    keywords: [],
  };

  // Define high-confidence automotive part indicators
  const partIndicators = {
    "Brake Pads": ["brake pad", "disc brake pad", "ceramic brake pad"],
    "Brake Rotors": ["brake rotor", "brake disc", "disc rotor"],
    "Oil Filters": ["oil filter", "engine oil filter", "lube filter"],
    "Air Filters": ["air filter", "engine air filter", "intake filter"],
    "Spark Plugs": ["spark plug", "ignition plug", "glow plug"],
    "Water Pumps": ["water pump", "coolant pump", "cooling pump"],
    Alternators: ["alternator", "generator", "charging system"],
    Starters: ["starter", "starter motor", "starting motor"],
    Batteries: ["battery", "automotive battery", "car battery"],
    Radiators: ["radiator", "cooling radiator", "heat exchanger"],
    Thermostats: ["thermostat", "cooling thermostat", "engine thermostat"],
    "Fuel Pumps": ["fuel pump", "electric fuel pump", "mechanical fuel pump"],
    "Fuel Filters": ["fuel filter", "gas filter", "petrol filter"],
    "Timing Belts": ["timing belt", "cam belt", "camshaft belt"],
    "Serpentine Belts": ["serpentine belt", "drive belt", "accessory belt"],
    "Shock Absorbers": ["shock absorber", "shock", "strut"],
    "Tie Rods": ["tie rod", "tie rod end", "steering tie rod"],
    "Ball Joints": [
      "ball joint",
      "suspension ball joint",
      "steering ball joint",
    ],
  };

  // Check for specific part type matches
  for (const [partType, keywords] of Object.entries(partIndicators)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        if (
          !indicators.partType ||
          keyword.length > (indicators.matchedKeyword || "").length
        ) {
          indicators.partType = partType;
          indicators.matchedKeyword = keyword;
          indicators.confidence = keyword.split(" ").length * 20; // Longer matches = higher confidence
        }
        indicators.keywords.push(keyword);
      }
    }
  }

  // Extract brand patterns that indicate categories
  const brandCategories = {
    "3M": ["Tools & Equipment", "Fluids & Chemicals"],
    Gates: ["Engine"],
    ACDelco: ["Engine", "Electrical"],
    Motorcraft: ["Engine", "Electrical"],
    Bosch: ["Engine", "Electrical"],
    Wagner: ["Brake System"],
    Bendix: ["Brake System"],
    Monroe: ["Steering & Suspension"],
    Gabriel: ["Steering & Suspension"],
    Fram: ["Engine"],
    Wix: ["Engine"],
    Champion: ["Electrical"],
    NGK: ["Electrical"],
    Denso: ["Electrical", "Engine"],
  };

  // Check for brand-based category hints
  for (const [brand, categories] of Object.entries(brandCategories)) {
    if (text.includes(brand.toLowerCase())) {
      indicators.brandCategories = categories;
      break;
    }
  }

  return indicators;
};

// Enhanced string similarity scoring with automotive context
const getSimilarityScore = (str1, str2) => {
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;

  const words1 = str1.split(/\s+/).filter((w) => w.length > 2);
  const words2 = str2.split(/\s+/).filter((w) => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter((word) => words2.includes(word)).length;
  const similarity = commonWords / Math.max(words1.length, words2.length);

  // Boost similarity for automotive-specific word matches
  const automotiveWords = [
    "brake",
    "engine",
    "oil",
    "filter",
    "pump",
    "belt",
    "electrical",
    "fuel",
  ];
  const automotiveMatches = words1.filter(
    (word) => automotiveWords.includes(word) && words2.includes(word)
  ).length;

  return Math.min(1, similarity + automotiveMatches * 0.1);
};

// Professional automotive keyword validation with comprehensive patterns
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

  // DEBUG: Log what text we're analyzing
  console.log(
    `Keyword validation analyzing: "${productText.substring(0, 100)}..."`
  );
  console.log(`Current suggested category: "${suggestedCategory}"`);

  // Comprehensive automotive keyword patterns with confidence weights
  const categoryKeywords = {
    "Brake System": {
      strong: [
        "brake pad",
        "brake rotor",
        "brake disc",
        "brake drum",
        "brake shoe",
        "brake caliper",
        "brake master",
        "brake line",
        "brake hose",
        "abs",
      ],
      medium: ["brake", "braking", "rotor", "caliper", "pad"],
      subcategories: {
        "Brake Components": ["pad", "rotor", "disc", "drum", "shoe", "caliper"],
        "Brake Hydraulics": ["master", "line", "hose", "abs", "hydraulic"],
      },
    },
    Engine: {
      strong: [
        "oil filter",
        "air filter",
        "water pump",
        "thermostat",
        "radiator",
        "timing belt",
        "timing chain",
        "oil pump",
      ],
      medium: [
        "engine",
        "motor",
        "oil",
        "coolant",
        "cooling",
        "filter",
        "pump",
        "belt",
        "timing",
      ],
      subcategories: {
        "Oil System": [
          "oil filter",
          "oil pump",
          "oil pan",
          "oil cooler",
          "oil pressure",
        ],
        "Air Intake System": [
          "air filter",
          "intake",
          "throttle",
          "mass airflow",
        ],
        "Cooling System": [
          "radiator",
          "water pump",
          "thermostat",
          "cooling fan",
          "coolant",
        ],
        "Timing Components": [
          "timing belt",
          "timing chain",
          "sprocket",
          "tensioner",
        ],
      },
    },
    Electrical: {
      strong: [
        "spark plug",
        "ignition coil",
        "alternator",
        "starter",
        "battery",
        "spark plug wire",
      ],
      medium: [
        "electrical",
        "electric",
        "spark",
        "ignition",
        "alternator",
        "starter",
        "battery",
        "coil",
        "wire",
      ],
      avoid: ["grinding", "cutting", "abrasive", "sandpaper", "disc", "wheel"],
      subcategories: {
        "Ignition System": ["spark plug", "ignition coil", "spark plug wire"],
        "Charging System": [
          "alternator",
          "starter",
          "battery",
          "battery cable",
        ],
        Lighting: ["headlight", "tail light", "turn signal", "led"],
      },
    },
    "Tools & Equipment": {
      strong: [
        "grinding wheel",
        "cutting wheel",
        "flap disc",
        "wire brush",
        "sandpaper",
        "sanding disc",
      ],
      medium: [
        "tool",
        "grinder",
        "grinding",
        "cutting",
        "abrasive",
        "disc",
        "wheel",
        "brush",
        "sand",
        "polish",
      ],
      subcategories: {
        "Metal Working Abrasives": [
          "grinding",
          "cutting",
          "abrasive",
          "disc",
          "wheel",
          "flap",
          "wire brush",
        ],
        "Hand Tools": ["wrench", "socket", "screwdriver", "pliers", "hammer"],
        "Air Tools": ["air impact", "air ratchet", "air hammer", "air drill"],
      },
    },
    "Fluids & Chemicals": {
      strong: [
        "motor oil",
        "gear oil",
        "brake cleaner",
        "degreaser",
        "body filler",
        "primer",
      ],
      medium: [
        "oil",
        "fluid",
        "cleaner",
        "chemical",
        "grease",
        "lubricant",
        "paint",
      ],
      subcategories: {
        Lubricants: ["motor oil", "gear oil", "grease", "penetrating oil"],
        "Cleaners & Degreasers": [
          "brake cleaner",
          "degreaser",
          "all-purpose cleaner",
        ],
        "Body & Paint Supplies": [
          "sandpaper",
          "body filler",
          "primer",
          "paint",
        ],
      },
    },
    "Steering & Suspension": {
      strong: [
        "tie rod",
        "ball joint",
        "shock absorber",
        "strut",
        "control arm",
        "sway bar",
      ],
      medium: [
        "steering",
        "suspension",
        "shock",
        "strut",
        "spring",
        "tie rod",
        "ball joint",
      ],
      subcategories: {
        "Steering Components": [
          "tie rod",
          "ball joint",
          "steering gear",
          "power steering pump",
        ],
        "Suspension Components": [
          "shock absorber",
          "strut",
          "spring",
          "control arm",
          "sway bar",
        ],
      },
    },
    "Fuel System": {
      strong: ["fuel pump", "fuel filter", "fuel injector", "fuel line"],
      medium: ["fuel", "injector", "pump", "tank"],
      subcategories: {
        "Fuel Delivery": [
          "fuel pump",
          "fuel filter",
          "fuel injector",
          "fuel line",
        ],
        "Fuel Storage": ["fuel tank", "fuel cap", "fuel sending unit"],
      },
    },
  };

  // Check for strong keyword matches first
  for (const [category, patterns] of Object.entries(categoryKeywords)) {
    // Check avoid keywords - be more specific about what we're avoiding
    if (
      patterns.avoid &&
      patterns.avoid.some((keyword) => productText.includes(keyword))
    ) {
      // Only override if it's a clear mismatch (e.g., abrasive disc in Engine category)
      if (
        suggestedCategory === category &&
        productText.includes("abrasive") &&
        (productText.includes("disc") ||
          productText.includes("wheel") ||
          productText.includes("pad"))
      ) {
        return {
          shouldOverride: true,
          overrideCategory: "Tools & Equipment",
          overrideSubcategory: "Metal Working Abrasives",
          reason: `Abrasive product misclassified in ${category}`,
          confidence: 85, // Slightly lower confidence
        };
      }
    }

    // Check strong keyword matches
    const strongMatches = patterns.strong.filter((keyword) =>
      productText.includes(keyword)
    );
    console.log(`${category} - Strong matches found:`, strongMatches);

    if (strongMatches.length > 0 && suggestedCategory !== category) {
      // Find best subcategory based on matched keywords
      let bestSubcategory = Object.keys(acesCategories[category])[0];
      if (patterns.subcategories) {
        for (const [subcat, keywords] of Object.entries(
          patterns.subcategories
        )) {
          if (keywords.some((keyword) => productText.includes(keyword))) {
            bestSubcategory = subcat;
            break;
          }
        }
      }

      console.log(
        `STRONG KEYWORD OVERRIDE TRIGGERED: ${category} -> ${bestSubcategory}`
      );
      return {
        shouldOverride: true,
        overrideCategory: category,
        overrideSubcategory: bestSubcategory,
        reason: `Strong keyword match: ${strongMatches.join(", ")}`,
        confidence: 95,
      };
    }

    // Check medium keyword matches (less aggressive override) - make this more conservative
    const mediumMatches = patterns.medium.filter((keyword) =>
      productText.includes(keyword)
    );
    console.log(`${category} - Medium matches found:`, mediumMatches);

    // Only override if we have 3+ medium matches AND the current category is really wrong
    if (mediumMatches.length >= 3 && suggestedCategory !== category) {
      // Additional check: only override if the suggested category is clearly wrong
      const isCurrentCategoryBad =
        !suggestedCategory ||
        (suggestedCategory === "Engine" && category === "Tools & Equipment") ||
        (suggestedCategory === "Electrical" &&
          category === "Tools & Equipment" &&
          patterns.medium.some(
            (k) =>
              ["abrasive", "grinding", "cutting"].includes(k) &&
              productText.includes(k)
          ));

      if (isCurrentCategoryBad) {
        let bestSubcategory = Object.keys(acesCategories[category])[0];
        if (patterns.subcategories) {
          for (const [subcat, keywords] of Object.entries(
            patterns.subcategories
          )) {
            if (keywords.some((keyword) => productText.includes(keyword))) {
              bestSubcategory = subcat;
              break;
            }
          }
        }

        console.log(
          `MEDIUM KEYWORD OVERRIDE TRIGGERED: ${category} -> ${bestSubcategory}`
        );
        return {
          shouldOverride: true,
          overrideCategory: category,
          overrideSubcategory: bestSubcategory,
          reason: `Multiple keyword matches: ${mediumMatches
            .slice(0, 3)
            .join(", ")}`,
          confidence: 80,
        };
      }
    }
  }

  return { shouldOverride: false };
};

// Main batch processing function with senior-level architecture
export const batchCategorizeWithOpenAI = async (
  products,
  progressCallback,
  categories = null
) => {
  // Fetch categories from database if not provided
  let activeCategories = categories;
  if (!activeCategories) {
    console.log(
      "[batchCategorizeWithOpenAI] Fetching categories from database..."
    );
    try {
      activeCategories = await fetchDatabaseCategories();
      console.log(
        `[batchCategorizeWithOpenAI] Loaded ${
          Object.keys(activeCategories).length
        } categories from database`
      );
    } catch (error) {
      console.warn(
        "[batchCategorizeWithOpenAI] Failed to fetch DB categories, using ACES fallback:",
        error
      );
      activeCategories = acesCategories;
    }
  }

  const isUsingCustomCategories = activeCategories !== acesCategories;
  console.log("[batchCategorizeWithOpenAI] Starting AI categorization");
  console.log(
    `[batchCategorizeWithOpenAI] Using ${
      isUsingCustomCategories ? "DATABASE" : "DEFAULT ACES"
    } categories`
  );
  console.log(
    `[batchCategorizeWithOpenAI] Available categories: ${Object.keys(
      activeCategories
    ).join(", ")}`
  );

  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found. Please set REACT_APP_OPENAI_API_KEY in your environment."
    );
  }

  if (!products || products.length === 0) return [];

  console.info(`\n========================================`);
  console.info(`STARTING OPENAI CATEGORIZATION`);
  console.info(`Total products: ${products.length}`);
  console.info(`API Key present: ${apiKey ? "YES" : "NO"}`);
  console.info(`Model: ${OPENAI_MODEL}`);
  console.info(`Batch size: ${BATCH_SIZE}`);
  console.info(`========================================\n`);

  // 1) Check cache first
  console.info("🔍 Checking cache for existing classifications...");
  
  // ✅ Report progress: Cache lookup starting
  if (progressCallback) {
    progressCallback(0, products.length, 0, 1, "Checking database cache...");
  }
  
  const cacheMap = await batchGetCachedClassifications(products);
  console.info(`✅ Found ${cacheMap.size} cached classifications`);
  
  // ✅ Report progress: Cache lookup complete
  if (progressCallback) {
    progressCallback(cacheMap.size, products.length, 1, 1, `Found ${cacheMap.size} cached products`);
  }

  // 2) Split into cached and needs-classification
  const cached = [];
  const needsClassification = [];

  for (let idx = 0; idx < products.length; idx++) {
    const product = products[idx];
    const { generateProductHash } = await import("./classificationCache.js");
    const productHash = await generateProductHash(
      product.name,
      product.description
    );

    const cachedResult = cacheMap.get(productHash);

    // Only use cache if we have valid data with category
    if (
      cachedResult &&
      typeof cachedResult === "object" &&
      cachedResult.confidence >= 60 &&
      cachedResult.category
    ) {
      const suggestionObj = {
        category: cachedResult.category || "",
        subcategory: cachedResult.subcategory || "",
        partType: cachedResult.partType || "",
        confidence: cachedResult.confidence || 0,
        matchReasons: [cachedResult.validationReason || "Cached"],
      };

      console.log(
        `✅ Using cached result for "${product.name}": ${suggestionObj.category}/${suggestionObj.subcategory}`
      );

      cached.push({
        index: idx,
        suggestion: suggestionObj,
      });
    } else {
      if (cachedResult) {
        console.log(
          `⚠️ Invalid cache for "${product.name}": confidence=${
            cachedResult.confidence
          }, hasCategory=${!!cachedResult.category}`
        );
      }
      needsClassification.push({ index: idx, product });
    }
  }

  console.info(`📦 Using ${cached.length} cached results`);
  console.info(
    `🤖 Need AI classification for ${needsClassification.length} products`
  );

  const trusted = cached;
  const uncertain = needsClassification.map((item, idx) => ({
    index: item.index,
    product: item.product,
    suggestion: null,
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
    // Add null safety check
    if (!t || !t.suggestion) {
      console.warn(`⚠️ Skipping invalid trusted result at index ${t?.index}`);
      return;
    }

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
        progressCallback,
        categories
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
      // ✅ CRITICAL FIX: Await the progress callback to allow UI updates
      await progressCallback(
        processedProducts,
        products.length,
        currentBatchFromProgress,
        totalBatches
      );
    }
    
    // ✅ ADDITIONAL FIX: Yield to browser after each concurrency group
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  stats.timeMs = Date.now() - stats.startMs;
  console.info(`OpenAI categorization finished. stats=`, stats);

  // ✅ CRITICAL FIX: Ensure ALL products have categories using local categorizer as fallback
  console.log('\n🔍 Checking for uncategorized products...');
  let uncategorizedCount = 0;
  
  for (let i = 0; i < final.length; i++) {
    const product = final[i];
    
    // If product has no category OR empty category, use local categorizer
    if (!product.suggestedCategory || product.suggestedCategory === "") {
      uncategorizedCount++;
      console.log(`⚠️ Product ${i + 1} "${product.name || 'Unknown'}" has no category, using local categorizer...`);
      
      // Use local categorizer as fallback
      const localResult = suggestCategory(
        product.name || "",
        product.description || "",
        product.brand || "",
        product.title || "",
        product.originalCategory || "",
        activeCategories
      );
      
      final[i].suggestedCategory = localResult?.category || "Tools & Equipment";
      final[i].suggestedSubcategory = localResult?.subcategory || "General Tools";
      final[i].suggestedPartType = localResult?.partType || "Tool";
      final[i].confidence = Math.max(40, localResult?.confidence - 10 || 40);
      final[i].validationReason = "Local categorizer fallback (OpenAI returned empty)";
      
      console.log(`✅ Assigned fallback: ${final[i].suggestedCategory} -> ${final[i].suggestedSubcategory} (confidence: ${final[i].confidence})`);
    }
  }
  
  if (uncategorizedCount > 0) {
    console.warn(`⚠️ Applied local categorizer fallback to ${uncategorizedCount} products`);
  } else {
    console.log('✅ All products have categories assigned!');
  }

  // ✅ DISABLED: Don't save to database cache (as per user request)
  // const newClassifications = final.filter((p, idx) => {
  //   const wasCached = cached.some((c) => c.index === idx);
  //   return !wasCached && p.suggestedCategory && p.confidence >= 60;
  // });
  // if (newClassifications.length > 0) {
  //   batchSaveClassificationsToCache(newClassifications).catch((err) => {
  //     console.error("Failed to cache classifications:", err);
  //   });
  // }

  return { results: final, stats };
};

const processBatchWithRetry = async (
  batch,
  batchIndex,
  apiKey,
  progressCallback,
  categories = acesCategories
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const results = await processSingleBatch(batch, apiKey, categories);

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
    } failed after ${MAX_RETRIES} attempts, using local categorizer fallback`
  );
  
  // ✅ USE LOCAL CATEGORIZER as fallback instead of returning empty
  console.log(`\n⚠️ BATCH ${batchIndex + 1} FAILED - Applying local categorizer to ${batch.length} products`);
  
  return batch.map((product) => {
    console.log(`🔄 Local fallback for: ${product.name || 'Unknown product'}`);
    const localResult = suggestCategory(
      product.name || "",
      product.description || "",
      product.brand || "",
      product.title || "",
      product.originalCategory || "",
      categories
    );
    
    const result = {
      ...product,
      suggestedCategory: localResult?.category || "Tools & Equipment",
      suggestedSubcategory: localResult?.subcategory || "General Tools",
      suggestedPartType: localResult?.partType || "Tool",
      confidence: Math.max(35, localResult?.confidence - 15 || 35),
      validationReason: `Local fallback (API failed after ${MAX_RETRIES} attempts)`,
      error: `API error: ${lastError?.message || "Unknown error"}`,
    };
    
    console.log(`✅ Assigned: ${result.suggestedCategory} -> ${result.suggestedSubcategory} (confidence: ${result.confidence})`);
    return result;
  });
};

const processSingleBatch = async (
  batch,
  apiKey,
  categories = acesCategories
) => {
  console.log(
    `[processSingleBatch] Using ${
      categories !== acesCategories ? "UPLOADED" : "DEFAULT ACES"
    } categories`
  );

  // Analyze each product with professional automotive expertise
  const analyzedProducts = batch.map((product, index) => {
    // DEBUG: Log original product data
    console.log(`\n--- PRODUCT ${index + 1} - ORIGINAL DATA ---`);
    console.log(`Name: "${product.name || "N/A"}"`);
    console.log(`Title: "${product.title || "N/A"}"`);
    console.log(
      `Description: "${(product.description || "N/A").substring(0, 150)}${
        (product.description || "").length > 150 ? "..." : ""
      }"`
    );
    console.log(`Brand: "${product.brand || "N/A"}"`);
    console.log(`Specifications: "${product.specifications || "N/A"}"`);
    console.log(
      `Part Number: "${
        product.partNumber || product.sku || product.mpn || "N/A"
      }"`
    );
    console.log(
      `Original Category: "${
        product.originalCategory || product.category || "N/A"
      }"`
    );

    const analysis = analyzeProductData(product);

    // DEBUG: Log analysis results
    console.log(`--- PRODUCT ${index + 1} - ANALYSIS RESULTS ---`);
    console.log(
      `Weighted Text: "${analysis.weightedText.substring(0, 200)}${
        analysis.weightedText.length > 200 ? "..." : ""
      }"`
    );
    console.log(`Primary Text: "${analysis.primaryText}"`);
    console.log(`Indicators:`, analysis.indicators);

    // Create focused product description prioritizing most important fields
    const productLines = [];

    if (analysis.cleanFields.name) {
      productLines.push(`Name: ${analysis.cleanFields.name}`);
    }
    if (
      analysis.cleanFields.title &&
      analysis.cleanFields.title !== analysis.cleanFields.name
    ) {
      productLines.push(`Title: ${analysis.cleanFields.title}`);
    }
    if (analysis.cleanFields.description) {
      // Truncate very long descriptions to focus on key information
      const desc =
        analysis.cleanFields.description.length > 200
          ? analysis.cleanFields.description.substring(0, 200) + "..."
          : analysis.cleanFields.description;
      productLines.push(`Description: ${desc}`);
    }
    if (analysis.cleanFields.brand) {
      productLines.push(`Brand: ${analysis.cleanFields.brand}`);
    }
    if (analysis.cleanFields.specifications) {
      productLines.push(
        `Specifications: ${analysis.cleanFields.specifications}`
      );
    }
    if (analysis.cleanFields.partNumber) {
      productLines.push(`Part Number: ${analysis.cleanFields.partNumber}`);
    }

    console.log(`--- PRODUCT ${index + 1} - SENT TO AI ---`);
    console.log(productLines.join("\n"));

    return {
      index,
      product,
      analysis,
      productText: productLines.join("\n"),
    };
  });

  const productsText = analyzedProducts
    .map((item) => `Product ${item.index + 1}:\n${item.productText}`)
    .join("\n\n---\n\n");

  const acesPrompt = getAcesCategoriesPrompt(categories);

  // Professional system prompt with automotive domain expertise
  const systemPrompt = `You are a professional automotive parts classification expert specializing in ACES (Aftermarket Catalog Exchange Standard) categorization.

EXPERTISE REQUIREMENTS:
• 15+ years automotive aftermarket experience
• Expert knowledge of ACES taxonomy standards  
• Deep understanding of automotive systems and components
• Precision in part identification and classification

CLASSIFICATION METHODOLOGY:
1. PRIORITIZE product name and title - these contain the most accurate part identification
2. Use description for additional context and specifications
3. Consider brand reputation and specialization patterns
4. Apply automotive system knowledge for logical categorization
5. Ensure complete hierarchy: Category → Subcategory → Part Type

ACCURACY STANDARDS:
• Minimum 90% classification accuracy required
• Use exact ACES terminology - no approximations
• Every product must have all three levels specified
• High confidence scores (80-95) for clear automotive parts

DOMAIN EXPERTISE EXAMPLES:
• "Brake Pad" = Brake System → Brake Components → Brake Pads
• "Oil Filter" = Engine → Oil System → Oil Filters  
• "Spark Plug" = Electrical → Ignition System → Spark Plugs
• "Timing Belt" = Engine → Timing Components → Timing Belts
• "Shock Absorber" = Steering & Suspension → Suspension Components → Shock Absorbers

${acesPrompt}

OUTPUT REQUIREMENTS:
Return ONLY a JSON array with exactly ${batch.length} objects. Each object MUST contain:
{
  "category": "exact ACES main category name",
  "subcategory": "exact ACES subcategory name", 
  "partType": "exact ACES part type name",
  "confidence": [80-95 for automotive parts, 60-75 for unclear items]
}`;

  const userPrompt = `Classify these automotive products using your professional expertise and the ACES categories provided:

${productsText}

${acesPrompt}

ANALYSIS APPROACH:
1. Read the product name/title first - this is usually the most accurate identifier
2. Use description to confirm part function and application
3. Consider brand context (e.g., 3M = abrasives/chemicals, Gates = belts/hoses)
4. Apply automotive system knowledge to ensure logical placement
5. Assign high confidence (85-95) for clear automotive parts, lower (60-75) for ambiguous items

CLASSIFICATION EXAMPLES:
- Product with "Brake Pad" in name → {"category": "Brake System", "subcategory": "Brake Components", "partType": "Brake Pads", "confidence": 95}
- Product with "Oil Filter" in name → {"category": "Engine", "subcategory": "Oil System", "partType": "Oil Filters", "confidence": 95}  
- Product with "Grinding Disc" → {"category": "Tools & Equipment", "subcategory": "Metal Working Abrasives", "partType": "Grinding Wheels", "confidence": 90}

Provide professional-grade classifications with JSON array only:`;

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

  console.log(`\n🚀 ========================================`);
  console.log(`🚀 MAKING SINGLE OPENAI API CALL`);
  console.log(`🚀 Products in this batch: ${batch.length}`);
  console.log(`🚀 Model: ${OPENAI_MODEL}`);
  console.log(`🚀 Max tokens: ${maxTokens}`);
  console.log(`🚀 ========================================\n`);

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

  console.log(`\n✅ ========================================`);
  console.log(`✅ OPENAI API CALL SUCCESSFUL`);
  console.log(`✅ Tokens used: ${data.usage?.total_tokens || "N/A"}`);
  console.log(`✅ Processing ${batch.length} products from single response`);
  console.log(`✅ ========================================\n`);

  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  // DEBUG: Log raw AI response
  console.log(`\n=== RAW AI RESPONSE ===`);
  console.log(`Content length: ${content.length} characters`);
  console.log(
    `Raw content: ${content.substring(0, 500)}${
      content.length > 500 ? "..." : ""
    }`
  );

  const resultsRaw = tryParseAssistantContent(
    typeof content === "string" ? content.trim() : content
  );

  if (!resultsRaw || !Array.isArray(resultsRaw)) {
    console.error("Failed to parse OpenAI response or not an array:", content);
    console.warn(`⚠️ OpenAI returned invalid response, using local categorizer for ${batch.length} products`);
    
    // ✅ Use local categorizer instead of returning empty
    return batch.map((product) => {
      const localResult = suggestCategory(
        product.name || "",
        product.description || "",
        product.brand || "",
        product.title || "",
        product.originalCategory || "",
        categories
      );
      
      return {
        ...product,
        suggestedCategory: localResult?.category || "Tools & Equipment",
        suggestedSubcategory: localResult?.subcategory || "General Tools",
        suggestedPartType: localResult?.partType || "Tool",
        confidence: Math.max(35, localResult?.confidence - 15 || 35),
        validationReason: "Local fallback (OpenAI response unparsable)",
        error: "Invalid or unparsable response from AI",
      };
    });
  }

  // DEBUG: Log parsed AI results
  console.log(`\n=== PARSED AI RESULTS ===`);
  console.log(`Number of results: ${resultsRaw.length}`);
  console.log(`Expected results: ${batch.length}`);
  resultsRaw.forEach((result, idx) => {
    console.log(`Result ${idx + 1}:`, {
      category: result.category || result.Category || "N/A",
      subcategory: result.subcategory || result.Subcategory || "N/A",
      partType: result.partType || result.PartType || "N/A",
      confidence: result.confidence || result.confidenceScore || "N/A",
    });
  });

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

  // Professional validation and result processing with automotive expertise
  return results.map((result = {}, index) => {
    const product = batch[index];
    const analysis = analyzedProducts[index]?.analysis;

    // Normalize fields from AI response with multiple field name support
    const suggestedCategory =
      result.category || result.Category || result.mainCategory || "";
    const suggestedSubcategory =
      result.subcategory ||
      result.Subcategory ||
      result.subCategory ||
      result.sub_category ||
      "";
    const suggestedPartType =
      result.partType ||
      result.PartType ||
      result.part_type ||
      result.part ||
      "";
    const rawConfidence =
      Number(
        result.confidence || result.confidenceScore || result.score || 0
      ) || 0;

    // DEBUG: Detailed logging for each product processing
    console.log(`\n--- PRODUCT ${index + 1} - AI RESPONSE PROCESSING ---`);
    console.log(`Product Name: "${product.name || "N/A"}"`);
    console.log(`AI Raw Response:`, {
      category: suggestedCategory,
      subcategory: suggestedSubcategory,
      partType: suggestedPartType,
      confidence: rawConfidence,
    });
    console.log(`Analysis Indicators:`, analysis?.indicators);

    // Apply keyword-based validation FIRST to catch obvious patterns
    const keywordValidation = validateCategoryWithKeywords(
      product,
      suggestedCategory,
      suggestedSubcategory
    );

    let finalCategory = suggestedCategory;
    let finalSubcategory = suggestedSubcategory;
    let finalPartType = suggestedPartType;
    let finalConfidence = Math.min(
      100,
      Math.max(0, Math.round(rawConfidence) || 0)
    );
    let validationReason = "AI classification";

    console.log(`Keyword Validation Result:`, keywordValidation);

    // Only override with keyword validation if the current AI suggestion is clearly wrong
    // Be much more conservative to avoid overriding good AI suggestions
    if (
      keywordValidation.shouldOverride &&
      keywordValidation.confidence > 80 && // Require very high confidence
      finalConfidence < 60
    ) {
      // Only if AI confidence is low

      console.log(
        `KEYWORD OVERRIDE for "${product.name}" (AI confidence was low: ${finalConfidence})`
      );
      console.log(
        `  From: ${finalCategory} -> ${finalSubcategory} -> ${finalPartType}`
      );

      finalCategory = keywordValidation.overrideCategory;
      finalSubcategory = keywordValidation.overrideSubcategory;
      // Keep AI part type if it exists and makes sense
      if (!finalPartType || finalPartType === "Unknown") {
        finalPartType =
          acesCategories[finalCategory]?.[finalSubcategory]?.[0] || "";
      }
      finalConfidence = keywordValidation.confidence;
      validationReason = keywordValidation.reason;

      console.log(
        `  To: ${finalCategory} -> ${finalSubcategory} -> ${finalPartType}`
      );
      console.log(`  Reason: ${validationReason}`);
    } else if (keywordValidation.shouldOverride) {
      console.log(`KEYWORD OVERRIDE SKIPPED for "${product.name}"`);
      console.log(
        `  Keyword confidence: ${keywordValidation.confidence}, AI confidence: ${finalConfidence}`
      );
      console.log(
        `  Keeping AI suggestion: ${finalCategory} -> ${finalSubcategory} -> ${finalPartType}`
      );
    }

    // Validate and correct the final suggestions using ACES taxonomy
    const corrected = validateAndCorrectCategory(
      finalCategory,
      finalSubcategory,
      finalPartType
    );

    console.log(`ACES Validation Result:`, corrected);
    console.log(
      `Before ACES correction: ${finalCategory} -> ${finalSubcategory} -> ${finalPartType}`
    );

    // Only apply ACES corrections if the current values are invalid or empty
    // Don't over-correct good AI suggestions

    if (!finalCategory || !acesCategories[finalCategory]) {
      if (corrected.category && acesCategories[corrected.category]) {
        console.log(
          `ACES CATEGORY CORRECTION: "${finalCategory}" -> "${corrected.category}"`
        );
        finalCategory = corrected.category;
      }
    }

    if (
      !finalSubcategory ||
      !acesCategories[finalCategory]?.[finalSubcategory]
    ) {
      if (
        corrected.subcategory &&
        acesCategories[finalCategory]?.[corrected.subcategory]
      ) {
        console.log(
          `ACES SUBCATEGORY CORRECTION: "${finalSubcategory}" -> "${corrected.subcategory}"`
        );
        finalSubcategory = corrected.subcategory;
      }
    }

    // For part types, be even more conservative - only correct if the current part type doesn't exist
    // AND the corrected one does exist
    if (
      finalPartType &&
      finalSubcategory &&
      acesCategories[finalCategory]?.[finalSubcategory]
    ) {
      const availableParts = acesCategories[finalCategory][finalSubcategory];
      if (
        !availableParts.includes(finalPartType) &&
        corrected.partType &&
        availableParts.includes(corrected.partType)
      ) {
        console.log(
          `ACES PART TYPE CORRECTION: "${finalPartType}" -> "${corrected.partType}"`
        );
        finalPartType = corrected.partType;
      }
    } else if (!finalPartType && corrected.partType) {
      console.log(
        `ACES PART TYPE CORRECTION: "${finalPartType}" -> "${corrected.partType}"`
      );
      finalPartType = corrected.partType;
    }

    console.log(
      `After ACES correction: ${finalCategory} -> ${finalSubcategory} -> ${finalPartType}`
    );

    // Use analysis indicators for confidence adjustment
    if (analysis?.indicators?.partType && analysis.indicators.confidence > 0) {
      // If our analysis found a specific part type match, boost confidence
      const indicatedPartType = analysis.indicators.partType;
      console.log(
        `Checking indicator match: "${indicatedPartType}" vs "${finalPartType}"`
      );

      if (
        finalPartType === indicatedPartType ||
        analysis.indicators.keywords.some((k) =>
          finalPartType.toLowerCase().includes(k.toLowerCase())
        )
      ) {
        console.log(`INDICATOR MATCH FOUND - boosting confidence`);
        finalConfidence = Math.max(finalConfidence, 85);
        validationReason += " + indicator match";
      }
    }

    // Fallback to local categorizer only if we have very poor results
    if (
      !finalCategory ||
      !finalSubcategory ||
      !finalPartType ||
      finalConfidence < 30
    ) {
      console.log(`USING LOCAL CATEGORIZER FALLBACK for: ${product.name}`);
      console.log(
        `Reason: Category=${!!finalCategory}, Subcategory=${!!finalSubcategory}, PartType=${!!finalPartType}, Confidence=${finalConfidence}`
      );

      const localResult = suggestCategory(
        product.name || "",
        product.description || "",
        product.brand || "",
        product.title || "",
        product.originalCategory || "",
        categories
      );

      console.log(`Local categorizer result:`, localResult);

      if (localResult && localResult.category) {
        // Only use local result if AI result was very poor
        if (finalConfidence < 30 || !finalCategory) {
          console.log(`APPLYING LOCAL FALLBACK`);
          console.log(
            `  From: ${finalCategory} -> ${finalSubcategory} -> ${finalPartType}`
          );

          finalCategory = localResult.category;
          finalSubcategory = localResult.subcategory;
          finalPartType = localResult.partType;
          finalConfidence = Math.max(35, localResult.confidence - 15); // Reduced confidence for fallback
          validationReason = "Local categorizer fallback";

          console.log(
            `  To: ${finalCategory} -> ${finalSubcategory} -> ${finalPartType}`
          );
        }
      }
    }

    // Final safety validation - ensure we have at least category and subcategory
    if (!finalCategory || !acesCategories[finalCategory]) {
      console.warn(
        `SAFETY FALLBACK: No valid category found for "${product.name}", defaulting to Tools & Equipment`
      );
      finalCategory = "Tools & Equipment"; // Safe default for unknown items
    }

    if (
      !finalSubcategory ||
      !acesCategories[finalCategory]?.[finalSubcategory]
    ) {
      console.warn(
        `SAFETY FALLBACK: No valid subcategory found for "${product.name}", using first available`
      );
      finalSubcategory = Object.keys(acesCategories[finalCategory])[0];
    }

    // Only force a part type if we don't have one at all
    // Don't override a valid AI-suggested part type just because it's not in our ACES list
    if (!finalPartType) {
      console.warn(
        `SAFETY FALLBACK: No part type found for "${product.name}", using first available`
      );
      finalPartType = acesCategories[finalCategory][finalSubcategory][0] || "";
    } else if (
      acesCategories[finalCategory]?.[finalSubcategory] &&
      !acesCategories[finalCategory][finalSubcategory].includes(finalPartType)
    ) {
      // We have a part type but it's not in our ACES list - that's okay, keep it
      console.log(
        `Part type "${finalPartType}" not in ACES list but keeping AI suggestion`
      );
    }

    // Confidence adjustment based on completeness and validation
    if (
      validationReason.includes("override") ||
      validationReason.includes("indicator")
    ) {
      finalConfidence = Math.max(finalConfidence, 80);
    } else if (validationReason.includes("fallback")) {
      finalConfidence = Math.min(finalConfidence, 50);
    }

    // DEBUG: Final result logging
    console.log(`--- PRODUCT ${index + 1} - FINAL RESULT ---`);
    console.log(`Product Name: "${product.name || "N/A"}"`);
    console.log(`Final Classification:`);
    console.log(`  Category: "${finalCategory}"`);
    console.log(`  Subcategory: "${finalSubcategory}"`);
    console.log(`  Part Type: "${finalPartType}"`);
    console.log(`  Confidence: ${finalConfidence}%`);
    console.log(`  Validation Reason: "${validationReason}"`);
    console.log(`--- END PRODUCT ${index + 1} ---\n`);

    return {
      ...product,
      suggestedCategory: finalCategory,
      suggestedSubcategory: finalSubcategory,
      suggestedPartType: finalPartType,
      confidence: finalConfidence,
      validationReason, // For debugging and quality assessment
      analysis: analysis?.indicators, // Include analysis data for further processing
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
