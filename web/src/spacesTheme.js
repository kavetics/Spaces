// The Spaces look: Astryx's neutral theme, always dark, with its main-button color set to the gold of the
// welcome tunnel's lines. Only this one color changes, so every screen keeps one bright main action.
import { defineTheme } from '@astryxdesign/core/theme'
import { defaultThemeSlug, themes } from './astryx-themes'

export const GOLD = '#d5ae75'

export const spacesTheme = defineTheme({
  name: 'spaces',
  extends: themes[defaultThemeSlug],
  tokens: {
    '--color-accent': GOLD,
    '--color-icon-accent': GOLD,
    '--color-text-accent': GOLD,
  },
})
