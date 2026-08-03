/*
 * copyText — clipboard write with a legacy fallback. Returns true when the
 * text reached the clipboard, false otherwise (callers toast either way).
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API unavailable (non-secure context, denied permission):
    // fall back to a hidden textarea + execCommand.
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      textarea.remove()
      return ok
    } catch {
      return false
    }
  }
}
