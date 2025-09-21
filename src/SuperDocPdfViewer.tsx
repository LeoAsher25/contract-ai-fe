import { SuperDoc } from "@harbour-enterprises/superdoc";
import "@harbour-enterprises/superdoc/style.css";
import { useEffect, useRef, useState } from "react";

export default function PdfViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sdocRef = useRef<SuperDoc | null>(null);
  const initOnceRef = useRef(false);
  const [url, setUrl] = useState("/contract.pdf");

  useEffect(() => {
    // Ngăn StrictMode tạo 2 instance
    if (initOnceRef.current) return;
    initOnceRef.current = true;

    if (!containerRef.current) return;

    // Dọn DOM phòng trường hợp có rác từ lần trước
    containerRef.current.innerHTML = "";

    const sdoc = new SuperDoc({
      selector: containerRef.current as any,
      document: { type: "pdf", url },
      documentMode: "viewing",
      pagination: true,
      user: { name: "demo", email: "demo@local" },
      documents: [], // Add required documents property
      onReady: (e) => console.log("SuperDoc ready (PDF)", e),
    });

    sdocRef.current = sdoc;

    return () => {
      try {
        sdocRef.current?.destroy?.();
      } catch {}
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []); // Remove url dependency to prevent re-initialization

  return (
    <div className="p-4 space-y-12">
      <section>
        <h2>PDF Viewer</h2>
        <div style={{ display: "grid", gap: 12, maxWidth: 680 }}>
          <label>
            PDF File:
            <select
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 6 }}
            >
              <option value="/contract.pdf">Contract.pdf</option>
              <option value="/Contract.pdf">Contract.pdf (Capital C)</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <div
          ref={containerRef}
          style={{
            height: 720,
            overflow: "auto",
            margin: "auto",
            border: "1px solid #ddd",
            borderRadius: 8,
            width: "fit-content",
            backgroundColor: "white",
          }}
        />
      </section>
    </div>
  );
}
