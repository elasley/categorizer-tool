import React, { useState, useEffect } from "react";
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
import { generateCategoryEmbedding } from "../../utils/embeddingUtils";
import toast from "react-hot-toast";

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "" });
  const [displayCount, setDisplayCount] = useState(20);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const observerTarget = React.useRef(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedCategories = filteredCategories.slice(0, displayCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          displayCount < filteredCategories.length
        ) {
          setLoadingMore(true);
          setTimeout(() => {
            setDisplayCount((prev) => prev + 20);
            setLoadingMore(false);
          }, 500);
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
  }, [displayCount, filteredCategories.length]);

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading("Adding category...");

    try {
      const embedding = generateCategoryEmbedding(formData.name, "", "");
      const { error } = await supabase
        .from("categories")
        .insert({ name: formData.name, embedding });

      if (error) throw error;

      toast.success("Category added successfully!", { id: loadingToast });
      setShowAddModal(false);
      setFormData({ name: "" });
      loadCategories();
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error(`Failed to add: ${error.message}`, { id: loadingToast });
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
    const loadingToast = toast.loading("Updating category...");

    try {
      const embedding = generateCategoryEmbedding(formData.name, "", "");
      const { error } = await supabase
        .from("categories")
        .update({ name: formData.name, embedding })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success("Category updated successfully!", { id: loadingToast });
      setShowEditModal(false);
      loadCategories();
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error(`Failed to update: ${error.message}`, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    setDeleting(true);
    const loadingToast = toast.loading("Deleting...");

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deleteItem.id);

      if (error) throw error;

      toast.success("Category deleted successfully!", { id: loadingToast });
      setShowDeleteModal(false);
      setDeleteItem(null);
      loadCategories();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(`Failed to delete: ${error.message}`, { id: loadingToast });
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
    <div className="min-h-screen bg-gray-50 p-6">
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
            <div className="text-4xl font-bold mb-1">{categories.length}</div>
            <div className="text-blue-100">Total Categories</div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <h2 className="text-lg font-semibold text-gray-900">
            All Categories
          </h2>
          <span className="text-sm text-gray-500">
            {filteredCategories.length} categories
          </span>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {loading ? (
            // Show skeleton loaders while loading
            Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))
          ) : filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No categories found</p>
            </div>
          ) : (
            <>
              {displayedCategories.map((category) => (
                <div
                  key={category.id}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
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
              {displayCount < filteredCategories.length && (
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
        {!loading && filteredCategories.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            Showing {Math.min(displayCount, filteredCategories.length)} of{" "}
            {filteredCategories.length}{" "}
            {filteredCategories.length === 1 ? "category" : "categories"}
            {searchTerm && ` (filtered from ${categories.length} total)`}
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
