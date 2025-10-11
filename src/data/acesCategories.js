// src/data/acesCategories.js - Clean version without duplicates

const acesCategories = {
  "A/C & Heating": {
    "A/C Components": [
      "A/C Accumulators",
      "A/C Driers",
      "Condensors",
      "Compressor Components",
      "Expansion Valves",
      "Evaporators",
      "A/C Compressors",
      "Receiver Driers",
    ],
    "Blower System": [
      "Blower Motors",
      "Blower Motor Parts",
      "Cabin Air Filters",
      "HVAC Controls",
    ],
    "Heating Components": [
      "Heater Cores",
      "Heater Hoses",
      "Heater Control Valves",
    ],
  },

  Engine: {
    "Air Intake System": [
      "Air Filters",
      "Air Intake Hoses",
      "Throttle Bodies",
      "Mass Airflow Sensors",
      "Intake Manifolds",
    ],
    "Cooling System": [
      "Radiators",
      "Water Pumps",
      "Thermostats & Housing",
      "Radiator Hoses",
      "Cooling Fans",
      "Coolant Temperature Sensors",
    ],
    "Oil System": [
      "Oil Pumps",
      "Oil Filters",
      "Oil Pans",
      "Oil Coolers",
      "Oil Pressure Sensors",
    ],
    "Timing Components": [
      "Timing Belts",
      "Timing Chains",
      "Sprockets",
      "Timing Chain Tensioners",
    ],
    "Belts & Tensioners": [
      "Belts",
      "Pulleys",
      "Belt Tensioners",
      "Serpentine Belts",
    ],
  },

  "Brake System": {
    "Brake Components": [
      "Brake Pads",
      "Brake Rotors",
      "Brake Drums",
      "Brake Shoes",
      "Brake Calipers",
    ],
    "Brake Hydraulics": [
      "Brake Master Cylinders",
      "Brake Lines",
      "Brake Hoses",
      "ABS Components",
    ],
  },

  "Fuel System": {
    "Fuel Delivery": [
      "Fuel Pumps",
      "Fuel Filters",
      "Fuel Injectors",
      "Fuel Lines",
    ],
    "Fuel Storage": ["Fuel Tanks", "Fuel Caps", "Fuel Sending Units"],
  },

  Electrical: {
    "Charging System": [
      "Alternators",
      "Starters",
      "Batteries",
      "Battery Cables",
    ],
    Lighting: ["Headlights", "Tail Lights", "Turn Signals", "LED Lights"],
    "Ignition System": ["Spark Plugs", "Ignition Coils", "Spark Plug Wires"],
  },

  Drivetrain: {
    Transmission: [
      "Transmission Filters",
      "Transmission Mounts",
      "Shift Solenoids",
      "Torque Converters",
    ],
    Driveline: ["Drive Shafts", "U-Joints", "CV Joints", "Axles"],
    "Clutch System": [
      "Clutch Discs",
      "Pressure Plates",
      "Release Bearings",
      "Clutch Masters",
    ],
  },

  "Air System": {
    "Air Brake Components": [
      "Air Compressors",
      "Air Dryers",
      "Air Tanks",
      "Glad Hands",
      "Air Valves",
      "Brake Chambers",
    ],
    "Air Lines & Fittings": [
      "Air Hoses",
      "Air Fittings",
      "Quick Connect Fittings",
      "Air Line Assemblies",
    ],
    "Suspension Air": [
      "Air Bags",
      "Air Springs",
      "Height Control Valves",
      "Air Suspension Components",
    ],
  },

  "Fluids & Chemicals": {
    "Adhesives & Sealants": [
      "RTV Silicone",
      "Gasket Makers",
      "Thread Sealants",
      "Epoxy Adhesives",
      "Windshield Adhesives",
      "General Trim Adhesives",
      "Trim Adhesives",
      "Repair Tapes",
      "Masking Tapes",
      "Molding Tapes",
      "Electrical Tape",
    ],
    "Body & Paint Supplies": [
      "Sandpaper",
      "Sanding Discs",
      "Abrasive Sheets",
      "Body Filler",
      "Primer",
      "Touch Up Paint",
    ],
    "Cleaners & Degreasers": [
      "All-Purpose Cleaners",
      "Brake Cleaners",
      "Degreasers",
      "Hand Cleaners",
    ],
    Lubricants: ["Motor Oil", "Gear Oil", "Grease", "Penetrating Oil"],
  },

  "Tools & Equipment": {
    "Air Tools": [
      "Air Impact Wrenches",
      "Air Ratchets",
      "Air Hammers",
      "Air Drills",
    ],
    "Hand Tools": [
      "Socket Sets",
      "Wrenches",
      "Screwdrivers",
      "Pliers",
      "Hammers",
      "Hand Pads",
    ],
    "Power Tools": [
      "Electric Drills",
      "Angle Grinders",
      "Impact Drivers",
      "Reciprocating Saws",
      "Disc Pad Assemblies",
    ],
    "Metal Working Abrasives": [
      "Cutting Wheels",
      "Grinding Wheels",
      "Flap Discs",
      "Wire Brushes",
      "Abrasive Discs",
      "Surface Conditioning Discs",
      "Bristle Discs",
      "Sanding Discs",
    ],
  },

  "Welding Supplies": {
    "Welding Abrasives": ["Welding Wire Brushes", "Welding Grinding Wheels"],
    "Welding Equipment": ["MIG Welders", "TIG Welders", "Welding Helmets"],
  },

  "Safety Equipment": {
    "Personal Protective Equipment": [
      "Safety Glasses",
      "Work Gloves",
      "Hard Hats",
      "Safety Vests",
      "Chin Straps",
    ],
    "Vehicle Safety": [
      "Warning Triangles",
      "Fire Extinguishers",
      "First Aid Kits",
      "DOT Compliance",
    ],
  },

  "Trailer Parts": {
    "Trailer Electrical": [
      "Trailer Lights",
      "Wiring Harnesses",
      "Trailer Plugs",
      "Breakaway Systems",
    ],
    "Trailer Hardware": [
      "Trailer Hitches",
      "Couplers",
      "Safety Chains",
      "Trailer Jacks",
    ],
    "Trailer Suspension": [
      "Trailer Springs",
      "Trailer Axles",
      "Trailer Bearings",
      "Hub Assemblies",
    ],
  },

  "Steering & Suspension": {
    "Steering Components": [
      "Tie Rods",
      "Tie Rod Ends",
      "Ball Joints",
      "Steering Gearboxes",
      "Power Steering Pumps",
      "Steering Wheels",
      "Steering Columns",
      "Rack and Pinion",
    ],
    "Suspension Components": [
      "Shock Absorbers",
      "Struts",
      "Springs",
      "Control Arms",
      "Sway Bar Links",
      "Bushings",
      "Coil Springs",
      "Leaf Springs",
    ],
  },

  "Exhaust & Aftertreatment": {
    "Exhaust Components": [
      "Mufflers",
      "Exhaust Pipes",
      "Catalytic Converters",
      "Headers",
      "Resonators",
      "Exhaust Tips",
    ],
    Aftertreatment: ["DPF Filters", "SCR Systems", "DEF Tanks", "NOx Sensors"],
  },

  "Body & Cab": {
    "Body Components": [
      "Doors",
      "Hoods",
      "Fenders",
      "Bumpers",
      "Grilles",
      "Mirrors",
    ],
    Interior: ["Seats", "Dashboards", "Door Panels", "Floor Mats"],
  },

  "Wheel End": {
    "Wheel Components": [
      "Wheel Bearings",
      "Wheel Hubs",
      "Wheel Studs",
      "Lug Nuts",
    ],
    Tires: ["Commercial Tires", "Passenger Tires", "Tire Pressure Sensors"],
  },

  "Hydraulic & PTO": {
    "Hydraulic Components": [
      "Hydraulic Pumps",
      "Hydraulic Cylinders",
      "Hydraulic Hoses",
      "Hydraulic Fittings",
    ],
    "PTO Components": ["PTO Shafts", "PTO Switches", "PTO Covers"],
  },

  "Cargo Control": {
    "Cargo Management": [
      "Tie Downs",
      "Cargo Straps",
      "Cargo Nets",
      "Load Bars",
    ],
  },

  Accessories: {
    "Vehicle Accessories": [
      "12V Accessories",
      "Phone Mounts",
      "Cup Holders",
      "Storage Solutions",
    ],
  },
};

// Helper functions
const getMainCategories = () => Object.keys(acesCategories);

const getSubcategories = (category) => {
  return Object.keys(acesCategories[category] || {});
};

const getPartTypes = (category, subcategory) => {
  return acesCategories[category]?.[subcategory] || [];
};

const getAllCategories = () => Object.keys(acesCategories);
const getAllSubcategories = (category) =>
  Object.keys(acesCategories[category] || {});
const getAllPartTypes = (category, subcategory) =>
  acesCategories[category]?.[subcategory] || [];

// Export everything with multiple names for compatibility
export { acesCategories };
export { acesCategories as productCategories };
export { getMainCategories, getSubcategories, getPartTypes };
export { getAllCategories, getAllSubcategories, getAllPartTypes };

// Default export
export default acesCategories;
