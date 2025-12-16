import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { signOut } from "../../store/slices/authSlice";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Settings,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Search,
  Sparkles,
} from "lucide-react";
import Logo from "../Logo";

const DashboardHeader = ({ onMenuClick, isSidebarOpen }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    await dispatch(signOut());
    navigate("/login");
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="px-4 sm:px-6 ">
        <div className="flex items-center justify-between  h-16 lg:h-20">
          {/* Left Section */}
          <div className="flex items-center justify-between  w-full gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isSidebarOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>

            {/* Logo - Hidden on screens < 1024px (lg) */}
            <div className="hidden lg:block">
              <Logo />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* AI Status Indicator */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-md">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" />
                <span className="text-xs sm:text-sm font-semibold">
                  AI Powered
                </span>
              </div>

              {/* Settings */}
              <button
                onClick={() => navigate("/dashboard/settings")}
                className=" p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600 animate-spin" />
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user?.user_metadata?.full_name?.[0] ||
                      user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">
                          {user?.user_metadata?.full_name || "User"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {user?.email}
                        </p>
                      </div>
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            navigate("/dashboard/profile");
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        >
                          <User className="w-4 h-4" />
                          My Profile
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            navigate("/dashboard/settings");
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </button>
                      </div>
                      <div className="border-t border-gray-100 pt-2">
                        <button
                          onClick={handleSignOut}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Section */}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
