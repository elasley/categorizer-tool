// src/components/TaxonomyManager.jsx
import React, { useState, useMemo } from "react";
import { exportProductsToCSV } from "../utils/exportUtils";
import {
  BarChart3,
  X,
  Plus,
  Edit3,
  Trash2,
  Save,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Tag,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Users,
  TrendingUp,
  Target,
  ArrowRight,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react";

const TaxonomyManager = ({
  isOpen,
  onClose,
  categories,
  products,
  onUpdateCategories,
  onUpdateProducts,
}) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogType, setAddDialogType] = useState("category"); // category, subcategory, partType
  const [addDialogParent, setAddDialogParent] = useState(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState(new Set());

  const taxonomyStats = useMemo(() => {
    const stats = {
      totalCategories: Object.keys(categories).length,
      totalSubcategories: 0,
      totalPartTypes: 0,
      distribution: {},
      performance: {},
      unused: { categories: [], subcategories: [], partTypes: [] },
    };

    Object.entries(categories).forEach(([category, subcategories]) => {
      stats.totalSubcategories += Object.keys(subcategories).length;
      stats.distribution[category] = {
        total: 0,
        subcategories: {},
      };

      Object.entries(subcategories).forEach(([subcategory, partTypes]) => {
        stats.totalPartTypes += partTypes.length;
        stats.distribution[category].subcategories[subcategory] = {
          total: 0,
          partTypes: {},
        };

        partTypes.forEach((partType) => {
          stats.distribution[category].subcategories[subcategory].partTypes[
            partType
          ] = 0;
        });
      });
    });

    products.forEach((product) => {
      const {
        suggestedCategory,
        suggestedSubcategory,
        suggestedPartType,
        confidence,
      } = product;

      if (suggestedCategory && stats.distribution[suggestedCategory]) {
        stats.distribution[suggestedCategory].total++;

        if (
          suggestedSubcategory &&
          stats.distribution[suggestedCategory].subcategories[
            suggestedSubcategory
          ]
        ) {
          stats.distribution[suggestedCategory].subcategories[
            suggestedSubcategory
          ].total++;

          if (
            suggestedPartType &&
            stats.distribution[suggestedCategory].subcategories[
              suggestedSubcategory
            ].partTypes[suggestedPartType] !== undefined
          ) {
            stats.distribution[suggestedCategory].subcategories[
              suggestedSubcategory
            ].partTypes[suggestedPartType]++;
          }
        }
      }
    });

    Object.entries(stats.distribution).forEach(([category, categoryData]) => {
      const totalProducts = categoryData.total;
      const avgConfidence =
        totalProducts > 0
          ? products
              .filter((p) => p.suggestedCategory === category)
              .reduce((sum, p) => sum + (p.confidence || 0), 0) / totalProducts
          : 0;

      stats.performance[category] = {
        productCount: totalProducts,
        avgConfidence: avgConfidence,
        subcategoryCount: Object.keys(categoryData.subcategories).length,
        utilizationRate: totalProducts > 0 ? 1 : 0,
      };

      if (totalProducts === 0) {
        stats.unused.categories.push(category);
      }

      Object.entries(categoryData.subcategories).forEach(
        ([subcategory, subcategoryData]) => {
          if (subcategoryData.total === 0) {
            stats.unused.subcategories.push(`${category} > ${subcategory}`);
          }

          Object.entries(subcategoryData.partTypes).forEach(
            ([partType, count]) => {
              if (count === 0) {
                stats.unused.partTypes.push(
                  `${category} > ${subcategory} > ${partType}`
                );
              }
            }
          );
        }
      );
    });

    return stats;
  }, [categories, products]);

  const filteredTaxonomy = useMemo(() => {
    const filtered = {};

    Object.entries(categories).forEach(([category, subcategories]) => {
      const categoryStats = taxonomyStats.distribution[category];
      const shouldIncludeCategory =
        selectedFilter === "all" ||
        (selectedFilter === "used" && categoryStats.total > 0) ||
        (selectedFilter === "unused" && categoryStats.total === 0) ||
        (selectedFilter === "low-performance" &&
          categoryStats.total > 0 &&
          taxonomyStats.performance[category].avgConfidence < 50);

      const categoryMatchesSearch =
        !searchTerm ||
        category.toLowerCase().includes(searchTerm.toLowerCase());

      if (shouldIncludeCategory && categoryMatchesSearch) {
        filtered[category] = {};

        Object.entries(subcategories).forEach(([subcategory, partTypes]) => {
          const subcategoryMatchesSearch =
            !searchTerm ||
            subcategory.toLowerCase().includes(searchTerm.toLowerCase());

          if (subcategoryMatchesSearch) {
            const filteredPartTypes = partTypes.filter(
              (partType) =>
                !searchTerm ||
                partType.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (filteredPartTypes.length > 0 || !searchTerm) {
              filtered[category][subcategory] = searchTerm
                ? filteredPartTypes
                : partTypes;
            }
          }
        });
      }
    });

    return filtered;
  }, [categories, searchTerm, selectedFilter, taxonomyStats]);

  // Node expansion handlers
  const toggleExpanded = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allNodes = new Set();
    Object.keys(filteredTaxonomy).forEach((category) => {
      allNodes.add(category);
      Object.keys(filteredTaxonomy[category]).forEach((subcategory) => {
        allNodes.add(`${category}:${subcategory}`);
      });
    });
    setExpandedNodes(allNodes);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Edit handlers
  const startEdit = (nodeType, nodePath, currentName) => {
    setEditingNode({ type: nodeType, path: nodePath });
    setNewNodeName(currentName);
  };

  const saveEdit = () => {
    if (!editingNode || !newNodeName.trim()) return;

    const updatedCategories = JSON.parse(JSON.stringify(categories));
    const pathParts = editingNode.path.split(" > ");

    if (editingNode.type === "category") {
      const oldName = pathParts[0];
      if (oldName !== newNodeName && !updatedCategories[newNodeName]) {
        updatedCategories[newNodeName] = updatedCategories[oldName];
        delete updatedCategories[oldName];

        // Update products that reference this category
        const updatedProducts = products.map((product) =>
          product.suggestedCategory === oldName
            ? { ...product, suggestedCategory: newNodeName }
            : product
        );
        onUpdateProducts(updatedProducts);
      }
    } else if (editingNode.type === "subcategory") {
      const [category, oldSubcategory] = pathParts;
      if (
        oldSubcategory !== newNodeName &&
        !updatedCategories[category][newNodeName]
      ) {
        updatedCategories[category][newNodeName] =
          updatedCategories[category][oldSubcategory];
        delete updatedCategories[category][oldSubcategory];

        // Update products
        const updatedProducts = products.map((product) =>
          product.suggestedCategory === category &&
          product.suggestedSubcategory === oldSubcategory
            ? { ...product, suggestedSubcategory: newNodeName }
            : product
        );
        onUpdateProducts(updatedProducts);
      }
    } else if (editingNode.type === "partType") {
      const [category, subcategory, oldPartType] = pathParts;
      const partTypes = updatedCategories[category][subcategory];
      const index = partTypes.indexOf(oldPartType);
      if (index !== -1 && !partTypes.includes(newNodeName)) {
        partTypes[index] = newNodeName;

        // Update products
        const updatedProducts = products.map((product) =>
          product.suggestedCategory === category &&
          product.suggestedSubcategory === subcategory &&
          product.suggestedPartType === oldPartType
            ? { ...product, suggestedPartType: newNodeName }
            : product
        );
        onUpdateProducts(updatedProducts);
      }
    }

    onUpdateCategories(updatedCategories);
    setEditingNode(null);
    setNewNodeName("");
  };

  const cancelEdit = () => {
    setEditingNode(null);
    setNewNodeName("");
  };

  // Add new items
  const showAddItemDialog = (type, parent = null) => {
    setAddDialogType(type);
    setAddDialogParent(parent);
    setShowAddDialog(true);
    setNewNodeName("");
  };

  const addNewItem = () => {
    if (!newNodeName.trim()) return;

    const updatedCategories = JSON.parse(JSON.stringify(categories));

    if (addDialogType === "category") {
      if (!updatedCategories[newNodeName]) {
        updatedCategories[newNodeName] = {};
      }
    } else if (addDialogType === "subcategory") {
      const category = addDialogParent;
      if (!updatedCategories[category][newNodeName]) {
        updatedCategories[category][newNodeName] = [];
      }
    } else if (addDialogType === "partType") {
      const [category, subcategory] = addDialogParent.split(" > ");
      if (!updatedCategories[category][subcategory].includes(newNodeName)) {
        updatedCategories[category][subcategory].push(newNodeName);
      }
    }

    onUpdateCategories(updatedCategories);
    setShowAddDialog(false);
    setNewNodeName("");
  };

  // Delete items
  const deleteItem = (type, path) => {
    if (
      !window.confirm(
        `Are you sure you want to delete this ${type}? This action cannot be undone.`
      )
    ) {
      return;
    }

    const updatedCategories = JSON.parse(JSON.stringify(categories));
    const pathParts = path.split(" > ");

    if (type === "category") {
      delete updatedCategories[pathParts[0]];
    } else if (type === "subcategory") {
      delete updatedCategories[pathParts[0]][pathParts[1]];
    } else if (type === "partType") {
      const [category, subcategory, partType] = pathParts;
      const index = updatedCategories[category][subcategory].indexOf(partType);
      if (index !== -1) {
        updatedCategories[category][subcategory].splice(index, 1);
      }
    }

    onUpdateCategories(updatedCategories);
  };

  // Product selection for bulk operations
  const toggleProductSelection = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAllProducts = () => {
    if (selectedNode) {
      const nodeProducts = getProductsForNode(selectedNode);
      const newSelected = new Set(selectedProducts);
      nodeProducts.forEach((p) => newSelected.add(p.id));
      setSelectedProducts(newSelected);
    }
  };

  // Get products for a specific node
  const getProductsForNode = (node) => {
    if (!node) return [];

    const { type, path } = node;
    const pathParts = path.split(" > ");

    return products.filter((product) => {
      if (type === "category") {
        return product.suggestedCategory === pathParts[0];
      } else if (type === "subcategory") {
        return (
          product.suggestedCategory === pathParts[0] &&
          product.suggestedSubcategory === pathParts[1]
        );
      } else if (type === "partType") {
        return (
          product.suggestedCategory === pathParts[0] &&
          product.suggestedSubcategory === pathParts[1] &&
          product.suggestedPartType === pathParts[2]
        );
      }
      return false;
    });
  };

  // Export taxonomy as JSON (legacy)
  const exportTaxonomy = () => {
    const taxonomyData = {
      categories,
      stats: taxonomyStats,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };
    const blob = new Blob([JSON.stringify(taxonomyData, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taxonomy-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export products as CSV (Excel compatible)
  const exportProductsCSV = () => {
    exportProductsToCSV(products);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Taxonomy Manager
            </h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              {products.length} products • {taxonomyStats.totalCategories}{" "}
              categories
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {/* <button
              onClick={exportTaxonomy}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export JSON</span>
            </button> */}
            <button
              onClick={exportProductsCSV}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search taxonomy..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filter */}
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Items</option>
                <option value="used">Used Items</option>
                <option value="unused">Unused Items</option>
                <option value="low-performance">Low Performance</option>
              </select>

              {/* Expand/Collapse */}
              <div className="flex space-x-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Collapse All
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Add New Category */}
              <button
                onClick={() => showAddItemDialog("category")}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Category</span>
              </button>

              {/* Bulk Edit Toggle */}
              <button
                onClick={() => setBulkEditMode(!bulkEditMode)}
                className={`px-3 py-2 rounded-lg text-sm flex items-center space-x-2 ${
                  bulkEditMode
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>{bulkEditMode ? "Exit Bulk Edit" : "Bulk Edit"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Taxonomy Tree */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-4">
            <TaxonomyTree
              taxonomy={filteredTaxonomy}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
              taxonomyStats={taxonomyStats}
              onNodeSelect={setSelectedNode}
              selectedNode={selectedNode}
              editingNode={editingNode}
              newNodeName={newNodeName}
              setNewNodeName={setNewNodeName}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onDelete={deleteItem}
              onAddItem={showAddItemDialog}
            />
          </div>

          {/* Product Details */}
          <div className="w-1/2 overflow-y-auto">
            <ProductDetails
              selectedNode={selectedNode}
              products={getProductsForNode(selectedNode)}
              bulkEditMode={bulkEditMode}
              selectedProducts={selectedProducts}
              onToggleProductSelection={toggleProductSelection}
              onSelectAllProducts={selectAllProducts}
              onUpdateProducts={onUpdateProducts}
              categories={categories}
            />
          </div>
        </div>

        {/* Add Item Dialog */}
        {showAddDialog && (
          <AddItemDialog
            type={addDialogType}
            parent={addDialogParent}
            newName={newNodeName}
            setNewName={setNewNodeName}
            onAdd={addNewItem}
            onCancel={() => setShowAddDialog(false)}
          />
        )}
      </div>
    </div>
  );
};

// Taxonomy Tree Component
const TaxonomyTree = ({
  taxonomy,
  expandedNodes,
  toggleExpanded,
  taxonomyStats,
  onNodeSelect,
  selectedNode,
  editingNode,
  newNodeName,
  setNewNodeName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddItem,
}) => {
  return (
    <div className="space-y-2">
      {Object.entries(taxonomy).map(([category, subcategories]) => (
        <CategoryNode
          key={category}
          category={category}
          subcategories={subcategories}
          expandedNodes={expandedNodes}
          toggleExpanded={toggleExpanded}
          stats={taxonomyStats.distribution[category]}
          performance={taxonomyStats.performance[category]}
          onNodeSelect={onNodeSelect}
          selectedNode={selectedNode}
          editingNode={editingNode}
          newNodeName={newNodeName}
          setNewNodeName={setNewNodeName}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onDelete={onDelete}
          onAddItem={onAddItem}
        />
      ))}
    </div>
  );
};

// Category Node Component
const CategoryNode = ({
  category,
  subcategories,
  expandedNodes,
  toggleExpanded,
  stats,
  performance,
  onNodeSelect,
  selectedNode,
  editingNode,
  newNodeName,
  setNewNodeName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddItem,
}) => {
  const isExpanded = expandedNodes.has(category);
  const isSelected =
    selectedNode?.type === "category" && selectedNode?.path === category;
  const isEditing =
    editingNode?.type === "category" && editingNode?.path === category;

  const getPerformanceColor = (avgConfidence) => {
    if (avgConfidence >= 80) return "text-green-600";
    if (avgConfidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div>
      <div
        className={`flex items-center p-2 rounded-lg hover:bg-gray-50 ${
          isSelected ? "bg-blue-50 border border-blue-200" : ""
        }`}
      >
        <button
          onClick={() => toggleExpanded(category)}
          className="mr-2 p-1 hover:bg-gray-200 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <FolderOpen className="h-4 w-4 text-blue-600 mr-2" />

        {isEditing ? (
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="text"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
            <button
              onClick={onSaveEdit}
              className="p-1 text-green-600 hover:bg-green-100 rounded"
            >
              <Save className="h-3 w-3" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className="flex-1 flex items-center justify-between cursor-pointer"
            onClick={() => onNodeSelect({ type: "category", path: category })}
          >
            <span className="font-medium text-gray-900">{category}</span>
            <div className="flex items-center space-x-3">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                {stats.total}
              </span>
              {performance.avgConfidence > 0 && (
                <span
                  className={`text-xs font-medium ${getPerformanceColor(
                    performance.avgConfidence
                  )}`}
                >
                  {performance.avgConfidence.toFixed(0)}%
                </span>
              )}
              <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit("category", category, category);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddItem("subcategory", category);
                  }}
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete("category", category);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {Object.entries(subcategories).map(([subcategory, partTypes]) => (
            <SubcategoryNode
              key={subcategory}
              category={category}
              subcategory={subcategory}
              partTypes={partTypes}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
              stats={stats.subcategories[subcategory]}
              onNodeSelect={onNodeSelect}
              selectedNode={selectedNode}
              editingNode={editingNode}
              newNodeName={newNodeName}
              setNewNodeName={setNewNodeName}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onAddItem={onAddItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Subcategory Node Component
const SubcategoryNode = ({
  category,
  subcategory,
  partTypes,
  expandedNodes,
  toggleExpanded,
  stats,
  onNodeSelect,
  selectedNode,
  editingNode,
  newNodeName,
  setNewNodeName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddItem,
}) => {
  const nodeId = `${category}:${subcategory}`;
  const nodePath = `${category} > ${subcategory}`;
  const isExpanded = expandedNodes.has(nodeId);
  const isSelected =
    selectedNode?.type === "subcategory" && selectedNode?.path === nodePath;
  const isEditing =
    editingNode?.type === "subcategory" && editingNode?.path === nodePath;

  return (
    <div>
      <div
        className={`flex items-center p-2 rounded-lg hover:bg-gray-50 ${
          isSelected ? "bg-blue-50 border border-blue-200" : ""
        }`}
      >
        <button
          onClick={() => toggleExpanded(nodeId)}
          className="mr-2 p-1 hover:bg-gray-200 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <Folder className="h-3 w-3 text-orange-600 mr-2" />

        {isEditing ? (
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="text"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
            <button
              onClick={onSaveEdit}
              className="p-1 text-green-600 hover:bg-green-100 rounded"
            >
              <Save className="h-3 w-3" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className="flex-1 flex items-center justify-between cursor-pointer group"
            onClick={() =>
              onNodeSelect({ type: "subcategory", path: nodePath })
            }
          >
            <span className="text-sm text-gray-700">{subcategory}</span>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                {stats.total}
              </span>
              <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit("subcategory", nodePath, subcategory);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddItem("partType", nodePath);
                  }}
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete("subcategory", nodePath);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {partTypes.map((partType) => (
            <PartTypeNode
              key={partType}
              category={category}
              subcategory={subcategory}
              partType={partType}
              count={stats.partTypes[partType] || 0}
              onNodeSelect={onNodeSelect}
              selectedNode={selectedNode}
              editingNode={editingNode}
              newNodeName={newNodeName}
              setNewNodeName={setNewNodeName}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Part Type Node Component
const PartTypeNode = ({
  category,
  subcategory,
  partType,
  count,
  onNodeSelect,
  selectedNode,
  editingNode,
  newNodeName,
  setNewNodeName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}) => {
  const nodePath = `${category} > ${subcategory} > ${partType}`;
  const isSelected =
    selectedNode?.type === "partType" && selectedNode?.path === nodePath;
  const isEditing =
    editingNode?.type === "partType" && editingNode?.path === nodePath;

  return (
    <div
      className={`flex items-center p-2 rounded-lg hover:bg-gray-50 ${
        isSelected ? "bg-blue-50 border border-blue-200" : ""
      }`}
    >
      <div className="w-6 mr-2" />
      <Tag className="h-3 w-3 text-green-600 mr-2" />

      {isEditing ? (
        <div className="flex-1 flex items-center space-x-2">
          <input
            type="text"
            value={newNodeName}
            onChange={(e) => setNewNodeName(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            autoFocus
          />
          <button
            onClick={onSaveEdit}
            className="p-1 text-green-600 hover:bg-green-100 rounded"
          >
            <Save className="h-3 w-3" />
          </button>
          <button
            onClick={onCancelEdit}
            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          className="flex-1 flex items-center justify-between cursor-pointer group"
          onClick={() => onNodeSelect({ type: "partType", path: nodePath })}
        >
          <span className="text-sm text-gray-600">{partType}</span>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
              {count}
            </span>
            <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit("partType", nodePath, partType);
                }}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete("partType", nodePath);
                }}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Product Details Component
const ProductDetails = ({
  selectedNode,
  products,
  bulkEditMode,
  selectedProducts,
  onToggleProductSelection,
  onSelectAllProducts,
  onUpdateProducts,
  categories,
}) => {
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkPartType, setBulkPartType] = useState("");

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Select a taxonomy item</p>
          <p className="text-sm">
            Click on any category, subcategory, or part type to view associated
            products
          </p>
        </div>
      </div>
    );
  }

  const applyBulkChanges = () => {
    if (!bulkCategory || !bulkSubcategory || !bulkPartType) {
      alert("Please select complete category path for bulk update");
      return;
    }

    const selectedProductIds = Array.from(selectedProducts);
    if (selectedProductIds.length === 0) {
      alert("Please select products to update");
      return;
    }

    const updatedProducts = products.map((product) => {
      if (selectedProductIds.includes(product.id)) {
        return {
          ...product,
          suggestedCategory: bulkCategory,
          suggestedSubcategory: bulkSubcategory,
          suggestedPartType: bulkPartType,
          status: "manual-assigned",
          confidence: 100,
        };
      }
      return product;
    });

    onUpdateProducts(updatedProducts);
    alert(`Updated ${selectedProductIds.length} products`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-blue-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedNode.path.split(" > ").pop()} Products
            </h3>
            <p className="text-sm text-gray-600">{selectedNode.path}</p>
            <p className="text-xs text-gray-500 mt-1">
              {products.length} products found
            </p>
          </div>

          {bulkEditMode && (
            <div className="flex items-center space-x-2">
              <button
                onClick={onSelectAllProducts}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Select All
              </button>
              <span className="text-sm text-gray-600">
                {selectedProducts.size} selected
              </span>
            </div>
          )}
        </div>

        {/* Bulk Edit Controls */}
        {bulkEditMode && selectedProducts.size > 0 && (
          <div className="mt-4 p-3 bg-white rounded border border-orange-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Bulk Reassign Categories
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={bulkCategory}
                onChange={(e) => {
                  setBulkCategory(e.target.value);
                  setBulkSubcategory("");
                  setBulkPartType("");
                }}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Select Category</option>
                {Object.keys(categories).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={bulkSubcategory}
                onChange={(e) => {
                  setBulkSubcategory(e.target.value);
                  setBulkPartType("");
                }}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!bulkCategory}
              >
                <option value="">Select Subcategory</option>
                {bulkCategory &&
                  Object.keys(categories[bulkCategory] || {}).map((subcat) => (
                    <option key={subcat} value={subcat}>
                      {subcat}
                    </option>
                  ))}
              </select>

              <select
                value={bulkPartType}
                onChange={(e) => setBulkPartType(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!bulkSubcategory}
              >
                <option value="">Select Part Type</option>
                {bulkSubcategory &&
                  (categories[bulkCategory]?.[bulkSubcategory] || []).map(
                    (part) => (
                      <option key={part} value={part}>
                        {part}
                      </option>
                    )
                  )}
              </select>
            </div>

            <button
              onClick={applyBulkChanges}
              disabled={!bulkPartType}
              className="mt-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm"
            >
              Apply to {selectedProducts.size} Products
            </button>
          </div>
        )}
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto">
        {products.length > 0 ? (
          <div className="p-4 space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className={`p-3 border rounded-lg transition-all ${
                  bulkEditMode && selectedProducts.has(product.id)
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start space-x-3">
                  {bulkEditMode && (
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => onToggleProductSelection(product.id)}
                      className="mt-1"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {product.name || product.title || "Unnamed Product"}
                    </p>
                    {product.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {product.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      {product.brand && (
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          Brand: {product.brand}
                        </span>
                      )}
                      {product.partNumber && (
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          Part #: {product.partNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-gray-500">
                        {product.suggestedCategory} →{" "}
                        {product.suggestedSubcategory} →{" "}
                        {product.suggestedPartType}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            product.confidence > 80
                              ? "bg-green-100 text-green-800"
                              : product.confidence > 60
                              ? "bg-blue-100 text-blue-800"
                              : product.confidence > 40
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {product.confidence}% confidence
                        </span>

                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            product.status === "high-confidence"
                              ? "bg-green-100 text-green-800"
                              : product.status === "needs-review"
                              ? "bg-yellow-100 text-yellow-800"
                              : product.status === "manual-assigned"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {product.status || "pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm">
                This taxonomy item doesn't have any assigned products yet
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AddItemDialog = ({
  type,
  parent,
  newName,
  setNewName,
  onAdd,
  onCancel,
}) => {
  const getTitle = () => {
    if (type === "category") return "Add New Category";
    if (type === "subcategory") return `Add Subcategory to "${parent}"`;
    if (type === "partType") return `Add Part Type to "${parent}"`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {getTitle()}
        </h3>

        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Enter ${type} name...`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            disabled={!newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Add {type}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaxonomyManager;
