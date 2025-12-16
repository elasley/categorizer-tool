import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  BarChart3,
  Settings,
  HelpCircle,
  Zap,
  Tag,
  FileText,
  Users,
  network,
  Layers,
  Box,
  Network,
} from "lucide-react";

const DashboardSidebar = ({ isOpen, onClose }) => {
  const menuItems = [
    {
      title: "Main",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
        {
          icon: Upload,
          label: "Categorize tools",
          path: "/dashboard/categorize",
        },
        // { icon: FileText, label: "My Products", path: "/dashboard/export" },
      ],
    },
    {
      title: "Analytics",
      items: [
        { icon: BarChart3, label: "Reports", path: "/dashboard/reports" },
        // { icon: Zap, label: "AI Insights", path: "/dashboard/insights" },
      ],
    },
    {
      title: "Management",
      items: [
        {
          icon: Network,
          label: "Categories Tree",
          path: "/dashboard/categories",
        },
        { icon: Tag, label: "Categories", path: "/dashboard/categories-list" },
        {
          icon: Layers,
          label: "Subcategories",
          path: "/dashboard/subcategories",
        },
        { icon: Box, label: "Part Types", path: "/dashboard/parttypes" },
        // { icon: FolderOpen, label: "Products", path: "/dashboard/products" },
      ],
    },
    {
      title: "Settings",
      items: [
        { icon: Settings, label: "Settings", path: "/dashboard/settings" },
        // { icon: HelpCircle, label: "Help & Support", path: "/dashboard/help" },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0  bg-white border-r border-gray-200 transition-transform duration-300 z-40 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } w-64 lg:w-72`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          {/* <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              Menu
            </h2>
          </div> */}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto   p-4">
            {menuItems.map((section, idx) => (
              <div key={idx} className="mb-6">
                <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item, itemIdx) => (
                    <NavLink
                      key={itemIdx}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                            : "text-gray-700 hover:bg-gray-100"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={`w-5 h-5 ${
                              isActive ? "text-white" : "text-gray-500"
                            }`}
                          />
                          <span className="font-medium text-sm">
                            {item.label}
                          </span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
