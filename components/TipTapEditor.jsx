import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { normalizePastedHtmlForParagraphs, normalizePastedPlainText } from '../lib/editorPaste.js';

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
      <EditorContent editor={editor} />
      <EditorStyles placeholderMuted={placeholderMuted} sheetMode={sheetMode} />
    </div>
  );
}

function EditorStyles({ placeholderMuted, sheetMode }) {
  return (
    <style>{`
      .scriv-tipwrap-sheet {
        margin-top: 0;
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
        /* Single continuous page on desk (no pagination tricks). */
        min-height: 70vh;
        padding: 0 !important;
        background: transparent !important;
        box-sizing: border-box;
      }
      .scriv-editor-sheet {
        box-shadow: none !important;
        border: none !important;
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
