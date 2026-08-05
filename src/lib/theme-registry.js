const { getCustomTheme } = require('./custom-themes');

const THEMES = [
  {
    id: 'paper-light',
    name: 'Paper Light',
    group: 'light',
    tagline: 'Warm printed document',
    swatches: ['#faf9f5', '#8b0000', '#242424'],
    file: 'themes/paper-light.css'
  },
  {
    id: 'frost-light',
    name: 'Frost Light',
    group: 'light',
    tagline: 'Crisp modern sans-serif',
    swatches: ['#f8fafc', '#2563eb', '#1e293b'],
    file: 'themes/frost-light.css'
  },
  {
    id: 'sand-light',
    name: 'Sand Light',
    group: 'light',
    tagline: 'Warm cream & amber',
    swatches: ['#fdf6ec', '#d97706', '#433422'],
    file: 'themes/sand-light.css'
  },
  {
    id: 'midnight-dark',
    name: 'Midnight Dark (Antigravity 2.0)',
    group: 'dark',
    tagline: 'Antigravity 2.0 theme',
    swatches: ['#1a1a2e', '#7aa2f7', '#d4d4e4'],
    file: 'themes/midnight-dark.css'
  },
  {
    id: 'obsidian-dark',
    name: 'Obsidian Dark',
    group: 'dark',
    tagline: 'Deep neutral true dark',
    swatches: ['#0d0d0d', '#60a5fa', '#e0e0e0'],
    file: 'themes/obsidian-dark.css'
  },
  {
    id: 'forest-dark',
    name: 'Forest Dark',
    group: 'dark',
    tagline: 'Dark emerald green',
    swatches: ['#0b140e', '#34d399', '#d1e2d5'],
    file: 'themes/forest-dark.css'
  },
  {
    id: 'catppuccin-macchiato',
    name: 'Catppuccin Macchiato',
    group: 'preset',
    tagline: 'Soothing pastel dark',
    swatches: ['#24273a', '#8aadf4', '#cad3f5'],
    file: 'themes/catppuccin-macchiato.css'
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    group: 'preset',
    tagline: 'Deep blue & neon highlights',
    swatches: ['#1a1b26', '#7aa2f7', '#a9b1d6'],
    file: 'themes/tokyo-night.css'
  },
  {
    id: 'nord',
    name: 'Nord',
    group: 'preset',
    tagline: 'Arctic ice blue & slate',
    swatches: ['#2e3440', '#88c0d0', '#d8dee9'],
    file: 'themes/nord.css'
  },
  {
    id: 'dracula',
    name: 'Dracula',
    group: 'preset',
    tagline: 'Vibrant gothic purple & pink',
    swatches: ['#282a36', '#bd93f9', '#f8f8f2'],
    file: 'themes/dracula.css'
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    group: 'preset',
    tagline: 'Warm soft pastel light',
    swatches: ['#eff1f5', '#1e66f5', '#4c4f69'],
    file: 'themes/catppuccin-latte.css'
  }
];

const BUILTIN_THEME_IDS = new Set(THEMES.map(t => t.id));

const isCustomThemeId = (id) => typeof id === 'string' && id.startsWith('custom-');

const isKnownThemeId = (id, userDataPath = null) => {
  if (typeof id !== 'string') return false;
  if (BUILTIN_THEME_IDS.has(id)) return true;
  if (isCustomThemeId(id) && userDataPath) {
    return getCustomTheme(userDataPath, id) !== null;
  }
  return isCustomThemeId(id);
};

const getThemeById = (id, userDataPath = null) => {
  const builtin = THEMES.find(t => t.id === id);
  if (builtin) return builtin;

  if (isCustomThemeId(id) && userDataPath) {
    const custom = getCustomTheme(userDataPath, id);
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        group: 'custom',
        tagline: `Custom (${custom.baseThemeId || 'theme'})`,
        swatches: [
          custom.tokens.bgBody || '#1a1a2e',
          custom.tokens.textLink || '#7aa2f7',
          custom.tokens.textBody || '#d4d4e4'
        ],
        isCustom: true,
        tokens: custom.tokens
      };
    }
  }
  return null;
};

module.exports = {
  THEMES,
  THEME_IDS: BUILTIN_THEME_IDS,
  BUILTIN_THEME_IDS,
  isCustomThemeId,
  isKnownThemeId,
  getThemeById
};
