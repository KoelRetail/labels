// Builds the ZPL for one asset label and renders a matching on-screen preview.
// ZD500R @ 203 dpi -> 8 dots/mm. Label 57 x 31 mm = 456 x 248 dots.

export const LABEL_W = 456;
export const LABEL_H = 248;

const ASICS_GFA = '000000000000000000000000000007F0000000000000000000003FF800000000000000000000F9FC00000000000000000003807E0000000000000000000E003E00000000000000000018003E00000000000000000020003E00000000000000000000003E03F801FC7803E0FE0000007E03FE07FC781FE3FE0000F87E07FF1FFC787FEFFE0007FCFC07FF9FFCF8FFCFFE001FFEFC001FBF00F9FF1F84003E07F8000FBC00F3F01E0000F807F8000FBE01F7E01F0001F007F003FF3F01F7C01F8003E00FF00FFF3FC1E7801FE007C01FE03FFF1FE1EF800FF00F801FE07FFF0FF3EF0007F81F807FC0FE3E07F3EF0003FC3F00FF80F83E01FBCF0000FC3F01FF00F83E00FBCF80007C7F07FE00F83C00F7CF80007C7FFFFE00FFFC7FF7CFFE3FF8FFFFFC00FFFCFFF787FE7FF8FFFFF800FFFDFFE787FE7FF0FFFFF0007FF9FFCF81FEFFE0FFFFC0000FF9FE07007CFF00FFFF80000000000000000000FFFF000000000000000000007FFC000000000000000000003FF0000000000000000000001FC000000000000000000000000000000000000000000000';
const NIKE_GFA = '00000000000000000000000000080000000000000000001C0018000000000000000001F0003000000000000000000F8000300000000000000000FE000060000000000000000FF80000E000000000000000FFC00001E00000000000000FFF000003E00000000000007FF8000003C0000000000007FFE0000007C000000000007FFF8000000FC00000000007FFFC0000000FC0000000003FFFF00000001FE000000003FFFFC00000003FE00000003FFFFE000000003FE0000003FFFFF8000000007FF000003FFFFFE0000000007FF80001FFFFFF00000000007FFC001FFFFFFC0000000000FFFFC7FFFFFFE00000000000FFFFFFFFFFFF800000000000FFFFFFFFFFFE000000000000FFFFFFFFFFF0000000000000FFFFFFFFFFC0000000000000FFFFFFFFFF00000000000000FFFFFFFFF800000000000000FFFFFFFFE000000000000000FFFFFFFF00000000000000007FFFFFFC00000000000000007FFFFFF000000000000000003FFFFF8000000000000000001FFFFE00000000000000000007FFF000000000000000000001FF00000000000000000000';

// The source ASICS printer graphic is 96 x 34 dots. Scale it once at module
// load so it stays crisp but is large enough to recognize at a glance.
function scalePrintLogo(hex, targetWidth = 126, targetHeight = 44) {
  const sourceWidth = 96;
  const sourceBytesPerRow = sourceWidth / 8;
  const source = Uint8Array.from(hex.match(/../g), (byte) => parseInt(byte, 16));
  const sourceHeight = source.length / sourceBytesPerRow;
  const bytesPerRow = Math.ceil(targetWidth / 8);
  const output = new Uint8Array(bytesPerRow * targetHeight);

  for (let y = 0; y < targetHeight; y++) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor(y * sourceHeight / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor(x * sourceWidth / targetWidth));
      const sourceBit = source[sourceY * sourceBytesPerRow + (sourceX >> 3)] & (0x80 >> (sourceX & 7));
      if (sourceBit) output[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  return {
    data: Array.from(output, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase(),
    bytesPerRow,
    totalBytes: output.length,
  };
}

const ASICS_PRINT_LOGO = scalePrintLogo(ASICS_GFA);

export const CLIENTS = {
  nike: { id: 'nike', name: 'Nike', color: '#111111', logoPath: 'nike-swoosh.jpg' },
  asics: { id: 'asics', name: 'ASICS', color: '#001e62', logoPath: 'asics-logo.svg' },
};

// The prefix is free to set (DTC by default); letters and digits only, and
// short enough that the Code 128 still fits the panel at 0.25 mm modules.
export const ASICS_PREFIX_MAX = 6;

// Zebra scalable font 0 (Swiss 721) — the bold sans look of the asset labels.
const FONT = '0';
const SIZE_LABEL = 24; // ^CF default; the Nike label sets every size explicitly
const SIZE_KEY = 20; // "ART" / "SN"
const SIZE_VALUE = 26; // article, serial and description

// Nike grid: header (description + swoosh), a rule, then two key/barcode rows,
// everything hanging off one left edge. Shared by the ZPL and the preview.
const MARGIN = 20; // 416 dots of barcode room: a 14-char serial still fits
const VALUE_X = 76; // values start after the "ART" / "SN" keys
const NIKE_LOGO_W = 96;
const NIKE_LOGO_H = 34;
const NIKE_LOGO_X = LABEL_W - MARGIN - NIKE_LOGO_W;
const NIKE_LOGO_Y = 16;
const DESC_WIDTH = NIKE_LOGO_X - MARGIN - 16;
const BAR_AVAIL = LABEL_W - 2 * MARGIN;
const ART_AVAIL = BAR_AVAIL;
const SN_AVAIL = BAR_AVAIL;
const Y = { rule: 62, art: 76, artBar: 108, sn: 156, snBar: 188, barH: 38 };
// ASICS: black label, white logo and code, barcode black-on-white in a panel
// so every scanner reads it (inverted barcodes are hit and miss).
const ASICS_LOGO_X = 165;
const ASICS_LOGO_Y = 14;
const ASICS_LOGO_W = 126;
const ASICS_LOGO_H = 44;
const ASICS_CODE_Y = 66;
const ASICS_CODE_SIZE = 32;
// The ZD500R measures the roll at 263 dots per label (config page), not 248:
// black runs to the full measured length so no white strip shows at the bottom.
const ASICS_BLEED_H = 263;
const ASICS_PANEL = { x: 16, y: 110, w: LABEL_W - 32, h: 122 };
const ASICS_BAR = { y: 126, h: 90, module: 2 };
// Code 128 B: start + chars + check + stop, 11 modules each, +2 for the stop bar.
const code128Width = (data, module) => ((data.length + 3) * 11 + 2) * module;

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
  const chars = 'alleen A-Z, 0-9, -, ., spatie, $, /, + en %';

  if (!art) errors.push('Artikel is leeg.');
  if (!sn) errors.push('Serienummer is leeg.');
  if (art && !CODE39.test(art)) errors.push(`Artikel "${art}" bevat ongeldige tekens; gebruik ${chars}.`);
  if (snBar && !CODE39.test(snBar)) errors.push(`Serienummer "${snBar}" bevat ongeldige tekens; gebruik ${chars}.`);
  if (stripS && sn && !snBar) errors.push('Na het verwijderen van de leidende "S" blijft niets over.');

  const artFit = art && CODE39.test(art) ? fitBarcode(art, ART_AVAIL) : FITS[0];
  const snFit = snBar && CODE39.test(snBar) ? fitBarcode(snBar, SN_AVAIL) : FITS[0];
  if (!artFit) errors.push(`Artikel is te lang voor de barcode: maximaal ${maxChars(ART_AVAIL)} tekens.`);
  if (!snFit) errors.push(`Serienummer is te lang voor de barcode: maximaal ${maxChars(SN_AVAIL)} tekens.`);

  return { errors, art, sn, snBar, artFit, snFit };
}

export function validateAsics({ device = 'DTC', sequence }) {
  const errors = [];
  const deviceCode = String(device == null ? '' : device).trim().toUpperCase();
  const raw = String(sequence == null ? '' : sequence).trim();
  const validSequence = /^\d{1,6}$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 999999;

  if (!new RegExp(`^[A-Z0-9]{1,${ASICS_PREFIX_MAX}}$`).test(deviceCode)) errors.push(`Naam: 1 tot ${ASICS_PREFIX_MAX} letters of cijfers, zonder spaties of streepjes.`);
  if (!validSequence) errors.push('Volgnummer moet tussen 000001 en 999999 liggen.');

  const number = validSequence ? Number(raw) : null;
  const suffix = number == null ? '______' : String(number).padStart(6, '0');
  return { errors, code: `${deviceCode}-${suffix}`, number, deviceCode };
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

function buildAsicsZpl({ device, sequence, darkness }) {
  const { errors, code } = validateAsics({ device, sequence });
  if (errors.length) throw new Error(errors.join(' '));

  const logo = ASICS_PRINT_LOGO;
  const out = ['^XA', '^CI28', `^PW${LABEL_W}`, `^LL${ASICS_BLEED_H}`, '^LH0,0', '^MMT'];
  if (darkness != null && darkness !== '') out.push(`~SD${String(darkness).padStart(2, '0')}`);

  const P = ASICS_PANEL, B = ASICS_BAR;
  out.push(`^FO0,0^GB${LABEL_W},${ASICS_BLEED_H},${ASICS_BLEED_H},B^FS`);
  // ^FR reverses the field over the black: white logo and white code.
  out.push(`^FO${ASICS_LOGO_X},${ASICS_LOGO_Y}^FR^GFA,${logo.totalBytes},${logo.totalBytes},${logo.bytesPerRow},${logo.data}^FS`);
  out.push(`^FO0,${ASICS_CODE_Y}^FR^A0N,${ASICS_CODE_SIZE},${ASICS_CODE_SIZE}^FB${LABEL_W},1,0,C,0^FD${code}^FS`);
  out.push(`^FO${P.x},${P.y}^GB${P.w},${P.h},${P.h},W,2^FS`);
  const barX = Math.round((LABEL_W - code128Width(code, B.module)) / 2);
  out.push(`^FO${barX},${B.y}^BY${B.module},2,${B.h}^BCN,${B.h},N,N,N^FD${code}^FS`);
  out.push('^PQ1', '^XZ');
  return out.join('\n') + '\n';
}

export function buildZpl({ client = 'nike', article, description, serial, stripS = true, copies = 1, darkness, device, sequence }) {
  if (client === 'asics') return buildAsicsZpl({ device, sequence, darkness });

  const { errors, art, snBar, artFit, snFit } = validate({ article, description, serial, stripS });
  if (errors.length) throw new Error(errors.join(' '));

  const desc = sanitize(description);
  const qty = Math.max(1, Math.min(50, parseInt(copies, 10) || 1));
  // No interpretation line: the value is already printed above each barcode.
  const bar = (y, data, fit) => `^FO${MARGIN},${y}^BY${fit.nb},${fit.r},${Y.barH}^B3N,N,${Y.barH},N,N^FD${data}^FS`;
  const text = (x, y, size, s) => `^FO${x},${y}^A${FONT}N,${size},${size}^FD${s}^FS`;

  const out = ['^XA', '^CI28']; // ^CI28 = UTF-8, so accents in the description survive
  out.push(`^CF${FONT},${SIZE_LABEL},${SIZE_LABEL}`);
  out.push(`^PW${LABEL_W}`, `^LL${LABEL_H}`, '^LH0,0', '^MMT');
  if (darkness != null && darkness !== '') out.push(`~SD${String(darkness).padStart(2, '0')}`);

  descriptionLines(desc).forEach((l) => out.push(text(MARGIN, l.y, l.size, l.text)));
  out.push(`^FO${NIKE_LOGO_X},${NIKE_LOGO_Y}^GFA,408,408,12,${NIKE_GFA}^FS`);
  out.push(`^FO${MARGIN},${Y.rule}^GB${BAR_AVAIL},2,2^FS`);
  out.push(text(MARGIN, Y.art + 5, SIZE_KEY, 'ART'), text(VALUE_X, Y.art, SIZE_VALUE, art));
  out.push(bar(Y.artBar, art, artFit));
  out.push(text(MARGIN, Y.sn + 5, SIZE_KEY, 'SN'), text(VALUE_X, Y.sn, SIZE_VALUE, snBar));
  out.push(bar(Y.snBar, snBar, snFit));
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

// Code 128 patterns, used only for the compact ASICS asset identifier.
const C128 = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
  '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
  '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
  '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112',
];

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

// The description sits on one line next to the swoosh, shrinking the font step
// by step to keep it there. Only when even the smallest size won't fit does it
// wrap to two lines (cut with an ellipsis after that). Returns {text, size, y}.
// Without a browser (node tests) there is nothing to measure; print one line.
const DESC_SIZES = [24, 22, 20, 18];
function descriptionLines(desc) {
  if (!desc) return [];
  const centered = (size) => NIKE_LOGO_Y + Math.round((NIKE_LOGO_H - size) / 2);
  if (typeof document === 'undefined') return [{ text: desc, size: DESC_SIZES[0], y: centered(DESC_SIZES[0]) }];
  for (const size of DESC_SIZES) {
    if (measure(desc, size) <= DESC_WIDTH) return [{ text: desc, size, y: centered(size) }];
  }
  const size = DESC_SIZES[DESC_SIZES.length - 1];
  const lines = wrap(desc, DESC_WIDTH, size, 99);
  if (lines.length > 2) {
    let last = lines[1];
    while (last && measure(last + '…', size) > DESC_WIDTH) last = last.slice(0, -1);
    lines.splice(1, lines.length, last.trimEnd() + '…');
  }
  const top = NIKE_LOGO_Y + Math.round((NIKE_LOGO_H - 2 * (size + 2)) / 2);
  return lines.map((text, i) => ({ text, size, y: top + i * (size + 2) }));
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

function code128Bars(data, x, y, height, moduleWidth = 2) {
  const values = Array.from(data, (char) => char.charCodeAt(0) - 32);
  if (values.some((value) => value < 0 || value > 94)) return null;

  let checksum = 104; // Start Code B
  values.forEach((value, index) => { checksum += value * (index + 1); });
  const symbols = [104, ...values, checksum % 103, 106];
  let cursor = x;
  let svg = '';

  for (const symbol of symbols) {
    const pattern = C128[symbol];
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]) * moduleWidth;
      if (i % 2 === 0) svg += `<rect x="${cursor}" y="${y}" width="${width}" height="${height}" fill="#000"/>`;
      cursor += width;
    }
  }

  return { svg, width: cursor - x };
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Draws the exact printer bitmap, so the preview can never drift from the print.
function previewNikeLogo() {
  const bytes = NIKE_GFA.match(/../g).map((b) => parseInt(b, 16));
  let d = '';
  for (let y = 0; y < NIKE_LOGO_H; y++) {
    for (let x = 0; x < NIKE_LOGO_W; x++) {
      if (!(bytes[y * 12 + (x >> 3)] & (0x80 >> (x & 7)))) continue;
      let run = 1;
      while (x + run < NIKE_LOGO_W && bytes[y * 12 + ((x + run) >> 3)] & (0x80 >> ((x + run) & 7))) run++;
      d += `M${NIKE_LOGO_X + x} ${NIKE_LOGO_Y + y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return `<path d="${d}" fill="#000"/>`;
}

function renderAsicsPreview({ device, sequence }) {
  const { errors, code } = validateAsics({ device, sequence });
  const FF = 'font-family:Helvetica,Arial,sans-serif;font-weight:700';
  const P = ASICS_PANEL, B = ASICS_BAR;
  let s = `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#000"/>`;
  s += `<image href="${CLIENTS.asics.logoPath}" x="${ASICS_LOGO_X}" y="${ASICS_LOGO_Y}" width="${ASICS_LOGO_W}" height="${ASICS_LOGO_H}" preserveAspectRatio="xMidYMid meet" style="filter:grayscale(1) brightness(0) invert(1)"/>`;
  s += `<text x="${LABEL_W / 2}" y="${ASICS_CODE_Y + Math.round(ASICS_CODE_SIZE * 0.86)}" text-anchor="middle" fill="#fff" style="${FF};font-size:${ASICS_CODE_SIZE}px">${esc(code)}</text>`;
  s += `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="6" fill="#fff"/>`;

  if (!errors.length) {
    const barcode = code128Bars(code, Math.round((LABEL_W - code128Width(code, B.module)) / 2), B.y, B.h, B.module);
    if (barcode) s += barcode.svg;
  }

  return { svg: s, tooLong: [], code, errors };
}

// Returns { svg, tooLong } — an SVG mirroring what the printer will produce.
export function renderPreview({ client = 'nike', article, description, serial, stripS, device, sequence }) {
  if (client === 'asics') return renderAsicsPreview({ device, sequence });

  const art = sanitize(article).toUpperCase();
  const desc = sanitize(description);
  const sn = sanitize(serial).toUpperCase();
  const snBar = stripS ? stripLeadingS(sn) : sn;

  const FF = 'font-family:Helvetica,Arial,sans-serif;font-weight:700';
  // ^FO is the top of the glyph box; SVG text sits on its baseline.
  const text = (x, y, size, t) => `<text x="${x}" y="${y + Math.round(size * 0.86)}" style="${FF};font-size:${size}px">${esc(t)}</text>`;
  const tooLong = [];
  let s = `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#fff"/>`;

  descriptionLines(desc).forEach((l) => { s += text(MARGIN, l.y, l.size, l.text); });
  s += previewNikeLogo();
  s += `<rect x="${MARGIN}" y="${Y.rule}" width="${BAR_AVAIL}" height="2" fill="#000"/>`;

  s += text(MARGIN, Y.art + 5, SIZE_KEY, 'ART') + text(VALUE_X, Y.art, SIZE_VALUE, art);
  if (art && CODE39.test(art)) {
    const b = bars(art, MARGIN, Y.artBar, Y.barH, ART_AVAIL);
    if (b) s += b.svg;
    else tooLong.push('Artikel');
  }

  s += text(MARGIN, Y.sn + 5, SIZE_KEY, 'SN') + text(VALUE_X, Y.sn, SIZE_VALUE, snBar);
  if (snBar && CODE39.test(snBar)) {
    const b = bars(snBar, MARGIN, Y.snBar, Y.barH, SN_AVAIL);
    if (b) s += b.svg;
    else tooLong.push('Serienummer');
  }
  return { svg: s, tooLong };
}
