import { createSlice } from "@reduxjs/toolkit";
import { acesCategories } from "../../data/acesCategories";

const initialState = {
  // Categories data
  categories: acesCategories,
  userCategories: null,
  customCategoriesUploaded: false,
  activeCategories: "aces", // 'aces' or 'user'
  categoriesReadyForUpload: false,
  pendingCategoriesData: null,
  uploadingCategories: false,

  // Products data
  products: [],
  validationResults: null,
  lastUploadedFileInfo: null,
  lastUploadType: null,

  // File info for display
  categoriesFileInfo: null,
  productsFileInfo: null,
};

const categorizerSlice = createSlice({
  name: "categorizer",
  initialState,
  reducers: {
    // Categories actions
    setCategories: (state, action) => {
      state.categories = action.payload;
    },
    setUserCategories: (state, action) => {
      state.userCategories = action.payload;
    },
    setCustomCategoriesUploaded: (state, action) => {
      state.customCategoriesUploaded = action.payload;
    },
    setActiveCategories: (state, action) => {
      state.activeCategories = action.payload;
    },
    setCategoriesReadyForUpload: (state, action) => {
      state.categoriesReadyForUpload = action.payload;
    },
    setPendingCategoriesData: (state, action) => {
      state.pendingCategoriesData = action.payload;
    },
    setUploadingCategories: (state, action) => {
      state.uploadingCategories = action.payload;
    },
    setCategoriesFileInfo: (state, action) => {
      state.categoriesFileInfo = action.payload;
    },

    // Products actions
    setProducts: (state, action) => {
      state.products = action.payload;
    },
    setValidationResults: (state, action) => {
      state.validationResults = action.payload;
    },
    setLastUploadedFileInfo: (state, action) => {
      state.lastUploadedFileInfo = action.payload;
    },
    setLastUploadType: (state, action) => {
      state.lastUploadType = action.payload;
    },
    setProductsFileInfo: (state, action) => {
      state.productsFileInfo = action.payload;
    },

    // Clear actions
    clearCategories: (state) => {
      state.categories = acesCategories;
      state.userCategories = null;
      state.customCategoriesUploaded = false;
      state.activeCategories = "aces";
      state.categoriesReadyForUpload = false;
      state.pendingCategoriesData = null;
      state.categoriesFileInfo = null;
    },
    clearProducts: (state) => {
      state.products = [];
      state.validationResults = null;
      state.productsFileInfo = null;
    },
    clearAll: (state) => {
      return initialState;
    },
  },
});

export const {
  setCategories,
  setUserCategories,
  setCustomCategoriesUploaded,
  setActiveCategories,
  setCategoriesReadyForUpload,
  setPendingCategoriesData,
  setUploadingCategories,
  setCategoriesFileInfo,
  setProducts,
  setValidationResults,
  setLastUploadedFileInfo,
  setLastUploadType,
  setProductsFileInfo,
  clearCategories,
  clearProducts,
  clearAll,
} = categorizerSlice.actions;

export default categorizerSlice.reducer;
