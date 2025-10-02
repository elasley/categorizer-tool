// Enhanced brand rules for better categorization
export const brandRules = {
  // Brake specialists
  bendix: {
    defaultCategory: "Brake System",
    rules: {
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
  },
  raybestos: {
    defaultCategory: "Brake System",
    rules: {
      "brake pad|brake pads|pad": {
        category: "Brake System",
        subcategory: "Brake Components",
        partType: "Brake Pads",
        confidence: 95,
      },
    },
  },
  wagner: {
    defaultCategory: "Brake System",
    rules: {
      "brake pad|brake pads|pad": {
        category: "Brake System",
        subcategory: "Brake Components",
        partType: "Brake Pads",
        confidence: 95,
      },
    },
  },

  // Engine specialists
  gates: {
    defaultCategory: "Engine",
    rules: {
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
  },
  dayco: {
    defaultCategory: "Engine",
    rules: {
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
  },

  // Filter specialists
  fram: {
    defaultCategory: "Engine",
    rules: {
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
  },
  wix: {
    defaultCategory: "Engine",
    rules: {
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
  },

  // Chemical/Fluid specialists
  "3m": {
    defaultCategory: "Tools & Equipment",
    rules: {
      "sandpaper|sanding disc|body work|abrasive": {
        category: "Tools & Equipment",
        subcategory: "Metal Working Abrasives",
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
  },
  loctite: {
    defaultCategory: "Fluids & Chemicals",
    rules: {
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
  },

  // Oil brands
  mobil: {
    defaultCategory: "Fluids & Chemicals",
    rules: {
      "motor oil|oil": {
        category: "Fluids & Chemicals",
        subcategory: "Lubricants",
        partType: "Motor Oil",
        confidence: 95,
      },
    },
  },
  castrol: {
    defaultCategory: "Fluids & Chemicals",
    rules: {
      "motor oil|oil": {
        category: "Fluids & Chemicals",
        subcategory: "Lubricants",
        partType: "Motor Oil",
        confidence: 95,
      },
    },
  },
  valvoline: {
    defaultCategory: "Fluids & Chemicals",
    rules: {
      "motor oil|oil": {
        category: "Fluids & Chemicals",
        subcategory: "Lubricants",
        partType: "Motor Oil",
        confidence: 95,
      },
    },
  },

  // Electrical specialists
  ngk: {
    defaultCategory: "Electrical",
    rules: {
      "spark plug|plug": {
        category: "Electrical",
        subcategory: "Ignition System",
        partType: "Spark Plugs",
        confidence: 95,
      },
    },
  },
  denso: {
    defaultCategory: "Electrical",
    rules: {
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
    },
  },
  bosch: {
    defaultCategory: "Electrical",
    rules: {
      "spark plug|plug": {
        category: "Electrical",
        subcategory: "Ignition System",
        partType: "Spark Plugs",
        confidence: 95,
      },
      "fuel injector|injector": {
        category: "Fuel System",
        subcategory: "Fuel Delivery",
        partType: "Fuel Injectors",
        confidence: 95,
      },
    },
  },
};

export default brandRules;
