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
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Dashboard Layout
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Settings from "./pages/dashboard/Settings";
// ...existing code...

import Profile from "./pages/dashboard/Profile";
import Categories from "./pages/dashboard/Categories";
import CategoriesPage from "./pages/dashboard/CategoriesPage";
import SubcategoriesPage from "./pages/dashboard/SubcategoriesPage";
import ParttypesPage from "./pages/dashboard/ParttypesPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import ProductsViewPage from "./pages/dashboard/ProductsViewPage";
import PrivateRoute from "./components/PrivateRoute";
import PublicRoute from "./components/PublicRoute";
import LoadingSpinner from "./components/LoadingSpinner";
import { SplineIcon } from "lucide-react";
import AcesPiesCategorizationTool from "./components/AcesPiesCategorizationTool";
import "./App.css";

// Debug log to help diagnose reset password flow
console.log("PATH:", window.location.pathname, "HASH:", window.location.hash);

function App() {
  // Force redirect to /reset-password if type=recovery is in the URL hash
  React.useEffect(() => {
    const hash = window.location.hash;
    if (
      hash &&
      hash.includes("type=recovery") &&
      window.location.pathname !== "/reset-password"
    ) {
      window.location.replace("/reset-password" + window.location.hash);
    }
  }, []);

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
        loading={<LoadingSpinner fullScreen icon={<SplineIcon />} />}
        persistor={persistor}
      >
        <BrowserRouter>
          <Routes>
            {/* Public Routes - Redirect to dashboard if authenticated */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              }
            />
            <Route path="/verify-otp" element={<VerifyOtp />} />

            {/* Protected Routes - Using DashboardLayout as wrapper without /dashboard prefix */}
            <Route
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardHome />} />
              <Route
                path="/categorize"
                element={<AcesPiesCategorizationTool />}
              />
              <Route path="/reports" element={<ReportsPage />} />
              <Route
                path="/products-view/:fileUrl"
                element={<ProductsViewPage />}
              />
              <Route path="/categories" element={<Categories />} />
              <Route path="/categories-list" element={<CategoriesPage />} />
              <Route path="/subcategories" element={<SubcategoriesPage />} />
              <Route path="/parttypes" element={<ParttypesPage />} />
              <Route
                path="/export"
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
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
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
