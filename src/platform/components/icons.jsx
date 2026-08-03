/*
 * Tiny inline icon set (16px stroke SVGs). No external icon library.
 * Usage: <Icon name="search" /> — size can be overridden via prop.
 */

const PATHS = {
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </>
  ),
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  menu: <path d="M2 4.5h12M2 8h12M2 11.5h12" />,
  'chevron-down': <path d="M4 6l4 4 4-4" />,
  'chevron-right': <path d="M6 4l4 4-4 4" />,
  'arrow-up-right': <path d="M4 12 12 4M6 4h6v6" />,
  download: <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />,
  link: (
    <>
      <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 1 0-4.2-4.2l-1 1" />
      <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 1 0 4.2 4.2l1-1" />
    </>
  ),
  check: <path d="M3 8.5 6.5 12 13 4.5" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2.2 1.3" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="7" width="8" height="6" rx="1" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </>
  ),
  'alert-triangle': (
    <>
      <path d="M8 2.5 14.5 13h-13L8 2.5Z" />
      <path d="M8 6.5v3M8 11v.01" />
    </>
  ),
  external: (
    <>
      <path d="M6 3H3v10h10v-3" />
      <path d="M9 3h4v4M13 3 7.5 8.5" />
    </>
  ),
  tilde: <path d="M3 9.5c1.5-2.5 3-2.5 5 0s3.5 2.5 5 0" />,
}

export function Icon({ name, size = 16, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name] ?? null}
    </svg>
  )
}

export default Icon
