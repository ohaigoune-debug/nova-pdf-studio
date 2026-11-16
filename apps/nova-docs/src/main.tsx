import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initI18n } from './i18n'
import { usePrefs, applyTheme } from './stores/prefs'
import App from './App'

async function boot() {
  await usePrefs.getState().load()
  const { language, theme } = usePrefs.getState()
  initI18n(language)
  applyTheme(theme)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void boot()
