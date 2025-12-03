// src/components/FileUpload.jsx
import React, { useState, useRef } from "react";
import {
  Upload,
  Loader,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  HelpCircle,
  Download,
} from "lucide-react";
import {
  parseCSV,
  validateCSV,
  generateSampleCSV,
  parseCategoryCSV,
  validateCategoryCSV,
} from "../utils/csvParser";

const FileUpload = ({
  onFileUpload,
  isProcessing,
  onClearFile,
  onClearCategories,
  customCategoriesUploaded,
  externalFileInfo,
  externalValidationResults,
  externalUploadType,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', 'processing'
  const [showHelp, setShowHelp] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [uploadType, setUploadType] = useState("products"); // Always 'products' by default
  const fileInputRef = useRef(null);

  // Keep uploadType as 'products' to always show the correct label
  React.useEffect(() => {
    setUploadType("products");
  }, []);

  // If the parent passes an external file info (e.g. parent uploaded file via another input), reflect it here
  React.useEffect(() => {
    if (externalFileInfo) {
      setFileInfo(externalFileInfo);
      setValidationResults(externalValidationResults || null);
      setUploadStatus(externalFileInfo ? "success" : null);
      if (externalUploadType) setUploadType(externalUploadType);
    }
  }, [externalFileInfo, externalValidationResults, externalUploadType]);

  // Handle file selection
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file, uploadType);
    }
  };

  // Handle drag and drop
  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0], uploadType);
    }
  };

  const processFile = async (file, type = "products") => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadStatus("error");
      setFileInfo({
        name: file.name,
        size: formatFileSize(file.size),
        error: "Please select a CSV file",
      });
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadStatus("error");
      setFileInfo({
        name: file.name,
        size: formatFileSize(file.size),
        error: "File too large. Maximum size is 50MB",
      });
      return;
    }

    setUploadStatus("processing");
    setFileInfo({
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type || "text/csv",
    });

    try {
      let parsedData;
      let validation;

      if (type === "categories") {
        // Parse Category CSV
        parsedData = await parseCategoryCSV(file);
        validation = validateCategoryCSV(parsedData);
      } else {
        // Parse Product CSV
        parsedData = await parseCSV(file);
        validation = validateCSV(parsedData);
      }

      setValidationResults(validation);

      if (!validation.isValid) {
        setUploadStatus("error");
        setFileInfo((prev) => ({
          ...prev,
          error: validation.errors.join("; "),
        }));
        return;
      }

      setUploadStatus("success");

      // Build a file info object to optionally hand back to parent
      const fileInfoObj = {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || "text/csv",
      };

      // Call parent handler with parsed data
      if (onFileUpload) {
        // pass a third argument indicating whether this upload is for products or categories
        // pass a fourth argument with the filename
        onFileUpload(parsedData, validation, type, file.name);
      }

      // Update local state
      setFileInfo(fileInfoObj);
      setValidationResults(validation);
    } catch (error) {
      setUploadStatus("error");
      setFileInfo((prev) => ({
        ...prev,
        error: error.message,
      }));
    }
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Clear file selection
  const clearFile = () => {
    setFileInfo(null);
    setUploadStatus(null);
    setValidationResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onClearFile) {
      onClearFile();
    }
  };

  // Update status based on processing prop
  React.useEffect(() => {
    if (!isProcessing && uploadStatus === "processing") {
      // Processing completed externally
    }
  }, [isProcessing, uploadStatus]);

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case "processing":
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus) {
      case "processing":
        return "border-blue-300 bg-blue-50";
      case "success":
        return "border-green-300 bg-green-50";
      case "error":
        return "border-red-300 bg-red-50";
      default:
        return "border-gray-300 bg-white";
    }
  };

  return (
    <div className="mb-6">
      {/* File Upload Area */}
      <div
        className={`relative p-8 border-2 border-dashed rounded-lg transition-all duration-200 ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : fileInfo
            ? getStatusColor()
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Help Button */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-colors"
          title="Show help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <div className="text-center">
          {fileInfo ? (
            /* File Information Display */
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3">
                {getStatusIcon()}
                <div className="text-left">
                  <div className="font-medium text-gray-900">
                    {fileInfo.name}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center space-x-2">
                    <span>
                      {fileInfo.size} • {fileInfo.type}
                    </span>
                    <span className="ml-2 inline-block text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                      {uploadType === "products" ? "Products" : "Categories"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  disabled={uploadStatus === "processing"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {fileInfo.error && (
                <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-red-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">
                      {fileInfo.error}
                    </span>
                  </div>
                </div>
              )}

              {uploadStatus === "processing" && (
                <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg">
                  <div className="text-blue-800 text-sm font-medium">
                    Processing CSV file...
                  </div>
                  <div className="text-blue-600 text-xs mt-1">
                    Parsing rows and validating data structure
                  </div>
                </div>
              )}

              {uploadStatus === "success" && validationResults && (
                <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                  <div className="text-green-800 text-sm font-medium">
                    ✅ File uploaded successfully!
                  </div>
                  <div className="text-green-600 text-xs mt-1">
                    {validationResults.stats.totalProducts} products found •
                    {validationResults.stats.hasName} with names •
                    {validationResults.stats.hasDescription} with descriptions
                    {validationResults.stats.hasCategory > 0 && (
                      <span>
                        {" "}
                        • {validationResults.stats.hasCategory} with categories
                      </span>
                    )}
                    {validationResults.stats.hasSubcategory > 0 && (
                      <span>
                        {" "}
                        • {validationResults.stats.hasSubcategory} with
                        subcategories
                      </span>
                    )}
                    {validationResults.stats.hasPartType > 0 && (
                      <span>
                        {" "}
                        • {validationResults.stats.hasPartType} with part types
                      </span>
                    )}
                  </div>
                  {validationResults.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-amber-700">
                      ⚠️ {validationResults.warnings.length} warnings (click to
                      view details)
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Upload Prompt */
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto" />
                  {dragOver && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 border-4 border-blue-400 border-dashed rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {dragOver ? "Drop your CSV file here" : "Upload Product Data"}
                </h3>
                <p className="text-gray-600 mb-4">
                  CSV file with product names, descriptions, brands, and part
                  numbers
                </p>
              </div>

              {/* Upload Buttons */}
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  className="hidden"
                />

                <div className="inline-flex items-center justify-center space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadType("products");
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    disabled={isProcessing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Products
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadType("categories");
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                    className="inline-flex items-center px-4 py-3 border border-gray-300 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    disabled={isProcessing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Categories
                  </button>
                </div>

                <div className="text-sm text-gray-500">
                  or drag and drop your file here
                </div>
              </div>

              {/* File Requirements */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>• Supported format: CSV files only</div>
                <div>• Maximum file size: 50MB</div>
                <div>• Recommended: UTF-8 encoding</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <h4 className="font-semibold mb-2">CSV File Requirements</h4>

              <div className="space-y-3">
                <div>
                  <strong>Required Columns (any of these names work):</strong>
                  <ul className="mt-1 space-y-1 text-blue-700 text-xs">
                    <li>
                      • Product Name:{" "}
                      <code>
                        name, Name, product_name, Product Name, title, Title
                      </code>
                    </li>
                    <li>
                      • Description:{" "}
                      <code>
                        description, Description, desc, details, specifications
                      </code>
                    </li>
                    <li>
                      • Brand:{" "}
                      <code>brand, Brand, manufacturer, Manufacturer, mfg</code>
                    </li>
                    <li>
                      • Part Number:{" "}
                      <code>
                        part_number, Part Number, sku, SKU, model, mpn
                      </code>
                    </li>
                  </ul>
                </div>

                <div>
                  <strong>Sample CSV Format:</strong>
                  <div className="mt-1 p-2 bg-white border rounded text-xs font-mono">
                    <div className="text-gray-600">
                      Product Name,Description,Brand,Part Number
                    </div>
                    <div className="text-gray-800">
                      3M Sandpaper P320,Body work sanding disc,3M,31542
                    </div>
                    <div className="text-gray-800">
                      Gates Timing Belt,Heavy duty timing belt,Gates,T295
                    </div>
                  </div>
                </div>

                <div>
                  <strong>Advanced Features:</strong>
                  <ul className="mt-1 space-y-1 text-blue-700 text-xs">
                    <li>• Multi-line product descriptions</li>
                    <li>• Quoted fields with commas</li>
                    <li>• Various delimiters (comma, semicolon, tab)</li>
                    <li>• HTML tag cleanup</li>
                    <li>• Multiple encoding formats</li>
                  </ul>
                </div>

                <div>
                  <strong>Processing Capacity:</strong>
                  <ul className="mt-1 space-y-1 text-blue-700 text-xs">
                    <li>• Small files (&lt;1,000 products): &lt;10 seconds</li>
                    <li>
                      • Medium files (1,000-5,000 products): &lt;60 seconds
                    </li>
                    <li>• Large files (5,000+ products): &lt;3 minutes</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => setShowHelp(false)}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Close Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sample Data Download */}
      <div className="mt-4 text-center">
        <button
          onClick={generateSampleCSV}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 underline"
        >
          <Download className="w-4 h-4 mr-1" />
          Download Sample CSV File
        </button>
      </div>

      {/* Validation Details */}
      {validationResults && validationResults.warnings.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="font-medium text-amber-900 mb-2">
            Data Quality Warnings
          </h4>
          <ul className="text-sm text-amber-800 space-y-1">
            {validationResults.warnings.slice(0, 5).map((warning, index) => (
              <li key={index} className="flex items-start">
                <span className="text-amber-600 mr-2">⚠️</span>
                {warning}
              </li>
            ))}
            {validationResults.warnings.length > 5 && (
              <li className="text-amber-600 italic">
                ... and {validationResults.warnings.length - 5} more warnings
              </li>
            )}
          </ul>
          <div className="mt-2 text-xs text-amber-700">
            These warnings won't prevent processing but may affect
            categorization accuracy.
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
