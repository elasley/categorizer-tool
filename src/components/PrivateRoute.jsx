import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { checkSession } from "../store/slices/authSlice";
import LoadingSpinner from "./LoadingSpinner";

const PrivateRoute = ({ children }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isAuthenticated, loading } = useSelector((state) => state.auth);
  const [checking, setChecking] = React.useState(true);

  useEffect(() => {
    const verify = async () => {
      await dispatch(checkSession());
      setChecking(false);
    };
    verify();
  }, [dispatch]);

  if (checking || loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default PrivateRoute;
