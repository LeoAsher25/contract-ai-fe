import { SuperDoc } from "@harbour-enterprises/superdoc";
import "@harbour-enterprises/superdoc/style.css";
import { useEffect, useRef, useState } from "react";

// Add custom CSS for highlights
const highlightStyles = `
  .highlight-yellow {
    background-color: #000 !important;
    color: #000 !important;
  }
  .highlight-price {
    background-color: #000 !important;
    padding: 2px 4px !important;
    border-radius: 3px !important;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = highlightStyles;
  document.head.appendChild(styleSheet);
}

type SearchResult = { from: number; to: number; text?: string };

const DEFAULT_MASK = "mask info";

// No HTML wrapping for mask; insert plain text and apply highlight via commands

// Default price strings to search for
const DEFAULT_PRICES = [
  "50.000.000",
  "1.200.000",
  "8.500.000",
  "35.000.000",
  "93.500.000",
  "năm mươi triệu đồng",
  "1,2 triệu",
];

export default function SuperDocReplaceDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const superdocRef = useRef<SuperDoc | null>(null);

  const [maskText, setMaskText] = useState(DEFAULT_MASK);
  const [pricesText, setPricesText] = useState<string>(() =>
    DEFAULT_PRICES.join("\n")
  );
  const [reloadKey, setReloadKey] = useState(0); // để reset editor
  const [documentPath, setDocumentPath] = useState<string>("/contract.docx");

  useEffect(() => {
    if (!containerRef.current) return;

    const isPdf = documentPath.toLowerCase().endsWith(".pdf");

    const sdoc = new SuperDoc({
      selector: containerRef.current as any,
      // ...(isPdf
      //   ? {
      //       document: { type: "pdf", url: documentPath },
      //       format: "pdf",
      //       documentMode: "viewing",
      //       // pdfWorkerSrc: "pdfjs-dist/build/pdf.worker.min.mjs",
      //     }
      //   : {
      //       document: { type: "docx", url: documentPath },
      //       format: "docx",
      //       documentMode: "editing",
      //     }),
      document: { type: "pdf", url: "/contract.pdf" },
      format: "pdf",
      documentMode: "viewing",

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
      onPdfDocumentReady: () => {
        console.log("PDF document is ready");
      },
    });

    superdocRef.current = sdoc;

    return () => {
      // dọn dẹp instance khi unmount
      superdocRef.current?.destroy?.();
      superdocRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [reloadKey, documentPath]);

  // Parse price strings from textarea (one per line)
  const parsePrices = (): string[] => {
    return pricesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  };

  const handleHighlight = () => {
    const sdoc = superdocRef.current;
    if (!sdoc) return;

    const editor = sdoc.activeEditor;
    if (!editor) return;

    const prices = parsePrices();
    const allMatches: SearchResult[] = prices.flatMap((price) => {
      const results = sdoc.search(price) as SearchResult[];
      return results || [];
    });

    if (!allMatches.length) return;

    const uniq = new Map<string, SearchResult>();
    for (const m of allMatches) uniq.set(`${m.from}-${m.to}`, m);
    const matches = Array.from(uniq.values());

    matches.forEach((match) => {
      try {
        sdoc.goToSearchResult(match);
        if (editor.commands?.setHighlight) {
          editor.commands.setHighlight({ color: "#000" });
        } else if (editor.commands?.toggleHighlight) {
          editor.commands.toggleHighlight({ color: "#000" });
        } else if (editor.commands?.setMark) {
          editor.commands.setMark("highlight", { color: "#000" });
        }
      } catch {}
    });
  };

  // Alternative replace method - simpler approach
  const handleMaskAll = () => {
    const sdoc = superdocRef.current;
    if (!sdoc) return;

    const editor = sdoc.activeEditor;
    if (!editor) return;

    const prices = parsePrices();
    console.log("Simple replace - searching for prices:", prices);

    // Find all matches for each price string
    const allMatches: SearchResult[] = prices.flatMap((price) => {
      const results = sdoc.search(price) as SearchResult[];
      console.log(`Found ${results?.length || 0} matches for "${price}"`);
      return results || [];
    });

    if (allMatches.length === 0) {
      console.log("No matches found to replace");
      return;
    }

    // Remove duplicates and sort by position (descending to avoid index shifting)
    const uniq = new Map<string, SearchResult>();
    for (const match of allMatches) {
      uniq.set(`${match.from}-${match.to}`, match);
    }
    const matches = Array.from(uniq.values()).sort((a, b) => b.from - a.from);

    console.log(`Simple replace: ${matches.length} unique matches`);

    // Simple approach: replace one by one without timing issues
    let processedCount = 0;
    const processNextMatch = () => {
      if (processedCount >= matches.length) {
        console.log("All matches processed!");
        return;
      }

      const match = matches[processedCount];
      console.log(
        `Processing match ${processedCount + 1}/${matches.length}:`,
        match
      );

      try {
        // Go to the search result
        sdoc.goToSearchResult(match);

        // Try to replace immediately
        if (
          editor.commands &&
          editor.commands.deleteSelection &&
          editor.commands.insertContent
        ) {
          // Apply highlight first so insertion inherits the mark
          if (editor.commands.setHighlight) {
            editor.commands.setHighlight("#000");
          } else if (editor.commands.toggleHighlight) {
            editor.commands.toggleHighlight("#000");
          } else if (editor.commands.setMark) {
            editor.commands.setMark("highlight", "#000");
          }
          editor.commands.deleteSelection();
          editor.commands.insertContent(maskText);
          console.log(
            `✓ Replaced match ${processedCount + 1} with "${maskText}"`
          );
        } else if (editor.commands && editor.commands.insertContent) {
          // Apply highlight first, then insert so it inherits highlight
          if (editor.commands.setHighlight) {
            editor.commands.setHighlight("#000");
          } else if (editor.commands.toggleHighlight) {
            editor.commands.toggleHighlight("#000");
          } else if (editor.commands.setMark) {
            editor.commands.setMark("highlight", "#000");
          }
          editor.commands.insertContent(maskText);
          console.log(
            `✓ Inserted "${maskText}" for match ${processedCount + 1}`
          );
        }

        processedCount++;

        // Process next match after a short delay
        setTimeout(processNextMatch, 200);
      } catch (error) {
        console.error(`Error processing match ${processedCount + 1}:`, error);
        processedCount++;
        setTimeout(processNextMatch, 200);
      }
    };

    // Start processing
    processNextMatch();
  };

  return (
    <div className="p-4 space-y-12">
      <section>
        <h2>Controls</h2>
        <div style={{ display: "grid", gap: 12, maxWidth: 680 }}>
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
            Price strings to mask (one per line):
            <textarea
              rows={6}
              value={pricesText}
              onChange={(e) => setPricesText(e.target.value)}
              placeholder="Enter price strings to search for..."
              style={{
                width: "100%",
                padding: 8,
                marginTop: 6,
                fontFamily: "monospace",
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            <button
              onClick={() => {
                setDocumentPath("/contract.docx");
                setReloadKey((k) => k + 1);
              }}
            >
              Show DOCX
            </button>
            <button
              onClick={handleHighlight}
              disabled={documentPath.toLowerCase().endsWith(".pdf")}
              title={
                documentPath.toLowerCase().endsWith(".pdf")
                  ? "Highlight is available in DOCX mode only"
                  : undefined
              }
              style={{ backgroundColor: "#ffff00", color: "#000" }}
            >
              Highlight prices
            </button>
            <button
              onClick={() => {
                setDocumentPath("/contract.pdf");
                setReloadKey((k) => k + 1);
              }}
            >
              Show PDF
            </button>
            <button
              onClick={handleMaskAll}
              style={{ backgroundColor: "#e6f3ff", color: "#000" }}
              disabled={documentPath.toLowerCase().endsWith(".pdf")}
              title={
                documentPath.toLowerCase().endsWith(".pdf")
                  ? "Masking is available in DOCX mode only"
                  : undefined
              }
            >
              Mask prices
            </button>
          </div>
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
          }}
        />
      </section>
    </div>
  );
}
