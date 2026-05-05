import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { saveAs } from 'file-saver';
import { themes, themeIds } from './themes';
import { generateName, NAME_ORIGINS } from './nameGenerator';
import TipTapEditor from './components/TipTapEditor.jsx';
import ReferencesPanel from './components/ReferencesPanel.jsx';
import { ensureHtml, htmlToPlainText, wordCountFromHtml } from './lib/html';
import { compileMarkdownDownload, compileDocxDownload, compilePrintWindow } from './lib/compile';
import { readProjectFolder, writeProjectFolder, isTauriRuntime } from './lib/tauriDisk.js';

const STORAGE_KEY = 'scrivener-clone-data';
const DEFAULT_BOOK_TITLE = `The Cartographer's Daughter — draft three`;

const initialDocs = {
  'doc-1': {
    id: 'doc-1',
    title: `The atlas`,
    subchapterTitle: `Inheritance`,
    chapterDate: '',
    content: ensureHtml(`The atlas had been her grandfather's, then her father's, and now hers — its leather cover softened by three generations of hands.`),
    synopsis: `Eira inherits the atlas. Establishes her world.`,
    wordTarget: 2500,
    sceneNotes: '',
    snapshots: [],
  },
  'doc-2': {
    id: 'doc-2',
    title: `Ink-stained hands`,
    subchapterTitle: ``,
    chapterDate: '',
    content: `<p></p>`,
    synopsis: `Her work as a cartographer's apprentice. Hint at the mystery.`,
    wordTarget: 2500,
    sceneNotes: '',
    snapshots: [],
  },
  'doc-3': {
    id: 'doc-3',
    title: `A pale visitor`,
    subchapterTitle: `Three knocks`,
    chapterDate: '',
    content: ensureHtml(`The lamp had been burning for hours when she heard the knock — three slow, deliberate sounds that seemed to belong to no fist she recognized.`),
    synopsis: `Eira meets the stranger from the north. First hint of the missing map.`,
    wordTarget: 2500,
    sceneNotes: '',
    snapshots: [],
  },
};

const initialTree = [
  { id: 'part-1', title: `Part one`, type: `folder`, children: ['doc-1', 'doc-2', 'doc-3'] },
  { id: 'part-2', title: `Part two`, type: `folder`, children: [] },
];

/** @param {unknown} raw */
function normalizeReferences(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r, i) => {
      const o = /** @type {Record<string, unknown>} */ (r);
      return {
        id: String(o.id || `ref-${Date.now()}-${i}`),
        title: String(o.title || 'Untitled reference'),
        body: String(o.body || ''),
        kind: o.kind === 'image' || o.kind === 'pdf' ? o.kind : 'text',
        source: typeof o.source === 'string' ? o.source : undefined,
        mime: typeof o.mime === 'string' ? o.mime : undefined,
      };
    });
}

/** @param {unknown} parsed */
function normalizeLoadedState(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = /** @type {Record<string, unknown>} */ (parsed);
  const rawDocs = p.docs && typeof p.docs === 'object' ? p.docs : {};

  /** @type {Record<string, any>} */
  const docs = {};
  for (const [id, d] of Object.entries(rawDocs)) {
    if (!d || typeof d !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (d);
    docs[id] = {
      ...row,
      snapshots: Array.isArray(row.snapshots) ? row.snapshots : [],
      content: ensureHtml(/** @type {string} */ (row.content ?? '')),
      title: String(row.title ?? 'Untitled'),
      subchapterTitle: String(row.subchapterTitle ?? ''),
      chapterDate: String(row.chapterDate ?? ''),
      synopsis: String(row.synopsis ?? ''),
      wordTarget: typeof row.wordTarget === 'number' ? row.wordTarget : 2000,
      sceneNotes: String(row.sceneNotes ?? ''),
    };
  }
  if (!Object.keys(docs).length) Object.assign(docs, JSON.parse(JSON.stringify(initialDocs)));

  const rawTree = Array.isArray(p.tree) ? p.tree : null;
  const tree =
    rawTree?.length
      ? rawTree.map((f) =>
          typeof f === 'object' && f
            ? { .../** @type {object} */ (f), children: Array.isArray(/** @type {any} */ (f).children) ? [.../** @type {any} */ (f).children] : [] }
            : f,
        )
      : [...initialTree];

  const rawTheme = p.theme;
  const theme =
    typeof rawTheme === 'string' && themeIds.includes(rawTheme) ? rawTheme : 'library';
  const characters = Array.isArray(p.characters) ? p.characters : [];
  const binderView = p.binderView === 'corkboard' ? 'corkboard' : p.binderView === 'writing-room' || p.binderView === 'outline' ? 'writing-room' : 'binder';
  const viewMode =
    p.viewMode === 'editorial' || p.viewMode === 'focus' || p.viewMode === 'workspace'
      ? p.viewMode
      : binderView === 'corkboard'
        ? 'editorial'
        : binderView === 'writing-room'
          ? 'focus'
          : 'workspace';
  const sidebarSection =
    p.sidebarSection === 'characters'
      ? 'characters'
      : p.sidebarSection === 'trash'
        ? 'trash'
        : p.sidebarSection === 'references'
          ? 'references'
          : 'manuscript';
  const projectPath = typeof p.projectPath === 'string' ? p.projectPath : '';
  const trashedDocs = normalizeTrashedDocs(
    p.trashedDocs && typeof p.trashedDocs === 'object'
      ? /** @type {Record<string, unknown>} */ (p.trashedDocs)
      : {},
  );
  const references = normalizeReferences(p.references);
  const editorSheetMode = p.editorSheetMode === true;
  const binderCollapsed = p.binderCollapsed === true;
  const sideViewCollapsed = p.sideViewCollapsed === true;
  const manuscriptTitle = typeof p.manuscriptTitle === 'string' && p.manuscriptTitle.trim() ? p.manuscriptTitle : DEFAULT_BOOK_TITLE;

  return {
    docs,
    tree,
    theme,
    characters,
    binderView,
    viewMode,
    sidebarSection,
    projectPath,
    trashedDocs,
    references,
    editorSheetMode,
    binderCollapsed,
    sideViewCollapsed,
    manuscriptTitle,
  };
}

/** @param {Record<string, unknown>} raw */
function normalizeTrashedDocs(raw) {
  /** @type {Record<string, { deletedAt: number, fromFolderId: string | null, doc: any }>} */
  const out = {};
  for (const [id, row] of Object.entries(raw)) {
    if (!row || typeof row !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    const d = r.doc;
    if (!d || typeof d !== 'object') continue;
    const docRow = /** @type {Record<string, unknown>} */ (d);
    out[id] = {
      deletedAt: typeof r.deletedAt === 'number' ? r.deletedAt : Date.now(),
      fromFolderId: typeof r.fromFolderId === 'string' ? r.fromFolderId : null,
      doc: {
        ...docRow,
        id,
        snapshots: Array.isArray(docRow.snapshots) ? docRow.snapshots : [],
        content: ensureHtml(/** @type {string} */ (docRow.content ?? '')),
        title: String(docRow.title ?? 'Untitled'),
        subchapterTitle: String(docRow.subchapterTitle ?? ''),
        chapterDate: String(docRow.chapterDate ?? ''),
        synopsis: String(docRow.synopsis ?? ''),
        wordTarget: typeof docRow.wordTarget === 'number' ? docRow.wordTarget : 2000,
        sceneNotes: String(docRow.sceneNotes ?? ''),
      },
    };
  }
  return out;
}

function pickFirstSceneId(tree, docs) {
  for (const f of tree) {
    for (const id of f.children) {
      if (docs[id]) return id;
    }
  }
  return '';
}

function formatWhen(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(ts);
  }
}

export default function App() {
  const [theme, setTheme] = useState('library');
  const [docs, setDocs] = useState(() => ({ ...initialDocs }));
  const [tree, setTree] = useState(() => [...initialTree]);
  const [activeId, setActiveId] = useState('doc-3');
  const [expandedFolders, setExpandedFolders] = useState({ 'part-1': true });
  const [showNameGen, setShowNameGen] = useState(false);
  const [showCompileMenu, setShowCompileMenu] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [binderView, setBinderView] = useState('binder'); // legacy persisted view
  const [viewMode, setViewMode] = useState('workspace'); // workspace | editorial | focus
  const [sidebarSection, setSidebarSection] = useState('manuscript'); // manuscript | characters | references | trash
  const [composeKey, setComposeKey] = useState(0);
  const [references, setReferences] = useState([]);
  const [editorSheetMode, setEditorSheetMode] = useState(false);
  const [binderCollapsed, setBinderCollapsed] = useState(false);
  const [sideViewCollapsed, setSideViewCollapsed] = useState(false);
  const [manuscriptTitle, setManuscriptTitle] = useState(DEFAULT_BOOK_TITLE);
  const [showFocusBinder, setShowFocusBinder] = useState(false);
  const [binderSearch, setBinderSearch] = useState('');
  /** Pinned reference shown beside the scene editor (not persisted). */
  const [pinnedRefId, setPinnedRefId] = useState(null);

  /** @type {[Record<string, { deletedAt: number, fromFolderId: string | null, doc: any }>, React.Dispatch<React.SetStateAction<Record<string, { deletedAt: number, fromFolderId: string | null, doc: any }>>>]} */
  const [trashedDocs, setTrashedDocs] = useState({});

  const [projectPath, setProjectPath] = useState('');
  const [diskStatus, setDiskStatus] = useState('');
  const importInputRef = useRef(null);
  const bootstrappedDisk = useRef(false);

  const t = themes[theme];
  const chromeText = t.chromeText ?? t.text;
  const chromeTextMuted = t.chromeTextMuted ?? t.textMuted;
  const chromeTextDim = t.chromeTextDim ?? chromeTextMuted;
  const active = docs[activeId];

  const wordCount = active ? wordCountFromHtml(active.content) : 0;
  const activeFolder = tree.find((f) => f.children.includes(activeId)) ?? null;
  const activeChapterNumber = activeFolder ? Math.max(1, activeFolder.children.indexOf(activeId) + 1) : 1;
  const activeTarget = active?.wordTarget ?? 2500;
  const activeProgress = Math.max(0, Math.min(100, (wordCount / Math.max(1, activeTarget)) * 100));

  const pinnedReference = useMemo(
    () => (pinnedRefId ? references.find((r) => r.id === pinnedRefId) ?? null : null),
    [pinnedRefId, references],
  );

  const persistPayload = useMemo(
    () => ({
      v: 1,
      docs,
      tree,
      theme,
      characters,
      binderView,
      viewMode,
      sidebarSection,
      projectPath,
      trashedDocs,
      references,
      editorSheetMode,
      binderCollapsed,
      sideViewCollapsed,
      manuscriptTitle,
    }),
    [docs, tree, theme, characters, binderView, viewMode, sidebarSection, projectPath, trashedDocs, references, editorSheetMode, binderCollapsed, sideViewCollapsed, manuscriptTitle],
  );

  const persistPayloadRef = useRef(persistPayload);
  persistPayloadRef.current = persistPayload;

  /** Flush latest state synchronously so a fast quit still persists (debounce alone can miss the last edit). */
  useEffect(() => {
    function flushToLocalStorage() {
      try {
        const p = persistPayloadRef.current;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
      } catch (e) {
        console.warn('localStorage flush failed', e);
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flushToLocalStorage();
    }
    window.addEventListener('beforeunload', flushToLocalStorage);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushToLocalStorage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  /** Bootstrap: localStorage, then Tauri disk only if it is newer than local (avoids stale disk wiping edits). */
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    /** @type {unknown} */
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    let base = normalizeLoadedState(parsed);
    if (!base) base = normalizeLoadedState({});

    setDocs(base.docs);
    setTree(base.tree);
    setTheme(base.theme);
    setCharacters(base.characters);
    setBinderView(base.binderView);
    setViewMode(base.viewMode);
    setSidebarSection(base.sidebarSection);
    setProjectPath(base.projectPath);
    setTrashedDocs(base.trashedDocs);
    setReferences(base.references);
    setEditorSheetMode(base.editorSheetMode);
    setBinderCollapsed(base.binderCollapsed);
    setSideViewCollapsed(base.sideViewCollapsed);
    setManuscriptTitle(base.manuscriptTitle);

    async function boot() {
      const path = /** @type {string} */ (base?.projectPath || '');
      if (!isTauriRuntime() || !path || bootstrappedDisk.current) return;
      bootstrappedDisk.current = true;

      const disk = await readProjectFolder(path);
      if (!disk || typeof disk !== 'object') {
        setDiskStatus(`could not load disk project (using local)`);
        setTimeout(() => setDiskStatus(''), 5000);
        return;
      }
      const next = normalizeLoadedState(disk);
      if (!next) {
        setDiskStatus(`invalid disk project (using local)`);
        setTimeout(() => setDiskStatus(''), 5000);
        return;
      }

      const diskSavedAt = typeof /** @type {any} */ (disk).savedAt === 'number' ? /** @type {any} */ (disk).savedAt : 0;
      const localSavedAt =
        parsed && typeof parsed === 'object' && typeof /** @type {any} */ (parsed).savedAt === 'number'
          ? /** @type {any} */ (parsed).savedAt
          : 0;

      if (diskSavedAt > localSavedAt) {
        setDocs(next.docs);
        setTree(next.tree);
        setTheme(next.theme);
        setCharacters(next.characters);
        setBinderView(next.binderView);
        setViewMode(next.viewMode);
        setSidebarSection(next.sidebarSection);
        setTrashedDocs(next.trashedDocs);
        setReferences(next.references);
        setEditorSheetMode(next.editorSheetMode);
        setBinderCollapsed(next.binderCollapsed);
        setSideViewCollapsed(next.sideViewCollapsed);
        setManuscriptTitle(next.manuscriptTitle);
        setProjectPath(typeof /** @type {any} */ (disk).projectPath === 'string' ? /** @type {any} */ (disk).projectPath : path);
        setDiskStatus(`loaded ${path} from disk`);
      } else {
        setDiskStatus(`using local data (newer than disk)`);
      }
      setTimeout(() => setDiskStatus(''), 5000);
    }
    boot();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedAt = Date.now();
      const payload = { ...persistPayload, savedAt };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('localStorage save failed', e);
      }
      if (projectPath && isTauriRuntime()) {
        writeProjectFolder(projectPath, payload).then((ok) => {
          if (ok) setDiskStatus('saved to disk');
        });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [persistPayload, projectPath]);

  useEffect(() => {
    setBinderView(viewMode === 'editorial' ? 'corkboard' : viewMode === 'focus' ? 'writing-room' : 'binder');
  }, [viewMode]);

  const proseAlign = theme === 'library' ? 'justify' : 'left';

  function updateHtmlContent(id, content) {
    setDocs((d) => ({ ...d, [id]: { ...d[id], content } }));
  }
  function updateTitle(id, title) {
    setDocs((d) => ({ ...d, [id]: { ...d[id], title } }));
  }
  function updateSynopsis(id, synopsis) {
    setDocs((d) => ({ ...d, [id]: { ...d[id], synopsis } }));
  }

  function updateSubchapterTitle(id, subchapterTitle) {
    setDocs((d) => ({ ...d, [id]: { ...d[id], subchapterTitle } }));
  }
  function updateWordTarget(id, raw) {
    const n = Number.parseInt(String(raw).replace(/,/g, ''), 10);
    const wordTarget = Number.isFinite(n) ? Math.min(2_000_000, Math.max(100, n)) : 2000;
    setDocs((d) => ({ ...d, [id]: { ...d[id], wordTarget } }));
  }

  function updateSceneNotes(id, sceneNotes) {
    setDocs((d) => ({ ...d, [id]: { ...d[id], sceneNotes } }));
  }

  function addCharacterQuick() {
    const id = `char-${Date.now()}`;
    setCharacters((cs) => [...cs, { id, name: '', role: '', notes: '' }]);
    setSidebarSection('characters');
  }

  function addPlaceQuick() {
    const id = `ref-${Date.now()}`;
    setReferences((list) => [...list, { id, title: 'New place', body: '', kind: 'text' }]);
    setSidebarSection('references');
  }

  function addPart() {
    const id = `part-${Date.now()}`;
    setTree((tr) => [...tr, { id, title: 'New part', type: 'folder', children: [] }]);
    setExpandedFolders((e) => ({ ...e, [id]: true }));
  }

  function renamePart(folderId, nextTitle) {
    const t = String(nextTitle || '').trim();
    if (!t) return;
    setTree((tr) => tr.map((f) => (f.id === folderId ? { ...f, title: t } : f)));
  }

  function deletePart(folderId) {
    const folder = tree.find((f) => f.id === folderId);
    if (!folder || folder.children.length) return;
    if (tree.length <= 1) return;
    if (!window.confirm('Remove this empty part from the manuscript?')) return;
    setTree((tr) => tr.filter((f) => f.id !== folderId));
    setExpandedFolders((e) => {
      const { [folderId]: _, ...rest } = e;
      return rest;
    });
  }

  function addDocument(folderId) {
    const id = `doc-${Date.now()}`;
    setDocs((d) => ({
      ...d,
      [id]: {
        id,
        title: `Untitled scene`,
        subchapterTitle: '',
        chapterDate: '',
        content: `<p></p>`,
        synopsis: '',
        wordTarget: 2000,
        sceneNotes: '',
        snapshots: [],
      },
    }));
    setTree((tr) => tr.map((f) => (f.id === folderId ? { ...f, children: [...f.children, id] } : f)));
    setActiveId(id);
  }

  function reorderScenes(folderId, activeSid, overSid) {
    setTree((tr) =>
      tr.map((f) => {
        if (f.id !== folderId) return f;
        const oldIdx = f.children.indexOf(activeSid);
        const newIdx = f.children.indexOf(overSid);
        if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return f;
        return { ...f, children: arrayMove(f.children, oldIdx, newIdx) };
      }),
    );
  }

  function moveSceneToTrash(docId) {
    const doc = docs[docId];
    if (!doc) return;
    /** @type {string | null} */
    let fromFolderId = null;
    for (const f of tree) {
      if (f.children.includes(docId)) {
        fromFolderId = f.id;
        break;
      }
    }
    const nextDocs = { ...docs };
    delete nextDocs[docId];
    const nextTree = tree.map((f) => ({ ...f, children: f.children.filter((c) => c !== docId) }));
    const nextActive = activeId === docId ? pickFirstSceneId(nextTree, nextDocs) : activeId;

    setTrashedDocs((prev) => ({
      ...prev,
      [docId]: {
        deletedAt: Date.now(),
        fromFolderId,
        doc: JSON.parse(JSON.stringify(doc)),
      },
    }));
    setDocs(nextDocs);
    setTree(nextTree);
    setActiveId(nextActive);
  }

  function restoreFromTrash(docId) {
    const entry = trashedDocs[docId];
    if (!entry) return;
    const folderId =
      (entry.fromFolderId && tree.some((f) => f.id === entry.fromFolderId)
        ? entry.fromFolderId
        : tree[0]?.id) ?? null;
    if (!folderId) return;

    setDocs((d) => ({
      ...d,
      [docId]: {
        ...entry.doc,
        content: ensureHtml(entry.doc.content),
      },
    }));
    setTree((tr) =>
      tr.map((f) =>
        f.id === folderId && !f.children.includes(docId) ? { ...f, children: [...f.children, docId] } : f,
      ),
    );
    setTrashedDocs((prev) => {
      const { [docId]: _, ...rest } = prev;
      return rest;
    });
    setActiveId(docId);
    setSidebarSection('manuscript');
  }

  function purgeFromTrash(docId) {
    if (!window.confirm('Permanently remove this scene from trash?')) return;
    setTrashedDocs((prev) => {
      const { [docId]: _, ...rest } = prev;
      return rest;
    });
  }

  function emptyTrash() {
    const keys = Object.keys(trashedDocs);
    if (!keys.length) return;
    if (
      !window.confirm(
        keys.length === 1
          ? 'Permanently delete the scene in trash?'
          : `Permanently delete all ${keys.length} scenes in trash?`,
      )
    )
      return;
    setTrashedDocs({});
  }

  function takeSnapshot() {
    if (!active) return;
    const snap = {
      savedAt: Date.now(),
      title: active.title,
      content: active.content,
      synopsis: active.synopsis,
      subchapterTitle: active.subchapterTitle ?? '',
      chapterDate: active.chapterDate ?? '',
      wordTarget: active.wordTarget,
      sceneNotes: active.sceneNotes ?? '',
    };
    setDocs((d) => ({
      ...d,
      [activeId]: {
        ...d[activeId],
        snapshots: [snap, ...(Array.isArray(d[activeId].snapshots) ? d[activeId].snapshots : [])],
      },
    }));
  }

  function restoreSnapshot(snap) {
    if (!active) return;
    setDocs((d) => ({
      ...d,
      [activeId]: {
        ...d[activeId],
        title: snap.title,
        content: snap.content,
        synopsis: snap.synopsis,
        subchapterTitle: snap.subchapterTitle ?? '',
        chapterDate: snap.chapterDate ?? '',
        wordTarget: typeof snap.wordTarget === 'number' ? snap.wordTarget : d[activeId].wordTarget,
        sceneNotes: snap.sceneNotes ?? '',
      },
    }));
    setComposeKey((n) => n + 1);
  }
  function deleteSnapshot(savedAt) {
    if (!active) return;
    setDocs((d) => ({
      ...d,
      [activeId]: {
        ...d[activeId],
        snapshots: (d[activeId].snapshots || []).filter((s) => s.savedAt !== savedAt),
      },
    }));
  }

  const applyImportedState = useCallback((parsed) => {
    const normalized = normalizeLoadedState(parsed);
    if (!normalized) return;
    setDocs(normalized.docs);
    setTree(normalized.tree);
    setTheme(normalized.theme);
    setCharacters(normalized.characters);
    setBinderView(normalized.binderView);
    setViewMode(normalized.viewMode);
    setSidebarSection(normalized.sidebarSection);
    if (normalized.projectPath) setProjectPath(normalized.projectPath);
    setTrashedDocs(normalized.trashedDocs);
    setReferences(normalized.references);
    setEditorSheetMode(normalized.editorSheetMode);
    setBinderCollapsed(normalized.binderCollapsed);
    setSideViewCollapsed(normalized.sideViewCollapsed);
    setManuscriptTitle(normalized.manuscriptTitle);
    setComposeKey((n) => n + 1);
  }, []);

  function exportBackupJson() {
    saveAs(
      new Blob([JSON.stringify(persistPayload, null, 2)], { type: 'application/json' }),
      `manuscript-backup-${Date.now()}.json`,
    );
  }

  function onImportFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        applyImportedState(parsed);
      } catch (e) {
        console.error(e);
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  async function linkProjectFolder() {
    if (!isTauriRuntime()) return;
    const { open } = await import('@tauri-apps/plugin-dialog');
    const chosen = await open({ directory: true, multiple: false });
    if (typeof chosen !== 'string' || !chosen) return;
    const disk = await readProjectFolder(chosen);
    if (disk) applyImportedState(disk);
    setProjectPath(chosen);
    setDiskStatus(`linked ${chosen}`);
  }

  async function unlinkProjectFolder() {
    setProjectPath('');
    setDiskStatus('disk path cleared');
  }

  const titleBarFont = t.fontSerif;

  return (
    <div
      style={{
        height: '100vh',
        background: t.appBg,
        color: chromeText,
        fontFamily: t.fontUi,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {viewMode === 'focus' && showFocusBinder ? (
        <div style={{ position: 'absolute', top: 36, left: 0, bottom: 26, width: 320, background: t.sidebar, borderRight: `1px solid ${t.border}`, zIndex: 30, overflowY: 'auto', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ color: chromeTextMuted }}>⌕</span>
            <input
              value={binderSearch}
              onChange={(e) => setBinderSearch(e.target.value)}
              placeholder="Search manuscript..."
              style={{ ...characterInput(t), margin: 0 }}
            />
          </div>
          {tree.map((folder) => (
            <div key={folder.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', color: chromeTextMuted }}>{folder.title.toUpperCase()}</div>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {folder.children
                  .filter((id) => (docs[id]?.title || '').toLowerCase().includes(binderSearch.toLowerCase()))
                  .map((id, idx) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActiveId(id);
                        setShowFocusBinder(false);
                      }}
                      style={{ border: 'none', background: id === activeId ? t.activeBg : 'transparent', color: id === activeId ? t.activeText : t.textMuted, textAlign: 'left', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', fontFamily: t.fontSerif }}
                    >
                      {String(idx + 1).padStart(2, '0')} · {docs[id]?.title || 'Untitled'}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {viewMode === 'focus' ? (
        <div style={{ height: 36, background: t.desk ?? t.chrome, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: chromeTextMuted, fontSize: 11 }}>
            <button type="button" onClick={() => setShowFocusBinder((v) => !v)} style={{ border: 'none', background: 'transparent', color: chromeTextMuted, cursor: 'pointer' }}>≡</button>
            <span>{manuscriptTitle.toUpperCase()} — Ch. {activeChapterNumber}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setViewMode('workspace')} style={{ border: 'none', background: 'transparent', color: chromeTextMuted, cursor: 'pointer' }}>⌗</button>
            <button type="button" style={{ border: 'none', background: 'transparent', color: chromeTextMuted, cursor: 'pointer' }}>T</button>
            <button type="button" onClick={() => setTheme((prev) => themeIds[(themeIds.indexOf(prev) + 1) % themeIds.length])} style={{ border: 'none', background: 'transparent', color: chromeTextMuted, cursor: 'pointer' }}>☾</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ height: 56, background: t.chrome, borderBottom: `1px solid ${t.border}`, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14, padding: '0 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: t.appBg, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: t.fontSerif, fontSize: 24 }}>¶</div>
              <div style={{ minWidth: 0 }}>
                <input value={manuscriptTitle} onChange={(e) => setManuscriptTitle(e.target.value)} style={{ border: 'none', background: 'transparent', fontFamily: t.fontSerif, fontSize: 15, letterSpacing: 1.5, color: chromeText, textTransform: 'uppercase', outline: 'none', width: '100%' }} />
                <div style={{ fontSize: 11, color: chromeTextMuted }}>Draft 1 · {wordCount.toLocaleString()} of {(active?.wordTarget ?? 2500).toLocaleString()}w</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[
                { id: 'workspace', label: 'Manuscript', icon: '≡' },
                { id: 'editorial', label: 'Corkboard', icon: '▦' },
                { id: 'focus', label: "Writer's Room", icon: '⌗' },
              ].map((m) => (
                <button key={m.id} type="button" onClick={() => setViewMode(m.id)} style={{ border: `1px solid ${t.border}`, background: viewMode === m.id ? t.activeBg : t.canvas, color: viewMode === m.id ? t.activeText : chromeTextMuted, borderRadius: 999, padding: '5px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <span>{m.icon}</span><span>{m.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, position: 'relative' }}>
              <button type="button" onClick={() => setShowNameGen((s) => !s)} style={{ border: 'none', background: 'transparent', color: chromeTextMuted, cursor: 'pointer' }}>names</button>
              <button
                type="button"
                onClick={() => setTheme((prev) => themeIds[(themeIds.indexOf(prev) + 1) % themeIds.length])}
                title={`Theme: ${theme}`}
                aria-label="Cycle theme"
                style={{ border: 'none', background: 'transparent', color: chromeText, cursor: 'pointer', fontSize: 15, padding: 0 }}
              >
                {theme === 'library' ? '✦' : '★'}
              </button>
              <button type="button" onClick={() => setShowCompileMenu((s) => !s)} style={{ border: `1px solid transparent`, background: t.accentSolid ?? t.accent, color: '#fff', borderRadius: 6, padding: '7px 12px', cursor: 'pointer' }}>Compile</button>
              {showCompileMenu ? (
                <div style={{ position: 'absolute', top: 40, right: 0, background: t.sidebar, border: `1px solid ${t.border}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 20 }}>
                  <button type="button" style={btnStyle(t)} onClick={() => compileMarkdownDownload(tree, docs, manuscriptTitle)}>Markdown</button>
                  <button type="button" style={btnStyle(t)} onClick={() => void compileDocxDownload(tree, docs, manuscriptTitle)}>Word (.docx)</button>
                  <button type="button" style={btnStyle(t)} onClick={() => compilePrintWindow(tree, docs, manuscriptTitle)}>Print / PDF…</button>
                  <button type="button" style={btnStyle(t)} onClick={exportBackupJson}>export JSON…</button>
                  <button type="button" style={btnStyle(t)} onClick={() => importInputRef.current?.click()}>import JSON…</button>
                  <input ref={importInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImportFile} />
                </div>
              ) : null}
            </div>
          </div>
          <div style={{ minHeight: 28, background: t.canvas, borderBottom: `1px solid ${t.border}`, padding: '6px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: chromeTextMuted, fontStyle: 'italic' }}>
              <button type="button" onClick={() => setEditorSheetMode((s) => !s)} style={{ border: 'none', background: 'transparent', padding: 0, color: chromeTextMuted, fontSize: 11, fontStyle: 'italic', cursor: 'pointer' }}>{editorSheetMode ? 'page view' : 'continuous'}</button>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{theme}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{active ? `${wordCount.toLocaleString()} words` : '0 words'}</span>
            </div>
            <div style={{ color: chromeTextMuted, fontStyle: 'normal' }}>{diskStatus && !/saved/.test(diskStatus) ? 'saving...' : 'autosaved'}</div>
          </div>
        </>
      )}

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: viewMode === 'focus' ? `1fr 280px` : `${binderCollapsed ? '34px' : '220px'} 1fr ${sideViewCollapsed ? '34px' : '240px'}`,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {viewMode !== 'focus' ? (
        <div
          style={{
            background: t.sidebar,
            borderRight: `1px solid ${t.border}`,
            padding: binderCollapsed ? '10px 4px' : '14px 10px',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            height: '100%',
            gap: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: binderCollapsed ? 'nowrap' : 'wrap',
              gap: 6,
              flexShrink: 0,
              justifyContent: binderCollapsed ? 'center' : 'flex-start',
            }}
          >
            <button
              type="button"
              onClick={() => setBinderCollapsed((v) => !v)}
              style={{ ...btnStyle(t), width: binderCollapsed ? 24 : 'auto', padding: binderCollapsed ? '4px 0' : '4px 10px' }}
              title={binderCollapsed ? 'Expand binder' : 'Collapse binder'}
              aria-label={binderCollapsed ? 'Expand binder' : 'Collapse binder'}
            >
              {binderCollapsed ? '›' : '‹'}
            </button>
          </div>
          {!binderCollapsed ? (
            <>
          <div style={{ marginTop: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: t.canvas, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 8px' }}>
            <span style={{ color: chromeTextMuted }}>⌕</span>
            <input
              value={binderSearch}
              onChange={(e) => setBinderSearch(e.target.value)}
              placeholder="Search manuscript..."
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: t.text, fontSize: 12, fontFamily: t.fontUi }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setSidebarSection('manuscript')}
              style={{
                border: 'none',
                background: 'transparent',
                borderBottom: `2px solid ${sidebarSection === 'manuscript' ? t.accent : 'transparent'}`,
                color: sidebarSection === 'manuscript' ? t.accent : chromeTextMuted,
                padding: '0 0 6px 0',
                fontSize: 11,
                letterSpacing: 1.1,
                cursor: 'pointer',
              }}
            >
              MANUSCRIPT
            </button>
            <button
              type="button"
              onClick={() => setSidebarSection('characters')}
              style={{
                border: 'none',
                background: 'transparent',
                borderBottom: `2px solid ${sidebarSection === 'characters' ? t.accent : 'transparent'}`,
                color: sidebarSection === 'characters' ? t.accent : chromeTextMuted,
                padding: '0 0 6px 0',
                fontSize: 11,
                letterSpacing: 1.1,
                cursor: 'pointer',
              }}
            >
              CHARACTERS
            </button>
            <button
              type="button"
              onClick={() => setSidebarSection('references')}
              style={{
                border: 'none',
                background: 'transparent',
                borderBottom: `2px solid ${sidebarSection === 'references' ? t.accent : 'transparent'}`,
                color: sidebarSection === 'references' ? t.accent : chromeTextMuted,
                padding: '0 0 6px 0',
                fontSize: 11,
                letterSpacing: 1.1,
                cursor: 'pointer',
              }}
            >
              PLACES
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sidebarSection === 'manuscript' ? (
              <>
                <div style={sectionLabelStyle(t)}>MANUSCRIPT</div>
                {tree.map((folder, folderIndex) => (
                  <Folder
                    key={folder.id}
                    folder={folder}
                    partIndex={folderIndex}
                    docs={docs}
                    activeId={activeId}
                    expanded={expandedFolders[folder.id]}
                    onToggle={() => setExpandedFolders((e) => ({ ...e, [folder.id]: !e[folder.id] }))}
                    onSelect={setActiveId}
                    onAdd={() => addDocument(folder.id)}
                    onReorder={(a, b) => reorderScenes(folder.id, a, b)}
                    onMoveSceneToTrash={moveSceneToTrash}
                    onRenamePart={(fid) => {
                      const f = tree.find((x) => x.id === fid);
                      const next = window.prompt('Part title', f?.title ?? '');
                      if (next != null) renamePart(fid, next);
                    }}
                    onDeletePart={deletePart}
                    canDeletePart={tree.length > 1}
                    theme={t}
                    searchQuery={binderSearch}
                  />
                ))}
                <button type="button" style={{ ...btnStyle(t), width: '100%', marginTop: 4 }} onClick={addPart}>
                  + add part
                </button>
              </>
            ) : sidebarSection === 'characters' ? (
              <CharactersPanel characters={characters} setCharacters={setCharacters} theme={t} />
            ) : sidebarSection === 'references' ? (
              <ReferencesPanel
                references={references}
                setReferences={setReferences}
                theme={t}
                pinnedRefId={pinnedRefId}
                setPinnedRefId={setPinnedRefId}
                onGoWrite={() => setSidebarSection('manuscript')}
              />
            ) : (
              <TrashPanel
                trashedDocs={trashedDocs}
                onRestore={restoreFromTrash}
                onPurge={purgeFromTrash}
                onEmptyTrash={emptyTrash}
                theme={t}
              />
            )}
          </div>

          <div style={{ flexShrink: 0, marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
            <button
              type="button"
              onClick={() => setSidebarSection('trash')}
              style={{
                ...btnStyle(t),
                width: '100%',
                background: sidebarSection === 'trash' ? t.activeBg : 'transparent',
                color: sidebarSection === 'trash' ? t.activeText : chromeTextMuted,
              }}
              title="Trashed scenes"
            >
              trash{Object.keys(trashedDocs).length ? ` (${Object.keys(trashedDocs).length})` : ''}
            </button>
          </div>
            </>
          ) : null}
        </div>
        ) : null}

        <div
          style={{
            background: editorSheetMode ? (t.desk ?? t.canvas) : t.canvas,
            overflow: 'hidden',
            position: 'relative',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {showNameGen && <NameGenPanel theme={t} onClose={() => setShowNameGen(false)} />}
          {viewMode === 'editorial' ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <Corkboard
                tree={tree}
                docs={docs}
                activeId={activeId}
                onSelect={setActiveId}
                theme={t}
                onAddCharacter={addCharacterQuick}
                onAddPlace={addPlaceQuick}
              />
            </div>
          ) : viewMode === 'focus' ? (
            <WritingRoom tree={tree} docs={docs} activeId={activeId} onSelect={setActiveId} theme={t} />
          ) : active ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {pinnedReference && sidebarSection === 'manuscript' ? (
                <div
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    borderBottom: `1px solid ${t.border}`,
                    background: t.chrome,
                    fontSize: 11,
                    color: chromeTextMuted,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    Pinned reference: <strong style={{ color: chromeText }}>{pinnedReference.title}</strong>
                  </span>
                  <button type="button" style={btnStyle(t)} onClick={() => setPinnedRefId(null)}>
                    unpin
                  </button>
                </div>
              ) : null}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflowY: 'auto',
                    padding: pinnedReference && sidebarSection === 'manuscript' ? '24px 28px' : '40px 60px',
                    maxWidth: pinnedReference && sidebarSection === 'manuscript' ? 'none' : 720,
                    margin: pinnedReference && sidebarSection === 'manuscript' ? 0 : '0 auto',
                  }}
                >
                  {editorSheetMode ? (
                    <div
                      style={{
                        maxWidth: 700,
                        margin: '0 auto',
                        background: t.desk ?? t.sidebar,
                        borderRadius: 8,
                        padding: '10px 10px 14px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.18), 0 6px 14px rgba(0,0,0,0.12)',
                      }}
                    >
                      <div
                        style={{
                          width: 680,
                          margin: '0 auto',
                          background: t.canvas,
                          borderRadius: 2,
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.08)',
                          boxSizing: 'border-box',
                          padding: '80px 90px 140px',
                        }}
                      >
                        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 10, color: t.textMuted, letterSpacing: 0.4, marginBottom: 12 }}>
                          {`${manuscriptTitle.toUpperCase()} > ${activeFolder?.title || 'Part'} > Ch. ${activeChapterNumber}`}
                        </div>
                        <input
                          value={active.title}
                          onChange={(e) => updateTitle(activeId, e.target.value)}
                          style={{
                            fontFamily: t.fontSerif,
                            fontSize: 46,
                            fontWeight: 500,
                            color: t.text,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            marginBottom: 8,
                            padding: 0,
                            lineHeight: 1.12,
                          }}
                        />
                        <input
                          value={active.subchapterTitle ?? ''}
                          onChange={(e) => updateSubchapterTitle(activeId, e.target.value)}
                          placeholder="Subchapter title (optional)"
                          aria-label="Subchapter title"
                          style={{
                            fontFamily: t.fontSerif,
                            fontSize: 16,
                            fontWeight: 400,
                            color: t.textMuted,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            marginBottom: 10,
                            padding: 0,
                          }}
                        />
                        <div style={{ height: 1, background: t.border, marginBottom: 26 }} />
                        <TipTapEditor
                          key={`${activeId}:${composeKey}:${theme}`}
                          sceneId={activeId}
                          contentHtml={ensureHtml(active.content)}
                          onHtmlChange={(html) => updateHtmlContent(activeId, html)}
                          placeholder="Begin where you like…"
                          proseFont={t.fontProse}
                          textColor={t.text}
                          textAlign={proseAlign}
                          placeholderMuted={t.textMuted}
                          sheetMode={true}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 10, color: t.textMuted, letterSpacing: 0.4, marginBottom: 10 }}>
                        {`${manuscriptTitle.toUpperCase()} > ${activeFolder?.title || 'Part'} > Ch. ${activeChapterNumber}`}
                      </div>
                      <input
                        value={active.title}
                        onChange={(e) => updateTitle(activeId, e.target.value)}
                        style={{
                          fontFamily: t.fontSerif,
                          fontSize: 28,
                          fontWeight: 500,
                          color: t.text,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          width: '100%',
                          marginBottom: 6,
                          padding: 0,
                        }}
                      />
                      <input
                        value={active.subchapterTitle ?? ''}
                        onChange={(e) => updateSubchapterTitle(activeId, e.target.value)}
                        placeholder="Subchapter title (optional)"
                        aria-label="Subchapter title"
                        style={{
                          fontFamily: t.fontSerif,
                          fontSize: 16,
                          fontWeight: 400,
                          color: t.textMuted,
                          background: 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${t.border}`,
                          outline: 'none',
                          width: '100%',
                          marginBottom: 24,
                          padding: '0 0 6px 0',
                        }}
                      />
                      <TipTapEditor
                        key={`${activeId}:${composeKey}:${theme}`}
                        sceneId={activeId}
                        contentHtml={ensureHtml(active.content)}
                        onHtmlChange={(html) => updateHtmlContent(activeId, html)}
                        placeholder="Begin where you like…"
                        proseFont={t.fontProse}
                        textColor={t.text}
                        textAlign={proseAlign}
                        placeholderMuted={t.textMuted}
                        sheetMode={false}
                      />
                    </>
                  )}
                </div>
                {pinnedReference && sidebarSection === 'manuscript' ? (
                  <div
                    style={{
                      width: 300,
                      flexShrink: 0,
                      borderLeft: `1px solid ${t.border}`,
                      background: t.sidebar,
                      overflowY: 'auto',
                      padding: '14px 12px',
                      fontSize: 12,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      color: t.text,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                    }}
                  >
                    {pinnedReference.kind === 'image' && pinnedReference.source ? (
                      <img src={pinnedReference.source} alt={pinnedReference.title} style={{ width: '100%', height: 'auto', borderRadius: 6 }} />
                    ) : pinnedReference.kind === 'pdf' && pinnedReference.source ? (
                      <a href={pinnedReference.source} target="_blank" rel="noreferrer" style={{ color: t.accent }}>
                        Open PDF: {pinnedReference.title}
                      </a>
                    ) : (
                      pinnedReference.body
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div style={{ padding: '48px 40px', color: t.textMuted, fontFamily: t.fontSerif, textAlign: 'center' }}>
              {sidebarSection === 'trash'
                ? 'Open trash in the binder to restore scenes.'
                : 'Pick a scene in the binder, or add one with + on a folder.'}
            </div>
          )}
        </div>

        {viewMode === 'focus' ? (
          <FocusInspector active={active} wordCount={wordCount} theme={t} />
        ) : sideViewCollapsed ? (
          <div
            style={{
              background: t.sidebar,
              borderLeft: `1px solid ${t.border}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setSideViewCollapsed(false)}
              style={{ ...btnStyle(t), width: 24, padding: '4px 0' }}
              title="Expand side view"
              aria-label="Expand side view"
            >
              ‹
            </button>
          </div>
        ) : active && sidebarSection === 'manuscript' ? (
          <div
            style={{
              background: t.sidebar,
              borderLeft: `1px solid ${t.border}`,
              padding: '14px 12px',
              fontSize: 12,
              color: chromeText,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.4, color: chromeTextMuted }}>INSPECTOR</div>
              <button
                type="button"
                onClick={() => setSideViewCollapsed(true)}
                style={{ border: 'none', background: 'transparent', color: chromeTextMuted, cursor: 'pointer' }}
                aria-label="Collapse inspector"
              >
                ›
              </button>
            </div>
            <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, background: t.canvas, padding: '12px 10px', marginBottom: 14 }}>
              <div style={{ fontFamily: t.fontSerif, fontSize: 34, lineHeight: 1, color: chromeText }}>
                {wordCount.toLocaleString()}<span style={{ color: chromeTextMuted, fontSize: 20 }}>/{active.wordTarget.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 10, letterSpacing: 1, color: chromeTextMuted, marginTop: 4 }}>WORDS WRITTEN</div>
              <div style={{ marginTop: 10, height: 3, background: t.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${activeProgress}%`, height: '100%', background: t.accentSolid ?? t.accent }} />
              </div>
            </div>
            <div style={sectionLabelStyle(t)}>SUBCHAPTER TITLE</div>
            <input
              type="text"
              value={active.subchapterTitle ?? ''}
              onChange={(e) => updateSubchapterTitle(activeId, e.target.value)}
              placeholder="Line under chapter title"
              style={{
                width: '100%',
                background: t.canvas,
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 12,
                color: t.text,
                fontFamily: t.fontUi,
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />
            <div style={sectionLabelStyle(t)}>SYNOPSIS</div>
            <textarea
              value={active.synopsis}
              onChange={(e) => updateSynopsis(activeId, e.target.value)}
              placeholder="What happens here?"
              style={{
                width: '100%',
                background: t.canvas,
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                padding: 10,
                fontSize: 12,
                fontFamily: t.fontUi,
                color: t.text,
                lineHeight: 1.55,
                minHeight: 80,
                resize: 'vertical',
                marginBottom: 14,
                outline: 'none',
              }}
            />

            <div style={sectionLabelStyle(t)}>SCENE NOTES</div>
            <textarea
              value={active.sceneNotes ?? ''}
              onChange={(e) => updateSceneNotes(activeId, e.target.value)}
              placeholder="Internal notes, POV, date in story, continuity…"
              style={{
                width: '100%',
                background: t.canvas,
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                padding: 10,
                fontSize: 12,
                fontFamily: t.fontUi,
                color: t.text,
                lineHeight: 1.55,
                minHeight: 72,
                resize: 'vertical',
                marginBottom: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={sectionLabelStyle(t)}>CHARACTERS IN SCENE</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={chipStyle(t)}>{(characters[0] && (characters[0].name || 'Protagonist')) || 'Protagonist'}</span>
              <span style={chipStyle(t)}>+ Add</span>
            </div>
            <div style={sectionLabelStyle(t)}>PLACE</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={chipStyle(t)}>{active.chapterDate || 'Unknown'}</span>
              <span style={chipStyle(t)}>+ Add</span>
            </div>

            <div style={sectionLabelStyle(t)}>SCENE</div>
            <button
              type="button"
              style={{
                ...btnStyle(t),
                width: '100%',
                marginBottom: 14,
                color: t.accent,
                borderColor: t.accent,
                opacity: 0.92,
              }}
              title="Moves this scene out of the manuscript until you restore it from Trash"
              onClick={() => moveSceneToTrash(activeId)}
            >
              move to trash…
            </button>

            <div style={sectionLabelStyle(t)}>SNAPSHOTS</div>
            <button type="button" style={{ ...btnStyle(t), width: '100%', marginBottom: 10 }} onClick={takeSnapshot}>
              capture snapshot
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {(active.snapshots || []).map((snap) => (
                <div
                  key={snap.savedAt}
                  style={{
                    textAlign: 'left',
                    background: t.canvas,
                    border: `1px solid ${t.border}`,
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                    color: t.text,
                    fontFamily: t.fontUi,
                  }}
                >
                  <button type="button" onClick={() => restoreSnapshot(snap)} style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
                    <div style={{ color: chromeTextMuted, marginBottom: 4 }}>{formatWhen(snap.savedAt)}</div>
                    <div style={{ fontWeight: 600 }}>{snap.title}</div>
                  </button>
                  <button type="button" onClick={() => deleteSnapshot(snap.savedAt)} style={{ ...btnStyle(t), marginTop: 6, padding: '3px 8px', fontSize: 10 }}>
                    delete
                  </button>
                </div>
              ))}
              {(active.snapshots || []).length === 0 ? (
            <div style={{ fontSize: 11, color: chromeTextMuted }}>No checkpoints yet.</div>
              ) : null}
            </div>

            <div style={sectionLabelStyle(t)}>METADATA</div>
            <div style={{ color: chromeTextMuted, lineHeight: 1.9, marginBottom: 8 }}>
              <div>
                Words · <span style={{ color: chromeText }}>{wordCount.toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                ≈ Pages (250 wpp) ·{' '}
                <span style={{ color: chromeText }}>{Math.max(1, Math.round(wordCount / 250)).toLocaleString()}</span>
              </div>
            </div>
            <label style={{ fontSize: 10, color: chromeTextMuted, display: 'block', marginBottom: 4 }}>Target word count</label>
            <input
              type="number"
              min={100}
              step={100}
              value={active.wordTarget}
              onChange={(e) => updateWordTarget(activeId, e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: t.canvas,
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 12,
                color: t.text,
                fontFamily: t.fontUi,
                marginBottom: 12,
              }}
            />
            <div
              style={{
                marginTop: 4,
                height: 3,
                background: t.border,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (wordCount / Math.max(1, active.wordTarget)) * 100)}%`,
                  height: '100%',
                  background: t.accent,
                  transition: 'width 200ms',
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              background: t.sidebar,
              borderLeft: `1px solid ${t.border}`,
              padding: '14px 12px',
              fontSize: 12,
              color: chromeTextMuted,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setSideViewCollapsed(true)}
                style={{ ...btnStyle(t), width: 24, padding: '4px 0' }}
                title="Collapse side view"
                aria-label="Collapse side view"
              >
                ›
              </button>
            </div>
            Inspector available in manuscript tab.
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 14,
          padding: '6px 14px',
          background: t.chrome,
          borderTop: `1px solid ${t.border}`,
          fontSize: 11,
          color: chromeTextMuted,
          fontFamily: titleBarFont,
        }}
      >
        <span>
          {active ? `${wordCount.toLocaleString()} / ${active.wordTarget.toLocaleString()} words` : '—'}
        </span>
        <span>{diskStatus || 'autosaved locally'}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.75 }}>{isTauriRuntime() ? `desktop` : `browser`}</span>
      </div>
    </div>
  );
}

/** Same shape as themes.library for inline styles */
/** @typedef {typeof themes.library} ThemeTokens */

/** @param {{ folder: any, partIndex: number, docs: Record<string, any>, activeId: string, expanded: boolean, onToggle: () => void, onSelect: (id: string) => void, onAdd: () => void, onReorder: (a: string, b: string) => void, onMoveSceneToTrash: (id: string) => void, onRenamePart: (folderId: string) => void, onDeletePart: (folderId: string) => void, canDeletePart: boolean, theme: ThemeTokens, searchQuery: string }} props */
function Folder({
  folder,
  partIndex,
  docs,
  activeId,
  expanded,
  onToggle,
  onSelect,
  onAdd,
  onReorder,
  onMoveSceneToTrash,
  onRenamePart,
  onDeletePart,
  canDeletePart,
  theme,
  searchQuery,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const cText = chromeText(theme);
  const cMuted = chromeMuted(theme);

  /** @param {import('@dnd-kit/core').DragEndEvent} ev */
  function handleDragEnd(ev) {
    const { active: a, over: o } = ev;
    if (!o || a.id === o.id) return;
    onReorder(String(a.id), String(o.id));
  }

  const filteredChildren = folder.children.filter((id) =>
    !searchQuery.trim()
      ? true
      : `${docs[id]?.title || ''} ${docs[id]?.subchapterTitle || ''}`.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          padding: '4px 4px',
          color: cText,
          fontWeight: 500,
        }}
      >
        <span style={{ fontSize: 10 }}>{expanded ? '▾' : '▸'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, letterSpacing: 1.2, display: 'block', color: cMuted }}>{`PART ${String(partIndex + 1).padStart(2, '0')}`}</span>
          <span style={{ fontFamily: theme.fontSerif, fontStyle: 'italic' }}>{folder.title}</span>
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRenamePart(folder.id);
          }}
          style={{
            opacity: 0.45,
            fontSize: 11,
            padding: '0 4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: cMuted,
          }}
          title="Rename part"
          aria-label="Rename part"
        >
          ✎
        </button>
        {canDeletePart && folder.children.length === 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeletePart(folder.id);
            }}
            style={{
              opacity: 0.45,
              fontSize: 11,
              padding: '0 4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: cMuted,
            }}
            title="Delete empty part"
            aria-label="Delete empty part"
          >
            ✕
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          style={{
            opacity: 0.5,
            fontSize: 14,
            padding: '0 6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: cMuted,
          }}
          title="Add scene"
          aria-label="Add scene"
        >
          +
        </button>
      </div>

      {expanded ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredChildren} strategy={verticalListSortingStrategy}>
            <div style={{ paddingLeft: 14 }}>
              {filteredChildren.map((id) => {
                const doc = docs[id];
                if (!doc) return null;
                return (
                  <SortableSceneRow
                    key={id}
                    id={id}
                    number={Math.max(1, folder.children.indexOf(id) + 1)}
                    title={doc.title}
                    subchapterTitle={doc.subchapterTitle ?? ''}
                    wordCount={wordCountFromHtml(doc.content)}
                    chapterDate={doc.chapterDate || ''}
                    selected={id === activeId}
                    theme={theme}
                    onSelect={() => onSelect(id)}
                    onMoveToTrash={() => onMoveSceneToTrash(id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}
    </div>
  );
}

/** @param {{ id: string, number: number, title: string, subchapterTitle: string, wordCount: number, chapterDate: string, selected: boolean, theme: ThemeTokens, onSelect: () => void, onMoveToTrash: () => void }} props */
function SortableSceneRow({ id, number, title, subchapterTitle, wordCount, chapterDate, selected, theme, onSelect, onMoveToTrash }) {
  const cText = chromeText(theme);
  const cMuted = chromeMuted(theme);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          padding: selected ? '4px 8px' : '4px 4px',
          margin: '1px 0',
          color: selected ? theme.activeText : cMuted,
          background: selected ? theme.activeBg : 'transparent',
          borderRadius: 3,
          fontWeight: selected ? 500 : 400,
        }}
      >
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder scenes"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.preventDefault()}
          style={{
            touchAction: 'none',
            cursor: 'grab',
            border: 'none',
            background: 'transparent',
            color: cMuted,
            padding: '0 4px',
            fontSize: 13,
            marginTop: 2,
          }}
        >
          ⋮⋮
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect();
            }
          }}
          style={{ flex: 1, cursor: 'pointer', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <span style={{ fontSize: 14, color: cMuted, fontFamily: theme.fontSerif, minWidth: 22 }}>{String(number).padStart(2, '0')}</span>
          <span style={{ fontFamily: theme.fontSerif, fontStyle: 'italic', fontWeight: selected ? 500 : 400, color: selected ? theme.activeText : cText }}>{title}</span>
          <span style={{ fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: cMuted, lineHeight: 1.25 }}>
            {`${Math.max(0, wordCount).toLocaleString()}w${chapterDate ? ` · ${chapterDate}` : ''}`}
          </span>
        </div>
        <button
          type="button"
          aria-label={`Move "${title}" to trash`}
          title="Trash"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMoveToTrash();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: cMuted,
            opacity: 0.55,
            cursor: 'pointer',
            padding: '0 4px',
            fontSize: 12,
            marginTop: 2,
          }}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

function truncateSynopsis(text, max) {
  const s = String(text || '').trim();
  if (!s.length) return 'No synopsis.';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** @param {{ tree: typeof initialTree, docs: Record<string, any>, activeId: string, onSelect: (id:string)=>void, theme: ThemeTokens }} props */
function WritingRoom({ tree, docs, activeId, onSelect, theme }) {
  const activeDoc = docs[activeId];
  const activeFolder = tree.find((f) => f.children.includes(activeId));
  const paragraphs = activeDoc ? htmlToPlainText(activeDoc.content).split(/\n{2,}/).filter(Boolean) : [];
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: theme.canvas, padding: '9vh 0 20vh' }}>
      <div style={{ width: 'min(640px, calc(100% - 64px))', margin: '0 auto', paddingRight: 260 }}>
        {activeDoc ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '6vh' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.26em', color: theme.textMuted, marginBottom: 16, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                — {String(Math.max(1, activeFolder ? activeFolder.children.indexOf(activeId) + 1 : 1)).padStart(2, '0')} —
              </div>
              <div style={{ fontFamily: theme.fontSerif, fontSize: 38, lineHeight: 1.16, color: theme.text }}>{activeDoc.title}</div>
              {(activeDoc.subchapterTitle || '').trim() ? (
                <div style={{ marginTop: 10, fontFamily: theme.fontSerif, fontStyle: 'italic', fontSize: 20, color: theme.textMuted }}>
                  {activeDoc.subchapterTitle}
                </div>
              ) : null}
              {activeDoc.chapterDate ? (
                <div style={{ marginTop: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 11, color: theme.textMuted }}>
                  {activeDoc.chapterDate}
                </div>
              ) : null}
            </div>
            <div style={{ fontFamily: theme.fontProse, fontSize: 19, lineHeight: 1.72, color: theme.text, opacity: 0.72, textAlign: 'left' }}>
              {paragraphs.map((p, idx) => (
                <p key={idx} style={{ margin: '0 0 1em 0' }}>
                  {p}
                </p>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div style={{ position: 'sticky', top: '12vh', marginTop: '-36vh', marginLeft: 'auto', width: 260, paddingRight: 24 }}>
        <div style={{ borderLeft: `2px solid ${theme.border}`, paddingLeft: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', color: theme.textMuted, marginBottom: 8 }}>SCENES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tree.flatMap((folder) =>
              folder.children.map((id) => {
                const doc = docs[id];
                if (!doc) return null;
                const selected = id === activeId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelect(id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: selected ? theme.accent : theme.textMuted,
                      textAlign: 'left',
                      padding: '4px 0',
                      cursor: 'pointer',
                      fontFamily: theme.fontSerif,
                      fontSize: 14,
                    }}
                  >
                    {doc.title}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @param {{ tree: typeof initialTree, docs: Record<string, any>, activeId: string, onSelect: (id:string)=>void, theme: ThemeTokens, onAddCharacter: () => void, onAddPlace: () => void }} props */
function Corkboard({ tree, docs, activeId, onSelect, theme, onAddCharacter, onAddPlace }) {
  return (
    <div style={{ padding: '26px 38px 72px', height: '100%', overflowY: 'auto', background: theme.canvas }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button type="button" style={btnStyle(theme)} onClick={onAddCharacter}>
          + character
        </button>
        <button type="button" style={btnStyle(theme)} onClick={onAddPlace}>
          + place
        </button>
      </div>
      {tree.map((folder) => (
        <section key={folder.id} style={{ marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingBottom: 10, borderBottom: `1px solid ${theme.border}`, marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: theme.textMuted }}>PART</div>
            <div style={{ fontFamily: theme.fontSerif, fontSize: 20, color: theme.text }}>{folder.title}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(236px, 1fr))', gap: 16 }}>
            {folder.children.map((id) => {
              const doc = docs[id];
              if (!doc) return null;
              const isActive = id === activeId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: '14px 14px 16px',
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    background: isActive ? theme.activeBg : theme.sidebar,
                    color: isActive ? theme.activeText : theme.text,
                    minHeight: 176,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 10, color: theme.textMuted, letterSpacing: 0.08 }}>{Math.max(1, folder.children.indexOf(id) + 1)}</div>
                  <div style={{ fontFamily: theme.fontSerif, fontSize: 19, fontWeight: 500, lineHeight: 1.2 }}>{doc.title}</div>
                  <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.45, flex: 1 }}>{truncateSynopsis(doc.synopsis, 220)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: theme.textMuted }}>
                    <span>{Math.max(0, wordCountFromHtml(doc.content)).toLocaleString()} words</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div style={{ height: 18 }} />
    </div>
  );
}
/** @param {{ trashedDocs: Record<string, { deletedAt: number, fromFolderId: string | null, doc: any }>, onRestore: (id: string) => void, onPurge: (id: string) => void, onEmptyTrash: () => void, theme: ThemeTokens }} props */
function TrashPanel({ trashedDocs, onRestore, onPurge, onEmptyTrash, theme }) {
  const cMuted = chromeMuted(theme);
  const rows = useMemo(
    () =>
      Object.entries(trashedDocs)
        .map(([id, entry]) => ({ id, ...entry }))
        .sort((a, b) => b.deletedAt - a.deletedAt),
    [trashedDocs],
  );

  return (
    <>
      <div style={sectionLabelStyle(theme)}>TRASH</div>
      <p style={{ fontSize: 11, color: cMuted, lineHeight: 1.45, margin: '0 0 12px 0', paddingRight: 2 }}>
        Scenes removed from the manuscript land here until you restore or delete them for good.
      </p>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: cMuted }}>Trash is empty.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 6,
                  padding: '10px',
                  background: theme.canvas,
                }}
              >
                <div style={{ fontFamily: theme.fontSerif, fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{row.doc.title}</div>
                <div style={{ fontSize: 10, color: cMuted, marginBottom: 10 }}>{formatWhen(row.deletedAt)}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...btnStyle(theme), flex: '1 1 auto' }} onClick={() => onRestore(row.id)}>
                    restore
                  </button>
                  <button
                    type="button"
                    style={{ ...btnStyle(theme), flex: '1 1 auto', opacity: 0.85 }}
                    onClick={() => onPurge(row.id)}
                  >
                    delete forever
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" style={{ ...btnStyle(theme), width: '100%' }} onClick={onEmptyTrash}>
            empty trash…
          </button>
        </>
      )}
    </>
  );
}

/** @param {{ characters: any[], setCharacters: React.Dispatch<React.SetStateAction<any[]>>, theme: ThemeTokens }} props */
function CharactersPanel({ characters, setCharacters, theme }) {
  const cMuted = chromeMuted(theme);
  function addCharacter() {
    const id = `char-${Date.now()}`;
    setCharacters((cs) => [...cs, { id, name: '', role: '', notes: '' }]);
  }
  /** @param {string} id @param {Record<string,string>} patch */
  function patchCharacter(id, patch) {
    setCharacters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  /** @param {string} id */
  function deleteCharacter(id) {
    setCharacters((cs) => cs.filter((c) => c.id !== id));
  }

  return (
    <>
      <div style={sectionLabelStyle(theme)}>CHARACTER SHEETS</div>
      <button type="button" style={{ ...btnStyle(theme), width: '100%', marginBottom: 10 }} onClick={addCharacter}>
        new character
      </button>
      {!characters.length ? (
        <div style={{ fontSize: 12, color: cMuted, lineHeight: 1.5 }}>
          Outline names, arcs, flaws — handy when you rename someone mid-draft.
        </div>
      ) : (
        characters.map((c) => (
          <div
            key={c.id}
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              padding: 10,
              marginBottom: 10,
              background: theme.canvas,
            }}
          >
            <input
              value={c.name}
              placeholder="Name"
              onChange={(e) => patchCharacter(c.id, { name: e.target.value })}
              style={{ ...characterInput(theme), marginBottom: 8 }}
            />
            <input
              value={c.role}
              placeholder="Role / faction"
              onChange={(e) => patchCharacter(c.id, { role: e.target.value })}
              style={{ ...characterInput(theme), marginBottom: 8 }}
            />
            <textarea
              value={c.notes}
              placeholder="Backstory, wants, arcs…"
              onChange={(e) => patchCharacter(c.id, { notes: e.target.value })}
              rows={6}
              style={{ ...characterTextarea(theme), marginBottom: 8 }}
            />
            <button type="button" style={{ ...btnStyle(theme), fontSize: 10 }} onClick={() => deleteCharacter(c.id)}>
              delete
            </button>
          </div>
        ))
      )}
    </>
  );
}

/** @param {{ theme: ThemeTokens, onClose: () => void }} props */
function NameGenPanel({ theme, onClose }) {
  const cMuted = chromeMuted(theme);
  const cText = chromeText(theme);
  const [origin, setOrigin] = useState('any');
  const [gender, setGender] = useState('any');
  const [results, setResults] = useState(() => Array.from({ length: 8 }, () => generateName('any', 'any')));

  function regenerate() {
    setResults(Array.from({ length: 8 }, () => generateName(origin, gender)));
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        width: 280,
        background: theme.sidebar,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: 14,
        zIndex: 10,
        boxShadow: '0 10px 28px rgba(42,36,28,0.18)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ ...sectionLabelStyle(theme), margin: 0, flex: 1 }}>NAME GENERATOR</div>
        <span
          onClick={onClose}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClose();
            }
          }}
          style={{ cursor: 'pointer', color: cMuted }}
        >
          ×
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={{ ...selectStyle(theme), flex: 1 }}>
          <option value="any">any origin</option>
          {NAME_ORIGINS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ ...selectStyle(theme), flex: 1 }}>
          <option value="any">any</option>
          <option value="feminine">feminine</option>
          <option value="masculine">masculine</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        {results.map((name, i) => (
          <div
            key={i}
            style={{
              padding: '6px 8px',
              background: theme.canvas,
              border: `1px solid ${theme.border}`,
              borderRadius: 3,
              fontSize: 12,
              fontFamily: theme.fontSerif,
              color: cText,
            }}
          >
            {name}
          </div>
        ))}
      </div>
      <button type="button" onClick={regenerate} style={{ ...btnStyle(theme), width: '100%' }}>
        regenerate
      </button>
    </div>
  );
}

function FocusInspector({ active, wordCount, theme }) {
  if (!active) return <div style={{ background: theme.sidebar, borderLeft: `1px solid ${theme.border}` }} />;
  const muted = chromeMuted(theme);
  const pct = Math.max(0, Math.min(100, (wordCount / Math.max(1, active.wordTarget || 1)) * 100));
  return (
    <div style={{ background: theme.sidebar, borderLeft: `1px solid ${theme.border}`, padding: '16px 14px', color: muted, overflowY: 'auto' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 8 }}>SYNOPSIS</div>
      <div style={{ fontFamily: theme.fontSerif, fontStyle: 'italic', marginBottom: 16 }}>{active.synopsis || 'No synopsis yet.'}</div>
      <div style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 8 }}>NOTE</div>
      <div style={{ fontFamily: theme.fontSerif, fontStyle: 'italic', marginBottom: 16 }}>{active.sceneNotes || 'No notes yet.'}</div>
      <div style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 8 }}>IN THIS SCENE</div>
      <div style={{ fontFamily: theme.fontSerif, fontStyle: 'italic', marginBottom: 16 }}>{active.subchapterTitle || '—'}</div>
      <div style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 8 }}>TARGETS</div>
      <div style={{ fontFamily: theme.fontUi, fontSize: 12 }}>{`${wordCount.toLocaleString()}w of ${(active.wordTarget || 0).toLocaleString()}w · ${Math.round(pct)}%`}</div>
    </div>
  );
}

/** @param {ThemeTokens} t */
function sectionLabelStyle(t) {
  return {
    fontFamily: t.fontSerif,
    fontSize: 10,
    color: chromeDim(t),
    letterSpacing: 1.5,
    marginBottom: 10,
    fontWeight: 500,
  };
}

/** @param {ThemeTokens} t */
function btnStyle(t) {
  return {
    background: 'transparent',
    border: `1px solid ${t.border}`,
    color: chromeMuted(t),
    padding: '6px 10px',
    fontSize: 12,
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 0.15,
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
  };
}

/** @param {ThemeTokens} t */
function selectStyle(t) {
  return {
    background: t.canvas,
    border: `1px solid ${t.border}`,
    color: chromeText(t),
    fontSize: 12,
    padding: '6px 8px',
    borderRadius: 6,
    fontFamily: 'inherit',
  };
}

/** @param {ThemeTokens} t */
function detailsStyle(t) {
  return {
    position: 'relative',
    padding: '4px 8px',
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    color: chromeMuted(t),
    background: t.canvas,
  };
}

/** @param {ThemeTokens} t */
function summaryStyle(t) {
  return {
    cursor: 'pointer',
    userSelect: 'none',
    color: chromeMuted(t),
    fontFamily: 'inherit',
    letterSpacing: 0.2,
  };
}

/** @param {ThemeTokens} t */
function chipStyle(t) {
  return {
    border: `1px solid ${t.border}`,
    borderRadius: 999,
    padding: '4px 9px',
    fontSize: 11,
    color: chromeText(t),
    background: t.canvas,
  };
}

/** @param {ThemeTokens} t */
function characterInput(t) {
  return {
    width: '100%',
    background: t.canvas,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: t.fontUi,
    fontSize: 12,
    color: t.text,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

/** @param {ThemeTokens} t */
function characterTextarea(t) {
  return {
    width: '100%',
    boxSizing: 'border-box',
    background: t.canvas,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    padding: 10,
    fontFamily: t.fontUi,
    fontSize: 12,
    color: t.text,
    lineHeight: 1.55,
    outline: 'none',
    resize: 'vertical',
  };
}

/** @param {ThemeTokens} t */
function chromeText(t) {
  return t.chromeText ?? t.text;
}
/** @param {ThemeTokens} t */
function chromeMuted(t) {
  return t.chromeTextMuted ?? t.textMuted;
}
/** @param {ThemeTokens} t */
function chromeDim(t) {
  return t.chromeTextDim ?? t.chromeTextMuted ?? t.textMuted;
}
