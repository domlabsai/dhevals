import { TopNav } from './TopNav.jsx'
import { Footer } from './Footer.jsx'

/*
 * PublicShell — skip link, TopNav header, <main id="content">, Footer.
 * Every public page renders inside this shell.
 */
export function PublicShell({ children }) {
  return (
    <div data-testid="public-shell">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <TopNav />
      <main id="content">{children}</main>
      <Footer />
    </div>
  )
}

export default PublicShell
