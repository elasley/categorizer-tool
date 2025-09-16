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
        suggestedCategory: "",
        suggestedSubcategory: "",
        suggestedPartType: "",
        confidence: 0,
        status: "pending",
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
    },
  };

  products.forEach((product, index) => {
    if (product.name || product.title || product.description) {
      validation.stats.hasName++;
    }
    if (product.description) validation.stats.hasDescription++;
    if (product.brand) validation.stats.hasBrand++;
    if (product.partNumber) validation.stats.hasPartNumber++;
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

  const allHeaders = new Set();
  products.forEach((product) => {
    Object.keys(product).forEach((key) => allHeaders.add(key));
  });

  const priorityHeaders = [
    "Master SKU",
    "brand",
    "MPN",
    "title",
    "Parent Title",
    "description",
    "Parent Description",
    "UPC",
    "Category 1",
    "Category 2",
    "Category 3",
    "suggestedCategory",
    "suggestedSubcategory",
    "suggestedPartType",
    "confidence",
    "status",
  ];

  const finalHeaders = [];
  priorityHeaders.forEach((header) => {
    if (allHeaders.has(header)) {
      finalHeaders.push(header);
      allHeaders.delete(header);
    }
  });

  Array.from(allHeaders)
    .sort()
    .forEach((header) => {
      if (!["id", "matchReasons"].includes(header)) {
        finalHeaders.push(header);
      }
    });

  const csvContent = [
    finalHeaders.join(","),
    ...products.map((product) =>
      finalHeaders
        .map((header) => {
          let value = product[header] || "";

          if (typeof value === "string" && value.trim()) {
            value = stripHtmlTags(value);
          }

          if (header === "confidence" && typeof value === "number") {
            value = `${value}%`;
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
