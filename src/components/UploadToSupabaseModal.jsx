import React, { useState } from "react";
import { X, Upload, Loader2, FileText } from "lucide-react";
import toast from "react-hot-toast";

const UploadToSupabaseModal = ({
  isOpen,
  onClose,
  onUpload,
  productsCount,
  uploadProgress,
}) => {
  const [fileName, setFileName] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const progress = uploadProgress || { percentage: 0, stage: '', isActive: false, currentChunk: 0, totalChunks: 0, processedProducts: 0, totalProducts: 0 };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!fileName.trim()) {
      toast.error("File name is required");
      return;
    }

    setIsUploading(true);

    // Call the upload function without awaiting (let parent handle the promise)
    onUpload({
      fileName: fileName.trim(),
      description: description.trim(),
    })
      .then(() => {
        // Reset form on success
        setFileName("");
        setDescription("");
        onClose();
      })
      .catch((error) => {
        console.error("Upload failed:", error);
        // Error toast is handled in parent component
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Permanently Stored</h2>
                <p className="text-blue-100 text-sm">
                  {productsCount} products ready to upload
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress Bar with Badge */}
        
{progress.isActive && (
  <div className="mt-4 space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">
        {progress.stage}
        {/* Show chunk and product progress if available */}
        {progress.currentChunk && progress.totalChunks && (
          <> • Chunk {progress.currentChunk}/{progress.totalChunks}</>
        )}
        {progress.processedProducts && progress.totalProducts && (
          <> • {progress.processedProducts}/{progress.totalProducts} products</>
        )}
      </span>
      <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full font-bold">
        {progress.percentage}%
      </span>
    </div>
    <div className="w-full bg-white bg-opacity-20 rounded-full h-2.5 overflow-hidden">
      <div 
        className="bg-white h-full rounded-full transition-all duration-300 ease-out shadow-lg"
        style={{ width: `${progress.percentage}%` }}
      />
    </div>
  </div>
)}

        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* File Name Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              File Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g., products_batch_001.csv"
                disabled={isUploading}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              This name will be used to identify the upload
            </p>
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description{" "}
              <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this upload..."
              rows={3}
              disabled={isUploading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional notes or metadata for this upload
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !fileName.trim()}
              className="flex-1 px-4 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadToSupabaseModal;
