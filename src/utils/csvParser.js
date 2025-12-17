import { stripHtmlTags } from "./textUtils";

export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedData = parseCSVText(text);
        resolve(parsedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
};

export const parseCSVText = (csvText) => {
  const delimiter = detectDelimiter(csvText);

  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (!inQuotes) {
        inQuotes = true;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(cleanField(currentField));
      currentField = "";
    } else if (char === "\n" && !inQuotes) {
      currentRow.push(cleanField(currentField));

      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(cleanField(currentField));
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    throw new Error("No data found in CSV file");
  }

  return convertToProducts(rows);
};

const detectDelimiter = (csvText) => {
  const delimiters = [",", ";", "\t", "|"];
  const sample = csvText.slice(0, 2000);

  let maxCount = 0;
  let bestDelimiter = ",";

  for (const delimiter of delimiters) {
    const count = (sample.match(new RegExp(`\\${delimiter}`, "g")) || [])
      .length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
};

const cleanField = (field) => {
  let cleaned = field.trim();

  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = stripHtmlTags(cleaned);

  const htmlEntities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
  };

  Object.entries(htmlEntities).forEach(([entity, replacement]) => {
    cleaned = cleaned.replace(new RegExp(entity, "gi"), replacement);
  });

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
};

const convertToProducts = (rows) => {
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => normalizeHeader(header));

  // Debug: Log headers
  console.log("CSV Headers:", rows[0]);
  console.log("Normalized Headers:", headers);

  const products = rows
    .slice(1)
    .map((row, index) => {
      const product = { id: index };

      headers.forEach((header, i) => {
        product[header] = row[i] || "";
      });

      if (!product.name && product.title) {
        product.name = product.title;
      }

      const hasData = Object.values(product).some(
        (value) => typeof value === "string" && value.length > 2
      );

      if (!hasData) return null;

      return {
        ...product,
        suggestedCategory: product.originalCategory || "",
        suggestedSubcategory: product.originalSubcategory || "",
        suggestedPartType: product.originalPartType || "",
        confidence: product.originalCategory ? 100 : 0,
        status: product.originalCategory ? "imported" : "pending",
        matchReasons: [],
      };
    })
    .filter((product) => product !== null);

  return products;
};

const normalizeHeader = (header) => {
  const mappings = {
    "product name": "name",
    product_name: "name",
    "item name": "name",
    title: "title",
    description: "description",
    desc: "description",
    details: "description",
    brand: "brand",
    manufacturer: "brand",
    "part number": "partNumber",
    part_number: "partNumber",
    sku: "partNumber",
    // Category mappings
    category: "originalCategory",
    "product category": "originalCategory",
    "main category": "originalCategory",
    "primary category": "originalCategory",
    "item category": "originalCategory",
    "parent category": "originalCategory",
    group: "originalCategory",
    "product group": "originalCategory",
    subcategory: "originalSubcategory",
    "product subcategory": "originalSubcategory",
    "sub category": "originalSubcategory",
    "secondary category": "originalSubcategory",
    "item subcategory": "originalSubcategory",
    subgroup: "originalSubcategory",
    "product subgroup": "originalSubcategory",
    "part type": "originalPartType",
    parttype: "originalPartType",
    "product type": "originalPartType",
    "part type": "originalPartType",
    type: "originalPartType",
    "item type": "originalPartType",
    part: "originalPartType",
    component: "originalPartType",
    "component type": "originalPartType",
    // Numbered category mappings
    "category 1": "originalCategory",
    "category 2": "originalSubcategory",
    "category 3": "originalPartType",
    category1: "originalCategory",
    category2: "originalSubcategory",
    category3: "originalPartType",
    "cat 1": "originalCategory",
    "cat 2": "originalSubcategory",
    "cat 3": "originalPartType",
    cat1: "originalCategory",
    cat2: "originalSubcategory",
    cat3: "originalPartType",
  };

  const normalized = header.toLowerCase().trim();
  return mappings[normalized] || header;
};

export const validateCSV = (products) => {
  const validation = {
    isValid: true,
    warnings: [],
    errors: [],
    stats: {
      totalProducts: products.length,
      hasName: 0,
      hasDescription: 0,
      hasBrand: 0,
      hasPartNumber: 0,
      hasCategory: 0,
      hasSubcategory: 0,
      hasPartType: 0,
    },
  };

  products.forEach((product, index) => {
    if (product.name || product.title || product.description) {
      validation.stats.hasName++;
    }
    if (product.description) validation.stats.hasDescription++;
    if (product.brand) validation.stats.hasBrand++;
    if (product.partNumber) validation.stats.hasPartNumber++;
    if (product.originalCategory) validation.stats.hasCategory++;
    if (product.originalSubcategory) validation.stats.hasSubcategory++;
    if (product.originalPartType) validation.stats.hasPartType++;
  });

  if (products.length === 0) {
    validation.isValid = false;
    validation.errors.push("No products found");
  }

  return validation;
};

export const generateSampleCSV = () => {
  const sampleData = `"Product Name","Description","Brand","Part Number"
"3M Sandpaper P320","Body work sanding disc","3M","31542"
"Gates Timing Belt","Heavy duty timing belt","Gates","T295"
"Bendix Brake Pads","Premium brake pads","Bendix","D1210"`;

  const blob = new Blob([sampleData], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-parts.csv";
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportToCSV = (
  products,
  filename = "categorized-products.csv"
) => {
  if (!products || products.length === 0) {
    return;
  }

  // Only export name and final categorization (rename suggestedX to final names)
  const finalHeaders = ["name", "category", "subcategory", "parttype"];

  const csvContent = [
    finalHeaders.join(","),
    ...products.map((product) =>
      finalHeaders
        .map((header) => {
          let value = "";

          // Map the suggested fields to the final export names
          if (header === "name") {
            value = product.title || product.name || "";
          } else if (header === "category") {
            value = product.suggestedCategory || "";
          } else if (header === "subcategory") {
            value = product.suggestedSubcategory || "";
          } else if (header === "parttype") {
            value = product.suggestedPartType || "";
          }

          if (typeof value === "string" && value.trim()) {
            value = stripHtmlTags(value);
          }

          if (typeof value === "string") {
            value = value.replace(/"/g, '""');
            if (
              value.includes(",") ||
              value.includes('"') ||
              value.includes("\n")
            ) {
              value = `"${value}"`;
            }
          }

          return value;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const getMainCategories = () => {
  const { acesCategories } = require("../data/acesCategories");
  return Object.keys(acesCategories);
};

export const getSubcategories = (category) => {
  const { acesCategories } = require("../data/acesCategories");
  return Object.keys(acesCategories[category] || {});
};

export const getPartTypes = (category, subcategory) => {
  const { acesCategories } = require("../data/acesCategories");
  return acesCategories[category]?.[subcategory] || [];
};

export const productCategories = () => {
  const { acesCategories } = require("../data/acesCategories");
  return acesCategories;
};

export const parseCategoryCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedData = parseCategoryCSVText(text);
        resolve(parsedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
};

export const parseCategoryCSVText = (csvText) => {
  const delimiter = detectDelimiter(csvText);
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (!inQuotes) {
        inQuotes = true;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(cleanField(currentField));
      currentField = "";
    } else if (char === "\n" && !inQuotes) {
      currentRow.push(cleanField(currentField));
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(cleanField(currentField));
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    throw new Error("No data found in CSV file");
  }

  return convertToCategories(rows);
};

const convertToCategories = (rows) => {
  if (rows.length === 0) return {};

  const headers = rows[0].map((header) => header.toLowerCase().trim());

  // Identify column indices
  const categoryIdx = headers.findIndex(
    (h) => h.includes("category") && !h.includes("sub")
  );
  const subcategoryIdx = headers.findIndex(
    (h) => h.includes("sub") || h.includes("secondary")
  );
  const partTypeIdx = headers.findIndex(
    (h) => h.includes("part") || h.includes("type")
  );

  if (categoryIdx === -1) {
    throw new Error("Could not identify 'Category' column");
  }

  const categories = {};

  rows.slice(1).forEach((row) => {
    const category = row[categoryIdx];
    const subcategory = subcategoryIdx !== -1 ? row[subcategoryIdx] : null;
    const partType = partTypeIdx !== -1 ? row[partTypeIdx] : null;

    if (!category) return;

    if (!categories[category]) {
      categories[category] = {};
    }

    if (subcategory) {
      if (!categories[category][subcategory]) {
        categories[category][subcategory] = [];
      }

      if (partType && !categories[category][subcategory].includes(partType)) {
        categories[category][subcategory].push(partType);
      }
    }
  });

  return categories;
};

export const validateCategoryCSV = (categories) => {
  const validation = {
    isValid: true,
    warnings: [],
    errors: [],
    stats: {
      totalCategories: Object.keys(categories).length,
      totalSubcategories: 0,
      totalPartTypes: 0,
    },
  };

  if (Object.keys(categories).length === 0) {
    validation.isValid = false;
    validation.errors.push("No categories found");
    return validation;
  }

  Object.values(categories).forEach((subcats) => {
    validation.stats.totalSubcategories += Object.keys(subcats).length;
    Object.values(subcats).forEach((partTypes) => {
      validation.stats.totalPartTypes += partTypes.length;
    });
  });

  return validation;
};
