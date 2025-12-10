(() => {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  const gallery = document.getElementById('gallery');
  const addToCartBtn = document.getElementById('addToCartBtn');
  const previewBtn = document.getElementById('previewBtn');

  let lastObjectUrl = null;

  // Conversão pixel-milímetro (ajustada para 2.2 px/mm)
  const PX_PER_MM = 2.2;
  // Conversão para centímetros
  const PX_PER_CM = PX_PER_MM * 10; // 22 px/cm
  // Preço agora por cm² (mantendo o mesmo custo físico de 0,003 R$/mm²)
  const PRICE_PER_CM2 = 0.20; // R$ por cm²
  // Limites em centímetros (3–15 cm)
  const MIN_SIZE_CM = 3;
  const MAX_SIZE_CM = 15;

  // Calcula escala mínima e máxima baseada no tamanho da imagem
  const getScaleLimits = (imgWidth, imgHeight) => {
    const maxDimPx = Math.max(imgWidth, imgHeight);
    const minScale = (MIN_SIZE_CM * PX_PER_CM) / maxDimPx;
    const maxScale = (MAX_SIZE_CM * PX_PER_CM) / maxDimPx;
    return { minScale: Math.max(0.1, minScale), maxScale: Math.min(5, maxScale) };
  };

  // Converte tamanho em pixels para milímetros (mantido para lógicas internas como contorno)
  const pxToMm = (px) => px / PX_PER_MM;
  const mmToPx = (mm) => mm * PX_PER_MM;
  // Conversão em centímetros para exibição e lógica de dimensionamento
  const pxToCm = (px) => px / PX_PER_CM;
  const cmToPx = (cm) => cm * PX_PER_CM;

  // Utilitário para carregar script externo (html2canvas)
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar dependência'));
      document.head.appendChild(s);
    });
  }

  // Efeito ripple no clique
  function addRipple(e) {
    if (!uploadBtn) return;
    const rect = uploadBtn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    uploadBtn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  // Verificar se os elementos existem antes de adicionar listeners
  let openingPicker = false;
  // Cooldown curto após o seletor ser fechado/alterado para evitar reabertura
  let pickerRecentlyClosed = false;
  // Estado para saber se o seletor está aberto via click programático
  let pickerOpen = false;
  // Dedupe de arquivos já carregados (por nome|tamanho|lastModified)
  const loadedFileKeys = new Set();
  const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;
  if (uploadBtn) {
    uploadBtn.addEventListener('pointerdown', addRipple);
    uploadBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openingPicker || pickerRecentlyClosed) return;
      openingPicker = true;
      try { fileInput.value = ''; } catch {}
      // Abrir seletor e desfocar o botão para evitar novo clique ao retornar do diálogo
      pickerOpen = true;
      fileInput.click();
      try { uploadBtn.blur(); } catch {}
      setTimeout(() => { openingPicker = false; }, 1200);
    }, { passive: false });
  }
  // Botão de Preview
  if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
      try {
        document.body.classList.add('previewing');
        // Garante dependência para renderizar DOM como imagem
        if (!window.html2canvas) {
          await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        }
        // Aguarda o layout aplicar as classes ocultas
        await new Promise(r => setTimeout(r, 60));

        // Calcula total atual para exibição no preview
        let totalSum = 0;
        Array.from(document.querySelectorAll('.image-wrap')).forEach((wrap) => {
          const img = wrap.querySelector('.user-image');
          if (!img) return;
          const r = img.getBoundingClientRect();
          const widthCm = pxToCm(r.width);
          const heightCm = pxToCm(r.height);
          const area = widthCm * heightCm;
          totalSum += area * PRICE_PER_CM2;
        });
        const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const canvas = await window.html2canvas(document.body, {
          backgroundColor: null,
          scale: window.devicePixelRatio || 1,
          useCORS: true,
          ignoreElements: (el) => el.classList && el.classList.contains('preview-overlay')
        });
        const dataUrl = canvas.toDataURL('image/png');

        // Monta modal com a imagem capturada
        const overlay = document.createElement('div');
        overlay.className = 'preview-overlay';
        overlay.innerHTML = `
          <div class="preview-modal">
            <img class="preview-image" alt="Pré-visualização" src="${dataUrl}">
            <div class="preview-actions">
              <div class="total">Total: ${formatBRL(totalSum)}</div>
              <button class="btn btn-back" type="button">Voltar e editar</button>
              <button class="btn btn-approve" type="button">Ok, ir ao carrinho</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        const closeOverlay = () => { overlay.remove(); document.body.classList.remove('previewing'); };
        overlay.querySelector('.btn-back').addEventListener('click', closeOverlay);
        overlay.querySelector('.btn-approve').addEventListener('click', () => {
          try { addAllImagesToCart(); } catch {}
          closeOverlay();
          window.location.href = '/carrinho.html';
        });
        // Fechar com ESC
        const onKey = (e) => { if (e.key === 'Escape') { closeOverlay(); window.removeEventListener('keydown', onKey); } };
        window.addEventListener('keydown', onKey);
      } catch (err) {
        console.error(err);
        document.body.classList.remove('previewing');
        showToast('Não foi possível gerar a pré-visualização.');
      }
    });
  }
  // CTA do header: abrir seletor de arquivos (mesma ação do botão flutuante)
  const ctaCreate = document.getElementById('cta-create');
  if (ctaCreate && fileInput) {
    ctaCreate.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openingPicker || pickerRecentlyClosed) return;
      openingPicker = true;
      try { fileInput.value = ''; } catch {}
      try { pickerOpen = true; fileInput.click(); } catch {}
      try { ctaCreate.blur(); } catch {}
      setTimeout(() => { openingPicker = false; }, 1200);
    }, { passive: false });
  }

  // CTA do avatar topo: mesma ação do cta-create
  const topAvatarCta = document.getElementById('top-avatar-cta');
  if (topAvatarCta && fileInput) {
    topAvatarCta.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openingPicker || pickerRecentlyClosed) return;
      openingPicker = true;
      try { fileInput.value = ''; } catch {}
      try { pickerOpen = true; fileInput.click(); } catch {}
      try { topAvatarCta.blur(); } catch {}
      setTimeout(() => { openingPicker = false; }, 1200);
    }, { passive: false });
  }

  // Utilitários de imagem
  const fitWithin = (w, h, max = 200) => {
    const ratio = Math.min(max / w, max / h, 1);
    return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
  };

  // Thumbnail persistente (data URL) a partir de um <img>
  // Mantido dentro do escopo principal para ter acesso a helpers locais
  const makeThumbDataUrl = (imgEl, max = 220) => {
    try {
      const w = imgEl.naturalWidth || imgEl.width || 200;
      const h = imgEl.naturalHeight || imgEl.height || 200;
      const { w: tw, h: th } = fitWithin(w, h, max);
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, tw, th);
      ctx.drawImage(imgEl, 0, 0, tw, th);
      return canvas.toDataURL('image/png');
    } catch {
      // Se houver erro (ex.: CORS/tainted), volta ao src original
      return imgEl.src;
    }
  };

  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

  const isDark = (r, g, b, thr = 35) => r < thr && g < thr && b < thr;
  const dist2 = (r1,g1,b1,r2,g2,b2) => {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return dr*dr + dg*dg + db*db;
  };

  async function processImageVariants(url, max = 400, force = false) {
    try {
      const src = await loadImage(url);
      const { w, h } = fitWithin(src.naturalWidth || src.width, src.naturalHeight || src.height, max);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(src, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      let didRemove = false;

      // Verificação prévia: remover fundo se a cor das bordas for praticamente uniforme (qualquer cor)
      const borderInfo = (() => {
        let total = 0;
        let rSum = 0, gSum = 0, bSum = 0;
        // amostragem com passo para performance
        const step = Math.max(1, Math.floor(Math.min(w, h) / 80));
        const add = (x,y) => {
          const i4 = (y * w + x) * 4;
          const a = data[i4 + 3];
          if (a <= 10) return;
          rSum += data[i4]; gSum += data[i4 + 1]; bSum += data[i4 + 2];
          total++;
        };
        for (let x = 0; x < w; x += step) { add(x, 0); add(x, h-1); }
        for (let y = 0; y < h; y += step) { add(0, y); add(w-1, y); }
        const mean = total ? { r: Math.round(rSum/total), g: Math.round(gSum/total), b: Math.round(bSum/total) } : { r:255,g:255,b:255 };
        let within = 0;
        const thr = 32; // tolerância de cor (euclidiana) ~ leve variação
        const thr2 = thr*thr;
        const count = () => {
          let cnt = 0, ok = 0;
          for (let x = 0; x < w; x += step) {
            for (const y of [0, h-1]) {
              const i4 = (y * w + x) * 4; if (data[i4 + 3] <= 10) continue; cnt++;
              if (dist2(data[i4], data[i4+1], data[i4+2], mean.r, mean.g, mean.b) <= thr2) ok++;
            }
          }
          for (let y = 0; y < h; y += step) {
            for (const x of [0, w-1]) {
              const i4 = (y * w + x) * 4; if (data[i4 + 3] <= 10) continue; cnt++;
              if (dist2(data[i4], data[i4+1], data[i4+2], mean.r, mean.g, mean.b) <= thr2) ok++;
            }
          }
          return { cnt, ok };
        };
        const { cnt, ok } = count();
        const ratio = cnt ? ok / cnt : 0;
        return { mean, ratio, thr2 };
      })();

      if (!force && borderInfo.ratio < 0.85) {
        return { processed: false };
      }

      // Flood fill por borda para remover regiões escuras conectadas às bordas
      const visited = new Uint8Array(w * h);
      const queue = [];
      const pushIfBg = (x, y) => {
        const idx = (y * w + x);
        if (visited[idx]) return;
        const i4 = idx * 4;
        const r = data[i4], g = data[i4 + 1], b = data[i4 + 2], a = data[i4 + 3];
        if (a > 10 && dist2(r,g,b,borderInfo.mean.r,borderInfo.mean.g,borderInfo.mean.b) <= borderInfo.thr2) {
          visited[idx] = 1;
          queue.push(idx);
        }
      };

      for (let x = 0; x < w; x++) { pushIfBg(x, 0); pushIfBg(x, h - 1); }
      for (let y = 0; y < h; y++) { pushIfBg(0, y); pushIfBg(w - 1, y); }

      const neighbors = (idx) => {
        const x = idx % w, y = (idx / w) | 0;
        const res = [];
        if (x > 0) res.push(idx - 1);
        if (x < w - 1) res.push(idx + 1);
        if (y > 0) res.push(idx - w);
        if (y < h - 1) res.push(idx + w);
        return res;
      };

      while (queue.length) {
        const idx = queue.shift();
        const i4 = idx * 4;
        if (data[i4 + 3] !== 0) didRemove = true;
        data[i4 + 3] = 0; // torna transparente
        for (const n of neighbors(idx)) {
          if (visited[n]) continue;
          const j4 = n * 4;
          const r = data[j4], g = data[j4 + 1], b = data[j4 + 2], a = data[j4 + 3];
          if (a > 10 && dist2(r,g,b,borderInfo.mean.r,borderInfo.mean.g,borderInfo.mean.b) <= borderInfo.thr2) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }

      // Guarda uma cópia do resultado sem contorno
      const baseData = new ImageData(new Uint8ClampedArray(imgData.data), w, h);

      // Cria contorno (estilo figurinha): dilatação da máscara alpha e diferença
      const alphaThr = 10;
      const thickness = Math.max(1, Math.round(1.14 * PX_PER_MM)); // espessura ~1.14mm em px (BG ON +15%)
      const size = w * h;
      const mask = new Uint8Array(size);
      for (let i = 0; i < size; i++) mask[i] = data[i * 4 + 3] > alphaThr ? 1 : 0;

      let dil = mask.slice();
      for (let t = 0; t < thickness; t++) {
        const next = dil.slice();
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (dil[idx]) continue; // já é 1
            let hasNeighbor = false;
            for (let ny = y - 1; ny <= y + 1 && !hasNeighbor; ny++) {
              for (let nx = x - 1; nx <= x + 1 && !hasNeighbor; nx++) {
                if (nx === x && ny === y) continue;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                if (dil[ny * w + nx]) hasNeighbor = true;
              }
            }
            if (hasNeighbor) next[idx] = 1;
          }
        }
        dil = next;
      }

      // outline = (dil && !mask) com antialias via blur da alfa do contorno
      let didOutline = false;
      const outline = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        if (dil[i] && !mask[i]) { outline[i] = 1; didOutline = true; }
      }

      // Função auxiliar: verifica se um pixel toca a máscara original (borda interna)
      const touchesMask = (idx) => {
        const x = idx % w, y = (idx / w) | 0;
        for (let ny = y - 1; ny <= y + 1; ny++) {
          for (let nx = x - 1; nx <= x + 1; nx++) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (mask[ny * w + nx]) return true;
          }
        }
        return false;
      };

      if (didOutline) {
        // 1) Alfa binária do contorno (0/255)
        let alphaA = new Uint16Array(size);
        for (let i = 0; i < size; i++) alphaA[i] = outline[i] ? 255 : 0;

        // 2) Duas passagens de blur 3x3 para suavizar a borda externa
        const blurPass = (src) => {
          const dst = new Uint16Array(size);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let sum = 0, cnt = 0;
              for (let ny = y - 1; ny <= y + 1; ny++) {
                for (let nx = x - 1; nx <= x + 1; nx++) {
                  if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                  sum += src[ny * w + nx];
                  cnt++;
                }
              }
              dst[y * w + x] = Math.round(sum / cnt);
            }
          }
          return dst;
        };

        alphaA = blurPass(alphaA);
        alphaA = blurPass(alphaA);

        // 3) Pinta contorno branco com alfa suavizado, mantendo borda interna sólida
        for (let i = 0; i < size; i++) {
          if (!outline[i]) continue;
          const k = i * 4;
          let a = alphaA[i];
          if (touchesMask(i)) a = 255; // interno sólido
          if (a < 70) a = 70;          // evita sumiço do contorno
          data[k] = 255; data[k + 1] = 255; data[k + 2] = 255; data[k + 3] = a;
        }
      }

      // Endurece o alfa e remove semitransparência residual (mais agressivo)
      const hardThr = 96;

      // Pré-computa vizinhos transparentes (raio 2) para decontaminação de cor
      const hasTransparentNeighbor = new Uint8Array(size);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const i4 = idx * 4;
          if (data[i4 + 3] === 0) continue;
          let nearTransparent = false;
          for (let ny = y - 2; ny <= y + 2 && !nearTransparent; ny++) {
            for (let nx = x - 2; nx <= x + 2 && !nearTransparent; nx++) {
              if (nx === x && ny === y) continue;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const n4 = (ny * w + nx) * 4;
              if (data[n4 + 3] === 0) nearTransparent = true;
            }
          }
          if (nearTransparent) hasTransparentNeighbor[idx] = 1;
        }
      }

      for (let i = 0; i < size; i++) {
        const k = i * 4;
        const a = data[k + 3];
        // Para pixels do contorno, preserva o alfa suavizado (não endurece)
        if (outline[i]) { continue; }
        if (a <= hardThr) {
          data[k + 3] = 0; // totalmente transparente
        } else {
          data[k + 3] = 255; // totalmente opaco
          // Decontamina a borda para branco quando está adjacente ao transparente
          if (hasTransparentNeighbor[i]) {
            data[k] = 255; data[k + 1] = 255; data[k + 2] = 255;
          }
        }
      }

      // Gera dois blobs: sem contorno (baseData) e com contorno (imgData)
      ctx.putImageData(baseData, 0, 0);
      const blobNo = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      ctx.putImageData(imgData, 0, 0);
      const blobWith = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      return {
        processed: didRemove || didOutline,
        noOutlineUrl: blobNo ? URL.createObjectURL(blobNo) : undefined,
        outlineUrl: blobWith ? URL.createObjectURL(blobWith) : undefined,
      };
    } catch {
      return { processed: false };
    }
  }

  // Abrir imagem e centralizar
  function createImageWrap(originalUrl, displayUrl, index, isProcessed, variants) {
    const wrap = document.createElement('div');
    wrap.className = 'image-wrap';
    // deslocamento inicial leve para reduzir sobreposição
    const step = 18;
    wrap.style.setProperty('--drag-x', `${index * step}px`);
    wrap.style.setProperty('--drag-y', `${index * step}px`);
    wrap.style.setProperty('--scale', '1');
    // Espessura fixa do contorno em px (0.75mm)
    wrap.style.setProperty('--outline-px', `${0.75 * PX_PER_MM}px`);

    const img = document.createElement('img');
    img.className = 'user-image visible';
    img.alt = 'Imagem selecionada';
    img.src = displayUrl;
    if (isProcessed) img.classList.add('processed');
    img.draggable = false;

    // Indicadores (tamanho e preço lado a lado)
    const sizeIndicator = document.createElement('div');
    sizeIndicator.className = 'size-indicator';
    sizeIndicator.textContent = '0×0cm';

    const priceIndicator = document.createElement('div');
    priceIndicator.className = 'price-indicator';
    priceIndicator.textContent = 'R$ 0,00';

    const indicators = document.createElement('div');
    indicators.className = 'indicator-bar';
    // Preço à esquerda, tamanho à direita
    indicators.append(priceIndicator, sizeIndicator);

    // botão de fechar
    const close = document.createElement('button');
    close.className = 'close-btn';
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar imagem');
    close.textContent = '×';

    // Controles por imagem
    const ctrls = document.createElement('div');
    ctrls.className = 'controls';
    const btnBg = document.createElement('button');
    btnBg.className = 'ctrl-btn btn-bg';
    btnBg.type = 'button';
    btnBg.title = 'Remover/Restaurar fundo';
    btnBg.textContent = 'Fundo';
    const btnCt = document.createElement('button');
    btnCt.className = 'ctrl-btn btn-ct';
    btnCt.type = 'button';
    btnCt.title = 'Contorno branco on/off';
    btnCt.textContent = 'Contorno';
    const btnMinus = document.createElement('button');
    btnMinus.className = 'ctrl-btn btn-zoom-out';
    btnMinus.type = 'button';
    btnMinus.title = 'Diminuir';
    btnMinus.textContent = '−';
    const btnPlus = document.createElement('button');
    btnPlus.className = 'ctrl-btn btn-zoom-in';
    btnPlus.type = 'button';
    btnPlus.title = 'Aumentar';
    btnPlus.textContent = '+';
    ctrls.append(btnBg, btnCt, btnMinus, btnPlus);

    wrap.dataset.objurl = originalUrl;
    wrap.dataset.processedNo = variants?.noOutlineUrl || '';
    wrap.dataset.processedWith = variants?.outlineUrl || '';
    wrap.dataset.bg = isProcessed ? 'on' : 'off';
    wrap.dataset.ct = isProcessed ? 'on' : 'off';
    wrap.appendChild(img);
    wrap.appendChild(indicators);
    wrap.appendChild(ctrls);
    wrap.appendChild(close);

    // Função para atualizar o indicador de tamanho
    const updateSizeIndicator = () => {
      const curScale = parseFloat(getComputedStyle(wrap).getPropertyValue('--scale')) || 1;
      const baseW = parseFloat(wrap.dataset.baseWidthCm || '0');
      const baseH = parseFloat(wrap.dataset.baseHeightCm || '0');
      let widthCm = baseW > 0 ? (baseW * curScale) : pxToCm(img.getBoundingClientRect().width);
      let heightCm = baseH > 0 ? (baseH * curScale) : pxToCm(img.getBoundingClientRect().height);
      if ((wrap.dataset.type === 'x' || wrap.dataset.type === 'ig') && baseW > 0 && baseH > 0) {
        const targetW = Number(wrap.dataset.xTargetWidthCm || 15);
        widthCm = targetW;
        heightCm = Number((targetW * (baseH / baseW)).toFixed(0));
      }
      const displayW = Math.round(widthCm);
      const displayH = Math.round(heightCm);
      sizeIndicator.textContent = `${displayW}×${displayH}cm`;
      const area = Math.max(0, widthCm * heightCm);
      const price = Number((area * PRICE_PER_CM2).toFixed(2));
      priceIndicator.textContent = `R$ ${price.toFixed(2).replace('.', ',')}`;
    };

    // Definir altura inicial em 8 cm e atualizar indicadores quando a imagem carregar
    img.addEventListener('load', () => {
      try {
        const desiredHeightCm = 6;
        const rect = img.getBoundingClientRect();
        const baseWidthCm = Math.max(0.0001, pxToCm(rect.width));
        const baseHeightCm = Math.max(0.0001, pxToCm(rect.height));
        wrap.dataset.baseWidthCm = String(baseWidthCm);
        wrap.dataset.baseHeightCm = String(baseHeightCm);
        const currentHeightCm = baseHeightCm;
        // Garantir que o alvo esteja dentro dos limites 3–15 cm
        const targetCm = Math.max(MIN_SIZE_CM, Math.min(MAX_SIZE_CM, desiredHeightCm));
        const curScale = parseFloat(getComputedStyle(wrap).getPropertyValue('--scale')) || 1;
        const factor = targetCm / currentHeightCm;
        wrap.style.setProperty('--scale', String(curScale * factor));
      } catch {}
      updateSizeIndicator();
    });
    wrap.updateSizeIndicator = updateSizeIndicator;

    return wrap;
  }

  // Atualiza a espessura do contorno em todas as imagens já adicionadas
  function applyGlobalOutlineThickness(mm = 0.75) {
    const px = mmToPx(mm);
    document.querySelectorAll('.image-wrap').forEach(wrap => {
      wrap.style.setProperty('--outline-px', `${px}px`);
    });
  }

  // Adicionar imagem por URL (mesmo fluxo do upload)
  async function addImageFromUrl(imageUrl) {
    try {
      if (!gallery || !imageUrl) return;
      const existing = gallery.querySelectorAll('.image-wrap').length;
      if (existing >= 10) { showToast('Limite de 10 imagens atingido.'); return; }
      // Processa variantes e cria wrap
      const isDataUrl = typeof imageUrl === 'string' && imageUrl.startsWith('data:image');
      const result = isDataUrl ? { processed: false } : await processImageVariants(imageUrl, 400, false);
      const displayUrl = isDataUrl ? imageUrl : (result.processed ? (result.noOutlineUrl || result.outlineUrl || imageUrl) : imageUrl);
      const wrap = createImageWrap(imageUrl, displayUrl, existing, !!result.processed, result);
      gallery.appendChild(wrap);
      if (isDataUrl && window.__lastXCardOptions__) {
        wrap.dataset.type = 'x';
        wrap.dataset.allowedWidths = (window.__lastXCardOptions__.allowedWidths || [15,13,11]).join(',');
        const imgEl = wrap.querySelector('.user-image');
        if (imgEl) {
          imgEl.addEventListener('load', () => {
            const allowed = (wrap.dataset.allowedWidths || '15,13,11').split(',').map(Number).sort((a,b)=>a-b);
            const targetW = allowed[allowed.length-1];
            const baseW = parseFloat(wrap.dataset.baseWidthCm || String(pxToCm(imgEl.getBoundingClientRect().width)));
            const nextScale = targetW / Math.max(0.0001, baseW);
            wrap.style.setProperty('--scale', String(nextScale));
            wrap.dataset.xTargetWidthCm = String(targetW);
            wrap.dataset.xIndex = String(allowed.indexOf(targetW));
            try {
              const nw = imgEl.naturalWidth || imgEl.width;
              const nh = imgEl.naturalHeight || imgEl.height;
              if (nw && nh) {
                imgEl.style.aspectRatio = `${nw}/${nh}`;
                imgEl.style.width = 'auto';
                imgEl.style.height = 'auto';
                imgEl.style.maxWidth = '92vw';
                imgEl.style.maxHeight = '60vh';
              }
            } catch {}
            if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
          }, { once: true });
        }
      }
      if (isDataUrl && window.__lastIGCardOptions__) {
        wrap.dataset.type = 'ig';
        wrap.dataset.allowedWidths = (window.__lastIGCardOptions__.allowedWidths || [15,13,11]).join(',');
        const imgEl = wrap.querySelector('.user-image');
        if (imgEl) {
          imgEl.addEventListener('load', () => {
            const allowed = (wrap.dataset.allowedWidths || '15,13,11').split(',').map(Number).sort((a,b)=>a-b);
            const targetW = allowed[allowed.length-1];
            const baseW = parseFloat(wrap.dataset.baseWidthCm || String(pxToCm(imgEl.getBoundingClientRect().width)));
            const nextScale = targetW / Math.max(0.0001, baseW);
            wrap.style.setProperty('--scale', String(nextScale));
            wrap.dataset.xTargetWidthCm = String(targetW);
            wrap.dataset.xIndex = String(allowed.indexOf(targetW));
            try {
              const nw = imgEl.naturalWidth || imgEl.width;
              const nh = imgEl.naturalHeight || imgEl.height;
              if (nw && nh) {
                imgEl.style.aspectRatio = `${nw}/${nh}`;
                imgEl.style.width = 'auto';
                imgEl.style.height = 'auto';
                imgEl.style.maxWidth = '92vw';
                imgEl.style.maxHeight = '60vh';
              }
            } catch {}
            if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
          }, { once: true });
        }
      }
      if (!(isDataUrl && window.__lastXCardOptions__)) {
        showToast('Imagem adicionada.');
      }
    } catch (err) {
      console.warn('Falha ao adicionar imagem do catálogo:', err);
      showToast('Não foi possível adicionar a imagem.');
    }
  }

  function showToast(message, timeout = 2200) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(el._tId);
    el._tId = window.setTimeout(() => el.classList.remove('show'), timeout);
  }

  // Adicionar todas as imagens carregadas ao carrinho com preço por cm²
  function addAllImagesToCart() {
    try {
      const wraps = Array.from(document.querySelectorAll('.image-wrap'));
      if (wraps.length === 0) {
        showToast('Adicione uma imagem antes de enviar ao carrinho.');
        return;
      }

      const cart = JSON.parse(localStorage.getItem('emojiCart') || '[]');
      let added = 0;
      let sum = 0;

      wraps.forEach((wrap, idx) => {
        const img = wrap.querySelector('.user-image');
        if (!img) return;
        const r = img.getBoundingClientRect();
        const widthCm = pxToCm(r.width);
        const heightCm = pxToCm(r.height);
        const area = widthCm * heightCm; // cm²
        const unitPrice = Number((area * PRICE_PER_CM2).toFixed(2));
        // Thumb persistente para o review no carrinho
        const thumbDataUrl = makeThumbDataUrl(img, 220);
        const item = {
          id: Date.now() + idx,
          type: 'custom',
          name: 'Imagem personalizada',
          displayUrl: thumbDataUrl,
          sizeCm: { width: Number(widthCm.toFixed(2)), height: Number(heightCm.toFixed(2)) },
          areaCm2: Number(area.toFixed(2)),
          unitPrice,
          quantity: 1,
          total: unitPrice,
        };
        cart.push(item);
        added += 1;
        sum += unitPrice;
      });

      localStorage.setItem('emojiCart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-updated'));
      showToast(`${added} imagem(ns) adicionada(s). Total R$ ${sum.toFixed(2).replace('.', ',')}`);
    } catch (e) {
      console.error(e);
      showToast('Falha ao adicionar ao carrinho.');
    }
  }

// Verificar se fileInput existe antes de adicionar listener
if (fileInput) {
    // Suprimir cliques/ponteiros globais por curto período após retorno do diálogo
    let suppressUntil = 0;
    const suppressHandler = (e) => {
      if (Date.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
}

// --- Modal de categorias (pop-up sem sair da página) ---
(() => {
  if (window.__CATEGORY_MODAL_INIT__) return; window.__CATEGORY_MODAL_INIT__ = true;
  const categoriesNav = document.querySelector('.quick-categories');
  const modal = document.getElementById('categoryModal');
  const modalTitle = document.getElementById('categoryModalTitle');
  const modalGrid = document.getElementById('categoryOptions');
  const closeBtn = modal ? modal.querySelector('.modal-close') : null;

  if (!categoriesNav || !modal || !modalTitle || !modalGrid) return;

  const CATEGORY_OPTIONS = {
    Emojis: [
      { title: 'Coração', src: 'assets/EMOJIS/ribbon_1f380.png' },
      { title: 'Arco-íris', src: 'assets/EMOJIS/rainbow_1f308.png' },
      { title: 'Fantasma', src: 'assets/EMOJIS/ghost_1f47b.png' },
      { title: 'Olhos', src: 'assets/EMOJIS/eyes_1f440.png' },
    ],
    Figurinhas: [
      { title: 'Figurinha 01', src: 'assets/FIGURINHAS/01.png' },
      { title: 'Figurinha 02', src: 'assets/FIGURINHAS/02.png' },
      { title: 'Figurinha 03', src: 'assets/FIGURINHAS/03.png' },
      { title: 'Figurinha 04', src: 'assets/FIGURINHAS/04.png' },
      { title: 'Figurinha 05', src: 'assets/FIGURINHAS/05.png' },
      { title: 'Figurinha 06', src: 'assets/FIGURINHAS/06.png' },
    ],
    Whatsapp: [ { title: 'Whatsapp', src: 'assets/whatsapp-preview.png' } ],
    Instagram: [ { title: 'Instagram', src: 'assets/instagram-preview.png' } ],
    X: [ { title: 'X (Twitter)', src: 'assets/threads-preview.png' } ],
    Quadrinhos: [ { title: 'Quadrinhos', src: 'assets/exemplos.png' } ],
    Frases: [ { title: 'Frases', src: 'assets/comemorativas-preview.png' } ],
    Signos: [ { title: 'Virgem', src: 'assets/EMOJIS/virgo_264d.png' } ],
  };

  async function openModal(category) {
    modalTitle.textContent = `Selecione um modelo: ${category}`;
    let loadedFromDB = false;
    try {
      if (window.DB && window.DB.isReady()) {
        await window.DB.init();
        loadedFromDB = await renderOptionsFromFirestore(category);
      }
    } catch (err) {
      console.warn('Erro ao carregar modelos do Firestore:', err);
    }
    if (!loadedFromDB) {
      try { await renderOptions(category); } catch {}
    }
    modal.classList.remove('visually-hidden');
    modal.setAttribute('aria-hidden', 'false');
    try { closeBtn && closeBtn.focus(); } catch {}
    document.addEventListener('keydown', onEscClose);
  }

  async function renderOptionsFromFirestore(category) {
    try {
      const grid = document.getElementById('modalGrid');
      if (!grid) return false;
      const models = await window.DB.getCategoryModels(String(category).toLowerCase());
      if (!models || !models.length) return false;
      grid.innerHTML = '';
      for (const m of models) {
        const card = document.createElement('button');
        card.className = 'option-card';
        card.type = 'button';
        card.innerHTML = `
          <img src="${m.imageUrl || m.img || m.thumbnailUrl || 'assets/placeholders/placeholder.png'}" alt="${m.titulo || m.title || 'Modelo'}" />
          <div class="option-body">
            <div class="option-title">${m.titulo || m.title || 'Modelo'}</div>
            <div class="option-desc">${m.descricao || m.description || ''}</div>
          </div>
        `;
        card.addEventListener('click', async () => {
          await addImageFromUrl(m.imageUrl || m.img || m.thumbnailUrl);
          try { closeModal(); } catch {}
        });
        grid.appendChild(card);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function closeModal() {
    modal.classList.add('visually-hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onEscClose);
  }

  function onEscClose(e) { if (e.key === 'Escape') closeModal(); }

  let loadingCategory = false;
  async function renderOptions(category) {
    if (loadingCategory) return;
    loadingCategory = true;
    try {
    const normalized = String(category).length ? (category === 'x' ? 'X' : (category[0].toUpperCase() + category.slice(1))) : category;
    modalGrid.innerHTML = '';
    if (normalized === 'Emojis') {
      try {
        const gh = await fetch('https://api.github.com/repos/imantadosbrasil/imantados/contents/assets/EMOJIS?ref=main', { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' });
        if (gh && gh.ok) {
          const items = await gh.json();
          if (Array.isArray(items)) {
            const allowed = /\.(png|jpg|jpeg|webp|gif)$/i;
            const files = items.filter(x => x && x.type === 'file' && allowed.test(x.name || '') && x.download_url);
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const url = f.download_url;
              const key = String(url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = url;
              img.alt = f.name || 'Emoji';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch {}
      try {
        const res = await fetch('/api/emojis', { cache: 'no-store' });
        if (res && res.ok) {
          const files = await res.json();
          if (Array.isArray(files)) {
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const key = String(f.url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = f.url;
              img.alt = f.name || 'Emoji';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(f.url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
    }
    if (normalized === 'Signos') {
      try {
        const gh = await fetch('https://api.github.com/repos/imantadosbrasil/imantados/contents/assets/SIGNOS?ref=main', { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' });
        if (gh && gh.ok) {
          const items = await gh.json();
          if (Array.isArray(items)) {
            const allowed = /\.(png|jpg|jpeg|webp|gif)$/i;
            const files = items.filter(x => x && x.type === 'file' && allowed.test(x.name || '') && x.download_url);
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const url = f.download_url;
              const key = String(url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = url;
              img.alt = f.name || 'Signo';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch {}
      try {
        const res = await fetch('/api/signos', { cache: 'no-store' });
        if (res && res.ok) {
          const files = await res.json();
          if (Array.isArray(files)) {
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const key = String(f.url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = f.url;
              img.alt = f.name || 'Signo';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(f.url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
    }
    if (normalized === 'Frases') {
      try {
        const gh = await fetch('https://api.github.com/repos/imantadosbrasil/imantados/contents/assets/FRASES?ref=main', { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' });
        if (gh && gh.ok) {
          const items = await gh.json();
          if (Array.isArray(items)) {
            const allowed = /\.(png|jpg|jpeg|webp|gif)$/i;
            const files = items.filter(x => x && x.type === 'file' && allowed.test(x.name || '') && x.download_url);
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const url = f.download_url;
              const key = String(url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = url;
              img.alt = f.name || 'Frase';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch {}
      try {
        const res = await fetch('/api/frases', { cache: 'no-store' });
        if (res && res.ok) {
          const files = await res.json();
          if (Array.isArray(files)) {
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const key = String(f.url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = f.url;
              img.alt = f.name || 'Frase';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(f.url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
    }
    if (normalized === 'Figurinhas') {
      try {
        const res = await fetch('/api/figurinhas', { cache: 'no-store' });
        if (res && res.ok) {
          const files = await res.json();
          if (Array.isArray(files)) {
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const key = String(f.url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = f.url;
              img.alt = f.name || 'Figurinha';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(f.url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
    }
    if (normalized === 'Whatsapp') {
      try {
        const res = await fetch('/api/whatsapp', { cache: 'no-store' });
        if (res && res.ok) {
          const files = await res.json();
          if (Array.isArray(files)) {
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            const seen = new Set();
            for (const f of files) {
              const key = String(f.url || f.name).toLowerCase();
              if (seen.has(key)) continue; seen.add(key);
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = f.url;
              img.alt = f.name || 'Whatsapp';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(f.url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
    }
    if (normalized === 'Instagram') { try { closeModal(); } catch {} openInstagramDesigner(); return; }
    if (normalized === 'X') { try { closeModal(); } catch {} openXDesigner(); return; }
    if (normalized === 'Quadrinhos') {
      try {
        const res = await fetch('/api/quadrinhos', { cache: 'no-store' });
        if (res && res.ok) {
          const files = await res.json();
          if (Array.isArray(files)) {
            if (files.length === 0) { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
            for (const f of files) {
              const card = document.createElement('div');
              card.className = 'option-card';
              const img = document.createElement('img');
              img.src = f.url;
              img.alt = f.name || 'Quadrinho';
              const body = document.createElement('div');
              body.className = 'option-body';
              const btn = document.createElement('button');
              btn.className = 'option-select';
              btn.type = 'button';
              btn.textContent = 'Selecionar';
              btn.addEventListener('click', async () => { await addImageFromUrl(f.url); try { closeModal(); } catch {} });
              body.appendChild(btn);
              card.appendChild(img);
              card.appendChild(body);
              modalGrid.appendChild(card);
            }
            return;
          }
        }
      } catch { const empty = document.createElement('div'); empty.textContent = 'Sem opções ainda. Em breve novidades!'; modalGrid.appendChild(empty); return; }
    }
    const items = CATEGORY_OPTIONS[normalized] || [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Sem opções ainda. Em breve novidades!';
      modalGrid.appendChild(empty);
      return;
    }
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'option-card';
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.title;
      const body = document.createElement('div');
      body.className = 'option-body';
      const btn = document.createElement('button');
      btn.className = 'option-select';
      btn.type = 'button';
      btn.textContent = 'Selecionar';
      btn.addEventListener('click', async () => {
        await addImageFromUrl(item.src);
        try { closeModal(); } catch {}
      });
      body.appendChild(btn);
      card.appendChild(img);
      card.appendChild(body);
      modalGrid.appendChild(card);
    }
    } finally { loadingCategory = false; }
  }

  async function openXDesigner() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    const dateStr = new Date().toLocaleDateString('pt-BR');
    overlay.innerHTML = `
      <div class="modal-card x-designer-card">
        <header class="modal-header"><h2 class="modal-title">Criar seu Íma no estilo da mensagem do X</h2><button class="modal-close" type="button">×</button></header>
        <div class="x-designer">
          <div class="x-preview">
            <div id="xCard" class="x-card">
              <div class="x-row">
                <div id="xAvatar" class="x-avatar">Sua<br>Foto</div>
                <div class="x-userline"><div id="xUser" class="x-user">Usuário</div><div id="xMeta" class="x-meta">@imantadosbrasil · ${dateStr}</div></div>
                <div class="x-menu">⋯</div>
              </div>
              <div id="xMessage" class="x-message">Cliente pode alterar esta mensagem</div>
              <div class="x-stats">
                <div class="x-stat">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4C2.9 2 2 2.9 2 4V18C2 19.1 2.9 20 4 20H18L22 24V4C22 2.9 21.1 2 20 2Z"/></svg>
                  <span id="xC">342</span>
                </div>
                <div class="x-stat">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23 7l-6-6v4H6c-3.31 0-6 2.69-6 6v3h2v-3c0-2.21 1.79-4 4-4h11v4l6-6zM1 17l6 6v-4h11c3.31 0 6-2.69 6-6v-3h-2v3c0 2.21-1.79 4-4 4H7v-4l-6 6z"/></svg>
                  <span id="xR">568</span>
                </div>
                <div class="x-stat">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.22 2.53C11.09 5.01 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  <span id="xL">20000</span>
                </div>
                <div class="x-stat">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17h2v-7H3v7zm4 0h2V7H7v10zm4 0h2v-4h-2v4zm4 0h2V4h-2v13z"/></svg>
                  <span id="xV">1200</span>
                </div>
                <div class="x-stat">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v14l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                </div>
                <div class="x-stat">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-0.76 0-1.47 0.3-2 0.77L8.91 12.7c0.05-0.23 0.09-0.47 0.09-0.7s-0.04-0.47-0.09-0.7l7.05-4.11c0.54 0.48 1.25 0.77 2 0.77 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 0.23 0.03 0.47 0.09 0.7L8.04 9.81C7.5 9.33 6.79 9.04 6.03 9.04c-1.66 0-3 1.34-3 3 0 1.66 1.34 3 3 3 0.76 0 1.47-0.29 2-0.77l7.14 4.17c-0.05 0.22-0.08 0.45-0.08 0.69 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"/></svg>
                </div>
              </div>
            </div>
          </div>
          <form class="x-form" autocomplete="off">
            <div class="row">
              <input id="inUser" type="text" placeholder="Nome do usuário" value="Usuário">
              <input id="inHandle" type="text" placeholder="@handle" value="@imantadosbrasil">
            </div>
            <input id="inDate" type="text" placeholder="Data" value="${dateStr}">
            <textarea id="inMsg" rows="3" placeholder="Mensagem">Cliente pode alterar esta mensagem</textarea>
            <div class="row">
              <input id="inC" type="number" min="0" placeholder="Comentários" value="342">
              <input id="inR" type="number" min="0" placeholder="Retweets" value="568">
            </div>
            <div class="row">
              <input id="inL" type="number" min="0" placeholder="Likes" value="20000">
              <input id="inV" type="number" min="0" placeholder="Alcance" value="1200">
            </div>
            <div>
              <label class="btn btn-light" for="inAvatar">Carregar foto do avatar</label>
              <input id="inAvatar" type="file" accept="image/*" class="visually-hidden">
            </div>
          </form>
        </div>
        <div class="x-actions">
          <button class="btn btn-light" type="button" id="xCancel">Cancelar</button>
          <button class="btn btn-primary" type="button" id="xAdd">Adicionar ao palco</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    // SVG inline removido; revertido para layout HTML padrão
    const close = () => { overlay.remove(); };
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#xCancel').addEventListener('click', close);
    const bind = (sel, cb) => { const el = overlay.querySelector(sel); if (el) el.addEventListener('input', cb); };
    const inUserEl = overlay.querySelector('#inUser'); if (inUserEl) inUserEl.setAttribute('maxlength','20');
    const inMsgEl = overlay.querySelector('#inMsg'); if (inMsgEl) inMsgEl.setAttribute('maxlength','60');
    ['#inC','#inR','#inL','#inV'].forEach(sel => { const el = overlay.querySelector(sel); if (el) { el.setAttribute('inputmode','numeric'); el.setAttribute('pattern','\\d*'); }});
    const HANDLE_CONST = '@imantadosbrasil';
    const inHandleEl = overlay.querySelector('#inHandle'); if (inHandleEl) { inHandleEl.value = HANDLE_CONST; inHandleEl.setAttribute('readonly',''); inHandleEl.setAttribute('disabled',''); }
    bind('#inUser', (e) => overlay.querySelector('#xUser').textContent = (e.target.value || 'Usuário').slice(0,20));
    bind('#inDate', (e) => { const d = e.target.value || dateStr; overlay.querySelector('#xMeta').textContent = `${HANDLE_CONST} · ${d}`; });
    bind('#inMsg', (e) => overlay.querySelector('#xMessage').textContent = (e.target.value || '').slice(0,60));
    const numSanitize = (v) => String((v||'').toString().replace(/\D/g,'').slice(0,5));
    bind('#inC', (e) => { e.target.value = numSanitize(e.target.value); overlay.querySelector('#xC').textContent = e.target.value; });
    bind('#inR', (e) => { e.target.value = numSanitize(e.target.value); overlay.querySelector('#xR').textContent = e.target.value; });
    bind('#inL', (e) => { e.target.value = numSanitize(e.target.value); overlay.querySelector('#xL').textContent = e.target.value; });
    bind('#inV', (e) => { e.target.value = numSanitize(e.target.value); overlay.querySelector('#xV').textContent = e.target.value; });
    const inAvatar = overlay.querySelector('#inAvatar');
    if (inAvatar) {
      inAvatar.addEventListener('change', async () => {
        const f = inAvatar.files && inAvatar.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        const av = overlay.querySelector('#xAvatar');
        av.innerHTML = `<img src="${url}" alt="avatar">`;
      });
    }
    overlay.querySelector('#xAdd').addEventListener('click', async () => {
      try {
        await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        const el = overlay.querySelector('#xCard');
        const canvas = await window.html2canvas(el, { backgroundColor: '#ffffff', scale: window.devicePixelRatio || 1 });
        const dataUrl = canvas.toDataURL('image/png');
        window.__lastXCardOptions__ = { allowedWidths: [15,13,11] };
        await addImageFromUrl(dataUrl);
        const catModal = document.getElementById('categoryModal');
        if (catModal) { catModal.classList.add('visually-hidden'); catModal.setAttribute('aria-hidden','true'); }
        close();
      } catch { close(); }
    });
  }

  categoriesNav.addEventListener('click', (e) => {
    const a = e.target.closest('.category-btn');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http')) return;
    e.preventDefault();
    const category = a.getAttribute('data-category');
    if (!category) return;
    openModal(category);
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  // Fechar ao clicar fora do card
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
})();
    };
    window.addEventListener('click', suppressHandler, true);
    window.addEventListener('pointerup', suppressHandler, true);
    window.addEventListener('mouseup', suppressHandler, true);
    // Ao recuperar o foco da janela depois do diálogo, suprimir por um instante
    window.addEventListener('focus', () => {
      if (pickerOpen) {
        pickerOpen = false;
        suppressUntil = Date.now() + 1000;
      }
    });

    fileInput.addEventListener('change', async () => {
    // Ativa cooldown imediato para evitar reabertura acidental ao voltar do diálogo
    pickerRecentlyClosed = true;
    pickerOpen = false;
    suppressUntil = Date.now() + 1500;
    const files = Array.from(fileInput.files || []);
    if (files.length === 0) return;

    // Número atual de imagens
    const existing = gallery.querySelectorAll('.image-wrap').length;
    const remaining = Math.max(0, 10 - existing);
    // Remover arquivos já adicionados anteriormente
    const deduped = files.filter(f => {
      try {
        const k = fileKey(f);
        if (loadedFileKeys.has(k)) return false;
        loadedFileKeys.add(k);
        return true;
      } catch {
        return true;
      }
    });
    const useFiles = deduped.slice(0, remaining);

    for (let i = 0; i < useFiles.length; i++) {
      const file = useFiles[i];
      const originalUrl = URL.createObjectURL(file);
      lastObjectUrl = originalUrl;
      const result = await processImageVariants(originalUrl, 400, false);
      let displayUrl = originalUrl;
      // Preferir SEM contorno no PNG; contorno será aplicado via CSS quando CT estiver on
      if (result.processed) displayUrl = result.noOutlineUrl || result.outlineUrl || originalUrl;
      const wrap = createImageWrap(originalUrl, displayUrl, existing + i, !!result.processed, result);
      gallery.appendChild(wrap);
    }

    if (files.length > remaining) {
      showToast(`Limite de 10 imagens. Adicionadas apenas ${useFiles.length}.`);
    } else if (deduped.length < files.length) {
      showToast('Algumas imagens repetidas foram ignoradas.');
    }
    // Evitar reabrir seletor automaticamente em alguns navegadores
    try { fileInput.value = ''; fileInput.blur(); } catch {}
    openingPicker = false;
    // Desativa cooldown após pequeno intervalo
    setTimeout(() => { pickerRecentlyClosed = false; }, 1500);
  });
  }

  // Arrastar: clicar/segurar/arrastar a imagem pela página
  let dragging = false;
  let startX = 0, startY = 0;
  let originX = 0, originY = 0;
  let activeWrap = null;
  let zCounter = 1;

  // Parse helpers para pegar valores atuais das variáveis CSS
  const getCurrentDrag = (el) => {
    const styles = getComputedStyle(el);
    const dx = parseFloat(styles.getPropertyValue('--drag-x')) || 0;
    const dy = parseFloat(styles.getPropertyValue('--drag-y')) || 0;
    return { dx, dy };
  };

  const setDrag = (el, dx, dy) => {
    el.style.setProperty('--drag-x', `${dx}px`);
    el.style.setProperty('--drag-y', `${dy}px`);
  };

  const onPointerDown = (e) => {
    if (e.target.closest('.close-btn')) return; // não iniciar arrasto ao clicar no fechar
    const wrap = e.target.closest('.image-wrap');
    if (!wrap) return;
    dragging = true;
    activeWrap = wrap;
    activeWrap.classList.add('dragging');
    activeWrap.style.zIndex = String(++zCounter);
    const { dx, dy } = getCurrentDrag(activeWrap);
    originX = dx; originY = dy;
    startX = e.clientX; startY = e.clientY;
    try { activeWrap.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    if (!dragging || !activeWrap) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    setDrag(activeWrap, originX + deltaX, originY + deltaY);
  };

  const onPointerUp = (e) => {
    if (!dragging || !activeWrap) return;
    dragging = false;
    activeWrap.classList.remove('dragging');
    try { activeWrap.releasePointerCapture(e.pointerId); } catch {}
    activeWrap = null;
  };

  // Fechar imagem
  if (gallery) {
    gallery.addEventListener('click', (e) => {
    const btn = e.target.closest('.close-btn');
    if (!btn) return;
    e.stopPropagation();
    const wrap = btn.closest('.image-wrap');
    if (!wrap) return;
    const url = wrap.dataset.objurl;
    const pNo = wrap.dataset.processedNo;
    const pWith = wrap.dataset.processedWith;
    if (url) { try { URL.revokeObjectURL(url); } catch {} }
    if (pNo && pNo !== url) { try { URL.revokeObjectURL(pNo); } catch {} }
    if (pWith && pWith !== url) { try { URL.revokeObjectURL(pWith); } catch {} }
    if (activeWrap === wrap) {
      dragging = false;
      activeWrap = null;
    }
    wrap.remove();
    });

    // Evitar início de arrasto ao usar controles
    gallery.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ctrl-btn')) {
      e.stopPropagation();
      return; // não inicia arrasto
    }
    }, true);

    // Ações dos controles
    gallery.addEventListener('click', async (e) => {
    const wrap = e.target.closest('.image-wrap');
    if (!wrap) return;
    const img = wrap.querySelector('.user-image');
    if (!img) return;

    // Zoom: cada clique ajusta ±1cm no MAIOR lado (3–15cm)
      if (e.target.closest('.btn-zoom-in')) {
        if (wrap.dataset.zooming === '1') return;
        wrap.dataset.zooming = '1';
        const cur = parseFloat(getComputedStyle(wrap).getPropertyValue('--scale')) || 1;
        const imgRect = img.getBoundingClientRect();
        if (wrap.dataset.type === 'x' || wrap.dataset.type === 'ig') {
          const baseW = parseFloat(wrap.dataset.baseWidthCm || String(pxToCm(imgRect.width)));
          const allowed = (wrap.dataset.allowedWidths || '15,13,11').split(',').map(Number).sort((a,b)=>a-b);
          let idx = parseInt(wrap.dataset.xIndex || '-1', 10);
          if (isNaN(idx) || idx < 0) {
            const curTarget = Number(wrap.dataset.xTargetWidthCm || Math.round(baseW * cur));
            idx = allowed.findIndex(w => w >= curTarget);
            if (idx < 0) idx = allowed.length - 1;
          }
          idx = Math.min(idx + 1, allowed.length - 1);
          const targetW = allowed[idx];
          const nextScale = targetW / Math.max(0.0001, baseW);
          wrap.style.setProperty('--scale', String(nextScale));
          wrap.dataset.xTargetWidthCm = String(targetW);
          wrap.dataset.xIndex = String(idx);
          if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
          wrap.dataset.zooming = '0';
          return;
        }
        const widthCm = pxToCm(imgRect.width * cur);
        const heightCm = pxToCm(imgRect.height * cur);
        const curMaxCm = Math.max(widthCm, heightCm);
        const targetMaxCm = Math.min(MAX_SIZE_CM, curMaxCm + 1);
        if (targetMaxCm === curMaxCm) { wrap.dataset.zooming = '0'; return; }
        const factor = targetMaxCm / curMaxCm;
        const next = cur * factor;
        wrap.style.setProperty('--scale', String(next));
        if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
        wrap.dataset.zooming = '0';
        return;
      }
      if (e.target.closest('.btn-zoom-out')) {
        if (wrap.dataset.zooming === '1') return;
        wrap.dataset.zooming = '1';
        const cur = parseFloat(getComputedStyle(wrap).getPropertyValue('--scale')) || 1;
        const imgRect = img.getBoundingClientRect();
        if (wrap.dataset.type === 'x' || wrap.dataset.type === 'ig') {
          const baseW = parseFloat(wrap.dataset.baseWidthCm || String(pxToCm(imgRect.width)));
          const allowed = (wrap.dataset.allowedWidths || '15,13,11').split(',').map(Number).sort((a,b)=>a-b);
          let idx = parseInt(wrap.dataset.xIndex || '-1', 10);
          if (isNaN(idx) || idx < 0) {
            const curTarget = Number(wrap.dataset.xTargetWidthCm || Math.round(baseW * cur));
            idx = allowed.findIndex(w => w >= curTarget);
            if (idx < 0) idx = allowed.length - 1;
          }
          idx = Math.max(idx - 1, 0);
          const targetW = allowed[idx];
          const nextScale = targetW / Math.max(0.0001, baseW);
          wrap.style.setProperty('--scale', String(nextScale));
          wrap.dataset.xTargetWidthCm = String(targetW);
          wrap.dataset.xIndex = String(idx);
          if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
          wrap.dataset.zooming = '0';
          return;
        }
        const widthCm = pxToCm(imgRect.width * cur);
        const heightCm = pxToCm(imgRect.height * cur);
        const curMaxCm = Math.max(widthCm, heightCm);
        const targetMaxCm = Math.max(MIN_SIZE_CM, curMaxCm - 1);
        if (targetMaxCm === curMaxCm) { wrap.dataset.zooming = '0'; return; }
        const factor = targetMaxCm / curMaxCm;
        const next = cur * factor;
        wrap.style.setProperty('--scale', String(next));
        if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
        wrap.dataset.zooming = '0';
        return;
      }

    // Toggle fundo
    if (e.target.closest('.btn-bg')) {
      if (wrap.dataset.type === 'x' || wrap.dataset.type === 'ig') return;
      const cur = wrap.dataset.bg === 'on' ? 'on' : 'off';
      if (cur === 'on') {
        // restaurar original
        img.src = wrap.dataset.objurl;
        img.classList.remove('processed');
        wrap.dataset.bg = 'off';
        wrap.dataset.ct = 'off';
        // Atualizar indicador após mudança de imagem
        setTimeout(() => {
          if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
        }, 50);
      } else {
        // aplicar processamento (force=true para permitir sob demanda)
        if (!wrap.dataset.processedNo && !wrap.dataset.processedWith) {
          const result = await processImageVariants(wrap.dataset.objurl, 400, true);
          if (result.noOutlineUrl) wrap.dataset.processedNo = result.noOutlineUrl;
          if (result.outlineUrl) wrap.dataset.processedWith = result.outlineUrl;
        }
        // Usar sempre a versão SEM contorno e aplicar contorno via CSS (CT)
        const useUrl = wrap.dataset.processedNo || wrap.dataset.processedWith || wrap.dataset.objurl;
        if (useUrl) {
          img.src = useUrl;
          img.classList.add('processed');
          wrap.dataset.bg = 'on';
          // Atualizar indicador após mudança de imagem
          setTimeout(() => {
            if (wrap.updateSizeIndicator) wrap.updateSizeIndicator();
          }, 50);
        }
      }
      return;
    }

    // Toggle contorno: sem silhueta via CSS border; com silhueta troca PNG
    if (e.target.closest('.btn-ct')) {
      if (wrap.dataset.type === 'x' || wrap.dataset.type === 'ig') return;
      const turningOn = wrap.dataset.ct !== 'on';
      if (wrap.dataset.bg !== 'on') {
        // Fundo intacto: apenas liga/desliga borda via CSS
        wrap.dataset.ct = turningOn ? 'on' : 'off';
        return;
      }
      // Fundo removido: ao ligar CT, reprocessa com force=true para garantir espessura atual
      if (turningOn) {
        const result = await processImageVariants(wrap.dataset.objurl, 400, true);
        if (result.noOutlineUrl) wrap.dataset.processedNo = result.noOutlineUrl;
        if (result.outlineUrl) wrap.dataset.processedWith = result.outlineUrl;
      } else if (!wrap.dataset.processedNo) {
        // Garantir que existe a variante sem contorno ao desligar
        const result = await processImageVariants(wrap.dataset.objurl, 400, true);
        if (result.noOutlineUrl) wrap.dataset.processedNo = result.noOutlineUrl;
        if (result.outlineUrl) wrap.dataset.processedWith = result.outlineUrl;
      }
      const targetUrl = turningOn ? (wrap.dataset.processedWith || wrap.dataset.processedNo || wrap.dataset.objurl)
                                  : (wrap.dataset.processedNo || wrap.dataset.objurl);
      if (targetUrl) img.src = targetUrl;
      img.classList.add('processed');
      wrap.dataset.ct = turningOn ? 'on' : 'off';
      setTimeout(() => { if (wrap.updateSizeIndicator) wrap.updateSizeIndicator(); }, 50);
      return;
    }
    });
  }

  // Verificar se gallery existe antes de adicionar listeners
  if (gallery) {
    gallery.addEventListener('pointerdown', onPointerDown);
    gallery.addEventListener('pointermove', onPointerMove);
    gallery.addEventListener('pointerup', onPointerUp);
    gallery.addEventListener('pointercancel', onPointerUp);
  }

  // Aplica a redução para imagens existentes ao carregar o script
  applyGlobalOutlineThickness(0.75);

  // Listener do botão Adicionar ao Carrinho
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', addAllImagesToCart);
  }
})();
document.addEventListener('click', (e) => {
  try {
    const a = e.target.closest('.site-header .nav a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href || href === '#' || a.classList.contains('account-trigger')) return;
    e.preventDefault();
    window.location.href = href;
  } catch {}
});
// Efeito de corações no banner "Eles já estão" (likes subindo e desaparecendo)
document.addEventListener('DOMContentLoaded', () => {
  try {
    const banner = document.querySelector('.mural-banner');
    if (!banner) return;

    // Camada para os corações (não atrapalha o clique)
    const layer = document.createElement('div');
    layer.className = 'mural-hearts';
    layer.setAttribute('aria-hidden', 'true');
    banner.appendChild(layer);

    const heartImages = [
      'assets/EMOJIS/red-heart_2764-fe0f.png',
      'assets/EMOJIS/pink-heart_1fa77.png',
      'assets/EMOJIS/two-hearts_1f495.png',
      'assets/EMOJIS/yellow-heart_1f49b.png',
      'assets/EMOJIS/blue-heart_1f499.png'
    ];

    const spawnHeart = () => {
      const img = document.createElement('img');
      img.className = 'heart';
      img.alt = '';
      img.src = heartImages[Math.floor(Math.random() * heartImages.length)];

      // Distribuir próximo ao centro da imagem
      const offsetX = (Math.random() * 140) - 70; // -70px..70px
      const size = Math.floor(12 + Math.random() * 16); // 12..28px
      const duration = Math.floor(1400 + Math.random() * 900); // 1400..2300ms

      img.style.left = `${offsetX}px`;
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      img.style.animationDuration = `${duration}ms`;

      layer.appendChild(img);
      img.addEventListener('animationend', () => { img.remove(); });
      // Remoção de segurança
      setTimeout(() => { img.remove(); }, duration + 200);
    };

    // Emissão contínua, leve
    const interval = setInterval(spawnHeart, 700);

    // Toque extra ao passar o mouse
    banner.addEventListener('mouseenter', () => {
      spawnHeart(); spawnHeart();
    });

    // Parar se o banner for removido
    const obs = new MutationObserver(() => {
      if (!document.contains(banner)) {
        clearInterval(interval);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch (err) {
    // Silencioso: não quebrar outras funcionalidades
  }
});

// Card de Emojis: popular lista e sincronizar altura com o avatar
document.addEventListener('DOMContentLoaded', () => {
  try {
    const avatarImg = document.querySelector('.top-avatar img');
    const emojiCard = document.getElementById('emojiCard');
    const emojiList = document.getElementById('emojiList');
    if (!emojiCard || !emojiList) return;

    const emojiFiles = [
      'assets/EMOJIS/red-heart_2764-fe0f.png',
      'assets/EMOJIS/yellow-heart_1f49b.png',
      'assets/EMOJIS/blue-heart_1f499.png',
      'assets/EMOJIS/pink-heart_1fa77.png',
      'assets/EMOJIS/two-hearts_1f495.png',
      'assets/EMOJIS/star-struck_1f929.png',
      'assets/EMOJIS/thumbs-up_1f44d.png',
      'assets/EMOJIS/dog-face_1f436.png',
      'assets/EMOJIS/cat-face_1f431.png',
      'assets/EMOJIS/rocket_1f680.png',
      'assets/EMOJIS/balloon_1f388.png',
      'assets/EMOJIS/ghost_1f47b.png',
      'assets/EMOJIS/pizza_1f355.png',
      'assets/EMOJIS/wine-glass_1f377.png',
      'assets/EMOJIS/popcorn_1f37f.png',
      'assets/EMOJIS/sunflower_1f33b.png',
      'assets/EMOJIS/eyes_1f440.png',
      'assets/EMOJIS/party-popper_1f389.png',
      'assets/EMOJIS/rainbow_1f308.png',
      'assets/EMOJIS/face-with-tears-of-joy_1f602.png',
      'assets/EMOJIS/grinning-face_1f600.png'
    ];

    const populateList = () => {
      try {
        emojiList.innerHTML = '';
        emojiFiles.forEach((src) => {
          const li = document.createElement('li');
          const img = document.createElement('img');
          img.src = src; img.alt = '';
          li.appendChild(img);
          emojiList.appendChild(li);
        });
      } catch {}
    };

    const syncHeight = () => {
      try {
        if (!avatarImg) return;
        const linkEl = document.querySelector('.top-avatar-link') || avatarImg;
        const rect = linkEl.getBoundingClientRect();
        const h = Math.round(avatarImg.getBoundingClientRect().height);
        emojiCard.style.setProperty('--emoji-card-h', `${h}px`);
        emojiCard.style.maxHeight = `${h}px`;
        // Altura do card sincronizada; posição permanece fixa via CSS
      } catch {}
    };

    populateList();
    if (avatarImg) {
      if (avatarImg.complete) syncHeight();
      else avatarImg.addEventListener('load', syncHeight, { once: true });
    }
    window.addEventListener('resize', () => syncHeight());
  } catch {}
});
  async function openInstagramDesigner() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal-card x-designer-card">
        <header class="modal-header"><h2 class="modal-title">Criar seu Íma no estilo do Instagram</h2><button class="modal-close" type="button">×</button></header>
        <div class="ig-designer">
          <div class="x-preview">
            <div id="igCard" class="x-card ig-card" style="width:65mm;height:90mm;background-image:url('/assets/INSTAGRAM/modelo%20foto%20instagram.svg');background-size:cover;background-position:center;background-repeat:no-repeat;position:relative;border-radius:10px;">
              <div class="ig-top" style="position:absolute;left:4mm;top:4mm;right:4mm;height:12mm;display:flex;align-items:center;gap:4mm;">
                <div id="igBadge" class="ig-badge" style="width:12mm;height:12mm;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#9333ea,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.18);cursor:pointer;">Avatar</div>
                <div style="display:flex;align-items:center;gap:2mm;flex:1;">
                  <div id="igUser" style="font-weight:600">@Nome_usuário</div>
                  <div title="verificado" style="width:4mm;height:4mm;border-radius:50%;background:#0ea5e9;display:flex;align-items:center;justify-content:center;">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff"><path d="M9 16.2l-3.5-3.5 1.4-1.4L9 13.4l8.1-8.1 1.4 1.4z"/></svg>
                  </div>
                </div>
                <div style="margin-left:auto;display:flex;align-items:center;gap:3mm;">
                  <div class="pill" style="border:1px solid #999;border-radius:999px;padding:2px 6px;color:#111;font-size:11px;background:#f3f4f6">@imantados</div>
                  <div class="menu" aria-label="mais">⋯</div>
                </div>
              </div>
              <div id="igPhoto" class="ig-photo" style="position:absolute;left:4.5mm;top:16mm;width:56mm;height:70mm;border-radius:6mm;background:#f97316;display:grid;place-items:center;overflow:hidden;cursor:pointer;">
                <div style="color:#2f2f2f;font-size:16px;text-align:center;line-height:1.3">foto<br>usuario</div>
              </div>
              <div id="igMessage" class="ig-message" style="position:absolute;left:4mm;right:20mm;bottom:18mm;color:#111;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Mensagem do Cliente aqui....</div>
              <div class="ig-bottom" style="position:absolute;left:4mm;right:4mm;bottom:8mm;height:14mm;display:grid;grid-template-columns:1fr auto;gap:3mm;align-items:center;">
                <div style="display:flex;align-items:center;gap:6mm;color:#111;font-size:12px;">
                  <div style="display:flex;align-items:center;gap:2mm"><span>♡</span><span>5.864</span></div>
                  <div style="display:flex;align-items:center;gap:2mm"><span>💬</span><span>328</span></div>
                  <div style="display:flex;align-items:center;gap:2mm"><span>🔁</span><span>30</span></div>
                  <div style="display:flex;align-items:center;gap:2mm"><span>🎞️</span><span>1.624</span></div>
                </div>
                <div style="text-align:right;color:#9ca3af;font-size:11px">...mais</div>
              </div>
            </div>
          </div>
          <form class="x-form" autocomplete="off">
            <input id="inUser" type="text" placeholder="@Nome_usuário" value="@Nome_usuário">
            <textarea id="inCaption" rows="2" placeholder="Mensagem do Cliente aqui....">Mensagem do Cliente aqui....</textarea>
          </form>
          <div class="upload-actions" style="display:flex;gap:8px;align-items:center;padding:12px 16px;">
            <input id="inBadgeFile" type="file" accept="image/*" class="visualmente-hidden">
            <input id="inPhotoFile" type="file" accept="image/*" class="visualmente-hidden">
            <label class="btn btn-light" for="inBadgeFile">Carregar avatar do selo</label>
            <label class="btn btn-light" for="inPhotoFile">Carregar foto/avatar (56mm x 70mm)</label>
          </div>
        </div>
        <div class="x-actions">
          <button class="btn btn-light" type="button" id="igCancel">Cancelar</button>
          <button class="btn btn-primary" type="button" id="igAdd">Adicionar ao palco</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); };
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#igCancel').addEventListener('click', close);
    const bind = (sel, cb) => { const el = overlay.querySelector(sel); if (el) el.addEventListener('input', cb); };
    const inUserEl = overlay.querySelector('#inUser'); if (inUserEl) inUserEl.setAttribute('maxlength','24');
    const inCaptionEl = overlay.querySelector('#inCaption'); if (inCaptionEl) inCaptionEl.setAttribute('maxlength','64');
    bind('#inUser', (e) => { const t=(e.target.value || '@Nome_usuário').slice(0,24); const h=overlay.querySelector('#igUser'); if (h) h.textContent=t; });
    const limitCaption = (s) => { const max=64; return (s||'').length>max ? (s||'').slice(0,max-1)+'…' : (s||''); };
    bind('#inCaption', (e) => { const m=overlay.querySelector('#igMessage'); if (m) m.textContent = limitCaption(e.target.value || ''); });
    const inPhoto = overlay.querySelector('#inPhotoFile');
    if (inPhoto) {
      inPhoto.addEventListener('change', async () => {
        const f = inPhoto.files && inPhoto.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        const ph = overlay.querySelector('#igPhoto');
        ph.innerHTML = `<img src="${url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;">`;
      });
    }
    const inBadge = overlay.querySelector('#inBadgeFile');
    if (inBadge) {
      inBadge.addEventListener('change', async () => {
        const f = inBadge.files && inBadge.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        const bd = overlay.querySelector('#igBadge');
        bd.innerHTML = `<img src="${url}" alt="selo" style="width:100%;height:100%;object-fit:cover;">`;
      });
    }
    const bdEl = overlay.querySelector('#igBadge'); bdEl && bdEl.addEventListener('click', () => { try { const i = overlay.querySelector('#inBadgeFile'); i && i.click(); } catch {} });
    const phEl = overlay.querySelector('#igPhoto'); phEl && phEl.addEventListener('click', () => { try { const i = overlay.querySelector('#inPhotoFile'); i && i.click(); } catch {} });
    overlay.querySelector('#igAdd').addEventListener('click', async () => {
      try {
        await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        const el = overlay.querySelector('#igCard');
        const canvas = await window.html2canvas(el, { backgroundColor: '#ffffff', scale: window.devicePixelRatio || 1 });
        const dataUrl = canvas.toDataURL('image/png');
        await addImageFromUrl(dataUrl);
        const catModal = document.getElementById('categoryModal');
        if (catModal) { catModal.classList.add('visually-hidden'); catModal.setAttribute('aria-hidden','true'); }
        close();
      } catch { close(); }
    });
  }
