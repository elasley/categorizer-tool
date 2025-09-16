// Export products to CSV (Excel compatible)
export function exportProductsToCSV(products) {
  if (!products || products.length === 0) {
    alert("No products to export");
    return;
  }
  // Only include products that have a suggestedCategory (i.e., are categorized)
  const filtered = products.filter(
    (p) => p.suggestedCategory && p.suggestedCategory !== ""
  );
  if (filtered.length === 0) {
    alert("No categorized products to export");
    return;
  }
  // Define columns to export
  const columns = [
    "id",
    "name",
    "brand",
    "MPN",
    "UPC",
    "suggestedCategory",
    "suggestedSubcategory",
    "suggestedPartType",
    "confidence",
    "status",
  ];
  const header = columns.join(",");
  const rows = filtered.map((p) =>
    columns
      .map((col) => {
        let val = p[col] !== undefined ? p[col] : "";
        if (typeof val === "string") {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      })
      .join(",")
  );
  const csvContent = [header, ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `taxonomy-products-${
    new Date().toISOString().split("T")[0]
  }.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}
