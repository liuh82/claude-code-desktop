import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('dialog', async d => { await d.accept('/root/.openclaw/workspace/claude-code-desktop'); });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.evaluate(() => { localStorage.setItem('ccdesk-sidebar-v2', 'true'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const btn = await page.$('button');
if (btn) { await btn.click(); await page.waitForTimeout(2000); }

const result = await page.evaluate(async () => {
  const mod = await import('/src/stores/useTabStore.ts');
  const store = mod.useTabStore;
  const state = store.getState();
  if (!state.activeTabId) return { error: 'no tab' };
  const tab = state.tabs.get(state.activeTabId);
  state.splitPane(state.activeTabId, tab.activePaneId, 'horizontal');
  await new Promise(r => setTimeout(r, 500));

  const tps = document.querySelectorAll('[class*="terminalPane"]');
  const info = [];
  tps.forEach((tp, i) => {
    const body = tp.querySelector(':scope > [class*="paneBody"]');
    const input = body?.querySelector(':scope > [class*="paneInput"]');
    const rect = input?.getBoundingClientRect();
    info.push({
      pane: i,
      tp_offH: tp.offsetHeight,
      body_offH: body?.offsetHeight,
      input_offH: input?.offsetHeight,
      input_bottom: Math.round(rect?.bottom),
      vpH: window.innerHeight,
      visible: rect ? rect.bottom <= window.innerHeight : false,
      cut_off: rect ? Math.max(0, Math.round(rect.bottom - window.innerHeight)) : 0,
    });
  });
  return info;
});
console.log('COMMITTED VERSION (c60685a):');
console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: '/tmp/ccdesk-committed-version.png' });

const cssCheck = await page.evaluate(() => {
  const slots = document.querySelectorAll('[class*="paneSlot"]');
  return Array.from(slots).map((s, i) => {
    const cs = window.getComputedStyle(s);
    return { index: i, minHeight: cs.minHeight, overflow: cs.overflow, contain: cs.contain, offH: s.offsetHeight };
  });
});
console.log('paneSlot CSS:', JSON.stringify(cssCheck, null, 2));

const bodyCheck = await page.evaluate(() => {
  const bodies = document.querySelectorAll('[class*="paneBody"]');
  return Array.from(bodies).map((b, i) => {
    const cs = window.getComputedStyle(b);
    return { index: i, minWidth: cs.minWidth, minHeight: cs.minHeight, flex: cs.flex, offH: b.offsetHeight };
  });
});
console.log('paneBody CSS:', JSON.stringify(bodyCheck, null, 2));

await browser.close();
