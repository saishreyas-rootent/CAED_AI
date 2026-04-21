import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import UI from './components/UI';
import PdfTab from './components/PdfTab';
import RasterTab from './components/RasterTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('pdf');
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [options, setOptions] = useState({
    includeGeom: true,
    includeText: true,
    skipCurves: false,
    minSize: 0,
    processAllPages: true,
    pageFrom: 1,
    pageTo: 999,
    cropRect: null,
  });

  const isDark = theme === 'dark';

  return (
    <div className={isDark ? 'dark' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          fontFamily: "'DM Sans', 'Outfit', sans-serif",
          background: isDark ? '#0b0e1a' : '#f4f5f9',
          color: isDark ? '#e2e8f0' : '#1e293b',
          transition: 'background 0.3s, color 0.3s',
        }}
      >
        <Sidebar options={options} setOptions={setOptions} isDark={isDark} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <header style={{
            height: 64,
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? 'rgba(11,14,26,0.85)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 20,
            flexShrink: 0,
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="110" height="32" viewBox="0 0 440 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Rootent wordmark recreated as SVG text in the brand red */}
                <text
                  x="0" y="100"
                  fontFamily="'DM Sans', Arial Black, sans-serif"
                  fontWeight="900"
                  fontSize="110"
                  fill="#C62828"
                  letterSpacing="-3"
                >
                  rootent
                </text>
              </svg>
              <div style={{
                width: 1,
                height: 28,
                background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                margin: '0 4px',
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1 }}>
                  CAD AI
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', color: '#C62828', textTransform: 'uppercase', marginTop: 3 }}>
                  Industrial Intelligence
                </div>
              </div>
            </div>

            {/* Right side: Tabs + Theme toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Tabs */}
              <div style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
                borderRadius: 10,
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
              }}>
                {[{ id: 'pdf', label: 'PDF → DXF' }, { id: 'raster', label: 'Raster → DXF' }].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 7,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      background: activeTab === tab.id ? '#C62828' : 'transparent',
                      color: activeTab === tab.id ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                      boxShadow: activeTab === tab.id ? '0 2px 8px rgba(198,40,40,0.35)' : 'none',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Theme toggle */}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  transition: 'all 0.2s',
                  color: isDark ? '#f1c40f' : '#475569',
                }}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>
          </header>

          <UI isDark={isDark}>
            {activeTab === 'pdf'
              ? <PdfTab options={options} isDark={isDark} />
              : <RasterTab isDark={isDark} />
            }
          </UI>
        </div>
      </div>
    </div>
  );
}