import React from 'react';

export default function UI({ children, isDark }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      height: '100%',
      overflow: 'hidden',
      background: isDark ? '#0b0e1a' : '#f4f5f9',
    }}>
      <main style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </main>

      <footer style={{
        padding: '12px 32px',
        borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.07)',
        background: isDark ? 'rgba(11,14,26,0.6)' : 'rgba(255,255,255,0.6)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: isDark ? '#475569' : '#94a3b8',
        flexShrink: 0,
      }}>
        <span>Powered by <strong style={{ color: isDark ? '#64748b' : '#64748b' }}>PyMuPDF</strong> & <strong style={{ color: isDark ? '#64748b' : '#64748b' }}>ezdxf</strong></span>
        <div style={{ display: 'flex', gap: 16 }}>
          {['Help', 'Privacy', 'Terms'].map(link => (
            <span key={link} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = '#C62828'}
              onMouseLeave={e => e.target.style.color = isDark ? '#475569' : '#94a3b8'}
            >{link}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}