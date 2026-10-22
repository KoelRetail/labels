// Builds the ZPL for one asset label and renders a matching on-screen preview.
// ZD500R @ 203 dpi -> 8 dots/mm. Label 57 x 31 mm = 456 x 248 dots.

export const LABEL_W = 456;
export const LABEL_H = 248;

// Zebra scalable font 0 (Swiss 721) — the bold sans look of the asset labels.
const FONT = '0';
const SIZE_LABEL = 24; // "Art :" and the barcode interpretation lines
const SIZE_TEXT = 30; // description and the SN line
const FB_WIDTH = LABEL_W - 32; // ^FB wrap width for the description

// Layout: y positions of each row, shared by the ZPL and the preview.
const ART_X = 99;
const SN_X = 27;
const RIGHT_MARGIN = 10;
const ART_AVAIL = LABEL_W - ART_X - RIGHT_MARGIN;
const SN_AVAIL = LABEL_W - SN_X - RIGHT_MARGIN;
const Y = { artBar: 16, artText: 26, desc: 80, snText: 142, snBar: 178, barH: 33 };

// Code 39 encodes a fixed set only; anything else silently prints a broken barcode.
const CODE39 = /^[0-9A-Z\-. $/+%]*$/;

// Code 39 char = 6 narrow + 3 wide elements, plus a narrow inter-char gap.
// Width in dots for len chars (+2 for the * start/stop) at module `nb`, ratio `r`.
const barcodeWidth = (len, nb, r) => (len + 2) * (7 + 3 * r) * nb - nb;

// Densest-first: keep bars fat (easier scans) and only tighten when needed.
// Module 2 @ 203dpi = 0.25mm, the practical floor for a reliable Code 39 scan.
const FITS = [
  { nb: 3, r: 3 },
  { nb: 2, r: 3 },
  { nb: 2, r: 2 },
];

const fitBarcode = (data, avail) => FITS.find((f) => barcodeWidth(data.length, f.nb, f.r) <= avail) || null;

// Longest string still printable in a given space, for error messages.
function maxChars(avail) {
  const f = FITS[FITS.length - 1];
  return Math.floor((avail + f.nb) / ((7 + 3 * f.r) * f.nb)) - 2;
}

const sanitize = (s) => String(s == null ? '' : s).replace(/[\^~\\]/g, '').trim();

// Apple's serial barcodes carry an "S" symbology prefix, so scanning one hands
// us "SFFMH82YSPLJQ" when the real serial is "FFMH82YSPLJQ". Drop it from both
// the text and the barcode so the label shows the actual serial.
export const stripLeadingS = (sn) => sn.replace(/^S/i, '');

export function validate({ article, description, serial, stripS }) {
  const errors = [];
  const art = sanitize(article).toUpperCase();
  const sn = sanitize(serial).toUpperCase();
  const snBar = stripS ? stripLeadingS(sn) : sn;
  const chars = 'alleen A-Z 0-9 - . spatie $ / + %';

  if (!art) errors.push('Article is leeg.');
  if (!sn) errors.push('Serial number is leeg.');
  if (art && !CODE39.test(art)) errors.push(`Article "${art}" bevat tekens die Code 39 niet kan: ${chars}`);
  if (snBar && !CODE39.test(snBar)) errors.push(`Serial "${snBar}" bevat tekens die Code 39 niet kan: ${chars}`);
  if (stripS && sn && !snBar) errors.push('Serial bestaat alleen uit "S" — na het strippen blijft er niets over.');

  const artFit = art && CODE39.test(art) ? fitBarcode(art, ART_AVAIL) : FITS[0];
  const snFit = snBar && CODE39.test(snBar) ? fitBarcode(snBar, SN_AVAIL) : FITS[0];
  if (!artFit) errors.push(`Article is te lang voor de barcode: ${art.length} tekens, max ${maxChars(ART_AVAIL)}.`);
  if (!snFit) errors.push(`Serial is te lang voor de barcode: ${snBar.length} tekens, max ${maxChars(SN_AVAIL)}.`);

  return { errors, art, sn, snBar, artFit, snFit };
}

// Splits a pasted batch into serials. Accepts comma, semicolon, newline, tab or
// spaces as separators, so pasting from Excel or a scanner both work. Device
// serials never contain spaces, so treating them as separators is safe here.
export function parseSerials(text) {
  return String(text == null ? '' : text).split(/[\s,;]+/).filter(Boolean);
}

// Serials that appear more than once — scanning the same phone twice is easy to do.
export function findDuplicates(serials) {
  const seen = new Set(), dupes = new Set();
  for (const s of serials.map((x) => x.toUpperCase())) {
    if (seen.has(s)) dupes.add(s);
    seen.add(s);
  }
  return [...dupes];
}

// One ZPL stream holding every label — a single request instead of one per serial,
// so a batch can't half-print if the network hiccups partway through.
export function buildBatch({ serials, ...common }) {
  return serials.map((serial) => buildZpl({ ...common, serial })).join('');
}

export function buildZpl({ article, description, serial, stripS = true, copies = 1, darkness }) {
  const { errors, art, snBar, artFit, snFit } = validate({ article, description, serial, stripS });
  if (errors.length) throw new Error(errors.join(' '));

  const desc = sanitize(description);
  const qty = Math.max(1, Math.min(50, parseInt(copies, 10) || 1));
  const bar = (x, y, data, fit) => `^FO${x},${y}^BY${fit.nb},${fit.r},${Y.barH}^B3N,N,${Y.barH},Y,N^FD${data}^FS`;
  const text = (x, y, size, s) => `^FO${x},${y}^A${FONT}N,${size},${size}^FD${s}^FS`;

  const out = ['^XA', '^CI28']; // ^CI28 = UTF-8, so accents in the description survive
  out.push(`^CF${FONT},${SIZE_LABEL},${SIZE_LABEL}`); // also sets the barcode interpretation lines
  out.push(`^PW${LABEL_W}`, `^LL${LABEL_H}`, '^LH0,0', '^MMT');
  if (darkness != null && darkness !== '') out.push(`~SD${String(darkness).padStart(2, '0')}`);

  out.push(text(22, Y.artText, SIZE_LABEL, 'Art :'));
  out.push(bar(ART_X, Y.artBar, art, artFit));
  // Description wraps to 2 lines so long names don't run off the edge.
  out.push(`^FO22,${Y.desc}^A${FONT}N,${SIZE_TEXT},${SIZE_TEXT}^FB${FB_WIDTH},2,0,L,0^FD${desc}^FS`);
  out.push(text(22, Y.snText, SIZE_TEXT, `SN : ${snBar}`));
  out.push(bar(SN_X, Y.snBar, snBar, snFit));
  out.push(`^PQ${qty}`, '^XZ');
  return out.join('\n') + '\n';
}

// --- Preview -----------------------------------------------------------------

const C39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn',
  'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn',
  'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn',
  'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

// Zebra font 0 is Swiss 721 — a Helvetica clone — so measuring in Helvetica
// gives a close read on where the printer's ^FB will actually break the line.
// Built on first use, not at import — keeps everything above this line runnable
// outside a browser (tests), where there is no document.
let _ctx = null;
function measure(text, px) {
  _ctx = _ctx || document.createElement('canvas').getContext('2d');
  _ctx.font = `bold ${px}px Helvetica, Arial, sans-serif`;
  return _ctx.measureText(text).width;
}

// Word wrap like ZPL's ^FB: break on spaces, hard-break words that don't fit.
function wrap(text, maxPx, px, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (measure(w, px) > maxPx) {
      let cut = w.length;
      while (cut > 1 && measure(w.slice(0, cut), px) > maxPx) cut--;
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    if (!line) line = w;
    else if (measure(line + ' ' + w, px) <= maxPx) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function bars(data, x, y, h, avail) {
  const fit = fitBarcode(data, avail);
  if (!fit) return null; // too long — caller flags it instead of drawing off-label
  const nb = fit.nb, wb = nb * fit.r;
  let out = '', cx = x;
  for (const ch of '*' + data + '*') {
    const pat = C39[ch];
    if (!pat) return null;
    for (let i = 0; i < 9; i++) {
      const w = pat[i] === 'w' ? wb : nb;
      if (i % 2 === 0) out += `<rect x="${cx}" y="${y}" width="${w}" height="${h}" fill="#000"/>`;
      cx += w;
    }
    cx += nb; // inter-character gap
  }
  return { svg: out, width: cx - nb - x };
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Returns { svg, tooLong } — an SVG mirroring what the printer will produce.
export function renderPreview({ article, description, serial, stripS }) {
  const art = sanitize(article).toUpperCase();
  const desc = sanitize(description);
  const sn = sanitize(serial).toUpperCase();
  const snBar = stripS ? stripLeadingS(sn) : sn;

  const FF = 'font-family:Helvetica,Arial,sans-serif;font-weight:700';
  const LBL = `${FF};font-size:${SIZE_LABEL}px`, TXT = `${FF};font-size:${SIZE_TEXT}px`;
  const tooLong = [];
  let s = `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#fff"/>`;

  s += `<text x="22" y="${Y.artText + 22}" style="${LBL}">Art :</text>`;
  if (art && CODE39.test(art)) {
    const b = bars(art, ART_X, Y.artBar, Y.barH, ART_AVAIL);
    if (b) s += b.svg + `<text x="${ART_X + b.width / 2}" y="${Y.artBar + Y.barH + 20}" text-anchor="middle" style="${LBL}">*${esc(art)}*</text>`;
    else tooLong.push('Article');
  }

  wrap(desc, FB_WIDTH, SIZE_TEXT, 2).forEach((line, i) => {
    s += `<text x="22" y="${Y.desc + 24 + i * SIZE_TEXT}" style="${TXT}">${esc(line)}</text>`;
  });
  s += `<text x="22" y="${Y.snText + 24}" style="${TXT}">SN : ${esc(snBar)}</text>`;

  if (snBar && CODE39.test(snBar)) {
    const b = bars(snBar, SN_X, Y.snBar, Y.barH, SN_AVAIL);
    if (b) s += b.svg + `<text x="${SN_X + b.width / 2}" y="${Y.snBar + Y.barH + 20}" text-anchor="middle" style="${LBL}">*${esc(snBar)}*</text>`;
    else tooLong.push('Serial');
  }
  return { svg: s, tooLong };
}
