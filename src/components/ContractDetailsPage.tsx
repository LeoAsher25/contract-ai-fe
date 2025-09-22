import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SuperDoc } from "@harbour-enterprises/superdoc";
import "@harbour-enterprises/superdoc/style.css";
import PdfViewer, { PdfViewerRef } from "./PdfViewer";

interface ContractData {
  id: string;
  fileName: string;
  fileSize: number;
  uploadTime: string;
  fileUrl: string;
  fileType: "pdf" | "docx";
  content?: string;
}

type SearchResult = { from: number; to: number; text?: string };

const DEFAULT_MASK = "mask info";
const DEFAULT_PRICES = [
  "50.000.000",
  "1.200.000",
  "8.500.000",
  "35.000.000",
  "93.500.000",
  "năm mươi triệu đồng",
  "1,2 triệu",
];

const ContractDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const superdocRef = useRef<SuperDoc | null>(null);
  const pdfViewerRef = useRef<PdfViewerRef | null>(null);

  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMasking, setIsMasking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [maskText, setMaskText] = useState(DEFAULT_MASK);
  const [pricesText, setPricesText] = useState<string>(() =>
    DEFAULT_PRICES.join("\n")
  );
  const [isMasked, setIsMasked] = useState(false);

  // Mock API function to get contract data
  const mockGetContractAPI = async (
    contractId: string
  ): Promise<ContractData> => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Extract file type from contract ID (stored during upload)
    const fileType = contractId.includes("_pdf_") ? "pdf" : "docx";
    const fileName = `contract_${contractId}.${fileType}`;
    const fileUrl = fileType === "pdf" ? "/contract.pdf" : "/contract.docx";

    console.log(
      "Contract ID:",
      contractId,
      "Detected file type:",
      fileType,
      "File URL:",
      fileUrl
    );

    return {
      id: contractId,
      fileName: fileName,
      fileSize: 2048576, // 2MB
      uploadTime: new Date().toISOString(),
      fileUrl: fileUrl,
      fileType: fileType as "pdf" | "docx",
    };
  };

  // Mock API function to export file
  const mockExportAPI = async (
    contractId: string,
    isMasked: boolean
  ): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(
      `Exporting ${
        isMasked ? "masked" : "original"
      } file for contract ${contractId}`
    );
  };

  useEffect(() => {
    const fetchContractData = async () => {
      if (!id) return;

      try {
        const data = await mockGetContractAPI(id);
        setContractData(data);
      } catch (error) {
        console.error("Failed to fetch contract data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContractData();
  }, [id]);

  useEffect(() => {
    if (
      !containerRef.current ||
      !contractData ||
      contractData.fileType === "pdf"
    )
      return;

    const containerElement = containerRef.current; // Store ref value to avoid ESLint warning

    const sdoc = new SuperDoc({
      selector: containerElement as any,
      document: {
        type: "docx",
        url: contractData.fileUrl,
      },
      format: "docx",
      documentMode: "editing",
      user: { name: "demo", email: "demo@local" },
      documents: [],
      pagination: true,
      onReady: (event) => {
        console.log("SuperDoc is ready", event);
      },
      onEditorCreate: (event) => {
        console.log("Editor is created", event);
      },
      onContentError: () => {
        console.log("Content error occurred");
      },
    });

    superdocRef.current = sdoc;

    return () => {
      superdocRef.current?.destroy?.();
      superdocRef.current = null;
      if (containerElement) {
        containerElement.innerHTML = "";
      }
    };
  }, [contractData]);

  const parsePrices = (): string[] => {
    return pricesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  };

  const handleMaskPrices = async () => {
    if (!contractData) return;

    setIsMasking(true);

    try {
      if (contractData.fileType === "pdf") {
        // Use PDF viewer for masking
        if (pdfViewerRef.current) {
          await pdfViewerRef.current.maskPrices();
        }
      } else {
        // Use SuperDoc for DOCX masking
        const sdoc = superdocRef.current;
        if (!sdoc) return;

        const editor = sdoc.activeEditor;
        if (!editor) return;

        const prices = parsePrices();
        console.log("Masking prices:", prices);

        // Find all matches for each price string
        const allMatches: SearchResult[] = prices.flatMap((price) => {
          const results = sdoc.search(price) as SearchResult[];
          console.log(`Found ${results?.length || 0} matches for "${price}"`);
          return results || [];
        });

        if (allMatches.length === 0) {
          console.log("No matches found to mask");
          alert("Không tìm thấy giá trị nào để che");
          return;
        }

        // Remove duplicates and sort by position (descending to avoid index shifting)
        const uniq = new Map<string, SearchResult>();
        for (const match of allMatches) {
          uniq.set(`${match.from}-${match.to}`, match);
        }
        const matches = Array.from(uniq.values()).sort(
          (a, b) => b.from - a.from
        );

        console.log(`Masking: ${matches.length} unique matches`);

        // Process matches one by one
        let processedCount = 0;
        const processNextMatch = () => {
          if (processedCount >= matches.length) {
            console.log("All matches processed!");
            setIsMasked(true);
            setIsMasking(false);
            return;
          }

          const match = matches[processedCount];
          console.log(
            `Processing match ${processedCount + 1}/${matches.length}:`,
            match
          );

          try {
            sdoc.goToSearchResult(match);

            if (
              editor.commands &&
              editor.commands.deleteSelection &&
              editor.commands.insertContent
            ) {
              editor.commands.deleteSelection();
              editor.commands.insertContent(maskText);
              console.log(
                `✓ Masked match ${processedCount + 1} with "${maskText}"`
              );
            } else if (editor.commands && editor.commands.insertContent) {
              editor.commands.insertContent(maskText);
              console.log(
                `✓ Inserted "${maskText}" for match ${processedCount + 1}`
              );
            }

            processedCount++;
            setTimeout(processNextMatch, 200);
          } catch (error) {
            console.error(
              `Error processing match ${processedCount + 1}:`,
              error
            );
            processedCount++;
            setTimeout(processNextMatch, 200);
          }
        };

        processNextMatch();
      }
    } catch (error) {
      console.error("Error masking prices:", error);
      setIsMasking(false);
    }
  };

  const handleExport = async () => {
    if (!contractData) return;

    setIsExporting(true);

    try {
      if (contractData.fileType === "pdf" && pdfViewerRef.current) {
        // Export PDF using pdf-lib
        await pdfViewerRef.current.exportPdf();
      } else {
        // Export DOCX using mock API
        await mockExportAPI(contractData.id, isMasked);
        alert(
          `Đã export file ${isMasked ? "sau khi che giá" : "gốc"} thành công!`
        );
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Có lỗi xảy ra khi export file");
    } finally {
      setIsExporting(false);
    }
  };

  // PDF masking callbacks
  const handlePdfMaskComplete = (success: boolean) => {
    setIsMasking(false);
    if (success) {
      setIsMasked(true);
      console.log("PDF masking completed successfully");
    } else {
      console.log("PDF masking failed or no matches found");
      alert("Không tìm thấy giá trị nào để che hoặc có lỗi xảy ra");
    }
  };

  const handlePdfExport = (pdfBytes: Uint8Array) => {
    // Create download link
    const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${contractData?.fileName || "contract"}_${
      isMasked ? "masked" : "original"
    }.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(
      `Đã export file PDF ${isMasked ? "sau khi che giá" : "gốc"} thành công!`
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString("vi-VN");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-10 bg-white rounded-2xl shadow-xl">
          <div className="text-5xl mb-5">⏳</div>
          <div className="text-lg text-gray-600">
            Đang tải thông tin hợp đồng...
          </div>
        </div>
      </div>
    );
  }

  if (!contractData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-10 bg-white rounded-2xl shadow-xl">
          <div className="text-5xl mb-5">❌</div>
          <div className="text-lg text-gray-600 mb-5">
            Không tìm thấy hợp đồng
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2 bg-indigo-500 text-white border-none rounded-lg cursor-pointer text-base hover:bg-indigo-600 transition-colors">
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white p-5 shadow-lg mb-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {contractData.fileName}
            </h1>
            <div className="text-gray-600 text-sm">
              <span>📅 {formatDate(contractData.uploadTime)}</span>
              <span className="mx-4">•</span>
              <span>📏 {formatFileSize(contractData.fileSize)}</span>
              <span className="mx-4">•</span>
              <span>📄 {contractData.fileType.toUpperCase()}</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2 bg-gray-500 text-white border-none rounded-lg cursor-pointer text-sm hover:bg-gray-600 transition-colors">
              ← Quay lại
            </button>

            <button
              onClick={handleMaskPrices}
              disabled={isMasking}
              className={`px-5 py-2 border-none rounded-lg text-sm font-bold transition-colors ${
                isMasking
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-yellow-400 text-black cursor-pointer hover:bg-yellow-500"
              }`}>
              {isMasking ? "⏳ Đang che..." : "🔒 Che giá"}
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`px-5 py-2 border-none rounded-lg text-sm font-bold transition-colors ${
                isExporting
                  ? "bg-gray-300 text-white cursor-not-allowed"
                  : "bg-green-500 text-white cursor-pointer hover:bg-green-600"
              }`}>
              {isExporting ? "⏳ Đang export..." : "📥 Export"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 grid grid-cols-[300px_1fr] gap-5">
        {/* Controls Panel */}
        <div className="bg-white rounded-2xl p-5 shadow-lg h-fit">
          <h3 className="text-lg font-bold text-gray-800 mb-5 border-b-2 border-gray-100 pb-2">
            Cài đặt che giá
          </h3>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Text thay thế:
            </label>
            <input
              type="text"
              value={maskText}
              onChange={(e) => setMaskText(e.target.value)}
              className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm outline-none transition-colors focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Giá trị cần che (mỗi dòng một giá):
            </label>
            <textarea
              rows={8}
              value={pricesText}
              onChange={(e) => setPricesText(e.target.value)}
              className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm font-mono resize-y outline-none transition-colors focus:border-indigo-500"
            />
          </div>

          {isMasked && (
            <div className="mt-5 p-4 bg-green-100 rounded-lg text-green-700 text-sm text-center">
              ✅ Đã che giá thành công
            </div>
          )}
        </div>

        {/* Document Viewer */}
        <div className="bg-white rounded-2xl p-5 shadow-lg overflow-hidden">
          {contractData.fileType === "pdf" ? (
            <PdfViewer
              ref={pdfViewerRef}
              fileUrl={contractData.fileUrl}
              maskText={maskText}
              pricesToMask={parsePrices()}
              onMaskComplete={handlePdfMaskComplete}
              onExport={handlePdfExport}
            />
          ) : (
            <div
              ref={containerRef}
              className="h-[800px] overflow-auto border border-gray-200 rounded-lg w-full p-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractDetailsPage;
