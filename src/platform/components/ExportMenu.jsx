import { Menu } from './Menu.jsx'
import { Icon } from './icons.jsx'
import { useToast } from './Toast.jsx'
import { copyText } from './clipboard.js'

/*
 * ExportMenu — artifact downloads (JSON/CSV/HTML) plus copy actions.
 * artifacts: [{ href, label, kind }] — native <a href download> links.
 * copyItems: [{ label, text }] — clipboard actions with toast confirmation.
 */
export function ExportMenu({ artifacts = [], copyItems = [], label = 'Export', className = '' }) {
  const toast = useToast()

  const onCopy = async (item) => {
    const ok = await copyText(item.text)
    toast(ok ? `${item.label} copied to clipboard.` : 'Copy failed — your browser blocked clipboard access.')
  }

  return (
    <Menu label={label} icon="download" testid="export-menu">
      <div className={className}>
        {artifacts.length > 0 ? (
          <>
            <p className="menu__group-label">Artifacts</p>
            <ul className="menu__list">
              {artifacts.map((artifact) => (
                <li key={artifact.href}>
                  <a className="menu__item" href={artifact.href} download>
                    <Icon name="download" size={14} />
                    <span className="menu__item-label">{artifact.label}</span>
                    <span className="badge">{artifact.kind}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {copyItems.length > 0 ? (
          <>
            <p className="menu__group-label">Copy</p>
            <ul className="menu__list">
              {copyItems.map((item) => (
                <li key={item.label}>
                  <button type="button" className="menu__item" onClick={() => onCopy(item)}>
                    <Icon name="link" size={14} />
                    <span className="menu__item-label">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Menu>
  )
}

export default ExportMenu
