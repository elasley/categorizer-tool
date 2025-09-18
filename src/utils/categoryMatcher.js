// src/utils/categoryMatcher.js - Simplified version that works with your existing structure

import { acesCategories } from "../data/acesCategories";

// Simple brand rules (you can expand this later)
const simpleBrandRules = {
  "3m": {
    "sandpaper|sanding disc|body work": {
      category: "Fluids & Chemicals",
      subcategory: "Body & Paint Supplies",
      partType: "Sandpaper",
      confidence: 90,
    },
  },
  loctite: {
    "threadlocker|thread locker": {
      category: "Fluids & Chemicals",
      subcategory: "Adhesives & Sealants",
      partType: "Thread Sealants",
      confidence: 90,
    },
  },
  gates: {
    "timing belt|belt": {
      category: "Engine",
      subcategory: "Timing Components",
      partType: "Timing Belts",
      confidence: 85,
    },
  },
  bendix: {
    "brake pad|brake pads": {
      category: "Brake System",
      subcategory: "Brake Components",
      partType: "Brake Pads",
      confidence: 90,
    },
  },
};

/**
 * Category mapping system - maps existing categories to ACES categories
 */
const categoryMappings = {
  // Direct mappings for common automotive categories
  "oil, fluid & chemicals": {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 95,
    matchType: "direct",
  },
  "oil, fluid and chemicals": {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 95,
    matchType: "direct",
  },
  "fluids & chemicals": {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 95,
    matchType: "direct",
  },
  "fluids and chemicals": {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 95,
    matchType: "direct",
  },
  "tools & equipment": {
    category: "Tools & Equipment",
    subcategory: "Hand Tools",
    partType: "Wrenches",
    confidence: 90,
    matchType: "direct",
  },
  "tools and equipment": {
    category: "Tools & Equipment",
    subcategory: "Hand Tools",
    partType: "Wrenches",
    confidence: 90,
    matchType: "direct",
  },
  brakes: {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Pads",
    confidence: 90,
    matchType: "direct",
  },
  "brake components": {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Pads",
    confidence: 95,
    matchType: "direct",
  },
  engine: {
    category: "Engine",
    subcategory: "Engine Components",
    partType: "Engine Mounts",
    confidence: 90,
    matchType: "direct",
  },
  drivetrain: {
    category: "Drivetrain",
    subcategory: "Transmission",
    partType: "Transmission Filters",
    confidence: 85,
    matchType: "direct",
  },
  "batteries & electrical": {
    category: "Electrical",
    subcategory: "Charging System",
    partType: "Batteries",
    confidence: 90,
    matchType: "direct",
  },
  "air system": {
    category: "Air System",
    subcategory: "Air Brake Components",
    partType: "Air Compressors",
    confidence: 85,
    matchType: "direct",
  },
  safety: {
    category: "Safety Equipment",
    subcategory: "Personal Protective Equipment",
    partType: "Safety Glasses",
    confidence: 80,
    matchType: "direct",
  },
  "body & cab": {
    category: "Body & Cab",
    subcategory: "Body Components",
    partType: "Doors",
    confidence: 80,
    matchType: "direct",
  },
  "fuel system": {
    category: "Fuel System",
    subcategory: "Fuel Delivery",
    partType: "Fuel Pumps",
    confidence: 85,
    matchType: "direct",
  },
  "steering & suspension": {
    category: "Steering & Suspension",
    subcategory: "Steering Components",
    partType: "Tie Rods",
    confidence: 85,
    matchType: "direct",
  },
  lighting: {
    category: "Electrical",
    subcategory: "Lighting",
    partType: "Headlights",
    confidence: 80,
    matchType: "direct",
  },
  "exhaust & aftertreatment": {
    category: "Exhaust & Aftertreatment",
    subcategory: "Exhaust Components",
    partType: "Mufflers",
    confidence: 85,
    matchType: "direct",
  },
  filters: {
    category: "Engine",
    subcategory: "Oil System",
    partType: "Oil Filters",
    confidence: 80,
    matchType: "direct",
  },
  "hydraulic & pto": {
    category: "Hydraulic & PTO",
    subcategory: "Hydraulic Components",
    partType: "Hydraulic Pumps",
    confidence: 80,
    matchType: "direct",
  },
  ignition: {
    category: "Electrical",
    subcategory: "Ignition System",
    partType: "Spark Plugs",
    confidence: 85,
    matchType: "direct",
  },
  "trailer parts": {
    category: "Trailer Parts",
    subcategory: "Trailer Hardware",
    partType: "Trailer Hitches",
    confidence: 80,
    matchType: "direct",
  },
  "wheel end": {
    category: "Wheel End",
    subcategory: "Wheel Components",
    partType: "Wheel Bearings",
    confidence: 80,
    matchType: "direct",
  },
  "cargo control": {
    category: "Cargo Control",
    subcategory: "Cargo Management",
    partType: "Tie Downs",
    confidence: 75,
    matchType: "direct",
  },
  accessories: {
    category: "Accessories",
    subcategory: "Vehicle Accessories",
    partType: "12V Accessories",
    confidence: 70,
    matchType: "direct",
  },

  // Partial/fuzzy mappings based on keywords
  oil: {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 85,
    matchType: "partial",
  },
  fluid: {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 80,
    matchType: "partial",
  },
  chemical: {
    category: "Fluids & Chemicals",
    subcategory: "Cleaners & Degreasers",
    partType: "All-Purpose Cleaners",
    confidence: 80,
    matchType: "partial",
  },
  tool: {
    category: "Tools & Equipment",
    subcategory: "Hand Tools",
    partType: "Wrenches",
    confidence: 75,
    matchType: "partial",
  },
  equipment: {
    category: "Tools & Equipment",
    subcategory: "Hand Tools",
    partType: "Wrenches",
    confidence: 70,
    matchType: "partial",
  },
  brake: {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Pads",
    confidence: 85,
    matchType: "partial",
  },
  battery: {
    category: "Electrical",
    subcategory: "Charging System",
    partType: "Batteries",
    confidence: 85,
    matchType: "partial",
  },
  electrical: {
    category: "Electrical",
    subcategory: "Charging System",
    partType: "Alternators",
    confidence: 80,
    matchType: "partial",
  },
  air: {
    category: "Air System",
    subcategory: "Air Brake Components",
    partType: "Air Compressors",
    confidence: 75,
    matchType: "partial",
  },
  fuel: {
    category: "Fuel System",
    subcategory: "Fuel Delivery",
    partType: "Fuel Pumps",
    confidence: 80,
    matchType: "partial",
  },
  steering: {
    category: "Steering & Suspension",
    subcategory: "Steering Components",
    partType: "Tie Rods",
    confidence: 80,
    matchType: "partial",
  },
  suspension: {
    category: "Steering & Suspension",
    subcategory: "Suspension Components",
    partType: "Shock Absorbers",
    confidence: 80,
    matchType: "partial",
  },
  light: {
    category: "Electrical",
    subcategory: "Lighting",
    partType: "Headlights",
    confidence: 75,
    matchType: "partial",
  },
  exhaust: {
    category: "Exhaust & Aftertreatment",
    subcategory: "Exhaust Components",
    partType: "Mufflers",
    confidence: 80,
    matchType: "partial",
  },
  filter: {
    category: "Engine",
    subcategory: "Oil System",
    partType: "Oil Filters",
    confidence: 75,
    matchType: "partial",
  },
  hydraulic: {
    category: "Hydraulic & PTO",
    subcategory: "Hydraulic Components",
    partType: "Hydraulic Pumps",
    confidence: 80,
    matchType: "partial",
  },
  ignition: {
    category: "Electrical",
    subcategory: "Ignition System",
    partType: "Spark Plugs",
    confidence: 80,
    matchType: "partial",
  },
  trailer: {
    category: "Trailer Parts",
    subcategory: "Trailer Hardware",
    partType: "Trailer Hitches",
    confidence: 75,
    matchType: "partial",
  },
  wheel: {
    category: "Wheel End",
    subcategory: "Wheel Components",
    partType: "Wheel Bearings",
    confidence: 75,
    matchType: "partial",
  },
  cargo: {
    category: "Cargo Control",
    subcategory: "Cargo Management",
    partType: "Tie Downs",
    confidence: 70,
    matchType: "partial",
  },
};

/**
 * Map existing category to ACES category using keyword matching
 */
const mapExistingCategory = (existingCategory) => {
  if (!existingCategory || typeof existingCategory !== "string") {
    return null;
  }

  const normalizedCategory = existingCategory.toLowerCase().trim();

  // First try exact match
  if (categoryMappings[normalizedCategory]) {
    return {
      ...categoryMappings[normalizedCategory],
      matchReasons: [
        `Direct category mapping: "${existingCategory}" → "${categoryMappings[normalizedCategory].category}"`,
      ],
    };
  }

  // Try partial matches (contains)
  for (const [mappingKey, mapping] of Object.entries(categoryMappings)) {
    if (
      mapping.matchType === "partial" &&
      normalizedCategory.includes(mappingKey)
    ) {
      return {
        ...mapping,
        confidence: mapping.confidence - 10, // Slightly lower confidence for partial matches
        matchReasons: [
          `Partial category mapping: "${existingCategory}" contains "${mappingKey}" → "${mapping.category}"`,
        ],
      };
    }
  }

  // Try fuzzy matching with similarity
  const words = normalizedCategory.split(/\s+/).filter((w) => w.length > 2);
  let bestMatch = null;
  let bestSimilarity = 0;

  for (const [mappingKey, mapping] of Object.entries(categoryMappings)) {
    const mappingWords = mappingKey.split(/\s+/);
    const commonWords = words.filter((word) =>
      mappingWords.some((mw) => mw.includes(word) || word.includes(mw))
    );

    if (commonWords.length > 0) {
      const similarity =
        (commonWords.length / Math.max(words.length, mappingWords.length)) *
        100;
      if (similarity > bestSimilarity && similarity > 50) {
        bestSimilarity = similarity;
        bestMatch = {
          ...mapping,
          confidence: Math.max(60, mapping.confidence - 20),
          matchReasons: [
            `Fuzzy category mapping: "${existingCategory}" ~ "${mappingKey}" (${Math.round(
              similarity
            )}% similarity) → "${mapping.category}"`,
          ],
        };
      }
    }
  }

  return bestMatch;
};

/**
 * Get category mapping statistics for analysis
 */
export const getCategoryMappingStats = (products) => {
  const stats = {
    totalProducts: products.length,
    mappedCategories: {},
    unmappedCategories: new Set(),
    mappingConfidence: { high: 0, medium: 0, low: 0 },
  };

  products.forEach((product) => {
    const existingCategory = product.originalCategory;
    if (existingCategory) {
      const mapping = mapExistingCategory(existingCategory);
      if (mapping) {
        if (!stats.mappedCategories[existingCategory]) {
          stats.mappedCategories[existingCategory] = {
            count: 0,
            acesCategory: mapping.category,
            averageConfidence: 0,
          };
        }
        stats.mappedCategories[existingCategory].count++;
        stats.mappedCategories[existingCategory].averageConfidence +=
          mapping.confidence;

        // Count confidence levels
        if (mapping.confidence >= 85) stats.mappingConfidence.high++;
        else if (mapping.confidence >= 70) stats.mappingConfidence.medium++;
        else stats.mappingConfidence.low++;
      } else {
        stats.unmappedCategories.add(existingCategory);
      }
    }
  });

  // Calculate averages
  Object.keys(stats.mappedCategories).forEach((cat) => {
    stats.mappedCategories[cat].averageConfidence = Math.round(
      stats.mappedCategories[cat].averageConfidence /
        stats.mappedCategories[cat].count
    );
  });

  return stats;
};

/**
 * Main categorization function with existing category mapping support
 */
export const suggestCategory = (
  productName,
  description = "",
  brand = "",
  title = "",
  existingCategory = ""
) => {
  const text = `${productName} ${title} ${description} ${brand}`
    .toLowerCase()
    .trim();

  // PRIORITY 1: If existing category is provided, try to map it to ACES
  if (existingCategory) {
    const categoryMapping = mapExistingCategory(existingCategory);
    if (categoryMapping && categoryMapping.confidence > 80) {
      return categoryMapping;
    }
  }

  if (!text) {
    return {
      category: "",
      subcategory: "",
      partType: "",
      confidence: 0,
      matchReasons: ["No text provided"],
    };
  }

  // PRIORITY 2: Try brand-specific rules
  const brandMatch = checkBrandRules(text, brand);
  if (brandMatch && brandMatch.confidence > 75) {
    return brandMatch;
  }

  // PRIORITY 3: Try category mapping with lower confidence if available
  if (existingCategory) {
    const categoryMapping = mapExistingCategory(existingCategory);
    if (categoryMapping) {
      return categoryMapping;
    }
  }

  // PRIORITY 4: Try keyword matching as fallback
  const keywordMatch = findKeywordMatches(text);
  if (keywordMatch && keywordMatch.confidence > 40) {
    return keywordMatch;
  }

  // PRIORITY 5: Return brand match even if lower confidence
  if (brandMatch) {
    return brandMatch;
  }

  return {
    category: "",
    subcategory: "",
    partType: "",
    confidence: 0,
    matchReasons: ["No matching patterns found"],
  };
};

/**
 * Check brand-specific rules
 */
const checkBrandRules = (text, brand) => {
  // Try explicit brand first
  let detectedBrand = brand ? brand.toLowerCase() : null;

  // If no explicit brand, try to detect from text
  if (!detectedBrand) {
    detectedBrand = Object.keys(simpleBrandRules).find((b) => text.includes(b));
  }

  if (!detectedBrand || !simpleBrandRules[detectedBrand]) {
    return null;
  }

  const rules = simpleBrandRules[detectedBrand];

  for (const [keywords, rule] of Object.entries(rules)) {
    const keywordRegex = new RegExp(keywords, "i");
    if (keywordRegex.test(text)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        partType: rule.partType,
        confidence: rule.confidence,
        matchReasons: [
          `Brand rule: ${detectedBrand} - ${keywords.split("|")[0]}`,
        ],
      };
    }
  }

  return null;
};

/**
 * Find keyword matches
 */
const findKeywordMatches = (text) => {
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;

  Object.entries(acesCategories).forEach(([category, subcategories]) => {
    Object.entries(subcategories).forEach(([subcategory, partTypes]) => {
      partTypes.forEach((partType) => {
        const score = calculateScore(partType, words, text);

        if (score > bestScore && score > 20) {
          bestScore = score;
          bestMatch = {
            category,
            subcategory,
            partType,
            confidence: Math.min(85, score),
            matchReasons: [`Keyword match: "${partType}"`],
          };
        }
      });
    });
  });

  return bestMatch;
};

/**
 * Calculate simple scoring
 */
const calculateScore = (partType, words, fullText) => {
  const partWords = partType.toLowerCase().split(/\s+/);
  let score = 0;

  // Exact phrase match (highest score)
  if (fullText.includes(partType.toLowerCase())) {
    return 80;
  }

  // Word matching
  partWords.forEach((partWord) => {
    if (words.includes(partWord)) {
      if (partWord.length > 6) {
        score += 20; // Long words are more specific
      } else if (partWord.length > 4) {
        score += 15;
      } else {
        score += 10;
      }
    }
  });

  // Bonus for multiple word matches
  const matchedWords = partWords.filter((word) => words.includes(word));
  if (matchedWords.length > 1) {
    score += matchedWords.length * 5;
  }

  return score;
};

/**
 * Handle unmapped categories by assigning them to "Other" category
 */
const handleUnmappedCategory = (existingCategory) => {
  return {
    category: "Other",
    subcategory: "Unmapped Categories",
    partType: existingCategory, // Keep original category name as part type
    confidence: 50,
    matchReasons: [
      `Unmapped category: "${existingCategory}" → placed in "Other" category`,
    ],
  };
};

/**
 * Enhanced batch processing with category mapping and unmapped category handling
 */
export const batchCategorize = async (products, onProgress) => {
  const results = [];
  const batchSize = 100;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const batchResults = batch.map((product) => {
      const productName = product.name || product.Name || "";
      const description = product.description || product.Description || "";
      const brand = product.brand || product.Brand || "";
      const title = product.title || product.Title || "";
      const existingCategory = product.originalCategory || "";

      const suggestion = suggestCategory(
        productName,
        description,
        brand,
        title,
        existingCategory
      );

      // If no suggestion found but we have an existing category, map it to "Other"
      let finalSuggestion = suggestion;
      if (!suggestion.category && existingCategory) {
        finalSuggestion = handleUnmappedCategory(existingCategory);
      }

      let status = "low-confidence";
      if (finalSuggestion.confidence > 70) {
        status = "high-confidence";
      } else if (finalSuggestion.confidence > 40) {
        status = "needs-review";
      }

      return {
        ...product,
        suggestedCategory: finalSuggestion.category,
        suggestedSubcategory: finalSuggestion.subcategory,
        suggestedPartType: finalSuggestion.partType,
        confidence: finalSuggestion.confidence,
        matchReasons: finalSuggestion.matchReasons || [],
        status,
      };
    });
    results.push(...batchResults);

    // Update progress
    if (onProgress) {
      onProgress(results.length, products.length);
    }

    // Small delay to prevent blocking
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return results;
};
