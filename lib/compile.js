import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { escapeHtml, htmlToPlainText } from './html';

/** @typedef {{ id: string, title?: string }} TreeFolder */
/** @typedef {{ title?: string, subchapterTitle?: string, chapterDate?: string, synopsis?: string, content?: string }} Doc */

/** @param {TreeFolder[]} tree @param {Record<string, Doc>} docs @param {string} [bookTitle] */
export function compileMarkdownDownload(tree, docs, bookTitle = 'manuscript') {
  let md = '';
  if (bookTitle?.trim()) md += `# ${bookTitle.trim()}\n\n`;
  for (const folder of tree) {
    md += `## ${folder.title}\n\n`;
    for (const id of folder.children) {
      const d = docs[id];
      if (!d) continue;
      md += `### ${d.title || 'Untitled'}\n\n`;
      const subch = typeof d.subchapterTitle === 'string' ? d.subchapterTitle.trim() : '';
      if (subch) md += `#### ${subch.replace(/\n/g, ' ')}\n\n`;
      const chapterDate = typeof d.chapterDate === 'string' ? d.chapterDate.trim() : '';
      if (chapterDate) md += `Date: ${chapterDate}\n\n`;
      if (d.synopsis) md += `*${String(d.synopsis).replace(/\n/g, ' ')}*\n\n`;
      const body = htmlToPlainText(d.content);
      md += `${body}\n\n---\n\n`;
    }
  }
  saveAs(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${(bookTitle || 'manuscript').trim().replace(/[^\w-]+/g, '_') || 'manuscript'}-${Date.now()}.md`);
}

/** @param {TreeFolder[]} tree @param {Record<string, Doc>} docs @param {string} [bookTitle] */
export async function compileDocxDownload(tree, docs, bookTitle = 'manuscript') {
  const children = [];
  if (bookTitle?.trim()) {
    children.push(
      new Paragraph({
        text: bookTitle.trim(),
        heading: HeadingLevel.TITLE,
      }),
    );
  }

  for (const folder of tree) {
    children.push(
      new Paragraph({
        text: folder.title || 'Part',
        heading: HeadingLevel.HEADING_1,
      }),
    );
    for (const id of folder.children) {
      const d = docs[id];
      if (!d) continue;
      children.push(
        new Paragraph({
          text: d.title || 'Untitled scene',
          heading: HeadingLevel.HEADING_2,
        }),
      );
      const subch = typeof d.subchapterTitle === 'string' ? d.subchapterTitle.trim() : '';
      if (subch) {
        children.push(
          new Paragraph({
            text: subch,
            heading: HeadingLevel.HEADING_3,
          }),
        );
      }
      const chapterDate = typeof d.chapterDate === 'string' ? d.chapterDate.trim() : '';
      if (chapterDate) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: chapterDate, italics: true })],
          }),
        );
      }
      if (d.synopsis) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: d.synopsis, italics: true })],
          }),
        );
      }
      const plain = htmlToPlainText(d.content);
      for (const block of plain.split(/\n\n+/).filter(Boolean)) {
        children.push(new Paragraph({ children: [new TextRun(block)] }));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${(bookTitle || 'manuscript').trim().replace(/[^\w-]+/g, '_') || 'manuscript'}-${Date.now()}.docx`);
}

/**
 * Opens a printable view (browser print → Save as PDF).
 * Body uses plain paragraphs for predictable layout.
 *
 * @param {TreeFolder[]} tree
 * @param {Record<string, Doc>} docs
 * @param {string} bookTitle
 */
export function compilePrintWindow(tree, docs, bookTitle) {
  const w = window.open('', '_blank');
  if (!w) return;

  let bodyHtml = `<h1 class="bk">${escapeHtml(bookTitle)}</h1>`;
  for (const folder of tree) {
    bodyHtml += `<h2 class="part">${escapeHtml(folder.title || '')}</h2>`;
    for (const id of folder.children) {
      const d = docs[id];
      if (!d) continue;
      bodyHtml += `<section class="scene">`;
      bodyHtml += `<h3>${escapeHtml(d.title || '')}</h3>`;
      const subch = typeof d.subchapterTitle === 'string' ? d.subchapterTitle.trim() : '';
      if (subch) bodyHtml += `<h4 class="subch">${escapeHtml(subch).replace(/\n/g, '<br>')}</h4>`;
      const chapterDate = typeof d.chapterDate === 'string' ? d.chapterDate.trim() : '';
      if (chapterDate) bodyHtml += `<p class="date">${escapeHtml(chapterDate)}</p>`;
      if (d.synopsis) bodyHtml += `<p class="syn"><em>${escapeHtml(d.synopsis)}</em></p>`;
      const paragraphs = htmlToPlainText(d.content).split(/\n\n+/).filter(Boolean);
      for (const p of paragraphs.length ? paragraphs : ['']) {
        bodyHtml += `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`;
      }
      bodyHtml += `</section>`;
    }
  }

  const style = `
    @page { margin: 1in; }
    body { font-family: Georgia, 'Iowan Old Style', serif; max-width: 40rem; margin: 0 auto; padding: 1rem;
      line-height: 1.55; color: #111; }
    h1.bk { font-size: 1.6rem; margin-bottom: 2rem; }
    h2.part { font-size: 1.15rem; margin-top: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 1.05rem; margin: 1.25rem 0 0.25rem; }
    h4.subch { font-size: 0.95rem; font-weight: 500; color: #333; margin: 0 0 0.5rem; }
    p.date { font-size: 0.85rem; color: #555; margin: 0 0 0.6rem; }
    p.syn { color: #444; margin: 0 0 1rem; }
    p { margin: 0 0 0.85rem; text-align: justify; }
    section.scene { margin-bottom: 1.75rem; }
  `;

  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${escapeHtml(bookTitle)}</title>`);
  w.document.write(`<style>${style}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();

  requestAnimationFrame(() => {
    w.focus();
    w.print();
  });
}
