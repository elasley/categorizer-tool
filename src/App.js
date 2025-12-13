import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { Toaster } from "react-hot-toast";
import { store, persistor } from "./store";

// Auth Pages
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import VerifyOtp from "./pages/auth/VerifyOtp";

// Dashboard Layout
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Settings from "./pages/dashboard/Settings";
import Profile from "./pages/dashboard/Profile";
import Categories from "./pages/dashboard/Categories";
import CategoriesPage from "./pages/dashboard/CategoriesPage";
import SubcategoriesPage from "./pages/dashboard/SubcategoriesPage";
import ParttypesPage from "./pages/dashboard/ParttypesPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import ProductsViewPage from "./pages/dashboard/ProductsViewPage";
import PrivateRoute from "./components/PrivateRoute";
import LoadingSpinner from "./components/LoadingSpinner";

// Import existing categorization tool
import AcesPiesCategorizationTool from "./components/AcesPiesCategorizationTool";

import "./App.css";

function App() {
  return (
    <Provider store={store}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#fff",
            color: "#363636",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            borderRadius: "12px",
            padding: "16px",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />
      <PersistGate
        loading={<LoadingSpinner fullScreen text="Loading..." />}
        persistor={persistor}
      >
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />

            {/* Protected Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route
                path="categorize"
                element={<AcesPiesCategorizationTool />}
              />
              <Route
                path="products"
                element={
                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900">
                      My Products
                    </h2>
                    <p className="text-gray-600 mt-2">
                      View and manage your products
                    </p>
                  </div>
                }
              />
              <Route path="reports" element={<ReportsPage />} />
              <Route
                path="products-view/:fileUrl"
                element={<ProductsViewPage />}
              />
              <Route
                path="insights"
                element={
                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900">
                      AI Insights
                    </h2>
                    <p className="text-gray-600 mt-2">
                      AI-powered analytics and insights
                    </p>
                  </div>
                }
              />
              <Route path="categories" element={<Categories />} />
              <Route path="categories-list" element={<CategoriesPage />} />
              <Route path="subcategories" element={<SubcategoriesPage />} />
              <Route path="parttypes" element={<ParttypesPage />} />
              <Route
                path="export"
                element={
                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Export Data
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Export your categorized products
                    </p>
                  </div>
                }
              />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
              <Route
                path="help"
                element={
                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Help & Support
                    </h2>
                    <p className="text-gray-600 mt-2">Get help and support</p>
                  </div>
                }
              />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  );
}

export default App;
