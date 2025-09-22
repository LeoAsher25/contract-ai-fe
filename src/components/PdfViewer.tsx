import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// Set the worker source to use the correct version from public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface PdfViewerProps {
  fileUrl: string;
  maskText?: string;
  pricesToMask?: string[];
  onMaskComplete?: (success: boolean) => void;
  onExport?: (pdfBytes: Uint8Array) => void;
}

export interface PdfViewerRef {
  maskPrices: () => Promise<void>;
  exportPdf: () => Promise<void>;
}

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

interface MaskedItem extends TextItem {
  originalText: string;
}

const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(
  (
    {
      fileUrl,
      maskText = "MASK INFO",
      pricesToMask = [],
      onMaskComplete,
      onExport,
    },
    ref
  ) => {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(
      null
    );
    const [pdfLibDoc, setPdfLibDoc] = useState<PDFDocument | null>(null);
    const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(
      null
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [textItems, setTextItems] = useState<TextItem[]>([]);
    const [maskedItems, setMaskedItems] = useState<MaskedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load PDF document
    useEffect(() => {
      const loadPdf = async () => {
        try {
          setLoading(true);
          setError(null);

          console.log("Loading PDF from URL:", fileUrl);

          // Try loading PDF.js first with URL instead of fetched data
          const loadingTask = pdfjsLib.getDocument(fileUrl);
          const pdfDocument = await loadingTask.promise;
          setPdfDoc(pdfDocument);
          setTotalPages(pdfDocument.numPages);

          // Now fetch for pdf-lib (which needs the raw bytes)
          const response = await fetch(fileUrl);
          console.log(
            "Fetch response status:",
            response.status,
            response.statusText
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          console.log("ArrayBuffer size:", arrayBuffer.byteLength);

          const pdfBytes = new Uint8Array(arrayBuffer);
          console.log("PDF bytes length:", pdfBytes.length);

          setOriginalPdfBytes(pdfBytes);

          // Load with pdf-lib for manipulation
          const pdfLibDocument = await PDFDocument.load(pdfBytes);
          setPdfLibDoc(pdfLibDocument);

          // Extract all text items from all pages
          await extractAllTextItems(pdfDocument);
        } catch (err) {
          console.error("Error loading PDF:", err);
          setError(err instanceof Error ? err.message : "Failed to load PDF");
        } finally {
          setLoading(false);
        }
      };

      if (fileUrl) {
        loadPdf();
      }
    }, [fileUrl]);

    // Extract text items from all pages
    const extractAllTextItems = async (
      pdfDocument: pdfjsLib.PDFDocumentProxy
    ) => {
      const allTextItems: TextItem[] = [];

      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });

        textContent.items.forEach((item: any) => {
          if (item.str && item.str.trim()) {
            // Transform coordinates from PDF coordinate system
            const transform = item.transform;
            allTextItems.push({
              text: item.str,
              x: transform[4],
              y: viewport.height - transform[5], // Flip Y coordinate
              width: item.width || 0,
              height: item.height || 12,
              pageIndex: pageNum - 1,
            });
          }
        });
      }

      setTextItems(allTextItems);
    };

    // Highlight masked items on canvas
    const highlightMaskedItems = useCallback(
      (
        context: CanvasRenderingContext2D,
        viewport: pdfjsLib.PageViewport,
        pageIndex: number
      ) => {
        const pagesMaskedItems = maskedItems.filter(
          (item) => item.pageIndex === pageIndex
        );

        pagesMaskedItems.forEach((item) => {
          // Transform coordinates to canvas coordinates
          const x = item.x * scale;
          const y = item.y * scale;
          const width = Math.max(item.width * scale, 80); // Ensure minimum width
          const height = Math.max(item.height * scale, 14); // Ensure minimum height

          // Draw solid white rectangle to completely cover original text
          context.fillStyle = "white";
          context.fillRect(x - 2, y - height - 2, width + 4, height + 4);

          // Draw mask text centered in the rectangle
          context.fillStyle = "black";
          context.font = `${Math.min(height - 4, 12)}px Arial`;
          context.textAlign = "left";
          context.textBaseline = "bottom";
          context.fillText(maskText || "MASK INFO", x, y - 2);

          // Optional: Draw border for visibility during development
          // context.strokeStyle = "red";
          // context.lineWidth = 1;
          // context.strokeRect(x - 2, y - height - 2, width + 4, height + 4);
        });
      },
      [maskedItems, scale, maskText]
    );

    // Render current page
    const renderPage = useCallback(
      async (pageNumber: number) => {
        if (!pdfDoc || !canvasContainerRef.current) return;

        try {
          const page = await pdfDoc.getPage(pageNumber);
          const viewport = page.getViewport({ scale });

          // Clear previous canvas
          canvasContainerRef.current.innerHTML = "";

          // Create canvas
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.border = "1px solid #ccc";
          canvas.style.display = "block";
          canvas.style.margin = "0 auto";

          canvasContainerRef.current.appendChild(canvas);

          // Render page
          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          }).promise;

          // Highlight masked items for current page
          highlightMaskedItems(context, viewport, pageNumber - 1);
        } catch (err) {
          console.error("Error rendering page:", err);
        }
      },
      [pdfDoc, scale, highlightMaskedItems]
    );

    // Render current page when page number or scale changes
    useEffect(() => {
      if (pdfDoc) {
        renderPage(currentPage);
      }
    }, [pdfDoc, currentPage, scale, renderPage]);

    // Find and mask prices
    const maskPrices = useCallback(async () => {
      if (pricesToMask.length === 0) {
        onMaskComplete?.(false);
        return;
      }

      try {
        // Find all text items that match the prices
        const itemsToMask: MaskedItem[] = [];

        pricesToMask.forEach((price) => {
          const trimmedPrice = price.trim();
          if (!trimmedPrice) return;

          textItems.forEach((item) => {
            if (item.text.includes(trimmedPrice)) {
              itemsToMask.push({
                ...item,
                originalText: item.text,
              });
            }
          });
        });

        if (itemsToMask.length === 0) {
          console.log("No price matches found");
          onMaskComplete?.(false);
          return;
        }

        // Set masked items (this will trigger re-render with highlights)
        setMaskedItems(itemsToMask);

        // Re-render current page to show masking
        if (pdfDoc) {
          renderPage(currentPage);
        }

        onMaskComplete?.(true);
        console.log(`Successfully masked ${itemsToMask.length} price items`);
      } catch (error) {
        console.error("Error masking prices:", error);
        onMaskComplete?.(false);
      }
    }, [
      pricesToMask,
      textItems,
      onMaskComplete,
      pdfDoc,
      currentPage,
      renderPage,
    ]);

    // Export PDF
    const exportPdf = useCallback(async () => {
      if (!pdfLibDoc) return;

      try {
        const pdfBytes = await pdfLibDoc.save();
        onExport?.(pdfBytes);
      } catch (error) {
        console.error("Error exporting PDF:", error);
      }
    }, [pdfLibDoc, onExport]);

    // Expose methods to parent component
    useImperativeHandle(
      ref,
      () => ({
        maskPrices,
        exportPdf,
      }),
      [maskPrices, exportPdf]
    );

    // Page navigation
    const goToPage = (pageNumber: number) => {
      if (pageNumber >= 1 && pageNumber <= totalPages) {
        setCurrentPage(pageNumber);
      }
    };

    // Zoom controls
    const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
    const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-2xl mb-2">⏳</div>
            <div className="text-gray-600">Đang tải PDF...</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-red-600">
            <div className="text-2xl mb-2">❌</div>
            <div>Lỗi tải PDF: {error}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="pdf-viewer w-full h-full">
        {/* Controls */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-4">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300">
              ←
            </button>
            <span className="text-sm">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300">
              →
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="px-3 py-1 bg-gray-500 text-white rounded">
              -
            </button>
            <span className="text-sm">{Math.round(scale * 100)}%</span>
            <button
              onClick={zoomIn}
              className="px-3 py-1 bg-gray-500 text-white rounded">
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={maskPrices}
              className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600">
              🔒 Che giá
            </button>
            <button
              onClick={exportPdf}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
              📥 Export
            </button>
          </div>
        </div>

        {/* PDF Canvas Container */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-auto p-4 bg-gray-100"
        />

        {/* Status */}
        {maskedItems.length > 0 && (
          <div className="p-2 bg-green-100 text-green-700 text-sm text-center">
            ✅ Đã che {maskedItems.length} giá trị
          </div>
        )}
      </div>
    );
  }
);

PdfViewer.displayName = "PdfViewer";

export default PdfViewer;
