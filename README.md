# Ofstride Services LLP Website

A modern, AI-forward business consulting website built with Vite, React, and Tailwind CSS.

## Features

- **Home Page** — Hero with animated AI network visual, services bento grid, social proof, industries
- **10 Service Pages** — Individual detail pages for each service with AI capabilities highlighted
- **About Page** — Company philosophy, leadership team, corporate information
- **Industries Page** — 14 industry sectors with relevant services
- **Contact Page** — Consultation booking form with full contact details
- **Responsive Design** — Mobile-first, works on all devices
- **Modern UI** — Clean 2026 design trends: expansive white space, bold typography, subtle animations

## Tech Stack

| Technology | Version |
|---|---|
| Vite | 6.x |
| React | 19.x |
| React Router | 7.x |
| Tailwind CSS | 4.x |
| Lucide React | Icons |
| Framer Motion | Animations (optional upgrade) |

## Quick Start

### 1. Install Dependencies

```bash
cd ofstride-website
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### 3. Build for Production

```bash
npm run build
```

Static files will be generated in `dist/` folder.

## Project Structure

```
ofstride-website/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── ofstride-icon.svg (create your own)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles/
│   │   └── index.css
│   ├── components/
│   │   └── Layout.jsx (Header + Footer)
│   └── pages/
│       ├── Home.jsx
│       ├── Services.jsx
│       ├── ServiceDetail.jsx (all 10 services)
│       ├── About.jsx
│       ├── Industries.jsx
│       └── Contact.jsx
```

## Pages & Routes

| Route | Page |
|---|---|
| `/` | Home |
| `/services` | Services Listing |
| `/services/:slug` | Individual Service (10 pages) |
| `/about` | About Us |
| `/industries` | Industries We Serve |
| `/contact` | Contact / Book Consultation |

## Service Slugs

- `human-resource-consulting`
- `executive-search-recruitment`
- `payroll-hr-compliance`
- `financial-consulting-virtual-cfo`
- `gst-tax-advisory`
- `legal-regulatory-compliance`
- `it-consulting-digital-transformation`
- `ai-data-science-consulting` (flagship)
- `business-strategy-process-improvement`
- `employer-of-record-workforce`

## Design System

### Colors
- Primary: `#0F172A` (Deep Slate)
- Secondary: `#3B82F6` (Bright Blue)
- Accent: `#10B981` (Emerald)
- Surface: `#F8FAFC` (Light Gray)

### Typography
- Font: Inter (Google Fonts)
- Headlines: 48-64px, weight 700
- Body: 16-18px, weight 400, line-height 1.6

### Spacing
- Section padding: 80-120px vertical
- Content max-width: 1200px centered

## Customization

### Update Contact Form
The contact form currently shows a success message without sending. To connect to a backend:

1. Replace `setSubmitted(true)` in `Contact.jsx` with your API call
2. Or use a service like Formspree, Netlify Forms, or EmailJS

### Add Analytics
```jsx
// In main.jsx or Layout.jsx
useEffect(() => {
  // Add your Google Analytics or Plausible script
}, [])
```

### SEO
Meta descriptions are set in `index.html`. For production, use React Helmet for per-page meta tags.

## Deployment Options

| Platform | Command |
|---|---|
| Vercel | `vercel --prod` |
| Netlify | `netlify deploy --prod --dir=dist` |
| GitHub Pages | Use `gh-pages` package |
| AWS S3 | Upload `dist/` contents |

## Python Runtime Policy (API)

Use Python 3.12 for local and Azure deployment to keep binary dependencies stable.

- Local Functions: run `api/run-func.ps1` (it validates Python 3.12).
- Azure Functions App (Linux): set `linuxFxVersion` to `Python|3.12`.
- Required app settings: `FUNCTIONS_WORKER_RUNTIME=python`, `FUNCTIONS_EXTENSION_VERSION=~4`.
- Static Web Apps managed API: `staticwebapp.config.json` sets `platform.apiRuntime` to `python:3.12`.

## License

© 2026 Ofstride Services LLP. All rights reserved.
