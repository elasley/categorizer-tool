import React from "react";
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

const DashboardHome = () => {
  const stats = [
    {
      title: "Total Products",
      value: "2,543",
      change: "+12.5%",
      trend: "up",
      icon: Package,
      color: "blue",
    },
    {
      title: "Categorized",
      value: "2,187",
      change: "+8.2%",
      trend: "up",
      icon: CheckCircle,
      color: "green",
    },
    {
      title: "Pending Review",
      value: "356",
      change: "-5.1%",
      trend: "down",
      icon: AlertTriangle,
      color: "yellow",
    },
    {
      title: "AI Accuracy",
      value: "94.3%",
      change: "+2.1%",
      trend: "up",
      icon: Zap,
      color: "purple",
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, idx) => (
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
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${
                  stat.trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {stat.trend === "up" ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
                {stat.change}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stat.value}
            </h3>
            <p className="text-sm text-gray-600">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.action}
                  </p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button className="w-full p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg text-left">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5" />
                <span className="font-semibold text-sm">Upload Products</span>
              </div>
            </button>
            <button className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left border border-gray-200">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-sm text-gray-700">
                  View Reports
                </span>
              </div>
            </button>
            <button className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left border border-gray-200">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-sm text-gray-700">
                  AI insights
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
