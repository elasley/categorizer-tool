import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { supabase } from "../../config/supabase";
import {
  FileText,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  Search,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

// Skeleton loader component
const TableSkeleton = ({ rows = 8 }) => (
  <tbody>
    {Array.from({ length: rows }).map((_, idx) => (
      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
        {Array.from({ length: 6 }).map((_, colIdx) => (
          <td key={colIdx} className="px-6 py-5">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

// Actions dropdown component
const ActionsDropdown = ({
  report,
  onView,
  onDownload,
  onDelete,
  open,
  setOpen,
}) => {
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState(null);

  // Calculate dropdown position based on button location
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 140; // Approximate height of dropdown
      const margin = 8;
      let top = rect.bottom + margin;
      let left = rect.right - 192; // 192px = w-48
      if (rect.bottom + dropdownHeight + margin > window.innerHeight) {
        // Not enough space below, show above
        top = rect.top - dropdownHeight - margin;
      }
      // Prevent overflow left
      if (left < 8) left = 8;
      setDropdownStyle({
        position: "fixed",
        top: Math.max(top, 8),
        left,
        width: 192,
        zIndex: 9999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        borderRadius: 12,
        background: "white",
        border: "1px solid #e5e7eb",
        transition: "opacity 0.15s",
      });
    } else {
      setDropdownStyle(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    // Handle scroll to close dropdown when button goes off-screen
    const handleScroll = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Close dropdown if button is completely off-screen
      if (rect.bottom < -50 || rect.top > viewportHeight + 50) {
        setOpen(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, setOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open &&
        dropdownStyle &&
        createPortal(
          <div ref={dropdownRef} style={dropdownStyle}>
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View File
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <hr className="my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedReport, setExpandedReport] = useState(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const searchTimeout = useRef(null);
  const observerTarget = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReport, setDeleteReport] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const ITEMS_PER_PAGE = 20; // Fetch data in batches of 20

  // Fetch reports with pagination or search
  const fetchReports = useCallback(
    async (pageNum = 0, append = false, searchTerm = "") => {
      try {
        if (searchTerm) setSearching(true);
        if (pageNum === 0 && !searchTerm) setLoading(true);
        if (pageNum > 0 && !searchTerm) setLoadingMore(true);

        let from = pageNum * ITEMS_PER_PAGE;
        let to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
          .from("upload_history")
          .select("*", { count: "exact" })
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false });

        if (searchTerm) {
          // Search in file_name (case-insensitive)
          query = query.ilike("file_name", `%${searchTerm}%`);
        } else {
          query = query.range(from, to);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        if (data) {
          if (append && !searchTerm) {
            setReports((prev) => [...prev, ...data]);
          } else {
            setReports(data);
          }
          // For search, no pagination
          if (searchTerm) {
            setHasMore(false);
            setTotalCount(data.length);
          } else {
            setHasMore(
              data.length === ITEMS_PER_PAGE && from + ITEMS_PER_PAGE < count
            );
            setTotalCount(count || 0);
          }
        }
      } catch (error) {
        console.error("Error fetching reports:", error);
        toast.error("Failed to load reports");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setSearching(false);
      }
    },
    []
  );

  // Only load once on mount
  useEffect(() => {
    fetchReports(0, false, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search effect (debounced, only triggers fetch on search, not on clear)
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (search) {
      searchTimeout.current = setTimeout(() => {
        fetchReports(0, false, search.trim());
      }, 500);
    }
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, fetchReports]);

  // Intersection Observer for infinite scroll (only when not searching)
  useEffect(() => {
    if (!observerTarget.current || search) return;
    if (!hasMore || loadingMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(observerTarget.current);

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loadingMore, loading, search]);

  const loadMore = () => {
    if (search) return;
    if (loadingMore || !hasMore) return; // Prevent duplicate calls
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReports(nextPage, true, "");
  };

  // Download file
  const downloadFile = async (fileUrl, fileName) => {
    try {
      const { data, error } = await supabase.storage
        .from("product-uploads")
        .download(fileUrl);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  // View file - navigate to products view page
  const viewFile = (fileUrl, fileName) => {
    // Navigate to the new products view page with the file URL
    const encodedUrl = encodeURIComponent(fileUrl);
    navigate(`/products-view/${encodedUrl}`);
  };

  // Delete report
  const handleDeleteReport = async () => {
    if (!deleteReport) return;

    setDeleting(true);
    try {
      // First delete associated products (if they exist)
      const { error: productsError } = await supabase
        .from("products")
        .delete()
        .eq("upload_history_id", deleteReport.id);

      // Don't throw error if products don't exist or foreign key doesn't match
      if (productsError && !productsError.message.includes("does not exist")) {
        console.warn("Products deletion warning:", productsError);
      }

      // Delete file from storage if exists
      if (deleteReport.file_url) {
        const { error: storageError } = await supabase.storage
          .from("product-uploads")
          .remove([deleteReport.file_url]);

        // Don't throw error for storage deletion as file might not exist
        if (storageError) {
          console.warn("Storage deletion warning:", storageError);
        }
      }

      // Finally delete from upload_history table
      const { error: historyError } = await supabase
        .from("upload_history")
        .delete()
        .eq("id", deleteReport.id);

      if (historyError) throw historyError;

      toast.success("Report deleted successfully");

      // Refresh the reports list
      setReports((prev) => prev.filter((r) => r.id !== deleteReport.id));
      setTotalCount((prev) => prev - 1);

      setShowDeleteModal(false);
      setDeleteReport(null);
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error(`Failed to delete report: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !searching) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Upload Reports
            </h1>
            <p className="text-gray-600">
              View all product upload history and download files
            </p>
          </div>
          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl p-6 border border-gray-200"
              >
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4 animate-pulse"></div>
                <div className="h-6 bg-gray-100 rounded w-1/3 animate-pulse"></div>
              </div>
            ))}
          </div>
          {/* Search Bar Skeleton */}
          <div className="mb-6 flex items-center">
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-5 h-5 text-gray-300" />
              </span>
              <div className="pl-10 pr-4 py-2 w-full h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
          {/* Table Skeleton */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-blue-500 text-white">
                  <th className="w-[25%] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="w-[20%] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    Description
                  </th>
                  <th className="w-[12%] px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    Products
                  </th>
                  <th className="w-[13%] px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-[20%] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    Date
                  </th>
                  <th className="w-[15%] px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <TableSkeleton rows={8} />
            </table>
          </div>
          {/* Bottom Info Bar Skeleton */}
          <div className="w-full bg-gray-50 border-t border-gray-200 px-6 py-3 mt-2">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-2">
            Upload Reports
          </h1>
          <p className="text-gray-600">
            View all product upload history and download files
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Total Uploads
                </p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {totalCount}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Total Products
                </p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {reports.reduce((sum, r) => sum + (r.products_count || 0), 0)}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <Package className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Success Rate
                </p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {reports.length > 0
                    ? Math.round(
                        (reports.filter((r) => r.status === "success").length /
                          reports.length) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
        {/* Search Bar */}
        <div className="mb-6 flex items-center">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </span>
            <input
              type="text"
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
              placeholder="Search by file name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* {searching && (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin ml-3" />
          )} */}
        </div>

        {/* Reports Table */}
        <div className="bg-white rounded-xl border border-gray-200">
          {reports.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No Reports Yet
              </h3>
              <p className="text-gray-500">
                Upload some products to see reports here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead>
                  <tr className="bg-blue-500 text-white">
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                      File Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                      Description
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                      Products
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">
                      Date
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reports.map((report, index) => (
                    <React.Fragment key={report.id}>
                      <tr
                        className={`transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 cursor-pointer ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-4 align-top">
                          <div className="flex items-center space-x-2">
                            <div
                              className={`flex-shrink-0 p-2 rounded-lg ${
                                report.status === "success"
                                  ? "bg-green-100"
                                  : report.status === "failed"
                                  ? "bg-red-100"
                                  : "bg-yellow-100"
                              }`}
                            >
                              <FileText
                                className={`w-5 h-5 ${
                                  report.status === "success"
                                    ? "text-green-600"
                                    : report.status === "failed"
                                    ? "text-red-600"
                                    : "text-yellow-600"
                                }`}
                              />
                            </div>
                            <span className="font-semibold text-gray-800 truncate text-sm sm:text-base">
                              {report.file_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top hidden md:table-cell">
                          <span className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                            {report.description || "No description"}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="flex items-center justify-center space-x-1">
                            <Package className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <span className="font-bold text-base sm:text-xl text-gray-800">
                              {report.products_count || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="flex justify-center">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                                report.status === "success"
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : report.status === "failed"
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                              }`}
                            >
                              {report.status === "success" && (
                                <CheckCircle className="w-3 h-3 mr-1.5" />
                              )}
                              {report.status === "failed" && (
                                <AlertCircle className="w-3 h-3 mr-1.5" />
                              )}
                              {report.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top hidden sm:table-cell">
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-medium">
                                {new Date(report.created_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {new Date(report.created_at).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="flex items-center justify-center">
                            {report.file_url && (
                              <ActionsDropdown
                                report={report}
                                onView={() =>
                                  viewFile(report.file_url, report.file_name)
                                }
                                onDownload={() =>
                                  downloadFile(
                                    report.file_url,
                                    report.file_name
                                  )
                                }
                                onDelete={() => {
                                  setDeleteReport(report);
                                  setShowDeleteModal(true);
                                }}
                                open={openDropdown === report.id}
                                setOpen={(isOpen) =>
                                  setOpenDropdown(isOpen ? report.id : null)
                                }
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedReport === report.id && (
                        <tr className="bg-gradient-to-r from-gray-50 to-blue-50">
                          <td colSpan="6" className="px-3 py-4">
                            <div className="max-w-4xl mx-auto space-y-3">
                              {report.description && (
                                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                                  <h4 className="text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wide">
                                    Description
                                  </h4>
                                  <p className="text-sm text-gray-700">
                                    {report.description}
                                  </p>
                                </div>
                              )}
                              {report.error_message && (
                                <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                                  <h4 className="text-xs font-bold text-red-700 mb-2 uppercase tracking-wide">
                                    Error Details
                                  </h4>
                                  <p className="text-sm text-red-600">
                                    {report.error_message}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* Infinite scroll trigger */}
              {hasMore && !search && (
                <div ref={observerTarget} className="p-0 m-0">
                  {loadingMore && (
                    <div className="flex justify-center bg-white py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Pagination Footer */}
          {reports.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Showing {reports.length} of {totalCount}{" "}
              {totalCount === 1 ? "report" : "reports"}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deleteReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Delete Report
                </h2>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteReport(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-medium mb-1">
                        Delete "{deleteReport.file_name}"?
                      </p>
                      <p className="text-sm text-gray-600">
                        This will permanently delete the report and all
                        associated products ({deleteReport.products_count || 0}{" "}
                        products).
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleDeleteReport}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Deleting...
                        </>
                      ) : (
                        "Delete Report"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteReport(null);
                      }}
                      disabled={deleting}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
