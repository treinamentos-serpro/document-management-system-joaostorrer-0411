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

- Gestão de contas, recuperação de credenciais e emissão/rotação automática de tokens.
- Armazenamento externo ou em nuvem.
- Banco de dados ou persistência dos metadados após reinicialização.
- Versionamento, edição, compartilhamento ou exclusão de documentos.
- Preview ou transformação do conteúdo dos arquivos.
- Recuperação automática dos metadados a partir dos arquivos existentes no disco.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | A API deve exigir `X-User-Id` não vazio, com até 100 caracteres, e um Bearer token válido fora do modo de desenvolvimento. |
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
| RNF-10 | Tokens configurados devem ser comparados em tempo constante; sem tokens, a API só pode iniciar quando `NODE_ENV=development`. |
| RNF-11 | Uploads devem respeitar cotas por usuário, cota local total e limite de frequência configuráveis por ambiente. |
| RNF-12 | A UI não deve persistir tokens de acesso no `localStorage` ou `sessionStorage`. |

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

O repositório em memória deve indexar os metadados pelo `id`. O caminho de armazenamento e o nome interno não devem ser aceitos do cliente. A autorização deve usar o usuário autenticado, nunca confiar isoladamente no `X-User-Id`.

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
```

Códigos esperados incluem `AUTHENTICATION_REQUIRED`, `INVALID_REQUEST`,
`FILE_REQUIRED`, `FILE_TOO_LARGE`, `STORAGE_QUOTA_EXCEEDED`,
`UPLOAD_RATE_LIMITED` e `DOCUMENT_NOT_FOUND`.

### POST /api/upload

- Cabeçalho: `X-User-Id` e `Authorization: Bearer <token>` quando a autenticação estiver configurada.
- Entrada: `multipart/form-data`, um arquivo no campo `file`.
- Sucesso: `201 Created`, com metadados públicos do documento.
- Erros: `400` para entrada inválida, `401` para token inválido, `413` para tamanho/cota excedidos e `429` para limite de frequência.

### GET /api/documents

- Cabeçalho: os mesmos requisitos de identidade do upload.
- Parâmetros: `limit` (padrão `50`, máximo `100`) e `offset` (padrão `0`).
- Sucesso: `200 OK`, documentos do usuário autenticado e `pagination.total`.

### GET /api/documents/:id/download

- Cabeçalho: os mesmos requisitos de identidade do upload.
- Sucesso: `200 OK`, conteúdo enviado como anexo.
- Um ID malformado retorna `400`; documento inexistente ou de outro usuário retorna `404`.

## 7. Decisões arquiteturais

- Backend separado em `routes`, `controllers`, `services`, `repositories` e middleware de borda para autenticação, rate limit e Multer.
- A configuração de Multer usa `diskStorage` com nome físico UUID e grava exclusivamente em filesystem local.
- Metadados permanecem em memória nesta fase; após reinício, arquivos antigos deixam de estar acessíveis pela API e contam para a cota local. Uma limpeza de arquivos UUID antigos pode ser habilitada explicitamente.
- O frontend usa um serviço `fetch` único com prefixo `/api`; credenciais ficam apenas em estado de memória da página.

## 8. Configuração e operação

`DMS_USER_TOKENS` deve ser um objeto JSON que associa cada identificador a um segredo aleatório de pelo menos 32 bytes. Exemplo fictício:

```json
{"usuario-exemplo":"substitua-por-um-segredo-aleatorio-de-32-bytes-ou-mais"}
```

Não versione tokens nem os coloque em código-fonte. Em produção, configure essa variável no gerenciador de segredos do ambiente e use HTTPS. O bypass local sem token só é habilitado com `NODE_ENV=development`, definido pelo script `npm run dev` do backend.

Limites padrão, todos configuráveis por variável de ambiente:

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `MAX_FILE_SIZE_BYTES` | 10485760 | Tamanho máximo por arquivo (10 MiB). |
| `MAX_DOCUMENTS_PER_USER` | 200 | Quantidade máxima por usuário no processo atual. |
| `MAX_DOCUMENTS_TOTAL` | 10000 | Quantidade máxima de arquivos locais UUID. |
| `MAX_STORAGE_BYTES_PER_USER` | 1073741824 | Cota de metadados por usuário (1 GiB). |
| `MAX_STORAGE_BYTES_TOTAL` | 10737418240 | Cota total local (10 GiB). |
| `MAX_UPLOADS_PER_MINUTE` | 30 | Uploads por usuário autenticado, por processo. |
| `STORAGE_DIR` | `backend/storage` | Diretório local de armazenamento. |
| `CLEANUP_ORPHANED_FILES` | `false` | Habilita limpeza de arquivos UUID antigos na inicialização; use `true` apenas após avaliar a retenção. |
| `ORPHAN_RETENTION_DAYS` | 30 | Idade mínima para limpeza de arquivos locais sem metadados recuperáveis. |

As cotas de metadados por usuário reiniciam junto com o processo. A cota global mede arquivos UUID físicos no diretório, incluindo arquivos órfãos deixados por reinícios.

## 9. Plano de execução

1. Validar configuração de tokens e limites antes de iniciar o serviço.
2. Autenticar rotas, aplicar cotas e limitar frequência antes de processar upload.
3. Manter regras de documento no service e persistência de metadados/arquivos nos repositories.
4. Integrar cliente `fetch` com Bearer token em memória e paginação progressiva.
5. Testar autorização, isolamento, path traversal, arquivos ausentes, tamanhos, cotas e rate limit.