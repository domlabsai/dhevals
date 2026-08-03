import { useEffect } from 'react'

/*
 * SEO layer: document title, meta description, Open Graph / Twitter tags,
 * canonical link, and an optional JSON-LD block. All upserts are idempotent
 * and keyed off the tags the platform owns (data-dhevals-seo).
 */

export const SITE_ORIGIN = 'https://dhevals.ai'
const DEFAULT_IMAGE = '/brand/social/social-result.svg'
const JSONLD_ID = 'dhevals-jsonld'

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
}

function upsertCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

function upsertJsonLd(jsonLd) {
  const existing = document.getElementById(JSONLD_ID)
  if (!jsonLd) {
    existing?.remove()
    return
  }
  const script = existing ?? document.createElement('script')
  script.id = JSONLD_ID
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(jsonLd)
  if (!existing) document.head.appendChild(script)
}

export function useSeo({ title, description, path = '/', image, jsonLd, noindex = false }) {
  const fullTitle = title?.startsWith('DHEvals') ? title : `${title} · DHEvals`
  const canonical = `${SITE_ORIGIN}${path}`
  const imageUrl = (image ?? DEFAULT_IMAGE).startsWith('http')
    ? image ?? DEFAULT_IMAGE
    : `${SITE_ORIGIN}${image ?? DEFAULT_IMAGE}`

  useEffect(() => {
    document.title = fullTitle
    if (description) upsertMeta('meta[name="description"]', { name: 'description', content: description })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    if (description) upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl })
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    if (description) upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl })
    if (noindex) {
      upsertMeta('meta[name="robots"]', { name: 'robots', content: 'noindex' })
    } else {
      document.head.querySelector('meta[name="robots"]')?.remove()
    }
    upsertCanonical(canonical)
    upsertJsonLd(jsonLd)
  }, [fullTitle, description, canonical, imageUrl, noindex, jsonLd])
}

/* Small helpers for common JSON-LD shapes used by stub pages. */

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.to ? { item: `${SITE_ORIGIN}${item.to}` } : {}),
    })),
  }
}

export function datasetJsonLd({ name, description, path }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url: `${SITE_ORIGIN}${path}`,
    creator: { '@type': 'Organization', name: 'DHEvals', url: SITE_ORIGIN },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  }
}
