# Como retomar amanhã

Passos rápidos para voltar a trabalhar no projeto Imantados 2.0.

- Abrir a pasta do projeto: `c:\PROJETOS\IMANTADOS 2.0`
- Instalar/usar Node.js (se necessário).
- Iniciar o servidor: `node server.js`
- Acessar no navegador: `http://localhost:5173/index.html`

Observações
- O botão “Enviar arquivos” e o botão “Preview” estão reativados no `index.html`.
- O botão “Mural” foi adicionado ao cabeçalho em todas as páginas e está destacado em `mural.html`.
- Se o servidor iniciar em outra porta, verifique a variável `PORT` do ambiente e ajuste a URL.

Backup
- Um backup zip foi gerado na raiz: `backup_Imantados_YYYY-MM-DD_HH-mm.zip`.
- Caso precise outro backup: execute `Compress-Archive -Path * -DestinationPath backup_Imantados_<timestamp>.zip -Force` no PowerShell, dentro da pasta do projeto.