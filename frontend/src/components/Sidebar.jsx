import React from 'react';
import { Settings, FileType, Filter, Layers, Scissors } from 'lucide-react';

export default function Sidebar({ options, setOptions }) {
  const handleChange = (key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-80 border-r border-white/10 p-6 flex flex-col gap-8 h-full bg-slate-900/50">
      <div className="flex items-center gap-2 text-brand-400 font-semibold uppercase tracking-wider text-xs">
        <Settings size={16} />
        <span>Extraction Settings</span>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <FileType size={16} />
          <span>Content Type</span>
        </div>
        <div className="space-y-2 px-1">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={options.includeGeom}
              onChange={e => handleChange('includeGeom', e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm group-hover:text-white transition-colors">Include Geometry</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={options.includeText}
              onChange={e => handleChange('includeText', e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm group-hover:text-white transition-colors">Include Text</span>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Filter size={16} />
          <span>Filters</span>
        </div>
        <div className="space-y-4 px-1">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={options.skipCurves}
              onChange={e => handleChange('skipCurves', e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm group-hover:text-white transition-colors">Skip Curves (Bezier)</span>
          </label>
          <div className="space-y-2">
            <span className="text-xs text-slate-400">Min Geometry Size (pts)</span>
            <input 
              type="number" 
              value={options.minSize}
              onChange={e => handleChange('minSize', parseFloat(e.target.value) || 0)}
              className="w-full"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Layers size={16} />
          <span>Page Range</span>
        </div>
        <div className="grid grid-cols-2 gap-4 px-1">
          <div className="space-y-2">
            <span className="text-xs text-slate-400">From</span>
            <input 
              type="number" 
              value={options.pageFrom}
              onChange={e => handleChange('pageFrom', parseInt(e.target.value) || 1)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <span className="text-xs text-slate-400">To</span>
            <input 
              type="number" 
              value={options.pageTo}
              onChange={e => handleChange('pageTo', parseInt(e.target.value) || 999)}
              className="w-full"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Scissors size={16} />
          <span>Region Control</span>
        </div>
        <div className="px-1">
          <p className="text-xs text-slate-400 leading-relaxed">
            Enable crop in the preview window to define a specific area for extraction.
          </p>
        </div>
      </section>
    </div>
  );
}
