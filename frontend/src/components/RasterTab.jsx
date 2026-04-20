import React, { useState, useRef, useEffect } from 'react';
import { Upload, ImageIcon, Download, Loader2, Sliders } from 'lucide-react';
import { api } from '../api';

export default function RasterTab() {
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [layerName, setLayerName] = useState('RASTER_VECTOR');
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    if (file) {
      loadPreview();
    }
  }, [file, threshold, invert]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const preview = await api.getRasterPreview(file, threshold, invert);
      setPreviewImage(`data:image/png;base64,${preview.image}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const blob = await api.convertRaster(file, threshold, invert, layerName);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.split('.')[0]}.dxf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Conversion failed: ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ImageIcon className="text-brand-400" />
          Raster to DXF
        </h2>
        <button 
          onClick={handleConvert}
          disabled={!file || converting}
          className="btn-primary flex items-center gap-2 disabled:bg-slate-800"
        >
          {converting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          {converting ? 'Converting...' : 'Convert to DXF'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
        <div className="md:col-span-1 flex flex-col gap-6">
          <div 
            onClick={() => fileInputRef.current.click()}
            className="glass-card p-8 border-dashed border-2 border-slate-700 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-brand-500 hover:bg-white/5 transition-all"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={(e) => setFile(e.target.files[0])} 
              className="hidden" 
            />
            <div className="p-3 bg-brand-500/10 rounded-full text-brand-400">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{file ? file.name : 'Select raster image'}</p>
            </div>
          </div>

          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Sliders size={16} />
              <span>Vectorization Controls</span>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Threshold: {threshold}</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="255" 
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={invert}
                  onChange={e => setInvert(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm group-hover:text-white transition-colors">Invert Image</span>
              </label>

              <div className="space-y-2">
                <span className="text-xs text-slate-400">Output Layer Name</span>
                <input 
                  type="text" 
                  value={layerName}
                  onChange={e => setLayerName(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 glass-card relative flex flex-col items-center justify-center p-4 min-h-0 bg-slate-900">
          <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/50 backdrop-blur rounded-full text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Binarized Preview
          </div>
          
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
              <Loader2 className="animate-spin text-brand-500" size={48} />
            </div>
          )}
          
          {previewImage ? (
            <img 
              src={previewImage} 
              className="max-h-full max-w-full object-contain shadow-2xl rounded" 
              alt="Raster Preview" 
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500 italic">
              <p>Upload an image to see preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
