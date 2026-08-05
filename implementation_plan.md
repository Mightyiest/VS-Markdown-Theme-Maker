# Theme Customizer — Color Editor & Custom Theme Storage

Add a **theme customization panel** to the Electron Markdown Theme Gallery that lets users edit theme colors via color pickers or hex input, see changes in real-time preview, and save customized themes separately from the 6 built-in originals.

---

## User Review Required

> [!IMPORTANT]
> **Editable CSS tokens** — Each theme has ~12 distinct color properties. The customizer exposes these as named, human-readable tokens (e.g., "Background", "Body Text", "H1 Color") rather than raw CSS selectors. Changing a token regenerates the full CSS from a template. This keeps the UI clean and prevents invalid CSS.

> [!IMPORTANT]
> **Custom theme storage** — Custom themes are saved as JSON files in Electron's `userData` directory (not in the project folder or alongside the built-in themes). This means:
> - Built-in `.css` files are **never modified**
> - Custom themes persist across app restarts
> - Custom themes can be installed to any project, just like built-ins

---

## Open Questions

1. **Max custom themes?** Default: unlimited. Or cap at e.g. 20?
2. **Export/import custom themes?** Could add a "Share Theme" button that exports as a `.json` file. Include in v1 or defer?

---

## Architecture Changes

### Design Token System

Each theme's CSS is generated from a **token map** — a flat object of 12 named color values:

| Token Key | Label in UI | CSS Target |
|---|---|---|
| `bgBody` | Background | `body { background-color }` |
| `textBody` | Body Text | `body { color }` |
| `textH1` | Heading 1 | `h1 { color }` |
| `textH2` | Heading 2 | `h2 { color }` |
| `textH3` | Heading 3 | `h3 { color }` |
| `textH4` | Heading 4 | `h4 { color }` |
| `textLink` | Link | `a { color }` |
| `bgCode` | Code Background | `code { background-color }`, `pre { background-color }` |
| `textCode` | Inline Code | `code { color }` |
| `bgBlockquote` | Blockquote Background | `blockquote { background }` |
| `borderAccent` | Accent Border | `blockquote { border-left-color }`, `h1/h2 { border-bottom-color }` |
| `bgTableHeader` | Table Header Background | `th { background-color }` |

Each built-in theme gets a **reverse-extracted** token map from its existing CSS. The CSS generator produces the full stylesheet from tokens + a static layout template (font sizes, spacing, border-radius — these stay fixed).

---

## Proposed Changes

### New Module — CSS Token Engine

#### [NEW] `src/lib/theme-tokens.js`

Responsibilities:
- **`extractTokensFromCss(cssString)`** — regex-parses a built-in CSS file to extract the 12 token values into a token map object
- **`generateCssFromTokens(tokens)`** — takes a token map and produces a complete CSS string using a layout template
- **`BUILTIN_TOKENS`** — pre-extracted token maps for all 6 built-in themes (computed once at startup from the CSS files)
- **`TOKEN_LABELS`** — display labels for the UI (`{ bgBody: 'Background', textBody: 'Body Text', ... }`)

---

### Custom Theme Storage

#### [NEW] `src/lib/custom-themes.js`

Storage location: `<userData>/custom-themes/`

Each custom theme is a JSON file:

```json
{
  "id": "custom-1722902400000",
  "name": "My Midnight Remix",
  "baseThemeId": "midnight-dark",
  "group": "dark",
  "tokens": {
    "bgBody": "#1e1e3a",
    "textBody": "#d4d4e4",
    ...
  },
  "createdAt": "2026-08-06T01:00:00Z",
  "updatedAt": "2026-08-06T01:05:00Z"
}
```

Functions:
- **`listCustomThemes()`** — returns all custom themes from disk
- **`saveCustomTheme(themeData)`** — writes/updates a custom theme JSON
- **`deleteCustomTheme(themeId)`** — deletes the file
- **`getCustomThemeCss(themeId)`** — loads the JSON, generates CSS via `generateCssFromTokens`

---

### Updated Theme Registry

#### [MODIFY] [theme-registry.js](file:///c:/Users/ownin/Documents/Antigravity%20Projects/md-theme-maker/src/lib/theme-registry.js)

- Add `isCustomThemeId(id)` — validates format `custom-<timestamp>`
- Update `isKnownThemeId` to accept **both** built-in IDs and custom IDs
- `getThemeById` checks built-in list first, then queries `custom-themes.js`

---

### New IPC Channels

#### [MODIFY] [main.js](file:///c:/Users/ownin/Documents/Antigravity%20Projects/md-theme-maker/src/main.js)

| Channel | Payload | Returns |
|---|---|---|
| `theme:getTokens` | `{ themeId }` | `{ ok, tokens }` — token map for any theme (built-in or custom) |
| `theme:previewFromTokens` | `{ tokens }` | `{ ok, css }` — generates CSS from a token map without saving |
| `custom:save` | `{ id?, name, baseThemeId, group, tokens }` | `{ ok, themeId }` — saves a new or existing custom theme |
| `custom:list` | — | `{ ok, themes: [...] }` — all saved custom themes |
| `custom:delete` | `{ themeId }` | `{ ok }` — deletes a custom theme |

#### [MODIFY] [preload.js](file:///c:/Users/ownin/Documents/Antigravity%20Projects/md-theme-maker/src/preload.js)

Add 5 new bridge methods matching the new IPC channels.

---

### Compact UI Redesign

#### [MODIFY] [index.html](file:///c:/Users/ownin/Documents/Antigravity%20Projects/md-theme-maker/src/renderer/index.html)

**Layout change — 3 columns instead of 2:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ AG Theme Gallery │ Project: C:\...\Revive │ Browse │ Install │ Uninstall│
├──────────┬──────────────────────────────────┬─────────────────────────┤
│ THEMES   │                                  │ CUSTOMIZER              │
│          │                                  │                         │
│ Light(3) │   LIVE PREVIEW                   │ Background    [■] #1a.. │
│ ○ Paper  │   (iframe)                       │ Body Text     [■] #d4.. │
│ ○ Frost  │                                  │ Heading 1     [■] #e2.. │
│ ○ Sand   │                                  │ Heading 2     [■] #b8.. │
│          │                                  │ Heading 3     [■] #98.. │
│ Dark(3)  │                                  │ Heading 4     [■] #88.. │
│ ● Midni… │                                  │ Link          [■] #7a.. │
│ ○ Obsid… │                                  │ Code BG       [■] #25.. │
│ ○ Forest │                                  │ Inline Code   [■] #c0.. │
│          │                                  │ Blockquote BG [■] #1e.. │
│ Custom   │                                  │ Accent Border [■] #4a.. │
│ ○ My Th… │                                  │ Table Header  [■] #1e.. │
│          │                                  │                         │
│          │                                  │ [Reset] [Save As New]   │
│          │                                  │ Name: _______________   │
└──────────┴──────────────────────────────────┴─────────────────────────┘
```

**UI compactness changes:**

| Element | Current | New |
|---|---|---|
| Header + Project bar | 2 separate full-width rows | **Merged into 1 compact row** — brand left, project path + actions right |
| Sidebar width | 320px | **240px** — smaller card padding, shorter taglines |
| Theme card padding | 0.85rem | **0.55rem** |
| Theme card font | 0.92rem name / 0.75rem tagline | **0.82rem / 0.7rem** |
| Section title gap | 0.6rem below | **0.4rem** |
| Preview toolbar | Full-width row | **Compact 32px bar** |
| Main padding | 1.5rem 2rem | **1rem 1.25rem** |

**Customizer panel** (new right column, 280px):

Each token row:
```
┌─ Token Label ─────── [■] #hex_input ─┐
```

- **Color swatch `[■]`** — a `<input type="color">` styled as a 20×20px circle. Opens native OS color picker.
- **Hex input** — a small `<input type="text">` accepting `#rrggbb`. Validates on blur; invalid input reverts to previous value.
- Both inputs are **two-way bound** — changing the picker updates the hex input, and vice versa.
- Every change fires **instant live preview** — calls `theme:previewFromTokens` and re-renders the iframe.

**Customizer footer buttons:**

| Button | Behavior |
|---|---|
| **Reset** | Reverts all tokens to the base theme's original values |
| **Save As New** | Prompts for a theme name → saves via `custom:save` → appears in sidebar under "Custom" group |
| **Update** (visible only for custom themes) | Overwrites the selected custom theme's tokens |
| **Delete** (visible only for custom themes) | Deletes the custom theme after confirmation |

**Custom themes in sidebar:**

- New **"Custom"** section below Dark themes
- Custom theme cards show the user-given name + a `✕` delete icon on hover
- Custom themes are **installable** via the same Install button — `theme:install` generates CSS on-the-fly from tokens

---

### Theme Installer Updates

#### [MODIFY] [theme-installer.js](file:///c:/Users/ownin/Documents/Antigravity%20Projects/md-theme-maker/src/lib/theme-installer.js)

`installTheme` updated to handle custom themes:
1. If `themeId` starts with `custom-`, load the custom theme JSON and generate CSS from tokens
2. Otherwise, read from the built-in CSS file (unchanged behavior)
3. The rest of the install flow (write CSS, merge settings.json) is identical

---

## Final File Structure (changes only)

```diff
 src/
 ├── main.js                          ← + 5 new IPC handlers
 ├── preload.js                       ← + 5 new bridge methods
 ├── lib/
+│   ├── theme-tokens.js              ← CSS token extraction & generation
+│   ├── custom-themes.js             ← Custom theme CRUD (userData storage)
 │   ├── theme-registry.js            ← + custom theme ID support
 │   ├── settings-writer.js           ← (unchanged)
 │   └── theme-installer.js           ← + custom theme CSS generation on install
 └── renderer/
     ├── index.html                   ← Compact 3-column layout + customizer panel
     ├── sample-preview.html          ← (unchanged)
     └── themes/                      ← (unchanged, never modified)
```

---

## Verification Plan

### Unit Tests — `npm test`

| Case | Expectation |
|---|---|
| `extractTokensFromCss` on each built-in theme | Returns exactly 12 token keys with valid hex values |
| `generateCssFromTokens` round-trip | Extracted tokens → generate CSS → extract again → same tokens |
| `saveCustomTheme` + `listCustomThemes` | Theme persists and appears in listing |
| `deleteCustomTheme` | File removed, no longer in listing |
| Custom theme install | Generates valid CSS from tokens, installs correctly |

### Manual Verification

1. Select Midnight Dark → customizer shows its 12 token values
2. Change `bgBody` to `#2a0a3a` → preview instantly updates
3. Click **Save As New**, name it "Purple Night" → appears in Custom section
4. Select "Purple Night" → customizer shows the saved values
5. Click **Install to Project** → `.vscode/custom-*.css` written with correct colors
6. Open VS Code preview → custom theme renders correctly
7. Click **Delete** on "Purple Night" → removed from sidebar and disk
8. Click **Reset** while editing → tokens revert to base theme values
