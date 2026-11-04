import { useRef, useState } from 'react';
import formatFileSize from '../utils/formatFileSize.js';

export default function UploadComponent({ disabled = false, onUpload }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || disabled || isUploading) {
      return;
    }

    setError('');
    setIsUploading(true);
    try {
      await onUpload(file);
      setFile(null);
      inputRef.current.value = '';
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(event) {
    setError('');
    setFile(event.target.files?.[0] || null);
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className={`file-picker${file ? ' has-file' : ''}${disabled ? ' is-disabled' : ''}`}>
        <input
          ref={inputRef}
          type="file"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
        />
        <span className="picker-icon" aria-hidden="true">↑</span>
        <span className="picker-copy">
          <strong>{file ? 'Arquivo selecionado' : 'Escolha um arquivo'}</strong>
          <span>{file ? file.name : 'ou clique para procurar no dispositivo'}</span>
        </span>
      </label>

      {file && (
        <div className="selected-file">
          <span>{formatFileSize(file.size)}</span>
          <button
            className="clear-file"
            type="button"
            aria-label="Remover arquivo selecionado"
            onClick={() => {
              setFile(null);
              inputRef.current.value = '';
            }}
            disabled={isUploading}
          >
            ×
          </button>
        </div>
      )}

      <p className="upload-hint">O servidor valida o tamanho máximo permitido.</p>
      {error && <p className="inline-error" role="alert">{error}</p>}

      <button className="primary-button" type="submit" disabled={!file || disabled || isUploading}>
        <span aria-hidden="true">{isUploading ? '…' : '↑'}</span>
        {isUploading ? 'Enviando arquivo' : 'Enviar documento'}
      </button>
    </form>
  );
}