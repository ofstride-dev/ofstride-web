import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_ROUTES, getMetaTags } from '../src/seo/routeMetadata.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const template = await readFile(path.join(root, 'dist', 'index.html'), 'utf8')

function replaceOrAdd(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `${replacement}\n  </head>`)
}

for (const route of PUBLIC_ROUTES) {
  const metadata = getMetaTags(route)
  let html = template
  html = replaceOrAdd(html, /<title>[^<]*<\/title>/i, `<title>${metadata.title}</title>`)
  html = replaceOrAdd(html, /<meta name="description"[^>]*>/i, `<meta name="description" content="${metadata.description}" />`)
  html = replaceOrAdd(html, /<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${metadata.title}" />`)
  html = replaceOrAdd(html, /<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${metadata.description}" />`)
  html = replaceOrAdd(html, /<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${metadata.url}" />`)
  html = replaceOrAdd(html, /<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${metadata.image}" />`)
  html = replaceOrAdd(html, /<meta property="og:image:width"[^>]*>/i, '<meta property="og:image:width" content="1200" />')
  html = replaceOrAdd(html, /<meta property="og:image:height"[^>]*>/i, '<meta property="og:image:height" content="630" />')
  html = replaceOrAdd(html, /<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${metadata.title}" />`)
  html = replaceOrAdd(html, /<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${metadata.description}" />`)
  html = replaceOrAdd(html, /<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${metadata.url}" />`)
  const target = route === '/' ? path.join(root, 'dist', 'index.html') : path.join(root, 'dist', ...route.slice(1).split('/'), 'index.html')
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, html)
}
console.log(`Generated metadata HTML for ${PUBLIC_ROUTES.length} public routes.`)