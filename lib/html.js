export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

/** Plain text -> safe HTML paragraphs (migration from old textarea). */
export function ensureHtml(content) {
  if (!content || !String(content).trim()) return '<p></p>';
  const s = String(content).trim();
  if (s.startsWith('<')) return content;
  return String(content)
    .split(/\n\n+/)
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function wordCountFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const text = div.textContent || div.innerText || '';
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function htmlToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').replace(/\u00a0/g, ' ').trim();
}
