import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import UI from './components/UI';
import PdfTab from './components/PdfTab';
import RasterTab from './components/RasterTab';
import { Layers } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('pdf');
  const [options, setOptions] = useState({
    includeGeom: true,
    includeText: true,
    skipCurves: false,
    minSize: 0,
    pageFrom: 1,
    pageTo: 999,
    cropRect: null
  });

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans text-slate-200">
      {/* Sidebar for options */}
      <Sidebar options={options} setOptions={setOptions} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between bg-slate-900/50 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Layers className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">CAD AI</h1>
              <p className="text-[10px] uppercase tracking-widest text-brand-400 font-bold mt-1">Industrial Intelligence</p>
            </div>
          </div>

          <div className="flex gap-2 p-1 bg-slate-950/50 rounded-lg border border-white/5">
            <button 
              onClick={() => setActiveTab('pdf')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'pdf' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              PDF to DXF
            </button>
            <button 
              onClick={() => setActiveTab('raster')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'raster' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Raster to DXF
            </button>
          </div>
        </header>

        <UI>
          {activeTab === 'pdf' ? (
            <PdfTab options={options} />
          ) : (
            <RasterTab />
          )}
        </UI>
      </div>
    </div>
  );
}
