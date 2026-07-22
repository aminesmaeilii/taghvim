import { ChevronLeft, ChevronRight, Highlighter, StickyNote, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import * as pdfjsLib from "pdfjs-dist";
import { TextLayer, type PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PageHeader } from "../../components/app-shell";
import { EmptyState, IconButton } from "../../components/ui";
import { useAuth } from "../../hooks/use-auth-context";
import { useWorkspace, workspaceKey } from "../../hooks/use-workspace";
import { contentRepository } from "../../services/content-repository";
import { useUIStore } from "../../stores/ui-store";
import type { Highlight, HighlightRect, WorkspaceData } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#93c5fd", "#fca5a5"];

interface PendingSelection { quote: string; rects: HighlightRect[]; }

export function PdfReaderPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useUIStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState("");

  const material = workspace.data?.learningMaterials.find((item) => item.id === materialId);

  useEffect(() => {
    if (!material) return;
    let cancelled = false;
    setError("");
    const task = pdfjsLib.getDocument({ url: material.blobUrl });
    task.promise.then((doc) => { if (cancelled) return; setPdf(doc); setPageCount(doc.numPages); }).catch(() => { if (!cancelled) setError("خواندن فایل PDF ممکن نشد."); });
    return () => { cancelled = true; void task.destroy(); };
  }, [material]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;
    let cancelled = false;
    void pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled || !canvasRef.current || !textLayerRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      const textLayerDiv = textLayerRef.current;
      textLayerDiv.innerHTML = "";
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      const textContent = await page.getTextContent();
      if (cancelled) return;
      await new TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport }).render();
    });
    return () => { cancelled = true; };
  }, [pdf, pageNumber, scale]);

  if (workspace.isLoading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!workspace.data || !material) return <div className="page"><EmptyState title="فایل پیدا نشد" description="این فایل آموزشی حذف شده یا در دسترس نیست." /></div>;

  const highlights = workspace.data.highlights.filter((item) => item.materialId === material.id && item.userId === user?.id);
  const pageHighlights = highlights.filter((item) => item.page === pageNumber);

  const patchHighlights = (updater: (list: Highlight[]) => Highlight[]) => {
    queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, highlights: updater(current.highlights) } : current);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) return;
    const text = selection.toString().trim();
    if (!text) return;
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0).map((rect) => ({
      top: (rect.top - containerRect.top) / containerRect.height,
      left: (rect.left - containerRect.left) / containerRect.width,
      width: rect.width / containerRect.width,
      height: rect.height / containerRect.height,
    }));
    if (!rects.length) return;
    setPending({ quote: text, rects });
    setNoteDraft("");
  };

  const saveHighlight = async (color: string) => {
    if (!pending || !user) return;
    try {
      const saved = await contentRepository.saveHighlight({ materialId: material.id, userId: user.id, page: pageNumber, rects: pending.rects, color, quote: pending.quote, note: noteDraft.trim() || null });
      patchHighlights((list) => [...list, saved]);
      setPending(null);
      window.getSelection()?.removeAllRanges();
      pushToast({ title: "هایلایت ثبت شد." });
    } catch { pushToast({ title: "ثبت هایلایت ممکن نشد." }); }
  };

  const removeHighlight = async (highlight: Highlight) => {
    await contentRepository.deleteHighlight(highlight.id);
    patchHighlights((list) => list.filter((item) => item.id !== highlight.id));
  };

  return <div className="page pdf-reader-page">
    <PageHeader title={material.title} description="متن را انتخاب کنید تا هایلایت یا یادداشت اضافه کنید." actions={<IconButton label="بازگشت به آموزش" onClick={() => navigate("/education")}><X size={18} /></IconButton>} />
    {error ? <EmptyState title="خطا در بازکردن فایل" description={error} /> : <div className="pdf-reader-layout">
      <section className="surface pdf-reader-toolbar">
        <IconButton label="صفحه قبل" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)}><ChevronRight size={18} /></IconButton>
        <span>صفحه {pageNumber.toLocaleString("fa-IR")} از {pageCount.toLocaleString("fa-IR")}</span>
        <IconButton label="صفحه بعد" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((value) => value + 1)}><ChevronLeft size={18} /></IconButton>
        <span className="pdf-reader-toolbar-gap" />
        <IconButton label="کوچک نمایی" onClick={() => setScale((value) => Math.max(0.6, value - 0.2))}><ZoomOut size={18} /></IconButton>
        <IconButton label="بزرگ نمایی" onClick={() => setScale((value) => Math.min(2.4, value + 0.2))}><ZoomIn size={18} /></IconButton>
      </section>
      <div className="pdf-reader-body">
        <div className="pdf-page-container" ref={containerRef} onMouseUp={handleMouseUp}>
          <canvas ref={canvasRef} />
          <div className="pdf-text-layer" ref={textLayerRef} />
          {pageHighlights.map((highlight) => <div key={highlight.id} className="pdf-highlight-group">{highlight.rects.map((rect, index) => <span key={index} className="pdf-highlight-rect" style={{ top: `${rect.top * 100}%`, left: `${rect.left * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, backgroundColor: highlight.color }} title={highlight.note ?? undefined} />)}</div>)}
          {pending && <div className="pdf-highlight-popover" style={{ top: `${(pending.rects[0].top + pending.rects[0].height) * 100}%`, left: `${pending.rects[0].left * 100}%` }}>
            <div className="pdf-highlight-colors">{HIGHLIGHT_COLORS.map((color) => <button key={color} type="button" style={{ backgroundColor: color }} aria-label="ثبت هایلایت" onClick={() => void saveHighlight(color)} />)}</div>
            <input className="input" placeholder="یادداشت اختیاری برای این هایلایت" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
            <button type="button" className="pdf-highlight-cancel" onClick={() => setPending(null)}>انصراف</button>
          </div>}
        </div>
        <aside className="surface pdf-highlight-panel">
          <header><Highlighter size={17} /><h2>هایلایت ها و یادداشت های من</h2></header>
          {highlights.length ? <div className="pdf-highlight-list">{highlights.sort((a, b) => a.page - b.page).map((highlight) => <div key={highlight.id} className="pdf-highlight-item">
            <button type="button" onClick={() => setPageNumber(highlight.page)}><span className="pdf-highlight-dot" style={{ backgroundColor: highlight.color }} /><div><strong>صفحه {highlight.page.toLocaleString("fa-IR")}</strong><p>{highlight.quote}</p>{highlight.note && <small><StickyNote size={11} /> {highlight.note}</small>}<small className="pdf-highlight-date">{formatJalaliDate(highlight.createdAt)}</small></div></button>
            <button type="button" className="pdf-highlight-remove" aria-label="حذف هایلایت" onClick={() => void removeHighlight(highlight)}><Trash2 size={14} /></button>
          </div>)}</div> : <p className="form-hint">با انتخاب بخشی از متن، اولین هایلایت خود را ثبت کنید.</p>}
        </aside>
      </div>
    </div>}
  </div>;
}
