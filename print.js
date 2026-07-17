// Sends raw ZPL straight from the browser to the printer's built-in web server.
//
// Two browser rules shape this and are worth knowing before changing it:
//
// 1. The printer sends no CORS headers, so we use mode:'no-cors'. The request
//    goes out but the response is opaque — we cannot read the status. A resolved
//    promise therefore means "the browser sent it", NOT "the printer printed it".
//    Never report success as certainty; tell the user to check the printer.
// 2. Chrome 142+ gates requests from a public HTTPS page to a private IP behind
//    the Local Network Access permission. The user grants it once per site.
//    A denial can surface as a throw or as silent nothing — hence rule 1.

const PSTPRNT_PATH = '/pstprnt';

async function attempt(url, zpl, opts) {
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' }, // keeps it a "simple request" — no preflight
    body: zpl,
    ...opts,
  });
}

// Resolves once the request has left the browser. Throws if the browser refused.
export async function sendToPrinter(zpl, host) {
  const url = `http://${host}${PSTPRNT_PATH}`;
  try {
    // Declaring the target address space up front is what lets Chrome relax
    // mixed-content blocking for a private IP once permission is granted.
    await attempt(url, zpl, { targetAddressSpace: 'private' });
  } catch (e) {
    // Browsers that don't know targetAddressSpace can reject on the option itself.
    await attempt(url, zpl, {});
  }
}
