const fs = require('fs');
const { Transformer } = require('markmap-lib');

// ---------------------------------------------------------------------------
// I/O paths (unchanged from the original build)
// ---------------------------------------------------------------------------
const markdownPath = './cancer_workflow.md';
const outputPath = './index.html';

// ---------------------------------------------------------------------------
// Read + transform. The transformed `root` is injected BYTE-FOR-BYTE identical
// to the original build (same Transformer output) -- we only wrap chrome around
// it. Do NOT mutate the medical content or tree structure.
// ---------------------------------------------------------------------------
const markdown = fs.readFileSync(markdownPath, 'utf-8');
const transformer = new Transformer();
const { root, frontmatter } = transformer.transform(markdown);

// ---------------------------------------------------------------------------
// Build-time STATS (computed in Node from the markdown / root, injected as
// literals so the cards need zero client JS). These replace BCM's Open/Total.
// ---------------------------------------------------------------------------
const META_RE = /New Trials to add|Recently Integrated|Emerging/i;
const stripTags = (s) => (s || '').replace(/<[^>]*>/g, '').trim();

// Clinical scope = the non-meta top-level branches only. root.children.length
// is 8; the two author "working notes" branches (New Trials to add; Recently
// Integrated / Emerging) are muted in the UI and MUST NOT inflate any card, so
// every stat below is computed over this same slice for internal consistency.
const clinicalRoots = (root.children || []).filter(
  (c) => !META_RE.test(stripTags(c.content))
);

// Subtypes / clinical branches = 6 (one is hereditary/premalignant, the rest
// are molecular tumour subtypes) -- matches the six colour bands and chips.
const subtypeCount = clinicalRoots.length; // 6

// Walk each clinical subtree over the TRANSFORMED node content (the very same
// content the client renders) so counts always agree with what is on canvas.
//   - recommendations: every [x] renders as an inline checkbox SVG.
//   - trials & evidence: every **bold** renders as <strong>...</strong>;
//     composite tags (SOFT/TEXT) are kept whole, deduped case-insensitively.
//   - thresholds: only BIOMARKER (RS/MPI) routing arrows count -- the three
//     "...HP → maintenance..." arrows are treatment SEQUENCING, not cut-offs.
// Scoping this way drops the 4 duplicate [x] under "Integrated into tree above"
// and the 3 emerging-only trials (VERITAC-2, ELAINE-3, Tropion-Breast02/03/05).
const boldTokens = [];
let recCount = 0;
let thresholdCount = 0;
(function walkStats(node) {
  const content = (node && node.content) || '';
  if (/viewBox="0 -3 24 24"/.test(content)) recCount += 1;
  const strongs = content.match(/<strong>([\s\S]*?)<\/strong>/g) || [];
  strongs.forEach((s) =>
    boldTokens.push(
      s.replace(/<\/?strong>/g, '').replace(/&amp;/g, '&').trim().toUpperCase()
    )
  );
  if (content.indexOf('→') >= 0 && /\b(?:RS|MPI)\b/.test(content)) thresholdCount += 1;
  (node.children || []).forEach(walkStats);
})({ children: clinicalRoots }); // synthetic wrapper: no content, walks the 6

const trialsDistinct = new Set(boldTokens).size; // 69 distinct clinical trials/tags
const citationsTotal = boldTokens.length; // 221 total clinical citations
// recCount -> 351 clinical recommendations; thresholdCount -> 27 biomarker cut-offs.

// Human-readable build date (a compile date, NOT a registry timestamp).
const buildDate = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

// ---------------------------------------------------------------------------
// markmap jsonOptions: merge the author's front-matter markmap block FIRST,
// then deliberately override. colorFreezeLevel:2 is the single most load-bearing
// fix -- it produces one consistent color per tumour subtype (root = 1 path
// segment, subtype = 2). The front-matter's 8 never truncates this depth-7 tree
// and yields a rainbow-per-node.
//
// `color` is a colourblind-safe Okabe-Ito array. scaleOrdinal assigns colours in
// first-seen (DFS) order: root consumes slot 0, then the 6 subtypes get slots
// 1-6, then the 2 meta branches get the trailing greys. Legend/chip swatches are
// still derived from the LIVE scale at runtime so they always match the canvas.
// ---------------------------------------------------------------------------
const fmOptions = (frontmatter && frontmatter.markmap) || {};
const jsonOptions = Object.assign({}, fmOptions, {
  initialExpandLevel: 2,
  maxWidth: 300,
  colorFreezeLevel: 2,
  duration: 400,
  spacingVertical: 10,
  spacingHorizontal: 90,
  autoFit: true,
  color: [
    '#8b5cf6', // slot 0 -> root (rarely seen)
    '#CC79A7', // Familial / Hereditary
    '#009E73', // Premenopausal HR+ HER2-
    '#0072B2', // Postmenopausal HR+ HER2-
    '#E69F00', // HR- HER2+
    '#D55E00', // Triple Positive
    '#56B4E9', // Triple Negative
    '#94a3b8', // meta branch (muted)
    '#94a3b8', // meta branch (muted)
  ],
});

// Inject safely: escape "<" so a stray "</script>" inside content can never
// terminate the script block. < decodes back to "<" so data stays identical.
const rootJson = JSON.stringify(root).replace(/</g, '\\u003c');
const optsJson = JSON.stringify(jsonOptions).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// HTML template. Single self-contained file; external CDN + Google Font links
// are permitted (GitHub Pages, not a CSP-restricted artifact).
// ---------------------------------------------------------------------------
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta http-equiv="X-UA-Compatible" content="ie=edge">
<title>Cancer Management</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markmap-toolbar@0.17.0/dist/style.css">
<script>
/* Seed the theme before first paint to avoid a flash of the wrong theme. */
(function () {
  try {
    var s = localStorage.getItem('cw-theme');
    var dark = s ? s === 'dark'
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
</script>
<style>
:root {
  --bg-gradient: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  --surface: #ffffff;
  --card-bg: rgba(255, 255, 255, 0.92);
  --header-bg: rgba(255, 255, 255, 0.95);
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --node-text: #1e293b;
  --node-muted: #475569; /* on-canvas italics: >=4.5:1 over the light gradient */
  --border: #e2e8f0;
  --accent: #334155;
  --link: #2563eb;
  --focus: #2563eb;
  --focus-ring: rgba(37, 99, 235, 0.35);
  --shadow: rgba(15, 23, 42, 0.10);
  --evidence-bg: rgba(100, 116, 139, 0.14);
  --hit-bg: rgba(37, 99, 235, 0.14);
}
:root[data-theme="dark"] {
  --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  --surface: #111a2b;
  --card-bg: rgba(30, 41, 59, 0.92);
  --header-bg: rgba(15, 23, 42, 0.95);
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --node-text: #e5edf7;
  --node-muted: #94a3b8; /* on-canvas italics stay light on the dark gradient */
  --border: #334155;
  --accent: #cbd5e1;
  --link: #7db3ff;
  --focus: #60a5fa;
  --focus-ring: rgba(96, 165, 250, 0.40);
  --shadow: rgba(0, 0, 0, 0.35);
  --evidence-bg: rgba(148, 163, 184, 0.20);
  --hit-bg: rgba(96, 165, 250, 0.20);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body {
  font-family: 'Nunito', -apple-system, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: var(--bg-gradient);
  color: var(--text-primary);
  overflow: hidden;
  transition: background 0.3s ease, color 0.3s ease;
}

/* ---------- Fixed top bar (header row + chip row) ---------- */
.topbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 1000;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 3px var(--shadow);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeIn 0.4s ease;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .topbar { background: var(--surface); }
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  flex-wrap: wrap;
}
.brand { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
.logo {
  width: 40px; height: 40px; border-radius: 10px;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; color: #fff; font-size: 17px; letter-spacing: 0.5px;
  flex: 0 0 auto;
}
.title-block h1 { font-size: 18px; font-weight: 700; line-height: 1.15; }
.title-block .subtitle { font-size: 12px; color: var(--text-secondary); margin-top: 1px; }

.header-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; flex: 1 1 240px; justify-content: flex-end; }

/* ---------- Search ---------- */
.search { position: relative; flex: 1 1 240px; max-width: 340px; }
.search-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--text-secondary); pointer-events: none;
}
#search {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px 10px 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 16px; /* >=16px avoids iOS zoom */
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
#search::placeholder { color: var(--text-secondary); }
#search:focus-visible, #search:focus {
  outline: none;
  border-color: var(--focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
#results {
  position: absolute;
  top: calc(100% + 8px); left: 0; right: 0;
  background: var(--card-bg);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  max-height: 380px; overflow-y: auto;
  box-shadow: 0 12px 40px var(--shadow);
  display: none;
  z-index: 1200;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  #results { background: var(--surface); }
}
#results.open { display: block; }
.res {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.res:last-child { border-bottom: none; }
.res:hover, .res.sel { background: var(--hit-bg); }
.res-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; margin-top: 5px; }
.res-main { min-width: 0; }
.res-name { font-size: 14px; font-weight: 600; }
.res-path { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
.res-none { padding: 12px 14px; font-size: 13px; color: var(--text-secondary); }

/* ---------- Icon buttons ---------- */
.icon-btn {
  width: 44px; height: 44px; flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.2s ease, color 0.2s ease;
}
.icon-btn:hover { border-color: var(--focus); color: var(--focus); }
.icon-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus-ring); }
:root[data-theme="dark"] .sun { display: block; }
:root[data-theme="dark"] .moon { display: none; }
.sun { display: none; }
.moon { display: block; }

/* ---------- Chip row (subtype quick-jump = navigation + legend) ---------- */
.chipbar {
  display: flex; gap: 8px;
  padding: 0 20px 10px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.chip {
  display: inline-flex; align-items: center; gap: 8px;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-primary);
  font-family: inherit; font-size: 13px; font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.1s ease;
}
.chip:hover { transform: translateY(-1px); }
.chip:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus-ring); }
.chip.active { border-color: currentColor; }
.chip.active .chip-tx { }
.chip-sw { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; }
.chip-hint { margin-left: 4px; align-self: center; font-size: 11.5px; color: var(--text-secondary); white-space: nowrap; }

/* ---------- Stat cards ---------- */
.stats {
  position: fixed; right: 16px;
  top: calc(var(--top-h, 112px) + 12px);
  display: flex; gap: 10px; z-index: 500;
  animation: fadeIn 0.4s ease;
}
.stat {
  background: var(--card-bg);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
  text-align: center; min-width: 84px;
  box-shadow: 0 4px 14px var(--shadow);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .stat { background: var(--surface); }
}
.stat-num { font-size: 22px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.stat-lbl { font-size: 10.5px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }

/* ---------- Legend ---------- */
.legend {
  position: fixed; bottom: 20px; left: 20px;
  width: 260px; max-width: calc(100vw - 40px);
  background: var(--card-bg);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  z-index: 500;
  box-shadow: 0 6px 24px var(--shadow);
  animation: fadeIn 0.4s ease;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .legend { background: var(--surface); }
}
.legend-head { display: flex; align-items: center; justify-content: space-between; }
.legend-head h3 {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: var(--text-secondary);
}
#legendToggle {
  display: none; border: none; background: none; cursor: pointer;
  color: var(--text-secondary); font-size: 16px; line-height: 1; padding: 4px;
}
.legend-body { margin-top: 10px; max-height: 46vh; overflow-y: auto; }
.legend.collapsed .legend-body { display: none; }
.lg-section-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary); margin: 8px 0 4px; }
.lg-row { display: flex; align-items: center; gap: 9px; padding: 3px 0; font-size: 12.5px; }
.lg-sw { width: 13px; height: 13px; border-radius: 4px; flex: 0 0 auto; }
.lg-dot { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; border: 2px solid var(--text-secondary); background: transparent; }
.lg-mark { flex: 0 0 auto; width: 20px; text-align: center; }
.lg-check { flex: 0 0 auto; color: var(--text-primary); display: inline-flex; }
.lg-tx { color: var(--text-primary); }
.lg-tx b { font-weight: 700; }
.lg-tx i { color: var(--text-secondary); }
.lg-bold-sample { font-weight: 700; background: var(--evidence-bg); padding: 0 5px; border-radius: 4px; }
.lg-link-sample { color: var(--link); text-decoration: underline; }
.lg-foot { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-secondary); }
.lg-foot kbd {
  font-family: inherit; font-size: 10.5px; padding: 1px 5px;
  border: 1px solid var(--border); border-radius: 5px; background: var(--surface);
}

/* ---------- Mindmap ---------- */
#mindmap {
  position: absolute;
  left: 0; top: var(--top-h, 112px);
  width: 100%;
  height: calc(100vh - var(--top-h, 112px));
  display: block;
}

/* THEME-AWARE NODE TEXT (TEXT ONLY -- never touches circle/link fill = bands).
   markmap renders labels as HTML inside .markmap-foreign and uses
   --markmap-text-color; we flip both so text stays legible in either theme. */
#mindmap { --markmap-text-color: var(--node-text); }
#mindmap .markmap-foreign,
#mindmap .markmap-foreign * {
  color: var(--node-text);
  font-family: 'Nunito', -apple-system, 'Segoe UI', sans-serif;
}
/* The [x] recommendation renders as an inline SVG checkbox with a default black
   fill (invisible in dark mode) -- make it follow the text colour. */
#mindmap .markmap-foreign svg { fill: currentColor; }
/* **bold** = pivotal trial / evidence tag: a hue-NEUTRAL chip, never a status
   colour, never competing with the subtype bands. */
#mindmap .markmap-foreign strong {
  font-weight: 700;
  background: var(--evidence-bg);
  padding: 0 4px;
  border-radius: 4px;
}
/* *italic* = category / regimen caveat. Uses --node-muted (not --text-secondary)
   so on-canvas italics clear WCAG AA (>=4.5:1) in light mode while the chrome's
   intentionally-subtle secondary labels keep their lighter tone. */
#mindmap .markmap-foreign em { color: var(--node-muted); font-style: italic; }
/* external calculator / reference links. */
#mindmap .markmap-foreign a { color: var(--link); text-decoration: underline; }

/* search dim (secondary cue) + reveal highlight */
#mindmap .markmap-node { transition: opacity 0.25s ease; }
#mindmap .markmap-node.dimmed { opacity: 0.18; }
#mindmap .markmap-node.mm-meta { opacity: 0.45; }
#mindmap .markmap-node.mm-hit .markmap-foreign {
  background: var(--hit-bg);
  border-radius: 6px;
  box-shadow: 0 0 0 2px var(--focus);
}

/* ---------- markmap toolbar override ---------- */
.mm-toolbar-custom {
  position: absolute; bottom: 20px; right: 20px;
  background: var(--card-bg) !important;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 20px var(--shadow) !important;
}
.mm-toolbar-brand { display: none !important; }

/* ---------- scrollbars ---------- */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

/* ---------- animation ---------- */
@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

/* ---------- responsive ---------- */
@media (max-width: 900px) {
  .stat-extra { display: none; }
}
@media (max-width: 768px) {
  .title-block .subtitle { display: none; }
  .chip-hint { display: none; }
  #legendToggle { display: inline-flex; }
  .legend { width: 220px; }
  .legend { bottom: 14px; left: 14px; }
}
@media (max-width: 560px) {
  .stats { display: none; }
  .search { max-width: none; order: 3; flex-basis: 100%; }
  .header-actions { flex-wrap: wrap; }
}

/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>

<div class="topbar" id="topbar">
  <div class="header-row">
    <div class="brand">
      <div class="logo" aria-hidden="true">BC</div>
      <div class="title-block">
        <h1>Cancer Management</h1>
        <div class="subtitle">Breast cancer treatment decision tree &middot; Built ${buildDate}</div>
      </div>
    </div>
    <div class="header-actions">
      <div class="search" role="search">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
        </svg>
        <input type="text" id="search" autocomplete="off" spellcheck="false"
               placeholder="Search drug, trial or biomarker  (/)"
               aria-label="Search treatments, trials and biomarkers"
               aria-controls="results">
        <div id="results" role="listbox" aria-label="Search results"></div>
      </div>
      <button class="icon-btn" id="resetBtn" type="button" title="Reset view (Esc)" aria-label="Reset view">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v4h4"></path>
        </svg>
      </button>
      <button class="icon-btn" id="themeToggle" type="button" title="Toggle theme" aria-label="Toggle light or dark theme">
        <svg class="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
        </svg>
        <svg class="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>
  </div>
  <div class="chipbar" id="chips" role="group" aria-label="Jump to tumour subtype">
    <span class="chip-hint">Press 1&ndash;6 or click a subtype</span>
  </div>
</div>

<div class="stats" aria-label="Tree summary">
  <div class="stat" title="${subtypeCount} top-level branches: 5 tumour subtypes + hereditary / premalignant">
    <div class="stat-num">${subtypeCount}</div>
    <div class="stat-lbl">Subtypes</div>
  </div>
  <div class="stat" title="${citationsTotal} evidence citations across the decision tree">
    <div class="stat-num">${trialsDistinct}</div>
    <div class="stat-lbl">Trials &amp; evidence</div>
  </div>
  <div class="stat" title="Actionable [x] treatment recommendations">
    <div class="stat-num">${recCount}</div>
    <div class="stat-lbl">Recommendations</div>
  </div>
  <div class="stat stat-extra" title="Biomarker (RS / MPI) cut-offs that route to chemotherapy">
    <div class="stat-num">${thresholdCount}</div>
    <div class="stat-lbl">Thresholds</div>
  </div>
</div>

<div class="legend" id="legend">
  <div class="legend-head">
    <h3>How to read this tree</h3>
    <button id="legendToggle" type="button" aria-label="Toggle legend">&#9662;</button>
  </div>
  <div class="legend-body">
    <div class="lg-section-label">Colour band = clinical branch</div>
    <div id="legendSubtypes"></div>
    <div class="lg-section-label">Notation</div>
    <div class="lg-row"><span class="lg-mark lg-bold-sample">Aa</span><span class="lg-tx"><b>Bold</b> = pivotal trial / evidence</span></div>
    <div class="lg-row">
      <span class="lg-check" aria-hidden="true"><svg width="15" height="15" viewBox="0 -3 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z"></path></svg></span>
      <span class="lg-tx">[x] = treatment recommendation</span>
    </div>
    <div class="lg-row"><span class="lg-mark"><i>Aa</i></span><span class="lg-tx"><i>Italic</i> = category / regimen note</span></div>
    <div class="lg-row"><span class="lg-mark">&rarr;</span><span class="lg-tx">Arrow = routing (biomarker cut-off / next step)</span></div>
    <div class="lg-row"><span class="lg-mark lg-link-sample">Ref</span><span class="lg-tx">Underlined = external calculator / reference</span></div>
    <div class="lg-row"><span class="lg-dot"></span><span class="lg-tx">Filled circle = collapsed branch</span></div>
    <div class="lg-row"><span class="lg-sw" style="background:#94a3b8"></span><span class="lg-tx"><i>Muted grey = author working notes</i></span></div>
    <div class="lg-foot">
      <kbd>/</kbd> search &middot; <kbd>1</kbd>&ndash;<kbd>6</kbd> subtype &middot; <kbd>Esc</kbd> reset
    </div>
  </div>
</div>

<svg id="mindmap" aria-label="Breast cancer treatment decision tree"></svg>

<script src="https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-view@0.17.0/dist/browser/index.js"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-toolbar@0.17.0/dist/index.js"></script>
<script>
(function () {
  "use strict";

  var ROOT = ${rootJson};
  var OPTIONS = ${optsJson};
  var META_RE = /New Trials to add|Recently Integrated|Emerging/i;
  var PALETTE = ["#CC79A7", "#009E73", "#0072B2", "#E69F00", "#D55E00", "#56B4E9"];
  var mm = null;

  function warn(msg, e) { try { console.warn("[cw] " + msg, e); } catch (_) {} }

  // Reduced motion must reach markmap's own expand/collapse duration.
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      OPTIONS.duration = 0;
    }
  } catch (e) {}

  // -------------------------------------------------------------------------
  // 1. CREATE THE MARKMAP FIRST, IN ITS OWN TRY/CATCH, DEPENDING ON NOTHING.
  //    The clinical content must render even if every enhancement below throws.
  // -------------------------------------------------------------------------
  try {
    var mk = window.markmap;
    var derive = (mk && mk.deriveOptions) ? mk.deriveOptions : function (o) { return o; };
    mm = mk.Markmap.create("svg#mindmap", derive(OPTIONS), ROOT);
    window.mm = mm;
  } catch (e) {
    warn("markmap create failed", e);
  }

  // -------------------------------------------------------------------------
  // 2. Measure the real top-bar height so the fixed header never hides nodes,
  //    then re-fit. Falls back to the CSS default if anything throws.
  // -------------------------------------------------------------------------
  function applyOffset() {
    try {
      var bar = document.getElementById("topbar");
      if (bar) document.documentElement.style.setProperty("--top-h", bar.offsetHeight + "px");
    } catch (e) {}
  }
  try {
    applyOffset();
    if (mm) mm.fit();
    window.addEventListener("resize", function () {
      applyOffset();
      try { if (mm) mm.fit(); } catch (_) {}
    });
  } catch (e) { warn("offset", e); }

  // -------------------------------------------------------------------------
  // Helpers over the LIVE tree. After create, mm.state.data === ROOT and its
  // descendants are the live (rendered) node objects, so identity-based
  // reveal / ensureView work.
  // -------------------------------------------------------------------------
  var DATA = (mm && mm.state && mm.state.data) || ROOT;
  var scratch = document.createElement("div");

  function textOf(node) {
    try {
      scratch.innerHTML = (node && node.content) || "";
      return (scratch.textContent || "").replace(/\\s+/g, " ").trim();
    } catch (e) {
      return ((node && node.content) || "").replace(/<[^>]*>/g, "").replace(/\\s+/g, " ").trim();
    }
  }
  function isRec(node) { return /viewBox="0 -3 24 24"/.test((node && node.content) || ""); }
  function hasBold(node) { return /<strong>/.test((node && node.content) || ""); }

  // -------------------------------------------------------------------------
  // Subtypes (6) + meta branches (2, excluded from nav & stats).
  // -------------------------------------------------------------------------
  var subtypes = [];
  var metaNodes = [];
  try {
    (DATA.children || []).forEach(function (ch) {
      var label = textOf(ch);
      if (META_RE.test(label)) metaNodes.push(ch);
      else subtypes.push({ node: ch, label: label, color: null, chip: null });
    });
  } catch (e) { warn("subtype scan", e); }

  // Derive the swatch colour of each subtype from the LIVE d3 scale (with a
  // rendered-fill fallback, then the static palette) so chips + legend always
  // match the on-canvas bands exactly.
  function colorOf(node) {
    try {
      if (mm && typeof mm.options.color === "function") {
        var c = mm.options.color(node);
        if (c) return c;
      }
    } catch (e) {}
    try {
      var g = mm.findElement(node).g;
      var el = g.querySelector("line, path, circle");
      if (el) {
        var f = el.getAttribute("stroke") || el.getAttribute("fill");
        if (f && f !== "none") return f;
      }
    } catch (e) {}
    return null;
  }
  try {
    subtypes.forEach(function (st, i) { st.color = colorOf(st.node) || PALETTE[i % PALETTE.length]; });
  } catch (e) { warn("colorize", e); }

  var colorByNode = new Map();
  subtypes.forEach(function (st) { colorByNode.set(st.node, st.color); });

  // -------------------------------------------------------------------------
  // Search index: walk the live tree, index [x] recommendations, **bold**
  // trial/evidence lines, AND any plain leaf (a childless node -- e.g. the
  // reference-only "Management per mutation. Myriad Gene Table" leaf, which has
  // neither [x] nor bold and would otherwise be unreachable). Each entry keeps
  // its Subtype > Stage > Therapy ancestry so repeated labels (STAGE I,
  // CHEMOTHERAPY) are never ambiguous. Structural headers (Stage/Therapy) have
  // children, so they are never indexed by the leaf clause.
  // -------------------------------------------------------------------------
  var INDEX = [];
  try {
    (function walk(node, anc) {
      var isLeaf = !(node.children && node.children.length);
      if ((isRec(node) || hasBold(node) || isLeaf) && anc.length && textOf(node)) {
        var subtype = anc[1] || anc[anc.length - 1];
        INDEX.push({
          node: node,
          ancestors: anc.map(function (a) { return a.node; }),
          label: textOf(node),
          path: anc.slice(1).map(function (a) { return a.label; }).filter(Boolean).join("  ›  "),
          color: subtype ? colorByNode.get(subtype.node) : null
        });
      }
      var next = anc.concat([{ node: node, label: textOf(node) }]);
      (node.children || []).forEach(function (c) { walk(c, next); });
    })(DATA, []);
  } catch (e) { warn("index build", e); }

  // -------------------------------------------------------------------------
  // Navigation primitives. IMPORTANT: use renderData() (never setData) to
  // reveal/reset -- setData re-runs initializeData which both re-folds by
  // initialExpandLevel AND re-copies children, invalidating our references.
  // -------------------------------------------------------------------------
  function setFold(node, val) { if (node) { node.payload = node.payload || {}; node.payload.fold = val; } }

  function reveal(entry) {
    try {
      entry.ancestors.forEach(function (n) { setFold(n, 0); });
      if (mm) {
        mm.renderData();
        if (typeof mm.ensureView === "function") {
          mm.ensureView(entry.node, { left: 360, right: 60, top: 40, bottom: 60 });
        } else {
          mm.fit();
        }
      }
      flash(entry.node);
    } catch (e) {
      warn("reveal", e);
      try { if (mm) mm.fit(); } catch (_) {}
    }
  }

  function focusSubtype(st) {
    try {
      subtypes.forEach(function (s) { setFold(s.node, s === st ? 0 : 1); });
      metaNodes.forEach(function (m) { setFold(m, 1); });
      if (mm) {
        mm.renderData();
        if (typeof mm.ensureView === "function") {
          mm.ensureView(st.node, { left: 360, right: 60, top: 60, bottom: 60 });
        } else {
          mm.fit();
        }
      }
      flash(st.node);
      setActiveChip(st);
    } catch (e) { warn("focusSubtype", e); }
  }

  function resetView() {
    try {
      (function w(node, depth) {
        setFold(node, depth >= 2 ? 1 : 0);
        (node.children || []).forEach(function (c) { w(c, depth + 1); });
      })(DATA, 1);
      if (mm) { mm.renderData(); mm.fit(); }
      clearDim();
      setActiveChip(null);
    } catch (e) {
      warn("reset", e);
      try { if (mm) mm.fit(); } catch (_) {}
    }
  }

  function flash(node) {
    try {
      var g = mm.findElement(node).g;
      g.classList.add("mm-hit");
      setTimeout(function () { try { g.classList.remove("mm-hit"); } catch (_) {} }, 1800);
    } catch (e) {}
  }

  function setActiveChip(st) {
    subtypes.forEach(function (s) { if (s.chip) s.chip.classList.toggle("active", s === st); });
  }

  // -------------------------------------------------------------------------
  // Secondary dim cue while typing (guarded, no-op if nodes absent).
  // -------------------------------------------------------------------------
  function dimByQuery(q) {
    try {
      if (!mm || !mm.g) return;
      mm.g.selectAll("g.markmap-node").each(function () {
        try {
          var t = (this.textContent || "").toLowerCase();
          if (t.indexOf(q) >= 0) this.classList.remove("dimmed");
          else this.classList.add("dimmed");
        } catch (_) {}
      });
    } catch (e) {}
  }
  function clearDim() {
    try {
      if (mm && mm.g) mm.g.selectAll("g.markmap-node").each(function () { this.classList.remove("dimmed"); });
    } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // ENHANCEMENTS -- each wired in its own try/catch.
  // -------------------------------------------------------------------------
  function initTheme() {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var root = document.documentElement;
      var isDark = root.getAttribute("data-theme") === "dark";
      root.setAttribute("data-theme", isDark ? "light" : "dark");
      try { localStorage.setItem("cw-theme", isDark ? "light" : "dark"); } catch (e) {}
    });
  }

  function initToolbar() {
    var mk = window.markmap;
    if (!mk || !mk.Toolbar || !mm) return;
    var tb = new mk.Toolbar();
    tb.attach(mm);
    var el = tb.render();
    el.classList.add("mm-toolbar-custom");
    document.body.appendChild(el);
  }

  function buildChips() {
    var wrap = document.getElementById("chips");
    if (!wrap) return;
    subtypes.forEach(function (st, i) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.setAttribute("aria-label", "Focus subtype: " + st.label);
      var sw = document.createElement("span");
      sw.className = "chip-sw";
      sw.style.background = st.color || "#888";
      var tx = document.createElement("span");
      tx.className = "chip-tx";
      tx.textContent = (i + 1) + ". " + st.label;
      b.appendChild(sw);
      b.appendChild(tx);
      b.addEventListener("click", function () { focusSubtype(st); });
      st.chip = b;
      wrap.appendChild(b);
    });
  }

  function fillLegendSwatches() {
    var host = document.getElementById("legendSubtypes");
    if (!host) return;
    subtypes.forEach(function (st) {
      var row = document.createElement("div");
      row.className = "lg-row";
      var sw = document.createElement("span");
      sw.className = "lg-sw";
      sw.style.background = st.color || "#888";
      var tx = document.createElement("span");
      tx.className = "lg-tx";
      tx.textContent = st.label;
      row.appendChild(sw);
      row.appendChild(tx);
      host.appendChild(row);
    });
  }

  function initSearch() {
    var input = document.getElementById("search");
    var box = document.getElementById("results");
    if (!input || !box) return;
    var cur = [];
    var sel = -1;

    // clearDim() here is the single source of truth for restoring opacity, so
    // dismissing search by ANY route (blur / click-away / pick / clear) always
    // un-dims the tree. reveal() re-renders on the pick path, which is fine.
    function close() { box.classList.remove("open"); box.innerHTML = ""; cur = []; sel = -1; clearDim(); }

    function choose(idx) {
      var entry = cur[idx];
      if (!entry) return;
      reveal(entry);
      close();
      input.blur();
    }

    function move(d) {
      if (!cur.length) return;
      sel = (sel + d + cur.length) % cur.length;
      var rows = box.querySelectorAll(".res");
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("sel", i === sel);
      if (rows[sel]) rows[sel].scrollIntoView({ block: "nearest" });
    }

    function render(list) {
      box.innerHTML = "";
      cur = list;
      sel = -1;
      if (!list.length) {
        var none = document.createElement("div");
        none.className = "res-none";
        none.textContent = "No matches";
        box.appendChild(none);
        box.classList.add("open");
        return;
      }
      list.forEach(function (entry, idx) {
        var row = document.createElement("div");
        row.className = "res";
        row.setAttribute("role", "option");
        var dot = document.createElement("span");
        dot.className = "res-dot";
        dot.style.background = entry.color || "#888";
        var main = document.createElement("div");
        main.className = "res-main";
        var nm = document.createElement("div");
        nm.className = "res-name";
        nm.textContent = entry.label;
        var pt = document.createElement("div");
        pt.className = "res-path";
        pt.textContent = entry.path;
        main.appendChild(nm);
        main.appendChild(pt);
        row.appendChild(dot);
        row.appendChild(main);
        row.addEventListener("mousedown", function (ev) { ev.preventDefault(); choose(idx); });
        box.appendChild(row);
      });
      box.classList.add("open");
    }

    function run() {
      var q = input.value.toLowerCase().trim();
      if (q.length < 2) { close(); clearDim(); return; }
      var labelHits = [];
      var pathHits = [];
      for (var i = 0; i < INDEX.length; i++) {
        var e = INDEX[i];
        if (e.label.toLowerCase().indexOf(q) >= 0) labelHits.push(e);
        else if (e.path.toLowerCase().indexOf(q) >= 0) pathHits.push(e);
      }
      render(labelHits.concat(pathHits).slice(0, 16));
      dimByQuery(q);
    }

    input.addEventListener("input", run);
    input.addEventListener("focus", function () { if (input.value.trim().length >= 2) run(); });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); choose(sel >= 0 ? sel : 0); }
      else if (e.key === "Escape") { input.value = ""; close(); clearDim(); input.blur(); }
    });
  }

  // Meta-branch muting + external-link hardening, re-applied after every render
  // by wrapping renderData (which markmap itself calls on expand/collapse). The
  // original render always runs first, so the tree can never be blanked here.
  function installEnhancers() {
    if (!mm || typeof mm.renderData !== "function") return;
    var metaSet = new Set();
    metaNodes.forEach(function (m) {
      (function add(n) { metaSet.add(n); (n.children || []).forEach(add); })(m);
    });
    function paint() {
      try {
        if (!mm.g) return;
        mm.g.selectAll("g.markmap-node").each(function (d) {
          try {
            if (d && d.data && metaSet.has(d.data)) this.classList.add("mm-meta");
            else this.classList.remove("mm-meta");
          } catch (_) {}
        });
      } catch (e) {}
    }
    function links() {
      try {
        if (mm.g) mm.g.selectAll("a").attr("target", "_blank").attr("rel", "noopener noreferrer");
      } catch (e) {}
    }
    var orig = mm.renderData.bind(mm);
    mm.renderData = function () {
      var r;
      try { r = orig.apply(mm, arguments); } catch (e) { warn("renderData", e); }
      try { paint(); } catch (_) {}
      try { links(); } catch (_) {}
      return r;
    };
    paint();
    links();
  }

  function initReset() {
    var b = document.getElementById("resetBtn");
    if (b) b.addEventListener("click", function () {
      var s = document.getElementById("search");
      if (s) s.value = "";
      resetView();
    });
  }

  function initLegend() {
    var toggle = document.getElementById("legendToggle");
    var legend = document.getElementById("legend");
    if (toggle && legend) toggle.addEventListener("click", function () { legend.classList.toggle("collapsed"); });
  }

  function initKeys() {
    document.addEventListener("keydown", function (e) {
      var t = e.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        var s = document.getElementById("search");
        if (s) s.focus();
        return;
      }
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        var s2 = document.getElementById("search");
        if (s2) s2.focus();
        return;
      }
      if (e.key === "Escape" && !typing) { resetView(); return; }
      if (!typing && e.key >= "1" && e.key <= "6") {
        var idx = parseInt(e.key, 10) - 1;
        if (subtypes[idx]) focusSubtype(subtypes[idx]);
      }
    });
  }

  // Wire each enhancement independently -- a throw in one never blocks the rest,
  // and none can blank the already-rendered tree.
  try { initTheme(); } catch (e) { warn("theme", e); }
  try { initToolbar(); } catch (e) { warn("toolbar", e); }
  try { buildChips(); } catch (e) { warn("chips", e); }
  try { fillLegendSwatches(); } catch (e) { warn("legend swatches", e); }
  try { initSearch(); } catch (e) { warn("search", e); }
  try { installEnhancers(); } catch (e) { warn("enhancers", e); }
  try { initReset(); } catch (e) { warn("reset btn", e); }
  try { initLegend(); } catch (e) { warn("legend", e); }
  try { initKeys(); } catch (e) { warn("keys", e); }
})();
</script>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Write the single self-contained HTML file.
// ---------------------------------------------------------------------------
fs.writeFileSync(outputPath, html);

console.log('Interactive Markmap HTML generated:', outputPath);
console.log(
  'Stats -> subtypes: ' + subtypeCount +
  ', trials & evidence: ' + trialsDistinct + ' (' + citationsTotal + ' citations)' +
  ', recommendations: ' + recCount +
  ', thresholds: ' + thresholdCount
);
