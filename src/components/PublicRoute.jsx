import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { checkSession } from "../store/slices/authSlice";
import LoadingSpinner from "./LoadingSpinner";

const PublicRoute = ({ children }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isAuthenticated, loading } = useSelector((state) => state.auth);
  const [checking, setChecking] = React.useState(true);

  useEffect(() => {
    const verify = async () => {
      // Check for recovery token FIRST before checking session
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      const isRecovery = 
        (hash && hash.includes("type=recovery")) || 
        searchParams.get("type") === "recovery" ||
        (hash && (hash.includes("access_token") || hash.includes("refresh_token")));

      // If this is a recovery link to reset-password, skip session check
      if (isRecovery && location.pathname === "/reset-password") {
        setChecking(false);
        return;
      }

      // Otherwise, check session normally
      await dispatch(checkSession());
      setChecking(false);
    };
    verify();
  }, [dispatch, location.pathname]);

  if (checking || loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  // Supabase password reset: allow /reset-password if type=recovery in hash or search params
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);
  const isRecovery = 
    (hash && hash.includes("type=recovery")) || 
    searchParams.get("type") === "recovery" ||
    (hash && (hash.includes("access_token") || hash.includes("refresh_token")));

  if (
    isAuthenticated &&
    !(isRecovery && location.pathname === "/reset-password")
  ) {
    // If already logged in, redirect to dashboard (except during password recovery)
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return children;
};

export default PublicRoute;
