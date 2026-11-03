import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import { Theme } from '@astryxdesign/core/theme'
import { spacesTheme } from './spacesTheme.js'
import './index.css'
import App from './App.jsx'
import VotePage from './VotePage.jsx'

// A family vote link opens just the voting page, without the rest of the app or anything on this phone.
const voteId = location.pathname.match(/^\/vote\/([\w-]+)\/?$/)?.[1]

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Theme theme={spacesTheme}>
      {voteId ? <VotePage id={voteId} /> : <App />}
    </Theme>
  </StrictMode>,
)
