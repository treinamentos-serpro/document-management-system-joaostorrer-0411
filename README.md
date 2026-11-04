# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey joaostorrer!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-joaostorrer-0411/issues/1)

## Integração contínua e testes

O workflow [CI](.github/workflows/ci.yml) roda em todo `push` e `pull_request`
com Node.js 24. Ele instala as dependências usando os lockfiles, builda o
frontend e executa os testes do backend.

Para executar as mesmas verificações localmente:

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm run build --prefix frontend
npm test --prefix backend
```

Os testes de integração verificam upload, listagem com paginação e download,
incluindo autenticação, isolamento por usuário, cotas e entradas inválidas.
Os arquivos de teste usam um diretório temporário removido ao final da execução.

---

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
