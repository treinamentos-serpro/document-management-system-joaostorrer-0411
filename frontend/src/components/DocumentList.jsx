import DownloadButton from './DownloadButton.jsx';
import formatFileSize from '../utils/formatFileSize.js';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export default function DocumentList({
  documents,
  error,
  hasMore,
  isLoading,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  owner,
  token,
}) {
  if (isLoading) {
    return <p className="list-state" role="status">Carregando documentos…</p>;
  }

  if (error) {
    return <p className="list-state list-error" role="alert">{error}</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-mark" aria-hidden="true">+</span>
        <p>Nenhum documento por aqui</p>
        <span>Os arquivos enviados aparecerão nesta lista.</span>
      </div>
    );
  }

  return (
    <div className="document-table-wrap">
      <table className="document-table">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Enviado</th>
            <th scope="col">Tamanho</th>
            <th scope="col"><span className="visually-hidden">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <div className="document-name-cell">
                  <span className="file-type-mark" aria-hidden="true">DOC</span>
                  <span className="document-name" title={document.originalName}>{document.originalName}</span>
                </div>
              </td>
              <td className="muted-cell">{dateFormatter.format(new Date(document.uploadedAt))}</td>
              <td className="muted-cell">{formatFileSize(document.size)}</td>
              <td className="action-cell">
                <DownloadButton document={document} owner={owner} token={token} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button className="load-more-button" type="button" onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? 'Carregando…' : 'Carregar mais documentos'}
        </button>
      )}
      {loadMoreError && <p className="list-error" role="alert">{loadMoreError}</p>}
    </div>
  );
}