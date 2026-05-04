/**
 * Turn a single pasted <p>…<br>…</p> blob into multiple <p>…</p> blocks so each line
 * becomes a real paragraph (matches Enter / prose flow).
 *
 * Only runs when the clipboard HTML is a lone <p> whose direct children are
 * text, inline-ish elements, and <br> — otherwise the original string is returned.
 *
 * @param {string} html
 * @returns {string}
 */
export function normalizePastedHtmlForParagraphs(html) {
  if (!html || typeof html !== 'string' || !/<br\s*\/?>/i.test(html)) return html;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;
    if (body.children.length !== 1) return html;
    const p = body.firstElementChild;
    if (!p || p.tagName !== 'P') return html;

    const kids = Array.from(p.childNodes);
    if (!kids.some((n) => n.nodeName === 'BR')) return html;

    const INLINE_OK = new Set([
      'BR',
      'STRONG',
      'EM',
      'B',
      'I',
      'U',
      'S',
      'SPAN',
      'A',
      'CODE',
      'MARK',
      'SUB',
      'SUP',
      'SMALL',
    ]);
    for (const n of kids) {
      if (n.nodeType === Node.TEXT_NODE) continue;
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.nodeName === 'BR') continue;
        if (INLINE_OK.has(n.nodeName)) continue;
        return html;
      }
      return html;
    }

    /** @type {Node[][]} */
    const chunks = [];
    /** @type {Node[]} */
    let cur = [];
    for (const n of kids) {
      if (n.nodeName === 'BR') {
        chunks.push(cur);
        cur = [];
      } else {
        cur.push(n.cloneNode(true));
      }
    }
    chunks.push(cur);

    const out = doc.createElement('div');
    for (const nodes of chunks) {
      const np = doc.createElement('p');
      for (const c of nodes) {
        np.appendChild(c);
      }
      const hasContent =
        (np.textContent && np.textContent.trim().length > 0) || np.querySelector('img,hr,svg,video');
      if (hasContent) {
        out.appendChild(np);
      }
    }
    if (out.children.length < 2) return html;
    return out.innerHTML;
  } catch {
    return html;
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizePastedPlainText(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\r\n?/g, '\n');
}
