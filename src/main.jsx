import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ConsoleApp from './App.jsx'
import PlatformApp from './platform/App.jsx'
import './styles.css'

// The internal console keeps living under /console; every other path
// serves the public platform. Both share this single bundle.
const isConsole = window.location.pathname.startsWith('/console')

createRoot(document.getElementById('root')).render(
  <StrictMode>{isConsole ? <ConsoleApp /> : <PlatformApp />}</StrictMode>,
)
