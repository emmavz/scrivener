// The vibes, defined as plain objects — add entries with the same shape.

export const themeIds = /** @type {const} */ (['library', 'midnight']);

/** @typedef {typeof themeIds[number]} ThemeId */

export const themes = {
  library: {
    appBg: '#f1ebdd',
    chrome: '#f4efe5',
    sidebar: '#f1ebdd',
    canvas: '#f8f3e9',
    desk: '#ece5d3',
    border: 'rgba(42, 36, 28, 0.12)',
    text: '#2a241c',
    textMuted: '#4a4136',
    chromeText: '#2a241c',
    chromeTextMuted: '#7a6f5f',
    chromeTextDim: '#a89e8a',
    activeBg: 'rgba(168, 94, 36, 0.14)',
    activeText: '#3b2c1f',
    accent: '#a35a2a',
    accentSolid: '#a35a2a',
    fontSerif: '"EB Garamond", "Source Serif 4", "Iowan Old Style", Georgia, serif',
    fontProse: '"EB Garamond", "Source Serif 4", "Iowan Old Style", Georgia, serif',
    fontUi: '"Inter", system-ui, sans-serif',
  },
  midnight: {
    appBg: '#16120f',
    chrome: '#1b1713',
    sidebar: '#201a15',
    canvas: '#262019',
    desk: '#140f0b',
    border: 'rgba(236, 226, 205, 0.12)',
    text: '#ece2cd',
    textMuted: '#c9bfa9',
    chromeText: '#ece2cd',
    chromeTextMuted: '#8a7f6c',
    chromeTextDim: '#5a5141',
    activeBg: 'rgba(232, 193, 120, 0.18)',
    activeText: '#f5ead1',
    accent: '#d8a86c',
    accentSolid: '#8e5634',
    fontSerif: '"EB Garamond", "Source Serif 4", "Iowan Old Style", Georgia, serif',
    fontProse: '"EB Garamond", "Source Serif 4", "Iowan Old Style", Georgia, serif',
    fontUi: '"Inter", system-ui, sans-serif',
  },
};
