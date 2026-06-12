// GetSeat defense — automated clip recorder.
// Drives the locally-running app (front :3000 / back :8000) with Playwright,
// records each flow to .webm, then we convert to mp4 in convert.sh.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const FRONT = 'http://localhost:3000';
const OUT = path.resolve('out');
const EV = '2', VEN = '2', TS = '2';                 // Event "Demo" / venue "stadium" / on-sale slot
const PORTAL = `${FRONT}/reserve/venue?eventId=${EV}&venueId=${VEN}&timeSlotId=${TS}`;
const SIZE = { width: 1280, height: 800 };
const RT = { width: 1080, height: 760 };             // per-window size for the 2-up realtime clip

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);                  // optional: node record.mjs dashboard guest-portal
const want = name => only.length === 0 || only.includes(name);
const log = (...a) => console.log('•', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

let browser;
async function ctx(opts = {}) {
  return browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT, size: opts.size || SIZE },
    storageState: opts.auth ? 'auth.json' : undefined,
    deviceScaleFactor: 1,
    ...opts.ctx,
  });
}
// run an action that owns its own context/page(s); saves video(s) to <name>.webm
async function clip(name, opts, fn) {
  if (!want(name)) return;
  log('recording', name, '…');
  const c = await ctx(opts);
  const videos = [];
  try {
    await fn(c, vp => videos.push(vp));            // fn pushes page.video() handles
  } catch (e) {
    log('  ! ', name, 'partial:', e.message.split('\n')[0]);
  }
  await c.close();                                  // finalizes videos
  let idx = 0;
  for (const v of videos) {
    const src = await v.path();
    const dst = path.join(OUT, videos.length > 1 ? `${name}-${idx++}.webm` : `${name}.webm`);
    fs.renameSync(src, dst);
    log('  saved', path.basename(dst));
  }
}
const click = async (page, name, t = 4000) => {
  try { await page.getByRole('button', { name }).first().click({ timeout: t }); return true; }
  catch { try { await page.getByText(name).first().click({ timeout: 1500 }); return true; } catch { return false; } }
};
const tab = async (page, name, t = 5000) => {
  try { await page.getByRole('tab', { name }).first().click({ timeout: t }); return true; }
  catch { return click(page, name, 2000); }
};
// click an EventDetail header tab by its label, scoped to the top tab-row (avoids the sidebar)
const eventTab = async (page, label) => {
  const box = await page.evaluate((lbl) => {
    const els = [...document.querySelectorAll('button,div,a,span,[role="tab"]')];
    const hit = els.find(e => {
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (t !== lbl) return false;
      const r = e.getBoundingClientRect();
      return r.y > 90 && r.y < 220 && r.x > 240 && r.width > 20 && r.width < 320 && r.height < 80;
    });
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (box) { await page.mouse.click(box.x, box.y); return true; }
  return false;
};
const gotoReady = async (page, url, wait = 3500) => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await sleep(wait); };

async function login() {
  log('logging in (admin@example.com) …');
  const c = await browser.newContext({ viewport: SIZE });
  const page = await c.newPage();
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@example.com').catch(() => {});
  await page.fill('#password', 'password').catch(() => {});
  await page.click('button[type=submit]').catch(() => {});
  await page.waitForURL(/dashboard/, { timeout: 25000 }).catch(() => {});
  await sleep(3000);
  await c.storageState({ path: 'auth.json' });
  log('  auth saved → auth.json (landed: ' + page.url() + ')');
  await c.close();
}

(async () => {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
           '--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb'],
  });

  if (!fs.existsSync('auth.json') || want('__login')) await login();

  // ---------- ORGANIZER ----------
  await clip('create-event', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/events`, 3000);
    await (click(p, /create|new event|add event|new/i) );
    await sleep(1500);
    // type into the first text field of the modal/form
    const tb = p.getByRole('textbox').first();
    try { await tb.click({ timeout: 2500 }); await tb.type('Sentinel Summit 2026', { delay: 55 }); } catch {}
    await sleep(2500);
  });

  await clip('venue-builder', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/venue-builder/edit?id=${VEN}&event=${EV}&type=event&mode=view`, 4500);
    // a little life: pan + zoom over the canvas
    const cx = SIZE.width / 2, cy = SIZE.height / 2;
    await p.mouse.move(cx, cy); await p.mouse.wheel(0, -220); await sleep(900);
    await p.mouse.move(cx - 200, cy - 80); await p.mouse.down(); await p.mouse.move(cx + 160, cy + 90, { steps: 25 }); await p.mouse.up();
    await sleep(900); await p.mouse.wheel(0, 180); await sleep(1500);
  });

  await clip('sessions', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/events/detail?eventId=${EV}`, 3500);
    await tab(p, /sessions/i); await sleep(3500);
  });

  await clip('publish-sync', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/events/venues?eventId=${EV}`, 3500);
    await click(p, /publish|public|go live|sync/i, 2500);
    await sleep(3000);
  });

  await clip('payment-setup', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/events/detail?eventId=${EV}`, 3500);
    await eventTab(p, 'Settings');                       // event payment settings (top tab-row, not sidebar)
    await sleep(2500); await p.mouse.wheel(0, 220); await sleep(1800);
  });

  await clip('dashboard', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/events/detail?eventId=${EV}`, 4500);
    await p.mouse.wheel(0, 350); await sleep(1600); await p.mouse.wheel(0, 350); await sleep(1800);
  });

  // ---------- GUEST ----------
  await clip('guest-portal', {}, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, PORTAL, 5000);
    const cx = SIZE.width / 2, cy = SIZE.height / 2;
    await p.mouse.move(cx, cy); await p.mouse.wheel(0, -200); await sleep(1200);
    await p.mouse.move(cx - 150, cy); await p.mouse.down(); await p.mouse.move(cx + 150, cy + 60, { steps: 22 }); await p.mouse.up();
    await sleep(1800);
  });

  // seats are a Konva <canvas>; deliberate clicks in the dense centre lock a real seat
  // (cross-window live propagation isn't reproducible in this local Pusher setup, so this is single-window)
  // proven grid-scan over the seat bands; stops at the first real /lock — then the seat selects & the view zooms in
  const lockOne = async (page) => {
    let locked = false;
    page.on('request', r => { if (r.method() === 'POST' && /\/lock\b/.test(r.url())) locked = true; });
    for (let y = 360; y <= 580 && !locked; y += 24)
      for (let x = 460; x <= 860 && !locked; x += 24) { await page.mouse.click(x, y); await sleep(160); }
    return locked;
  };
  await clip('realtime-locking', {}, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await p.goto(PORTAL, { waitUntil: 'domcontentloaded' }); await sleep(6500);
    await lockOne(p);                                    // seat selects → zoom + "Selected" tooltip + cart badge
    await sleep(5000);                                   // dwell on the stable selected state (we trim to this tail)
  });

  await clip('payment', {}, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await p.goto(PORTAL, { waitUntil: 'domcontentloaded' }); await sleep(6500);
    await lockOne(p); await sleep(1500);
    await p.mouse.click(1227, 740); await sleep(2200);                // open cart FAB (bottom-right)
    await click(p, /checkout|proceed|continue|review/i, 3000); await sleep(1800);
    for (const [re, val] of [[/name/i, 'Sarah Connor'], [/email/i, 'sarah@example.com'], [/phone/i, '55512345']]) {
      try { await p.getByLabel(re).first().fill(val, { timeout: 1500 }); } catch {}
    }
    await sleep(3500);                                                // end on the filled checkout summary
  });

  await clip('ticket', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/events/detail?eventId=${EV}`, 3500);
    await eventTab(p, 'Guest List');                     // issued tickets + barcodes
    await sleep(3500);
  });

  await clip('qr-scan', { auth: true }, async (c, save) => {
    const p = await c.newPage(); save(p.video());
    await gotoReady(p, `${FRONT}/dashboard/events/detail?eventId=${EV}`, 3500);
    await tab(p, /scanner/i); await sleep(2000);
    await click(p, /start|scan|camera|open/i, 2500); await sleep(4000);
  });

  await browser.close();
  log('DONE. webm files in', OUT);
})();
