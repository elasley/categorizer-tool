import React, { useState, useMemo, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  Download,
  CheckCircle,
  AlertTriangle,
  Upload,
  Settings,
  Zap,
  DollarSign,
  BarChart3,
  Users,
  ChevronDown,
  ChevronRight,
  Target,
  RefreshCw,
  Filter,
  Eye,
  TrendingUp,
  Brain,
  X,
  FolderOpen,
  Folder,
  Tag,
} from "lucide-react";

import FileUpload from "./FileUpload";
import ProductRow from "./ProductRow";
import StatsPanel from "./StatsPanel";
import AdvancedSettings from "./AdvancedSettings";
import TaxonomyManager from "./TaxonomyManager";
import BulkAssignmentTool from "./BulkAssignmentTool";

import { parseCSV, validateCSV, exportToCSV } from "../utils/csvParser";
import {
  batchCategorize,
  getCategoryMappingStats,
} from "../utils/categoryMatcher";
import { parseCategoryCSV, validateCategoryCSV } from "../utils/csvParser";

import {
  batchCategorizeWithOpenAI,
  estimateOpenAICost,
} from "../utils/openaiCategorizer";
import { acesCategories } from "../data/acesCategories";
import { supabase } from "../config/supabase";
import { generateCategoryEmbedding } from "../utils/embeddingUtils";
import toast from "react-hot-toast";
import {
  setCategories as setReduxCategories,
  setUserCategories as setReduxUserCategories,
  setCustomCategoriesUploaded as setReduxCustomCategoriesUploaded,
  setActiveCategories as setReduxActiveCategories,
  setCategoriesReadyForUpload as setReduxCategoriesReadyForUpload,
  setPendingCategoriesData as setReduxPendingCategoriesData,
  setUploadingCategories as setReduxUploadingCategories,
  setCategoriesFileInfo,
  setProducts as setReduxProducts,
  setValidationResults as setReduxValidationResults,
  setLastUploadedFileInfo,
  setLastUploadType as setReduxLastUploadType,
  setProductsFileInfo,
  setProductsReadyForUpload as setReduxProductsReadyForUpload,
  setUploadingProducts as setReduxUploadingProducts,
  clearCategories,
  clearProducts,
} from "../store/slices/categorizerSlice";

const AcesPiesCategorizationTool = () => {
  const dispatch = useDispatch();

  // Get persisted state from Redux
  const products = useSelector((state) => state.categorizer.products || []);
  const categories = useSelector(
    (state) => state.categorizer.categories || acesCategories
  );
  const customCategoriesUploaded = useSelector(
    (state) => state.categorizer.customCategoriesUploaded || false
  );
  const activeCategories = useSelector(
    (state) => state.categorizer.activeCategories || "aces"
  );
  const userCategories = useSelector(
    (state) => state.categorizer.userCategories || null
  );
  const categoriesReadyForUpload = useSelector(
    (state) => state.categorizer.categoriesReadyForUpload || false
  );
  const pendingCategoriesData = useSelector(
    (state) => state.categorizer.pendingCategoriesData || null
  );
  const uploadingCategories = useSelector(
    (state) => state.categorizer.uploadingCategories || false
  );
  const validationResults = useSelector(
    (state) => state.categorizer.validationResults || null
  );
  const categoriesFileInfo = useSelector(
    (state) => state.categorizer.categoriesFileInfo || null
  );
  const productsFileInfo = useSelector(
    (state) => state.categorizer.productsFileInfo || null
  );
  const productsReadyForUpload = useSelector(
    (state) => state.categorizer.productsReadyForUpload || false
  );
  const uploadingProducts = useSelector(
    (state) => state.categorizer.uploadingProducts || false
  );

  // Local UI state (not persisted)
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const productFileInputRef = useRef(null);

  // Track expanded categories/subcategories in the Category modal
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const isExpanded = (key) => !!expanded[key];
  const [allExpanded, setAllExpanded] = useState(false);
  const expandAll = () => {
    const map = {};
    Object.entries(categories).forEach(([cat, subcats]) => {
      map[cat] = true;
      if (subcats && typeof subcats === "object") {
        Object.keys(subcats).forEach((sub) => {
          map[`${cat}||${sub}`] = true;
        });
      }
    });
    setExpanded(map);
    setAllExpanded(true);
  };
  const collapseAll = () => {
    setExpanded({});
    setAllExpanded(false);
  };
  const toggleAll = () => {
    if (allExpanded) collapseAll();
    else expandAll();
  };

  // Add custom subcategory or part type to categories state
  const handleAddCustomCategory = ({
    category,
    subcategory,
    partType,
    type,
  }) => {
    const updated = JSON.parse(JSON.stringify(categories));
    if (type === "subcategory" && category && subcategory) {
      if (!updated[category][subcategory]) {
        updated[category][subcategory] = [];
      }
    } else if (type === "partType" && category && subcategory && partType) {
      if (!updated[category][subcategory]) {
        updated[category][subcategory] = [];
      }
      if (!updated[category][subcategory].includes(partType)) {
        updated[category][subcategory].push(partType);
      }
    }
    dispatch(setReduxCategories(updated));
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparingAI, setIsPreparingAI] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [lastUploadedFileInfo, setLastUploadedFileInfo] = useState(null);
  const [lastUploadType, setLastUploadType] = useState(null);

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showTaxonomyManager, setShowTaxonomyManager] = useState(false);
  const [showBulkAssignmentTool, setShowBulkAssignmentTool] = useState(false);

  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [useOpenAI, setUseOpenAI] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0,
  });
  const [estimatedCost, setEstimatedCost] = useState(null);

  const itemsPerPage = 50;

  // Save categories to Supabase with relational structure and NLP embeddings
  const saveCategoriesWithEmbeddings = async (categoriesData) => {
    dispatch(setReduxUploadingCategories(true));
    const loadingToast = toast.loading(
      "Generating embeddings and saving to Supabase..."
    );

    try {
      let totalInserted = 0;
      const categoryMap = new Map(); // categoryName -> categoryId
      const subcategoryMap = new Map(); // `${categoryId}_${subcategoryName}` -> subcategoryId

      // Step 1: Insert Categories
      const uniqueCategories = [...new Set(Object.keys(categoriesData))];

      for (const categoryName of uniqueCategories) {
        const embedding = generateCategoryEmbedding(categoryName, "", "");

        const { data, error } = await supabase
          .from("categories")
          .insert({ name: categoryName, embedding })
          .select("id, name")
          .single();

        if (error) {
          console.error("Error inserting category:", error);
          throw error;
        }

        categoryMap.set(categoryName, data.id);
        totalInserted++;
      }

      toast.loading(`Saved ${totalInserted} categories...`, {
        id: loadingToast,
      });

      // Step 2: Insert Subcategories
      for (const [categoryName, subcategories] of Object.entries(
        categoriesData
      )) {
        const categoryId = categoryMap.get(categoryName);

        if (subcategories && typeof subcategories === "object") {
          for (const subcategoryName of Object.keys(subcategories)) {
            const embedding = generateCategoryEmbedding(
              categoryName,
              subcategoryName,
              ""
            );

            const { data, error } = await supabase
              .from("subcategories")
              .insert({
                category_id: categoryId,
                name: subcategoryName,
                embedding,
              })
              .select("id, name")
              .single();

            if (error) {
              console.error("Error inserting subcategory:", error);
              throw error;
            }

            subcategoryMap.set(`${categoryId}_${subcategoryName}`, data.id);
            totalInserted++;
          }
        }
      }

      toast.loading(`Saved subcategories...`, { id: loadingToast });

      // Step 3: Insert Part Types
      for (const [categoryName, subcategories] of Object.entries(
        categoriesData
      )) {
        const categoryId = categoryMap.get(categoryName);

        if (subcategories && typeof subcategories === "object") {
          for (const [subcategoryName, partTypes] of Object.entries(
            subcategories
          )) {
            const subcategoryId = subcategoryMap.get(
              `${categoryId}_${subcategoryName}`
            );

            if (Array.isArray(partTypes)) {
              for (const partTypeName of partTypes) {
                const embedding = generateCategoryEmbedding(
                  categoryName,
                  subcategoryName,
                  partTypeName
                );

                const { error } = await supabase.from("parttypes").insert({
                  subcategory_id: subcategoryId,
                  name: partTypeName,
                  embedding,
                });

                if (error) {
                  console.error("Error inserting part type:", error);
                  throw error;
                }

                totalInserted++;
              }
            }
          }
        }
      }

      toast.success(
        `Successfully saved ${totalInserted} items (categories, subcategories, and part types) to Supabase!`,
        { id: loadingToast }
      );

      // Clear all category upload states to hide the upload notification
      dispatch(setReduxCategoriesReadyForUpload(false));
      dispatch(setReduxPendingCategoriesData(null));
      dispatch(setCategoriesFileInfo(null));
      dispatch(setReduxCustomCategoriesUploaded(false));
      dispatch(setReduxUserCategories(null));
      dispatch(setReduxActiveCategories("aces"));
      dispatch(setReduxCategories(acesCategories));

      // Clear local state to hide file upload notification
      setLastUploadedFileInfo(null);
      setLastUploadType(null);
    } catch (error) {
      console.error("Error saving categories:", error);
      toast.error(`Failed to save categories: ${error.message}`, {
        id: loadingToast,
      });
    } finally {
      dispatch(setReduxUploadingCategories(false));
    }
  };

  // Upload products to Supabase
  const uploadProductsToSupabase = async () => {
    if (!products || products.length === 0) {
      toast.error("No products to upload");
      return;
    }

    console.log("Starting product upload. Total products:", products.length);
    console.log("Sample product to upload:", products[0]);

    dispatch(setReduxUploadingProducts(true));
    const loadingToast = toast.loading("Uploading products to Supabase...");

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const product of products) {
        // Generate embedding for product
        const embedding = generateCategoryEmbedding(
          product.name || "",
          product.description || "",
          ""
        );

        // Find category, subcategory, and parttype IDs from Supabase
        const categoryName =
          product.suggestedCategory || product.originalCategory;
        const subcategoryName =
          product.suggestedSubcategory || product.originalSubcategory;
        const parttypeName =
          product.suggestedPartType || product.originalPartType;

        const { data: categoryData, error: catErr } = await supabase
          .from("categories")
          .select("id")
          .eq("name", categoryName)
          .single();

        if (catErr) {
          const errorMsg = `Category not found: "${categoryName}" for product: ${product.name}`;
          console.error(errorMsg, catErr);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        const { data: subcategoryData, error: subErr } = await supabase
          .from("subcategories")
          .select("id")
          .eq("name", subcategoryName)
          .eq("category_id", categoryData?.id)
          .single();

        if (subErr) {
          const errorMsg = `Subcategory not found: "${subcategoryName}" in "${categoryName}" for product: ${product.name}`;
          console.error(errorMsg, subErr);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        const { data: parttypeData, error: ptErr } = await supabase
          .from("parttypes")
          .select("id")
          .eq("name", parttypeName)
          .eq("subcategory_id", subcategoryData?.id)
          .single();

        if (ptErr) {
          const errorMsg = `Parttype not found: "${parttypeName}" in "${subcategoryName}" for product: ${product.name}`;
          console.error(errorMsg, ptErr);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        if (!categoryData || !subcategoryData || !parttypeData) {
          const errorMsg = `Missing category data for product: ${product.name} (cat: ${categoryName}, sub: ${subcategoryName}, pt: ${parttypeName})`;
          console.error(errorMsg);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        // Insert product
        const { error } = await supabase.from("products").insert({
          name: product.name || product.productName,
          description: product.description || "",
          sku: product.sku || product.partNumber || null,
          category_id: categoryData.id,
          subcategory_id: subcategoryData.id,
          parttype_id: parttypeData.id,
          embedding,
        });

        if (error) {
          console.error("Error inserting product:", error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      console.log(
        `Upload complete. Success: ${successCount}, Errors: ${errorCount}`
      );
      if (errors.length > 0) {
        console.log("First 5 errors:", errors.slice(0, 5));
      }

      if (successCount > 0) {
        toast.success(
          `Successfully uploaded ${successCount} products to Supabase!${
            errorCount > 0 ? ` (${errorCount} failed)` : ""
          }`,
          { id: loadingToast }
        );
      } else {
        toast.error(
          `Failed to upload products: ${errorCount} errors. Check console for details.`,
          {
            id: loadingToast,
          }
        );
      }

      // Clear products state after successful upload
      if (successCount > 0) {
        dispatch(setReduxProductsReadyForUpload(false));
        dispatch(setReduxProducts([]));
        dispatch(setProductsFileInfo(null));
        setLastUploadedFileInfo(null);
        setLastUploadType(null);
      }
    } catch (error) {
      console.error("Error uploading products:", error);
      toast.error(`Failed to upload products: ${error.message}`, {
        id: loadingToast,
      });
    } finally {
      dispatch(setReduxUploadingProducts(false));
    }
  };

  // Assign categories using edge function (embedding-based)
  const assignCategoriesViaEdgeFunction = async () => {
    if (!products || products.length === 0) {
      toast.error("No products to categorize");
      return;
    }

    console.log("=== CALLING EDGE FUNCTION ===");
    console.log("Total products to categorize:", products.length);
    console.log("Sample product before mapping:", products[0]);

    const productsToSend = products.map((p) => ({
      id: p.id,
      name: p.name || p.productName,
      description: p.description || "",
    }));

    console.log("Products being sent to edge function:", productsToSend.length);
    console.log("Sample product after mapping:", productsToSend[0]);

    setIsProcessing(true);
    const loadingToast = toast.loading(
      "Assigning categories using embeddings..."
    );

    try {
      // Call Supabase edge function to assign categories
      const { data, error } = await supabase.functions.invoke(
        "assign-categories",
        {
          body: {
            products: productsToSend,
          },
        }
      );

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (data && data.categorizedProducts) {
        console.log(
          "Categorized products received:",
          data.categorizedProducts.length
        );
        console.log("Sample categorized product:", data.categorizedProducts[0]);

        // Update products with assigned categories
        const updatedProducts = products.map((product) => {
          const assigned = data.categorizedProducts.find(
            (p) => p.id === product.id
          );
          if (assigned) {
            return {
              ...product,
              suggestedCategory: assigned.category,
              suggestedSubcategory: assigned.subcategory,
              suggestedPartType: assigned.partType,
              confidence: assigned.confidence || 80,
              status: "high-confidence",
            };
          }
          return product;
        });

        console.log("Updated products count:", updatedProducts.length);
        console.log("Sample updated product:", updatedProducts[0]);

        dispatch(setReduxProducts(updatedProducts));
        dispatch(setReduxProductsReadyForUpload(true));

        toast.success(
          `Successfully assigned categories to ${data.categorizedProducts.length} products!`,
          { id: loadingToast }
        );
      }
    } catch (error) {
      console.error("Error assigning categories:", error);
      toast.error(`Failed to assign categories: ${error.message}`, {
        id: loadingToast,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Diagnostic function to check database
  const checkSupabaseData = async () => {
    const loadingToast = toast.loading("Checking Supabase data...");
    try {
      const { data: cats, error: catErr } = await supabase
        .from("categories")
        .select("id, name, embedding");

      const { data: subs, error: subErr } = await supabase
        .from("subcategories")
        .select("id, name, category_id, embedding");

      const { data: pts, error: ptErr } = await supabase
        .from("parttypes")
        .select("id, name, subcategory_id, embedding");

      if (catErr || subErr || ptErr) {
        toast.error("Error checking database", { id: loadingToast });
        console.error("Database Errors:", { catErr, subErr, ptErr });
        return;
      }

      const catsWithEmbedding =
        cats?.filter(
          (c) =>
            c.embedding && Array.isArray(c.embedding) && c.embedding.length > 0
        ) || [];
      const subsWithEmbedding =
        subs?.filter(
          (s) =>
            s.embedding && Array.isArray(s.embedding) && s.embedding.length > 0
        ) || [];
      const ptsWithEmbedding =
        pts?.filter(
          (p) =>
            p.embedding && Array.isArray(p.embedding) && p.embedding.length > 0
        ) || [];

      console.log("=== DATABASE STATUS ===");
      console.log("Categories:", {
        total: cats?.length || 0,
        withEmbedding: catsWithEmbedding.length,
      });
      console.log("Subcategories:", {
        total: subs?.length || 0,
        withEmbedding: subsWithEmbedding.length,
      });
      console.log("Parttypes:", {
        total: pts?.length || 0,
        withEmbedding: ptsWithEmbedding.length,
      });

      if (cats?.length > 0) {
        console.log("Sample category:", cats[0]);
        console.log("Category embedding length:", cats[0]?.embedding?.length);
      }

      if (subs?.length > 0) {
        console.log("Sample subcategory:", subs[0]);
      }

      if (pts?.length > 0) {
        console.log("Sample parttype:", pts[0]);
      }

      if (cats?.length === 0) {
        toast.error(
          "No categories found! Please upload categories first using the 'Upload to Supabase' button.",
          { id: loadingToast, duration: 6000 }
        );
        return;
      }

      toast.success(
        `✓ Database OK: ${cats?.length || 0} categories, ${
          subs?.length || 0
        } subcategories, ${pts?.length || 0} parttypes. ` +
          `Embeddings: ${catsWithEmbedding.length}/${cats?.length || 0} cats, ${
            subsWithEmbedding.length
          }/${subs?.length || 0} subs, ${ptsWithEmbedding.length}/${
            pts?.length || 0
          } pts`,
        { id: loadingToast, duration: 5000 }
      );
    } catch (error) {
      console.error("Error checking database:", error);
      toast.error(`Failed: ${error.message}`, { id: loadingToast });
    }
  };

  // Reset uploadingCategories on component mount in case it was stuck from previous session
  React.useEffect(() => {
    if (uploadingCategories) {
      dispatch(setReduxUploadingCategories(false));
      toast.dismiss(); // Dismiss any lingering toast notifications
    }
    if (uploadingProducts) {
      dispatch(setReduxUploadingProducts(false));
    }
  }, []); // Run only once on mount

  React.useEffect(() => {
    if (products.length > 0 && useOpenAI) {
      const costEstimate = estimateOpenAICost(products.length);
      setEstimatedCost(costEstimate);
    } else {
      setEstimatedCost(null);
    }
  }, [products.length, useOpenAI]);

  // Reset expansion when modal opens or when categories change
  React.useEffect(() => {
    if (showCategoryModal) {
      setExpanded({});
      setAllExpanded(false);
    }
  }, [showCategoryModal, categories]);

  // Handle file upload with validation
  const handleFileUpload = async (parsedData, validation, type, filename) => {
    console.log(`[Upload] Type: ${type}, File: ${filename}`);
    console.log(`[Upload] Content Summary:`, parsedData);

    if (type === "categories") {
      if (!parsedData || Object.keys(parsedData).length === 0) {
        return;
      }

      // Store categories and show upload button (don't save automatically)
      dispatch(setReduxPendingCategoriesData(parsedData));
      dispatch(setReduxCategoriesReadyForUpload(true));
      dispatch(setReduxUserCategories(parsedData));
      dispatch(setReduxCategories(parsedData));
      dispatch(setReduxCustomCategoriesUploaded(true));
      dispatch(setReduxActiveCategories("user"));
      dispatch(setReduxValidationResults(validation));
      dispatch(setCategoriesFileInfo({ name: filename, type: "text/csv" }));
      setLastUploadedFileInfo({ name: filename, type: "text/csv" });
      setLastUploadType("categories");
    } else {
      if (!parsedData || parsedData.length === 0) {
        return;
      }

      dispatch(setReduxProducts(parsedData));
      dispatch(setReduxValidationResults(validation));
      dispatch(setProductsFileInfo({ name: filename, type: "text/csv" }));
      dispatch(setReduxProductsReadyForUpload(false)); // Will be set to true after categorization
      setCurrentPage(1);
      setLastUploadedFileInfo({ name: filename, type: "text/csv" });
      setLastUploadType("products");
    }
  };

  // Handle direct CSV file upload for products
  const handleDirectProductUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      return;
    }

    try {
      // Pass the File object directly to parseCSV, which handles it properly
      const parsed = await parseCSV(file);
      const validation = validateCSV(parsed);
      // Use existing handler to set products and validation
      handleFileUpload(parsed, validation, "products", file.name);
      setLastUploadedFileInfo({
        name: file.name,
        size: file.size,
        type: file.type || "text/csv",
      });
      setLastUploadType("products");
      // Clear file input for next upload
      if (productFileInputRef.current) {
        productFileInputRef.current.value = "";
      }
    } catch (err) {
      console.error(err);
    }
  };

  const autoSuggestAll = async () => {
    if (products.length === 0) {
      alert("Please upload products first");
      return;
    }

    console.log(
      "Categorizing with:",
      activeCategories === "user" ? "User Categories" : "ACES Categories"
    );
    console.log("Current categories:", categories);

    if (useOpenAI) {
      return handleOpenAICategorization();
    } else {
      return handleLocalCategorization();
    }
  };

  const handleOpenAICategorization = async () => {
    if (!process.env.REACT_APP_OPENAI_API_KEY) {
      alert(
        "OpenAI API key is required. Please add REACT_APP_OPENAI_API_KEY to your .env file."
      );
      return;
    }

    if (estimatedCost && estimatedCost.estimatedCost > 5) {
      const confirmed = window.confirm(
        `OpenAI categorization will cost approximately $${estimatedCost.estimatedCost.toFixed(
          2
        )} for ${products.length} products. Continue?`
      );
      if (!confirmed) return;
    }

    setIsPreparingAI(true);
    setIsProcessing(true);
    setProcessingProgress({
      current: 0,
      total: products.length,
      currentBatch: 0,
      totalBatches: 0,
    });

    try {
      const aiResponse = await batchCategorizeWithOpenAI(
        products,
        (processedProducts, totalProducts, currentBatch, totalBatches) => {
          setProcessingProgress({
            current: processedProducts,
            total: totalProducts,
            currentBatch,
            totalBatches,
          });
        },
        categories
      );

      // batchCategorizeWithOpenAI now returns { results, stats } when using AI
      const categorizedProducts = Array.isArray(aiResponse)
        ? aiResponse
        : aiResponse.results || [];

      const stats = aiResponse.stats || null;
      if (stats) {
        console.info("AI stats:", stats);
      }

      const updatedProducts = categorizedProducts.map((product) => {
        let status = "low-confidence";
        if (product.confidence > confidenceThreshold) {
          status = "high-confidence";
        } else if (product.confidence > 40) {
          status = "needs-review";
        }

        return {
          ...product,
          status,
          // Always use the AI-suggested fields, not the uploaded file's original fields
          suggestedCategory: product.suggestedCategory,
          suggestedSubcategory: product.suggestedSubcategory,
          suggestedPartType: product.suggestedPartType,
          // Preserve original categories from import
          originalCategory:
            product.originalCategory || product.suggestedCategory,
          originalSubcategory:
            product.originalSubcategory || product.suggestedSubcategory,
          originalPartType:
            product.originalPartType || product.suggestedPartType,
        };
      });

      dispatch(setReduxProducts(updatedProducts));
    } catch (error) {
      // Surface the specific API error to the user and stop processing
      console.error("OpenAI error", error);
      setApiError(error);
      // Show a clear alert including type/code when available
      const errMsg = error?.message || String(error);
      const errCode = error?.code || error?.type || null;
      alert(`OpenAI Error${errCode ? ` (${errCode})` : ""}: ${errMsg}`);
      // Do not automatically fall back to local categorization for fatal errors
      if (!error?.isFatal) {
        // For transient errors, fall back to local categorization
        await handleLocalCategorization();
      }
    } finally {
      setIsPreparingAI(false);
      setIsProcessing(false);
      setProcessingProgress({
        current: 0,
        total: 0,
        currentBatch: 0,
        totalBatches: 0,
      });
    }
  };

  const handleLocalCategorization = async () => {
    setIsProcessing(true);
    setProcessingProgress({
      current: 0,
      total: products.length,
      currentBatch: 0,
      totalBatches: 0,
    });

    try {
      const categorizedProducts = await batchCategorize(
        products,
        (current, total) => {
          setProcessingProgress({
            current,
            total,
            currentBatch: 0,
            totalBatches: 0,
          });
        },
        categories
      );

      // Log products that are not categorized or have low confidence
      categorizedProducts.forEach((product, idx) => {
        if (!product.suggestedCategory) {
          console.warn(`Product #${idx + 1} not categorized:`, product);
        } else if (product.confidence <= 40) {
          console.info(
            `Product #${idx + 1} low confidence (${product.confidence}):`,
            product
          );
        }
      });

      dispatch(
        setReduxProducts(
          categorizedProducts.map((product) => ({
            ...product,
            // Preserve original categories from import
            originalCategory:
              product.originalCategory || product.suggestedCategory,
            originalSubcategory:
              product.originalSubcategory || product.suggestedSubcategory,
            originalPartType:
              product.originalPartType || product.suggestedPartType,
          }))
        )
      );
    } catch (error) {
      alert("Categorization failed. Please check your data and try again.");
    } finally {
      setIsProcessing(false);
      setProcessingProgress({
        current: 0,
        total: 0,
        currentBatch: 0,
        totalBatches: 0,
      });
    }
  };

  const recategorizeWithNewThreshold = () => {
    const updatedProducts = products.map((product) => {
      let status = "low-confidence";
      if (product.confidence > confidenceThreshold) {
        status = "high-confidence";
      } else if (product.confidence > 40) {
        status = "needs-review";
      }

      return {
        ...product,
        status:
          product.status === "manual-assigned" ? "manual-assigned" : status,
      };
    });

    dispatch(setReduxProducts(updatedProducts));
  };

  const updateProductCategory = (
    productId,
    category,
    subcategory,
    partType
  ) => {
    const updatedProducts = products.map((p) =>
      p.id === productId
        ? {
            ...p,
            suggestedCategory: category,
            suggestedSubcategory: subcategory,
            suggestedPartType: partType,
            status: "manual-assigned",
            confidence: 100,
          }
        : p
    );
    dispatch(setReduxProducts(updatedProducts));
  };

  const handleFieldUpdate = (productId, updatedFields) => {
    const updatedProducts = products.map((p) =>
      p.id === productId
        ? {
            ...p,
            ...updatedFields,
            ...(updatedFields.suggestedCategory ||
            updatedFields.suggestedSubcategory ||
            updatedFields.suggestedPartType
              ? { status: "manual-assigned", confidence: 100 }
              : {}),
          }
        : p
    );
    dispatch(setReduxProducts(updatedProducts));
  };

  const handleUpdateCategories = (updatedCategories) => {
    dispatch(setReduxCategories(updatedCategories));
    // Categories now persisted in Redux
  };

  const handleBulkUpdateProducts = (updatedProducts) => {
    const newProducts = products.map((p) => {
      const updated = updatedProducts.find((u) => u.id === p.id);
      return updated ? { ...p, ...updated } : p;
    });
    dispatch(setReduxProducts(newProducts));
  };

  const openBulkAssignmentForProblematic = () => {
    const problematicCount = products.filter(
      (p) =>
        (p.confidence || 0) < 30 ||
        !p.suggestedCategory ||
        (p.suggestedCategory && !p.suggestedSubcategory)
    ).length;

    if (problematicCount === 0) {
      alert("No problematic products found! Your data quality looks good.");
      return;
    }

    setShowBulkAssignmentTool(true);
  };

  const handleExport = () => {
    if (products.length === 0) {
      alert("No products to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `aces-categorized-${timestamp}.csv`;

    exportToCSV(products, filename);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchMatch =
        searchTerm === "" ||
        Object.values(product).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );

      const categoryMatch =
        selectedCategory === "" ||
        product.suggestedCategory === selectedCategory;

      return searchMatch && categoryMatch;
    });
  }, [products, searchTerm, selectedCategory]);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const stats = useMemo(() => {
    const total = products.length;
    const categorized = products.filter((p) => p.suggestedCategory).length;
    const highConfidence = products.filter(
      (p) => p.confidence > confidenceThreshold
    ).length;
    const needsReview = products.filter(
      (p) => p.confidence < 50 && p.confidence > 0
    ).length;
    const problematic = products.filter(
      (p) =>
        (p.confidence || 0) < 30 ||
        !p.suggestedCategory ||
        (p.suggestedCategory && !p.suggestedSubcategory)
    ).length;
    const avgConfidence =
      total > 0
        ? products.reduce((sum, p) => sum + (p.confidence || 0), 0) / total
        : 0;

    return {
      total,
      categorized,
      highConfidence,
      needsReview,
      problematic,
      avgConfidence: avgConfidence.toFixed(1),
    };
  }, [products, confidenceThreshold]);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ACES/PIES Product Categorization Tool
        </h1>
        <p className="text-gray-600">
          Professional automotive parts categorization with advanced management
          tools
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
        {customCategoriesUploaded && categoriesFileInfo && (
          <div className="mt-4 space-y-3">
            {/* Active Tree Selection and Actions */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-blue-900">
                    User Category Tree Uploaded
                  </span>
                  <div className="flex items-center gap-2 ml-2">
                    <label className="text-sm font-medium text-blue-800">
                      Active:
                    </label>
                    <select
                      value={activeCategories}
                      onChange={(e) => {
                        if (e.target.value === "aces") {
                          dispatch(setReduxCategories(acesCategories));
                          dispatch(setReduxActiveCategories("aces"));
                        } else if (
                          e.target.value === "user" &&
                          userCategories
                        ) {
                          dispatch(setReduxCategories(userCategories));
                          dispatch(setReduxActiveCategories("user"));
                        }
                      }}
                      className="px-3 py-1.5 text-sm border-2 border-blue-300 rounded-lg bg-white text-gray-800 font-medium hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    >
                      <option value="aces">ACES Categories</option>
                      <option value="user">User Categories</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md text-sm font-medium flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Categories
                  </button>

                  <input
                    ref={productFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleDirectProductUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => productFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md text-sm font-medium flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Products
                  </button>
                </div>
              </div>
            </div>

            {/* File Badges Section */}
            <div className="mt-6 flex items-center gap-4 flex-wrap">
              {/* Categories File Badge */}
              {categoriesFileInfo && (
                <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-md hover:shadow-lg transition-all">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Folder className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-green-600 font-semibold uppercase tracking-wide">
                      Categories File
                    </span>
                    <span className="text-sm text-gray-900 font-bold">
                      {categoriesFileInfo.name}
                    </span>
                  </div>
                  <button
                    onClick={() => dispatch(clearCategories())}
                    className="ml-3 p-2 hover:bg-red-100 rounded-full transition-all group"
                    title="Remove categories"
                  >
                    <X className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                  </button>
                </div>
              )}

              {/* Products File Badge */}
              {productsFileInfo && (
                <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-md hover:shadow-lg transition-all">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Tag className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                      Products File
                    </span>
                    <span className="text-sm text-gray-900 font-bold">
                      {productsFileInfo.name}
                    </span>
                  </div>
                  <button
                    onClick={() => dispatch(clearProducts())}
                    className="ml-3 p-2 hover:bg-red-100 rounded-full transition-all group"
                    title="Remove products"
                  >
                    <X className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                  </button>
                </div>
              )}

              {/* Upload to Supabase Button */}
              {categoriesReadyForUpload && pendingCategoriesData && (
                <button
                  onClick={() =>
                    saveCategoriesWithEmbeddings(pendingCategoriesData)
                  }
                  disabled={uploadingCategories}
                  className={`flex items-center gap-3 px-6 py-3 rounded-xl text-base font-bold transition-all shadow-lg hover:shadow-xl ${
                    uploadingCategories
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  {uploadingCategories ? (
                    <>
                      <span className="animate-spin text-xl">⏳</span>
                      <span>Uploading to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Upload to Supabase</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {apiError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-1">
              <div className="font-medium text-red-800">OpenAI API Error</div>
              <div className="text-sm text-red-700 mt-1">
                {apiError.message}
              </div>
              {apiError.code || apiError.type ? (
                <div className="text-xs text-red-600 mt-1">
                  Code: {apiError.code || apiError.type}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => setApiError(null)}
              className="ml-4 text-sm px-2 py-1 bg-red-200 text-red-800 rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* FileUpload area - always visible */}
      <FileUpload
        onFileUpload={handleFileUpload}
        isProcessing={isProcessing}
        onClearFile={() => {
          dispatch(clearProducts());
          setCurrentPage(1);
        }}
        onClearCategories={() => {
          dispatch(clearCategories());
        }}
        customCategoriesUploaded={customCategoriesUploaded}
        externalFileInfo={lastUploadedFileInfo}
        externalValidationResults={validationResults}
        externalUploadType={lastUploadType}
      />

      {products.length > 0 && (
        <>
          {/* Statistics Dashboard */}
          {/* <StatsPanel 
            products={products}
            confidenceThreshold={confidenceThreshold}
          /> */}

          {estimatedCost && useOpenAI && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-900">
                    OpenAI Cost Estimate
                  </span>
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
                Using GPT-4o-mini (~
                {Math.round(estimatedCost.inputTokens / 1000)}k input +{" "}
                {Math.round(estimatedCost.outputTokens / 1000)}k output tokens)
              </div>
            </div>
          )}

          {isProcessing && processingProgress.total > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-900">
                  {useOpenAI ? "AI Batch Processing..." : "Processing..."}
                </span>
                <span className="text-blue-700">
                  {processingProgress.currentBatch > 0
                    ? `Batch ${processingProgress.currentBatch}/${processingProgress.totalBatches} (${processingProgress.current}/${processingProgress.total} products)`
                    : `${processingProgress.current}/${processingProgress.total} products`}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (processingProgress.current / processingProgress.total) *
                      100
                    }%`,
                  }}
                />
              </div>
              <div className="mt-1 text-xs text-blue-600">
                {useOpenAI
                  ? "Using OpenAI for enhanced accuracy"
                  : "Using local categorization algorithms"}
              </div>
            </div>
          )}

          {isPreparingAI && processingProgress.currentBatch === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-yellow-900">
                  Preparing AI...
                </span>
                <span className="text-yellow-700">
                  Initializing and preparing batches
                </span>
              </div>
              <div className="text-xs text-yellow-600">
                Please wait — this may take a few seconds while the system
                prepares the request batches.
              </div>
            </div>
          )}

          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex flex-wrap gap-4">
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
                {useOpenAI ? (
                  <Brain className="w-4 h-4" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {isProcessing
                  ? processingProgress.currentBatch > 0
                    ? `Processing Batch ${processingProgress.currentBatch}/${processingProgress.totalBatches}...`
                    : `Processing... ${processingProgress.current}/${processingProgress.total}`
                  : useOpenAI
                  ? `AI-Enhance (${
                      activeCategories === "user" ? "User" : "ACES"
                    })`
                  : `Auto-Suggest (${
                      activeCategories === "user" ? "User" : "ACES"
                    })`}
              </button>

              <button
                onClick={assignCategoriesViaEdgeFunction}
                disabled={products.length === 0 || isProcessing}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Target className="w-4 h-4" />
                Categories Assign
              </button>

              <button
                onClick={checkSupabaseData}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-sm"
              >
                <Search className="w-4 h-4" />
                Check DB
              </button>

              {productsReadyForUpload && products.length > 0 && (
                <button
                  onClick={uploadProductsToSupabase}
                  disabled={uploadingProducts}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm ${
                    uploadingProducts
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {uploadingProducts ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload to Supabase</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleExport}
                disabled={products.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Results
              </button>

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
              {/* </div> */}

              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 shadow-sm"
              >
                <Settings className="w-4 h-4" />
                Advanced Settings
              </button>
            </div>
          </div>

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
              {Object.keys(categories).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <div className="flex items-center text-sm text-gray-600">
              <Filter className="w-4 h-4 mr-1" />
              Showing {filteredProducts.length.toLocaleString()} of{" "}
              {products.length.toLocaleString()} products
            </div>
          </div>

          {/* Advanced Settings Panel */}
          {/* <AdvancedSettings
            show={showAdvancedSettings}
            confidenceThreshold={confidenceThreshold}
            setConfidenceThreshold={setConfidenceThreshold}
            onRecategorize={recategorizeWithNewThreshold}
            products={products}
            useOpenAI={useOpenAI}
            setUseOpenAI={setUseOpenAI}
          /> */}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-w-full">
              <table className="min-w-max divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-80">
                      Product Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">
                      Category{" "}
                      {activeCategories === "user" ? "(User)" : "(ACES)"}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">
                      Subcategory
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">
                      Part Type
                    </th>
                    {/* Dimension columns - temporarily commented out */}
                    {/* <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Height
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Length
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Weight
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Width
                    </th> */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {/* Images column - temporarily commented out */}
                    {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Images
                    </th> */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProducts.map((product) => {
                    return (
                      <ProductRow
                        key={product.id}
                        product={product}
                        onUpdate={updateProductCategory}
                        onFieldUpdate={handleFieldUpdate}
                        confidenceThreshold={confidenceThreshold}
                        categories={categories}
                        onAddCustomCategory={handleAddCustomCategory}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

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
                Page {currentPage} of {totalPages} (
                {filteredProducts.length.toLocaleString()} products)
              </span>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">
              Processing Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Total Products</div>
                <div className="font-medium text-gray-900">{stats.total}</div>
              </div>
              <div>
                <div className="text-gray-500">Categorized</div>
                <div className="font-medium text-gray-900">
                  {stats.categorized} (
                  {((stats.categorized / stats.total) * 100).toFixed(1)}%)
                </div>
              </div>
              <div>
                <div className="text-gray-500">High Confidence</div>
                <div className="font-medium text-green-600">
                  {stats.highConfidence}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Needs Review</div>
                <div className="font-medium text-amber-600">
                  {stats.needsReview}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Avg Confidence</div>
                <div className="font-medium text-blue-600">
                  {stats.avgConfidence}%
                </div>
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
            Upload a CSV file to get started with professional ACES/PIES
            categorization
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <div>✅ 600+ ACES part types across 12 major categories</div>
            <div>✅ AI-enhanced accuracy with OpenAI integration</div>
            <div>✅ Advanced taxonomy management and bulk operations</div>
            <div>✅ Professional-grade data quality tools</div>
          </div>
        </div>
      )}

      {/* Category View Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Uploaded Category Tree
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAll}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {allExpanded ? "Collapse All" : "Expand All"}
                </button>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {Object.entries(categories).map(([category, subcats]) => {
                  if (!subcats || typeof subcats !== "object") return null;
                  const catKey = category;
                  return (
                    <div key={category} className="">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleExpand(catKey)}
                            className="mr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                            aria-expanded={isExpanded(catKey)}
                          >
                            {isExpanded(catKey) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <h3 className="font-bold flex gap-2 items-center text-lg text-gray-800">
                            <FolderOpen className="inline-block text-blue-500 h-4 w-4" />
                            {category}
                          </h3>
                        </div>
                      </div>

                      {isExpanded(catKey) && (
                        <div className="pl-4 border-l-2 border-gray-100 space-y-3">
                          {Object.entries(subcats).map(
                            ([subcategory, partTypes]) => {
                              if (!Array.isArray(partTypes)) return null;
                              const subKey = `${catKey}||${subcategory}`;
                              return (
                                <div key={subcategory}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <button
                                        onClick={() => toggleExpand(subKey)}
                                        className="mr-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                        aria-expanded={isExpanded(subKey)}
                                      >
                                        {isExpanded(subKey) ? (
                                          <ChevronDown className="h-3 w-3" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3" />
                                        )}
                                      </button>
                                      <h4 className="font-medium flex gap-2 items-center text-gray-700">
                                        <FolderOpen className=" text-green-500 h-4 w-4" />
                                        {subcategory}
                                      </h4>
                                    </div>
                                  </div>

                                  {isExpanded(subKey) && (
                                    <div className="pl-4 mt-2 space-y-1">
                                      {partTypes.map((pt) => (
                                        <div
                                          key={pt}
                                          className="text-gray-600 text-sm flex items-center gap-2 py-1 px-2 "
                                        >
                                          <Tag className=" text-yellow-500 h-3 w-3" />
                                          {pt}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
