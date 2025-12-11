import React from "react";
import { useSelector } from "react-redux";
import { User, Mail, Calendar, Shield, Award } from "lucide-react";

const Profile = () => {
  const { user } = useSelector((state) => state.auth);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-2xl font-bold text-white">
                {user?.user_metadata?.full_name?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  "U"}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {user?.user_metadata?.full_name || "User"}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">Member Profile</p>
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className="p-6 space-y-5">
          {/* Account Details */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Account Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-500">
                    Full Name
                  </span>
                </div>
                <p className="text-gray-900 font-medium ml-11">
                  {user?.user_metadata?.full_name || "Not provided"}
                </p>
              </div>

              {/* Email */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-500">
                    Email Address
                  </span>
                </div>
                <p className="text-gray-900 font-medium ml-11 break-all">
                  {user?.email || "Not available"}
                </p>
              </div>

              {/* Member Since */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-500">
                    Member Since
                  </span>
                </div>
                <p className="text-gray-900 font-medium ml-11">
                  {formatDate(user?.created_at)}
                </p>
              </div>

              {/* Account Status */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-500">
                    Account Status
                  </span>
                </div>
                <div className="ml-11">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Email Verification Status */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Email Verified
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {user?.email_confirmed_at
                    ? `Verified on ${formatDate(user.email_confirmed_at)}`
                    : "Email verification pending"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
