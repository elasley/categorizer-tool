import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Lock, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import Logo from "../../components/Logo";
import { supabase } from "../../config/supabase";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  // Validate recovery token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        // Check if we have a recovery token in the URL hash or search params
        const hash = window.location.hash;
        const searchParams = new URLSearchParams(window.location.search);

        // Check for recovery type in multiple formats
        const hasRecoveryType =
          (hash && hash.includes("type=recovery")) ||
          searchParams.get("type") === "recovery";

        // Check for access token (which indicates a valid reset link)
        const hasAccessToken =
          hash &&
          (hash.includes("access_token") || hash.includes("refresh_token"));

        if (!hasRecoveryType && !hasAccessToken) {
          setTokenError(
            "Invalid or missing recovery token. Please request a new password reset link."
          );
          setTokenChecked(true);
          return;
        }

        // If user is already authenticated with a regular session, sign them out first
        // This prevents conflicts between the old session and the recovery session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (session && !hasRecoveryType) {
          // Sign out the current session to allow recovery session to take over
          await supabase.auth.signOut();
        }

        // Verify the recovery session is valid
        const {
          data: { session: recoverySession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          setTokenError(
            "Your password reset link has expired or is invalid. Please request a new one."
          );
          setTokenChecked(true);
          return;
        }

        // Token is valid
        setTokenChecked(true);
      } catch (err) {
        console.error("Token validation error:", err);
        setTokenError(
          "An error occurred while validating your reset link. Please try again."
        );
        setTokenChecked(true);
      }
    };

    validateToken();
  }, []);

  const onSubmit = async (formData) => {
    setServerError(null);

    if (formData.newPassword !== formData.confirmPassword) {
      setServerError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      setServerError("Password must be at least 6 characters");
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) {
        setServerError(error.message);
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success(
          "Password changed successfully! Redirecting to dashboard..."
        );
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      }
    } catch (err) {
      setServerError("An unexpected error occurred. Please try again.");
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  // Show loading spinner while checking token
  if (!tokenChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <LoadingSpinner fullScreen text="Validating reset link..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Logo />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {tokenError ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Invalid Reset Link
                </p>
                <p className="text-gray-600 mb-4">{tokenError}</p>
              </div>
              <div className="space-y-3">
                <button
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  onClick={() => navigate("/forgot-password")}
                >
                  Request New Reset Link
                </button>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Password Changed Successfully!
                </p>
                <p className="text-gray-600">Redirecting to login page...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Reset Your Password
                </h2>
                <p className="text-gray-600 mt-2">
                  Enter your new password below
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register("newPassword", {
                      required: "New password is required",
                      minLength: {
                        value: 6,
                        message: "Password must be at least 6 characters",
                      },
                    })}
                    type="password"
                    className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      errors.newPassword
                        ? "border-red-300 focus:border-red-500"
                        : "border-gray-200 focus:border-blue-500"
                    }`}
                    placeholder="Enter new password"
                  />
                </div>
                {errors.newPassword && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.newPassword.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register("confirmPassword", {
                      required: "Please confirm your password",
                      validate: (value) =>
                        value === watch("newPassword") ||
                        "Passwords do not match",
                    })}
                    type="password"
                    className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      errors.confirmPassword
                        ? "border-red-300 focus:border-red-500"
                        : "border-gray-200 focus:border-blue-500"
                    }`}
                    placeholder="Confirm new password"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
              {serverError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {serverError}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  "Change Password"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
