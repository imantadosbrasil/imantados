Auditoria de Limpeza e Organização — Imantados 2.0

Resumo executivo
- Diretório canônico: `./` (raiz). O diretório `./public` é um espelho quase completo e causa duplicidade e confusão de paths.
- Backend ativo: Firebase Hosting + Cloud Functions (configurado em `firebase.json`). Funções Netlify em `public/netlify/functions/` parecem obsoletas.
- Live Reload: servidor de desenvolvimento em `server.js` (raiz) injeta SSE `/livereload`. O servidor em `public/server.js` não deve ser utilizado.
- Principais libs client-side usadas: `html2canvas` (carregada sob demanda em `main.js`), `JSZip` e `file-saver` (importadas em `index.html`).
- Assets: grande volume em `assets/`. Referências mapeadas em HTML/CSS/JS indicam que alguns arquivos não têm uso.

Duplicações e obsolescências
- Duplicação de páginas, scripts e estilos entre `./` e `./public`:
  - Exemplos: `index.html`, `mural.html`, `styles.css`, `main.js`, `server.js`, `cart-count.js`, etc.
  - Impacto: links como `http://localhost:5174/public/mural.html` tentam resolver `public/assets/...`, provocando `404/ERR_ABORTED`.
  - Ação recomendada: padronizar para usar somente a raiz (`./`) e remover duplicatas de `./public` após verificação.

- Funções de backend duplicadas/obsoletas:
  - Ativo: `functions/index.js` com `stripeCheckout` e `mpCreatePreference` (referenciadas via rewrites em `firebase.json`).
  - Obsoleto: `public/netlify/functions/stripe-checkout.js`, `public/netlify/functions/mp-create-preference.js` (não usadas no fluxo atual).

Dependências client-side e uso real
- `html2canvas@1.4.1` — carregada dinamicamente em `main.js` apenas para prévia; permanece em uso.
- `JSZip@3.10.1` e `file-saver@2.0.5` — import ESM em `index.html` e usados para exportar ZIP; em uso.
- Firebase SDK — usado em `firebase-auth.js` e `firebase-db.js`; em uso.

Assets mapeados como usados
- Com base em referência direta por código: `assets/logo-imantados.png`, `assets/botao.png`, `assets/avatar6.png`, `assets/fundo.jpg`, `assets/emoji-card-bg.jpg`, `assets/galeria-parede.jpg`, `assets/geladeira-imants.jpg`, `assets/aparecida-close.jpg`, `assets/mesa-produtos.jpg`, `assets/empresas-divulgue.png`, `assets/instagram-preview.png`, `assets/threads-preview.png`, `assets/threads-edicao.svg`, `assets/whatsapp-preview.png`, `assets/emojis-preview.png`, `assets/exemplos.png` e vários `assets/EMOJIS/*.png`, `assets/FIGURINHAS/*.png`.

Assets candidatos a remoção (não encontrados em referências)
- `assets/estoque-caixas.JPEG` — variante sem referência (há uso de `estoque-caixas.jpg`).
- `assets/eles ja estao imantados.png` — nome com espaços, sem referência (há uso de `eles_ja_estao.png`).

Erros observados e causas
- `net::ERR_ABORTED` em páginas servidas sob `/public/...` — causado por paths resolvendo como `public/public/...` no servidor estático.
  - Mitigação: usar sempre páginas da raiz (`/mural.html`, `/index.html`, etc.).
- Aviso de `livereload` em alguns cenários — esperado quando cliente tenta conectar SSE em servidor que não fornece `/livereload` (ex.: `public/server.js`).

Plano de limpeza (proposto)
1) Canonizar diretório raiz e descontinuar `./public`.
   - Etapas: validar todas as páginas/rotas na raiz; remover duplicatas em `./public` (páginas, scripts, styles, server.js e package.json) após checklist.
2) Remover funções Netlify em `public/netlify/functions/`.
3) Remover assets não referenciados (lista inicial acima) e manter monitoramento via busca.
4) Verificação progressiva após cada remoção:
   - Abrir páginas principais (`index.html`, `mural.html`, `modelos.html`, `empresa.html`, `carrinho.html`, `checkout.html`, `login.html`).
   - Conferir carregamento de JS/CSS e imagens (DevTools > Network).
5) Documentar no repositório decisões de arquitetura e como rodar localmente (`server.js` raiz e comandos Firebase).

Como executar localmente (dev)
- Servidor de desenvolvimento: `npm start` (usa `server.js` na raiz, porta `4173`).
- Firebase Hosting preview: `npm run fb:serve` (porta `4173` conforme script).
- Deploy: `npm run fb:deploy`.

Observações finais
- Já existe um backup: `backup_Imantados_2025-11-02_22-59.zip`.
- A limpeza será feita de forma gradual, com validação após cada remoção para garantir estabilidade.