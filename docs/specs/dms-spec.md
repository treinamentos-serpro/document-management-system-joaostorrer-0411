# Especificação - Document Management System

## 1. Objetivo

Permitir que usuários enviem, listem e baixem seus documentos, mantendo os arquivos no filesystem local da aplicação e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos do usuário identificado na requisição.
- Download de um documento pelo identificador, limitado ao seu dono.
- Identificação simples do usuário por `X-User-Id`.
- Armazenamento de arquivos local com `multer` e `diskStorage`.
- Metadados mantidos em memória durante a execução do processo.
- Interface web para upload, listagem e download.

### Fora do escopo

- Autenticação, autorização baseada em credenciais e gestão de contas.
- Armazenamento externo ou em nuvem.
- Banco de dados ou persistência dos metadados após reinicialização.
- Versionamento, edição, compartilhamento ou exclusão de documentos.
- Preview ou transformação do conteúdo dos arquivos.
- Recuperação automática dos metadados a partir dos arquivos existentes no disco.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | A API deve exigir o cabeçalho `X-User-Id` nas operações de documentos. O valor deve ser não vazio e limitado a 100 caracteres. |
| RF-02 | O usuário pode enviar um único arquivo por requisição, no campo multipart `file`. |
| RF-03 | O upload deve rejeitar requisições sem arquivo, arquivos vazios ou arquivos acima do limite configurado. |
| RF-04 | Cada upload aceito deve receber um identificador único e metadados com nome original, tamanho, data de envio e dono. |
| RF-05 | O nome usado para gravação no disco deve ser gerado pelo servidor. O nome original não deve determinar o caminho de armazenamento. |
| RF-06 | O usuário pode listar somente os documentos associados ao seu `X-User-Id`. |
| RF-07 | A listagem deve ser ordenada do envio mais recente para o mais antigo e aceitar paginação por `limit` e `offset`. |
| RF-08 | O usuário pode baixar um documento pelo identificador somente se ele pertencer ao mesmo `X-User-Id`. |
| RF-09 | O download deve ser enviado como anexo, usando o nome original como nome sugerido ao cliente. |
| RF-10 | Erros da API devem ser retornados em formato JSON consistente, exceto quando a resposta já tiver iniciado como download. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem ser gravados no filesystem local usando `multer` com `diskStorage`, sob `backend/storage` por padrão. |
| RNF-02 | O diretório de armazenamento deve ser configurável pela variável `STORAGE_DIR`. |
| RNF-03 | Os metadados devem permanecer em memória e podem ser perdidos ao reiniciar o processo. |
| RNF-04 | O limite padrão de upload deve ser 10 MiB e configurável por `MAX_FILE_SIZE_BYTES`. |
| RNF-05 | A porta do backend deve ser configurável por `PORT`, mantendo o padrão já adotado pelo projeto. |
| RNF-06 | O sistema não deve expor caminhos locais, nomes internos de arquivo ou detalhes de stack trace nas respostas da API. |
| RNF-07 | O download deve usar `Content-Disposition: attachment`; arquivos não devem ser servidos como conteúdo público estático. |
| RNF-08 | A API deve validar e tratar falhas de entrada, gravação e leitura de arquivos. |
| RNF-09 | A implementação deve respeitar as camadas `routes -> controllers -> services -> repositories`. |
| RNF-10 | A identidade via `X-User-Id` é apenas uma convenção para o MVP e não constitui autenticação segura. |

## 5. Modelo de dados

### Metadados do documento

| Campo | Tipo | Exposição | Descrição |
| --- | --- | --- | --- |
| `id` | string | API | Identificador único, preferencialmente UUID. |
| `originalName` | string | API | Nome original informado pelo cliente, tratado como dado não confiável. |
| `size` | number | API | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | API | Data/hora do upload em ISO 8601, UTC. |
| `owner` | string | API | Valor de `X-User-Id` associado ao documento. |
| `storedName` | string | Interno | Nome gerado pelo servidor para o arquivo no disco. |
| `storagePath` | string | Interno | Caminho local usado para localizar o arquivo. Não deve ser retornado pela API. |

O repositório em memória deve indexar os metadados pelo `id`. O caminho de armazenamento e o nome interno não devem ser aceitos do cliente.

## 6. Contratos de API

A interface chama a API sob o prefixo `/api`. No desenvolvimento, o proxy do Vite remove esse prefixo antes de encaminhar a requisição ao backend.

### Formato de erro

Respostas de erro JSON devem seguir o formato:

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Documento não encontrado."
  }
}