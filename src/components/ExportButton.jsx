import { useState } from 'react';

export default function ExportButton({ country }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const mapEl = document.querySelector('.swiss-map');
      if (!mapEl) return;

      const canvas = await html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f5f7fa',
      });

      const link = document.createElement('a');
      link.download = `travel-tracker-${country.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      className="export-btn"
      onClick={handleExport}
      disabled={exporting}
      title="Download map as PNG"
    >
      {exporting ? (
        <span className="export-spinner" />
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );
}
