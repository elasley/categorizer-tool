import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import {
  ArrowLeft,
  Save,
  X,
  Package,
  Edit3,
  CheckCircle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

const ProductsViewPage = () => {
  const { fileUrl } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [parttypes, setParttypes] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [filteredParttypes, setFilteredParttypes] = useState([]);

  useEffect(() => {
    loadProducts();
    loadCategoriesData();
  }, [fileUrl]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const decodedUrl = decodeURIComponent(fileUrl);

      const { data, error } = await supabase.storage
        .from("product-uploads")
        .download(decodedUrl);

      if (error) throw error;

      const text = await data.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        toast.error("File is empty");
        return;
      }

      // Proper CSV parsing that handles quoted fields with commas
      const parseCSVLine = (line) => {
        const values = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"' && inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else if (char === '"') {
            // Toggle quote mode
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            // Field separator
            values.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        values.push(current.trim()); // Add last field
        return values;
      };

      const headers = parseCSVLine(lines[0]);
      console.log("CSV Headers:", headers);
      console.log("Total lines:", lines.length);

      const parsedProducts = lines.slice(1).map((line, index) => {
        const values = parseCSVLine(line);

        // Log all products to see the data
        console.log(`Product ${index} values:`, {
          name: values[0],
          description: values[1]?.substring(0, 50),
          sku: values[2],
          category: values[3],
          subcategory: values[4],
          parttype: values[5],
          confidence: values[6],
        });

        return {
          id: index,
          name: values[0] || "",
          description: values[1] || "",
          // Skip SKU at position 2
          category: values[3] || "",
          subcategory: values[4] || "",
          parttype: values[5] || "",
          confidence: values[6] || "",
        };
      });

      console.log("Parsed products:", parsedProducts);

      setProducts(parsedProducts);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriesData = async () => {
    try {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      const { data: subs } = await supabase
        .from("subcategories")
        .select("*")
        .order("name");
      const { data: pts } = await supabase
        .from("parttypes")
        .select("*")
        .order("name");

      setCategories(cats || []);
      setSubcategories(subs || []);
      setParttypes(pts || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const handleEdit = (product) => {
    console.log("Editing product:", product);
    console.log("Available categories:", categories);
    console.log("Available subcategories:", subcategories);
    console.log("Available parttypes:", parttypes);

    setEditingProduct({ ...product });

    // Use setTimeout to ensure state is updated before filtering
    setTimeout(() => {
      // Filter subcategories based on product's category
      if (product.category) {
        filterSubcategoriesByCategory(product.category);
      }
      // Filter parttypes based on product's subcategory
      if (product.subcategory) {
        filterParttypesBySubcategory(product.subcategory);
      }
    }, 0);
  };

  const filterSubcategoriesByCategory = async (categoryName) => {
    console.log("Filtering subcategories for category:", categoryName);
    if (!categoryName) {
      setFilteredSubcategories([]);
      return;
    }
    const category = categories.find((c) => c.name === categoryName);
    console.log("Found category:", category);
    if (category) {
      const filtered = subcategories.filter(
        (sub) => sub.category_id === category.id
      );
      console.log("Filtered subcategories:", filtered);
      setFilteredSubcategories(filtered);
    } else {
      console.log("Category not found in categories list");
      setFilteredSubcategories([]);
    }
  };

  const filterParttypesBySubcategory = async (subcategoryName) => {
    console.log("Filtering parttypes for subcategory:", subcategoryName);
    if (!subcategoryName) {
      setFilteredParttypes([]);
      return;
    }
    const subcategory = subcategories.find((s) => s.name === subcategoryName);
    console.log("Found subcategory:", subcategory);
    if (subcategory) {
      const filtered = parttypes.filter(
        (pt) => pt.subcategory_id === subcategory.id
      );
      console.log("Filtered parttypes:", filtered);
      setFilteredParttypes(filtered);
    } else {
      console.log("Subcategory not found in subcategories list");
      setFilteredParttypes([]);
    }
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    setSaving(true);
    const loadingToast = toast.loading("Saving changes...");

    try {
      // Find the category, subcategory, and parttype IDs
      const { data: categoryData, error: catError } = await supabase
        .from("categories")
        .select("id")
        .eq("name", editingProduct.category)
        .single();

      if (catError || !categoryData) {
        throw new Error(`Category "${editingProduct.category}" not found`);
      }

      const { data: subcategoryData, error: subError } = await supabase
        .from("subcategories")
        .select("id")
        .eq("name", editingProduct.subcategory)
        .eq("category_id", categoryData.id)
        .single();

      if (subError || !subcategoryData) {
        throw new Error(
          `Subcategory "${editingProduct.subcategory}" not found`
        );
      }

      const { data: parttypeData, error: ptError } = await supabase
        .from("parttypes")
        .select("id")
        .eq("name", editingProduct.parttype)
        .eq("subcategory_id", subcategoryData.id)
        .single();

      if (ptError || !parttypeData) {
        throw new Error(`Part type "${editingProduct.parttype}" not found`);
      }

      // Update products in database that match this file
      const decodedUrl = decodeURIComponent(fileUrl);
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: editingProduct.name,
          description: editingProduct.description,
          category_id: categoryData.id,
          subcategory_id: subcategoryData.id,
          parttype_id: parttypeData.id,
        })
        .eq("file_url", decodedUrl)
        .eq("name", products.find((p) => p.id === editingProduct.id)?.name);

      if (updateError) throw updateError;

      // Update local state
      const updatedProducts = products.map((p) =>
        p.id === editingProduct.id ? editingProduct : p
      );
      setProducts(updatedProducts);

      // Regenerate and upload new CSV file
      const csvHeaders = [
        "Name",
        "Description",
        "SKU",
        "Category",
        "Subcategory",
        "Part Type",
        "Confidence",
      ];
      const csvRows = updatedProducts.map((p) => [
        p.name || "",
        p.description || "",
        "", // Empty SKU column
        p.category || "",
        p.subcategory || "",
        p.parttype || "",
        p.confidence || "",
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });

      // Update the file in storage
      const { error: uploadError } = await supabase.storage
        .from("product-uploads")
        .update(decodedUrl, blob, {
          contentType: "text/csv",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      toast.success("✅ Product updated successfully!", { id: loadingToast });
      setEditingProduct(null);
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(`Failed to save: ${error.message}`, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingProduct(null);
  };

  const handleInputChange = (field, value) => {
    setEditingProduct((prev) => ({ ...prev, [field]: value }));

    // When category changes, filter subcategories and reset subcategory/parttype
    if (field === "category") {
      filterSubcategoriesByCategory(value);
      setEditingProduct((prev) => ({
        ...prev,
        category: value,
        subcategory: "",
        parttype: "",
      }));
      setFilteredParttypes([]);
    }

    // When subcategory changes, filter parttypes and reset parttype
    if (field === "subcategory") {
      filterParttypesBySubcategory(value);
      setEditingProduct((prev) => ({
        ...prev,
        subcategory: value,
        parttype: "",
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/dashboard/reports")}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Products View
              </h1>
              <p className="text-gray-600">View and edit product information</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border border-gray-200">
            <Package className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-gray-700">
              {products.length} Products
            </span>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase">
                    Product Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase">
                    ACES Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase">
                    Subcategory
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase">
                    Part Type
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase">
                    Confidence
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product, index) => (
                  <tr
                    key={product.id}
                    className={`transition-colors hover:bg-blue-50 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div
                        className="font-semibold text-gray-800"
                        title={product.name}
                      >
                        {truncateText(product.name, 20) || "Unnamed Product"}
                      </div>
                      {product.description && (
                        <div
                          className="text-sm text-gray-500 mt-1"
                          title={product.description}
                        >
                          {truncateText(product.description, 40)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-blue-600 font-medium">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-blue-600 font-medium">
                        {product.subcategory}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-blue-600 font-medium">
                        {product.parttype}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: product.confidence }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-700">
                            {product.confidence}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Good
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span className="text-sm font-semibold">Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {editingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Edit Product</h2>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Product Info Section */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    Product Title
                  </label>
                  <input
                    type="text"
                    value={editingProduct?.name || ""}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter product title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingProduct?.description || ""}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                    placeholder="Enter product description"
                  />
                </div>

                {/* Category Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={editingProduct?.category || ""}
                      onChange={(e) =>
                        handleInputChange("category", e.target.value)
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subcategory
                    </label>
                    <select
                      value={editingProduct?.subcategory || ""}
                      onChange={(e) =>
                        handleInputChange("subcategory", e.target.value)
                      }
                      disabled={!editingProduct?.category}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Subcategory</option>
                      {filteredSubcategories.map((sub) => (
                        <option key={sub.id} value={sub.name}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Part Type
                    </label>
                    <select
                      value={editingProduct?.parttype || ""}
                      onChange={(e) =>
                        handleInputChange("parttype", e.target.value)
                      }
                      disabled={!editingProduct?.subcategory}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Part Type</option>
                      {filteredParttypes.map((pt) => (
                        <option key={pt.id} value={pt.name}>
                          {pt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 border-t">
                <button
                  onClick={handleCancel}
                  className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold flex items-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-semibold flex items-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsViewPage;
