// The vibes, defined as plain objects — add entries with the same shape.

export const themeIds = /** @type {const} */ (['library', 'atelier', 'midnight', 'moleskine']);

/** @typedef {typeof themeIds[number]} ThemeId */

export const themes = {
  library: {
    appBg: '#2a1f17',
    chrome: '#ebdcc0',
    sidebar: '#ebdcc0',
    canvas: '#f5ecd9',
    border: '#c9b48e',
    text: '#2a1f17',
    textMuted: '#8a7355',
    activeBg: '#d4a259',
    activeText: '#2a1f17',
    accent: '#8a4f2a',
    fontSerif: '"Iowan Old Style", "Newsreader", "Palatino", "Georgia", serif',
    fontProse: '"Iowan Old Style", "Newsreader", "Palatino", "Georgia", serif',
    fontUi: '"Inter", system-ui, sans-serif',
  },
  atelier: {
    appBg: '#f4f3ee',
    chrome: '#fafaf7',
    sidebar: '#fafaf7',
    canvas: '#ffffff',
    border: '#e5e3dc',
    text: '#2c2a26',
    textMuted: '#9b9890',
    activeBg: '#f0eee5',
    activeText: '#2c2a26',
    accent: '#2c2a26',
    fontSerif: '"Inter", system-ui, sans-serif',
    fontProse: '"Newsreader", "Charter", "Iowan Old Style", Georgia, serif',
    fontUi: '"Inter", system-ui, sans-serif',
  },
  midnight: {
    /* Deep cool bases so panels read as layers; body text stays near-white for WCAG contrast on every surface. */
    appBg: '#05070c',
    chrome: '#0c111a',
    sidebar: '#0c111a',
    canvas: '#111827',
    border: '#3d4f6a',
    text: '#f4f7fc',
    textMuted: '#a9b8cc',
    activeBg: '#1d4a7a',
    activeText: '#ffffff',
    accent: '#7dd3fc',
    fontSerif: '"Newsreader", "Charter", Georgia, serif',
    fontProse: '"Newsreader", "Charter", Georgia, serif',
    fontUi: '"Inter", system-ui, sans-serif',
  },
  moleskine: {
    appBg: '#1a0909',
    chrome: '#2b1818',
    sidebar: '#2b1818',
    canvas: '#f7f4ef',
    border: '#5c2b2f',
    text: '#1a0909',
    textMuted: '#6b4949',
    activeBg: '#c63d3f',
    activeText: '#fff8f6',
    accent: '#8b2528',
    fontSerif: '"Newsreader", Georgia, serif',
    fontProse: '"Newsreader", Georgia, serif',
    fontUi: '"Inter", system-ui, sans-serif',
  },
};
