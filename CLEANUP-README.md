Guia de Execução e Estrutura — Imantados 2.0

Diretório canônico
- Utilize a raiz do projeto (`./`) como fonte única para páginas, scripts e estilos.
- Evite servir arquivos a partir de `./public`; esse diretório continha duplicatas e foi descontinuado.

Servidores e comandos
- Desenvolvimento local: `npm start` (usa `server.js` na raiz; porta `4173`).
- Firebase Hosting (preview): `npm run fb:serve`.
- Deploy Firebase: `npm run fb:deploy`.

Arquitetura backend
- Funções ativas: Firebase Cloud Functions (definidas em `functions/index.js`).
- Rewrites em `firebase.json` apontam para `stripeCheckout` e `mpCreatePreference`.
- Funções Netlify redundantes foram removidas de `public/netlify/functions`.

Boas práticas de paths
- Referencie assets como `assets/...` sem prefixo `public/` nas páginas da raiz.
- Evite `./public/mural.html`; use `/mural.html` diretamente.

Validação após mudanças
- Verifique páginas: `index.html`, `mural.html`, `modelos.html`, `empresa.html`, `carrinho.html`, `checkout.html`, `login.html`.
- Use DevTools > Network para garantir que imagens, CSS e JS carregam sem `404/ERR_ABORTED`.

Backup
- Um backup completo existe: `backup_Imantados_2025-11-02_22-59.zip`.