import React, { useState, useEffect, useCallback, useRef } from "react";
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
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  Search,
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

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedReport, setExpandedReport] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const searchTimeout = useRef(null);

  const ITEMS_PER_PAGE = 20; // Use 20 for a more natural scroll experience

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
          .select("*, products:products(count)", { count: "exact" })
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

  // Initial load (paginated)
  useEffect(() => {
    if (!search) {
      setPage(0);
      fetchReports(0, false, "");
    }
  }, [fetchReports, search]);

  // Search effect (debounced)
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (search) {
      searchTimeout.current = setTimeout(() => {
        fetchReports(0, false, search.trim());
      }, 500);
    } else {
      // If search cleared, reload paginated
      setSearching(false);
      fetchReports(0, false, "");
    }
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, fetchReports]);

  // Infinite scroll handler (only when not searching)
  useEffect(() => {
    if (search) return;
    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      // If user is near the bottom, load more
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMore();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadingMore, hasMore, page, search]);

  const loadMore = () => {
    if (search) return;
    if (loadingMore || !hasMore) return; // Prevent duplicate calls
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReports(nextPage, true, "");
  };

  // Toggle report details
  const toggleExpand = (reportId) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
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

  // Old view file function (keeping for reference)
  const viewFileOld = async (fileUrl, fileName) => {
    try {
      toast.loading("Loading file...");

      const { data, error } = await supabase.storage
        .from("product-uploads")
        .download(fileUrl);

      if (error) throw error;

      // Read CSV content
      const text = await data.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        toast.error("File is empty");
        return;
      }

      // Parse CSV
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/"/g, ""));
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || "";
          return obj;
        }, {});
      });

      // Create HTML table
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 100%;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              font-size: 24px;
              font-weight: bold;
            }
            .table-wrapper {
              overflow-x: auto;
              padding: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              min-width: 600px;
            }
            th {
              background: #3b82f6;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              position: sticky;
              top: 0;
              z-index: 10;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 14px;
              color: #374151;
            }
            tr:hover {
              background: #f9fafb;
            }
            tr:nth-child(even) {
              background: #f9fafb;
            }
            .info {
              padding: 15px 20px;
              background: #eff6ff;
              border-left: 4px solid #3b82f6;
              margin: 20px;
              border-radius: 4px;
              color: #1e40af;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">${fileName}</div>
            <div class="info">Total Rows: ${rows.length}</div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    ${headers.map((h) => `<th>${h}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map(
                      (row) => `
                    <tr>
                      ${headers.map((h) => `<td>${row[h] || ""}</td>`).join("")}
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </body>
        </html>
      `;

      // Open in new window
      const newWindow = window.open("", "_blank");
      newWindow.document.write(html);
      newWindow.document.close();

      toast.dismiss();
      toast.success("File opened in new tab");
    } catch (error) {
      console.error("View error:", error);
      toast.dismiss();
      toast.error("Failed to view file");
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
                  {reports.length}
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
                          <div className="flex items-center justify-center space-x-1">
                            {report.file_url && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    viewFile(report.file_url, report.file_name);
                                  }}
                                  className="px-2 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all flex items-center space-x-1"
                                  title="View file"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="text-xs font-semibold hidden sm:inline">
                                    View
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFile(
                                      report.file_url,
                                      report.file_name
                                    );
                                  }}
                                  className="p-2 text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-all"
                                  title="Download file"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </>
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
            </div>
          )}
        </div>

        {/* Bottom Info Bar styled like the screenshot */}
        {!search && (
          <div className="w-full bg-gray-50 border-t border-gray-200 px-6 py-3">
            <span className="text-gray-600 text-sm">
              Showing {reports.length} of {totalCount} records
            </span>
          </div>
        )}

        {/* Loading More Indicator */}
        {loadingMore && !search && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mr-3" />
            <span className="text-gray-600 font-medium">Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
