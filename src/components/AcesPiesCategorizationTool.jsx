// src/components/AcesPiesCategorizationTool.jsx - Complete Integration
import React, { useState, useMemo } from 'react';
import { 
  Search, Download, CheckCircle, AlertTriangle, Upload, 
  Settings, Zap, DollarSign, BarChart3, Users, Target,
  RefreshCw, Filter, Eye, TrendingUp, Brain
} from 'lucide-react';

// Import all components and utilities
import FileUpload from './FileUpload';
import ProductRow from './ProductRow';
import StatsPanel from './StatsPanel';
import AdvancedSettings from './AdvancedSettings';
import TaxonomyManager from './TaxonomyManager';
import BulkAssignmentTool from './BulkAssignmentTool';

import { parseCSV, validateCSV, exportToCSV } from '../utils/csvParser';
import { batchCategorize } from '../utils/categoryMatcher';
import { batchCategorizeWithOpenAI, estimateOpenAICost } from '../utils/openaiCategorizer';
import { acesCategories } from '../data/acesCategories';

const AcesPiesCategorizationTool = () => {
  // Core state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(acesCategories);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResults, setValidationResults] = useState(null);

  // Advanced features state
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showTaxonomyManager, setShowTaxonomyManager] = useState(false);
  const [showBulkAssignmentTool, setShowBulkAssignmentTool] = useState(false);
  
  // Configuration state
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [useOpenAI, setUseOpenAI] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [estimatedCost, setEstimatedCost] = useState(null);

  const itemsPerPage = 50;

  // Calculate OpenAI cost estimate when products change
  React.useEffect(() => {
    if (products.length > 0 && useOpenAI) {
      const costEstimate = estimateOpenAICost(products.length);
      setEstimatedCost(costEstimate);
    } else {
      setEstimatedCost(null);
    }
  }, [products.length, useOpenAI]);

  // Handle file upload with validation
  const handleFileUpload = async (parsedProducts, validation) => {
    if (!parsedProducts || parsedProducts.length === 0) {
      alert('No valid products found in the uploaded file');
      return;
    }
    
    setProducts(parsedProducts);
    setValidationResults(validation);
    setCurrentPage(1);
    
    console.log(`Successfully loaded ${parsedProducts.length} products`);
    
    if (validation && validation.warnings.length > 0) {
      console.warn('Data quality warnings:', validation.warnings);
    }
  };

  // Auto-suggest categorization
  const autoSuggestAll = async () => {
    if (products.length === 0) {
      alert('Please upload products first');
      return;
    }

    if (useOpenAI) {
      return handleOpenAICategorization();
    } else {
      return handleLocalCategorization();
    }
  };

  // OpenAI categorization
  const handleOpenAICategorization = async () => {
    // Check for API key
    if (!process.env.REACT_APP_OPENAI_API_KEY) {
      alert('OpenAI API key is required. Please add REACT_APP_OPENAI_API_KEY to your .env file.');
      return;
    }

    // Cost confirmation
    if (estimatedCost && estimatedCost.estimatedCost > 5) {
      const confirmed = window.confirm(
        `OpenAI categorization will cost approximately $${estimatedCost.estimatedCost.toFixed(2)} for ${products.length} products. Continue?`
      );
      if (!confirmed) return;
    }

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: products.length });

    try {
      const categorizedProducts = await batchCategorizeWithOpenAI(
        products,
        (current, total) => {
          setProcessingProgress({ current, total });
        }
      );

      const updatedProducts = categorizedProducts.map(product => {
        let status = 'low-confidence';
        if (product.confidence > confidenceThreshold) {
          status = 'high-confidence';
        } else if (product.confidence > 40) {
          status = 'needs-review';
        }

        return {
          ...product,
          status,
          suggestedCategory: product.category || product.suggestedCategory,
          suggestedSubcategory: product.subcategory || product.suggestedSubcategory,
          suggestedPartType: product.partType || product.suggestedPartType
        };
      });

      setProducts(updatedProducts);
      console.log(`OpenAI categorization complete. Processed ${categorizedProducts.length} products.`);
      
    } catch (error) {
      console.error('OpenAI categorization failed:', error);
      alert('OpenAI categorization failed. Falling back to local categorization.');
      await handleLocalCategorization();
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  // Local categorization
  const handleLocalCategorization = async () => {
    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: products.length });
    
    try {
      const categorizedProducts = await batchCategorize(
        products,
        (current, total) => {
          setProcessingProgress({ current, total });
        }
      );
      
      setProducts(categorizedProducts);
      console.log(`Local categorization complete. Processed ${categorizedProducts.length} products.`);
      
    } catch (error) {
      console.error('Local categorization failed:', error);
      alert('Categorization failed. Please check your data and try again.');
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  // Recategorize with new threshold
  const recategorizeWithNewThreshold = () => {
    const updatedProducts = products.map(product => {
      let status = 'low-confidence';
      if (product.confidence > confidenceThreshold) {
        status = 'high-confidence';
      } else if (product.confidence > 40) {
        status = 'needs-review';
      }
      
      return {
        ...product,
        status: product.status === 'manual-assigned' ? 'manual-assigned' : status
      };
    });
    
    setProducts(updatedProducts);
  };

  // Update individual product category
  const updateProductCategory = (productId, category, subcategory, partType) => {
    setProducts(prevProducts => 
      prevProducts.map(p => 
        p.id === productId 
          ? { 
              ...p, 
              suggestedCategory: category,
              suggestedSubcategory: subcategory,
              suggestedPartType: partType,
              status: 'manual-assigned',
              confidence: 100
            }
          : p
      )
    );
  };

  // Advanced tool handlers
  const handleUpdateCategories = (updatedCategories) => {
    setCategories(updatedCategories);
    // Optionally persist to localStorage
    localStorage.setItem('acesCategories', JSON.stringify(updatedCategories));
  };

  const handleBulkUpdateProducts = (updatedProducts) => {
    setProducts(updatedProducts);
  };

  // Quick access for problematic products
  const openBulkAssignmentForProblematic = () => {
    const problematicCount = products.filter(p => 
      (p.confidence || 0) < 30 || 
      !p.suggestedCategory ||
      (p.suggestedCategory && !p.suggestedSubcategory)
    ).length;
    
    if (problematicCount === 0) {
      alert('No problematic products found! Your data quality looks good.');
      return;
    }
    
    setShowBulkAssignmentTool(true);
  };

  // Export results
  const handleExport = () => {
    if (products.length === 0) {
      alert('No products to export');
      return;
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `aces-categorized-${timestamp}.csv`;
    
    exportToCSV(products, filename);
    console.log(`Exported ${products.length} products to ${filename}`);
  };

  // Filter and paginate products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const searchMatch = searchTerm === '' || 
        Object.values(product).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const categoryMatch = selectedCategory === '' || 
        product.suggestedCategory === selectedCategory;
      
      return searchMatch && categoryMatch;
    });
  }, [products, searchTerm, selectedCategory]);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Calculate comprehensive statistics
  const stats = useMemo(() => {
    const total = products.length;
    const categorized = products.filter(p => p.suggestedCategory).length;
    const highConfidence = products.filter(p => p.confidence > confidenceThreshold).length;
    const needsReview = products.filter(p => p.confidence < 50 && p.confidence > 0).length;
    const problematic = products.filter(p => 
      (p.confidence || 0) < 30 || 
      !p.suggestedCategory ||
      (p.suggestedCategory && !p.suggestedSubcategory)
    ).length;
    const avgConfidence = total > 0 ? products.reduce((sum, p) => sum + (p.confidence || 0), 0) / total : 0;
    
    return {
      total,
      categorized,
      highConfidence,
      needsReview,
      problematic,
      avgConfidence: avgConfidence.toFixed(1)
    };
  }, [products, confidenceThreshold]);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ACES/PIES Product Categorization Tool
        </h1>
        <p className="text-gray-600">
          Professional automotive parts categorization with advanced management tools
        </p>
        {validationResults && (
          <div className="mt-2 text-sm text-gray-500">
            Loaded {validationResults.stats.totalProducts} products • 
            {validationResults.stats.hasName} with names • 
            {validationResults.stats.hasDescription} with descriptions
            {validationResults.warnings.length > 0 && (
              <span className="text-amber-600 ml-2">
                • {validationResults.warnings.length} data quality warnings
              </span>
            )}
          </div>
        )}
      </div>

      {/* File Upload */}
      <FileUpload 
        onFileUpload={handleFileUpload} 
        isProcessing={isProcessing}
      />

      {/* Main Content */}
      {products.length > 0 && (
        <>
          {/* Statistics Dashboard */}
          <StatsPanel 
            products={products}
            confidenceThreshold={confidenceThreshold}
          />

          {/* OpenAI Cost Estimation */}
          {estimatedCost && useOpenAI && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-900">OpenAI Cost Estimate</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-900">
                    ${estimatedCost.estimatedCost.toFixed(2)}
                  </div>
                  <div className="text-xs text-purple-700">
                    for {products.length.toLocaleString()} products
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-purple-600">
                Using GPT-4o-mini (~{Math.round(estimatedCost.inputTokens/1000)}k input + {Math.round(estimatedCost.outputTokens/1000)}k output tokens)
              </div>
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && processingProgress.total > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-900">
                  {useOpenAI ? 'AI Processing...' : 'Processing...'}
                </span>
                <span className="text-blue-700">
                  {processingProgress.current} / {processingProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-blue-600">
                {useOpenAI ? 'Using OpenAI for enhanced accuracy' : 'Using local categorization algorithms'}
              </div>
            </div>
          )}

          {/* Enhanced Control Panel */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex flex-wrap gap-4">
              
              {/* Core Actions */}
              <div className="flex items-center space-x-3 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <Zap className="h-4 w-4 text-purple-600" />
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={useOpenAI}
                    onChange={(e) => setUseOpenAI(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    AI Enhancement
                  </span>
                </label>
              </div>

              <button
                onClick={autoSuggestAll}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {useOpenAI ? <Brain className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {isProcessing 
                  ? `Processing... ${processingProgress.current}/${processingProgress.total}` 
                  : useOpenAI 
                    ? 'AI-Enhance Categories' 
                    : 'Auto-Suggest Categories'
                }
              </button>
              
              <button
                onClick={handleExport}
                disabled={products.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Results
              </button>

              {/* Advanced Tools */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowTaxonomyManager(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-sm"
                >
                  <BarChart3 className="w-4 h-4" />
                  Taxonomy Manager
                </button>

                <button
                  onClick={() => setShowBulkAssignmentTool(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  Bulk Assignment
                </button>

                {stats.problematic > 0 && (
                  <button
                    onClick={openBulkAssignmentForProblematic}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 shadow-sm animate-pulse"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Fix Issues ({stats.problematic})
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 shadow-sm"
              >
                <Settings className="w-4 h-4" />
                Advanced Settings
              </button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {Object.keys(categories).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <div className="flex items-center text-sm text-gray-600">
              <Filter className="w-4 h-4 mr-1" />
              Showing {filteredProducts.length.toLocaleString()} of {products.length.toLocaleString()} products
            </div>
          </div>

          {/* Advanced Settings Panel */}
          <AdvancedSettings
            show={showAdvancedSettings}
            confidenceThreshold={confidenceThreshold}
            setConfidenceThreshold={setConfidenceThreshold}
            onRecategorize={recategorizeWithNewThreshold}
            products={products}
            useOpenAI={useOpenAI}
            setUseOpenAI={setUseOpenAI}
          />

          {/* Products Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ACES Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subcategory
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Part Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      onUpdate={updateProductCategory}
                      confidenceThreshold={confidenceThreshold}
                      categories={categories}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-6">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {currentPage} of {totalPages} ({filteredProducts.length.toLocaleString()} products)
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}

          {/* Processing Summary */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Processing Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Products:</span>
                <span className="ml-2 font-semibold">{stats.total.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Categorized:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {stats.categorized} ({((stats.categorized / stats.total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div>
                <span className="text-gray-600">High Confidence:</span>
                <span className="ml-2 font-semibold text-blue-600">
                  {stats.highConfidence} ({((stats.highConfidence / stats.total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div>
                <span className="text-gray-600">Needs Review:</span>
                <span className="ml-2 font-semibold text-yellow-600">
                  {stats.needsReview}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Avg Confidence:</span>
                <span className="ml-2 font-semibold">{stats.avgConfidence}%</span>
              </div>
            </div>
            
            {stats.problematic > 0 && (
              <div className="mt-3 p-3 bg-amber-100 border border-amber-200 rounded-lg">
                <div className="flex items-center space-x-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">
                    {stats.problematic} products need attention
                  </span>
                  <button
                    onClick={openBulkAssignmentForProblematic}
                    className="ml-auto px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                  >
                    Fix Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {products.length === 0 && !isProcessing && (
        <div className="text-center py-12">
          <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Ready to categorize automotive parts
          </h3>
          <p className="text-gray-600 mb-4">
            Upload a CSV file to get started with professional ACES/PIES categorization
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <div>✅ 600+ ACES part types across 12 major categories</div>
            <div>✅ AI-enhanced accuracy with OpenAI integration</div>
            <div>✅ Advanced taxonomy management and bulk operations</div>
            <div>✅ Professional-grade data quality tools</div>
          </div>
        </div>
      )}

      {/* Advanced Management Tools */}
      <TaxonomyManager
        isOpen={showTaxonomyManager}
        onClose={() => setShowTaxonomyManager(false)}
        categories={categories}
        products={products}
        onUpdateCategories={handleUpdateCategories}
        onUpdateProducts={handleBulkUpdateProducts}
      />

      <BulkAssignmentTool
        isOpen={showBulkAssignmentTool}
        onClose={() => setShowBulkAssignmentTool(false)}
        products={products}
        categories={categories}
        onUpdateProducts={handleBulkUpdateProducts}
        confidenceThreshold={confidenceThreshold}
      />
    </div>
  );
};

export default AcesPiesCategorizationTool;