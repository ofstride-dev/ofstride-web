import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_ROUTES, getMetaTags } from '../src/seo/routeMetadata.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const template = await readFile(path.join(root, 'dist', 'index.html'), 'utf8')

function replaceOrAdd(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `${replacement}\n  </head>`)
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function crawlableContent(metadata) {
  const links = PUBLIC_ROUTES
    .filter((candidate) => candidate !== metadata.path)
    .slice(0, 12)
    .map((candidate) => {
      const label = candidate === '/' ? 'Home' : candidate.slice(1).replaceAll('/', ' / ')
      return `<li><a href="${escapeHtml(candidate)}">${escapeHtml(label)}</a></li>`
    })
    .join('')
  const title = metadata.title.split(' | ')[0].split(' — ')[0]
  return `<main id="seo-content"><article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(metadata.description)}</p><h2>How Ofstride can help</h2><p>Ofstride Services LLP combines practical consulting expertise with AI-powered systems to help ambitious businesses improve operations, manage risk and grow with confidence.</p></article><nav aria-label="Site links"><h2>Explore Ofstride</h2><ul>${links}</ul></nav></main>`
}

for (const route of PUBLIC_ROUTES) {
  const metadata = getMetaTags(route)
  let html = template
  html = replaceOrAdd(html, /<title>[^<]*<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`)
  html = replaceOrAdd(html, /<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(metadata.description)}" />`)
  html = replaceOrAdd(html, /<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`)
  html = replaceOrAdd(html, /<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`)
  html = replaceOrAdd(html, /<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(metadata.url)}" />`)
  html = replaceOrAdd(html, /<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${escapeHtml(metadata.image)}" />`)
  html = replaceOrAdd(html, /<meta property="og:image:width"[^>]*>/i, '<meta property="og:image:width" content="1200" />')
  html = replaceOrAdd(html, /<meta property="og:image:height"[^>]*>/i, '<meta property="og:image:height" content="630" />')
  html = replaceOrAdd(html, /<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`)
  html = replaceOrAdd(html, /<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`)
  html = replaceOrAdd(html, /<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(metadata.url)}" />`)
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${crawlableContent(metadata)}</div>`)
  const target = route === '/' ? path.join(root, 'dist', 'index.html') : path.join(root, 'dist', ...route.slice(1).split('/'), 'index.html')
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, html)
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_ROUTES.map((route) => `  <url><loc>https://ofstrideservices.com${route === '/' ? '/' : route}</loc></url>`).join('\n')}
</urlset>
`
await writeFile(path.join(root, 'dist', 'sitemap.xml'), sitemap)
console.log(`Generated metadata HTML for ${PUBLIC_ROUTES.length} public routes.`)