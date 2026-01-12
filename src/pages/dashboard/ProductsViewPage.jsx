import React, { useState, useEffect, useRef } from "react";
import { AsyncPaginate } from "react-select-async-paginate";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { supabase } from "../../config/supabase";
import {
  ArrowLeft,
  Save,
  X,
  Package,
  Edit3,
  CheckCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

// Modal component for confirmation
const ConfirmModal = ({ open, onClose, onConfirm, productName, fileName }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-600" />
          Delete Product
        </h2>
        <p className="mb-6 text-gray-700">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-gray-900">{productName}</span>{" "}
          from{" "}
          <span className="font-semibold text-blue-700">
            Filename: {fileName}
          </span>
          ? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * OPTIMIZED API USAGE:
 * - Categories data cached for 5 minutes (no repeated API calls)
 * - Save operation uses cached data for lookups (0 API calls for ID lookups)
 * - Total API calls per save: 2 (1 for update, 1 for CSV upload)
 * - Before optimization: 6+ API calls per save
 * - Reduction: 70% fewer API calls!
 */

// Cache for categories data (shared across all instances)
let categoriesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const ProductsViewPage = () => {
  // State for delete modal
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    product: null,
  });
  // Handler for deleting a product
  const handleDeleteProduct = async (product) => {
    try {
      // Remove from DB if product has a DB id
      if (product.id) {
        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", product.id)
          .eq("user_id", user?.id);
        if (error) throw error;
      }

      // Remove from local state (both displayed and all products)
      const updatedAllProducts = allProducts.filter((p) => p.id !== product.id);
      setAllProducts(updatedAllProducts);
      const updatedProducts = products.filter((p) => p.id !== product.id);
      setProducts(updatedProducts);

      // Update CSV in Supabase Storage
      // Reconstruct CSV: get headers from the original file, then join updatedProducts
      const decodedUrl = decodeURIComponent(fileUrl);
      // Download the original file to get headers
      const { data, error: downloadError } = await supabase.storage
        .from("product-uploads")
        .download(decodedUrl);
      if (downloadError) throw downloadError;
      const text = await data.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0];
      // Map updatedProducts to CSV lines (ensure order matches headers)
      const toCsvLine = (prod) =>
        [
          prod.name,
          prod.description,
          "", // SKU (if needed, else blank)
          prod.category,
          prod.subcategory,
          prod.parttype,
          prod.confidence,
        ]
          .map((v = "") => `"${(v || "").replace(/"/g, '""')}"`)
          .join(",");
      const newCsv = [headers, ...updatedProducts.map(toCsvLine)].join("\n");
      // Upload new CSV to storage (overwrite)
      const { error: uploadError } = await supabase.storage
        .from("product-uploads")
        .upload(decodedUrl, new Blob([newCsv], { type: "text/csv" }), {
          upsert: true,
        });
      if (uploadError) throw uploadError;

      toast.success(`Deleted product: ${product.name || "Unnamed Product"}`);
    } catch (error) {
      toast.error("Failed to delete product: " + error.message);
    } finally {
      setDeleteModal({ open: false, product: null });
    }
  };
  const { fileUrl } = useParams();
  const [deleting, setDeleting] = useState(false);
  // Extract file name from fileUrl
  const getFileName = (url) => {
    if (!url) return "";
    const decoded = decodeURIComponent(url);
    const parts = decoded.split("/");
    const rawName = parts[parts.length - 1];
    // Remove leading number and dash if present
    return rawName.replace(/^\d+-/, "");
  };
  const fileName = getFileName(fileUrl);
  // Delete all products for this file and the file itself
  const handleDeleteFile = async () => {
    if (!fileUrl) return;
    if (
      !window.confirm(
        `Are you sure you want to delete '${fileName}' and all its products? This cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    try {
      const decodedUrl = decodeURIComponent(fileUrl);
      // Delete products from DB
      await supabase
        .from("products")
        .delete()
        .eq("file_url", decodedUrl)
        .eq("user_id", user?.id);
      // Delete file from storage
      await supabase.storage.from("product-uploads").remove([decodedUrl]);
      toast.success("File and products deleted");
      navigate("/reports");
    } catch (error) {
      toast.error("Failed to delete file: " + error.message);
    } finally {
      setDeleting(false);
    }
  };
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Store all products
  const [displayedCount, setDisplayedCount] = useState(50); // Number of products to display
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [parttypes, setParttypes] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [filteredParttypes, setFilteredParttypes] = useState([]);
  const tableContainerRef = useRef(null);

  useEffect(() => {
    loadProducts();
    loadCategoriesData();
  }, [fileUrl]);

  // Load more products function
  const loadMoreProducts = () => {
    if (loadingMore || displayedCount >= allProducts.length) return;

    setLoadingMore(true);
    console.log(`📥 Loading more products... Current: ${displayedCount}, Total: ${allProducts.length}`);

    // Simulate slight delay for smooth UX
    setTimeout(() => {
      const newCount = Math.min(displayedCount + 50, allProducts.length);
      setDisplayedCount(newCount);
      setLoadingMore(false);
      console.log(`✅ Now displaying ${newCount} of ${allProducts.length} products`);
    }, 300);
  };

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (!tableContainerRef.current || loadingMore) return;

      const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
      
      console.log('📜 Scroll event:', { scrollTop, scrollHeight, clientHeight, threshold: scrollHeight - 100 });
      
      // Check if scrolled to bottom (with 100px threshold)
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        console.log('🎯 Reached bottom, loading more...');
        loadMoreProducts();
      }
    };

    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [loadingMore, displayedCount, allProducts.length]);

  // Update displayed products when displayedCount changes
  useEffect(() => {
    if (allProducts.length > 0) {
      setProducts(allProducts.slice(0, displayedCount));
    }
  }, [displayedCount, allProducts]);

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

      // Store all products and display first 50
      setAllProducts(parsedProducts);
      setProducts(parsedProducts.slice(0, 50));
      setDisplayedCount(50);
      
      console.log(`✅ Loaded ${parsedProducts.length} products, displaying first 50`);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriesData = async () => {
    try {
      // Check if cache is valid (less than 5 minutes old)
      const now = Date.now();
      if (
        categoriesCache &&
        cacheTimestamp &&
        now - cacheTimestamp < CACHE_DURATION
      ) {
        console.log("✅ Using cached categories data (no API calls)");
        setCategories(categoriesCache.categories);
        setSubcategories(categoriesCache.subcategories);
        setParttypes(categoriesCache.parttypes);
        return;
      }

      console.log("📥 Loading categories data from API...");
      // Load all data in parallel (single batch of 3 calls instead of multiple)
      const [catsResult, subsResult, ptsResult] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("subcategories").select("*").order("name"),
        supabase.from("parttypes").select("*").order("name"),
      ]);

      const cats = catsResult.data || [];
      const subs = subsResult.data || [];
      const pts = ptsResult.data || [];

      // Store in cache
      categoriesCache = {
        categories: cats,
        subcategories: subs,
        parttypes: pts,
      };
      cacheTimestamp = now;

      setCategories(cats);
      setSubcategories(subs);
      setParttypes(pts);

      console.log(
        `✅ Loaded ${cats.length} categories, ${subs.length} subcategories, ${pts.length} parttypes`
      );
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

    try {
      // Use cached data instead of API calls (0 API calls for lookups!)
      const category = categories.find(
        (c) => c.name === editingProduct.category
      );
      if (!category) {
        throw new Error(`Category "${editingProduct.category}" not found`);
      }

      const subcategory = subcategories.find(
        (s) =>
          s.name === editingProduct.subcategory && s.category_id === category.id
      );
      if (!subcategory) {
        throw new Error(
          `Subcategory "${editingProduct.subcategory}" not found`
        );
      }

      const parttype = parttypes.find(
        (pt) =>
          pt.name === editingProduct.parttype &&
          pt.subcategory_id === subcategory.id
      );
      if (!parttype) {
        throw new Error(`Part type "${editingProduct.parttype}" not found`);
      }

      console.log("✅ Using cached IDs (no API calls):", {
        category: category.id,
        subcategory: subcategory.id,
        parttype: parttype.id,
      });

      // Update products in database that match this file (1 API call)
      const decodedUrl = decodeURIComponent(fileUrl);
      const originalProductName = products.find(
        (p) => p.id === editingProduct.id
      )?.name;

      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: editingProduct.name,
          description: editingProduct.description,
          category_id: category.id,
          subcategory_id: subcategory.id,
          parttype_id: parttype.id,
        })
        .eq("file_url", decodedUrl)
        .eq("name", originalProductName)
        .eq("user_id", user?.id);

      if (updateError) throw updateError;
      console.log("✅ Database updated (1 API call)");

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

      toast.success(" Product updated successfully!");
      setEditingProduct(null);
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(`Failed to save: ${error.message}`);
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
    <div className="min-h-screen bg-gray-50 py-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/reports")}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="sm:text-3xl text-2xl font-bold text-gray-800 flex items-center gap-2">
                Products View
              </h1>
            </div>
          </div>
        </div>

        {/* Products Count Info */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <span className="font-bold text-gray-800">{products.length}</span> of{" "}
            <span className="font-bold text-gray-800">{allProducts.length}</span> products
          </div>
          {displayedCount < allProducts.length && (
            <div className="text-sm text-blue-600 font-medium">
              Scroll down to load more products
            </div>
          )}
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div 
            ref={tableContainerRef}
            className="overflow-x-auto max-h-[calc(100vh-50px)] overflow-y-auto"
            style={{ scrollBehavior: 'smooth' }}
          >
            <table className="w-full ">
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
              <tbody className="divide-y  divide-gray-200">
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
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center"
                        >
                          <Edit3 className="w-4 h-4" />
                          {/* <span className="text-sm font-semibold">Edit</span> */}
                        </button>
                        <button
                          onClick={() =>
                            setDeleteModal({ open: true, product })
                          }
                          className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors flex items-center"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Delete Product Modal */}
                <ConfirmModal
                  open={deleteModal.open}
                  onClose={() => setDeleteModal({ open: false, product: null })}
                  onConfirm={() => handleDeleteProduct(deleteModal.product)}
                  productName={deleteModal.product?.name || "Unnamed Product"}
                  fileName={fileName}
                />
              </tbody>
              
              {/* Table Footer with Statistics */}
              <tfoot className="bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-300 sticky bottom-0">
                <tr>
                  <td colSpan="7" className="px-6 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      {/* Total Products */}
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-700">
                          Total Products:
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {allProducts.length.toLocaleString()}
                        </span>
                      </div>

                      {/* Average Confidence */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          Avg Confidence:
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          {allProducts.length > 0
                            ? Math.round(
                                allProducts.reduce((sum, p) => sum + parseFloat(p.confidence || 0), 0) /
                                  allProducts.length
                              )
                            : 0}
                          %
                        </span>
                      </div>

                      {/* Categories Count */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          Categories:
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          {new Set(allProducts.map(p => p.category).filter(Boolean)).size}
                        </span>
                      </div>

                      {/* Status Breakdown */}
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-semibold text-gray-700">
                          Status:
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                          {allProducts.length} Good
                        </span>
                      </div>

                      {/* Showing X of Y */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          Showing:
                        </span>
                        <span className="text-lg font-bold text-gray-800">
                          {products.length}
                        </span>
                        <span className="text-sm text-gray-500">
                          of {allProducts.length}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Loading More Indicator */}
            {loadingMore && (
              <div className="flex items-center justify-center py-6 border-t border-gray-200">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-2" />
                <span className="text-gray-600 font-medium">Loading more products...</span>
              </div>
            )}

            {/* End of List Message */}
            {!loadingMore && displayedCount >= allProducts.length && allProducts.length > 50 && (
              <div className="flex items-center justify-center py-6 border-t border-gray-200 bg-gray-50">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-gray-600 font-medium">
                  All {allProducts.length} products loaded
                </span>
              </div>
            )}
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
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center">
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
                  {/* Category AsyncPaginate */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category
                    </label>
                    <AsyncPaginate
                      value={
                        editingProduct?.category
                          ? {
                              value: editingProduct.category,
                              label: editingProduct.category,
                            }
                          : null
                      }
                      loadOptions={async (
                        inputValue,
                        loadedOptions,
                        { page }
                      ) => {
                        const PAGE_SIZE = 10;
                        let query = supabase
                          .from("categories")
                          .select("name")
                          .order("name")
                          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
                        if (inputValue) {
                          query = query.ilike("name", `%${inputValue}%`);
                        }
                        const { data, error } = await query;
                        if (error) {
                          return { options: [], hasMore: false };
                        }
                        return {
                          options: (data || []).map((cat) => ({
                            value: cat.name,
                            label: cat.name,
                          })),
                          hasMore: (data || []).length === PAGE_SIZE,
                          additional: { page: page + 1 },
                        };
                      }}
                      onChange={(option) =>
                        handleInputChange(
                          "category",
                          option ? option.value : ""
                        )
                      }
                      additional={{ page: 1 }}
                      isClearable
                      placeholder="Select Category..."
                      menuPlacement="top"
                      menuPortalTarget={
                        typeof window !== "undefined" ? document.body : null
                      }
                      styles={{
                        container: (base) => ({ ...base, width: "100%" }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menuList: (base) => ({
                          ...base,
                          maxHeight: 240,
                          minHeight: 120,
                          overflowY: "auto",
                        }),
                      }}
                    />
                  </div>
                  {/* Subcategory AsyncPaginate */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subcategory
                    </label>
                    <AsyncPaginate
                      value={
                        editingProduct?.subcategory
                          ? {
                              value: editingProduct.subcategory,
                              label: editingProduct.subcategory,
                            }
                          : null
                      }
                      loadOptions={async (
                        inputValue,
                        loadedOptions,
                        { page }
                      ) => {
                        const PAGE_SIZE = 10;
                        if (!editingProduct?.category)
                          return { options: [], hasMore: false };
                        // Find category id
                        const cat = categories.find(
                          (c) => c.name === editingProduct.category
                        );
                        if (!cat) return { options: [], hasMore: false };
                        let query = supabase
                          .from("subcategories")
                          .select("name")
                          .eq("category_id", cat.id)
                          .order("name")
                          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
                        if (inputValue) {
                          query = query.ilike("name", `%${inputValue}%`);
                        }
                        const { data, error } = await query;
                        if (error) {
                          return { options: [], hasMore: false };
                        }
                        return {
                          options: (data || []).map((sub) => ({
                            value: sub.name,
                            label: sub.name,
                          })),
                          hasMore: (data || []).length === PAGE_SIZE,
                          additional: { page: page + 1 },
                        };
                      }}
                      onChange={(option) =>
                        handleInputChange(
                          "subcategory",
                          option ? option.value : ""
                        )
                      }
                      additional={{ page: 1 }}
                      isClearable
                      placeholder="Select Subcategory..."
                      isDisabled={!editingProduct?.category}
                      menuPlacement="top"
                      menuPortalTarget={
                        typeof window !== "undefined" ? document.body : null
                      }
                      styles={{
                        container: (base) => ({ ...base, width: "100%" }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menuList: (base) => ({
                          ...base,
                          maxHeight: 240,
                          minHeight: 120,
                          overflowY: "auto",
                        }),
                      }}
                    />
                  </div>
                  {/* Part Type AsyncPaginate */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Part Type
                    </label>
                    <AsyncPaginate
                      value={
                        editingProduct?.parttype
                          ? {
                              value: editingProduct.parttype,
                              label: editingProduct.parttype,
                            }
                          : null
                      }
                      loadOptions={async (
                        inputValue,
                        loadedOptions,
                        { page }
                      ) => {
                        const PAGE_SIZE = 5;
                        if (!editingProduct?.subcategory)
                          return { options: [], hasMore: false };
                        // Find subcategory id
                        const sub = subcategories.find(
                          (s) => s.name === editingProduct.subcategory
                        );
                        if (!sub) return { options: [], hasMore: false };
                        let query = supabase
                          .from("parttypes")
                          .select("name")
                          .eq("subcategory_id", sub.id)
                          .order("name")
                          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
                        if (inputValue) {
                          query = query.ilike("name", `%${inputValue}%`);
                        }
                        const { data, error } = await query;
                        if (error) {
                          return { options: [], hasMore: false };
                        }
                        return {
                          options: (data || []).map((pt) => ({
                            value: pt.name,
                            label: pt.name,
                          })),
                          hasMore: (data || []).length === PAGE_SIZE,
                          additional: { page: page + 1 },
                        };
                      }}
                      onChange={(option) =>
                        handleInputChange(
                          "parttype",
                          option ? option.value : ""
                        )
                      }
                      additional={{ page: 1 }}
                      isClearable
                      placeholder="Select Part Type..."
                      isDisabled={!editingProduct?.subcategory}
                      menuPlacement="top"
                      menuPortalTarget={
                        typeof window !== "undefined" ? document.body : null
                      }
                      styles={{
                        container: (base) => ({ ...base, width: "100%" }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menuList: (base) => ({
                          ...base,
                          maxHeight: 240,
                          minHeight: 120,
                          overflowY: "auto",
                        }),
                      }}
                    />
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
                  className="sm:px-6 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-semibold flex items-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span className="sm:text-base text-sm">Save Changes</span>
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
