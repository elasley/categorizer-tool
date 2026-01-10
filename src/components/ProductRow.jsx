import React, { useState, useEffect, useCallback } from "react";
import {
  Edit2,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  CircleCheck,
  Check,
  Trash2,
  Loader2,
} from "lucide-react";
import { stripHtmlTags } from "../utils/textUtils";

// ✅ Component optimized with React.memo export (see bottom of file)
const ProductRow = ({
  product,
  onUpdate,
  onFieldUpdate,
  confidenceThreshold,
  categories,
  onAddCustomCategory,
  onDelete,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showCustomSubcategory, setShowCustomSubcategory] = useState(false);
  const [showCustomPartType, setShowCustomPartType] = useState(false);
  const [customSubcategory, setCustomSubcategory] = useState("");
  const [customPartType, setCustomPartType] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const getCurrentDisplayValue = (originalField, suggestedField) => {
      if (
        product[suggestedField] &&
        product[suggestedField] !== product[originalField]
      ) {
        return product[suggestedField];
      }
      return product[originalField] || "";
    };

    const initialData = {
      title: product.title || "",
      description: product.description || "",
      "Category 1": product["Category 1"] || "",
      "Category 2": product["Category 2"] || "",
      "Category 3": product["Category 3"] || "",
      suggestedCategory: getCurrentDisplayValue(
        "Category 1",
        "suggestedCategory"
      ),
      suggestedSubcategory: getCurrentDisplayValue(
        "Category 2",
        "suggestedSubcategory"
      ),
      suggestedPartType: getCurrentDisplayValue(
        "Category 3",
        "suggestedPartType"
      ),
    };
    setEditData(initialData);
  }, [product]);

  const getStatusStyle = useCallback(() => {
    if (product.confidence >= confidenceThreshold)
      return "bg-green-100 text-green-800";
    if (product.confidence >= 40) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }, [product.confidence, confidenceThreshold]);

  const resetCustomInputs = () => {
    setShowCustomSubcategory(false);
    setShowCustomPartType(false);
    setCustomSubcategory("");
    setCustomPartType("");
  };

  const handleSave = useCallback(() => {
    if (onUpdate) {
      onUpdate(
        product.id,
        editData.suggestedCategory,
        editData.suggestedSubcategory,
        editData.suggestedPartType
      );
    }
    if (onFieldUpdate) {
      onFieldUpdate(product.id, editData);
    }
    setIsEditing(false);
    resetCustomInputs();
  }, [product.id, editData, onUpdate, onFieldUpdate]);

  const handleCancel = useCallback(() => {
    const getCurrentDisplayValue = (originalField, suggestedField) => {
      if (
        product[suggestedField] &&
        product[suggestedField] !== product[originalField]
      ) {
        return product[suggestedField];
      }
      return product[originalField] || "";
    };

    const resetData = {
      title: product.title || "",
      description: product.description || "",
      "Category 1": product["Category 1"] || "",
      "Category 2": product["Category 2"] || "",
      "Category 3": product["Category 3"] || "",
      suggestedCategory: getCurrentDisplayValue(
        "Category 1",
        "suggestedCategory"
      ),
      suggestedSubcategory: getCurrentDisplayValue(
        "Category 2",
        "suggestedSubcategory"
      ),
      suggestedPartType: getCurrentDisplayValue(
        "Category 3",
        "suggestedPartType"
      ),
    };
    setEditData(resetData);
    setIsEditing(false);
    resetCustomInputs();
  }, [product]);

  const handleFieldChange = useCallback((field, value) => {
    if (value === "custom-other") {
      if (field === "suggestedSubcategory") {
        setShowCustomSubcategory(true);
        return;
      } else if (field === "suggestedPartType") {
        setShowCustomPartType(true);
        return;
      }
    } else {
      if (field === "suggestedSubcategory") {
        setShowCustomSubcategory(false);
        setCustomSubcategory("");
      } else if (field === "suggestedPartType") {
        setShowCustomPartType(false);
        setCustomPartType("");
      }
    }

    setEditData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "suggestedCategory"
        ? { suggestedSubcategory: "", suggestedPartType: "" }
        : {}),
      ...(field === "suggestedSubcategory" ? { suggestedPartType: "" } : {}),
    }));
  }, []);

  const handleCustomSubcategorySubmit = useCallback(() => {
    if (customSubcategory.trim()) {
      setEditData((prev) => ({
        ...prev,
        suggestedSubcategory: customSubcategory.trim(),
        suggestedPartType: "",
      }));
      setShowCustomSubcategory(false);
      setCustomSubcategory("");
      if (
        onAddCustomCategory &&
        editData.suggestedCategory &&
        customSubcategory.trim()
      ) {
        onAddCustomCategory({
          category: editData.suggestedCategory,
          subcategory: customSubcategory.trim(),
          type: "subcategory",
        });
      }
    }
  }, [customSubcategory, onAddCustomCategory, editData.suggestedCategory]);

  const handleCustomPartTypeSubmit = useCallback(() => {
    if (customPartType.trim()) {
      setEditData((prev) => ({
        ...prev,
        suggestedPartType: customPartType.trim(),
      }));
      setShowCustomPartType(false);
      setCustomPartType("");
      if (
        onAddCustomCategory &&
        editData.suggestedCategory &&
        editData.suggestedSubcategory &&
        customPartType.trim()
      ) {
        onAddCustomCategory({
          category: editData.suggestedCategory,
          subcategory: editData.suggestedSubcategory,
          partType: customPartType.trim(),
          type: "partType",
        });
      }
    }
  }, [
    customPartType,
    onAddCustomCategory,
    editData.suggestedCategory,
    editData.suggestedSubcategory,
  ]);

  const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    const cleanText = stripHtmlTags(text);
    return cleanText.length > maxLength
      ? `${cleanText.substring(0, maxLength)}...`
      : cleanText;
  };

  const getDisplayValue = (originalField, suggestedField) => {
    if (
      product[suggestedField] &&
      product[suggestedField] !== product[originalField]
    ) {
      return product[suggestedField];
    }
    return product[originalField] || "Not specified";
  };

  const getDropdownOptions = (options, currentValue) => {
    const optionsList = options || [];
    const hasCurrentValue = currentValue && optionsList.includes(currentValue);

    if (currentValue && !hasCurrentValue) {
      return [...optionsList, currentValue];
    }

    return optionsList;
  };

  const renderImageCell = () => {
    const images = [
      product["Image 1"],
      product["Image 2"],
      product["Image 3"],
    ].filter(Boolean);
    if (images.length === 0)
      return <span className="text-gray-400">No images</span>;

    return (
      <div className="flex space-x-1">
        {images.slice(0, 2).map((img, idx) => (
          <a
            key={idx}
            href={img}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
          >
            Img {idx + 1}
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        ))}
        {images.length > 2 && (
          <span className="text-xs text-gray-500">
            +{images.length - 2} more
          </span>
        )}
      </div>
    );
  };

  const handleRowClick = (e) => {
    if (
      e.target.tagName === "BUTTON" ||
      e.target.tagName === "INPUT" ||
      e.target.tagName === "SELECT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.closest("button") ||
      isEditing
    ) {
      return;
    }
    setIsEditing(true);
  };

  return (
    <tr
      className={`transition-colors duration-200 ${
        isEditing
          ? "bg-blue-50 hover:bg-gray-50 "
          : "hover:bg-gray-50 cursor-pointer"
      }`}
      onClick={handleRowClick}
    >
      <td className="px-6 py-4 min-w-80 relative">
        <div className="space-y-3">
          {isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="h-6 flex justify-center items-center w-6 absolute text-xs bg-red-600 top-1 left-8 text-white rounded-full "
              >
                <X size={15} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                className="h-6 flex justify-center items-center w-6 absolute text-xs bg-green-600 top-1 left-1 text-white rounded-full "
              >
                <Check size={15} />
              </button>
            </div>
          )}
          <div className="font-medium text-gray-900 relative group">
            {isEditing ? (
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-medium">
                  Product Title
                </label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter product title"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <div className="flex items-center group">
                <span title={stripHtmlTags(product.title)} className="flex-1">
                  {truncateText(product.title, 60) || "Unnamed Product"}
                </span>
                <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2 flex-shrink-0" />
              </div>
            )}
          </div>

          {(product.description || isEditing) && (
            <div className="text-sm text-gray-600">
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">
                    Description
                  </label>
                  <textarea
                    value={editData.description}
                    onChange={(e) =>
                      handleFieldChange("description", e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                    rows={4}
                    placeholder="Enter product description"
                  />
                </div>
              ) : (
                <span title={stripHtmlTags(product.description)}>
                  {truncateText(product.description, 80)}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 text-xs text-gray-500">
            {product.brand && (
              <span>Brand: {stripHtmlTags(product.brand)}</span>
            )}
            {product["Master SKU"] && <span>SKU: {product["Master SKU"]}</span>}
            {product.MPN && <span>MPN: {product.MPN}</span>}
          </div>
        </div>
      </td>

      <td className="px-6 py-4 min-w-48">
        {isEditing ? (
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">
              Category
            </label>
            <select
              value={editData.suggestedCategory || ""}
              onChange={(e) =>
                handleFieldChange("suggestedCategory", e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Category</option>
              {Object.keys(categories || {}).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span
            className={`text-sm ${
              product.suggestedCategory &&
              product.suggestedCategory !== product["Category 1"]
                ? "text-blue-600 font-medium"
                : ""
            }`}
          >
            {getDisplayValue("Category 1", "suggestedCategory")}
          </span>
        )}
      </td>

      <td className="px-6 py-4 min-w-48">
        {isEditing ? (
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-medium">
              Subcategory
            </label>
            {!showCustomSubcategory ? (
              <select
                value={editData.suggestedSubcategory || ""}
                onChange={(e) =>
                  handleFieldChange("suggestedSubcategory", e.target.value)
                }
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!editData.suggestedCategory}
              >
                <option value="">Select Subcategory</option>
                {editData.suggestedCategory &&
                  categories[editData.suggestedCategory] &&
                  getDropdownOptions(
                    Object.keys(categories[editData.suggestedCategory]),
                    editData.suggestedSubcategory
                  ).map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                {editData.suggestedCategory && (
                  <option value="custom-other">Other (specify custom)</option>
                )}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customSubcategory}
                  onChange={(e) => setCustomSubcategory(e.target.value)}
                  placeholder="Enter custom subcategory"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleCustomSubcategorySubmit();
                    }
                  }}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCustomSubcategorySubmit();
                    }}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomSubcategory(false);
                      setCustomSubcategory("");
                    }}
                    className="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!editData.suggestedCategory && (
              <div className="text-xs text-gray-400">
                Please select a category first
              </div>
            )}
          </div>
        ) : (
          <span
            className={`text-sm ${
              product.suggestedSubcategory &&
              product.suggestedSubcategory !== product["Category 2"]
                ? "text-blue-600 font-medium"
                : ""
            }`}
          >
            {getDisplayValue("Category 2", "suggestedSubcategory")}
          </span>
        )}
      </td>

      {/* Part Type */}
      <td className="px-6 py-4 min-w-48">
        {isEditing ? (
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">
              Part Type
            </label>
            {!showCustomPartType ? (
              <select
                value={editData.suggestedPartType || ""}
                onChange={(e) => {
                  if (e.target.value === "Other") {
                    setShowCustomPartType(true);
                    setCustomPartType("");
                  } else {
                    handleFieldChange("suggestedPartType", e.target.value);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={
                  !editData.suggestedCategory || !editData.suggestedSubcategory
                }
              >
                <option value="">Select Part Type</option>
                {editData.suggestedCategory &&
                  editData.suggestedSubcategory &&
                  categories[editData.suggestedCategory] &&
                  categories[editData.suggestedCategory][
                    editData.suggestedSubcategory
                  ] &&
                  getDropdownOptions(
                    categories[editData.suggestedCategory][
                      editData.suggestedSubcategory
                    ],
                    editData.suggestedPartType
                  ).map((partType) => (
                    <option key={partType} value={partType}>
                      {partType}
                    </option>
                  ))}
                <option value="Other">Other (Enter custom)</option>
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customPartType}
                  onChange={(e) => setCustomPartType(e.target.value)}
                  placeholder="Enter custom part type"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customPartType.trim()) {
                      handleCustomPartTypeSubmit();
                    } else if (e.key === "Escape") {
                      setShowCustomPartType(false);
                      setCustomPartType("");
                    }
                  }}
                  autoFocus
                />
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCustomPartTypeSubmit();
                    }}
                    disabled={!customPartType.trim()}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomPartType(false);
                      setCustomPartType("");
                    }}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {(!editData.suggestedCategory ||
              !editData.suggestedSubcategory) && (
              <div className="text-xs text-gray-400">
                Please select{" "}
                {!editData.suggestedCategory ? "a category" : "a subcategory"}{" "}
                first
              </div>
            )}
          </div>
        ) : (
          <span
            className={`text-sm ${
              product.suggestedPartType &&
              product.suggestedPartType !== product["Category 3"]
                ? "text-blue-600 font-medium"
                : ""
            }`}
          >
            {getDisplayValue("Category 3", "suggestedPartType")}
          </span>
        )}
      </td>

      {/* Dimension columns - temporarily commented out */}
      {/* Height */}
      {/* <td className="px-3 py-4 w-20 text-center">
        <span className="text-sm text-gray-900 font-mono">
          {(product.height || product.Height || "").toString().trim() || "-"}
        </span>
      </td> */}

      {/* Length */}
      {/* <td className="px-3 py-4 w-20 text-center">
        <span className="text-sm text-gray-900 font-mono">
          {(product.length || product.Length || "").toString().trim() || "-"}
        </span>
      </td> */}

      {/* Weight */}
      {/* <td className="px-3 py-4 w-20 text-center">
        <span className="text-sm text-gray-900 font-mono">
          {(product.weight || product.Weight || "").toString().trim() || "-"}
        </span>
      </td> */}

      {/* Width */}
      {/* <td className="px-3 py-4 w-20 text-center">
        <span className="text-sm text-gray-900 font-mono">
          {(product.width || product.Width || "").toString().trim() || "-"}
        </span>
      </td> */}

      {/* Confidence */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">
            {product.confidence || 0}%
          </span>
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                product.confidence >= confidenceThreshold
                  ? "bg-green-500"
                  : product.confidence >= 40
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, product.confidence || 0)}%` }}
            />
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle()}`}
        >
          {product.confidence >= confidenceThreshold ? (
            <CheckCircle className="w-4 h-4 mr-1" />
          ) : (
            <AlertTriangle className="w-4 h-4 mr-1" />
          )}
          {product.confidence >= confidenceThreshold
            ? "Good"
            : product.confidence >= 40
            ? "Review"
            : "Low"}
        </span>
      </td>

      {/* Images column - temporarily commented out */}
      {/* <td className="px-6 py-4">{renderImageCell()}</td> */}

      {/* Actions */}
      <td className="px-6 py-4">
        {isEditing ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="inline-flex items-center justify-center w-10 h-10 border border-transparent text-sm font-medium rounded-full text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              title="Save changes (Ctrl+Enter)"
            >
              <Save className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="inline-flex items-center justify-center w-10 h-10 border border-gray-300 text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 shadow-sm hover:shadow-md"
              title="Cancel editing (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="inline-flex items-center justify-center py-1 px-3 border border-gray-300 text-sm font-medium rounded-lg text-white bg-green-500  hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 shadow-sm"
              title="Edit product"
            >
              <Edit2 className="w-4 h-34" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteModal(true);
              }}
              className="inline-flex items-center justify-center py-2 px-2 border border-gray-300 text-sm font-medium rounded-lg text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 shadow-sm"
              title="Delete product"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {showDeleteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm relative">
                  {/* ❌ Close Icon */}
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>

                  <h3 className="text-lg font-semibold mb-4 text-gray-900">
                    Delete Product
                  </h3>

                  <p className="mb-4 text-gray-700">
                    Are you sure you want to permanently delete this product?
                  </p>

                  <div className="flex justify-end gap-2">
                    {/* Cancel */}
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deleting}
                      className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    {/* Delete with loader */}
                    <button
                      onClick={async () => {
                        setDeleting(true);
                        try {
                          if (onDelete) await onDelete(product);
                        } finally {
                          setDeleting(false);
                          setShowDeleteModal(false);
                        }
                      }}
                      disabled={deleting}
                      className={`px-4 py-2 rounded text-white flex items-center gap-2
          ${
            deleting
              ? "bg-red-400 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700"
          }`}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

// ✅ PERFORMANCE: Export memoized component with custom comparison
// Only re-renders if these specific props change
export default React.memo(ProductRow, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.suggestedCategory === nextProps.product.suggestedCategory &&
    prevProps.product.suggestedSubcategory === nextProps.product.suggestedSubcategory &&
    prevProps.product.suggestedPartType === nextProps.product.suggestedPartType &&
    prevProps.product.confidence === nextProps.product.confidence &&
    prevProps.confidenceThreshold === nextProps.confidenceThreshold
  );
});
