# Liquid Glass Button

Pacote simples para reutilizar o botão estilo “glass”.

## Como usar

1. Copie `btn-glass.css` para seu projeto.
2. Importe no HTML: 
   ```html
   <link rel="stylesheet" href="btn-glass.css">
   ```
3. Marcação do botão:
   ```html
   <button class="btn-glass accent-blue lg h50">
     <span class="btn-glass__label">Salvar</span>
   </button>
   ```

## Classes úteis

- `btn-glass` base do componente.
- `accent-blue | accent-purple | accent-emerald` para esquemas de cor.
- `sm | lg` para tamanhos.
- `h50` para altura fixa de 50px.

## Personalizações

- A aura azul+pêssego do `accent-blue` fica à esquerda por padrão. Ajuste os `radial-gradient(...)` em `.btn-glass.accent-blue::before` para mover/intensificar.
- O brilho superior é controlado pelo pseudo `::after`.
- Caso queira a bolha líquida, adicione um elemento `span.btn-glass__bubble` e os estilos correspondentes.

## Fundo recomendado

Para destacar o vidro, use um fundo escuro, por exemplo:
```css
body { background: #0b0b0c; }
```