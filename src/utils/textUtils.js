export const stripHtmlTags = (html) => {
  if (!html || typeof html !== "string") {
    return html;
  }

  let cleaned = html;

  cleaned = cleaned.replace(/<[^>]*>/g, "");
  cleaned = cleaned.replace(/\{[^}]*\}/g, "");
  cleaned = cleaned.replace(/font-family:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/font-size:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/color:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/padding:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/margin:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/text-align:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/background:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/border:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/width:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/height:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/display:[^;]*;?/gi, "");
  cleaned = cleaned.replace(/position:[^;]*;?/gi, "");

  cleaned = cleaned.replace(/style\s*=\s*["'][^"']*["']/gi, "");

  const htmlEntities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };

  Object.entries(htmlEntities).forEach(([entity, replacement]) => {
    cleaned = cleaned.replace(new RegExp(entity, "gi"), replacement);
  });

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  cleaned = cleaned.replace(/[{}]/g, "");
  cleaned = cleaned.replace(/;+/g, " ");

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
};

export const cleanProductData = (product) => {
  if (!product) return product;

  const cleaned = { ...product };
  const textFields = ["name", "title", "description", "brand"];

  textFields.forEach((field) => {
    if (cleaned[field]) {
      cleaned[field] = stripHtmlTags(cleaned[field]);
    }
  });

  return cleaned;
};

export const cleanProductsData = (products) => {
  if (!Array.isArray(products)) return products;

  return products.map(cleanProductData);
};
