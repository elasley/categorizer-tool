// src/utils/categoryMatcher.js - Simplified version that works with your existing structure

import { acesCategories } from "../data/acesCategories";

// Enhanced brand rules with comprehensive automotive brands
const simpleBrandRules = {
  // Brake specialists
  bendix: {
    "brake pad|brake pads|pad": {
      category: "Brake System",
      subcategory: "Brake Components",
      partType: "Brake Pads",
      confidence: 95,
    },
    "brake rotor|rotor|disc": {
      category: "Brake System",
      subcategory: "Brake Components",
      partType: "Brake Rotors",
      confidence: 95,
    },
    "brake caliper|caliper": {
      category: "Brake System",
      subcategory: "Brake Components",
      partType: "Brake Calipers",
      confidence: 95,
    },
  },
  raybestos: {
    "brake pad|brake pads|pad": {
      category: "Brake System",
      subcategory: "Brake Components",
      partType: "Brake Pads",
      confidence: 95,
    },
  },
  wagner: {
    "brake pad|brake pads|pad": {
      category: "Brake System",
      subcategory: "Brake Components",
      partType: "Brake Pads",
      confidence: 95,
    },
  },

  // Engine specialists
  gates: {
    "timing belt|belt": {
      category: "Engine",
      subcategory: "Timing Components",
      partType: "Timing Belts",
      confidence: 95,
    },
    "water pump|pump": {
      category: "Engine",
      subcategory: "Cooling System",
      partType: "Water Pumps",
      confidence: 90,
    },
    "hose|radiator hose": {
      category: "Engine",
      subcategory: "Cooling System",
      partType: "Radiator Hoses",
      confidence: 90,
    },
  },
  dayco: {
    "timing belt|belt": {
      category: "Engine",
      subcategory: "Timing Components",
      partType: "Timing Belts",
      confidence: 95,
    },
    "serpentine belt": {
      category: "Engine",
      subcategory: "Belts & Tensioners",
      partType: "Serpentine Belts",
      confidence: 95,
    },
  },
  continental: {
    "timing belt|belt": {
      category: "Engine",
      subcategory: "Timing Components",
      partType: "Timing Belts",
      confidence: 95,
    },
  },

  // Filtration specialists
  fram: {
    "oil filter|filter": {
      category: "Engine",
      subcategory: "Oil System",
      partType: "Oil Filters",
      confidence: 95,
    },
    "air filter": {
      category: "Engine",
      subcategory: "Air Intake System",
      partType: "Air Filters",
      confidence: 95,
    },
    "cabin filter": {
      category: "A/C & Heating",
      subcategory: "Blower System",
      partType: "Cabin Air Filters",
      confidence: 95,
    },
  },
  wix: {
    "oil filter|filter": {
      category: "Engine",
      subcategory: "Oil System",
      partType: "Oil Filters",
      confidence: 95,
    },
    "air filter": {
      category: "Engine",
      subcategory: "Air Intake System",
      partType: "Air Filters",
      confidence: 95,
    },
  },
  mann: {
    "oil filter|filter": {
      category: "Engine",
      subcategory: "Oil System",
      partType: "Oil Filters",
      confidence: 95,
    },
  },

  // Chemical/Fluid specialists
  "3m": {
    "sandpaper|sanding disc|body work|abrasive": {
      category: "Fluids & Chemicals",
      subcategory: "Body & Paint Supplies",
      partType: "Sandpaper",
      confidence: 95,
    },
    "adhesive|sealant": {
      category: "Fluids & Chemicals",
      subcategory: "Adhesives & Sealants",
      partType: "RTV Silicone",
      confidence: 90,
    },
  },
  loctite: {
    "threadlocker|thread locker": {
      category: "Fluids & Chemicals",
      subcategory: "Adhesives & Sealants",
      partType: "Thread Sealants",
      confidence: 95,
    },
    "gasket maker": {
      category: "Fluids & Chemicals",
      subcategory: "Adhesives & Sealants",
      partType: "Gasket Makers",
      confidence: 95,
    },
  },
  mobil: {
    "motor oil|oil": {
      category: "Fluids & Chemicals",
      subcategory: "Lubricants",
      partType: "Motor Oil",
      confidence: 95,
    },
  },
  castrol: {
    "motor oil|oil": {
      category: "Fluids & Chemicals",
      subcategory: "Lubricants",
      partType: "Motor Oil",
      confidence: 95,
    },
  },
  valvoline: {
    "motor oil|oil": {
      category: "Fluids & Chemicals",
      subcategory: "Lubricants",
      partType: "Motor Oil",
      confidence: 95,
    },
  },

  // Electrical specialists
  ngk: {
    "spark plug|plug": {
      category: "Electrical",
      subcategory: "Ignition System",
      partType: "Spark Plugs",
      confidence: 95,
    },
  },
  denso: {
    "spark plug|plug": {
      category: "Electrical",
      subcategory: "Ignition System",
      partType: "Spark Plugs",
      confidence: 95,
    },
    alternator: {
      category: "Electrical",
      subcategory: "Charging System",
      partType: "Alternators",
      confidence: 95,
    },
    starter: {
      category: "Electrical",
      subcategory: "Charging System",
      partType: "Starters",
      confidence: 95,
    },
  },
  bosch: {
    "spark plug|plug": {
      category: "Electrical",
      subcategory: "Ignition System",
      partType: "Spark Plugs",
      confidence: 95,
    },
    alternator: {
      category: "Electrical",
      subcategory: "Charging System",
      partType: "Alternators",
      confidence: 95,
    },
    "fuel injector|injector": {
      category: "Fuel System",
      subcategory: "Fuel Delivery",
      partType: "Fuel Injectors",
      confidence: 95,
    },
  },

  // AC specialists
  "four seasons": {
    "compressor|a/c compressor": {
      category: "A/C & Heating",
      subcategory: "A/C Components",
      partType: "A/C Compressors",
      confidence: 95,
    },
    condenser: {
      category: "A/C & Heating",
      subcategory: "A/C Components",
      partType: "Condensors",
      confidence: 95,
    },
  },
  santech: {
    "a/c|air conditioning": {
      category: "A/C & Heating",
      subcategory: "A/C Components",
      partType: "A/C Compressors",
      confidence: 90,
    },
  },

  // Suspension specialists
  monroe: {
    "shock|strut|shock absorber": {
      category: "Steering & Suspension",
      subcategory: "Suspension Components",
      partType: "Shock Absorbers",
      confidence: 95,
    },
  },
  kyb: {
    "shock|strut|shock absorber": {
      category: "Steering & Suspension",
      subcategory: "Suspension Components",
      partType: "Shock Absorbers",
      confidence: 95,
    },
  },
  gabriel: {
    "shock|strut|shock absorber": {
      category: "Steering & Suspension",
      subcategory: "Suspension Components",
      partType: "Shock Absorbers",
      confidence: 95,
    },
  },

  // Fuel system specialists
  carter: {
    "fuel pump|pump": {
      category: "Fuel System",
      subcategory: "Fuel Delivery",
      partType: "Fuel Pumps",
      confidence: 95,
    },
  },
  airtex: {
    "fuel pump|pump": {
      category: "Fuel System",
      subcategory: "Fuel Delivery",
      partType: "Fuel Pumps",
      confidence: 95,
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

  // Enhanced partial/fuzzy mappings based on keywords
  "motor oil": {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 95,
    matchType: "partial",
  },
  "gear oil": {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Gear Oil",
    confidence: 95,
    matchType: "partial",
  },
  oil: {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 80,
    matchType: "partial",
  },
  fluid: {
    category: "Fluids & Chemicals",
    subcategory: "Lubricants",
    partType: "Motor Oil",
    confidence: 75,
    matchType: "partial",
  },
  "brake cleaner": {
    category: "Fluids & Chemicals",
    subcategory: "Cleaners & Degreasers",
    partType: "Brake Cleaners",
    confidence: 95,
    matchType: "partial",
  },
  degreaser: {
    category: "Fluids & Chemicals",
    subcategory: "Cleaners & Degreasers",
    partType: "Degreasers",
    confidence: 90,
    matchType: "partial",
  },
  chemical: {
    category: "Fluids & Chemicals",
    subcategory: "Cleaners & Degreasers",
    partType: "All-Purpose Cleaners",
    confidence: 70,
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
  "brake pad": {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Pads",
    confidence: 95,
    matchType: "partial",
  },
  "brake rotor": {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Rotors",
    confidence: 95,
    matchType: "partial",
  },
  "brake caliper": {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Calipers",
    confidence: 95,
    matchType: "partial",
  },
  "brake drum": {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Drums",
    confidence: 95,
    matchType: "partial",
  },
  brake: {
    category: "Brake System",
    subcategory: "Brake Components",
    partType: "Brake Pads",
    confidence: 80,
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
  "oil filter": {
    category: "Engine",
    subcategory: "Oil System",
    partType: "Oil Filters",
    confidence: 95,
    matchType: "partial",
  },
  "air filter": {
    category: "Engine",
    subcategory: "Air Intake System",
    partType: "Air Filters",
    confidence: 95,
    matchType: "partial",
  },
  "fuel filter": {
    category: "Fuel System",
    subcategory: "Fuel Delivery",
    partType: "Fuel Filters",
    confidence: 95,
    matchType: "partial",
  },
  "cabin filter": {
    category: "A/C & Heating",
    subcategory: "Blower System",
    partType: "Cabin Air Filters",
    confidence: 95,
    matchType: "partial",
  },
  "timing belt": {
    category: "Engine",
    subcategory: "Timing Components",
    partType: "Timing Belts",
    confidence: 95,
    matchType: "partial",
  },
  "serpentine belt": {
    category: "Engine",
    subcategory: "Belts & Tensioners",
    partType: "Serpentine Belts",
    confidence: 95,
    matchType: "partial",
  },
  "water pump": {
    category: "Engine",
    subcategory: "Cooling System",
    partType: "Water Pumps",
    confidence: 95,
    matchType: "partial",
  },
  radiator: {
    category: "Engine",
    subcategory: "Cooling System",
    partType: "Radiators",
    confidence: 90,
    matchType: "partial",
  },
  filter: {
    category: "Engine",
    subcategory: "Oil System",
    partType: "Oil Filters",
    confidence: 70,
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
export const getCategoryMappingStats = (
  products,
  categories = acesCategories
) => {
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
 * Enhanced main categorization function with better prioritization
 */
export const suggestCategory = (
  productName,
  description = "",
  brand = "",
  title = "",
  existingCategory = "",
  categories = acesCategories
) => {
  // Log which categories are being used
  const isUsingCustomCategories = categories !== acesCategories;
  if (isUsingCustomCategories) {
    console.log(
      "[suggestCategory] Using UPLOADED CATEGORIES",
      Object.keys(categories)
    );
  } else {
    console.log("[suggestCategory] Using DEFAULT ACES CATEGORIES");
  }

  // Clean and normalize input text
  const cleanText = (str) =>
    str
      ? str
          .toLowerCase()
          .trim()
          .replace(/[^\w\s]/g, " ")
          .replace(/\s+/g, " ")
      : "";

  const cleanProductName = cleanText(productName);
  const cleanDescription = cleanText(description);
  const cleanTitle = cleanText(title);
  const cleanBrand = cleanText(brand);

  const combinedText =
    `${cleanProductName} ${cleanTitle} ${cleanDescription} ${cleanBrand}`.trim();

  if (!combinedText) {
    return {
      category: "",
      subcategory: "",
      partType: "",
      confidence: 0,
      matchReasons: ["No text provided"],
    };
  }

  let results = [];

  // PRIORITY 1: Brand-specific rules (highest confidence when matched)
  const brandMatch = checkBrandRules(combinedText, cleanBrand);
  if (brandMatch) {
    results.push({
      ...brandMatch,
      source: "brand",
      weight: brandMatch.confidence * 1.2, // Brand matches get bonus weight
    });
  }

  // PRIORITY 2: Detailed keyword analysis of product name and title (most important fields)
  const primaryText = `${cleanProductName} ${cleanTitle}`.trim();
  if (primaryText) {
    const primaryMatch = findKeywordMatches(
      primaryText,
      cleanProductName,
      cleanTitle,
      categories
    );
    if (primaryMatch && primaryMatch.confidence > 30) {
      results.push({
        ...primaryMatch,
        source: "primary_keywords",
        weight: primaryMatch.confidence * 1.1, // Primary text gets bonus
      });
    }
  }

  // PRIORITY 3: Full text keyword analysis
  const fullTextMatch = findKeywordMatches(
    combinedText,
    cleanProductName,
    cleanDescription,
    categories
  );
  if (fullTextMatch && fullTextMatch.confidence > 25) {
    results.push({
      ...fullTextMatch,
      source: "full_keywords",
      weight: fullTextMatch.confidence,
    });
  }

  // PRIORITY 4: Existing category mapping (as fallback)
  if (existingCategory) {
    const categoryMapping = mapExistingCategory(existingCategory);
    if (categoryMapping) {
      results.push({
        ...categoryMapping,
        source: "category_mapping",
        weight: categoryMapping.confidence * 0.8, // Lower weight for generic mappings
      });
    }
  }

  // Select the best result
  if (results.length === 0) {
    return {
      category: "",
      subcategory: "",
      partType: "",
      confidence: 0,
      matchReasons: ["No matching patterns found"],
    };
  }

  // Sort by weighted confidence and pick the best
  results.sort((a, b) => b.weight - a.weight);
  const bestResult = results[0];

  // Apply final confidence adjustments
  let finalConfidence = Math.min(95, bestResult.confidence);

  // Boost confidence if multiple sources agree
  if (results.length > 1) {
    const topResults = results.slice(0, 2);
    if (topResults[0].category === topResults[1].category) {
      finalConfidence = Math.min(98, finalConfidence + 10);
      bestResult.matchReasons.push("Multiple sources confirm category");
    }
  }

  return {
    category: bestResult.category,
    subcategory: bestResult.subcategory,
    partType: bestResult.partType,
    confidence: finalConfidence,
    matchReasons: [
      ...bestResult.matchReasons,
      `Best match from ${bestResult.source} (weight: ${Math.round(
        bestResult.weight
      )})`,
    ],
  };
};

// Modified helper functions to accept a categories parameter where needed

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
 * Enhanced keyword matching with better context analysis
 */
const findKeywordMatches = (
  text,
  productName = "",
  description = "",
  categories = acesCategories
) => {
  // Ensure text is a string
  if (typeof text !== "string") {
    console.warn("findKeywordMatches received non-string text:", text);
    text = String(text || "");
  }
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;
  let allMatches = [];
  Object.entries(categories).forEach(([category, subcategories]) => {
    if (!subcategories || typeof subcategories !== "object") return;
    Object.entries(subcategories).forEach(([subcategory, partTypes]) => {
      if (!Array.isArray(partTypes)) return;
      partTypes.forEach((partType) => {
        const score = calculateScore(
          partType,
          words,
          text,
          productName,
          description,
          categories
        );

        if (score > 25) {
          // Lower threshold to capture more potential matches
          allMatches.push({
            category,
            subcategory,
            partType,
            score,
            confidence: Math.min(90, score),
          });
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            category,
            subcategory,
            partType,
            confidence: Math.min(90, score),
            matchReasons: [`Keyword match: "${partType}" (score: ${score})`],
          };
        }
      });
    });
  });

  // If we have a good match, validate it makes sense contextually
  if (bestMatch && bestScore > 40) {
    // Additional context validation
    const contextValidation = validateMatchContext(
      bestMatch,
      text,
      productName,
      description
    );
    if (contextValidation.isValid) {
      bestMatch.confidence = Math.min(
        90,
        bestMatch.confidence + contextValidation.bonusPoints
      );
      bestMatch.matchReasons.push(...contextValidation.reasons);
    } else {
      bestMatch.confidence = Math.max(
        30,
        bestMatch.confidence - contextValidation.penaltyPoints
      );
      bestMatch.matchReasons.push(...contextValidation.reasons);
    }
  }

  return bestMatch;
};

/**
 * Validate that the matched category makes sense in context
 */
const validateMatchContext = (
  match,
  text,
  productName = "",
  description = ""
) => {
  const allText = `${text} ${productName} ${description}`.toLowerCase();
  let bonusPoints = 0;
  let penaltyPoints = 0;
  let reasons = [];

  // Context validation rules
  const validationRules = {
    "Brake System": {
      supportiveTerms: [
        "brake",
        "stop",
        "rotor",
        "pad",
        "caliper",
        "disc",
        "drum",
      ],
      conflictingTerms: ["engine", "transmission", "electrical", "spark"],
      bonus: 10,
      penalty: 20,
    },
    Engine: {
      supportiveTerms: [
        "engine",
        "motor",
        "timing",
        "cooling",
        "oil",
        "belt",
        "pump",
      ],
      conflictingTerms: ["brake", "suspension", "trailer"],
      bonus: 10,
      penalty: 15,
    },
    Electrical: {
      supportiveTerms: [
        "electrical",
        "battery",
        "alternator",
        "starter",
        "ignition",
        "spark",
        "wire",
      ],
      conflictingTerms: ["brake", "hydraulic", "mechanical"],
      bonus: 10,
      penalty: 15,
    },
    "A/C & Heating": {
      supportiveTerms: [
        "air conditioning",
        "ac",
        "hvac",
        "heater",
        "blower",
        "compressor",
        "condenser",
      ],
      conflictingTerms: ["brake", "engine oil", "transmission"],
      bonus: 15,
      penalty: 20,
    },
    "Tools & Equipment": {
      supportiveTerms: [
        "tool",
        "wrench",
        "socket",
        "drill",
        "grinder",
        "cutting",
        "abrasive",
      ],
      conflictingTerms: ["brake pad", "engine part", "filter"],
      bonus: 10,
      penalty: 25,
    },
    "Fluids & Chemicals": {
      supportiveTerms: [
        "oil",
        "fluid",
        "lubricant",
        "chemical",
        "cleaner",
        "sealant",
        "adhesive",
      ],
      conflictingTerms: ["metal", "plastic part", "component"],
      bonus: 10,
      penalty: 15,
    },
  };

  const categoryRule = validationRules[match.category];
  if (categoryRule) {
    // Check for supportive terms
    const supportiveFound = categoryRule.supportiveTerms.some((term) =>
      allText.includes(term)
    );
    if (supportiveFound) {
      bonusPoints = categoryRule.bonus;
      reasons.push("Context supports category assignment");
    }

    // Check for conflicting terms
    const conflictingFound = categoryRule.conflictingTerms.some((term) =>
      allText.includes(term)
    );
    if (conflictingFound) {
      penaltyPoints = categoryRule.penalty;
      reasons.push("Context conflicts with category assignment");
    }
  }

  return {
    isValid: bonusPoints > penaltyPoints,
    bonusPoints,
    penaltyPoints,
    reasons,
  };
};

/**
 * Enhanced scoring algorithm with better context awareness
 */
const calculateScore = (
  partType,
  words,
  fullText,
  productName = "",
  description = "",
  categories = acesCategories
) => {
  const partWords = partType.toLowerCase().split(/\s+/);
  const allText = `${fullText} ${productName} ${description}`.toLowerCase();
  let score = 0;

  // Exact phrase match in any text (highest score)
  if (allText.includes(partType.toLowerCase())) {
    return 90;
  }

  // Check for partial phrase matches
  const partTypeWords = partType.toLowerCase().split(/\s+/);
  if (partTypeWords.length > 1) {
    const consecutiveWords = [];
    for (let i = 0; i < partTypeWords.length - 1; i++) {
      const phrase = partTypeWords.slice(i, i + 2).join(" ");
      if (allText.includes(phrase)) {
        score += 35; // High score for consecutive word matches
        consecutiveWords.push(phrase);
      }
    }
  }

  // Word matching with better specificity scoring
  let matchedWords = 0;
  partWords.forEach((partWord) => {
    if (partWord.length <= 2) return; // Skip very short words

    if (words.includes(partWord) || allText.includes(partWord)) {
      matchedWords++;
      if (partWord.length > 8) {
        score += 25; // Very long words are highly specific
      } else if (partWord.length > 6) {
        score += 20; // Long words are more specific
      } else if (partWord.length > 4) {
        score += 15;
      } else {
        score += 10;
      }

      // Bonus for automotive-specific terms
      const specificTerms = [
        "brake",
        "engine",
        "transmission",
        "clutch",
        "alternator",
        "compressor",
        "radiator",
        "filter",
        "sensor",
        "pump",
        "valve",
      ];
      if (specificTerms.includes(partWord)) {
        score += 10;
      }
    }
  });

  // Strong bonus for multiple word matches
  if (matchedWords > 1) {
    score += matchedWords * 8;
  }

  // Complete word coverage bonus
  if (matchedWords === partWords.length && partWords.length > 1) {
    score += 20;
  }

  // Penalty for very generic matches
  const genericTerms = ["part", "component", "system", "kit", "set"];
  if (
    partWords.some((word) => genericTerms.includes(word)) &&
    matchedWords === 1
  ) {
    score -= 15;
  }

  return Math.max(0, score);
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
export const batchCategorize = async (
  products,
  onProgress,
  categories = acesCategories
) => {
  const isUsingCustomCategories = categories !== acesCategories;
  console.log("[batchCategorize] Starting categorization");
  console.log(
    `[batchCategorize] Using ${
      isUsingCustomCategories ? "UPLOADED" : "DEFAULT ACES"
    } categories`
  );
  console.log(
    `[batchCategorize] Available categories: ${Object.keys(categories).join(
      ", "
    )}`
  );

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
        existingCategory,
        categories
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
