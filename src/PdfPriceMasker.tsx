import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// 1) Worker PDF.js (sử dụng CDN với version có sẵn)
// pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
/**
 * Component hiển thị PDF và che/mask các chuỗi giá ngay trên text layer
 * - fileUrl: URL tới PDF (vd: "/contract.pdf" trong public/)
 */
export default function PdfPriceMasker({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageScale, setPageScale] = useState(1.1);

  // --- Bộ điều khiển giống SuperDoc demo ---
  const [maskText, setMaskText] = useState("XXXXXX");
  const [patternsText, setPatternsText] = useState(
    [
      "50.000.000",
      "1.200.000",
      "8.500.000",
      "35.000.000",
      "93.500.000",
      "năm mươi triệu đồng",
      "1,2 triệu",
    ].join("\n")
  );
  const [enabled, setEnabled] = useState(true);

  // Parse danh sách chuỗi giá (mỗi dòng 1 pattern)
  const rawPatterns = useMemo(
    () =>
      patternsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [patternsText]
  );

  // Tạo một regex "mềm" cho mỗi pattern:
  // - escape hết ký tự đặc biệt
  // - cho phép dấu . hoặc , linh hoạt giữa các cụm số
  // - không phân biệt hoa thường
  const priceRegex = useMemo(() => {
    if (!rawPatterns.length) return null;

    const toLooseNumberRegex = (s: string) => {
      // Escape regex
      const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Cho phép . hoặc , hoặc khoảng trắng giữa các nhóm số trong chuỗi ban đầu
      // Ví dụ "1.200.000" -> "1[.,\\s]?200[.,\\s]?000"
      const loose = esc.replace(/(\d)[.,\s]+(?=\d)/g, "$1[.,\\s]?");
      return loose;
    };

    const parts = rawPatterns.map((p) => `(${toLooseNumberRegex(p)})`);
    // Kết hợp thành 1 big-regex với "or"
    return new RegExp(parts.join("|"), "giu"); // g: global, i: ignoreCase, u: unicode
  }, [rawPatterns]);

  // Tạo overlay mask elements
  const createMaskOverlays = useCallback(() => {
    if (!enabled || !priceRegex) return;

    // Cleanup overlays cũ trước
    cleanupMaskOverlays();

    // Tìm tất cả text elements trong PDF
    const textElements = document.querySelectorAll(
      ".react-pdf__Page__textContent span"
    );

    textElements.forEach((element) => {
      const text = element.textContent || "";
      if (priceRegex.test(text)) {
        // Tạo mask overlay với relative positioning
        const maskOverlay = document.createElement("div");
        maskOverlay.className = "pdf-mask-overlay";
        maskOverlay.textContent = maskText;

        // Copy style từ element gốc
        const computedStyle = window.getComputedStyle(element);
        maskOverlay.style.cssText = `
          position: absolute;
          background: #000;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${computedStyle.fontSize};
          font-family: ${computedStyle.fontFamily};
          font-weight: ${computedStyle.fontWeight};
          border-radius: 2px;
          z-index: 1000;
          pointer-events: none;
          padding: 1px 3px;
          min-width: ${computedStyle.width || "auto"};
          min-height: ${computedStyle.height || "auto"};
        `;

        // Đặt overlay ngay sau element gốc
        element.parentNode?.insertBefore(maskOverlay, element.nextSibling);

        // Position overlay để che element gốc
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement?.getBoundingClientRect();
        if (parentRect) {
          maskOverlay.style.left = `${rect.left - parentRect.left}px`;
          maskOverlay.style.top = `${rect.top - parentRect.top}px`;
          maskOverlay.style.width = `${rect.width}px`;
          maskOverlay.style.height = `${rect.height}px`;
        }
      }
    });
  }, [enabled, priceRegex, maskText]);

  // Cleanup mask overlays
  const cleanupMaskOverlays = useCallback(() => {
    const overlays = document.querySelectorAll(".pdf-mask-overlay");
    overlays.forEach((overlay) => overlay.remove());
  }, []);

  // Effect để tạo/cleanup overlays
  useEffect(() => {
    if (enabled) {
      // Delay để PDF render xong
      const timer = setTimeout(createMaskOverlays, 1000);

      // Thêm event listeners để update overlays khi scroll/zoom
      const updateOverlays = () => {
        setTimeout(createMaskOverlays, 100);
      };

      window.addEventListener("scroll", updateOverlays);
      window.addEventListener("resize", updateOverlays);

      return () => {
        clearTimeout(timer);
        cleanupMaskOverlays();
        window.removeEventListener("scroll", updateOverlays);
        window.removeEventListener("resize", updateOverlays);
      };
    } else {
      cleanupMaskOverlays();
    }
  }, [enabled, createMaskOverlays, cleanupMaskOverlays]);

  // Effect để update overlays khi scale thay đổi
  useEffect(() => {
    if (enabled) {
      const timer = setTimeout(createMaskOverlays, 200);
      return () => clearTimeout(timer);
    }
  }, [pageScale, enabled, createMaskOverlays]);

  // Hàm render text custom cho mỗi "text item" của PDF.js
  // - Nếu disabled → trả về nguyên văn
  // - Nếu có regex → thay các đoạn match bằng <span class="pdf-mask">
  const customTextRenderer = useCallback(
    (textItem: { str: string }) => {
      const text = textItem.str;
      if (!enabled || !priceRegex) return text;

      // Simple string replacement approach
      return text.replace(priceRegex, maskText);
    },
    [enabled, priceRegex, maskText]
  );

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>PDF Price Masker</h2>

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gap: 10,
          maxWidth: 780,
          gridTemplateColumns: "1fr",
          marginBottom: 12,
        }}
      >
        <label>
          PDF URL:
          <input
            value={fileUrl}
            readOnly
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <label>
          Mask text:
          <input
            value={maskText}
            onChange={(e) => setMaskText(e.target.value)}
            placeholder="XXXXXX"
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <label>
          Price strings / patterns (one per line):
          <textarea
            rows={6}
            value={patternsText}
            onChange={(e) => setPatternsText(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 6,
              fontFamily: "monospace",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setEnabled((v) => !v)}>
            {enabled ? "Disable masking" : "Enable masking"}
          </button>
          <button onClick={() => setPageScale((s) => Math.max(0.6, s - 0.1))}>
            Zoom -
          </button>
          <button onClick={() => setPageScale((s) => Math.min(3, s + 0.1))}>
            Zoom +
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          background: "#fff",
          width: "min(100%, 920px)",
          marginInline: "auto",
          maxHeight: 780,
          overflow: "auto",
        }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={(info) => {
            setNumPages(info.numPages || 0);
            // Tạo overlays sau khi PDF load xong
            setTimeout(createMaskOverlays, 500);
          }}
          onLoadError={(err) => {
            console.error("PDF load error:", err);
            alert("Không load được PDF. Kiểm tra đường dẫn/CORS/MIME.");
          }}
          loading={<div style={{ padding: 24 }}>Loading PDF…</div>}
        >
          {Array.from(new Array(numPages), (_, idx) => (
            <Page
              key={`p_${idx + 1}`}
              pageNumber={idx + 1}
              scale={pageScale}
              renderTextLayer
              renderAnnotationLayer
              customTextRenderer={customTextRenderer}
              loading={<div style={{ padding: 16 }}>Loading page…</div>}
            />
          ))}
        </Document>
      </div>

      {/* Styles cho mask overlays */}
      <style>{`
        .pdf-mask-overlay {
          position: absolute;
          background: #000 !important;
          color: white !important;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 2px;
          z-index: 1000;
          pointer-events: none;
          font-weight: bold;
          box-shadow: 0 0 2px rgba(0,0,0,0.3);
          text-shadow: none;
        }
        
        /* Đảm bảo overlay luôn hiển thị trên PDF */
        .react-pdf__Page {
          position: relative;
        }
        
        .react-pdf__Page__textContent {
          position: relative;
        }
      `}</style>
    </div>
  );
}
