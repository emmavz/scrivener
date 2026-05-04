# Scrivener clone — starter

A local writing environment for novelists, with two switchable visual themes.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## What's here

- **Three-pane layout**: binder (folders/scenes) · editor · inspector (synopsis + word count)
- **Two themes**: `library` (warm, wood-and-paper, all-serif) and `atelier` (clean, modern, mixed type). Toggle in the title bar.
- **Name generator**: click the button in the title bar. Origins: english, nordic, celtic, fantasy. Edit `src/nameGenerator.js` to add more.
- **Autosave to localStorage**: your work persists between sessions. (We'll swap this for real disk later.)
- **Add scenes**: click the `+` next to a folder.
- **Editable everything**: title, body, synopsis.

## File layout

```
src/
  App.jsx              ← the whole app, ~300 lines
  themes.js            ← the two vibes, as plain data
  nameGenerator.js     ← name lists + picker function
  main.jsx             ← React entry point
index.html
package.json
vite.config.js
```

## Where to go next (roadmap)

Easy wins, in rough order of bang-for-buck:

1. **Better editor** — swap the `<textarea>` for [TipTap](https://tiptap.dev) so you get proper rich text, smart quotes, em-dash autoreplace.
2. **Corkboard view** — a grid of synopsis cards. Mostly just CSS Grid + the data you already have.
3. **Drag to reorder** scenes in the binder. [`dnd-kit`](https://dndkit.com) is the right choice.
4. **Real file storage** — wrap this in [Tauri](https://tauri.app) and you can save your manuscript as actual files on disk (one `.md` per scene, with frontmatter for metadata). About a day of work.
5. **Character sheets** — a new sidebar tab. Forms saved as JSON. Easy.
6. **Compile** — concatenate scenes in order, export as `.md`, `.docx`, or PDF. The first two are trivial; PDF needs a library like `react-pdf` or printing via the browser.
7. **Snapshots** — copy the doc to a `snapshots` array on save. Show a history list.
8. **More themes** — add to `themes.js`. Maybe a midnight/blackboard one, or a Moleskine red.

## Notes

- Currently uses system fonts. For real polish, add `@import url('https://fonts.googleapis.com/...')` to load Iowan Old Style / Newsreader / Inter properly. Or self-host them.
- The `library` theme leans hard into serif everything — including UI labels — which is the vibe but does cost some legibility. If it bothers you, set `fontUi` to the same as atelier.
- LocalStorage caps around 5MB. Plenty for a novel's text. Real file system once you Tauri-fy.
