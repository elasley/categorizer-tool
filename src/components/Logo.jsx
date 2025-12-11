import React from "react";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
const Logo = () => {
  const Route = useNavigate();
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-lg animate-pulse"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-400 to-indigo-400 rounded-xl opacity-50 blur-sm"></div>

        {/* Icon */}
        <div className="relative w-full h-full flex items-center justify-center">
          <svg
            className="w-7 h-7 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          {/* <Zap className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400" /> */}
        </div>
      </div>

      <div
        className="flex flex-col cursor-pointer"
        onClick={() => Route("/dashboard")}
      >
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          AutoCat Pro
        </h1>
        <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
          AI Product Categorizer
        </p>
      </div>
    </div>
  );
};

export default Logo;
