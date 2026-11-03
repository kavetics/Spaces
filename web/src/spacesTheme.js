// The Spaces look: Astryx's neutral theme, with its main-button color warmed to the light at the end
// of the welcome tunnel. Only this one color changes, so every screen keeps one bright main action.
import { defineTheme } from '@astryxdesign/core/theme'
import { defaultThemeSlug, themes } from './astryx-themes'

export const WARM_LIGHT = '#f6efe3'

export const spacesTheme = defineTheme({
  name: 'spaces',
  extends: themes[defaultThemeSlug],
  tokens: {
    '--color-accent': `light-dark(#1b1b1b, ${WARM_LIGHT})`,
    '--color-icon-accent': `light-dark(#1b1b1b, ${WARM_LIGHT})`,
    '--color-text-accent': `light-dark(#1b1b1b, ${WARM_LIGHT})`,
  },
})
