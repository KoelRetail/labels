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

export const ASICS_DEVICES = {
  IPD: { code: 'IPD', name: 'iPad' },
  POS: { code: 'POS', name: 'POS' },
  RTR: { code: 'RTR', name: 'Router' },
};

// Zebra scalable font 0 (Swiss 721) — the bold sans look of the asset labels.
const FONT = '0';
const SIZE_LABEL = 24; // "Art :" and the barcode interpretation lines
const SIZE_TEXT = 30; // description and the SN line
const DESC_WIDTH = LABEL_W - 32; // full width, as on the original Nike label

// Layout: y positions of each row, shared by the ZPL and the preview.
const ART_X = 99;
const SN_X = 27;
const RIGHT_MARGIN = 10;
const ART_AVAIL = LABEL_W - ART_X - RIGHT_MARGIN;
const SN_AVAIL = LABEL_W - SN_X - RIGHT_MARGIN;
// Swoosh sits right of the "SN :" text, right-aligned with the barcodes and
// between the description (ends y140) and the serial barcode (starts y178).
const NIKE_LOGO_X = 456 - 10 - 96;
const NIKE_LOGO_Y = 141;
const NIKE_LOGO_W = 96;
const NIKE_LOGO_H = 34;
const ASICS_LOGO_X = 165;
const ASICS_LOGO_Y = 16;
const ASICS_LOGO_W = 126;
const ASICS_LOGO_H = 44;
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

export function validateAsics({ device = 'IPD', sequence }) {
  const errors = [];
  const deviceCode = ASICS_DEVICES[device] ? device : 'IPD';
  const raw = String(sequence == null ? '' : sequence).trim();
  const validSequence = /^\d{1,6}$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 999999;

  if (!ASICS_DEVICES[device]) errors.push('Kies een geldig apparaattype.');
  if (!validSequence) errors.push('Volgnummer moet tussen 000001 en 999999 liggen.');

  const number = validSequence ? Number(raw) : null;
  const suffix = number == null ? '______' : String(number).padStart(6, '0');
  return { errors, code: `ASICS-${deviceCode}-${suffix}`, number, deviceCode };
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
  const out = ['^XA', '^CI28', `^PW${LABEL_W}`, `^LL${LABEL_H}`, '^LH0,0', '^MMT'];
  if (darkness != null && darkness !== '') out.push(`~SD${String(darkness).padStart(2, '0')}`);

  out.push(`^FO${ASICS_LOGO_X},${ASICS_LOGO_Y}^GFA,${logo.totalBytes},${logo.totalBytes},${logo.bytesPerRow},${logo.data}^FS`);
  out.push(`^FO0,76^A0N,32,32^FB${LABEL_W},1,0,C,0^FD${code}^FS`);
  // Code 128 keeps the 16-character asset ID scan-friendly at 0.25 mm modules.
  out.push(`^FO17,128^BY2,2,70^BCN,70,N,N,N^FD${code}^FS`);
  out.push('^PQ1', '^XZ');
  return out.join('\n') + '\n';
}

export function buildZpl({ client = 'nike', article, description, serial, stripS = true, copies = 1, darkness, device, sequence }) {
  if (client === 'asics') return buildAsicsZpl({ device, sequence, darkness });

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
  out.push(`^FO22,${Y.desc}^A${FONT}N,${SIZE_TEXT},${SIZE_TEXT}^FB${DESC_WIDTH},2,0,L,0^FD${desc}^FS`);
  if (swooshFits(snBar)) out.push(`^FO${NIKE_LOGO_X},${NIKE_LOGO_Y}^GFA,408,408,12,${NIKE_GFA}^FS`);
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

// An unusually long serial would run into the swoosh; then the logo is left off.
// Without a browser (node tests) there is nothing to measure, so assume it fits.
function swooshFits(snBar) {
  if (typeof document === 'undefined') return true;
  return measure(`SN : ${snBar}`, SIZE_TEXT) <= NIKE_LOGO_X - 22 - 14;
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
  let s = `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#fff"/>`;
  s += `<image href="${CLIENTS.asics.logoPath}" x="${ASICS_LOGO_X}" y="${ASICS_LOGO_Y}" width="${ASICS_LOGO_W}" height="${ASICS_LOGO_H}" preserveAspectRatio="xMidYMid meet" style="filter:grayscale(1) brightness(0)"/>`;
  s += `<text x="${LABEL_W / 2}" y="105" text-anchor="middle" style="${FF};font-size:32px">${esc(code)}</text>`;

  if (!errors.length) {
    const barcode = code128Bars(code, 17, 128, 70, 2);
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
  const LBL = `${FF};font-size:${SIZE_LABEL}px`, TXT = `${FF};font-size:${SIZE_TEXT}px`;
  const tooLong = [];
  let s = `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#fff"/>`;

  s += `<text x="22" y="${Y.artText + 22}" style="${LBL}">Art :</text>`;
  if (art && CODE39.test(art)) {
    const b = bars(art, ART_X, Y.artBar, Y.barH, ART_AVAIL);
    if (b) s += b.svg + `<text x="${ART_X + b.width / 2}" y="${Y.artBar + Y.barH + 20}" text-anchor="middle" style="${LBL}">*${esc(art)}*</text>`;
    else tooLong.push('Artikel');
  }

  wrap(desc, DESC_WIDTH, SIZE_TEXT, 2).forEach((line, i) => {
    s += `<text x="22" y="${Y.desc + 24 + i * SIZE_TEXT}" style="${TXT}">${esc(line)}</text>`;
  });
  if (swooshFits(snBar)) s += previewNikeLogo();
  s += `<text x="22" y="${Y.snText + 24}" style="${TXT}">SN : ${esc(snBar)}</text>`;

  if (snBar && CODE39.test(snBar)) {
    const b = bars(snBar, SN_X, Y.snBar, Y.barH, SN_AVAIL);
    if (b) s += b.svg + `<text x="${SN_X + b.width / 2}" y="${Y.snBar + Y.barH + 20}" text-anchor="middle" style="${LBL}">*${esc(snBar)}*</text>`;
    else tooLong.push('Serienummer');
  }
  return { svg: s, tooLong };
}
