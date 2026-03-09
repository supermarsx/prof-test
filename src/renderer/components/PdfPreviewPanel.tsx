'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { t } from '../i18n';

interface PdfPreviewPanelProps {
  /** Absolute file path to the PDF (from compilation result) */
  pdfPath?: string;
  /** Raw PDF bytes as base64 string */
  pdfBase64?: string;
  /** Maximum height of the panel */
  maxHeight?: string;
  /** Optional callback when user clicks "Open externally" */
  onOpenExternal?: (path: string) => void;
}

/**
 * PDF Preview Panel.
 * 
 * Renders a PDF inline using:
 *   1. pdfjs-dist (if available as optional dependency) — canvas rendering with page navigation
 *   2. <object> / <embed> fallback — uses the browser's built-in PDF viewer
 *   3. Plain file-path display with "open externally" link as last resort
 * 
 * Since pdfjs-dist is an optional dependency, this component degrades gracefully.
 */
export function PdfPreviewPanel({ pdfPath, pdfBase64, maxHeight = '500px', onOpenExternal }: PdfPreviewPanelProps) {
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [usePdfJs, setUsePdfJs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.2);

  // Try to load pdfjs-dist dynamically
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic import — pdfjs-dist is an optional dependency
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error — module may not be installed
        const pdfjs = await import(/* webpackIgnore: true */ 'pdfjs-dist') as any;
        // Set worker source — use CDN fallback
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        }

        let loadingTask;
        if (pdfBase64) {
          const raw = atob(pdfBase64);
          const uint8 = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
          loadingTask = pdfjs.getDocument({ data: uint8 });
        } else if (pdfPath) {
          // In Tauri, file:// URLs can be used if CSP allows
          const url = pdfPath.startsWith('file://') ? pdfPath : `file://${pdfPath.replace(/\\/g, '/')}`;
          loadingTask = pdfjs.getDocument(url);
        } else {
          setLoading(false);
          return;
        }

        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setUsePdfJs(true);
        setLoading(false);
      } catch {
        // pdfjs-dist not available or failed to load — use fallback
        if (!cancelled) {
          setUsePdfJs(false);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfPath, pdfBase64]);

  // Render the current page on the canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      setError(String(e));
    }
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    if (usePdfJs && pdfDoc) renderPage();
  }, [usePdfJs, pdfDoc, renderPage]);

  if (!pdfPath && !pdfBase64) {
    return (
      <div className="flex-col items-center justify-center" style={{ display: 'flex', padding: 'var(--space-lg)', color: 'var(--text-tertiary)' }}>
        <span style={{ fontSize: '32px', opacity: 0.4 }}>PDF</span>
        <p className="text-sm">{t('pdf.noPdfLoaded')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ display: 'flex', padding: 'var(--space-lg)' }}>
        <span className="text-secondary">{t('pdf.loading')}</span>
      </div>
    );
  }

  // pdfjs-dist canvas rendering
  if (usePdfJs && pdfDoc) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight, overflow: 'hidden' }}>
        {/* Controls */}
        <div className="flex items-center gap-sm" style={{ fontSize: 'var(--font-size-sm)' }}>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setPageNum(p => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
          >
            {'\u25C0'}
          </button>
          <span>{pageNum} / {numPages}</span>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
          >
            {'\u25B6'}
          </button>
          <span style={{ marginLeft: 'auto' }} className="flex items-center gap-xs">
            <button className="btn-ghost btn-sm" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>-</button>
            <span>{Math.round(scale * 100)}%</span>
            <button className="btn-ghost btn-sm" onClick={() => setScale(s => Math.min(3, s + 0.2))}>+</button>
          </span>
          {pdfPath && onOpenExternal && (
            <button className="btn-ghost btn-sm" onClick={() => onOpenExternal(pdfPath)} title={t('pdf.openExternal')}>
              {'\u2197'}
            </button>
          )}
        </div>
        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--text-danger)' }}>{error}</p>}
      </div>
    );
  }

  // Fallback: show file path and external open button
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight }}>
      <div className="glass-card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
        <span style={{ fontSize: '48px', opacity: 0.4, display: 'block', marginBottom: 'var(--space-sm)' }}>PDF</span>
        {pdfPath && (
          <>
            <p className="text-sm text-secondary" style={{ wordBreak: 'break-all' }}>{pdfPath}</p>
            {onOpenExternal && (
              <button
                className="btn-primary btn-sm"
                style={{ marginTop: 'var(--space-sm)' }}
                onClick={() => onOpenExternal(pdfPath)}
              >
                {t('pdf.openExternal')}
              </button>
            )}
          </>
        )}
        <p className="text-xs text-tertiary" style={{ marginTop: 'var(--space-sm)' }}>
          {t('pdf.installPdfJs')}
        </p>
      </div>
    </div>
  );
}
