import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Loader2, ChevronLeft, ChevronRight, Crop } from 'lucide-react';
import { api } from '../api';

export default function PdfTab({ options }) {
  const [files, setFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      setPreviewFile(selectedFiles[0]);
      setCurrentPage(1);
    }
  };

  useEffect(() => {
    if (previewFile) {
      loadPreview();
    }
  }, [previewFile, currentPage]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const info = await api.getPdfInfo(previewFile);
      setPreviewInfo(info);
      const preview = await api.getPdfPreview(previewFile, currentPage);
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
      const blob = await api.convertPdf(files, options);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = files.length === 1 ? `${files[0].name.split('.')[0]}.dxf` : 'converted_files.zip';
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
          <FileText className="text-brand-400" />
          PDF to DXF
        </h2>
        <button 
          onClick={handleConvert}
          disabled={files.length === 0 || converting}
          className="btn-primary flex items-center gap-2 disabled:bg-slate-800"
        >
          {converting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          {converting ? 'Converting...' : 'Convert to DXF'}
        </button>
      </div>

      <div 
        onClick={() => fileInputRef.current.click()}
        className="glass-card p-12 border-dashed border-2 border-slate-700 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-brand-500 hover:bg-white/5 transition-all"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          accept=".pdf" 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <div className="p-4 bg-brand-500/10 rounded-full text-brand-400">
          <Upload size={32} />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">Click or drag PDF files here</p>
          <p className="text-sm text-slate-400">Supports single or batch conversion</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{files.length} file(s) selected</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Preview:</span>
              <select 
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 outline-none"
                value={previewFile?.name}
                onChange={(e) => setPreviewFile(files.find(f => f.name === e.target.value))}
              >
                {files.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="glass-card flex-1 relative flex flex-col items-center justify-center p-4 min-h-0 bg-slate-900">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
                <Loader2 className="animate-spin text-brand-500" size={48} />
              </div>
            )}
            
            {previewImage ? (
              <>
                <img 
                  src={previewImage} 
                  className="max-h-full max-w-full object-contain shadow-2xl rounded" 
                  alt="PDF Preview" 
                />
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 glass px-4 py-2 rounded-full border-white/20">
                  <button 
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="hover:text-brand-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <span className="text-sm font-medium tabular-nums">
                    Page {currentPage} of {previewInfo?.page_count || '?'}
                  </span>
                  <button 
                    disabled={currentPage >= (previewInfo?.page_count || 0)}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="hover:text-brand-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </>
            ) : (
              <p className="text-slate-500 italic">No preview available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
