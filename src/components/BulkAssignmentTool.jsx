// src/components/BulkAssignmentTool.jsx
import React, { useState, useMemo } from 'react';
import {
  Users, X, Search, Filter, CheckSquare, Square, ArrowRight, Save,
  RotateCcw, Target, AlertTriangle, TrendingUp, Eye, EyeOff,
  ChevronDown, ChevronRight, Plus, Minus, Download, Upload,
  Zap, Brain, Settings, BarChart3
} from 'lucide-react';

const BulkAssignmentTool = ({ 
  isOpen, 
  onClose, 
  products, 
  categories,
  onUpdateProducts,
  confidenceThreshold = 70
}) => {
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    confidence: 'all', // all, high, medium, low, none
    status: 'all', // all, high-confidence, needs-review, low-confidence, manual-assigned, pending
    category: 'all',
    brand: 'all',
    hasIssues: false // products with potential categorization issues
  });
  const [sortBy, setSortBy] = useState('confidence');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [targetCategory, setTargetCategory] = useState('');
  const [targetSubcategory, setTargetSubcategory] = useState('');
  const [targetPartType, setTargetPartType] = useState('');
  const [bulkAction, setBulkAction] = useState('reassign'); // reassign, delete, merge, flag
  const [smartSelectionMode, setSmartSelectionMode] = useState(false);
  const [selectionRules, setSelectionRules] = useState({
    minConfidence: 0,
    maxConfidence: 100,
    brands: [],
    keywords: '',
    categories: [],
    excludeManual: false
  });

  const itemsPerPage = 50;

  // Calculate filter options and statistics
  const filterOptions = useMemo(() => {
    const brands = [...new Set(products.map(p => p.brand || p.Brand).filter(Boolean))].sort();
    const categories = [...new Set(products.map(p => p.suggestedCategory).filter(Boolean))].sort();
    const statuses = [...new Set(products.map(p => p.status).filter(Boolean))].sort();
    
    return { brands, categories, statuses };
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      // Search filter
      if (searchTerm) {
        const searchableText = [
          product.name, product.Name, product.description, product.Description,
          product.brand, product.Brand, product.suggestedCategory,
          product.suggestedSubcategory, product.suggestedPartType
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm.toLowerCase())) return false;
      }

      // Confidence filter
      const confidence = product.confidence || 0;
      if (filters.confidence !== 'all') {
        switch (filters.confidence) {
          case 'high': if (confidence < confidenceThreshold) return false; break;
          case 'medium': if (confidence < 40 || confidence >= confidenceThreshold) return false; break;
          case 'low': if (confidence >= 40 || confidence === 0) return false; break;
          case 'none': if (confidence > 0) return false; break;
        }
      }

      // Status filter
      if (filters.status !== 'all' && product.status !== filters.status) return false;

      // Category filter
      if (filters.category !== 'all' && product.suggestedCategory !== filters.category) return false;

      // Brand filter
      if (filters.brand !== 'all') {
        const productBrand = product.brand || product.Brand || '';
        if (productBrand !== filters.brand) return false;
      }

      // Issues filter (products with potential problems)
      if (filters.hasIssues) {
        const hasIssues = 
          confidence < 30 || // Very low confidence
          !product.suggestedCategory || // Not categorized
          (product.suggestedCategory && !product.suggestedSubcategory) || // Incomplete categorization
          (product.brand && confidence < 60); // Branded product with low confidence
        
        if (!hasIssues) return false;
      }

      return true;
    });

    // Apply smart selection rules if enabled
    if (smartSelectionMode) {
      filtered = filtered.filter(product => {
        const confidence = product.confidence || 0;
        if (confidence < selectionRules.minConfidence || confidence > selectionRules.maxConfidence) {
          return false;
        }

        if (selectionRules.brands.length > 0) {
          const productBrand = product.brand || product.Brand || '';
          if (!selectionRules.brands.includes(productBrand)) return false;
        }

        if (selectionRules.keywords) {
          const productText = [product.name, product.description].join(' ').toLowerCase();
          const keywords = selectionRules.keywords.toLowerCase().split(',').map(k => k.trim());
          if (!keywords.some(keyword => productText.includes(keyword))) return false;
        }

        if (selectionRules.categories.length > 0) {
          if (!selectionRules.categories.includes(product.suggestedCategory)) return false;
        }

        if (selectionRules.excludeManual && product.status === 'manual-assigned') {
          return false;
        }

        return true;
      });
    }

    // Sort products
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'confidence':
          aVal = a.confidence || 0;
          bVal = b.confidence || 0;
          break;
        case 'name':
          aVal = (a.name || a.Name || '').toLowerCase();
          bVal = (b.name || b.Name || '').toLowerCase();
          break;
        case 'category':
          aVal = (a.suggestedCategory || '').toLowerCase();
          bVal = (b.suggestedCategory || '').toLowerCase();
          break;
        case 'brand':
          aVal = (a.brand || a.Brand || '').toLowerCase();
          bVal = (b.brand || b.Brand || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [products, searchTerm, filters, sortBy, sortOrder, confidenceThreshold, smartSelectionMode, selectionRules]);

  // Paginated products
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredProducts.length;
    const selected = selectedProducts.size;
    const highConfidence = filteredProducts.filter(p => (p.confidence || 0) >= confidenceThreshold).length;
    const needsReview = filteredProducts.filter(p => (p.confidence || 0) < 50 && (p.confidence || 0) > 0).length;
    const uncategorized = filteredProducts.filter(p => !p.suggestedCategory).length;
    const avgConfidence = total > 0 ? filteredProducts.reduce((sum, p) => sum + (p.confidence || 0), 0) / total : 0;

    return {
      total,
      selected,
      highConfidence,
      needsReview,
      uncategorized,
      avgConfidence: avgConfidence.toFixed(1)
    };
  }, [filteredProducts, selectedProducts, confidenceThreshold]);

  // Selection handlers
  const toggleProductSelection = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Set(selectedProducts);
    paginatedProducts.forEach(product => {
      newSelected.add(product.id);
    });
    setSelectedProducts(newSelected);
  };

  const deselectAll = () => {
    setSelectedProducts(new Set());
  };

  const selectByFilter = (filterType) => {
    const newSelected = new Set(selectedProducts);
    
    filteredProducts.forEach(product => {
      let shouldSelect = false;
      
      switch (filterType) {
        case 'low-confidence':
          shouldSelect = (product.confidence || 0) < 40;
          break;
        case 'needs-review':
          shouldSelect = product.status === 'needs-review';
          break;
        case 'uncategorized':
          shouldSelect = !product.suggestedCategory;
          break;
        case 'high-confidence':
          shouldSelect = (product.confidence || 0) >= confidenceThreshold;
          break;
        case 'branded':
          shouldSelect = !!(product.brand || product.Brand);
          break;
        case 'issues':
          const confidence = product.confidence || 0;
          shouldSelect = confidence < 30 || !product.suggestedCategory || 
                        (product.suggestedCategory && !product.suggestedSubcategory);
          break;
        default:
          break;
      }
      
      if (shouldSelect) {
        newSelected.add(product.id);
      }
    });
    
    setSelectedProducts(newSelected);
  };

  // Smart selection
  const applySmartSelection = () => {
    const newSelected = new Set();
    
    filteredProducts.forEach(product => {
      const confidence = product.confidence || 0;
      
      // Apply smart selection rules
      if (confidence >= selectionRules.minConfidence && confidence <= selectionRules.maxConfidence) {
        if (selectionRules.brands.length === 0 || selectionRules.brands.includes(product.brand || product.Brand)) {
          if (!selectionRules.keywords || [product.name, product.description].join(' ').toLowerCase().includes(selectionRules.keywords.toLowerCase())) {
            if (selectionRules.categories.length === 0 || selectionRules.categories.includes(product.suggestedCategory)) {
              if (!selectionRules.excludeManual || product.status !== 'manual-assigned') {
                newSelected.add(product.id);
              }
            }
          }
        }
      }
    });
    
    setSelectedProducts(newSelected);
  };

  // Bulk actions
  const executeBulkAction = () => {
    if (selectedProducts.size === 0) {
      alert('Please select products first');
      return;
    }

    switch (bulkAction) {
      case 'reassign':
        if (!targetCategory || !targetSubcategory || !targetPartType) {
          alert('Please select a complete target category path');
          return;
        }
        handleBulkReassignment();
        break;
      case 'delete':
        handleBulkDelete();
        break;
      case 'flag':
        handleBulkFlag();
        break;
      default:
        break;
    }
  };

  const handleBulkReassignment = () => {
    if (showPreview) {
      // Apply the changes
      const selectedIds = Array.from(selectedProducts);
      const updatedProducts = products.map(product => {
        if (selectedIds.includes(product.id)) {
          return {
            ...product,
            suggestedCategory: targetCategory,
            suggestedSubcategory: targetSubcategory,
            suggestedPartType: targetPartType,
            status: 'manual-assigned',
            confidence: 100
          };
        }
        return product;
      });

      onUpdateProducts(updatedProducts);
      setSelectedProducts(new Set());
      setShowPreview(false);
      alert(`Successfully reassigned ${selectedIds.length} products`);
    } else {
      // Show preview
      setShowPreview(true);
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to remove ${selectedProducts.size} products from categorization? This will reset their categories to uncategorized.`)) {
      const selectedIds = Array.from(selectedProducts);
      const updatedProducts = products.map(product => {
        if (selectedIds.includes(product.id)) {
          return {
            ...product,
            suggestedCategory: '',
            suggestedSubcategory: '',
            suggestedPartType: '',
            status: 'pending',
            confidence: 0
          };
        }
        return product;
      });

      onUpdateProducts(updatedProducts);
      setSelectedProducts(new Set());
      alert(`Successfully removed categorization from ${selectedIds.length} products`);
    }
  };

  const handleBulkFlag = () => {
    const selectedIds = Array.from(selectedProducts);
    const updatedProducts = products.map(product => {
      if (selectedIds.includes(product.id)) {
        return {
          ...product,
          status: 'needs-review'
        };
      }
      return product;
    });

    onUpdateProducts(updatedProducts);
    setSelectedProducts(new Set());
    alert(`Successfully flagged ${selectedIds.length} products for review`);
  };

  // Export selected products
  const exportSelected = () => {
    const selectedIds = Array.from(selectedProducts);
    const selectedProductsData = products.filter(p => selectedIds.includes(p.id));
    
    const csvContent = [
      'Product Name,Description,Brand,Current Category,Current Subcategory,Current Part Type,Confidence,Status',
      ...selectedProductsData.map(product => [
        `"${(product.name || '').replace(/"/g, '""')}"`,
        `"${(product.description || '').replace(/"/g, '""')}"`,
        `"${(product.brand || '').replace(/"/g, '""')}"`,
        `"${product.suggestedCategory || ''}"`,
        `"${product.suggestedSubcategory || ''}"`,
        `"${product.suggestedPartType || ''}"`,
        `${product.confidence || 0}%`,
        `"${product.status || 'pending'}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected-products-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-orange-600" />
            <h2 className="text-2xl font-bold text-gray-900">Bulk Assignment Tool</h2>
            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
              {stats.selected} of {stats.total} selected
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-6 gap-4 text-center">
            <div className="bg-white p-3 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Filtered</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-lg font-bold text-orange-600">{stats.selected}</div>
              <div className="text-xs text-gray-600">Selected</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-lg font-bold text-green-600">{stats.highConfidence}</div>
              <div className="text-xs text-gray-600">High Confidence</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-lg font-bold text-yellow-600">{stats.needsReview}</div>
              <div className="text-xs text-gray-600">Needs Review</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-lg font-bold text-red-600">{stats.uncategorized}</div>
              <div className="text-xs text-gray-600">Uncategorized</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{stats.avgConfidence}%</div>
              <div className="text-xs text-gray-600">Avg Confidence</div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Filters and Selection */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            
            {/* Search and Filters */}
            <div className="p-4 border-b border-gray-200 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Quick Filters */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Confidence</label>
                  <select
                    value={filters.confidence}
                    onChange={(e) => setFilters({...filters, confidence: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Levels</option>
                    <option value="high">High (≥{confidenceThreshold}%)</option>
                    <option value="medium">Medium (40-{confidenceThreshold-1}%)</option>
                    <option value="low">Low (1-39%)</option>
                    <option value="none">None (0%)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Statuses</option>
                    {filterOptions.statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({...filters, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Categories</option>
                    {filterOptions.categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Brand</label>
                  <select
                    value={filters.brand}
                    onChange={(e) => setFilters({...filters, brand: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Brands</option>
                    {filterOptions.brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.hasIssues}
                    onChange={(e) => setFilters({...filters, hasIssues: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Show only problematic items</span>
                </label>
              </div>
            </div>

            {/* Quick Selection */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              <h3 className="font-medium text-gray-900">Quick Selection</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-2 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                >
                  Select Page
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-2 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => selectByFilter('low-confidence')}
                  className="w-full px-3 py-2 text-xs text-left bg-red-50 text-red-800 rounded hover:bg-red-100"
                >
                  Select Low Confidence
                </button>
                <button
                  onClick={() => selectByFilter('needs-review')}
                  className="w-full px-3 py-2 text-xs text-left bg-yellow-50 text-yellow-800 rounded hover:bg-yellow-100"
                >
                  Select Needs Review
                </button>
                <button
                  onClick={() => selectByFilter('uncategorized')}
                  className="w-full px-3 py-2 text-xs text-left bg-gray-50 text-gray-800 rounded hover:bg-gray-100"
                >
                  Select Uncategorized
                </button>
                <button
                  onClick={() => selectByFilter('issues')}
                  className="w-full px-3 py-2 text-xs text-left bg-orange-50 text-orange-800 rounded hover:bg-orange-100"
                >
                  Select Problematic
                </button>
              </div>
            </div>

            {/* Smart Selection */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Smart Selection</h3>
                <button
                  onClick={() => setSmartSelectionMode(!smartSelectionMode)}
                  className={`p-1 rounded ${smartSelectionMode ? 'text-purple-600' : 'text-gray-400'}`}
                >
                  <Brain className="h-4 w-4" />
                </button>
              </div>

              {smartSelectionMode && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={selectionRules.minConfidence}
                      onChange={(e) => setSelectionRules({...selectionRules, minConfidence: parseInt(e.target.value) || 0})}
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Max %"
                      value={selectionRules.maxConfidence}
                      onChange={(e) => setSelectionRules({...selectionRules, maxConfidence: parseInt(e.target.value) || 100})}
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  
                  <input
                    type="text"
                    placeholder="Keywords (comma-separated)"
                    value={selectionRules.keywords}
                    onChange={(e) => setSelectionRules({...selectionRules, keywords: e.target.value})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />

                  <button
                    onClick={applySmartSelection}
                    className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                  >
                    Apply Smart Selection
                  </button>
                </div>
              )}
            </div>

            {/* Bulk Actions */}
            <div className="p-4 space-y-4 flex-1">
              <h3 className="font-medium text-gray-900">Bulk Actions</h3>
              
              <div className="space-y-3">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="reassign">Reassign Categories</option>
                  <option value="flag">Flag for Review</option>
                  <option value="delete">Remove Categorization</option>
                </select>

                {bulkAction === 'reassign' && (
                  <div className="space-y-2">
                    <select
                      value={targetCategory}
                      onChange={(e) => {
                        setTargetCategory(e.target.value);
                        setTargetSubcategory('');
                        setTargetPartType('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select Category</option>
                      {Object.keys(categories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <select
                      value={targetSubcategory}
                      onChange={(e) => {
                        setTargetSubcategory(e.target.value);
                        setTargetPartType('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      disabled={!targetCategory}
                    >
                      <option value="">Select Subcategory</option>
                      {targetCategory && Object.keys(categories[targetCategory] || {}).map(subcat => (
                        <option key={subcat} value={subcat}>{subcat}</option>
                      ))}
                    </select>

                    <select
                      value={targetPartType}
                      onChange={(e) => setTargetPartType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      disabled={!targetSubcategory}
                    >
                      <option value="">Select Part Type</option>
                      {targetSubcategory && (categories[targetCategory]?.[targetSubcategory] || []).map(part => (
                        <option key={part} value={part}>{part}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={executeBulkAction}
                    disabled={selectedProducts.size === 0 || (bulkAction === 'reassign' && !targetPartType)}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {showPreview ? <Save className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                    <span>
                      {showPreview ? 'Apply Changes' : 
                       bulkAction === 'reassign' ? 'Preview Reassignment' :
                       bulkAction === 'flag' ? 'Flag for Review' :
                       'Remove Categories'}
                    </span>
                  </button>

                  {showPreview && (
                    <button
                      onClick={() => setShowPreview(false)}
                      className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center justify-center space-x-2"
                    >
                      <EyeOff className="w-4 h-4" />
                      <span>Cancel Preview</span>
                    </button>
                  )}

                  <button
                    onClick={exportSelected}
                    disabled={selectedProducts.size === 0}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Selected</span>
                  </button>
                </div>
              </div>

              {selectedProducts.size > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm text-orange-800">
                    <strong>{selectedProducts.size}</strong> products selected
                  </div>
                  {targetPartType && bulkAction === 'reassign' && (
                    <div className="text-xs text-orange-600 mt-1">
                      → {targetCategory} → {targetSubcategory} → {targetPartType}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Product List */}
          <div className="flex-1 flex flex-col">
            {/* Sort Controls */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="confidence">Confidence</option>
                    <option value="name">Name</option>
                    <option value="category">Category</option>
                    <option value="brand">Brand</option>
                    <option value="status">Status</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length}
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {paginatedProducts.map((product) => (
                  <ProductBulkRow
                    key={product.id}
                    product={product}
                    isSelected={selectedProducts.has(product.id)}
                    onToggleSelection={toggleProductSelection}
                    showPreview={showPreview}
                    targetCategory={targetCategory}
                    targetSubcategory={targetSubcategory}
                    targetPartType={targetPartType}
                    bulkAction={bulkAction}
                    confidenceThreshold={confidenceThreshold}
                  />
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual Product Row Component for Bulk Operations
const ProductBulkRow = ({ 
  product, 
  isSelected, 
  onToggleSelection, 
  showPreview, 
  targetCategory, 
  targetSubcategory, 
  targetPartType,
  bulkAction,
  confidenceThreshold 
}) => {
  const getStatusColor = (status, confidence) => {
    if (confidence < 30) return 'bg-red-100 text-red-800';
    if (status === 'manual-assigned') return 'bg-blue-100 text-blue-800';
    if (confidence >= confidenceThreshold) return 'bg-green-100 text-green-800';
    if (confidence >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= confidenceThreshold) return { bg: 'bg-green-200', fill: 'bg-green-500' };
    if (confidence >= 40) return { bg: 'bg-yellow-200', fill: 'bg-yellow-500' };
    return { bg: 'bg-red-200', fill: 'bg-red-500' };
  };

  const confidenceColors = getConfidenceColor(product.confidence || 0);

  const hasIssues = (product.confidence || 0) < 30 || !product.suggestedCategory || 
                   (product.suggestedCategory && !product.suggestedSubcategory);

  return (
    <div 
      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
        isSelected ? 'bg-orange-50 border-l-4 border-orange-500' : ''
      } ${showPreview && isSelected && bulkAction === 'reassign' ? 'bg-green-50' : ''}`}
      onClick={() => onToggleSelection(product.id)}
    >
      <div className="flex items-start space-x-3">
        <div className="mt-1">
          {isSelected ? 
            <CheckSquare className="w-5 h-5 text-orange-600" /> : 
            <Square className="w-5 h-5 text-gray-400" />
          }
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            {hasIssues && <AlertTriangle className="w-4 h-4 text-red-500" />}
            <span className="font-medium text-gray-900 truncate">
              {product.name || product.Name || 'Unnamed Product'}
            </span>
            <span className={`text-sm font-bold ${
              (product.confidence || 0) >= confidenceThreshold ? 'text-green-600' :
              (product.confidence || 0) >= 40 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {product.confidence || 0}%
            </span>
          </div>
          
          <div className="text-sm text-gray-600 mb-2 truncate">
            {product.description || product.Description || 'No description'}
          </div>
          
          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
            {(product.brand || product.Brand) && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {product.brand || product.Brand}
              </span>
            )}
            {product.suggestedCategory && (
              <span className="bg-blue-100 px-2 py-1 rounded text-blue-800">
                {product.suggestedCategory}
              </span>
            )}
            {product.partNumber && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                #{product.partNumber}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className={`w-16 h-2 rounded-full ${confidenceColors.bg}`}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${confidenceColors.fill}`}
                style={{ width: `${Math.min(100, product.confidence || 0)}%` }}
              />
            </div>
            
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(product.status, product.confidence || 0)}`}>
              {(product.status || 'pending').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>

          {/* Preview of changes */}
          {showPreview && isSelected && (
            <div className="mt-2">
              {bulkAction === 'reassign' && targetPartType && (
                <div className="p-2 bg-green-100 border border-green-200 rounded text-xs">
                  <div className="flex items-center space-x-2 text-green-800">
                    <ArrowRight className="w-3 h-3" />
                    <span>Will be assigned to: {targetCategory} → {targetSubcategory} → {targetPartType}</span>
                  </div>
                </div>
              )}
              {bulkAction === 'flag' && (
                <div className="p-2 bg-yellow-100 border border-yellow-200 rounded text-xs">
                  <div className="flex items-center space-x-2 text-yellow-800">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Will be flagged for manual review</span>
                  </div>
                </div>
              )}
              {bulkAction === 'delete' && (
                <div className="p-2 bg-red-100 border border-red-200 rounded text-xs">
                  <div className="flex items-center space-x-2 text-red-800">
                    <X className="w-3 h-3" />
                    <span>Categorization will be removed</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkAssignmentTool;
                    