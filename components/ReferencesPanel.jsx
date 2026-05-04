import { useRef, useState } from 'react';

/** @typedef {{ id: string, title: string, body: string }} ReferenceItem */

/** @param {{ references: ReferenceItem[], setReferences: React.Dispatch<React.SetStateAction<ReferenceItem[]>>, theme: any, pinnedRefId: string | null, setPinnedRefId: (id: string | null) => void, onGoWrite: () => void }} props */
export default function ReferencesPanel({
  references,
  setReferences,
  theme: t,
  pinnedRefId,
  setPinnedRefId,
  onGoWrite,
}) {
  const fileRef = useRef(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');

  function addFromDraft() {
    const title = draftTitle.trim() || 'Untitled reference';
    const body = draftBody;
    if (!body.trim()) return;
    const id = `ref-${Date.now()}`;
    setReferences((list) => [...list, { id, title, body }]);
    setDraftTitle('');
    setDraftBody('');
  }

  function removeRef(id) {
    if (!window.confirm('Remove this reference?')) return;
    setReferences((list) => list.filter((r) => r.id !== id));
    if (pinnedRefId === id) setPinnedRefId(null);
  }

  function onPickFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '') || 'Imported file';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const textish = ['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'rtf'].includes(ext);
    if (!textish) {
      window.alert(
        `“${file.name}” is not a plain-text format. Convert to .txt or .md and upload again, or paste the text below.`,
      );
      ev.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      const id = `ref-${Date.now()}`;
      setReferences((list) => [...list, { id, title: name, body: raw }]);
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
        Upload timelines, outlines, or notes (.txt, .md, .csv, .json…). Pin one to keep it beside the scene editor while you write.
      </div>

      <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.rtf,text/*" style={{ display: 'none' }} onChange={onPickFile} />
      <button type="button" style={btn(t)} onClick={() => fileRef.current?.click()}>
        upload file…
      </button>

      <div style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.08 }}>New reference (paste)</div>
      <input
        type="text"
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        placeholder="Title (e.g. Master timeline)"
        style={inp(t)}
      />
      <textarea
        value={draftBody}
        onChange={(e) => setDraftBody(e.target.value)}
        placeholder="Paste or type reference text…"
        style={{ ...inp(t), minHeight: 100, resize: 'vertical', lineHeight: 1.5 }}
      />
      <button type="button" style={btn(t)} onClick={addFromDraft} disabled={!draftBody.trim()}>
        add reference
      </button>

      <div style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.08 }}>Library</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {references.length === 0 ? (
          <div style={{ fontSize: 12, color: t.textMuted }}>No references yet.</div>
        ) : (
          references.map((r) => (
            <div
              key={r.id}
              style={{
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                padding: '8px 10px',
                background: t.canvas,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: t.text }}>{r.title}</div>
              <div style={{ fontSize: 10, color: t.textMuted, maxHeight: 72, overflow: 'hidden', marginBottom: 8 }}>
                {(r.body || '').slice(0, 400)}
                {(r.body || '').length > 400 ? '…' : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  style={{ ...btn(t), flex: '1 1 auto', fontSize: 11 }}
                  onClick={() => {
                    setPinnedRefId(r.id);
                    onGoWrite();
                  }}
                >
                  {pinnedRefId === r.id ? 'pinned ✓' : 'pin beside editor'}
                </button>
                <button type="button" style={{ ...btn(t), fontSize: 11, opacity: 0.85 }} onClick={() => removeRef(r.id)}>
                  remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function btn(t) {
  return {
    appearance: 'none',
    WebkitAppearance: 'none',
    font: 'inherit',
    cursor: 'pointer',
    border: `1px solid ${t.border}`,
    borderRadius: 4,
    padding: '6px 10px',
    background: t.sidebar,
    color: t.text,
    fontSize: 12,
  };
}

function inp(t) {
  return {
    width: '100%',
    boxSizing: 'border-box',
    background: t.canvas,
    border: `1px solid ${t.border}`,
    borderRadius: 4,
    padding: '8px 10px',
    fontSize: 12,
    color: t.text,
    fontFamily: t.fontUi,
    outline: 'none',
  };
}
