import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Box,
  Save,
  X,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../../config/supabase";
import { generateCategoryEmbedding } from "../../utils/embeddingUtils";
import toast from "react-hot-toast";

const BATCH_SIZE = 20;

const ParttypesPage = () => {
  const [parttypes, setParttypes] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", subcategoryId: "" });
  const [displayCount, setDisplayCount] = useState(20);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const observerTarget = React.useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Fetch total count only
      const countRes = await supabase
        .from("parttypes")
        .select("*", { count: "exact", head: true });
      setTotalCount(countRes.count || 0);

      const [ptsRes, subsRes, catsRes] = await Promise.all([
        supabase
          .from("parttypes")
          .select("*")
          .order("name")
          .range(0, BATCH_SIZE - 1),
        supabase.from("subcategories").select("*").order("name"),
        supabase.from("categories").select("*").order("name"),
      ]);

      if (ptsRes.error) throw ptsRes.error;
      if (subsRes.error) throw subsRes.error;
      if (catsRes.error) throw catsRes.error;

      setParttypes(ptsRes.data || []);
      setHasMore((ptsRes.data?.length || 0) === BATCH_SIZE);
      setDisplayCount(ptsRes.data?.length || 0);
      setSubcategories(subsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load part types");
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreParttypes = async () => {
    setLoadingMore(true);
    try {
      const from = parttypes.length;
      const to = from + BATCH_SIZE - 1;
      const { data, error } = await supabase
        .from("parttypes")
        .select("*")
        .order("name")
        .range(from, to);

      if (error) throw error;

      setParttypes((prev) => [...prev, ...(data || [])]);
      setHasMore((data?.length || 0) === BATCH_SIZE);
      setDisplayCount((prev) => prev + (data?.length || 0));
    } catch (error) {
      toast.error("Failed to load more part types");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.subcategoryId) {
      toast.error("Name and subcategory are required");
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading("Adding part type...");

    try {
      const subcategory = subcategories.find(
        (s) => s.id === formData.subcategoryId
      );
      const category = categories.find(
        (c) => c.id === subcategory?.category_id
      );

      const embedding = generateCategoryEmbedding(
        category?.name || "",
        subcategory?.name || "",
        formData.name
      );

      const { error } = await supabase.from("parttypes").insert({
        name: formData.name,
        subcategory_id: formData.subcategoryId,
        embedding,
      });

      if (error) throw error;

      toast.success("Part type added successfully!", { id: loadingToast });
      setShowAddModal(false);
      setFormData({ name: "", subcategoryId: "" });
      reloadAllData();
    } catch (error) {
      console.error("Error adding part type:", error);
      toast.error(`Failed to add: ${error.message}`, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim() || !formData.subcategoryId) {
      toast.error("Name and subcategory are required");
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading("Updating part type...");

    try {
      const subcategory = subcategories.find(
        (s) => s.id === formData.subcategoryId
      );
      const category = categories.find(
        (c) => c.id === subcategory?.category_id
      );

      const embedding = generateCategoryEmbedding(
        category?.name || "",
        subcategory?.name || "",
        formData.name
      );

      const { error } = await supabase
        .from("parttypes")
        .update({
          name: formData.name,
          subcategory_id: formData.subcategoryId,
          embedding,
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success("Part type updated successfully!", { id: loadingToast });
      setShowEditModal(false);
      reloadAllData();
    } catch (error) {
      console.error("Error updating part type:", error);
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
        .from("parttypes")
        .delete()
        .eq("id", deleteItem.id);

      if (error) throw error;

      toast.success("Part type deleted successfully!", { id: loadingToast });
      setShowDeleteModal(false);
      setDeleteItem(null);
      reloadAllData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(`Failed to delete: ${error.message}`, { id: loadingToast });
    } finally {
      setDeleting(false);
    }
  };

  const reloadAllData = async () => {
    setDisplayCount(BATCH_SIZE);
    await loadInitialData();
  };

  const getSubcategoryName = (subcategoryId) => {
    return subcategories.find((s) => s.id === subcategoryId)?.name || "Unknown";
  };

  const getCategoryName = (subcategoryId) => {
    const subcategory = subcategories.find((s) => s.id === subcategoryId);
    return (
      categories.find((c) => c.id === subcategory?.category_id)?.name ||
      "Unknown"
    );
  };

  const filteredParttypes = parttypes.filter(
    (pt) =>
      pt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getSubcategoryName(pt.subcategory_id)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      getCategoryName(pt.subcategory_id)
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const displayedParttypes = filteredParttypes;

  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingMore &&
          !loading &&
          searchTerm === "" // Only fetch more if not searching
        ) {
          fetchMoreParttypes();
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
    // eslint-disable-next-line
  }, [parttypes, hasMore, loadingMore, loading, searchTerm]);

  const SkeletonCard = () => (
    <div className="p-4 animate-pulse flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 bg-green-200 rounded-lg"></div>
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
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
          <div className="p-3 bg-green-600 rounded-xl">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Part Types</h1>
            <p className="text-sm text-gray-600">
              Manage your product part types
            </p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 mb-6 text-white">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-green-400 rounded w-20 mb-2"></div>
            <div className="h-4 bg-green-400 rounded w-32"></div>
          </div>
        ) : (
          <>
            <div className="text-4xl font-bold mb-1">{parttypes.length}</div>
            <div className="text-green-100">Total Part Types</div>
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
                placeholder="Search part types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setFormData({ name: "", subcategoryId: "" });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Part Type Categories
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            All Part Types
          </h2>
          <span className="text-sm text-gray-500">
            {filteredParttypes.length} part types
          </span>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {loading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))
          ) : filteredParttypes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No part types found</p>
            </div>
          ) : (
            <>
              {displayedParttypes.map((parttype) => (
                <div
                  key={parttype.id}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Box className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 block">
                        {parttype.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {getCategoryName(parttype.subcategory_id)} {" > "}
                        {getSubcategoryName(parttype.subcategory_id)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(parttype);
                        setFormData({
                          name: parttype.name,
                          subcategoryId: parttype.subcategory_id,
                        });
                        setShowEditModal(true);
                      }}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteItem(parttype);
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
              {hasMore && !searchTerm && (
                <div ref={observerTarget} className="p-4">
                  {loadingMore && (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && filteredParttypes.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            Showing {filteredParttypes.length} of {parttypes.length} loaded
            {totalCount > 0 && (
              <> (out of {totalCount} total part type{totalCount > 1 ? "s" : ""})</>
            )}
            {searchTerm && ` (filtered)`}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <Modal
          title="Add Part Type Categories"
          onClose={() => setShowAddModal(false)}
        >
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter part type categories name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Subcategory
              </label>
              <select
                value={formData.subcategoryId}
                onChange={(e) =>
                  setFormData({ ...formData, subcategoryId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Select subcategories</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id} >
                    {categories.find((c) => c.id === sub.category_id)?.name}{" "}
                    {" > "}
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <Modal
          title="Edit Part Type Categories"
          onClose={() => setShowEditModal(false)}
        >
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter part type name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Subcategory
              </label>
              <select
                value={formData.subcategoryId}
                onChange={(e) =>
                  setFormData({ ...formData, subcategoryId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {categories.find((c) => c.id === sub.category_id)?.name}{" "}
                    {" > "}
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          title="Delete Part Type Categories"
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

export default ParttypesPage;
