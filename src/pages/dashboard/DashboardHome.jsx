import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Package,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Users,
  Zap,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { useSelector } from "react-redux";

const DashboardHome = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Add state for counts
  const [categorizedCount, setCategorizedCount] = useState(0);
  const [uploadFilesCount, setUploadFilesCount] = useState(0);
  const [recentUploads, setRecentUploads] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    // Fetch total categorized products
    const fetchCounts = async () => {
      if (!user?.id) return;

      setLoadingStats(true);
      const { count: categorized, error: catErr } = await supabase
        .from("categories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!catErr) setCategorizedCount(categorized || 0);

      // Fetch total upload files for current user
      const { count: uploads, error: upErr } = await supabase
        .from("upload_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!upErr) setUploadFilesCount(uploads || 0);
      setLoadingStats(false);
    };
    fetchCounts();
  }, [user]);

  useEffect(() => {
    // Fetch latest 4 uploads for current user
    const fetchRecentUploads = async () => {
      if (!user?.id) return;

      setLoadingActivity(true);
      const { data, error } = await supabase
        .from("upload_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(4);
      if (!error) setRecentUploads(data || []);
      setLoadingActivity(false);
    };
    fetchRecentUploads();
  }, [user]);

  // Remove handleViewAllUploads async logic, just navigate
  const handleViewAllUploads = () => {
    navigate("/reports");
  };

  const stats = [
    {
      title: "Total Categorized",
      value: categorizedCount.toLocaleString(),
      change: "",
      trend: "up",
      icon: CheckCircle,
      color: "green",
    },
    {
      title: "Total Upload Files",
      value: uploadFilesCount.toLocaleString(),
      change: "",
      trend: "up",
      icon: Package,
      color: "blue",
    },
  ];

  const recentActivity = [
    {
      id: 1,
      action: "Categorized 45 products",
      time: "2 hours ago",
      status: "success",
    },
    {
      id: 2,
      action: "Uploaded new product CSV",
      time: "5 hours ago",
      status: "success",
    },
    {
      id: 3,
      action: "Updated category mappings",
      time: "1 day ago",
      status: "success",
    },
    {
      id: 4,
      action: "Exported categorized data",
      time: "2 days ago",
      status: "success",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
        {loadingStats ? (
          <>
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-pulse"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-200"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            ))}
          </>
        ) : (
          stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}
                >
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </h3>
              <p className="text-sm text-gray-600">{stat.title}</p>
            </div>
          ))
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <button
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              onClick={handleViewAllUploads}
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {loadingActivity ? (
              <>
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg animate-pulse"
                  >
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : recentUploads.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No uploads yet.
              </div>
            ) : (
              recentUploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {upload.file_name || "Unnamed File"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(upload.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button
              className="w-full p-4 bg-gray-50 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-left
               hover:bg-blue-600 group"
              onClick={() => navigate("/categorize")}
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-gray-600 group-hover:text-white" />
                <span className="font-semibold text-sm text-gray-700 group-hover:text-white">
                  Upload Products
                </span>
              </div>
            </button>

            <button
              className="w-full p-4 bg-gray-50 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-left
               hover:bg-blue-600 group border border-gray-200"
              onClick={() => navigate("/reports")}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-gray-600 group-hover:text-white" />
                <span className="font-semibold text-sm text-gray-700 group-hover:text-white">
                  View Reports
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
