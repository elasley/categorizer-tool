import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { supabase } from "../../config/supabase";
import {
  Upload,
  Download,
  Trash2,
  Database,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";

const Categories = () => {
  const { user } = useSelector((state) => state.auth);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    categories: 0,
    subcategories: 0,
    partTypes: 0,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      setCategories(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const uniqueCategories = new Set(data.map((item) => item.category));
    const uniqueSubcategories = new Set(data.map((item) => item.subcategory));
    const uniquePartTypes = new Set(data.map((item) => item.part_type));

    setStats({
      total: data.length,
      categories: uniqueCategories.size,
      subcategories: uniqueSubcategories.size,
      partTypes: uniquePartTypes.size,
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setUploading(true);

    try {
      const text = await file.text();
      const rows = text.split("\n").filter((row) => row.trim());

      if (rows.length < 2) {
        toast.error("CSV file is empty or invalid");
        setUploading(false);
        return;
      }

      const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());

      // Validate CSV headers
      const requiredHeaders = ["category", "subcategory", "part_type"];
      const missingHeaders = requiredHeaders.filter(
        (h) => !headers.includes(h)
      );

      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(", ")}`);
        setUploading(false);
        return;
      }

      const categoryIndex = headers.indexOf("category");
      const subcategoryIndex = headers.indexOf("subcategory");
      const partTypeIndex = headers.indexOf("part_type");

      const categoriesToUpload = [];

      for (let i = 1; i < rows.length; i++) {
        const columns = rows[i].split(",").map((c) => c.trim());

        if (columns.length < 3) continue;

        const category = columns[categoryIndex];
        const subcategory = columns[subcategoryIndex];
        const partType = columns[partTypeIndex];

        if (category && subcategory && partType) {
          categoriesToUpload.push({
            category,
            subcategory,
            part_type: partType,
          });
        }
      }

      if (categoriesToUpload.length === 0) {
        toast.error("No valid categories found in CSV");
        setUploading(false);
        return;
      }

      // Insert categories into Supabase
      const { data, error } = await supabase
        .from("categories")
        .insert(categoriesToUpload)
        .select();

      if (error) throw error;

      toast.success(
        `Successfully uploaded ${categoriesToUpload.length} categories!`
      );
      loadCategories();
    } catch (error) {
      console.error("Error uploading categories:", error);
      toast.error(error.message || "Failed to upload categories");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleClearCategories = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all categories? This action cannot be undone."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("categories").delete().neq("id", 0); // Delete all records

      if (error) throw error;

      toast.success("All categories deleted successfully");
      setCategories([]);
      setStats({ total: 0, categories: 0, subcategories: 0, partTypes: 0 });
    } catch (error) {
      console.error("Error clearing categories:", error);
      toast.error("Failed to clear categories");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "category,subcategory,part_type\n" +
      "Engine,Cooling System,Radiator\n" +
      "Engine,Cooling System,Thermostat\n" +
      "Brake System,Disc Brakes,Brake Pad\n" +
      "Brake System,Disc Brakes,Brake Rotor\n";

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "categories_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Template downloaded!");
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Categories Management
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  Upload and manage product categories
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 font-medium mb-1">
                Total Records
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {stats.total}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 font-medium mb-1">
                Categories
              </div>
              <div className="text-2xl font-bold text-green-900">
                {stats.categories}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-sm text-purple-600 font-medium mb-1">
                Subcategories
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {stats.subcategories}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-sm text-orange-600 font-medium mb-1">
                Part Types
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {stats.partTypes}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-4">
          {/* Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Categories CSV
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file with columns: category, subcategory, part_type
            </p>
            <div className="flex items-center justify-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-2.5 px-6 rounded-lg transition-all duration-200 flex items-center gap-2">
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Choose CSV File
                    </>
                  )}
                </div>
              </label>
              <button
                onClick={handleDownloadTemplate}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Template
              </button>
            </div>
          </div>

          {/* Category List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading categories..." />
            </div>
          ) : categories.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Uploaded Categories ({categories.length})
                </h3>
                <button
                  onClick={handleClearCategories}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subcategory
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Part Type
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categories.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.category}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.subcategory}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.part_type}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No categories uploaded yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Upload a CSV file to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Categories;
