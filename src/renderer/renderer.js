// SnapPDF Renderer
// Handles UI, PDF parsing, image extraction, transparency, and saving

const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.js';

const state = {
  files: [],            // [{ path, name, size }]
  outputFolder: null,
  format: 'png',        // 'png' | 'jpg' | 'tiff'
  makeTransparent: true,
  threshold: 20,
  jpgQuality: 92,
  dedup: true,
  minWidth: 32,
  minHeight: 32,
  pageRange: '',        // '' = all, otherwise '1-5,8'
  cancelRequested: false,
  isExtracting: false
};

// --- DOM refs
const $ = (sel) => document.querySelector(sel);
const dropZone = $('#drop-zone');
const fileList = $('#file-list');
const fileCounter = $('#file-counter');
const outputFolderInput = $('#output-folder');
const extractBtn = $('#btn-extract');
const cancelBtn = $('#btn-cancel');
const openFolderBtn = $('#btn-open-folder');
const actionSub = $('#action-sub');
const progressCard = $('#progress-card');
const progressFill = $('#progress-fill');
const progressPercent = $('#progress-percent');
const progressMeta = $('#progress-meta');
const logEl = $('#log');
const statusBadge = $('#status-badge');
const thresholdEl = $('#threshold');
const thresholdVal = $('#threshold-val');
const transparentToggle = $('#toggle-transparent');
const dedupToggle = $('#toggle-dedup');
const minWidthEl = $('#min-width');
const minHeightEl = $('#min-height');
const pageRangeEl = $('#page-range');
const pageRangeRow = $('#page-range-row');
const thumbCard = $('#thumb-card');
const thumbGrid = $('#thumb-grid');
const thumbCountEl = $('#thumb-count');
const lightbox = $('#lightbox');
const lightboxImg = $('#lightbox-img');
const lightboxLabel = $('#lightbox-label');
const jpgQualityEl = $('#jpg-quality');
const jpgQualityVal = $('#jpg-quality-val');
const jpgQualityRow = $('#row-jpg-quality');

// --- Logging ---
function log(message, level = 'info') {
  const item = document.createElement('div');
  item.className = `log-item ${level}`;
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  item.innerHTML = `<span class="log-time">${t}</span><span class="log-msg"></span>`;
  item.querySelector('.log-msg').textContent = message;
  logEl.appendChild(item);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text, kind = 'idle') {
  statusBadge.textContent = text;
  statusBadge.className = 'badge';
  if (kind === 'working') statusBadge.classList.add('working');
  if (kind === 'error') statusBadge.classList.add('error');
}

function setStep(n) {
  document.querySelectorAll('.step').forEach((s) => {
    s.classList.toggle('active', Number(s.dataset.step) === n);
  });
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function refreshUI() {
  fileCounter.textContent = state.files.length;
  fileList.innerHTML = '';
  if (state.files.length === 0) {
    fileList.innerHTML = '<li class="empty">Nessun file caricato</li>';
  } else {
    state.files.forEach((f, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="file-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </span>
        <span class="file-name"></span>
        <span class="file-size">${fmtSize(f.size)}</span>
        <button class="file-remove" data-idx="${idx}" title="Rimuovi">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      li.querySelector('.file-name').textContent = f.name;
      li.querySelector('.file-remove').addEventListener('click', () => {
        state.files.splice(idx, 1);
        refreshUI();
        log(`File rimosso: ${f.name}`);
      });
      fileList.appendChild(li);
    });
  }
  // Page range: attivo solo con un singolo file
  const singleFile = state.files.length === 1;
  pageRangeEl.disabled = !singleFile;
  pageRangeRow.classList.toggle('disabled-row', !singleFile);
  if (!singleFile) {
    pageRangeEl.value = '';
    state.pageRange = '';
  } else {
    pageRangeEl.value = state.pageRange || '';
  }

  outputFolderInput.value = state.outputFolder || '';
  const ready = state.files.length > 0 && !!state.outputFolder;
  if (!state.isExtracting) {
    extractBtn.disabled = !ready;
  }
  if (ready && !state.isExtracting) {
    actionSub.textContent = `Pronto a estrarre da ${state.files.length} file in formato ${state.format.toUpperCase()}.`;
    setStep(3);
  } else if (state.files.length > 0 && !state.isExtracting) {
    actionSub.textContent = 'Manca solo la cartella di destinazione.';
    setStep(2);
  } else if (!state.isExtracting) {
    actionSub.textContent = 'Aggiungi almeno un PDF e una cartella di destinazione.';
    setStep(1);
  }
}

// --- File selection ---
$('#btn-select-pdfs').addEventListener('click', async () => {
  try {
    const files = await window.api.selectPdfs();
    addFiles(files);
  } catch (e) {
    log(`Errore selezione file: ${e.message}`, 'error');
  }
});

function addFiles(files) {
  if (!files || files.length === 0) return;
  let added = 0;
  files.forEach((f) => {
    if (!state.files.some((x) => x.path === f.path)) {
      state.files.push(f);
      added++;
    }
  });
  if (added > 0) {
    log(`${added} file aggiunto/i alla coda`, 'success');
    refreshUI();
  }
}

// Drag & drop (files AND folders)
dropZone.addEventListener('click', (ev) => {
  if (ev.target.closest('#btn-select-pdfs')) return;
  $('#btn-select-pdfs').click();
});
['dragenter', 'dragover'].forEach((e) =>
  dropZone.addEventListener(e, (ev) => {
    ev.preventDefault();
    dropZone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((e) =>
  dropZone.addEventListener(e, (ev) => {
    ev.preventDefault();
    dropZone.classList.remove('dragover');
  })
);
dropZone.addEventListener('drop', async (ev) => {
  const items = Array.from(ev.dataTransfer.files || []);
  const paths = items.map((f) => f.path).filter(Boolean);
  if (paths.length === 0) {
    log('Nessun file rilevato nel drop', 'warning');
    return;
  }
  try {
    // Resolve folders → list of PDFs (recursive)
    const resolved = await window.api.resolveDroppedPaths(paths);
    if (resolved.length === 0) {
      log('Nessun PDF trovato nei file/cartelle trascinati', 'warning');
      return;
    }
    addFiles(resolved);
  } catch (e) {
    log(`Errore lettura drop: ${e.message}`, 'error');
  }
});

$('#btn-clear').addEventListener('click', () => {
  state.files = [];
  refreshUI();
  log('Lista file svuotata');
});

// --- Folder ---
$('#btn-select-folder').addEventListener('click', async () => {
  try {
    const folder = await window.api.selectOutputFolder();
    if (folder) {
      state.outputFolder = folder;
      log(`Cartella destinazione: ${folder}`, 'success');
      persistConfig();
      refreshUI();
    }
  } catch (e) {
    log(`Errore selezione cartella: ${e.message}`, 'error');
  }
});

// --- Config ---
function syncFormatUI() {
  const isJpg = state.format === 'jpg';
  transparentToggle.disabled = isJpg;
  transparentToggle.parentElement.style.opacity = isJpg ? '0.4' : '1';
  transparentToggle.parentElement.title = isJpg
    ? 'JPG non supporta la trasparenza'
    : '';
  jpgQualityRow.style.display = isJpg ? 'flex' : 'none';
}

document.querySelectorAll('.seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.format = btn.dataset.format;
    syncFormatUI();
    log(`Formato impostato: ${state.format.toUpperCase()}`);
    persistConfig();
    refreshUI();
  });
});

transparentToggle.addEventListener('change', (e) => {
  state.makeTransparent = e.target.checked;
  log(`Sfondo trasparente: ${state.makeTransparent ? 'attivo' : 'disattivo'}`);
  persistConfig();
});

thresholdEl.addEventListener('input', (e) => {
  state.threshold = Number(e.target.value);
  thresholdVal.textContent = state.threshold;
});
thresholdEl.addEventListener('change', persistConfig);

dedupToggle.addEventListener('change', (e) => {
  state.dedup = e.target.checked;
  persistConfig();
});

minWidthEl.addEventListener('change', (e) => {
  state.minWidth = Math.max(0, Number(e.target.value) || 0);
  e.target.value = state.minWidth;
  persistConfig();
});
minHeightEl.addEventListener('change', (e) => {
  state.minHeight = Math.max(0, Number(e.target.value) || 0);
  e.target.value = state.minHeight;
  persistConfig();
});

pageRangeEl.addEventListener('change', (e) => {
  state.pageRange = e.target.value.trim();
  persistConfig();
});

jpgQualityEl.addEventListener('input', (e) => {
  state.jpgQuality = Number(e.target.value);
  jpgQualityVal.textContent = state.jpgQuality;
});
jpgQualityEl.addEventListener('change', persistConfig);

$('#btn-clear-log').addEventListener('click', () => {
  logEl.innerHTML = '';
  log('Log pulito');
});

// --- Persistent config ---
async function persistConfig() {
  try {
    await window.api.saveConfig({
      outputFolder: state.outputFolder,
      format: state.format,
      makeTransparent: state.makeTransparent,
      threshold: state.threshold,
      jpgQuality: state.jpgQuality,
      dedup: state.dedup,
      minWidth: state.minWidth,
      minHeight: state.minHeight,
      pageRange: state.pageRange
    });
  } catch { /* non-fatal */ }
}

async function loadPersistedConfig() {
  try {
    const cfg = await window.api.loadConfig();
    if (!cfg) return;
    if (cfg.outputFolder) state.outputFolder = cfg.outputFolder;
    if (cfg.format) {
      state.format = cfg.format;
      document.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.format === cfg.format);
      });
    }
    if (typeof cfg.makeTransparent === 'boolean') {
      state.makeTransparent = cfg.makeTransparent;
      transparentToggle.checked = cfg.makeTransparent;
    }
    if (typeof cfg.threshold === 'number') {
      state.threshold = cfg.threshold;
      thresholdEl.value = cfg.threshold;
      thresholdVal.textContent = cfg.threshold;
    }
    if (typeof cfg.jpgQuality === 'number') {
      state.jpgQuality = cfg.jpgQuality;
      jpgQualityEl.value = cfg.jpgQuality;
      jpgQualityVal.textContent = cfg.jpgQuality;
    }
    if (typeof cfg.dedup === 'boolean') {
      state.dedup = cfg.dedup;
      dedupToggle.checked = cfg.dedup;
    }
    if (typeof cfg.minWidth === 'number') {
      state.minWidth = cfg.minWidth;
      minWidthEl.value = cfg.minWidth;
    }
    if (typeof cfg.minHeight === 'number') {
      state.minHeight = cfg.minHeight;
      minHeightEl.value = cfg.minHeight;
    }
    if (typeof cfg.pageRange === 'string') {
      state.pageRange = cfg.pageRange;
      pageRangeEl.value = cfg.pageRange;
    }
  } catch { /* non-fatal */ }
}

// --- Page range parsing ---
function parsePageRange(spec, total) {
  if (!spec || !spec.trim()) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set();
  const parts = spec.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) {
        if (i >= 1 && i <= total) set.add(i);
      }
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= total) set.add(n);
    }
  }
  return [...set].sort((a, b) => a - b);
}

// --- Cancel + Open folder buttons ---
cancelBtn.addEventListener('click', () => {
  state.cancelRequested = true;
  cancelBtn.disabled = true;
  log('Annullamento richiesto...', 'warning');
});

openFolderBtn.addEventListener('click', async () => {
  if (state.outputFolder) {
    try {
      await window.api.openFolder(state.outputFolder);
    } catch (e) {
      log(`Impossibile aprire la cartella: ${e.message}`, 'error');
    }
  }
});

// --- Extraction ---
extractBtn.addEventListener('click', async () => {
  if (state.files.length === 0 || !state.outputFolder) return;

  state.isExtracting = true;
  state.cancelRequested = false;
  window.api.setBusy(true).catch(() => {});
  extractBtn.disabled = true;
  extractBtn.classList.add('hidden');
  cancelBtn.classList.remove('hidden');
  cancelBtn.disabled = false;
  openFolderBtn.classList.add('hidden');
  setStatus('In elaborazione', 'working');
  progressCard.classList.remove('hidden');
  updateProgress(0, 'Avvio...');
  actionSub.textContent = 'Estrazione in corso. Puoi annullare in qualsiasi momento.';
  clearThumbnails();
  log(`Inizio estrazione di ${state.files.length} file`, 'info');

  let totalSaved = 0;
  let totalSkippedSmall = 0;
  let totalSkippedDup = 0;
  let failed = 0;

  outer: for (let i = 0; i < state.files.length; i++) {
    if (state.cancelRequested) break;
    const file = state.files[i];
    const fileBase = (i / state.files.length) * 100;
    updateProgress(fileBase, `Lettura: ${file.name}`);
    try {
      const buffer = await window.api.readPdf(file.path);
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      const pagesToProcess = parsePageRange(state.pageRange, pdf.numPages);
      log(`${file.name}: ${pdf.numPages} pagine, elaboro ${pagesToProcess.length}`, 'info');
      if (pagesToProcess.length === 0) {
        log(`${file.name}: range pagine vuoto, salto`, 'warning');
        try { await pdf.destroy(); } catch { /* ignore */ }
        continue;
      }

      let imgIndex = 0;
      const dupHashes = new Set(); // per-PDF dedup

      for (let pi = 0; pi < pagesToProcess.length; pi++) {
        if (state.cancelRequested) {
          try { await pdf.destroy(); } catch { /* ignore */ }
          break outer;
        }
        const p = pagesToProcess[pi];
        const page = await pdf.getPage(p);
        updateProgress(
          fileBase + ((pi + 1) / pagesToProcess.length) * (100 / state.files.length),
          `${file.name} — pagina ${p} (${pi + 1}/${pagesToProcess.length})`
        );

        let ops;
        try {
          ops = await page.getOperatorList();
        } catch (err) {
          log(`${file.name} pag.${p}: impossibile leggere operatori (${err.message})`, 'warning');
          await safeCleanup(page);
          await yieldToUI();
          continue;
        }

        const seen = new Set();
        for (let k = 0; k < ops.fnArray.length; k++) {
          if (state.cancelRequested) break;
          const fn = ops.fnArray[k];
          if (
            fn === pdfjsLib.OPS.paintImageXObject ||
            fn === pdfjsLib.OPS.paintInlineImageXObject ||
            fn === pdfjsLib.OPS.paintJpegXObject ||
            fn === pdfjsLib.OPS.paintImageMaskXObject
          ) {
            const imgName = ops.argsArray[k][0];
            if (typeof imgName !== 'string' || seen.has(imgName)) continue;
            seen.add(imgName);
            try {
              const imgObj = await getImageObject(page, imgName);
              if (!imgObj) continue;
              const canvas = imgToCanvas(imgObj);
              if (!canvas) continue;

              // Min-size filter
              if (canvas.width < state.minWidth || canvas.height < state.minHeight) {
                totalSkippedSmall++;
                canvas.width = canvas.height = 0;
                continue;
              }

              // Deduplication via fast pixel hash (pre-transparency)
              if (state.dedup) {
                const h = quickHash(canvas);
                if (dupHashes.has(h)) {
                  totalSkippedDup++;
                  canvas.width = canvas.height = 0;
                  continue;
                }
                dupHashes.add(h);
              }

              if (state.makeTransparent) {
                applyWhiteToTransparent(canvas, state.threshold);
              }
              const buf = await canvasToBuffer(canvas, state.format);
              imgIndex++;
              const baseName = sanitize(file.name.replace(/\.pdf$/i, ''));
              const filename = `${baseName}/p${String(p).padStart(3, '0')}_img${String(imgIndex).padStart(3, '0')}.${fileExt(state.format)}`;
              await window.api.saveImage({
                folder: state.outputFolder,
                filename,
                data: buf
              });
              totalSaved++;
              addThumbnail(canvas, filename);
              canvas.width = canvas.height = 0;
              await yieldToUI();
            } catch (err) {
              failed++;
              log(`Errore immagine in ${file.name} pag.${p}: ${err.message}`, 'warning');
            }
          }
        }

        await safeCleanup(page);
        await yieldToUI();
      }

      try { await pdf.cleanup(); } catch { /* ignore */ }
      try { await pdf.destroy(); } catch { /* ignore */ }
      log(`${file.name}: ${imgIndex} immagini salvate`, 'success');
    } catch (err) {
      failed++;
      log(`Impossibile elaborare ${file.name}: ${err.message}`, 'error');
    }
  }

  // --- Finalize ---
  state.isExtracting = false;
  window.api.setBusy(false).catch(() => {});
  cancelBtn.classList.add('hidden');
  extractBtn.classList.remove('hidden');
  extractBtn.disabled = false;

  if (state.cancelRequested) {
    updateProgress(100, 'Annullato');
    setStatus('Annullato', 'error');
    log(`Estrazione annullata: ${totalSaved} immagini salvate prima dell'interruzione`, 'warning');
  } else {
    updateProgress(100, 'Completato');
    setStatus('Pronto', 'idle');
    const skippedMsg = [];
    if (totalSkippedSmall > 0) skippedMsg.push(`${totalSkippedSmall} sotto la dimensione minima`);
    if (totalSkippedDup > 0) skippedMsg.push(`${totalSkippedDup} duplicate`);
    const skipText = skippedMsg.length ? ` — saltate: ${skippedMsg.join(', ')}` : '';
    if (totalSaved > 0) {
      log(`Estrazione completata: ${totalSaved} immagini salvate${skipText} (${failed} errori)`, 'success');
      openFolderBtn.classList.remove('hidden');
    } else {
      log(`Nessuna immagine estratta${skipText}. Verifica filtri o contenuto PDF.`, 'warning');
    }
  }

  refreshUI();
});

function updateProgress(pct, meta) {
  pct = Math.max(0, Math.min(100, pct));
  progressFill.style.width = `${pct}%`;
  progressPercent.textContent = `${Math.round(pct)}%`;
  progressMeta.textContent = meta;
}

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

function fileExt(format) {
  return format === 'tiff' ? 'tiff' : format; // png, jpg, tiff
}

// Fast perceptual-style hash: downscale to 8x8 grayscale and sample
function quickHash(canvas) {
  const small = document.createElement('canvas');
  small.width = 8;
  small.height = 8;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, 8, 8);
  const d = sctx.getImageData(0, 0, 8, 8).data;
  let avg = 0;
  const grays = new Array(64);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i] + d[i + 1] + d[i + 2]) / 3;
    grays[j] = g;
    avg += g;
  }
  avg /= 64;
  let bits = '';
  for (let j = 0; j < 64; j++) bits += grays[j] >= avg ? '1' : '0';
  // include dimensions to avoid colliding tiny vs big with same pattern
  return `${canvas.width}x${canvas.height}:${bits}`;
}

function getImageObject(page, name) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (o) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(o);
    };
    const timer = setTimeout(() => finish(null), 8000);

    const tryCommon = () => {
      try {
        page.commonObjs.get(name, (o) => finish(o));
      } catch {
        finish(null);
      }
    };

    try {
      page.objs.get(name, (o) => finish(o));
    } catch {
      tryCommon();
    }
  });
}

function safeCleanup(page) {
  return new Promise((resolve) => {
    try {
      const r = page.cleanup();
      if (r && typeof r.then === 'function') r.then(resolve, () => resolve());
      else resolve();
    } catch {
      resolve();
    }
  });
}

function yieldToUI() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function imgToCanvas(img) {
  let width = img.width;
  let height = img.height;
  const canvas = document.createElement('canvas');

  if (img.bitmap) {
    width = img.bitmap.width;
    height = img.bitmap.height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img.bitmap, 0, 0);
    return canvas;
  }

  if (!img.data || !width || !height) return null;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;
  const src = img.data;
  const kind = img.kind || guessKind(src.length, width, height);

  if (kind === 1) {
    let bit = 0;
    for (let i = 0; i < width * height; i++) {
      const byte = src[bit >> 3];
      const v = (byte >> (7 - (bit & 7))) & 1 ? 255 : 0;
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
      out[i * 4 + 3] = 255;
      bit++;
      if (bit % width === 0) bit = Math.ceil(bit / 8) * 8;
    }
  } else if (kind === 2) {
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
      out[j] = src[i];
      out[j + 1] = src[i + 1];
      out[j + 2] = src[i + 2];
      out[j + 3] = 255;
    }
  } else if (kind === 3) {
    out.set(src);
  } else if (src.length === width * height) {
    for (let i = 0, j = 0; i < src.length; i++, j += 4) {
      out[j] = out[j + 1] = out[j + 2] = src[i];
      out[j + 3] = 255;
    }
  } else if (src.length === width * height * 4) {
    out.set(src);
  } else if (src.length === width * height * 3) {
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
      out[j] = src[i];
      out[j + 1] = src[i + 1];
      out[j + 2] = src[i + 2];
      out[j + 3] = 255;
    }
  } else {
    return null;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function guessKind(len, w, h) {
  if (len === w * h * 4) return 3;
  if (len === w * h * 3) return 2;
  if (len === w * h) return 0;
  if (len === Math.ceil(w / 8) * h) return 1;
  return 2;
}

function applyWhiteToTransparent(canvas, tolerance) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const t = 255 - tolerance;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= t && d[i + 1] >= t && d[i + 2] >= t) {
      d[i + 3] = 0;
    } else if (
      tolerance > 0 &&
      d[i] >= t - 15 &&
      d[i + 1] >= t - 15 &&
      d[i + 2] >= t - 15
    ) {
      const minV = Math.min(d[i], d[i + 1], d[i + 2]);
      const a = Math.max(0, Math.min(255, ((t - minV) / 15) * 255));
      d[i + 3] = a;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

async function canvasToBuffer(canvas, format) {
  if (format === 'png') {
    return await blobFromCanvas(canvas, 'image/png');
  }
  if (format === 'jpg') {
    const flat = flattenOnWhite(canvas);
    return await blobFromCanvas(flat, 'image/jpeg', state.jpgQuality / 100);
  }
  // TIFF via UTIF (preserves alpha)
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tiff = window.UTIF.encodeImage(data.data, canvas.width, canvas.height);
  return new Uint8Array(tiff);
}

function blobFromCanvas(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error(`Impossibile creare ${mime}`));
        const ab = await blob.arrayBuffer();
        resolve(new Uint8Array(ab));
      },
      mime,
      quality
    );
  });
}

function flattenOnWhite(canvas) {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

// --- Thumbnails ---
let thumbTotalCount = 0;

function clearThumbnails() {
  thumbGrid.innerHTML = '';
  thumbTotalCount = 0;
  thumbCountEl.textContent = '0';
  thumbCard.classList.add('hidden');
}

function addThumbnail(srcCanvas, filename) {
  // Full-res data URL for the lightbox (original size, capped at 2400px to
  // avoid massive data URIs on huge images)
  const MAX_LB = 2400;
  let fullDataUrl;
  if (srcCanvas.width <= MAX_LB && srcCanvas.height <= MAX_LB) {
    fullDataUrl = srcCanvas.toDataURL('image/png');
  } else {
    const lbScale = Math.min(MAX_LB / srcCanvas.width, MAX_LB / srcCanvas.height);
    const lbc = document.createElement('canvas');
    lbc.width  = Math.round(srcCanvas.width  * lbScale);
    lbc.height = Math.round(srcCanvas.height * lbScale);
    lbc.getContext('2d').drawImage(srcCanvas, 0, 0, lbc.width, lbc.height);
    fullDataUrl = lbc.toDataURL('image/png');
  }

  // Small thumbnail for the strip (96px box)
  const THUMB = 96;
  const tc = document.createElement('canvas');
  const scale = Math.min(THUMB / srcCanvas.width, THUMB / srcCanvas.height, 1);
  tc.width  = Math.round(srcCanvas.width  * scale);
  tc.height = Math.round(srcCanvas.height * scale);
  tc.getContext('2d').drawImage(srcCanvas, 0, 0, tc.width, tc.height);
  const thumbDataUrl = tc.toDataURL('image/png');

  const item = document.createElement('div');
  item.className = 'thumb-item';
  const img = document.createElement('img');
  img.src = thumbDataUrl;
  img.alt = filename;
  const label = document.createElement('span');
  label.className = 'thumb-filename';
  label.textContent = filename.split('/').pop();
  item.append(img, label);

  item.addEventListener('click', () => {
    lightboxImg.src = fullDataUrl;
    lightboxLabel.textContent = filename;
    lightbox.classList.remove('hidden');
  });

  thumbGrid.appendChild(item);
  thumbGrid.scrollLeft = thumbGrid.scrollWidth;

  thumbTotalCount++;
  thumbCountEl.textContent = thumbTotalCount;
  if (thumbCard.classList.contains('hidden')) {
    thumbCard.classList.remove('hidden');
  }
}

$('#btn-clear-thumbs').addEventListener('click', clearThumbnails);

// Lightbox close
$('#lightbox-close').addEventListener('click', () => lightbox.classList.add('hidden'));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) lightbox.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') lightbox.classList.add('hidden');
});

// --- Auto-updater UI ---
const updatePill = $('#update-pill');
const updateText = $('#update-text');
const updateInstallBtn = $('#btn-install-update');
const appVersionEl = $('#app-version');

function setUpdateState(klass, text, showInstall = false) {
  updatePill.classList.remove('hidden', 'checking', 'downloading', 'ready', 'error');
  if (klass) updatePill.classList.add(klass);
  updateText.textContent = text;
  updateInstallBtn.classList.toggle('hidden', !showInstall);
}

function hideUpdatePill() {
  updatePill.classList.add('hidden');
}

updateInstallBtn.addEventListener('click', async () => {
  log('Riavvio per installare l\'aggiornamento...', 'info');
  await window.api.installUpdateNow();
});

if (window.api.onUpdaterEvent) {
  window.api.onUpdaterEvent(({ event, payload }) => {
    switch (event) {
      case 'checking':
        setUpdateState('checking', 'Verifica aggiornamenti...');
        break;
      case 'available':
        setUpdateState('downloading', `Download v${payload && payload.version}...`);
        log(`Aggiornamento disponibile: v${payload && payload.version}`, 'info');
        break;
      case 'not-available':
        // Briefly show "you're up to date" then hide
        setUpdateState(null, 'Sei aggiornato');
        setTimeout(hideUpdatePill, 3000);
        break;
      case 'download-progress': {
        const pct = Math.round((payload && payload.percent) || 0);
        setUpdateState('downloading', `Download ${pct}%...`);
        break;
      }
      case 'downloaded':
        setUpdateState('ready', `v${payload && payload.version} pronta`, true);
        log(`Aggiornamento scaricato: clicca "Installa" per applicarlo`, 'success');
        break;
      case 'error':
        // Silent in UI for "no internet" type errors — just hide pill
        if (payload && /404|net::|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(payload.message || '')) {
          hideUpdatePill();
        } else {
          setUpdateState('error', 'Errore aggiornamento');
          setTimeout(hideUpdatePill, 6000);
        }
        break;
    }
  });
}

// --- About modal ---
const aboutOverlay = $('#about-overlay');
const aboutVersionEl = $('#about-version');

function openAbout() { aboutOverlay.classList.remove('hidden'); }
function closeAbout() { aboutOverlay.classList.add('hidden'); }

$('#btn-about').addEventListener('click', openAbout);
$('#btn-about-close').addEventListener('click', closeAbout);
aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) closeAbout(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAbout(); });

// --- Init ---
(async () => {
  await loadPersistedConfig();
  syncFormatUI();
  refreshUI();
  try {
    const v = await window.api.appVersion();
    if (v) {
      appVersionEl.textContent = `v${v}`;
      aboutVersionEl.textContent = `v${v}`;
    }
  } catch { /* ignore */ }
  log('SnapPDF avviato. Carica i tuoi PDF per iniziare.', 'success');
  if (state.outputFolder) {
    log(`Cartella precedente recuperata: ${state.outputFolder}`, 'info');
  }
})();
