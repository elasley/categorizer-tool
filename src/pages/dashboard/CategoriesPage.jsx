import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Tag,
  Save,
  X,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../../config/supabase";
import { generateEmbedding } from "../../utils/embeddingGenerator";
import toast from "react-hot-toast";

const CategoriesPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "" });
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [productsToDelete, setProductsToDelete] = useState([]);
  const [categoriesToDelete, setCategoriesToDelete] = useState([]);
  const [showProductsConfirmModal, setShowProductsConfirmModal] = useState(false);
  const [isCascadeDelete, setIsCascadeDelete] = useState(false);
  const observerTarget = React.useRef(null);
  const hasLoadedRef = React.useRef(false);

  const BATCH_SIZE = 20;

  const loadInitialData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("categories")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("name", { ascending: true })
        .range(0, BATCH_SIZE - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      setCategories(data || []);
      setTotalCount(count || 0);
      setHasMore((data?.length || 0) === BATCH_SIZE);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreCategories = async () => {
    setLoadingMore(true);
    try {
      const from = categories.length;
      const to = from + BATCH_SIZE - 1;

      let query = supabase
        .from("categories")
        .select("*")
        .order("name")
        .range(from, to);

      const { data, error } = await query;

      if (error) throw error;

      setCategories((prev) => [...prev, ...(data || [])]);
      setHasMore((data?.length || 0) === BATCH_SIZE);
    } catch (error) {
      toast.error("Failed to load more categories");
    } finally {
      setLoadingMore(false);
    }
  };

  // Load initial data once
  useEffect(() => {
    hasLoadedRef.current = false;
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTerm.trim() === "") {
      if (isSearching) {
        setIsSearching(false);
        hasLoadedRef.current = false;
        loadInitialData();
      }
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      performSearch();
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const performSearch = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("categories")
        .select("*", { count: "exact" })
        .order("name")
        .range(0, BATCH_SIZE - 1)
        .ilike("name", `%${searchTerm}%`);

      const { data, error, count } = await query;

      if (error) throw error;

      setCategories(data || []);
      setTotalCount(count || 0);
      setHasMore(
        (data?.length || 0) === BATCH_SIZE && (data?.length || 0) < (count || 0)
      );
    } catch (error) {
      toast.error("Failed to search categories");
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loading || loadingMore || isSearching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMoreCategories();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, isSearching]);

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      // Generate AI-powered embedding using MiniLM-v2 model
      const embedding = await generateEmbedding(formData.name);
      const { error } = await supabase
        .from("categories")
        .insert({ name: formData.name, embedding, user_id: user?.id })
        .select()
        .single();
      if (error) throw error;

      toast.success("Category added successfully!");
      setShowAddModal(false);
      setFormData({ name: "" });
      hasLoadedRef.current = false;
      loadInitialData();
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error(`Failed to add: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);

    try {
      // Regenerate AI-powered embedding using MiniLM-v2 model
      const embedding = await generateEmbedding(formData.name);
      const { error } = await supabase
        .from("categories")
        .update({ name: formData.name, embedding })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success("Category updated successfully!");
      setShowEditModal(false);
      hasLoadedRef.current = false;
      loadInitialData();
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error(`Failed to update: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    setDeleting(true);

    try {
      // Check if category has products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name", { count: "exact" })
        .eq("category_id", deleteItem.id);

      if (productsError) throw productsError;

      // If products exist, show confirmation modal
      if (products && products.length > 0) {
        setProductsToDelete(products);
        setCategoriesToDelete([deleteItem.id]);
        setIsCascadeDelete(false);
        setShowProductsConfirmModal(true);
        setDeleting(false);
        return;
      }

      // No products, safe to delete category
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deleteItem.id);

      if (error) throw error;

      toast.success("Category deleted successfully!");
      setShowDeleteModal(false);
      setDeleteItem(null);
      hasLoadedRef.current = false;
      loadInitialData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleCategory = (categoryId) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
    // Exit selection mode if all items are deselected
    if (newSelected.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedCategories.size === categories.length && isSelectionMode) {
      // Deselect all and exit selection mode
      setSelectedCategories(new Set());
      setIsSelectionMode(false);
    } else {
      // Enter selection mode and select all
      setIsSelectionMode(true);
      setSelectedCategories(new Set(categories.map((cat) => cat.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCategories.size === 0) return;

    setDeleting(true);

    try {
      const categoryIds = Array.from(selectedCategories);

      // Check if any category has products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, category_id")
        .in("category_id", categoryIds);

      if (productsError) throw productsError;

      // If products exist, show confirmation modal
      if (products && products.length > 0) {
        setProductsToDelete(products);
        setCategoriesToDelete(categoryIds);
        setIsCascadeDelete(false);
        setShowProductsConfirmModal(true);
        setDeleting(false);
        return;
      }

      // No products, safe to delete categories
      const { error } = await supabase
        .from("categories")
        .delete()
        .in("id", categoryIds);

      if (error) throw error;

      toast.success(
        `${categoryIds.length} categor${categoryIds.length > 1 ? "ies" : "y"} deleted successfully!`
      );
      setShowBulkDeleteModal(false);
      setSelectedCategories(new Set());
      setIsSelectionMode(false);
      hasLoadedRef.current = false;
      loadInitialData();
    } catch (error) {
      console.error("Error deleting categories:", error);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmCascadeDelete = async () => {
    setDeleting(true);

    try {
      // Use stored category IDs (they are guaranteed to be valid)
      const categoryIds = categoriesToDelete.filter((id) => id && id !== "undefined");

      if (!categoryIds || categoryIds.length === 0) {
        toast.error("No categories selected for deletion");
        setDeleting(false);
        return;
      }

      // Delete products first
      const { error: productsDeleteError } = await supabase
        .from("products")
        .delete()
        .in("category_id", categoryIds);

      if (productsDeleteError) throw productsDeleteError;

      // Then delete categories
      const { error: categoriesDeleteError } = await supabase
        .from("categories")
        .delete()
        .in("id", categoryIds);

      if (categoriesDeleteError) throw categoriesDeleteError;

      toast.success(
        `${productsToDelete.length} product${productsToDelete.length > 1 ? "s" : ""} and ${categoryIds.length} categor${categoryIds.length > 1 ? "ies" : "y"} deleted successfully!`
      );

      setShowProductsConfirmModal(false);
      setShowDeleteModal(false);
      setShowBulkDeleteModal(false);
      setDeleteItem(null);
      setSelectedCategories(new Set());
      setIsSelectionMode(false);
      setProductsToDelete([]);
      setCategoriesToDelete([]);
      hasLoadedRef.current = false;
      loadInitialData();
    } catch (error) {
      console.error("Error in cascade delete:", error);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const SkeletonCard = () => (
    <div className="p-4 animate-pulse flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 bg-blue-200 rounded-lg"></div>
        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
        <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 ">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-600 rounded-xl">
            <Tag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
            <p className="text-sm text-gray-600">
              Manage your product categories
            </p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 mb-6 text-white">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-blue-400 rounded w-20 mb-2"></div>
            <div className="h-4 bg-blue-400 rounded w-32"></div>
          </div>
        ) : (
          <>
            <div className="text-4xl font-bold mb-1">{totalCount}</div>
            <div className="text-blue-100">Total Categories</div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setFormData({ name: "" });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Categories
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              All Categories
            </h2>
            {selectedCategories.size > 0 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {selectedCategories.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {selectedCategories.size > 0 && (
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedCategories.size})
              </button>
            )}
            {categories.length > 0 && (
              <button
                onClick={handleSelectAll}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${
                  isSelectionMode
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {isSelectionMode ? "Deselect All" : "Select All"}
              </button>
            )}
            <span className="text-sm text-gray-500">{totalCount} categories</span>
          </div>  
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {loading ? (
            // Show skeleton loaders while loading
            Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))
          ) : categories.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No categories found</p>
            </div>
          ) : (
            <>
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`p-4 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                    selectedCategories.has(category.id) ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {isSelectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(category.id)}
                        onChange={() => handleToggleCategory(category.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    )}
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Tag className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900">
                      {category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(category);
                        setFormData({ name: category.name });
                        setShowEditModal(true);
                      }}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteItem(category);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {/* Infinite scroll trigger */}
              {categories.length < totalCount && (
                <div ref={observerTarget} className="p-4">
                  {loadingMore && (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && categories.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            Showing {categories.length} of {totalCount}{" "}
            {totalCount === 1 ? "category" : "categories"}
            {searchTerm && ` (filtered from ${totalCount} total)`}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Add Categories" onClose={() => setShowAddModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter categories name"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <Modal title="Edit Categories" onClose={() => setShowEditModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter category name"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Update
                  </>
                )}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteItem && (
        <Modal
          title="Delete Categories"
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteItem(null);
          }}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-gray-900 font-medium mb-1">
                  Delete "{deleteItem.name}"?
                </p>
                <p className="text-sm text-gray-600">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  "OK"
                )}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteItem(null);
                }}
                disabled={deleting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <Modal
          title="Delete Multiple Categories"
          onClose={() => {
            setShowBulkDeleteModal(false);
          }}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-gray-900 font-medium mb-1">
                  Delete {selectedCategories.size} categor{selectedCategories.size > 1 ? "ies" : "y"}?
                </p>
                <p className="text-sm text-gray-600">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false);
                }}
                disabled={deleting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Products Confirmation Modal */}
      {showProductsConfirmModal && productsToDelete.length > 0 && (
        <Modal
          title="Products Assigned to Category"
          onClose={() => {
            setShowProductsConfirmModal(false);
            setProductsToDelete([]);
          }}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-bold mb-1 text-lg">
                  {productsToDelete.length} product{productsToDelete.length > 1 ? "s" : ""} found
                </p>
                <p className="text-sm text-gray-600">
                  {productsToDelete.length} product{productsToDelete.length > 1 ? "s are" : " is"} assigned to this category. Delete the category and all these products?
                </p>
              </div>
            </div>

          

            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 font-semibold">⚠️ This action cannot be undone</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleConfirmCascadeDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete All ({productsToDelete.length})
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowProductsConfirmModal(false);
                  setProductsToDelete([]);
                }}
                disabled={deleting}
                className="px-4 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Modal = ({ title, children, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default CategoriesPage;
