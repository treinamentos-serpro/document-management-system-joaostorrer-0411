// Seed do servidor backend do Document Management System.
//
// Este arquivo é apenas um ponto de partida mínimo. Ao longo do workshop você
// vai usar o Agent Mode do GitHub Copilot para construir as camadas:
//   - routes/       (definição das rotas)
//   - controllers/  (entrada HTTP e validação)
//   - services/     (regras de negócio)
//   - repositories/ (persistência: arquivos locais + metadados em memória)
//
// Restrição do projeto: uploads são gravados no filesystem local da aplicação
// usando multer com diskStorage. Não utilize provedores externos.

const express = require('express');
const documentsRoutes = require('./routes/documents.routes');
const { cleanupOrphanedFiles } = require('./repositories/localFileRepository');
const { orphanRetentionDays } = require('./config/documentConfig');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '32kb' }));

// Endpoint de verificação de saúde. As demais rotas (/upload, /documents,
// /documents/:id/download) serão implementadas durante o Passo 2.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/', documentsRoutes);

if (process.env.CLEANUP_ORPHANED_FILES === 'true') {
  cleanupOrphanedFiles(orphanRetentionDays)
    .then((removedCount) => {
      console.log(`Limpeza local: ${removedCount} arquivo(s) órfão(s) removido(s).`);
    })
    .catch((error) => {
      console.error('Falha na limpeza de arquivos órfãos:', error.message);
    });
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
