import React from 'react';
import { Settings, FileType, Filter, Layers, Scissors } from 'lucide-react';

export default function Sidebar({ options, setOptions, isDark }) {
  const handle = (key, value) => setOptions(prev => ({ ...prev, [key]: value }));

  const s = {
    sidebar: {
      width: 272,
      borderRight: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
      padding: '28px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
      height: '100%',
      overflowY: 'auto',
      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)',
      flexShrink: 0,
    },
    sectionLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: '#C62828',
      marginBottom: 4,
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
      fontSize: 13,
      color: isDark ? '#cbd5e1' : '#475569',
      userSelect: 'none',
    },
    inputLabel: {
      fontSize: 11,
      color: isDark ? '#64748b' : '#94a3b8',
      marginBottom: 6,
      display: 'block',
    },
    input: {
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
    checkbox: {
      width: 16,
      height: 16,
      accentColor: '#C62828',
      cursor: 'pointer',
    },
    muted: {
      fontSize: 12,
      color: isDark ? '#475569' : '#94a3b8',
      lineHeight: 1.6,
    },
  };

  return (
    <div style={s.sidebar}>
      <div style={s.sectionLabel}>
        <Settings size={13} />
        <span>Extraction Settings</span>
      </div>

      {/* Content Type */}
      <section>
        <div style={{ ...s.sectionLabel, color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}>
          <FileType size={13} />
          <span>Content Type</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 4 }}>
          {[
            { key: 'includeGeom', label: 'Include Geometry' },
            { key: 'includeText', label: 'Include Text' },
          ].map(({ key, label }) => (
            <label key={key} style={s.label}>
              <input
                type="checkbox"
                style={s.checkbox}
                checked={options[key]}
                onChange={e => handle(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section>
        <div style={{ ...s.sectionLabel, color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}>
          <Filter size={13} />
          <span>Filters</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 4 }}>
          <label style={s.label}>
            <input
              type="checkbox"
              style={s.checkbox}
              checked={options.skipCurves}
              onChange={e => handle('skipCurves', e.target.checked)}
            />
            Skip Curves (Bezier)
          </label>
          <div>
            <span style={s.inputLabel}>Min Geometry Size (pts)</span>
            <input
              type="number"
              value={options.minSize}
              onChange={e => handle('minSize', parseFloat(e.target.value) || 0)}
              style={s.input}
            />
          </div>
        </div>
      </section>

      {/* Page Range */}
      <section>
        <div style={{ ...s.sectionLabel, color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}>
          <Layers size={13} />
          <span>Page Range</span>
        </div>
        <div style={{ paddingLeft: 4 }}>
          <label style={{ ...s.label, marginBottom: 10 }}>
            <input
              type="checkbox"
              style={s.checkbox}
              checked={options.processAllPages}
              onChange={e => handle('processAllPages', e.target.checked)}
            />
            Process all pages
          </label>
          {!options.processAllPages && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'pageFrom', label: 'From' },
                { key: 'pageTo', label: 'To' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <span style={s.inputLabel}>{label}</span>
                  <input
                    type="number"
                    value={options[key]}
                    onChange={e => handle(key, parseInt(e.target.value) || 1)}
                    style={s.input}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Region Control */}
      <section>
        <div style={{ ...s.sectionLabel, color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}>
          <Scissors size={13} />
          <span>Region Control</span>
        </div>
        <p style={{ ...s.muted, paddingLeft: 4 }}>
          Enable crop in the preview panel to define a specific area for extraction.
        </p>
      </section>
    </div>
  );
}