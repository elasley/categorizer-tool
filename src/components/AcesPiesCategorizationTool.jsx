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
import UploadToSupabaseModal from "./UploadToSupabaseModal";

import { parseCSV, validateCSV, exportToCSV } from "../utils/csvParser";
import { parseCategoryCSV, validateCategoryCSV } from "../utils/csvParser";
import { acesCategories } from "../data/acesCategories";
import { supabase } from "../config/supabase";
import {
  generateEmbedding,
  generateProductEmbeddings,
} from "../utils/embeddingGenerator";
import { batchCategorizeWithOpenAI } from "../utils/openaiCategorizer";
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
  const [showUploadModal, setShowUploadModal] = useState(false);
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
  const [categorizationMethod, setCategorizationMethod] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [lastUploadedFileInfo, setLastUploadedFileInfo] = useState(null);
  const [lastUploadType, setLastUploadType] = useState(null);

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showTaxonomyManager, setShowTaxonomyManager] = useState(false);
  const [showBulkAssignmentTool, setShowBulkAssignmentTool] = useState(false);

  const [confidenceThreshold, setConfidenceThreshold] = useState(70);

  const itemsPerPage = 50;

  // Save categories to Supabase with relational structure and NLP embeddings
  const saveCategoriesWithEmbeddings = async (categoriesData) => {
    dispatch(setReduxUploadingCategories(true));
    const loadingToast = toast.loading(
      "🚀 Starting category upload with vector embeddings..."
    );

    try {
      console.log("\n═══════════════════════════════════════════════════");
      console.log("🎯 CATEGORY UPLOAD WITH VECTOR EMBEDDINGS");
      console.log("═══════════════════════════════════════════════════\n");

      let totalInserted = 0;
      const categoryMap = new Map(); // categoryName -> categoryId
      const subcategoryMap = new Map(); // `${categoryId}_${subcategoryName}` -> subcategoryId

      // Step 1: Check existing categories and insert only new ones
      const uniqueCategories = [...new Set(Object.keys(categoriesData))];

      console.log(
        `📁 Step 1: Checking ${uniqueCategories.length} categories...`
      );
      toast.loading(`📁 Checking ${uniqueCategories.length} categories...`, {
        id: loadingToast,
      });

      // Fetch existing categories
      const { data: existingCategories, error: fetchCatError } = await supabase
        .from("categories")
        .select("id, name")
        .in("name", uniqueCategories);

      if (fetchCatError) {
        console.error("❌ Error fetching existing categories:", fetchCatError);
        throw fetchCatError;
      }

      // Map existing categories
      existingCategories.forEach((cat) => {
        categoryMap.set(cat.name, cat.id);
        console.log(`✓ Existing category: ${cat.name} (ID: ${cat.id})`);
      });

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id || null;

      // Prepare new categories with embeddings
      const newCategories = uniqueCategories.filter(
        (name) => !categoryMap.has(name)
      );

      let insertedCategories = [];
      if (newCategories.length > 0) {
        console.log(`\n📁 Inserting ${newCategories.length} new categories...`);
        toast.loading(
          `📁 Inserting ${newCategories.length} new categories...`,
          { id: loadingToast }
        );

        const categoriesWithEmbeddings = await Promise.all(
          newCategories.map(async (categoryName) => {
            console.log(`\n📁 New Category: ${categoryName}`);
            const embedding = await generateEmbedding(categoryName);
            const embeddingStr = `[${embedding.join(",")}]`;
            return {
              name: categoryName,
              embedding: embeddingStr,
              user_id: userId,
            };
          })
        );

        const { data, error: catError } = await supabase
          .from("categories")
          .insert(categoriesWithEmbeddings)
          .select("id, name");

        if (catError) {
          console.error("❌ Error inserting categories:", catError);
          throw catError;
        }

        insertedCategories = data;
        insertedCategories.forEach((cat) => {
          categoryMap.set(cat.name, cat.id);
        });

        totalInserted += insertedCategories.length;
      } else {
        console.log(`\n✓ All categories already exist in database`);
      }

      console.log(
        `\n✅ Step 1 Complete: ${existingCategories.length} existing + ${insertedCategories.length} new = ${categoryMap.size} total categories\n`
      );
      toast.loading(
        `✅ Categories ready (${existingCategories.length} existing, ${insertedCategories.length} new), processing subcategories...`,
        {
          id: loadingToast,
        }
      );

      // Step 2: Check existing subcategories and insert only new ones
      console.log(`📂 Step 2: Checking subcategories...`);
      toast.loading(`📂 Checking subcategories...`, {
        id: loadingToast,
      });

      // Get all category IDs to fetch their subcategories
      const categoryIds = Array.from(categoryMap.values());

      // Fetch existing subcategories
      const { data: existingSubcategories, error: fetchSubError } =
        await supabase
          .from("subcategories")
          .select("id, name, category_id")
          .in("category_id", categoryIds);

      if (fetchSubError) {
        console.error(
          "❌ Error fetching existing subcategories:",
          fetchSubError
        );
        throw fetchSubError;
      }

      // Map existing subcategories
      existingSubcategories.forEach((sub) => {
        subcategoryMap.set(`${sub.category_id}_${sub.name}`, sub.id);
        console.log(`✓ Existing subcategory: ${sub.name} (ID: ${sub.id})`);
      });

      // Prepare new subcategories
      const subcategoriesWithEmbeddings = [];

      for (const [categoryName, subcategories] of Object.entries(
        categoriesData
      )) {
        const categoryId = categoryMap.get(categoryName);

        if (subcategories && typeof subcategories === "object") {
          for (const subcategoryName of Object.keys(subcategories)) {
            const subKey = `${categoryId}_${subcategoryName}`;

            // Only add if it doesn't exist
            if (!subcategoryMap.has(subKey)) {
              console.log(`\n📂 New: ${categoryName} > ${subcategoryName}`);
              const text = `${categoryName} ${subcategoryName}`.trim();
              const embedding = await generateEmbedding(text);
              const embeddingStr = `[${embedding.join(",")}]`;

              subcategoriesWithEmbeddings.push({
                category_id: categoryId,
                name: subcategoryName,
                embedding: embeddingStr,
                user_id: userId,
              });
            }
          }
        }
      }

      let insertedSubcategories = [];
      if (subcategoriesWithEmbeddings.length > 0) {
        console.log(
          `\n📂 Inserting ${subcategoriesWithEmbeddings.length} new subcategories...`
        );
        toast.loading(
          `📂 Inserting ${subcategoriesWithEmbeddings.length} new subcategories...`,
          { id: loadingToast }
        );

        const { data, error: subError } = await supabase
          .from("subcategories")
          .insert(subcategoriesWithEmbeddings)
          .select("id, name, category_id");

        if (subError) {
          console.error("❌ Error inserting subcategories:", subError);
          throw subError;
        }

        insertedSubcategories = data;
        insertedSubcategories.forEach((sub) => {
          subcategoryMap.set(`${sub.category_id}_${sub.name}`, sub.id);
        });

        totalInserted += insertedSubcategories.length;
      } else {
        console.log(`\n✓ All subcategories already exist in database`);
      }

      console.log(
        `\n✅ Step 2 Complete: ${existingSubcategories.length} existing + ${insertedSubcategories.length} new = ${subcategoryMap.size} total subcategories\n`
      );
      toast.loading(
        `✅ Subcategories ready (${existingSubcategories.length} existing, ${insertedSubcategories.length} new), processing part types...`,
        { id: loadingToast }
      );

      // Step 3: Check existing part types and insert only new ones
      console.log(`🏷️  Step 3: Checking part types...`);
      toast.loading(`🏷️  Checking part types...`, {
        id: loadingToast,
      });

      // Get all subcategory IDs to fetch their part types
      const subcategoryIds = Array.from(subcategoryMap.values());

      // Fetch existing part types
      const { data: existingParttypes, error: fetchPtError } = await supabase
        .from("parttypes")
        .select("id, name, subcategory_id")
        .in("subcategory_id", subcategoryIds);

      if (fetchPtError) {
        console.error("❌ Error fetching existing part types:", fetchPtError);
        throw fetchPtError;
      }

      // Map existing part types
      const parttypeMap = new Map();
      existingParttypes.forEach((pt) => {
        parttypeMap.set(`${pt.subcategory_id}_${pt.name}`, pt.id);
        console.log(`✓ Existing part type: ${pt.name} (ID: ${pt.id})`);
      });

      // Prepare new part types
      const parttypesWithEmbeddings = [];

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
                const ptKey = `${subcategoryId}_${partTypeName}`;

                // Only add if it doesn't exist
                if (!parttypeMap.has(ptKey)) {
                  console.log(
                    `\n🏷️  New: ${categoryName} > ${subcategoryName} > ${partTypeName}`
                  );
                  const text =
                    `${categoryName} ${subcategoryName} ${partTypeName}`.trim();
                  const embedding = await generateEmbedding(text);
                  const embeddingStr = `[${embedding.join(",")}]`;

                  parttypesWithEmbeddings.push({
                    subcategory_id: subcategoryId,
                    name: partTypeName,
                    embedding: embeddingStr,
                    user_id: userId,
                  });
                }
              }
            }
          }
        }
      }

      let insertedParttypes = [];
      if (parttypesWithEmbeddings.length > 0) {
        console.log(
          `\n🏷️  Inserting ${parttypesWithEmbeddings.length} new part types...`
        );
        toast.loading(
          `🏷️  Inserting ${parttypesWithEmbeddings.length} new part types...`,
          { id: loadingToast }
        );

        const { data, error: ptError } = await supabase
          .from("parttypes")
          .insert(parttypesWithEmbeddings)
          .select("id");

        if (ptError) {
          console.error("❌ Error inserting part types:", ptError);
          throw ptError;
        }

        insertedParttypes = data;
        totalInserted += insertedParttypes.length;
      } else {
        console.log(`\n✓ All part types already exist in database`);
      }

      console.log(
        `\n✅ Step 3 Complete: ${existingParttypes.length} existing + ${
          insertedParttypes.length
        } new = ${
          existingParttypes.length + insertedParttypes.length
        } total part types\n`
      );
      console.log("═══════════════════════════════════════════════════");
      console.log(`🎉 UPLOAD COMPLETE: ${totalInserted} new items added`);
      console.log(`   - New Categories: ${insertedCategories.length}`);
      console.log(`   - New Subcategories: ${insertedSubcategories.length}`);
      console.log(`   - New Part Types: ${insertedParttypes.length}`);
      console.log("═══════════════════════════════════════════════════\n");

      const existingCount =
        existingCategories.length +
        existingSubcategories.length +
        existingParttypes.length;
      toast.success(
        totalInserted > 0
          ? `✅ Added ${totalInserted} new items!\n📁 ${
              insertedCategories.length
            } categories | 📂 ${
              insertedSubcategories.length
            } subcategories | 🏷️ ${insertedParttypes.length} part types\n${
              existingCount > 0
                ? `(${existingCount} items already existed)`
                : ""
            }`
          : `✅ All items already exist in database!\n📁 ${existingCategories.length} categories | 📂 ${existingSubcategories.length} subcategories | 🏷️ ${existingParttypes.length} part types`,
        { id: loadingToast, duration: 5000 }
      );

      // Clear only the upload button state, but keep the header visible
      dispatch(setReduxCategoriesReadyForUpload(false));
      dispatch(setReduxPendingCategoriesData(null));
      // Keep categoriesFileInfo and customCategoriesUploaded to show the header
      // dispatch(setCategoriesFileInfo(null));
      // dispatch(setReduxCustomCategoriesUploaded(false));
      // Keep userCategories so user can switch between ACES and User categories
      // dispatch(setReduxUserCategories(null));
      // Keep active categories as "user" since they just uploaded user categories
      dispatch(setReduxActiveCategories("user"));
      dispatch(setReduxCategories(userCategories || acesCategories));

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

  // Upload products to Supabase with file storage
  // Helper function to find closest matching category/subcategory/parttype
  const findClosestMatch = (searchTerm, availableOptions) => {
    if (!searchTerm) return null;
    const searchLower = searchTerm.toLowerCase().trim();

    // Exact match
    const exactMatch = availableOptions.find(
      (opt) => opt.toLowerCase() === searchLower
    );
    if (exactMatch) return exactMatch;

    // Partial match (contains)
    const partialMatch = availableOptions.find(
      (opt) =>
        opt.toLowerCase().includes(searchLower) ||
        searchLower.includes(opt.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    return null;
  };

  const uploadProductsToSupabase = async (uploadMetadata) => {
    if (!products || products.length === 0) {
      toast.error("No products to upload");
      return;
    }

    console.log("Starting product upload. Total products:", products.length);
    console.log("Upload metadata:", uploadMetadata);

    dispatch(setReduxUploadingProducts(true));
    const loadingToast = toast.loading("Uploading products to Supabase...");

    let uploadHistoryId = null;
    let fileUrl = null;

    try {
      // Step 1: Create CSV content from products
      const csvHeaders = [
        "Name",
        "Description",
        "SKU",
        "Category",
        "Subcategory",
        "Part Type",
        "Confidence",
      ];
      const csvRows = products.map((p) => [
        p.name || p.productName || "",
        p.description || "",
        p.sku || p.partNumber || "",
        p.suggestedCategory || p.originalCategory || "",
        p.suggestedSubcategory || p.originalSubcategory || "",
        p.suggestedPartType || p.originalPartType || "",
        p.confidence || "",
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const fileName = uploadMetadata.fileName.endsWith(".csv")
        ? uploadMetadata.fileName
        : `${uploadMetadata.fileName}.csv`;

      // Step 2: Upload file to Supabase Storage
      toast.loading("Uploading file to storage...", { id: loadingToast });
      const filePath = `${Date.now()}-${fileName}`;

      const { data: fileData, error: fileError } = await supabase.storage
        .from("product-uploads")
        .upload(filePath, blob, {
          contentType: "text/csv",
          upsert: false,
        });

      if (fileError)
        throw new Error(`File upload failed: ${fileError.message}`);

      fileUrl = filePath;
      console.log("✅ File uploaded to storage:", fileUrl);

      // Step 3: Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Step 4: Create upload history record
      toast.loading("Creating upload record...", { id: loadingToast });
      const { data: historyData, error: historyError } = await supabase
        .from("upload_history")
        .insert({
          user_id: user?.id || "anonymous",
          file_name: fileName,
          file_url: fileUrl,
          description: uploadMetadata.description || null,
          products_count: products.length,
          status: "processing",
        })
        .select()
        .single();

      if (historyError)
        throw new Error(`History record failed: ${historyError.message}`);

      uploadHistoryId = historyData.id;
      console.log("✅ Upload history created:", uploadHistoryId);

      // Step 5: Upload products to database
      toast.loading("Uploading products to database...", { id: loadingToast });

      // OPTIMIZATION: Load ALL categories, subcategories, and parttypes ONCE
      console.log("📥 Loading category mappings...");
      const [categoriesResult, subcategoriesResult, parttypesResult] =
        await Promise.all([
          supabase.from("categories").select("id, name"),
          supabase.from("subcategories").select("id, name, category_id"),
          supabase.from("parttypes").select("id, name, subcategory_id"),
        ]);

      if (
        categoriesResult.error ||
        subcategoriesResult.error ||
        parttypesResult.error
      ) {
        throw new Error("Failed to load category mappings");
      }

      // Create lookup maps with both exact and fuzzy matching capabilities
      const categoryMap = new Map(
        categoriesResult.data.map((c) => [c.name.toLowerCase(), c])
      );
      const subcategoryMap = new Map(
        subcategoriesResult.data.map((s) => [
          `${s.category_id}|${s.name.toLowerCase()}`,
          s,
        ])
      );
      const parttypeMap = new Map(
        parttypesResult.data.map((p) => [
          `${p.subcategory_id}|${p.name.toLowerCase()}`,
          p,
        ])
      );

      // Create arrays for fuzzy matching
      const allCategoryNames = categoriesResult.data.map((c) => c.name);
      const subcategoriesByCategory = {};
      subcategoriesResult.data.forEach((s) => {
        if (!subcategoriesByCategory[s.category_id]) {
          subcategoriesByCategory[s.category_id] = [];
        }
        subcategoriesByCategory[s.category_id].push(s.name);
      });
      const parttypesBySubcategory = {};
      parttypesResult.data.forEach((p) => {
        if (!parttypesBySubcategory[p.subcategory_id]) {
          parttypesBySubcategory[p.subcategory_id] = [];
        }
        parttypesBySubcategory[p.subcategory_id].push(p.name);
      });

      console.log(
        `✅ Loaded ${categoryMap.size} categories, ${subcategoryMap.size} subcategories, ${parttypeMap.size} parttypes`
      );

      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      const productsToInsert = [];

      // Build bulk insert array with ID lookups
      for (const product of products) {
        // Get product name - MUST NOT BE NULL
        const productName =
          product.name ||
          product.productName ||
          product.title ||
          `Product-${Date.now()}`;

        // Skip if essential data is missing
        if (!productName || productName.trim() === "") {
          console.warn("Skipping product with no name:", product);
          errorCount++;
          errors.push("Product has no name");
          continue;
        }

        // Generate embedding for product
        const text = `${productName} ${product.description || ""}`.trim();
        // Ensure text is a string
        if (typeof text !== "string" || !text) {
          console.warn(`Invalid text for embedding: ${productName}`);
          errorCount++;
          errors.push(`Invalid product data: ${productName}`);
          continue;
        }
        const embedding = await generateEmbedding(text);
        const embeddingStr = `[${embedding.join(",")}]`;

        // Find category, subcategory, and parttype IDs using maps (O(1) lookups)
        const categoryName = (
          product.suggestedCategory ||
          product.originalCategory ||
          ""
        ).toLowerCase();
        const subcategoryName = (
          product.suggestedSubcategory ||
          product.originalSubcategory ||
          ""
        ).toLowerCase();
        const parttypeName = (
          product.suggestedPartType ||
          product.originalPartType ||
          ""
        ).toLowerCase();

        // Try exact match first, then fuzzy match
        let category = categoryMap.get(categoryName);
        let actualCategoryName = categoryName;

        if (!category && categoryName) {
          // Try fuzzy matching
          const closestCategory = findClosestMatch(
            categoryName,
            allCategoryNames
          );
          if (closestCategory) {
            category = categoryMap.get(closestCategory.toLowerCase());
            actualCategoryName = closestCategory;
            console.warn(
              `📝 Category fuzzy matched: "${categoryName}" → "${closestCategory}" for product: ${productName}`
            );
          }
        }

        if (!category) {
          // Fallback to first category to prevent upload failure
          category = categoriesResult.data[0];
          actualCategoryName = category.name;
          console.warn(
            `⚠️ Category not found: "${categoryName}". Using fallback "${actualCategoryName}" for product: ${productName}`
          );
          errors.push(
            `Category auto-corrected: "${categoryName}" → "${actualCategoryName}" for ${productName}`
          );
        }

        // Try exact match first, then fuzzy match
        let subcategory = subcategoryMap.get(
          `${category.id}|${subcategoryName}`
        );
        let actualSubcategoryName = subcategoryName;

        if (!subcategory && subcategoryName) {
          // Try fuzzy matching within this category
          const availableSubcats = subcategoriesByCategory[category.id] || [];
          const closestSubcategory = findClosestMatch(
            subcategoryName,
            availableSubcats
          );
          if (closestSubcategory) {
            subcategory = subcategoryMap.get(
              `${category.id}|${closestSubcategory.toLowerCase()}`
            );
            actualSubcategoryName = closestSubcategory;
            console.warn(
              `📝 Subcategory fuzzy matched: "${subcategoryName}" → "${closestSubcategory}" in "${actualCategoryName}" for product: ${productName}`
            );
          }
        }

        if (!subcategory) {
          // Fallback to first subcategory in this category
          const availableSubcats = subcategoriesResult.data.filter(
            (s) => s.category_id === category.id
          );
          if (availableSubcats.length > 0) {
            subcategory = availableSubcats[0];
            actualSubcategoryName = subcategory.name;
            console.warn(
              `⚠️ Subcategory not found: "${subcategoryName}" in "${actualCategoryName}". Using fallback "${actualSubcategoryName}" for product: ${productName}`
            );
            errors.push(
              `Subcategory auto-corrected: "${subcategoryName}" → "${actualSubcategoryName}" for ${productName}`
            );
          } else {
            const errorMsg = `No subcategories available in "${actualCategoryName}" for product: ${productName}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            errorCount++;
            continue;
          }
        }

        // Try exact match first, then fuzzy match
        let parttype = parttypeMap.get(`${subcategory.id}|${parttypeName}`);
        let actualParttypeName = parttypeName;

        if (!parttype && parttypeName) {
          // Try fuzzy matching within this subcategory
          const availableParttypes =
            parttypesBySubcategory[subcategory.id] || [];
          const closestParttype = findClosestMatch(
            parttypeName,
            availableParttypes
          );
          if (closestParttype) {
            parttype = parttypeMap.get(
              `${subcategory.id}|${closestParttype.toLowerCase()}`
            );
            actualParttypeName = closestParttype;
            console.warn(
              `📝 Parttype fuzzy matched: "${parttypeName}" → "${closestParttype}" in "${actualSubcategoryName}" for product: ${productName}`
            );
          }
        }

        if (!parttype) {
          // Fallback to first parttype in this subcategory
          const availableParttypes = parttypesResult.data.filter(
            (p) => p.subcategory_id === subcategory.id
          );
          if (availableParttypes.length > 0) {
            parttype = availableParttypes[0];
            actualParttypeName = parttype.name;
            console.warn(
              `⚠️ Parttype not found: "${parttypeName}" in "${actualSubcategoryName}". Using fallback "${actualParttypeName}" for product: ${productName}`
            );
            errors.push(
              `Parttype auto-corrected: "${parttypeName}" → "${actualParttypeName}" for ${productName}`
            );
          } else {
            const errorMsg = `No parttypes available in "${actualSubcategoryName}" for product: ${productName}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            errorCount++;
            continue;
          }
        }

        const userId = user?.id || null;

        productsToInsert.push({
          name: productName,
          description: product.description || "",
          sku: product.sku || product.partNumber || null,
          category_id: category.id,
          subcategory_id: subcategory.id,
          parttype_id: parttype.id,
          upload_history_id: uploadHistoryId,
          file_url: fileUrl,
          embedding: embeddingStr,
          user_id: userId,
        });
      }

      // BULK INSERT: Insert all products in one API call
      if (productsToInsert.length > 0) {
        console.log(`🚀 Bulk inserting ${productsToInsert.length} products...`);
        const { data: insertedData, error: insertError } = await supabase
          .from("products")
          .insert(productsToInsert)
          .select();

        if (insertError) {
          console.error("❌ Bulk insert error:", insertError);
          errorCount += productsToInsert.length;
          errors.push(insertError.message);
        } else {
          successCount = insertedData?.length || productsToInsert.length;
          console.log(`✅ Successfully inserted ${successCount} products`);
        }
      }

      console.log(
        `Upload complete. Success: ${successCount}, Errors: ${errorCount}`
      );
      if (errors.length > 0) {
        console.log("First 5 errors:", errors.slice(0, 5));
      }

      // Update upload history with final status
      const finalStatus = successCount > 0 ? "success" : "failed";
      const errorMessage =
        errorCount > 0 ? errors.slice(0, 5).join("; ") : null;

      if (uploadHistoryId) {
        await supabase
          .from("upload_history")
          .update({
            status: finalStatus,
            products_count: successCount,
            error_message: errorMessage,
          })
          .eq("id", uploadHistoryId);
      }

      if (successCount > 0) {
        const autoCorrections = errors.filter((e) =>
          e.includes("auto-corrected")
        );
        const realErrors = errors.filter((e) => !e.includes("auto-corrected"));

        toast.success(
          ` Successfully uploaded ${successCount} products!${
            errorCount > 0 ? ` (${errorCount} failed)` : ""
          }`,
          { id: loadingToast, duration: 5000 }
        );

        // Show warning about auto-corrections
        if (autoCorrections.length > 0) {
          const sampleCorrections = autoCorrections.slice(0, 3).join("\n");
          const moreCount =
            autoCorrections.length > 3
              ? ` (+${autoCorrections.length - 3} more)`
              : "";

          console.log("All auto-corrections:", autoCorrections);
        }

        // Keep file info visible after successful upload
        // Only clear the ready-for-upload flag and products data
        dispatch(setReduxProductsReadyForUpload(false));
        dispatch(setReduxProducts([]));
        setLastUploadedFileInfo(productsFileInfo); // Save the uploaded file info
        setLastUploadType("products");
        // DON'T clear productsFileInfo - keep it visible
      } else {
        toast.error(
          `❌ Failed to upload: ${errorCount} errors. Check console for details.`,
          { id: loadingToast }
        );
      }
    } catch (error) {
      console.error("Error uploading products:", error);

      // Update upload history if it was created
      if (uploadHistoryId) {
        await supabase
          .from("upload_history")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", uploadHistoryId);
      }

      // Clean up uploaded file if product insertion failed
      if (fileUrl && uploadHistoryId) {
        console.log("Cleaning up uploaded file due to error...");
        await supabase.storage.from("product-uploads").remove([fileUrl]);
      }

      toast.error(`Failed to upload products: ${error.message}`, {
        id: loadingToast,
        duration: 6000,
      });
    } finally {
      dispatch(setReduxUploadingProducts(false));
    }
  };

  // Assign categories using edge function (professional vector-based approach)
  const assignCategoriesViaEdgeFunction = async () => {
    if (!products || products.length === 0) {
      toast.error("No products to categorize");
      return;
    }

    const BATCH_SIZE = 500; // Match edge function limit
    const totalProducts = products.length;

    console.log("\n🔄 Preparing products for vector categorization...");
    console.log(`📦 Total products: ${totalProducts}`);

    setIsProcessing(true);
    setCategorizationMethod("vector");

    // Generate embeddings for products first
    const loadingToast = toast.loading(
      `🔧 Generating embeddings for ${totalProducts} products...`
    );

    let productsToSend;
    try {
      const productsForEmbedding = products.map((p, index) => ({
        id: p.id || `product-${index}`,
        name: p.name || p.productName || "",
        description: p.description || "",
      }));

      toast.loading(`🔄 Generating embeddings...`, {
        id: loadingToast,
      });

      // Generate embeddings with progress updates
      productsToSend = await generateProductEmbeddings(
        productsForEmbedding,
        (current, total) => {
          if (current % 5 === 0 || current === total) {
            toast.loading(`🔧 Generating embeddings: ${current}/${total}`, {
              id: loadingToast,
            });
          }
        }
      );

      if (productsToSend.length === 0) {
        throw new Error("Failed to generate embeddings for products");
      }

      console.log(
        `✅ Generated embeddings for ${productsToSend.length}/${totalProducts} products`
      );
    } catch (embeddingError) {
      console.error("❌ Embedding generation failed:", embeddingError);

      let errorMessage = embeddingError.message;
      if (
        errorMessage.includes("not valid JSON") ||
        errorMessage.includes("<!doctype")
      ) {
        errorMessage =
          "Failed to load AI model. Please check your internet connection and try again.";
      }

      toast.error(`Embedding Error: ${errorMessage}`, {
        id: loadingToast,
        duration: 6000,
      });
      setIsProcessing(false);
      return;
    }

    // Check if batching is needed
    const needsBatching = totalProducts > BATCH_SIZE;
    const totalBatches = Math.ceil(totalProducts / BATCH_SIZE);

    if (needsBatching) {
      console.log(
        `⚡ Large dataset detected. Processing in ${totalBatches} batches of ${BATCH_SIZE}`
      );
    }

    toast.loading(
      needsBatching
        ? `🚀 Categorizing ${totalProducts} products in ${totalBatches} batches...`
        : `🚀 Categorizing ${totalProducts} products using vector similarity...`,
      { id: loadingToast }
    );

    try {
      let allCategorizedProducts = [];

      // Process in batches if needed
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalProducts);
        const batch = productsToSend.slice(start, end);

        if (needsBatching) {
          console.log(
            `\n🔄 Batch ${
              batchIndex + 1
            }/${totalBatches}: Processing products ${start + 1}-${end}`
          );
          toast.loading(
            `🔄 Batch ${batchIndex + 1}/${totalBatches}: ${
              start + 1
            }-${end} of ${totalProducts}`,
            { id: loadingToast }
          );
        }

        const startTime = Date.now();

        // Call Supabase edge function to assign categories
        const { data, error } = await supabase.functions.invoke(
          "assign-categories",
          {
            body: {
              products: batch,
            },
          }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (error) {
          console.error(`❌ Batch ${batchIndex + 1} failed:`, error);
          throw error;
        }

        if (data && data.categorizedProducts) {
          allCategorizedProducts = [
            ...allCategorizedProducts,
            ...data.categorizedProducts,
          ];
          console.log(
            `✅ Batch ${batchIndex + 1} completed in ${duration}s (${
              data.categorizedProducts.length
            } products)`
          );
        }
      }

      // Combine all batch results
      const finalData = { categorizedProducts: allCategorizedProducts };

      if (finalData && finalData.categorizedProducts) {
        const categorized = finalData.categorizedProducts;
        console.log(`\n✅ Received ${categorized.length} categorized products`);
        console.log(
          `   Success rate: ${(
            (categorized.length / products.length) *
            100
          ).toFixed(1)}%`
        );

        if (categorized.length > 0) {
          console.log("\n📋 Sample result:", categorized[0]);

          // Calculate confidence stats
          const confidences = categorized.map((p) => p.confidence || 0);
          const avgConfidence = (
            confidences.reduce((a, b) => a + b, 0) / confidences.length
          ).toFixed(1);
          const highConfCount = confidences.filter((c) => c >= 70).length;

          console.log(`\n📊 Categorization Stats:`);
          console.log(`   Average confidence: ${avgConfidence}%`);
          console.log(
            `   High confidence (≥70%): ${highConfCount}/${categorized.length}`
          );
        }

        // Update products with assigned categories
        const updatedProducts = products.map((product) => {
          const assigned = categorized.find(
            (p) =>
              p.id === (product.id || `product-${products.indexOf(product)}`)
          );
          if (assigned) {
            return {
              ...product,
              suggestedCategory: assigned.category,
              suggestedSubcategory: assigned.subcategory,
              suggestedPartType: assigned.partType,
              confidence: assigned.confidence || 70,
              status:
                (assigned.confidence || 70) >= 70
                  ? "high-confidence"
                  : "low-confidence",
            };
          }
          return product;
        });

        console.log(
          `✅ Updated ${updatedProducts.length} products with categories\n`
        );

        dispatch(setReduxProducts(updatedProducts));
        dispatch(setReduxProductsReadyForUpload(true));

        const highConf = updatedProducts.filter(
          (p) => (p.confidence || 0) >= 70
        ).length;
        toast.success(
          `✅ Categorized ${categorized.length} products! (${highConf} high confidence)`,
          { id: loadingToast, duration: 4000 }
        );
      } else {
        throw new Error("No categorized products returned from edge function");
      }
    } catch (error) {
      console.error("❌ Categorization failed:", error);
      toast.error(`Failed to assign categories: ${error.message}`, {
        id: loadingToast,
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
      setCategorizationMethod(null);
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

  // Fetch categories from database on component mount
  React.useEffect(() => {
    const fetchCategoriesFromDatabase = async () => {
      try {
        console.log("🔄 Fetching categories from database...");

        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("id, name");

        if (categoriesError) {
          console.error("Error fetching categories:", categoriesError);
          return;
        }

        if (!categoriesData || categoriesData.length === 0) {
          console.log(
            "No categories found in database, using default ACES categories"
          );
          return;
        }

        // Fetch subcategories and parttypes for all categories
        const { data: subcategoriesData, error: subcategoriesError } =
          await supabase.from("subcategories").select("id, name, category_id");

        const { data: parttypesData, error: parttypesError } = await supabase
          .from("parttypes")
          .select("id, name, subcategory_id");

        if (subcategoriesError || parttypesError) {
          console.error("Error fetching subcategories/parttypes:", {
            subcategoriesError,
            parttypesError,
          });
          return;
        }

        // Build category structure
        const dbCategories = {};

        categoriesData.forEach((cat) => {
          dbCategories[cat.name] = {};

          // Find subcategories for this category
          const categorySubcategories = subcategoriesData.filter(
            (sub) => sub.category_id === cat.id
          );

          categorySubcategories.forEach((sub) => {
            // Find parttypes for this subcategory
            const subcategoryParttypes = parttypesData
              .filter((pt) => pt.subcategory_id === sub.id)
              .map((pt) => pt.name);

            dbCategories[cat.name][sub.name] = subcategoryParttypes;
          });
        });

        console.log(
          `✅ Loaded ${
            Object.keys(dbCategories).length
          } categories from database`
        );

        // Update Redux with database categories
        dispatch(setReduxUserCategories(dbCategories));
        dispatch(setReduxCategories(dbCategories));
        dispatch(setReduxCustomCategoriesUploaded(true));
        dispatch(setReduxActiveCategories("user"));
      } catch (error) {
        console.error("Error in fetchCategoriesFromDatabase:", error);
      }
    };

    fetchCategoriesFromDatabase();
  }, []); // Run once on mount

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

  // Cost estimation removed - using efficient vector similarity (no external API costs)

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
      // Don't set lastUploadedFileInfo for categories - we don't want to show it in FileUpload badge
      // setLastUploadedFileInfo({ name: filename, type: "text/csv" });
      // setLastUploadType("categories");
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

    console.log("\n═══════════════════════════════════════════════════");
    console.log("🤖 PRODUCT CATEGORIZATION - VECTOR-BASED");
    console.log("═══════════════════════════════════════════════════");
    console.log("📊 Products to categorize:", products.length);
    console.log("🎯 Using: Vector Similarity Search (Edge Function)");
    console.log("═══════════════════════════════════════════════════\n");

    // Always use edge function for vector-based categorization
    return assignCategoriesViaEdgeFunction();
  };

  // OpenAI Auto-Suggest Handler
  const handleOpenAISuggest = async () => {
    if (products.length === 0) {
      toast.error("Please upload products first");
      return;
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("🤖 OPENAI AUTO-SUGGEST CATEGORIZATION");
    console.log("═══════════════════════════════════════════════════");
    console.log("📊 Products to categorize:", products.length);
    console.log("🎯 Using: OpenAI GPT Model");
    console.log("═══════════════════════════════════════════════════\n");

    setIsProcessing(true);
    setCategorizationMethod("openai");
    const loadingToast = toast.loading(
      "🤖 Auto-suggesting categories with OpenAI..."
    );

    try {
      // Use the current active categories (ACES or custom)
      const categoriesToUse =
        activeCategories === "user" && userCategories
          ? userCategories
          : acesCategories;

      console.log(
        `Using ${
          activeCategories === "user" ? "Custom" : "ACES"
        } categories for OpenAI`
      );

      // Call OpenAI batch categorization
      const { results, stats } = await batchCategorizeWithOpenAI(
        products,
        (completed, total, currentBatch, totalBatches) => {
          const percentage = Math.round((completed / total) * 100);
          toast.loading(
            `🤖 OpenAI Processing: Batch ${currentBatch}/${totalBatches} - ${completed}/${total} products (${percentage}%)`,
            { id: loadingToast }
          );
        },
        categoriesToUse
      );

      console.log("✅ OpenAI categorization complete:", stats);

      // Calculate average confidence
      const confidences = results
        .map((r) => r.confidence || 0)
        .filter((c) => c > 0);
      const avgConfidence =
        confidences.length > 0
          ? Math.round(
              confidences.reduce((a, b) => a + b, 0) / confidences.length
            )
          : 0;

      // Update products with AI suggestions
      const updatedProducts = results.map((result) => ({
        ...result,
        suggestedCategory: result.suggestedCategory || "",
        suggestedSubcategory: result.suggestedSubcategory || "",
        suggestedPartType: result.suggestedPartType || "",
        confidence: result.confidence || 0,
        status:
          result.confidence >= 80
            ? "high-confidence"
            : result.confidence >= 60
            ? "needs-review"
            : "low-confidence",
      }));

      dispatch(setReduxProducts(updatedProducts));
      dispatch(setReduxProductsReadyForUpload(true));

      const highConfidence = confidences.filter((c) => c >= 80).length;
      toast.success(
        `✅ OpenAI categorized ${results.length} products! Avg: ${avgConfidence}% | ${highConfidence} high confidence (≥80%)`,
        { id: loadingToast, duration: 5000 }
      );
    } catch (error) {
      console.error("❌ OpenAI categorization error:", error);
      toast.error(`❌ OpenAI categorization failed: ${error.message}`, {
        id: loadingToast,
      });
      setApiError(error);
    } finally {
      setIsProcessing(false);
      setCategorizationMethod(null);
    }
  };

  // OLD METHODS REMOVED - Now using professional vector-based categorization via edge function
  // This eliminates multiple API calls and uses efficient database vector similarity search

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
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
                      <span>Permanently Saving...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Permanently Stored</span>
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

          {isProcessing && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-900">
                  {categorizationMethod === "openai"
                    ? "OpenAI Categorization in Progress..."
                    : "Vector Similarity Categorization in Progress..."}
                </span>
                <span className="text-blue-700 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing {products.length} products
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse"
                  style={{
                    width: "100%",
                  }}
                />
              </div>
              <div className="mt-1 text-xs text-blue-600">
                {categorizationMethod === "openai"
                  ? "Using OpenAI GPT for intelligent categorization"
                  : "Using vector embeddings for semantic matching"}
              </div>
            </div>
          )}

          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleOpenAISuggest}
                disabled={isProcessing || products.length === 0}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all font-medium"
              >
                <Zap className="w-4 h-4" />
                {isProcessing ? `AI Suggesting...` : `OpenAI Auto-Suggest`}
              </button>
              <button
                onClick={autoSuggestAll}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Brain className="w-4 h-4" />
                {isProcessing
                  ? `Categorizing... (Vector Similarity)`
                  : `Auto-Categorize with Vector Similarity`}
              </button>

              <div className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">
                  Using: {activeCategories === "user" ? "Custom" : "ACES"}{" "}
                  Categories
                </span>
              </div>

              <button
                onClick={assignCategoriesViaEdgeFunction}
                disabled={products.length === 0 || isProcessing}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Target className="w-4 h-4" />
                Categories Assign
              </button>

              {/* <button
                onClick={checkSupabaseData}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-sm"
              >
                <Search className="w-4 h-4" />
                Check DB
              </button> */}

              {productsReadyForUpload && products.length > 0 && (
                <button
                  onClick={() => setShowUploadModal(true)}
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
                      <span>Permanently Stored</span>
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

          {/* Advanced Settings Panel - Removed as we now use vector similarity exclusively */}

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

      <UploadToSupabaseModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={uploadProductsToSupabase}
        productsCount={products.length}
      />
    </div>
  );
};

export default AcesPiesCategorizationTool;
