import React, { useState, useRef, useEffect } from 'react';
import { Upload, ImageIcon, Download, Loader2, Sliders, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { api } from '../api';

export default function RasterTab({ isDark }) {
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [layerName, setLayerName] = useState('RASTER_VECTOR');
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    if (file) loadPreview();
  }, [file, threshold, invert]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const preview = await api.getRasterPreview(file, threshold, invert);
      setPreviewImage(`data:image/png;base64,${preview.image}`);
    } catch (err) {
      console.error('Preview error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!file || converting) return;
    setConverting(true);
    setStatus(null);
    try {
      const blob = await api.convertRaster(file, threshold, invert, layerName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.split('.')[0]}.dxf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', msg: 'Raster converted successfully.' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setConverting(false);
    }
  };

  const setFileFromList = (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imgs.length) { setFile(imgs[0]); setStatus(null); }
  };

  const s = {
    card: {
      background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
      borderRadius: 14,
      overflow: 'hidden',
    },
    btn: (active = true) => ({
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '9px 20px', borderRadius: 9, border: 'none',
      cursor: active ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600,
      background: active ? '#C62828' : (isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'),
      color: active ? '#fff' : (isDark ? '#475569' : '#94a3b8'),
      boxShadow: active ? '0 2px 12px rgba(198,40,40,0.3)' : 'none',
      transition: 'all 0.2s',
    }),
    inputStyle: {
      width: '100%',
      padding: '7px 12px',
      borderRadius: 8,
      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
      background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontSize: 13,
      outline: 'none',
      boxSizing: 'border-box',
    },
    muted: { fontSize: 13, color: isDark ? '#64748b' : '#94a3b8' },
    label: { fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', display: 'block', marginBottom: 6 },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, overflow: 'hidden' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ImageIcon size={20} color="#C62828" />
          Raster to DXF
        </h2>
        <button style={s.btn(!!file && !converting)} onClick={handleConvert} disabled={!file || converting}>
          {converting
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Converting…</>
            : <><Download size={16} /> Convert to DXF</>
          }
        </button>
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
          <button onClick={() => setStatus(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel: upload + controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          {/* Drop Zone */}
          <div
            onClick={() => fileInputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); setFileFromList(e.dataTransfer.files); }}
            style={{
              ...s.card,
              padding: '28px 16px',
              border: `2px dashed ${dragging ? '#C62828' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              cursor: 'pointer',
              background: dragging
                ? (isDark ? 'rgba(198,40,40,0.08)' : 'rgba(198,40,40,0.04)')
                : (isDark ? 'rgba(255,255,255,0.02)' : '#fafafa'),
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            <input type="file" ref={fileInputRef} accept="image/*" onChange={e => setFileFromList(e.target.files)} style={{ display: 'none' }} />
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: isDark ? 'rgba(198,40,40,0.15)' : 'rgba(198,40,40,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={20} color="#C62828" />
            </div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, textAlign: 'center' }}>
              {file ? file.name : 'Click or drag image here'}
            </p>
            <p style={{ margin: 0, ...s.muted, fontSize: 11, textAlign: 'center' }}>PNG, JPG, TIFF, BMP</p>
          </div>

          {/* Vectorization Controls */}
          <div style={{ ...s.card, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#94a3b8' : '#64748b' }}>
              <Sliders size={13} />
              Vectorization Controls
            </div>

            {/* Threshold slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={s.label}>Threshold</span>
                <span style={{ ...s.label, color: '#C62828', fontWeight: 700 }}>{threshold}</span>
              </div>
              <input
                type="range" min="0" max="255" value={threshold}
                onChange={e => setThreshold(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#C62828' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: isDark ? '#475569' : '#cbd5e1' }}>0 (dark)</span>
                <span style={{ fontSize: 10, color: isDark ? '#475569' : '#cbd5e1' }}>255 (light)</span>
              </div>
            </div>

            {/* Invert */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: isDark ? '#cbd5e1' : '#475569', userSelect: 'none' }}>
              <input type="checkbox" checked={invert} onChange={e => setInvert(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#C62828', cursor: 'pointer' }} />
              Invert Image
            </label>

            {/* Layer Name */}
            <div>
              <span style={s.label}>Output Layer Name</span>
              <input type="text" value={layerName} onChange={e => setLayerName(e.target.value)} style={s.inputStyle} />
            </div>
          </div>
        </div>

        {/* Right panel: preview */}
        <div style={{
          ...s.card,
          position: 'relative',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: isDark ? '#475569' : '#94a3b8', flexShrink: 0,
          }}>
            Binarized Preview
          </div>

          <div style={{
            flex: 1, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
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
              ? <img src={previewImage} alt="Binarized Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
              : !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, ...s.muted }}>
                  <ImageIcon size={40} style={{ opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>Upload an image to see preview</p>
                </div>
              )
            }
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}