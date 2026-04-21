import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, Download, Loader2, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle2, Eye } from 'lucide-react';
import { api } from '../api';
import DxfViewerModal from './DxfViewerModal';

export default function PdfTab({ options, isDark }) {
  const [files, setFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', msg }
  const [dragging, setDragging] = useState(false);

  // ── NEW: viewer state ──────────────────────────────────────────────────────
  const [dxfBlob, setDxfBlob] = useState(null);
  const [dxfFileName, setDxfFileName] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  // ──────────────────────────────────────────────────────────────────────────

  const fileInputRef = useRef();

  const c = {
    card: {
      background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
      borderRadius: 14,
      overflow: 'hidden',
    },
    btn: (active = true) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 20px',
      borderRadius: 9,
      border: 'none',
      cursor: active ? 'pointer' : 'not-allowed',
      fontSize: 13,
      fontWeight: 600,
      background: active ? '#C62828' : (isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'),
      color: active ? '#fff' : (isDark ? '#475569' : '#94a3b8'),
      boxShadow: active ? '0 2px 12px rgba(198,40,40,0.3)' : 'none',
      transition: 'all 0.2s',
      opacity: 1,
    }),
    btnSecondary: (active = true) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 20px',
      borderRadius: 9,
      border: `1px solid ${active ? '#C62828' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}`,
      cursor: active ? 'pointer' : 'not-allowed',
      fontSize: 13,
      fontWeight: 600,
      background: 'transparent',
      color: active ? '#C62828' : (isDark ? '#475569' : '#94a3b8'),
      transition: 'all 0.2s',
    }),
    muted: { fontSize: 13, color: isDark ? '#64748b' : '#94a3b8' },
  };

  const addFiles = useCallback((newFiles) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (!pdfs.length) return;
    setFiles(pdfs);
    setPreviewFile(pdfs[0]);
    setCurrentPage(1);
    setStatus(null);
    // Reset viewer when new files are loaded
    setDxfBlob(null);
    setDxfFileName(null);
    setShowViewer(false);
  }, []);

  useEffect(() => {
    if (previewFile) loadPreview();
  }, [previewFile, currentPage]);

  const loadPreview = async () => {
    setLoading(true);
    setPreviewImage(null);
    try {
      const info = await api.getPdfInfo(previewFile);
      setPreviewInfo(info);
      const preview = await api.getPdfPreview(previewFile, currentPage);
      setPreviewImage(`data:image/png;base64,${preview.image}`);
    } catch (err) {
      console.error('Preview failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── MODIFIED handleConvert: stores blob instead of auto-downloading ────────
  const handleConvert = async () => {
    if (!files.length || converting) return;
    setConverting(true);
    setStatus(null);
    try {
      const blob = await api.convertPdf(files, options);

      const outFileName = files.length === 1
        ? `${files[0].name.replace('.pdf', '')}.dxf`
        : 'converted_files.zip';

      // Store blob for viewer + download
      setDxfBlob(blob);
      setDxfFileName(outFileName);

      // Auto-open viewer popup (single DXF only — zip can't be viewed)
      if (files.length === 1) {
        setTimeout(() => setShowViewer(true), 100);
      }

      setStatus({ type: 'success', msg: `Converted ${files.length} file(s) successfully.` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setConverting(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  // Download helper — same as before
  const handleDownload = () => {
    if (!dxfBlob) return;
    const url = URL.createObjectURL(dxfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dxfFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, overflow: 'hidden' }}>

      {/* CAD Viewer Modal */}
      {showViewer && dxfBlob && (
        <DxfViewerModal
          dxfBlob={dxfBlob}
          fileName={dxfFileName}
          isDark={isDark}
          onClose={() => setShowViewer(false)}
        />
      )}

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={20} color="#C62828" />
          PDF to DXF
        </h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* View in CAD Viewer button — only shows after conversion */}
          {dxfBlob && files.length === 1 && (
            <button
              style={c.btnSecondary(true)}
              onClick={() => setShowViewer(true)}
            >
              <Eye size={16} /> View in CAD Viewer
            </button>
          )}
          {/* Download button — only shows after conversion */}
          {dxfBlob && (
            <button style={c.btn(true)} onClick={handleDownload}>
              <Download size={16} /> Download DXF
            </button>
          )}
          {/* Convert button */}
          <button
            style={c.btn(files.length > 0 && !converting)}
            onClick={handleConvert}
            disabled={files.length === 0 || converting}
          >
            {converting
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Converting…</>
              : <><Download size={16} /> Convert to DXF</>
            }
          </button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          borderRadius: 10, flexShrink: 0,
          background: status.type === 'success'
            ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.1)')
            : (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)'),
          border: `1px solid ${status.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: 13,
          color: status.type === 'success' ? '#22c55e' : '#ef4444',
        }}>
          {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {status.msg}
          {/* Quick "View" link inside the status banner */}
          {status.type === 'success' && dxfBlob && files.length === 1 && (
            <button
              onClick={() => setShowViewer(true)}
              style={{
                background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
                color: '#22c55e', borderRadius: 6, padding: '3px 10px',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 4,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <Eye size={12} /> View DXF
            </button>
          )}
          <button onClick={() => setStatus(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          ...c.card,
          padding: '36px 24px',
          border: `2px dashed ${dragging ? '#C62828' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          cursor: 'pointer',
          background: dragging
            ? (isDark ? 'rgba(198,40,40,0.08)' : 'rgba(198,40,40,0.04)')
            : (isDark ? 'rgba(255,255,255,0.02)' : '#fafafa'),
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        <input type="file" ref={fileInputRef} multiple accept=".pdf" onChange={e => addFiles(e.target.files)} className="hidden" style={{ display: 'none' }} />
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: isDark ? 'rgba(198,40,40,0.15)' : 'rgba(198,40,40,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Upload size={24} color="#C62828" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
            {files.length > 0 ? `${files.length} file(s) selected` : 'Click or drag PDF files here'}
          </p>
          <p style={{ margin: '4px 0 0', ...c.muted }}>Supports single or batch conversion</p>
        </div>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 }}>
            {files.map(f => (
              <span key={f.name} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20,
                background: isDark ? 'rgba(198,40,40,0.2)' : 'rgba(198,40,40,0.1)',
                color: '#C62828', fontWeight: 600,
              }}>{f.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Preview Panel */}
      {files.length > 0 && (
        <div style={{ ...c.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 320 }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Preview
            </span>
            {files.length > 1 && (
              <select
                value={previewFile?.name}
                onChange={e => { setPreviewFile(files.find(f => f.name === e.target.value)); setCurrentPage(1); }}
                style={{
                  fontSize: 12, padding: '4px 8px', borderRadius: 7,
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  outline: 'none',
                }}
              >
                {files.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            )}
          </div>

          <div style={{
            flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDark ? 'rgba(11,14,26,0.6)' : 'rgba(244,245,249,0.7)',
                backdropFilter: 'blur(4px)',
              }}>
                <Loader2 size={40} color="#C62828" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}
            {previewImage
              ? <img src={previewImage} alt="PDF Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
              : !loading && <p style={c.muted}>No preview available</p>
            }

            {previewInfo && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '7px 18px', borderRadius: 999,
                background: isDark ? 'rgba(11,14,26,0.85)' : 'rgba(255,255,255,0.9)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}>
                <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1}
                  style={{ background: 'none', border: 'none', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.3 : 1, color: isDark ? '#e2e8f0' : '#1e293b', display: 'flex' }}>
                  <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'center' }}>
                  Page {currentPage} / {previewInfo.page_count}
                </span>
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= previewInfo.page_count}
                  style={{ background: 'none', border: 'none', cursor: currentPage >= previewInfo.page_count ? 'not-allowed' : 'pointer', opacity: currentPage >= previewInfo.page_count ? 0.3 : 1, color: isDark ? '#e2e8f0' : '#1e293b', display: 'flex' }}>
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}