import { useState } from 'react';
import { downloadDocument } from '../services/documentsApi.js';

export default function DownloadButton({ document, owner }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setError('');
    setIsDownloading(true);
    try {
      await downloadDocument(document, owner);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <span className="download-control">
      <button
        className="download-button"
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        aria-label={`Baixar ${document.originalName}`}
        title="Baixar documento"
      >
        <span aria-hidden="true">{isDownloading ? '…' : '↓'}</span>
      </button>
      {error && <span className="download-error" role="alert">{error}</span>}
    </span>
  );
}