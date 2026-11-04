import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/documentsApi.js';
import './App.css';

export default function App() {
  const [owner, setOwner] = useState(() => window.localStorage.getItem('dms.user') || 'usuario-demo');
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    window.localStorage.setItem('dms.user', owner);
  }, [owner]);

  useEffect(() => {
    const trimmedOwner = owner.trim();
    if (!trimmedOwner) {
      setDocuments([]);
      setLoadError('Informe um identificador de usuário para carregar os documentos.');
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');

    listDocuments(trimmedOwner, { signal: controller.signal })
      .then(setDocuments)
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadError(error.message);
          setDocuments([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [owner, refreshKey]);

  async function handleUpload(file) {
    const document = await uploadDocument(file, owner.trim());
    setNotice(`${document.originalName} foi enviado.`);
    setRefreshKey((currentKey) => currentKey + 1);
  }

  function handleOwnerChange(event) {
    setOwner(event.target.value);
    setNotice('');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="DMS, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DMS<span className="brand-period">.</span></span>
        </a>
        <label className="user-field">
          <span>Identificador do usuário</span>
          <input
            autoComplete="off"
            maxLength={100}
            onChange={handleOwnerChange}
            value={owner}
          />
        </label>
      </header>

      <main className="workspace" id="inicio">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">ESPAÇO DE TRABALHO</p>
            <h1 id="page-title">Seus documentos<span className="heading-period">.</span></h1>
            <p className="page-subtitle">Arquivos organizados, prontos quando você precisar.</p>
          </div>
          <div className="document-total" aria-live="polite">
            <span className="total-number">{isLoading ? '—' : documents.length}</span>
            <span>{documents.length === 1 ? 'documento' : 'documentos'}</span>
          </div>
        </section>

        <div className="workspace-grid">
          <aside className="upload-panel" aria-labelledby="upload-title">
            <div className="panel-heading">
              <span className="panel-index">01</span>
              <h2 id="upload-title">Adicionar arquivo</h2>
            </div>
            <UploadComponent
              disabled={!owner.trim() || owner.trim().length > 100}
              onUpload={handleUpload}
            />
            {notice && <p className="notice-message" role="status">{notice}</p>}
          </aside>

          <section className="documents-panel" aria-labelledby="documents-title">
            <div className="list-heading">
              <div>
                <p className="eyebrow">BIBLIOTECA</p>
                <h2 id="documents-title">Arquivos recentes</h2>
              </div>
              <span className="sort-label">Mais recentes</span>
            </div>
            <DocumentList
              documents={documents}
              error={loadError}
              isLoading={isLoading}
              owner={owner.trim()}
            />
          </section>
        </div>
      </main>
      <footer className="page-footer">
        <span>Document Management System</span>
        <span>Armazenamento local</span>
      </footer>
    </div>
  );
}
