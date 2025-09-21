import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface UploadResponse {
  id: string;
  fileName: string;
  fileSize: number;
  uploadTime: string;
}

const UploadPage: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Mock API function for file upload
  const mockUploadAPI = async (file: File): Promise<UploadResponse> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Detect file type
    const fileType = file.type.includes("pdf") ? "pdf" : "docx";
    console.log("Uploaded file type:", file.type, "Detected as:", fileType);

    return {
      id: `contract_${fileType}_${Date.now()}`, // Include file type in ID
      fileName: file.name,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
    };
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Vui lòng chọn file PDF hoặc DOCX");
      return;
    }

    setIsUploading(true);

    try {
      const response = await mockUploadAPI(file);
      console.log("Upload successful:", response);

      // Navigate to details page
      navigate(`/details/${response.id}`);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Có lỗi xảy ra khi upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-10 shadow-2xl max-w-lg w-full text-center">
        <div className="text-5xl mb-5">📄</div>

        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Upload Contract
        </h1>

        <p className="text-gray-600 mb-8 text-base">
          Upload file PDF hoặc DOCX để xem và xử lý hợp đồng
        </p>

        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-4 border-dashed rounded-2xl py-10 px-5 cursor-pointer transition-all duration-300 mb-5 ${
            dragActive
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 bg-gray-50"
          }`}
        >
          <div
            className={`text-4xl mb-4 ${
              dragActive ? "text-indigo-500" : "text-gray-400"
            }`}
          >
            {isUploading ? "⏳" : dragActive ? "📁" : "📤"}
          </div>

          <div
            className={`text-lg font-medium mb-3 ${
              dragActive ? "text-indigo-500" : "text-gray-800"
            }`}
          >
            {isUploading
              ? "Đang upload..."
              : dragActive
              ? "Thả file vào đây"
              : "Click để chọn file hoặc kéo thả"}
          </div>

          <div className="text-sm text-gray-500">PDF, DOCX (tối đa 50MB)</div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading && (
          <div className="mt-5 p-4 bg-blue-50 rounded-xl text-blue-700">
            <div className="mb-3">⏳ Đang xử lý file...</div>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="w-full h-full bg-blue-500 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
