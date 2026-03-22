# CCDesk Agent-First 开发工作流方案

> 目标：CC 写完代码后能**自己看到 UI、自己验证、自己 review**，不再需要人类肉眼调试。

---

## 一、核心架构：视觉验证循环

```
CC 写代码 → tsc 检查 → build → 启 dev server → Playwright 截图 → 对比设计稿 → 不通过则修复 → 通过则 commit
```

### 为什么可行

1. CCDesk 是 React SPA，**浏览器里渲染 = Electron 里渲染**（纯 UI 层）
2. `claude-api.ts` 已经有 browser fallback mock（`isElectron()` 判空）
3. 服务器已有 Playwright 1.58 + Chromium
4. Vite dev server 可以 headless 启动

### 为什么之前失败

- CC 改了 CSS 但无法看到结果
- 依赖人类截图反馈 → 循环 5+ 轮
- 没有"完成标准"，CC 认为"代码写了 = 任务完成"

---

## 二、实施方案

### Phase 1: 视觉验证基础设施

#### 1.1 截图脚本 `scripts/screenshot.sh`

```bash
#!/bin/bash
# 用法: ./scripts/screenshot.sh [light|dark] [output-path]
# 启动 Vite dev server → Playwright 截图 → 关闭

MODE="${1:-light}"
OUT="${2:-/tmp/ccdesk-screenshot.png}"
PORT=1421

# 启动 dev server（避免跟 CC 占用的 1420 冲突）
npx vite --port $PORT --host 0.0.0.0 &
VITE_PID=$!
sleep 3

# Playwright 截图
npx playwright screenshot --browser chromium \
  --viewport-size "1280,800" \
  --wait-for-timeout 2000 \
  "http://localhost:$PORT" \
  "$OUT"

kill $VITE_PID 2>/dev/null
echo "Screenshot saved: $OUT"
```

#### 1.2 多场景截图 `scripts/screenshot-scenes.ts`

```typescript
import { chromium, type Page } from 'playwright';
import fs from 'fs';

const PORT = 1421;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = process.argv[2] || '/tmp/ccdesk-screenshots';

interface Scene {
  name: string;
  url: string;
  setup?: (page: Page) => Promise<void>;
  waitMs?: number;
}

const scenes: Scene[] = [
  { name: '01-empty-chat', url: '/', waitMs: 1000 },
  { name: '02-chat-with-messages', url: '/', setup: async (page) => {
    // 注入模拟消息到 store
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (store) {
        // 注入测试消息
      }
    });
  }, waitMs: 500 },
  { name: '03-sidebar-visible', url: '/', waitMs: 500 },
  { name: '04-input-focused', url: '/', setup: async (page) => {
    await page.click('textarea');
  }, waitMs: 300 },
  { name: '05-dark-empty', url: '/', setup: async (page) => {
    // 切换 dark theme
  }, waitMs: 500 },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
  });
  
  for (const scene of scenes) {
    const page = await context.newPage();
    if (scene.name.startsWith('05-dark')) {
      await context.emulateMedia({ colorScheme: 'dark' });
    }
    await page.goto(scene.url);
    if (scene.setup) await scene.setup(page);
    await page.waitForTimeout(scene.waitMs || 1000);
    await page.screenshot({ 
      path: `${OUT_DIR}/${scene.name}.png`,
      fullPage: false 
    });
    await page.close();
  }
  
  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main();
```

#### 1.3 设计稿对比脚本 `scripts/compare-design.ts`

```typescript
// 用 Playwright 打开 Stitch 设计稿 HTML 和 CCDesk 截图
// 进行像素级对比，输出差异报告
// 这个可以先用简单的 "放在一起看" 模式
// 后续升级为 pixelmatch 自动 diff

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export function compareScreenshots(
  designPath: string,    // Stitch 设计稿截图
  actualPath: string,    // CCDesk 实际截图
  diffPath: string,      // 差异图输出
  threshold = 0.1
): number {
  const design = PNG.sync.read(fs.readFileSync(designPath));
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  
  const { width, height } = design;
  const diff = new PNG({ width, height });
  
  const mismatched = pixelmatch(
    design.data, actual.data, diff.data,
    width, height, { threshold }
  );
  
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  
  const total = width * height;
  const matchRate = ((total - mismatched) / total * 100).toFixed(2);
  console.log(`Match: ${matchRate}% (${mismatched}/${total} pixels differ)`);
  
  return mismatched;
}
```

---

### Phase 2: CC 自验证流程（写进 CLAUDE.md）

在 `CLAUDE.md` 里加入**强制流程**，CC 每次启动都会看到：

```markdown
## ⚠️ UI 修改强制流程（不可跳过）

修改任何 CSS/TSX 后，你必须按顺序执行以下步骤：

### Step 1: 编译检查
```bash
npx tsc --noEmit
```
有错误 → 修。没错误 → 继续。

### Step 2: Build 验证
```bash
npm run build
```
失败 → 修。成功 → 继续。

### Step 3: 视觉验证（必须执行！）
```bash
# 启动 dev server 并截图
PORT=1421 npx vite --port 1421 &
sleep 3
npx playwright screenshot --browser chromium \
  --viewport-size "1280,800" \
  --wait-for-timeout 2000 \
  "http://localhost:1421" \
  "/tmp/ccdesk-after.png"
kill %1 2>/dev/null

# 对比设计稿
# Light 版
python3 scripts/compare-design.py \
  /tmp/stitch-new/.../screen.png \
  /tmp/ccdesk-after.png \
  /tmp/ccdesk-diff.png

# 打开 diff 图检查
```

### Step 4: 自 Review
对着截图回答这些问题：
1. 消息布局是 AI 左 / 用户右吗？
2. 输入框 min-height 至少 100px 吗？
3. 侧边栏是 48px icon-only 吗？
4. brand-orange #D97706 用于发送按钮和活跃态吗？
5. 消息区 max-width 768px 居中吗？
6. 有没有任何 inline style 残留？

### Step 5: 修复差异
如果 Step 4 发现问题 → 修复 → 从 Step 1 重新开始。
全部通过 → 继续 Step 6。

### Step 6: Commit（带描述）
```bash
git add -A
git commit -m "描述具体改了什么，验证了什么"
```
```

---

### Phase 3: 自动化对比（进阶）

#### 3.1 Vite 插件：HMR 截图

在开发时自动截图对比，不需要手动触发。

```typescript
// vite-plugin-visual-check.ts
export default function visualCheckPlugin() {
  return {
    name: 'visual-check',
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.css') || file.endsWith('.module.css')) {
        // CSS 变更后自动截图
        server.ws.send({ type: 'custom', event: 'screenshot-request' });
      }
    }
  };
}
```

#### 3.2 CI 集成

在 GitHub Actions 里加入视觉回归测试：

```yaml
# .github/workflows/visual-test.yml
- name: Visual Regression
  run: |
    npx vite --port 1421 &
    sleep 5
    npx playwright test --config playwright-visual.config.ts
    kill %1
```

---

## 三、立即行动项（优先级排序）

| # | 任务 | 工作量 | 效果 |
|---|------|--------|------|
| **1** | 写 `scripts/screenshot.sh` | 30min | CC 能看到自己改的 UI |
| **2** | 更新 `CLAUDE.md` 加入强制流程 | 15min | CC 每次都走验证 |
| **3** | 写 `scripts/compare-design.py`（简单版） | 1h | 自动 diff 报告 |
| **4** | 配置 `playwright.config.ts` | 30min | 标准化截图流程 |
| **5** | 写 `tests/visual/` 测试用例 | 2h | 回归保护 |

---

## 四、关键约束

1. **服务器无 display** — 必须 headless 模式（Playwright headless Chromium）
2. **Vite 端口** — CC 可能在 1420 上跑 dev，截图脚本用 1421
3. **Electron mock** — `claude-api.ts` 已有 browser fallback，不需要额外 mock
4. **设计稿** — 固定位置 `/tmp/stitch-new/...`，CC 可直接读取
5. **截图分辨率** — 必须和设计稿一致（1280×800）

---

## 五、预期效果

**之前**：
```
CC 改 CSS → 推 commit → 用户 electron:build → 截图发飞书 → "输入框没变" → 再改 → 再推 → 循环 5 次
```

**之后**：
```
CC 改 CSS → build → 截图 → 对比设计稿 → 发现差异 → 修 → 再截图 → 通过 → commit → 用户直接验证
```

从 5 轮人肉循环 → 1-2 轮自动循环。

---

## 六、要不要现在实施？

我可以立刻开始：
1. 写 `scripts/screenshot.sh`（30min）
2. 更新 `CLAUDE.md` 强制流程（15min）
3. 测试截图能否正常工作

Phase 3 的自动化对比可以后续迭代。
