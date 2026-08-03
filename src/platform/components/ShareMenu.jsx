import { Menu } from './Menu.jsx'
import { Icon } from './icons.jsx'
import { useToast } from './Toast.jsx'
import { copyText } from './clipboard.js'

/*
 * ShareMenu — share actions for a page/result: copy link, copy preformatted
 * X post text, download the social card SVG.
 */
export function ShareMenu({ url, xText, cardHref, label = 'Share' }) {
  const toast = useToast()

  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '')

  const copy = async (text, what) => {
    const ok = await copyText(text)
    toast(ok ? `${what} copied to clipboard.` : 'Copy failed — your browser blocked clipboard access.')
  }

  return (
    <Menu label={label} icon="link" testid="share-menu">
      <ul className="menu__list">
        <li>
          <button type="button" className="menu__item" onClick={() => copy(shareUrl, 'Link')}>
            <Icon name="link" size={14} />
            <span className="menu__item-label">Copy link</span>
          </button>
        </li>
        {xText ? (
          <li>
            <button type="button" className="menu__item" onClick={() => copy(xText, 'X post text')}>
              <Icon name="external" size={14} />
              <span className="menu__item-label">Copy X text</span>
            </button>
          </li>
        ) : null}
        {cardHref ? (
          <li>
            <a className="menu__item" href={cardHref} download>
              <Icon name="download" size={14} />
              <span className="menu__item-label">Download card</span>
              <span className="badge">SVG 1200×630</span>
            </a>
          </li>
        ) : null}
      </ul>
    </Menu>
  )
}

export default ShareMenu
