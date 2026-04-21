import { useCallback, useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { AcApDocManager } from '@mlightcad/cad-simple-viewer';

export default function DxfViewerModal({ dxfBlob, fileName, onClose }) {
    const [error, setError] = useState(null);
    const cleanupRef = useRef(null);

    const setContainerRef = useCallback((container) => {
        if (!container || !dxfBlob) return;
        let cancelled = false;

        async function loadDxf() {
            try {
                try { if (AcApDocManager.instance) AcApDocManager.instance.destroy(); } catch (_) { }
                if (cancelled) return;

                // Give the DOM time to paint and get real dimensions
                await new Promise(r => setTimeout(r, 100));
                if (cancelled) return;

                const rect = container.getBoundingClientRect();
                console.log('container rect:', rect.width, rect.height);

                // Set explicit pixel size on container so library can read it
                container.style.width = rect.width + 'px';
                container.style.height = rect.height + 'px';

                // Pass the container div directly — library creates its own canvas inside
                AcApDocManager.createInstance(container);
                if (cancelled) return;

                const arrayBuffer = await dxfBlob.arrayBuffer();
                if (cancelled) return;

                const ok = await AcApDocManager.instance.openDocument(
                    fileName || 'output.dxf',
                    arrayBuffer,
                    { minimumChunkSize: 1000, mode: 0 }
                );
                console.log('openDocument:', ok);

                if (ok) {
                    try { AcApDocManager.instance.curView?.zoomExtents?.(); } catch (_) { }
                } else {
                    setError('File loaded but nothing to render.');
                }
            } catch (err) {
                console.error('Viewer error:', err);
                setError(err.message || 'Unknown error');
            }
        }

        loadDxf();
        cleanupRef.current = () => {
            cancelled = true;
            try { AcApDocManager.instance.destroy(); } catch (_) { }
        };
    }, [dxfBlob, fileName]);

    const handleClose = useCallback(() => {
        cleanupRef.current?.();
        onClose();
    }, [onClose]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            <div style={{
                width: '92vw', height: '88vh',
                background: '#111827', borderRadius: 12,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                border: '1px solid rgba(255,255,255,0.1)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    background: 'rgba(198,40,40,0.18)',
                    borderBottom: '1px solid rgba(198,40,40,0.35)',
                    flexShrink: 0,
                }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                        📐 CAD Viewer — {fileName}
                    </span>
                    <button onClick={handleClose} style={{
                        background: 'rgba(198,40,40,0.35)', border: '1px solid rgba(198,40,40,0.55)',
                        color: '#fff', borderRadius: 8, padding: '6px 16px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 13, fontWeight: 600,
                    }}>
                        <X size={14} /> Close
                    </button>
                </div>

                {/* Viewer container — library attaches its canvas here */}
                <div
                    ref={setContainerRef}
                    style={{
                        flex: 1, position: 'relative',
                        background: '#0d1117',
                        overflow: 'hidden',
                    }}
                >
                    {error && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 14,
                            background: '#0d1117', padding: 40, textAlign: 'center',
                        }}>
                            <AlertCircle size={40} color="#ef4444" />
                            <span style={{ color: '#ef4444', fontSize: 15, fontWeight: 600 }}>Viewer Error</span>
                            <span style={{ color: '#94a3b8', fontSize: 13, maxWidth: 480 }}>{error}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}