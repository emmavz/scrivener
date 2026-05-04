/** @returns {boolean} */
export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function paths() {
  const [{ join }, { writeTextFile, readTextFile }] = await Promise.all([
    import('@tauri-apps/api/path'),
    import('@tauri-apps/plugin-fs'),
  ]);
  return { join, writeTextFile, readTextFile };
}

/** Write `project.json` (full app state minus volatile UI) into chosen folder */
export async function writeProjectFolder(folderPath, payload) {
  if (!folderPath || !isTauriRuntime()) return false;
  const { join, writeTextFile } = await paths();
  const filePath = await join(folderPath, 'project.json');
  await writeTextFile(filePath, JSON.stringify(payload, null, 2));
  return true;
}

/** Load `project.json` from disk */
export async function readProjectFolder(folderPath) {
  if (!folderPath || !isTauriRuntime()) return null;
  try {
    const { join, readTextFile } = await paths();
    const filePath = await join(folderPath, 'project.json');
    const text = await readTextFile(filePath);
    return JSON.parse(text);
  } catch {
    return null;
  }
}
