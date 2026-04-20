import React from 'react';

export default function UI({ children }) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950">
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto h-full">
          {children}
        </div>
      </main>
      
      <footer className="px-8 py-4 border-t border-white/5 bg-slate-900/30 flex justify-between items-center text-xs text-slate-500">
        <div>Powered by PyMuPDF & Ezdxf</div>
        <div className="flex gap-4">
          <span className="hover:text-slate-300 transition-colors cursor-pointer">Help</span>
          <span className="hover:text-slate-300 transition-colors cursor-pointer">Privacy</span>
          <span className="hover:text-slate-300 transition-colors cursor-pointer">Terms</span>
        </div>
      </footer>
    </div>
  );
}
