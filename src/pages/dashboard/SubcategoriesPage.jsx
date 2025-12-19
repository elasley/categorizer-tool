import React, { useState, useEffect } from "react";
import { AsyncPaginate } from "react-select-async-paginate";
import { useSelector } from "react-redux";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Layers,
  Save,
  X,
  AlertCircle,
  Loader2,
  Ellipsis,
} from "lucide-react";
import { supabase } from "../../config/supabase";
import { generateEmbedding } from "../../utils/embeddingGenerator";
import toast from "react-hot-toast";

const BATCH_SIZE = 20;

const SubcategoriesPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", categoryId: "" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const observerTarget = React.useRef(null);
  const hasLoadedRef = React.useRef(false);

  useEffect(() => {
    // Prevent double loading in React StrictMode
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadInitialData();
    // eslint-disable-next-line
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Single API call with joins to fetch subcategories with category data
      let query = supabase
        .from("subcategories")
        .select(
          `
          *,
          categories (
            id,
            name
          )
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false }) // ✅ PRIMARY SORT
        .order("name", { ascending: true })
        .range(0, BATCH_SIZE - 1);

      if (user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setSubcategories(data || []);
      setTotalCount(count || 0);
      setHasMore((data?.length || 0) === BATCH_SIZE);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load subcategories");
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreSubcategories = async () => {
    setLoadingMore(true);
    try {
      const from = subcategories.length;
      const to = from + BATCH_SIZE - 1;

      let query = supabase
        .from("subcategories")
        .select(
          `
          *,
          categories (
            id,
            name
          )
        `
        )
        .order("name")
        .range(from, to);

      if (user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSubcategories((prev) => [...prev, ...(data || [])]);
      setHasMore((data?.length || 0) === BATCH_SIZE);
    } catch (error) {
      toast.error("Failed to load more subcategories");
    } finally {
      setLoadingMore(false);
    }
  };

  const reloadAllData = async () => {
    await loadInitialData();
  };

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.categoryId) {
      toast.error("Name and category are required");
      return;
    }

    setSaving(true);

    try {
      // Fetch category info for embedding generation
      const { data: categoryData } = await supabase
        .from("categories")
        .select("name")
        .eq("id", formData.categoryId)
        .single();

      // Generate AI-powered embedding using MiniLM-v2 model
      const text = `${categoryData?.name || ""} ${formData.name}`.trim();
      const embedding = await generateEmbedding(text);

      const { error } = await supabase.from("subcategories").insert({
        name: formData.name,
        category_id: formData.categoryId,
        embedding,
        user_id: user?.id,
      });

      if (error) throw error;

      toast.success("Subcategory added successfully!");
      setShowAddModal(false);
      setFormData({ name: "", categoryId: "" });
      reloadAllData();
    } catch (error) {
      console.error("Error adding subcategory:", error);
      toast.error(`Failed to add: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim() || !formData.categoryId) {
      toast.error("Name and category are required");
      return;
    }

    setSaving(true);

    try {
      // Fetch category info for embedding generation
      const { data: categoryData } = await supabase
        .from("categories")
        .select("name")
        .eq("id", formData.categoryId)
        .single();

      // Regenerate AI-powered embedding using MiniLM-v2 model
      const text = `${categoryData?.name || ""} ${formData.name}`.trim();
      const embedding = await generateEmbedding(text);

      const { error } = await supabase
        .from("subcategories")
        .update({
          name: formData.name,
          category_id: formData.categoryId,
          embedding,
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success("Subcategory updated successfully!");
      setShowEditModal(false);
      reloadAllData();
    } catch (error) {
      console.error("Error updating subcategory:", error);
      toast.error(`Failed to update: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    setDeleting(true);

    try {
      const { error } = await supabase
        .from("subcategories")
        .delete()
        .eq("id", deleteItem.id);

      if (error) throw error;

      toast.success("Subcategory deleted successfully!");
      setShowDeleteModal(false);
      setDeleteItem(null);
      reloadAllData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Search with debounce
  useEffect(() => {
    // If search is cleared and we were searching, reload initial data
    if (searchTerm.trim() === "" && isSearching) {
      setIsSearching(false);
      loadInitialData();
      return;
    }

    // Don't search if empty
    if (searchTerm.trim() === "") {
      return;
    }

    // Mark that we're searching
    setIsSearching(true);

    // Debounce search
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("subcategories")
          .select(
            `
            *,
            categories (
              id,
              name
            )
          `,
            { count: "exact" }
          )
          .ilike("name", `%${searchTerm}%`)
          .order("name");

        if (user?.id) {
          query = query.eq("user_id", user.id);
        }

        const { data, error, count } = await query;
        if (error) throw error;
        setSubcategories(data || []);
        setTotalCount(count || 0);
        setHasMore(false);
      } catch (error) {
        toast.error("Failed to search subcategories");
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line
  }, [searchTerm]);

  const displayedSubcategories = subcategories;

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
          fetchMoreSubcategories();
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
  }, [subcategories, hasMore, loadingMore, loading, searchTerm]);

  const SkeletonCard = () => (
    <div className="p-4 animate-pulse flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 bg-purple-200 rounded-lg"></div>
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
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
          <div className="p-3 bg-purple-600 rounded-xl">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subcategories</h1>
            <p className="text-sm text-gray-600">
              Manage your product subcategories
            </p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-purple-400 rounded w-20 mb-2"></div>
            <div className="h-4 bg-purple-400 rounded w-32"></div>
          </div>
        ) : (
          <>
            <div className="text-4xl font-bold mb-1">{totalCount}</div>
            <div className="text-purple-100">Total Subcategories</div>
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
                placeholder="Search subcategories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setFormData({ name: "", categoryId: "" });
              setShowAddModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Subcategories
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            All Subcategories
          </h2>
          <span className="text-sm text-gray-500">
            {totalCount} subcategories
          </span>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {loading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))
          ) : displayedSubcategories.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No subcategories found</p>
            </div>
          ) : (
            <>
              {displayedSubcategories.map((subcategory) => (
                <div
                  key={subcategory.id}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Layers className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 block">
                        {subcategory.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {subcategory.categories?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(subcategory);
                        setFormData({
                          name: subcategory.name,
                          categoryId: subcategory.category_id,
                          categoryName: subcategory.categories?.name || "",
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
                        setDeleteItem(subcategory);
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
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && displayedSubcategories.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            Showing {displayedSubcategories.length} of {subcategories.length}{" "}
            loaded
            {totalCount > 0 && (
              <>
                {" "}
                (out of {totalCount} total subcategor
                {totalCount === 1 ? "y" : "ies"})
              </>
            )}
            {searchTerm && ` (filtered)`}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddEditModal
          title="Add Subcategories"
          onClose={() => setShowAddModal(false)}
          formData={formData}
          setFormData={setFormData}
          onSave={handleAdd}
          saving={saving}
          user={user}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <AddEditModal
          title="Edit Subcategories"
          onClose={() => setShowEditModal(false)}
          formData={formData}
          setFormData={setFormData}
          onSave={handleEdit}
          saving={saving}
          user={user}
          isEdit={true}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteItem && (
        <Modal
          title="Delete Subcategories"
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

const AddEditModal = ({
  title,
  onClose,
  formData,
  setFormData,
  onSave,
  saving,
  user,
  isEdit,
}) => {
  // AsyncPaginate loader for react-select
  const loadCategoryOptions = async (inputValue, loadedOptions, { page }) => {
    const PAGE_SIZE = 50;
    let query = supabase
      .from("categories")
      .select("id, name")
      .order("name")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (user?.id) {
      query = query.eq("user_id", user.id);
    }
    if (inputValue) {
      query = query.ilike("name", `%${inputValue}%`);
    }
    const { data, error } = await query;
    if (error) {
      return {
        options: [],
        hasMore: false,
      };
    }
    return {
      options: (data || []).map((cat) => ({ value: cat.id, label: cat.name })),
      hasMore: (data || []).length === PAGE_SIZE,
      additional: {
        page: page + 1,
      },
    };
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder={`Enter subcategor${isEdit ? "y" : "ies"} name`}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isEdit ? "Parent Category" : "Categories"}
          </label>
          <AsyncPaginate
            value={
              formData.categoryId
                ? {
                    value: formData.categoryId,
                    label: formData.categoryName || "",
                  }
                : null
            }
            loadOptions={loadCategoryOptions}
            additional={{ page: 1 }}
            onChange={(option) =>
              setFormData({
                ...formData,
                categoryId: option ? option.value : "",
                categoryName: option ? option.label : "",
              })
            }
            placeholder="Search or select category..."
            isClearable
            styles={{
              container: (base) => ({
                ...base,
                width: "100%",
              }),
              menu: (base) => ({
                ...base,
                zIndex: 9999,
                height: "250px",
                border: "1px solid #D1D5DB",
              }),
              menuList: (base) => ({
                ...base,
                maxHeight: 240, // or any px value you want (e.g., 240px = 6 items at 40px each)
                minHeight: 240,
                overflowY: "auto",
              }),
            }}
            loadingMessage={() => (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: 40,
                  gap: 8,
                }}
              >
                <Ellipsis
                  className="animate-pulse text-purple-600 mr-2"
                  size={30}
                />
              </div>
            )}
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {isEdit ? "Updating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? "Update" : "Save"}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SubcategoriesPage;
