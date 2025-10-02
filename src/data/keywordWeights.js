// Keyword weights for better categorization scoring
export const keywordWeights = {
  // High-confidence automotive terms
  highConfidence: {
    // Brake system
    "brake pad": 95,
    "brake rotor": 95,
    "brake caliper": 95,
    "brake drum": 95,
    "brake shoe": 95,

    // Engine components
    "timing belt": 95,
    "water pump": 95,
    "oil filter": 95,
    "air filter": 95,
    "serpentine belt": 95,
    radiator: 90,
    thermostat: 90,

    // Electrical
    "spark plug": 95,
    alternator: 95,
    starter: 95,
    battery: 90,
    "ignition coil": 95,

    // Fuel system
    "fuel pump": 95,
    "fuel filter": 95,
    "fuel injector": 95,

    // AC/Heating
    compressor: 90,
    condenser: 90,
    evaporator: 90,
    "heater core": 95,
    "blower motor": 95,

    // Fluids
    "motor oil": 95,
    "gear oil": 95,
    "brake fluid": 95,
    coolant: 90,
  },

  // Medium confidence terms
  mediumConfidence: {
    brake: 80,
    engine: 75,
    belt: 70,
    pump: 65,
    filter: 60,
    oil: 70,
    fluid: 65,
    electrical: 70,
    sensor: 75,
    hose: 70,
    gasket: 75,
    seal: 70,
  },

  // Low confidence generic terms
  lowConfidence: {
    part: 30,
    component: 35,
    system: 40,
    kit: 45,
    set: 40,
    tool: 50,
    equipment: 45,
  },

  // Context boosters (terms that increase confidence when found together)
  contextBoosters: {
    automotive: ["car", "truck", "vehicle", "auto", "automotive"],
    commercial: ["heavy duty", "commercial", "fleet", "truck"],
    performance: ["performance", "racing", "sport", "high performance"],
    oem: ["oem", "original", "genuine", "factory"],
    aftermarket: ["aftermarket", "replacement", "compatible"],
  },

  // Negative keywords (reduce confidence)
  negativeKeywords: {
    nonAutomotive: ["home", "garden", "kitchen", "furniture", "clothing"],
    vague: ["misc", "miscellaneous", "other", "general", "assorted"],
  },
};

// Function to calculate keyword-based confidence score
export const calculateKeywordScore = (
  text,
  category,
  subcategory,
  partType
) => {
  const lowerText = text.toLowerCase();
  let score = 0;
  let matches = [];

  // Check high confidence keywords
  for (const [keyword, weight] of Object.entries(
    keywordWeights.highConfidence
  )) {
    if (lowerText.includes(keyword)) {
      score += weight;
      matches.push(`High: ${keyword} (+${weight})`);
    }
  }

  // Check medium confidence keywords
  for (const [keyword, weight] of Object.entries(
    keywordWeights.mediumConfidence
  )) {
    if (lowerText.includes(keyword)) {
      score += weight;
      matches.push(`Medium: ${keyword} (+${weight})`);
    }
  }

  // Check context boosters
  for (const [context, keywords] of Object.entries(
    keywordWeights.contextBoosters
  )) {
    const hasContext = keywords.some((kw) => lowerText.includes(kw));
    if (hasContext) {
      score += 10;
      matches.push(`Context: ${context} (+10)`);
    }
  }

  // Apply negative keywords
  for (const [context, keywords] of Object.entries(
    keywordWeights.negativeKeywords
  )) {
    const hasNegative = keywords.some((kw) => lowerText.includes(kw));
    if (hasNegative) {
      score -= 20;
      matches.push(`Negative: ${context} (-20)`);
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    matches,
  };
};

export default keywordWeights;
