import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { supabase } from "../../config/supabase";
import { generateEmbedding } from "../../utils/embeddingGenerator";
import {
  Upload,
  Download,
  Trash2,
  Database,
  AlertCircle,
  CheckCircle,
  Loader2,
  Edit2,
  X,
  ChevronRight,
  ChevronDown,
  Plus,
  Save,
} from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";

const Categories = () => {
  const { user } = useSelector((state) => state.auth);
  const [categories, setCategories] = useState([]);
  const [categoriesPage, setCategoriesPage] = useState(0);
  const [hasMoreCategories, setHasMoreCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState(new Set());
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [stats, setStats] = useState({
    categories: 0,
    subcategories: 0,
    partTypes: 0,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = React.useRef(null);
  const PAGE_SIZE = 10; // Reduced from 20 for faster initial load

  // Modal state for adding new category, subcategory, or part type
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState("category"); // 'category', 'subcategory', 'parttype'
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newPartType, setNewPartType] = useState("");
  const [adding, setAdding] = useState(false);
  const [parentCategoryId, setParentCategoryId] = useState(null);
  const [parentSubcategoryId, setParentSubcategoryId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleOpenAddModal = (
    type,
    categoryId = null,
    subcategoryId = null
  ) => {
    setAddType(type);
    setShowAddModal(true);
    setNewCategory("");
    setNewSubcategory("");
    setNewPartType("");
    setParentCategoryId(categoryId);
    setParentSubcategoryId(subcategoryId);
  };
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setParentCategoryId(null);
    setParentSubcategoryId(null);
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      if (addType === "category") {
        if (!newCategory.trim()) {
          toast.error("Category name required");
          setAdding(false);
          return;
        }
        // Add category with AI embedding
        const categoryEmbedding = await generateEmbedding(newCategory.trim());
        const { data: cat, error: catErr } = await supabase
          .from("categories")
          .insert({ name: newCategory.trim(), embedding: categoryEmbedding })
          .select()
          .single();
        if (catErr) throw catErr;
        let subcatId = null;
        if (newSubcategory.trim()) {
          // Add subcategory with AI embedding
          const subcategoryText = `${newCategory.trim()} ${newSubcategory.trim()}`;
          const subcategoryEmbedding = await generateEmbedding(subcategoryText);
          const { data: subcat, error: subcatErr } = await supabase
            .from("subcategories")
            .insert({
              name: newSubcategory.trim(),
              category_id: cat.id,
              embedding: subcategoryEmbedding,
            })
            .select()
            .single();
          if (subcatErr) throw subcatErr;
          subcatId = subcat.id;
        }
        if (newPartType.trim() && subcatId) {
          // Add part type with AI embedding
          const partTypeText = `${newCategory.trim()} ${newSubcategory.trim()} ${newPartType.trim()}`;
          const partTypeEmbedding = await generateEmbedding(partTypeText);
          const { error: ptErr } = await supabase.from("parttypes").insert({
            name: newPartType.trim(),
            subcategory_id: subcatId,
            embedding: partTypeEmbedding,
          });
          if (ptErr) throw ptErr;
        }
        toast.success("Category and related items added");
      } else if (addType === "subcategory") {
        if (!newSubcategory.trim() || !parentCategoryId) {
          toast.error("Subcategory name required");
          setAdding(false);
          return;
        }
        // Find parent category name for embedding from nested structure
        const category = categories.find((c) => c.id === parentCategoryId);
        const subcategoryText = `${
          category?.name || ""
        } ${newSubcategory.trim()}`;
        const embedding = await generateEmbedding(subcategoryText);
        const { error } = await supabase.from("subcategories").insert({
          name: newSubcategory.trim(),
          category_id: parentCategoryId,
          embedding,
        });
        if (error) throw error;
        toast.success("Subcategory added");
      } else if (addType === "parttype") {
        if (!newPartType.trim() || !parentSubcategoryId) {
          toast.error("Part type name required");
          setAdding(false);
          return;
        }
        // Find parent subcategory and category names for embedding from nested structure
        const category = categories.find((c) =>
          (c.subcategories || []).some((s) => s.id === parentSubcategoryId)
        );
        const subcategory = category?.subcategories?.find(
          (s) => s.id === parentSubcategoryId
        );
        const partTypeText = `${category?.name || ""} ${
          subcategory?.name || ""
        } ${newPartType.trim()}`;
        const embedding = await generateEmbedding(partTypeText);
        const { error } = await supabase.from("parttypes").insert({
          name: newPartType.trim(),
          subcategory_id: parentSubcategoryId,
          embedding,
        });
        if (error) throw error;
        toast.success("Part type added");
      }
      handleCloseAddModal();
      loadAllData();
    } catch (e) {
      toast.error("Failed to add");
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    // Load stats and first batch of categories in parallel
    setCategories([]);
    setCategoriesPage(0);
    setHasMoreCategories(true);
    loadStats();
    loadCategories(0, true);
  }, []);

  const loadCategories = async (page = 0, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Load categories with nested subcategories and parttypes using foreign key relations
      const { data, error } = await supabase
        .from("categories")
        .select(
          `
          id,
          name,
          subcategories(
            id,
            name,
            category_id,
            parttypes(
              id,
              name,
              subcategory_id
            )
          )
        `
        )
        .order("created_at", { ascending: false }) // 🔥 newest first
        .order("name", { ascending: true })
        .range(from, to);

      if (error) throw error;

      if (reset) {
        setCategories(data || []);
      } else {
        setCategories((prev) => [...prev, ...(data || [])]);
      }
      setHasMoreCategories((data?.length || 0) === PAGE_SIZE);
      setCategoriesPage(page);
    } catch (error) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadStats = async () => {
    try {
      // Load only counts for stats - much faster than loading all data
      const [categoriesCount, subcategoriesCount, parttypesCount] =
        await Promise.all([
          supabase
            .from("categories")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("subcategories")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("parttypes")
            .select("*", { count: "exact", head: true }),
        ]);

      setStats({
        categories: categoriesCount.count || 0,
        subcategories: subcategoriesCount.count || 0,
        partTypes: parttypesCount.count || 0,
      });
    } catch (error) {
      console.error("Failed to load stats", error);
    }
  };

  // Add this function before any usage of loadAllData
  const loadAllData = async () => {
    // Reset and reload all paginated data
    setCategories([]);
    setCategoriesPage(0);
    setHasMoreCategories(true);
    await Promise.all([loadStats(), loadCategories(0, true)]);
  };

  // Edit handlers
  const handleEdit = (item, type) => {
    setEditingItem({ ...item, type });
    setEditValue(item.name);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      const tableName =
        editingItem.type === "category"
          ? "categories"
          : editingItem.type === "subcategory"
          ? "subcategories"
          : "parttypes";

      const { error } = await supabase
        .from(tableName)
        .update({ name: editValue.trim() })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success(`${editingItem.type} updated successfully`);
      handleCancelEdit();
      loadAllData();
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Failed to update");
    }
  };

  // Delete handlers
  const handleDeleteClick = (item, type) => {
    setDeleteItem(item);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteType) return;

    setDeleting(true);

    const tableName =
      deleteType === "category"
        ? "categories"
        : deleteType === "subcategory"
        ? "subcategories"
        : "parttypes";

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", deleteItem.id);

      if (error) throw error;

      toast.success(`${deleteType} deleted successfully`);
      setShowDeleteModal(false);
      setDeleteItem(null);
      setDeleteType("");
      loadAllData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const toggleCategory = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubcategory = (subcategoryId) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(subcategoryId)) {
      newExpanded.delete(subcategoryId);
    } else {
      newExpanded.add(subcategoryId);
    }
    setExpandedSubcategories(newExpanded);
  };

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      // Collapse all
      setExpandedCategories(new Set());
      setExpandedSubcategories(new Set());
      setIsAllExpanded(false);
    } else {
      // Expand all
      const allCategoryIds = categories.map((c) => c.id);
      const allSubcategoryIds = categories.flatMap((c) =>
        (c.subcategories || []).map((s) => s.id)
      );
      setExpandedCategories(new Set(allCategoryIds));
      setExpandedSubcategories(new Set(allSubcategoryIds));
      setIsAllExpanded(true);
    }
  };

  useEffect(() => {
    if (!observerTarget.current) return;

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreCategories &&
          !loading &&
          !loadingMore
        ) {
          setLoadingMore(true);
          loadCategories(categoriesPage + 1).finally(() =>
            setLoadingMore(false)
          );
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(observerTarget.current);

    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
    // eslint-disable-next-line
  }, [categories, hasMoreCategories, loading, loadingMore, categoriesPage]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Categories Management
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Manage categories, subcategories, and part types
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid sm:grid-cols-3 grid-cols-1 gap-4">
            {loading ? (
              // Skeleton loaders for stats
              <>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 animate-pulse">
                  <div className="h-4 bg-blue-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-blue-200 rounded w-12"></div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 animate-pulse">
                  <div className="h-4 bg-purple-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-purple-200 rounded w-12"></div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 animate-pulse">
                  <div className="h-4 bg-orange-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-orange-200 rounded w-12"></div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium mb-1">
                    Categories
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
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
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && categories.length === 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="flex gap-2">
                  <div className="h-10 bg-gray-200 rounded w-28 animate-pulse"></div>
                  <div className="h-10 bg-blue-200 rounded w-32 animate-pulse"></div>
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 space-y-2">
                  {/* Skeleton Category Items */}
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg overflow-hidden animate-pulse"
                    >
                      <div className="bg-blue-50 p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-blue-200 rounded"></div>
                          <div className="w-5 h-5 bg-blue-200 rounded"></div>
                          <div className="h-5 bg-blue-200 rounded w-1/3"></div>
                          <div className="ml-auto h-5 bg-blue-200 rounded w-24"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Categories Tree View with Toggle */}
              <div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center  justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 sm:mb-0 mb-4">
                    All Categories
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={toggleExpandAll}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        isAllExpanded
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      }`}
                    >
                      {isAllExpanded ? (
                        <>
                          <ChevronRight className="w-4 h-4" />
                          Collapse All
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Expand All
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenAddModal("category")}
                      className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Category
                    </button>
                  </div>
                </div>
                {categories.length > 0 ? (
                  <>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="p-2 max-h-[600px] overflow-y-auto space-y-2">
                        {categories.map((category) => {
                          const categorySubcategories =
                            category.subcategories || [];
                          const isCategoryExpanded = expandedCategories.has(
                            category.id
                          );

                          return (
                            <div
                              key={category.id}
                              className="border border-gray-200 rounded-lg overflow-hidden"
                            >
                              {/* Category Row */}
                              <div className="group bg-blue-50 hover:bg-blue-100 transition-colors">
                                <div className="flex sm:items-center items-start justify-between py-2 px-1">
                                  <div className="flex items-center  gap-2 flex-1">
                                    <button
                                      onClick={() =>
                                        toggleCategory(category.id)
                                      }
                                      className="p-1 hover:bg-blue-200 rounded transition-colors"
                                    >
                                      {isCategoryExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-blue-700" />
                                      ) : (
                                        <ChevronRight className="w-5 h-5 text-blue-700" />
                                      )}
                                    </button>
                                    {editingItem?.id === category.id &&
                                    editingItem?.type === "category" ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        <input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) =>
                                            setEditValue(e.target.value)
                                          }
                                          className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          autoFocus
                                        />
                                        <button
                                          onClick={handleSaveEdit}
                                          className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                        >
                                          <Save className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={handleCancelEdit}
                                          className="p-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <Database className="w-5 h-5 text-blue-600" />
                                        <span className="font-semibold text-blue-900 flex-1">
                                          {category.name}
                                        </span>
                                        <span className="text-xs flex border  text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
                                          {categorySubcategories.length}
                                          <p>sub</p>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {!(editingItem?.id === category.id) && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() =>
                                          handleEdit(category, "category")
                                        }
                                        className="p-2 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                                        title="Edit Category"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteClick(
                                            category,
                                            "category"
                                          )
                                        }
                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                        title="Delete Categories"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleOpenAddModal(
                                            "subcategory",
                                            category.id,
                                            null
                                          )
                                        }
                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                        title="Add Subcategory"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Subcategories */}
                              {isCategoryExpanded && (
                                <div className="bg-white">
                                  {categorySubcategories.length > 0 ? (
                                    categorySubcategories.map((subcategory) => {
                                      const subcategoryParttypes =
                                        subcategory.parttypes || [];
                                      const isSubcategoryExpanded =
                                        expandedSubcategories.has(
                                          subcategory.id
                                        );

                                      return (
                                        <div
                                          key={subcategory.id}
                                          className="border-t border-gray-200"
                                        >
                                          {/* Subcategory Row */}
                                          <div className="group bg-white hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center justify-between p-3 pl-12">
                                              <div className="flex items-center gap-2 flex-1">
                                                <button
                                                  onClick={() =>
                                                    toggleSubcategory(
                                                      subcategory.id
                                                    )
                                                  }
                                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                >
                                                  {isSubcategoryExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                                  ) : (
                                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                                  )}
                                                </button>
                                                {editingItem?.id ===
                                                  subcategory.id &&
                                                editingItem?.type ===
                                                  "subcategory" ? (
                                                  <div className="flex items-center gap-2 flex-1">
                                                    <input
                                                      type="text"
                                                      value={editValue}
                                                      onChange={(e) =>
                                                        setEditValue(
                                                          e.target.value
                                                        )
                                                      }
                                                      className="flex-1 px-3 py-1.5 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                      autoFocus
                                                    />
                                                    <button
                                                      onClick={handleSaveEdit}
                                                      className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                                    >
                                                      <Save className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                      onClick={handleCancelEdit}
                                                      className="p-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                                    >
                                                      <X className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <span className="font-medium text-gray-700 flex-1">
                                                      {subcategory.name}
                                                    </span>
                                                    <span className="text-xs flex text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                                                      {
                                                        subcategoryParttypes.length
                                                      }{" "}
                                                      <p> parts</p>
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                              {!(
                                                editingItem?.id ===
                                                subcategory.id
                                              ) && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button
                                                    onClick={() =>
                                                      handleEdit(
                                                        subcategory,
                                                        "subcategory"
                                                      )
                                                    }
                                                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                                    title="Edit Subcategory"
                                                  >
                                                    <Edit2 className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      handleDeleteClick(
                                                        subcategory,
                                                        "subcategory"
                                                      )
                                                    }
                                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                    title="Delete Subcategory"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      handleOpenAddModal(
                                                        "parttype",
                                                        null,
                                                        subcategory.id
                                                      )
                                                    }
                                                    className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                    title="Add Part Type"
                                                  >
                                                    <Plus className="w-4 h-4" />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Part Types */}
                                          {isSubcategoryExpanded &&
                                            subcategoryParttypes.length > 0 && (
                                              <div className="bg-gray-50">
                                                {subcategoryParttypes.map(
                                                  (parttype) => (
                                                    <div
                                                      key={parttype.id}
                                                      className="group border-t border-gray-200 bg-white hover:bg-gray-100 transition-colors"
                                                    >
                                                      <div className="flex items-center justify-between p-3 pl-24">
                                                        {editingItem?.id ===
                                                          parttype.id &&
                                                        editingItem?.type ===
                                                          "parttype" ? (
                                                          <div className="flex items-center gap-2 flex-1">
                                                            <input
                                                              type="text"
                                                              value={editValue}
                                                              onChange={(e) =>
                                                                setEditValue(
                                                                  e.target.value
                                                                )
                                                              }
                                                              className="flex-1 px-3 py-1.5 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                              autoFocus
                                                            />
                                                            <button
                                                              onClick={
                                                                handleSaveEdit
                                                              }
                                                              className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                                            >
                                                              <Save className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                              onClick={
                                                                handleCancelEdit
                                                              }
                                                              className="p-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                                            >
                                                              <X className="w-4 h-4" />
                                                            </button>
                                                          </div>
                                                        ) : (
                                                          <>
                                                            <div className="flex items-center gap-2 flex-1">
                                                              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                                              <span className="text-sm text-gray-700">
                                                                {parttype.name}
                                                              </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                              <button
                                                                onClick={() =>
                                                                  handleEdit(
                                                                    parttype,
                                                                    "parttype"
                                                                  )
                                                                }
                                                                className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                                                title="Edit Part Type"
                                                              >
                                                                <Edit2 className="w-4 h-4" />
                                                              </button>
                                                              <button
                                                                onClick={() =>
                                                                  handleDeleteClick(
                                                                    parttype,
                                                                    "parttype"
                                                                  )
                                                                }
                                                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                                title="Delete Part Type"
                                                              >
                                                                <Trash2 className="w-4 h-4" />
                                                              </button>
                                                            </div>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="p-4 pl-12 text-sm text-gray-500 italic">
                                      No subcategories
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {/* Infinite scroll trigger */}
                        {hasMoreCategories && (
                          <div ref={observerTarget} className="p-0 m-0">
                            {loadingMore && (
                              <div className="flex justify-center bg-white py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Pagination Footer */}
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                        Showing {categories.length} of {stats.categories}{" "}
                        {stats.categories === 1 ? "category" : "categories"}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No categories found</p>
                  </div>
                )}
              </div>
            </>
          )}
          {/* Add Modal for Category, Subcategory, Part Type */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {addType === "category" && "Add New Categories"}
                    {addType === "subcategory" && "Add New Subcategories"}
                    {addType === "parttype" && "Add New Part Type Categories"}
                  </h2>
                  <button
                    onClick={handleCloseAddModal}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    disabled={adding}
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {addType === "category" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Categories Name
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          placeholder="Enter categories name"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subcategories Name
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          value={newSubcategory}
                          onChange={(e) => setNewSubcategory(e.target.value)}
                          placeholder="Enter subcategories name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Part Types Categories
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          value={newPartType}
                          onChange={(e) => setNewPartType(e.target.value)}
                          placeholder="Enter part type"
                          disabled={!newSubcategory.trim()}
                        />
                      </div>
                    </>
                  )}
                  {addType === "subcategory" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subcategory Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        value={newSubcategory}
                        onChange={(e) => setNewSubcategory(e.target.value)}
                        placeholder="Enter subcategory name"
                        autoFocus
                      />
                    </div>
                  )}
                  {addType === "parttype" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Part Type Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        value={newPartType}
                        onChange={(e) => setNewPartType(e.target.value)}
                        placeholder="Enter part type name"
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleAdd}
                      disabled={adding}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {adding ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Add
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCloseAddModal}
                      disabled={adding}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && deleteItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Delete{" "}
                    {deleteType === "category"
                      ? "Category"
                      : deleteType === "subcategory"
                      ? "Subcategory"
                      : "Part Type"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteItem(null);
                      setDeleteType("");
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium mb-1">
                          Delete "{deleteItem.name}"?
                        </p>
                        <p className="text-sm text-gray-600">
                          {deleteType === "category" &&
                            "This will also delete all subcategories and part types under this category."}
                          {deleteType === "subcategory" &&
                            "This will also delete all part types under this subcategory."}
                          {deleteType === "parttype" &&
                            "This part type will be deleted."}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                          This cannot be undone.
                        </p>
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
                          setDeleteType("");
                        }}
                        disabled={deleting}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Categories;
