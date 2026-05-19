# SnapPDF 🐔

> Cattura al volo tutte le immagini intrappolate nei tuoi PDF.

Applicazione desktop per Windows (Electron + NSIS) che permette di:
- caricare uno o più PDF (drag & drop di file *o cartelle*, oppure sfoglia)
- estrarre le immagini contenute al loro interno
- convertire automaticamente lo sfondo bianco in trasparente (con tolleranza regolabile)
- salvarle in **PNG**, **JPG** (con qualità regolabile) o **TIFF** nella cartella scelta
- saltare automaticamente immagini duplicate o sotto una soglia minima
- limitare l'estrazione a un range di pagine
- vedere tutti i messaggi direttamente in app, senza popup esterni
- ricevere automaticamente gli **aggiornamenti** (electron-updater)

## Requisiti per la compilazione

Da installare **una volta sola** sulla macchina Windows che genera l'installer:

1. **Node.js LTS** (≥ 18) — https://nodejs.org/

(Inno Setup non serve più: l'installer NSIS è generato direttamente da electron-builder.)

## Compilazione automatica

Apri il prompt dei comandi nella cartella del progetto e lancia:

```bat
build.bat
```

Lo script esegue in sequenza:
1. Verifica Node.js
2. `npm install` (Electron, pdf.js, utif, electron-builder, electron-updater)
3. Copia di pdf.js / pdf.worker.js / utif.js / icon.png nella cartella vendor del renderer
4. Build dell'app + installer NSIS → `dist/SnapPDF-Setup-1.0.0.exe`

Al termine il file `.exe` di setup viene aperto automaticamente in Esplora risorse, insieme al file `latest.yml` necessario per gli aggiornamenti automatici.

## Aggiornamenti automatici

SnapPDF integra `electron-updater`: all'avvio l'app contatta in background il server di aggiornamenti, e se trova una versione più recente la scarica automaticamente. Quando il download è completo appare un piccolo pulsante **"Installa"** in alto a destra: cliccandolo l'app si chiude, installa l'aggiornamento e si riavvia.

### Come pubblicare un nuovo aggiornamento

Gli aggiornamenti sono gestiti tramite **GitHub Releases** del repo `AS-geopavia/snappdf`.

**Setup iniziale (una sola volta):**

1. Crea un Personal Access Token (classic) con scope `repo` su https://github.com/settings/tokens
2. Imposta la variabile d'ambiente `GH_TOKEN`:
   ```bat
   set GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```
   (oppure, da Pannello di Controllo → Sistema → Variabili d'ambiente, per renderla permanente)

**Per ogni nuovo rilascio:**

1. Aumenta `version` in `package.json` (es. `"1.0.0"` → `"1.0.1"`)
2. Lancia `release.bat`
3. Lo script compila l'app, carica `SnapPDF-Setup-X.X.X.exe`, `latest.yml` e il blockmap su una **draft release** del repo
4. Apri https://github.com/AS-geopavia/snappdf/releases (lo script lo apre da solo) e clicca **"Publish release"**

Una volta pubblicata, tutti gli utenti già installati riceveranno l'aggiornamento al prossimo avvio dell'app.

### Build locale senza pubblicare

Se vuoi solo generare l'installer per test (senza caricarlo su GitHub):

```bat
build.bat
```

Genera il file in `dist/SnapPDF-Setup-1.0.0.exe` ma non tocca GitHub.

## Struttura del progetto

```
snappdf/
├── build.bat                 # Script di automazione completo
├── package.json
├── assets/
│   ├── icon.ico              # Icona dell'app (multi-risoluzione)
│   └── icon.png              # PNG sorgente per il logo in app
├── src/
│   ├── main.js               # Processo principale Electron (+ updater)
│   ├── preload.js            # Bridge sicuro renderer ↔ main
│   └── renderer/
│       ├── index.html        # UI
│       ├── styles.css        # Stile chiaro, compatto, no scroll
│       ├── renderer.js       # Logica estrazione immagini + UI updater
│       └── vendor/           # popolata da build.bat
└── README.md
```

## Sviluppo / test rapido

```bat
npm install
npm start
```

(in modalità sviluppo serve eseguire prima `build.bat` almeno una volta, oppure copiare manualmente i file `pdf.js`, `pdf.worker.js`, `utif.js`, `icon.png` da `node_modules` / `assets` in `src/renderer/vendor/`).

In sviluppo `electron-updater` non scarica nulla (non c'è modo di "auto-installare" in dev mode); l'icona di stato resta nascosta.

## Avvio veloce

La finestra resta nascosta finché il contenuto non è completamente renderizzato (`ready-to-show`), evitando il classico flash bianco. Lo `backgroundColor` è impostato sul colore del tema, gli script sono caricati con `defer` per il parsing parallelo, e il `backgroundThrottling` è disabilitato per non rallentare l'estrazione quando la finestra perde il focus.

## Note tecniche

- **Estrazione immagini reali**: usa l'API `getOperatorList()` di PDF.js e ne ricava gli oggetti `paintImageXObject`, `paintInlineImageXObject`, `paintJpegXObject` e `paintImageMaskXObject`.
- **Sfondo bianco → trasparente**: applica una soglia regolabile dall'utente (default 20). I pixel con tutti e tre i canali RGB ≥ `255-soglia` diventano completamente trasparenti; quelli vicini al limite vengono sfumati per evitare bordi netti.
- **PNG**: encoding nativo via `canvas.toBlob`.
- **JPG**: encoding nativo, qualità configurabile (60-100%). Eventuali pixel trasparenti vengono appiattiti su sfondo bianco (JPG non supporta l'alpha).
- **TIFF**: encoding via libreria UTIF (mantiene il canale alfa).
- **Deduplicazione**: hash perceptual 8×8 in scala di grigi per scartare immagini ripetute (loghi, header).
- **Filtro dimensione minima**: scarta micro-immagini (icone, glifi, decorazioni) prima del processing pesante.
- **Range pagine**: sintassi tipo stampante (`1-5,8,12-20`).
- **Annullamento**: il loop di estrazione controlla un flag `cancelRequested` ad ogni iterazione.
- **Memoria**: dopo ogni pagina viene chiamato `page.cleanup()`, e a fine documento `pdf.cleanup()` + `pdf.destroy()` per evitare accumulo su PDF molto grandi.
- **Configurazione persistente**: cartella di output, formato, qualità, soglia, dedup, dimensioni minime, range pagine vengono salvati in `%APPDATA%/SnapPDF/snappdf-config.json`.
- **Aggiornamenti**: `electron-updater` con provider `generic` (URL configurabile in `package.json`).
- **Nessun popup esterno**: tutti i messaggi (info, warning, errori) sono mostrati nel pannello "Messaggi" dell'app.
- **Sicurezza**: `contextIsolation: true`, `nodeIntegration: false`, IPC tramite `preload.js` con `contextBridge`.

## Personalizzazione

- Cambia l'icona sostituendo `assets/icon.ico` (256×256 consigliato) e `assets/icon.png`.
- Cambia versione/nome modificando `package.json`.
- Cambia colori dell'UI nel blocco `:root` di `src/renderer/styles.css`.
- Cambia URL aggiornamenti in `package.json` → `build.publish.url`.
