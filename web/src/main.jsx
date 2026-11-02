import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from './astryx-themes'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Theme theme={themes[defaultThemeSlug]}>
      <App />
    </Theme>
  </StrictMode>,
)
