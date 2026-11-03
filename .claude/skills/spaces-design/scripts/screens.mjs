// Screenshots of the main Spaces screens at iPhone size (390 x 844), for design reviews.
// The scan is faked (no AI calls, no cost); everything else is the real app and its storage.
//
//   node screens.mjs <app url> <output folder> <any photo>
//   e.g. node screens.mjs http://localhost:8788 ./shots test-photos/imageWellLitButNoBall.jpg
//
// Needs puppeteer-core (npm i puppeteer-core, in any folder you run it from) and Google Chrome.
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const [BASE = 'http://localhost:8788', OUT = './shots', PHOTO] = process.argv.slice(2)
if (!PHOTO) { console.error('Usage: node screens.mjs <app url> <output folder> <photo>'); process.exit(1) }
await mkdir(OUT, { recursive: true })

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const p = await (await browser.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
p.on('pageerror', e => console.log('PAGE ERROR', e.message))
await p.evaluateOnNewDocument(() => {
  // Skip "Is there more?" after a scan, and fake recognition with a few typical items.
  new MutationObserver(() => {
    if (document.querySelector('h1')?.innerText.startsWith('Is there more')) [...document.querySelectorAll('button')].find(b => b.innerText === 'Done')?.click()
  }).observe(document, { childList: true, subtree: true })
  navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('no camera'), { name: 'NotAllowedError' }) }
  const realFetch = window.fetch
  window.fetch = async (url, options) => {
    if (!String(url).includes('/api/inventory')) return realFetch(url, options)
    const item = (id, name, category, box) => ({ id, name, category, description: `a ${name}`, quantity: 1, photos: [0], needsReview: false, inSpace: true, area: 'main', view: { photo: 0, box, located: true } })
    const items = [
      item(0, 'brown leather sofa', 'furniture', { x1: 0.2, y1: 0.4, x2: 0.7, y2: 0.75 }),
      item(1, 'brass floor lamp', 'decor', { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 }),
      item(2, 'flat screen TV', 'electronics', { x1: 0.5, y1: 0.1, x2: 0.9, y2: 0.4 }),
    ]
    return new Response(JSON.stringify({ step: 'done', result: { items, photos: 1, warnings: { failedPhotos: [] }, timing: {} } }) + '\n')
  }
})

const wait = ms => new Promise(r => setTimeout(r, ms))
const until = (text, ms = 20000) => p.waitForFunction(t => document.body.innerText.includes(t), { timeout: ms }, text)
const click = text => p.evaluate(t => [...document.querySelectorAll('button')].reverse().find(b => b.innerText.trim() === t)?.click(), text)
const tapLabel = label => p.evaluate(l => document.querySelector(`[aria-label="${l}"]`)?.click(), label)
const openRow = text => p.evaluate(t => { const row = [...document.querySelectorAll('li')].find(l => l.innerText.includes(t)); (row?.querySelector('button, a') ?? row)?.click() }, text)
const shot = async name => { await wait(500); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('saved', name) }

try {
  await p.goto(BASE, { waitUntil: 'networkidle0' }); await until('Jump in'); await shot('01-welcome')
  await click('Jump in'); await until('I agree'); await click('I agree'); await until('What are you scanning?'); await shot('02-pick-a-space')
  await click('Living room'); await p.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Got it'), { timeout: 20000 }); await shot('03-scan-guide')
  await click('Got it'); await wait(400); await (await p.$('input[type=file]')).uploadFile(PHOTO); await until('Digital inventory'); await wait(1500)
  await p.evaluate(() => [...document.querySelectorAll('h2')].find(h => h.innerText.startsWith('Digital inventory'))?.closest('button')?.click()); await shot('04-space')
  await openRow('brown leather sofa'); await until('What should happen to it?'); await shot('05-item')
  await p.evaluate(() => { const g = document.querySelector('[role=radiogroup][aria-label=Decision]'); [...g.querySelectorAll('[role=radio], button, input')].find(x => (x.innerText || x.closest('label')?.innerText || '').trim() === 'Sell')?.click() })
  await until('Photos for selling'); await shot('06-item-sell')
  await tapLabel('Living room'); await until('Declutter this Space'); await click('Declutter this Space'); await until(' of '); await shot('07-declutter-card')
  await tapLabel('Stop decluttering'); await until('Digital inventory'); await tapLabel('Your Spaces'); await until('Your Spaces'); await shot('08-your-spaces')
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.startsWith('People'))?.click()); await until('The people you live with'); await shot('09-people')
  await tapLabel('Your Spaces'); await until('Your Spaces')
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.startsWith('For sale'))?.click()); await until('To sell'); await shot('10-for-sale')
} catch (err) {
  console.log('STOPPED', err.message); await p.screenshot({ path: `${OUT}/stopped.png`, fullPage: true })
}
await browser.close()
