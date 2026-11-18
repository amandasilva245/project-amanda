#!/usr/bin/env node
/**
 * Gera public/manual/manual-curtain.pdf a partir de src/pages/help/manual.js
 * (o mesmo conteúdo da página /ajuda), com capa, sumário e numeração.
 *
 * Requer o Playwright com o Chromium (ferramenta de desenvolvimento; não é
 * dependência do sistema):  npx -y playwright@1 install chromium  (uma vez)
 *
 *   node scripts/manual-pdf.mjs
 *
 * O sumário com números de página é feito em duas passagens: primeiro cada
 * tópico é impresso sozinho para contar as páginas; depois o documento todo.
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MANUAL, MANUAL_VERSION } from '../src/pages/help/manual.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/manual/manual-curtain.pdf')
const require = createRequire(import.meta.url)

let chromium
try {
  ({ chromium } = require('playwright'))
} catch {
  console.error('Playwright não encontrado. Instale com: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

function imgData(name) {
  const file = join(ROOT, 'public/manual', `${name}.webp`)
  if (!existsSync(file)) throw new Error(`Imagem ausente: ${file}`)
  return `data:image/webp;base64,${readFileSync(file).toString('base64')}`
}

function block(b) {
  if (b.h) return `<h3>${rich(b.h)}</h3>`
  if (b.p) return `<p>${rich(b.p)}</p>`
  if (b.steps) return `<ol class="steps">${b.steps.map((s) => `<li>${rich(s)}</li>`).join('')}</ol>`
  if (b.tip) return `<aside class="call tip"><strong>Dica.</strong> ${rich(b.tip)}</aside>`
  if (b.note) return `<aside class="call note"><strong>Importante.</strong> ${rich(b.note)}</aside>`
  if (b.table) {
    return `<table><thead><tr>${b.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
      b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')
    }</tbody></table>`
  }
  if (b.img) {
    return `<figure class="${b.narrow ? 'narrow' : ''}"><img src="${imgData(b.img)}" alt="${esc(b.caption)}"><figcaption>Figura: ${esc(b.caption)}</figcaption></figure>`
  }
  return ''
}

const topic = (t, n) => `
  <section class="topic" id="${t.id}">
    <p class="group">${n}. ${esc(t.group)}</p>
    <h2>${esc(t.title)}</h2>
    <p class="summary">${esc(t.summary)}</p>
    ${t.blocks.map(block).join('\n')}
  </section>`

const cover = () => `
  <section class="cover">
    <div class="frame">
      <p class="eyebrow">Gestão teatral</p>
      <h1>Curtain</h1>
      <div class="rule"></div>
      <p class="subtitle">Manual do Usuário</p>
      <p class="desc">Guia passo a passo das funcionalidades do sistema:<br>produções, companhias, elenco e equipe, agenda, tarefas,<br>recursos, financeiro, bilheteria e indicadores.</p>
      <p class="version">${esc(MANUAL_VERSION)}</p>
      <p class="demo">As telas deste manual são capturas reais do ambiente de demonstração,<br>preenchido apenas com dados fictícios.</p>
    </div>
  </section>`

const toc = (pages) => `
  <section class="toc">
    <h2>Sumário</h2>
    <ol>${MANUAL.map((t, i) => `<li><a href="#${t.id}"><span>${i + 1}. ${esc(t.title)}</span><i></i><b>${pages ? pages[i] : '00'}</b></a></li>`).join('')}</ol>
  </section>`

const CSS = `
@page { size: A4; margin: 20mm 18mm 22mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Inter, Arial, sans-serif; font-size: 10.5pt; line-height: 1.6; color: #2a1d16; }
h1, h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; color: #5a1a24; }
h3 { font-family: Cinzel, Georgia, serif; font-size: 11pt; letter-spacing: .04em; color: #7a5520; margin: 18pt 0 6pt; break-after: avoid; }
p { margin: 0 0 8pt; }
strong { color: #3b1218; }
.topic { break-before: page; }
.group { font-family: Cinzel, serif; font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: #a3803f; margin: 0; }
.topic h2 { font-size: 26pt; margin: 2pt 0 4pt; border-bottom: 1px solid #c9a96a; padding-bottom: 6pt; }
.summary { font-style: italic; color: #6b5442; margin-bottom: 12pt; }
.steps { counter-reset: s; list-style: none; padding: 0; margin: 0 0 10pt; }
.steps li { counter-increment: s; position: relative; padding-left: 26pt; margin-bottom: 5pt; break-inside: avoid; }
.steps li::before { content: counter(s); position: absolute; left: 0; top: 1pt; width: 16pt; height: 16pt; border-radius: 50%; background: #5a1a24; color: #f3e6c8; font-size: 8pt; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.call { border-left: 3px solid; padding: 6pt 10pt; margin: 0 0 10pt; border-radius: 0 4px 4px 0; break-inside: avoid; }
.tip { border-color: #b8913f; background: #f7efdc; }
.note { border-color: #5d7684; background: #eaf0f2; }
table { width: 100%; border-collapse: collapse; margin: 0 0 12pt; font-size: 9.5pt; break-inside: avoid; }
th { text-align: left; font-family: Cinzel, serif; font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase; color: #f3e6c8; background: #5a1a24; padding: 5pt 7pt; }
td { padding: 5pt 7pt; border-bottom: 1px solid #e3d3b4; vertical-align: top; }
tr:nth-child(even) td { background: #faf5ea; }
figure { margin: 6pt 0 14pt; break-inside: avoid; }
figure img { display: block; max-width: 100%; max-height: 105mm; margin: 0 auto; border: 1px solid #c9a96a; border-radius: 4px; }
figure.narrow img { width: 42%; margin: 0 auto; }
figcaption { font-size: 8.5pt; font-style: italic; color: #7a6656; text-align: center; margin-top: 4pt; }
.cover { height: 250mm; display: flex; }
.frame { flex: 1; border: 1.5px solid #b8913f; outline: 4px double #5a1a24; outline-offset: 6px; background: radial-gradient(ellipse at top, #4a1520, #22120d 70%); color: #f3e6c8; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 30mm 20mm; }
.cover .eyebrow { font-family: Cinzel, serif; letter-spacing: .35em; text-transform: uppercase; font-size: 10pt; color: #d9b86a; }
.cover h1 { font-family: Cinzel, serif; font-size: 54pt; letter-spacing: .14em; color: #f3e6c8; margin: 6pt 0; }
.cover .rule { width: 60%; height: 1px; background: linear-gradient(90deg, transparent, #d9b86a, transparent); margin: 10pt 0 16pt; }
.cover .subtitle { font-family: 'Cormorant Garamond', serif; font-size: 28pt; font-style: italic; color: #f3e6c8; }
.cover .desc { color: #e2cfa6; margin-top: 14pt; }
.cover .version { margin-top: 30pt; font-family: Cinzel, serif; font-size: 9pt; letter-spacing: .2em; color: #d9b86a; }
.cover .demo { margin-top: 10pt; font-size: 8.5pt; color: #bfa880; font-style: italic; }
.toc { break-before: page; }
.toc h2 { font-size: 30pt; border-bottom: 1px solid #c9a96a; padding-bottom: 6pt; }
.toc ol { list-style: none; padding: 0; margin: 14pt 0 0; }
.toc li { margin: 0 0 7pt; }
.toc a { display: flex; align-items: baseline; gap: 6pt; color: #2a1d16; text-decoration: none; font-size: 11.5pt; }
.toc i { flex: 1; border-bottom: 1px dotted #a3803f; }
.toc b { color: #5a1a24; }
`

const FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Cormorant+Garamond:ital,wght@0,600;1,400&family=Inter:wght@400;600&display=swap'
const html = (body) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${CSS}</style></head><body>${body}</body></html>`

const FOOTER = `<div style="width:100%;font-size:8px;font-family:Arial;color:#8a7461;padding:0 18mm;display:flex;justify-content:space-between">
  <span>Curtain · Manual do Usuário</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`

const countPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length

async function render(page, body) {
  await page.setContent(html(body), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  // WebP vira JPEG antes de imprimir: o Chromium guarda JPEG como está e
  // recomprimiria WebP sem perdas, deixando o PDF muito pesado.
  await page.evaluate(async () => {
    for (const img of document.images) {
      await img.decode()
      const c = document.createElement('canvas')
      const scale = Math.min(1, 1600 / img.naturalWidth)
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      img.src = c.toDataURL('image/jpeg', 0.82)
      await img.decode()
    }
  })
  return page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: FOOTER, preferCSSPageSize: true })
}

const browser = await chromium.launch()
const page = await browser.newPage()
try {
  // 1ª passagem: páginas de cada parte
  const coverPages = countPages(await render(page, cover()))
  const tocPages = countPages(await render(page, toc(null)))
  let next = coverPages + tocPages + 1
  const starts = []
  for (const [i, t] of MANUAL.entries()) {
    starts.push(next)
    next += countPages(await render(page, topic(t, i + 1)))
  }
  // 2ª passagem: documento completo
  const pdf = await render(page, cover() + toc(starts) + MANUAL.map((t, i) => topic(t, i + 1)).join(''))
  const total = countPages(pdf)
  if (total !== next - 1) console.warn(`Aviso: esperado ${next - 1} páginas, obtido ${total}. Confira o sumário.`)
  writeFileSync(OUT, pdf)
  console.log(`✓ ${OUT} (${total} páginas, ${(pdf.length / 1024 / 1024).toFixed(1)} MB)`)
} finally {
  await browser.close()
}
