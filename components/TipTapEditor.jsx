import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { normalizePastedHtmlForParagraphs, normalizePastedPlainText } from '../lib/editorPaste.js';
import { PageBreak } from '../lib/pageBreakExtension.js';

/** Rich-text editor keyed by `sceneId` so switching scenes remounts cleanly. */
export default function TipTapEditor({
  sceneId,
  contentHtml,
  onHtmlChange,
  placeholder,
  proseFont,
  textColor,
  textAlign,
  placeholderMuted,
  sheetMode,
}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Typography,
        PageBreak,
        Placeholder.configure({ placeholder }),
      ],
      content: contentHtml,
      editorProps: {
        attributes: {
          class: `scriv-editor-root${sheetMode ? ' scriv-editor-sheet' : ''}`,
          style: [
            `font-family:${proseFont}`,
            `font-size:16px`,
            'line-height:1.85',
            `color:${textColor}`,
            `text-align:${textAlign}`,
            sheetMode ? 'min-height:70vh' : 'min-height:60vh',
            'outline:none',
          ].join(';'),
        },
        transformPastedHTML(html) {
          return normalizePastedHtmlForParagraphs(html);
        },
        transformPastedText(text, _plain, _view) {
          return normalizePastedPlainText(text);
        },
      },
      onUpdate: ({ editor }) => onHtmlChange(editor.getHTML()),
    },
    [sceneId],
  );

  if (!editor) return null;

  return (
    <div className={`scriv-tipwrap${sheetMode ? ' scriv-tipwrap-sheet' : ''}`}>
      {sheetMode ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => editor.chain().focus().insertPageBreak().run()}
            style={{
              font: 'inherit',
              fontSize: 11,
              cursor: 'pointer',
              border: `1px solid ${placeholderMuted}`,
              color: placeholderMuted,
              background: 'transparent',
              borderRadius: 4,
              padding: '4px 10px',
            }}
          >
            Insert page break
          </button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
      <EditorStyles placeholderMuted={placeholderMuted} sheetMode={sheetMode} />
    </div>
  );
}

function EditorStyles({ placeholderMuted, sheetMode }) {
  return (
    <style>{`
      .scriv-tipwrap-sheet {
        background: ${sheetMode ? '#c9c7c4' : 'transparent'};
        margin-left: -24px;
        margin-right: -24px;
        padding: 20px 24px 32px;
        border-radius: 4px;
      }
      .scriv-editor-root:focus { outline: none; }
      .scriv-editor-root p { margin: 0 0 0.9em; }
      .scriv-editor-root h1,.scriv-editor-root h2,.scriv-editor-root h3 {
        font-family: inherit; margin: 1.1em 0 0.5em;
      }
      .scriv-editor-root ul,.scriv-editor-root ol {
        padding-left: 1.25rem; margin: 0 0 1em;
      }
      .scriv-editor-sheet {
        max-width: 6.5in;
        margin-left: auto;
        margin-right: auto;
        min-height: 10in;
        padding: 1rem 1.25rem 1.5rem !important;
        background: #faf9f7 !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.12), 0 12px 28px rgba(0,0,0,0.08);
        border-radius: 2px;
      }
      .scriv-page-break {
        clear: both;
        height: ${sheetMode ? '56px' : '28px'};
        margin: ${sheetMode ? '1.25rem -1.25rem' : '0.75rem 0'};
        position: relative;
        user-select: none;
        background: ${sheetMode ? 'linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.08) 55%, transparent 55%)' : 'transparent'};
      }
      .scriv-page-break::after {
        content: 'Page break';
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: ${placeholderMuted};
        opacity: ${sheetMode ? '0.55' : '0.35'};
        pointer-events: none;
      }
      .scriv-tipwrap .ProseMirror p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        color: ${placeholderMuted};
        opacity: 0.45;
        pointer-events: none;
        height: 0;
      }
    `}</style>
  );
}
