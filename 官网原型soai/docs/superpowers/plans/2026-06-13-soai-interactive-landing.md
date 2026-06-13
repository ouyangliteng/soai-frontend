# SOAI 交互式落地页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `soai-landing.html/css/js` 三件套，实现四章节骑手旅程叙事网页：全屏开场 → 滚动骨骼揭示（可互动）→ 进步对比 → CTA 收尾。

**Architecture:** 纯原生 HTML/CSS/JS，无构建工具。GSAP + ScrollTrigger 通过 CDN 引入处理滚动动画；骨骼用 SVG 路径 + `stroke-dashoffset` 实现描边生长；粒子系统用 Canvas 实现。三个文件职责清晰：HTML 负责结构和语义，CSS 负责视觉语言和静态布局，JS 负责所有动画与交互逻辑。

**Tech Stack:** GSAP 3.12.5 + ScrollTrigger（CDN），SVG，Canvas API，CSS Custom Properties，原生 JS（ES2020）

---

## 文件结构

```
官网原型soai/
├── soai-landing.html     # 新建：页面结构和语义 HTML
├── soai-landing.css      # 新建：CSS 变量、全局样式、各章节布局
├── soai-landing.js       # 新建：粒子系统、GSAP 动画、骨骼交互
└── assets/               # 已有，复用
    └── hero-equestrian-training.png
```

不修改现有 `index.html`、`styles.css`、`script.js`。

---

## Task 1：HTML 骨架 + CSS 变量 + 全局样式

**Files:**
- Create: `soai-landing.html`
- Create: `soai-landing.css`

- [ ] **Step 1：创建 `soai-landing.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SOAI — 你踩上马镫的那一刻</title>
  <link rel="stylesheet" href="soai-landing.css" />
</head>
<body>
  <canvas id="particles" aria-hidden="true"></canvas>

  <!-- S01: 全屏开场 -->
  <section id="s01" class="section s01">
    <div class="s01-content">
      <div class="s01-eyebrow">SOAI Training System</div>
      <h1 class="s01-title">
        <span class="s01-line1">你踩上马镫</span>
        <span class="s01-line2">的那一刻</span>
      </h1>
      <p class="s01-sub">SOAI 已经开始记录</p>
    </div>
    <div class="s01-hero-img">
      <img src="assets/hero-equestrian-training.png" alt="马术骑手" />
    </div>
    <div class="s01-scroll-hint" aria-label="向下探索">
      <span class="s01-scroll-arrow">↓</span>
      <span class="s01-scroll-text">向下探索</span>
    </div>
  </section>

  <!-- S02: 滚动骨骼揭示 -->
  <section id="s02" class="section s02">
    <div class="s02-inner">
      <div class="s02-left">
        <p class="s02-phase" id="s02-phase">AI 正在扫描你的姿态</p>
      </div>
      <div class="s02-center">
        <svg
          id="skeleton-svg"
          viewBox="0 0 220 310"
          aria-label="骑手骨骼姿态分析图"
          role="img"
        >
          <!-- 关节点（可交互，初始隐藏） -->
          <g id="joints" opacity="0">
            <circle class="joint" id="j-head"    cx="110" cy="28"  r="6" data-name="头部"   data-val="前倾 8°"  data-tip="保持头部自然中立，视线水平向前" />
            <circle class="joint" id="j-neck"    cx="108" cy="62"  r="5" data-name="颈椎"   data-val="对齐良好" data-tip="颈部放松，避免紧缩" />
            <circle class="joint" id="j-lsho"    cx="62"  cy="82"  r="5" data-name="左肩"   data-val="外旋 6°"  data-tip="肩部下沉，减少外旋幅度" />
            <circle class="joint" id="j-rsho"    cx="158" cy="82"  r="5" data-name="右肩"   data-val="对称良好" data-tip="保持双肩水平，当前状态良好" />
            <circle class="joint" id="j-lelbow"  cx="44"  cy="138" r="5" data-name="左肘"   data-val="弯曲 95°" data-tip="肘部保持自然弯曲，轻持缰绳" />
            <circle class="joint" id="j-relbow"  cx="176" cy="138" r="5" data-name="右肘"   data-val="弯曲 92°" data-tip="右肘略需放松，与左侧保持对称" />
            <circle class="joint" id="j-hip"     cx="106" cy="138" r="6" data-name="髋部"   data-val="稳定 87%" data-tip="髋部稳定性良好，继续保持深坐" />
            <circle class="joint" id="j-lknee"   cx="52"  cy="185" r="5" data-name="左膝"   data-val="内扣 4°"  data-tip="左膝微有内扣，注意放松大腿内侧" />
            <circle class="joint" id="j-rknee"   cx="158" cy="185" r="5" data-name="右膝"   data-val="对称良好" data-tip="右膝位置正确，踩镫力度均匀" />
            <circle class="joint" id="j-lankle"  cx="56"  cy="250" r="5" data-name="左踝"   data-val="踩镫 −2°" data-tip="脚跟稍向下压，增加踩镫稳定性" />
            <circle class="joint" id="j-rankle"  cx="154" cy="250" r="5" data-name="右踝"   data-val="踩镫良好" data-tip="右踝角度正确，保持当前状态" />
          </g>

          <!-- 骨骼路径（stroke-dashoffset 动画） -->
          <g id="bones" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <!-- 脊柱 group (0–20%) -->
            <g class="bone-group" id="bg-spine" stroke="#00c8ff" stroke-width="2">
              <line class="bone" x1="110" y1="48" x2="108" y2="68" />
              <line class="bone" x1="108" y1="68" x2="106" y2="138" />
            </g>
            <!-- 头部 group (20–30%) -->
            <g class="bone-group" id="bg-head" stroke="#00c8ff" stroke-width="2">
              <circle class="bone" cx="110" cy="28" r="20" fill="none" />
            </g>
            <!-- 肩臂 group (30–50%) -->
            <g class="bone-group" id="bg-arms" stroke="#6496ff" stroke-width="1.8">
              <line class="bone" x1="62"  y1="82"  x2="158" y2="82"  />
              <line class="bone" x1="62"  y1="82"  x2="44"  y2="138" />
              <line class="bone" x1="158" y1="82"  x2="176" y2="138" />
            </g>
            <!-- 髋腿 group (50–80%) -->
            <g class="bone-group" id="bg-legs" stroke="#a855f7" stroke-width="1.8">
              <line class="bone" x1="106" y1="138" x2="78"  y2="148" />
              <line class="bone" x1="106" y1="138" x2="132" y2="148" />
              <line class="bone" x1="78"  y1="148" x2="52"  y2="185" />
              <line class="bone" x1="132" y1="148" x2="158" y2="185" />
            </g>
            <!-- 脚踝 group (80–100%) -->
            <g class="bone-group" id="bg-ankles" stroke="#a855f7" stroke-width="1.8">
              <line class="bone" x1="52"  y1="185" x2="56"  y2="250" />
              <line class="bone" x1="158" y1="185" x2="154" y2="250" />
            </g>
          </g>
        </svg>

        <!-- 数据标签 -->
        <div class="data-labels" aria-label="骑手姿态数据">
          <div class="data-tag data-tag--blue"  id="dt-spine"  style="top:30%; left:-10px;">● 背部角度 ── 12.4°</div>
          <div class="data-tag data-tag--green" id="dt-hip"    style="top:48%; right:-10px;">● 髋部稳定 ── 87%</div>
          <div class="data-tag data-tag--red"   id="dt-center" style="top:60%; left:-10px;">● 重心偏移 ── −2.8cm</div>
          <div class="data-tag data-tag--blue"  id="dt-ankle"  style="top:83%; right:-10px;">● 踩镫压力 ── 均匀</div>
        </div>
      </div>
      <div class="s02-right">
        <div class="s02-scan-line"></div>
      </div>
    </div>

    <!-- Tooltip 浮层 -->
    <div id="tooltip" class="tooltip" role="tooltip" aria-live="polite">
      <div class="tooltip-name"></div>
      <div class="tooltip-val"></div>
      <div class="tooltip-tip"></div>
      <button class="tooltip-close" aria-label="关闭">×</button>
    </div>
  </section>

  <!-- S03: 进步对比 -->
  <section id="s03" class="section s03">
    <div class="s03-inner">
      <div class="s03-left">
        <div class="s03-eyebrow">三周后的你</div>
        <h2 class="s03-title">数据不会说谎</h2>
        <svg id="progress-chart" viewBox="0 0 340 200" aria-label="训练进步折线图">
          <!-- 网格辅助线 -->
          <g stroke="rgba(255,255,255,0.06)" stroke-width="1">
            <line x1="0" y1="50"  x2="340" y2="50"  />
            <line x1="0" y1="100" x2="340" y2="100" />
            <line x1="0" y1="150" x2="340" y2="150" />
          </g>
          <!-- 训练前（暗色平缓） -->
          <path
            id="line-before"
            d="M 10,155 C 60,152 100,150 150,148 C 200,146 260,145 330,143"
            fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"
          />
          <!-- 使用 SOAI 后（渐变上扬） -->
          <path
            id="line-after"
            d="M 10,155 C 40,148 70,138 110,118 C 150,98 200,70 250,48 C 280,34 310,28 330,24"
            fill="none" stroke="url(#lineGrad)" stroke-width="2.5"
          />
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stop-color="#00c8ff" />
              <stop offset="100%" stop-color="#a855f7" />
            </linearGradient>
          </defs>
          <!-- 图例 -->
          <g font-size="10" fill="rgba(255,255,255,0.4)">
            <line x1="10" y1="182" x2="30" y2="182" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
            <text x="36" y="186">使用前</text>
            <line x1="90" y1="182" x2="110" y2="182" stroke="url(#lineGrad)" stroke-width="2"/>
            <text x="116" y="186" fill="rgba(255,255,255,0.6)">使用 SOAI 后</text>
          </g>
        </svg>
      </div>
      <div class="s03-right">
        <div class="stat-card">
          <div class="stat-num" data-target="87" data-suffix="%">0%</div>
          <div class="stat-label">姿态稳定性提升</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" data-target="3" data-suffix="周">0周</div>
          <div class="stat-label">平均见效周期</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" data-target="12" data-suffix="°">0°</div>
          <div class="stat-label">背部角度优化</div>
        </div>
      </div>
    </div>
  </section>

  <!-- S04: CTA -->
  <section id="s04" class="section s04">
    <div class="s04-glow"></div>
    <div class="s04-content">
      <div class="s04-eyebrow">开始你的训练</div>
      <h2 class="s04-title">成为更好的骑手</h2>
      <p class="s04-sub">预约演示，亲身体验 AI 姿态分析</p>
      <div class="s04-actions">
        <a class="btn btn--primary" href="#s01">预约演示 →</a>
        <a class="btn btn--ghost" href="#s03">了解更多</a>
      </div>
    </div>
  </section>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script src="soai-landing.js"></script>
</body>
</html>
```

- [ ] **Step 2：创建 `soai-landing.css`（CSS 变量 + 全局样式）**

```css
/* ── CSS 变量 ── */
:root {
  --bg:       #06000f;
  --blue:     #00c8ff;
  --purple:   #a855f7;
  --mid:      #6496ff;
  --green:    #00ff88;
  --red:      #ff6b6b;
  --text:     rgba(255, 255, 255, 0.85);
  --text-dim: rgba(255, 255, 255, 0.55);
  --data:     rgba(255, 255, 255, 0.35);
  --grid-bg:
    linear-gradient(rgba(0,200,255,0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,200,255,0.055) 1px, transparent 1px);
}

/* ── Reset & 全局 ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  overflow-x: hidden;
}

/* 粒子 Canvas：全屏固定，不遮挡交互 */
#particles {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.7;
}

/* 通用章节容器 */
.section {
  position: relative;
  z-index: 1;
  background-image: var(--grid-bg);
  background-size: 28px 28px;
}

/* ── 无障碍：减少动效 ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3：在浏览器打开验证骨架**

```bash
open soai-landing.html
```

预期：黑色背景页面，无报错，四个 section 存在（可在 DevTools Elements 中确认）。CSS 已加载（Network 标签中 `soai-landing.css` 状态 200）。

- [ ] **Step 4：提交**

```bash
git add soai-landing.html soai-landing.css
git commit -m "feat: SOAI landing 页面骨架和 CSS 变量"
```

---

## Task 2：Canvas 粒子系统

**Files:**
- Create: `soai-landing.js`（本 Task 只写粒子部分）

- [ ] **Step 1：创建 `soai-landing.js`，写粒子系统**

```js
/* ── 粒子系统 ── */
(function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W, H, particles, mouse = { x: -999, y: -999 };

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function randomBetween(a, b) { return a + Math.random() * (b - a); }

  function makeParticle() {
    const hue = Math.random() < 0.5 ? 195 : 270; // 蓝 or 紫
    return {
      x: randomBetween(0, W),
      y: randomBetween(0, H),
      r: randomBetween(0.8, 2),
      vx: randomBetween(-0.15, 0.15),
      vy: randomBetween(-0.15, 0.15),
      alpha: randomBetween(0.08, 0.18),
      hue,
    };
  }

  function buildParticles() {
    particles = Array.from({ length: 65 }, makeParticle);
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      // 鼠标排斥
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150 && dist > 0) {
        p.x += (dx / dist) * 0.4;
        p.y += (dy / dist) * 0.4;
      }

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('resize', () => { resize(); buildParticles(); });

  resize();
  buildParticles();
  tick();
})();
```

- [ ] **Step 2：验证粒子效果**

刷新 `soai-landing.html`。预期：页面上方可见极淡的蓝/紫色小点缓慢漂浮；移动鼠标时粒子轻微偏离鼠标位置；控制台无报错。

- [ ] **Step 3：提交**

```bash
git add soai-landing.js
git commit -m "feat: Canvas 粒子背景系统"
```

---

## Task 3：Section 01 布局 + 进场动画

**Files:**
- Modify: `soai-landing.css`（追加 S01 样式）
- Modify: `soai-landing.js`（追加 S01 动画）

- [ ] **Step 1：在 `soai-landing.css` 末尾追加 S01 样式**

```css
/* ── S01：全屏开场 ── */
.s01 {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  align-items: center;
  padding: 80px clamp(24px, 6vw, 100px);
  position: relative;
  overflow: hidden;
}

/* 蓝色光晕 */
.s01::after {
  content: '';
  position: absolute;
  bottom: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse, rgba(0,200,255,0.12) 0%, transparent 70%);
  pointer-events: none;
}

.s01-content {
  grid-column: 1;
  grid-row: 1;
  z-index: 1;
}

.s01-eyebrow {
  font-size: 11px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--blue);
  margin-bottom: 20px;
  opacity: 0; /* GSAP 控制进场 */
}

.s01-title {
  font-size: clamp(48px, 7vw, 88px);
  font-weight: 900;
  line-height: 1.05;
  margin-bottom: 24px;
}

.s01-line1 {
  display: block;
  color: var(--text);
  opacity: 0; /* GSAP */
  transform: translateY(24px);
}

.s01-line2 {
  display: block;
  background: linear-gradient(90deg, var(--blue), var(--purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  opacity: 0; /* GSAP */
  transform: translateY(24px);
}

.s01-sub {
  font-size: 16px;
  color: var(--text-dim);
  letter-spacing: 2px;
  opacity: 0; /* GSAP */
}

/* 右侧骑手图 */
.s01-hero-img {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0; /* GSAP */
}

.s01-hero-img img {
  max-height: 70vh;
  max-width: 100%;
  object-fit: contain;
  filter: brightness(0.85) saturate(1.1);
  box-shadow: 0 0 60px rgba(0,200,255,0.25), 0 0 120px rgba(0,200,255,0.08);
  border-radius: 4px;
}

/* 滚动提示 */
.s01-scroll-hint {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-bottom: 32px;
  opacity: 0; /* GSAP */
  animation: pulse-hint 2s ease-in-out infinite;
}

.s01-scroll-arrow {
  font-size: 20px;
  color: var(--blue);
}

.s01-scroll-text {
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--data);
}

@keyframes pulse-hint {
  0%, 100% { opacity: 0.6; transform: translateY(0); }
  50%       { opacity: 1;   transform: translateY(4px); }
}
```

- [ ] **Step 2：在 `soai-landing.js` 末尾追加 S01 进场动画**

```js
/* ── S01 进场动画 ── */
(function initS01() {
  // prefers-reduced-motion：跳过动画，直接显示
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.s01-eyebrow, .s01-line1, .s01-line2, .s01-sub, .s01-hero-img, .s01-scroll-hint')
      .forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to('.s01-eyebrow', { opacity: 1, duration: 0.6 })
    .to('.s01-line1',   { opacity: 1, y: 0, duration: 0.7 }, '-=0.3')
    .to('.s01-line2',   { opacity: 1, y: 0, duration: 0.7 }, '-=0.5')
    .to('.s01-sub',     { opacity: 1, duration: 0.6 },        '-=0.3')
    .to('.s01-hero-img',{ opacity: 1, duration: 1 },           '-=0.5')
    .to('.s01-scroll-hint', { opacity: 0.6, duration: 0.6 },  '-=0.3');
})();
```

- [ ] **Step 3：验证 S01**

刷新页面。预期：
- 文字从下方淡入出现，顺序为：eyebrow → 第一行 → 第二行（渐变色）→ 副文案
- 右侧骑手图淡入
- 底部「↓ 向下探索」脉冲闪烁
- 控制台无报错

- [ ] **Step 4：提交**

```bash
git add soai-landing.css soai-landing.js
git commit -m "feat: S01 全屏开场布局和进场动画"
```

---

## Task 4：Section 02 骨骼 SVG 静态布局

**Files:**
- Modify: `soai-landing.css`（追加 S02 静态样式）

- [ ] **Step 1：在 `soai-landing.css` 末尾追加 S02 静态样式**

```css
/* ── S02：滚动骨骼揭示 ── */
.s02 {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px clamp(24px, 6vw, 100px);
}

.s02-inner {
  display: grid;
  grid-template-columns: 1fr 380px 1fr;
  align-items: center;
  gap: 40px;
  width: 100%;
  max-width: 1100px;
}

/* 左侧文案 */
.s02-left {
  text-align: right;
}

.s02-phase {
  font-size: clamp(16px, 2vw, 22px);
  font-weight: 700;
  color: var(--blue);
  letter-spacing: 1px;
  transition: opacity 0.4s ease;
}

/* 骨骼 SVG 容器 */
.s02-center {
  position: relative;
}

#skeleton-svg {
  width: 100%;
  max-width: 380px;
  display: block;
  overflow: visible;
}

/* 骨骼路径初始设置（JS 会覆盖 dashoffset） */
.bone { stroke-dasharray: 1000; stroke-dashoffset: 1000; }

/* 关节点 */
.joint {
  fill: none;
  stroke: var(--blue);
  stroke-width: 2;
  cursor: pointer;
  transition: r 0.2s, filter 0.2s;
}

.joint:hover,
.joint.active {
  filter: drop-shadow(0 0 6px var(--blue));
}

/* 数据标签 */
.data-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.data-tag {
  position: absolute;
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.data-tag--blue  { color: var(--blue); }
.data-tag--green { color: var(--green); }
.data-tag--red   { color: var(--red); }

/* 右侧扫描线 */
.s02-right {
  display: flex;
  align-items: center;
  justify-content: center;
}

.s02-scan-line {
  width: 1px;
  height: 200px;
  background: linear-gradient(to bottom, transparent, var(--blue), transparent);
  opacity: 0.3;
  animation: scan 3s ease-in-out infinite;
}

@keyframes scan {
  0%, 100% { transform: scaleY(0.4); opacity: 0.2; }
  50%       { transform: scaleY(1);   opacity: 0.5; }
}

/* ── Tooltip ── */
.tooltip {
  position: fixed;
  background: rgba(6, 0, 15, 0.92);
  border: 1px solid rgba(0,200,255,0.4);
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 180px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 100;
  backdrop-filter: blur(8px);
}

.tooltip.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.tooltip-name {
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--blue);
  margin-bottom: 4px;
}

.tooltip-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}

.tooltip-tip {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
}

.tooltip-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  color: var(--data);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.tooltip-close:hover { color: var(--text); }
```

- [ ] **Step 2：验证 S02 静态布局**

向下滚动到 S02 区域。预期：
- 三列布局（左侧文案 / 中间骨骼 SVG / 右侧扫描线）
- 骨骼路径存在但不可见（`stroke-dashoffset` 使路径不显示）
- 关节圆点不可见（`opacity: 0`）
- 右侧扫描线缓慢脉冲

- [ ] **Step 3：提交**

```bash
git add soai-landing.css
git commit -m "feat: S02 骨骼 SVG 静态布局和 tooltip 样式"
```

---

## Task 5：Section 02 ScrollTrigger 骨骼生长动画

**Files:**
- Modify: `soai-landing.js`（追加骨骼动画逻辑）

- [ ] **Step 1：在 `soai-landing.js` 末尾追加骨骼生长动画**

```js
/* ── S02 骨骼生长（ScrollTrigger 锁帧） ── */
(function initSkeleton() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // 直接显示全部骨骼
    document.querySelectorAll('.bone').forEach(b => {
      b.style.strokeDashoffset = '0';
    });
    document.getElementById('joints').style.opacity = '1';
    document.querySelectorAll('.data-tag').forEach(t => t.style.opacity = '1');
    return;
  }

  // 为每条路径计算真实长度并设置 dasharray/dashoffset
  function initBoneDash(el) {
    const len = el.getTotalLength ? el.getTotalLength() : 1000;
    el.style.strokeDasharray  = len;
    el.style.strokeDashoffset = len;
    return len;
  }

  const bones = document.querySelectorAll('.bone');
  const boneLengths = Array.from(bones).map(initBoneDash);

  // 按 group 分组，定义每段的进度区间
  const groups = [
    { el: document.getElementById('bg-spine'),  start: 0,    end: 0.2  },
    { el: document.getElementById('bg-head'),   start: 0.2,  end: 0.3  },
    { el: document.getElementById('bg-arms'),   start: 0.3,  end: 0.5  },
    { el: document.getElementById('bg-legs'),   start: 0.5,  end: 0.8  },
    { el: document.getElementById('bg-ankles'), start: 0.8,  end: 1.0  },
  ];

  // 数据标签显示的触发进度
  const tagTriggers = [
    { id: 'dt-spine',  at: 0.22 },
    { id: 'dt-hip',    at: 0.55 },
    { id: 'dt-center', at: 0.65 },
    { id: 'dt-ankle',  at: 0.88 },
  ];

  // 左侧文案阶段
  const phases = [
    { from: 0,    to: 0.33, text: 'AI 正在扫描你的姿态' },
    { from: 0.33, to: 0.66, text: '每一个关节都在记录'  },
    { from: 0.66, to: 1,    text: '你的骑乘数据已完整捕获' },
  ];
  const phaseEl = document.getElementById('s02-phase');
  let currentPhase = -1;

  ScrollTrigger.create({
    trigger: '#s02',
    start: 'top top',
    end: '+=200%',          // 滚动 2 屏的距离完成骨骼
    pin: true,
    scrub: 0.6,
    onUpdate(self) {
      const p = self.progress;

      // 骨骼生长
      for (const g of groups) {
        const bones = g.el.querySelectorAll('.bone');
        const localP = Math.max(0, Math.min(1, (p - g.start) / (g.end - g.start)));
        bones.forEach(b => {
          const len = parseFloat(b.style.strokeDasharray);
          b.style.strokeDashoffset = len * (1 - localP);
        });
      }

      // 数据标签淡入
      for (const t of tagTriggers) {
        const el = document.getElementById(t.id);
        el.style.opacity = p >= t.at ? '1' : '0';
      }

      // 关节点淡入（骨骼基本完成后）
      document.getElementById('joints').style.opacity = p > 0.85 ? String(Math.min(1, (p - 0.85) / 0.1)) : '0';

      // 左侧文案切换
      for (let i = 0; i < phases.length; i++) {
        if (p >= phases[i].from && p < phases[i].to && currentPhase !== i) {
          currentPhase = i;
          phaseEl.style.opacity = '0';
          setTimeout(() => {
            phaseEl.textContent = phases[i].text;
            phaseEl.style.opacity = '1';
          }, 200);
        }
      }
    },
  });
})();
```

- [ ] **Step 2：验证骨骼动画**

刷新页面，缓慢向下滚动到 S02。预期：
- 视口锁定在 S02（页面滚动时视觉不移动）
- 骨骼从脊柱开始逐段向外生长
- 继续滚动，数据标签依次淡入
- 左侧文案分三阶段切换
- 骨骼全部生长完成后关节圆点淡入
- 再继续滚动，视口解锁，进入 S03

- [ ] **Step 3：提交**

```bash
git add soai-landing.js
git commit -m "feat: S02 ScrollTrigger 骨骼生长动画"
```

---

## Task 6：Section 02 节点悬停 Tooltip 交互

**Files:**
- Modify: `soai-landing.js`（追加 tooltip 逻辑）

- [ ] **Step 1：在 `soai-landing.js` 末尾追加 tooltip 交互**

```js
/* ── S02 节点悬停 Tooltip ── */
(function initTooltip() {
  const tooltip = document.getElementById('tooltip');
  const nameEl  = tooltip.querySelector('.tooltip-name');
  const valEl   = tooltip.querySelector('.tooltip-val');
  const tipEl   = tooltip.querySelector('.tooltip-tip');
  const closeBtn = tooltip.querySelector('.tooltip-close');

  let pinned = false;
  let activeJoint = null;

  function showTooltip(joint, x, y) {
    nameEl.textContent = joint.dataset.name;
    valEl.textContent  = joint.dataset.val;
    tipEl.textContent  = joint.dataset.tip;
    tooltip.classList.add('visible');
    positionTooltip(x, y);
  }

  function positionTooltip(x, y) {
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + 16;
    let top  = y - th / 2;
    if (left + tw > vw - 16) left = x - tw - 16;
    if (top < 8) top = 8;
    if (top + th > vh - 8) top = vh - th - 8;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
  }

  function hideTooltip() {
    if (pinned) return;
    tooltip.classList.remove('visible');
    if (activeJoint) activeJoint.classList.remove('active');
    activeJoint = null;
  }

  document.querySelectorAll('.joint').forEach(joint => {
    joint.addEventListener('mouseenter', e => {
      if (pinned) return;
      activeJoint = joint;
      joint.classList.add('active');
      showTooltip(joint, e.clientX, e.clientY);
    });

    joint.addEventListener('mousemove', e => {
      if (!pinned) positionTooltip(e.clientX, e.clientY);
    });

    joint.addEventListener('mouseleave', () => {
      if (!pinned) hideTooltip();
    });

    joint.addEventListener('click', e => {
      e.stopPropagation();
      if (activeJoint && activeJoint !== joint) {
        activeJoint.classList.remove('active');
      }
      pinned = true;
      activeJoint = joint;
      joint.classList.add('active');
      showTooltip(joint, e.clientX, e.clientY);
    });
  });

  closeBtn.addEventListener('click', () => {
    pinned = false;
    hideTooltip();
  });

  document.addEventListener('click', e => {
    if (!tooltip.contains(e.target) && !e.target.classList.contains('joint')) {
      pinned = false;
      hideTooltip();
    }
  });
})();
```

- [ ] **Step 2：验证 Tooltip 交互**

滚动到骨骼完全生长后（关节圆点可见）。预期：
- 鼠标悬停关节 → 150ms 内 tooltip 弹出，显示关节名、数值、AI 建议
- tooltip 位置跟随鼠标，自动避开屏幕边缘
- 鼠标离开关节 → tooltip 消失
- 点击关节 → tooltip 固定（不随鼠标移动）
- 点击 × 或页面空白处 → tooltip 关闭

- [ ] **Step 3：提交**

```bash
git add soai-landing.js
git commit -m "feat: S02 骨骼节点悬停/点击 Tooltip 交互"
```

---

## Task 7：Section 03 进步对比

**Files:**
- Modify: `soai-landing.css`（追加 S03 样式）
- Modify: `soai-landing.js`（追加折线图动画 + 数字计数）

- [ ] **Step 1：在 `soai-landing.css` 末尾追加 S03 样式**

```css
/* ── S03：进步对比 ── */
.s03 {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 80px clamp(24px, 6vw, 100px);
}

.s03-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.s03-eyebrow {
  font-size: 10px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--purple);
  margin-bottom: 12px;
}

.s03-title {
  font-size: clamp(32px, 4vw, 52px);
  font-weight: 900;
  color: var(--text);
  margin-bottom: 32px;
}

#progress-chart {
  width: 100%;
  overflow: visible;
}

/* 折线图路径初始（JS 控制 dashoffset） */
#line-before,
#line-after {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
}

/* 统计卡片 */
.s03-right {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stat-card {
  padding: 24px 28px;
  border: 1px solid rgba(168,85,247,0.25);
  border-radius: 12px;
  background: rgba(168,85,247,0.04);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(to bottom, var(--blue), var(--purple));
}

.stat-num {
  font-size: clamp(36px, 4vw, 52px);
  font-weight: 900;
  background: linear-gradient(90deg, var(--blue), var(--purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 6px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-dim);
}
```

- [ ] **Step 2：在 `soai-landing.js` 末尾追加 S03 动画**

```js
/* ── S03 折线图 + 数字计数 ── */
(function initS03() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 折线图路径长度初始化
  const lineBefore = document.getElementById('line-before');
  const lineAfter  = document.getElementById('line-after');

  function initLineDash(el) {
    const len = el.getTotalLength();
    el.style.strokeDasharray  = len;
    el.style.strokeDashoffset = reduced ? '0' : len;
  }

  initLineDash(lineBefore);
  initLineDash(lineAfter);

  if (reduced) {
    document.querySelectorAll('.stat-num').forEach(el => {
      el.textContent = el.dataset.target + el.dataset.suffix;
    });
    return;
  }

  // 数字滚动计数
  function countUp(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix;
    const duration = 1500;
    const start = performance.now();

    function step(now) {
      const elapsed = Math.min(now - start, duration);
      const eased   = 1 - Math.pow(1 - elapsed / duration, 3); // easeOutCubic
      const value   = Math.round(eased * target);
      el.textContent = value + suffix;
      if (elapsed < duration) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // ScrollTrigger：进入视口触发动画（once: true）
  ScrollTrigger.create({
    trigger: '#s03',
    start: 'top 70%',
    once: true,
    onEnter() {
      // 折线图生长
      gsap.to(lineBefore, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out' });
      gsap.to(lineAfter,  { strokeDashoffset: 0, duration: 1.8, ease: 'power2.out', delay: 0.3 });

      // 数字计数
      document.querySelectorAll('.stat-num').forEach((el, i) => {
        setTimeout(() => countUp(el), i * 200);
      });
    },
  });
})();
```

- [ ] **Step 3：验证 S03**

滚动到 S03。预期：
- 折线图从左向右描边生长（渐变色上扬曲线更慢，有延迟）
- 三个数字从 0 滚动到目标值（87%、3周、12°）
- 统计卡片左侧有蓝→紫渐变竖条

- [ ] **Step 4：提交**

```bash
git add soai-landing.css soai-landing.js
git commit -m "feat: S03 进步对比折线图和数字计数动画"
```

---

## Task 8：Section 04 CTA 收尾

**Files:**
- Modify: `soai-landing.css`（追加 S04 样式）
- Modify: `soai-landing.js`（追加 S04 进场动画）

- [ ] **Step 1：在 `soai-landing.css` 末尾追加 S04 样式**

```css
/* ── S04：CTA 收尾 ── */
.s04 {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.s04-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(168,85,247,0.18) 0%, transparent 65%);
  pointer-events: none;
}

.s04-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 640px;
  padding: 40px 24px;
  opacity: 0;
  transform: translateY(24px);
}

.s04-eyebrow {
  font-size: 10px;
  letter-spacing: 5px;
  text-transform: uppercase;
  color: var(--purple);
  margin-bottom: 16px;
}

.s04-title {
  font-size: clamp(40px, 6vw, 76px);
  font-weight: 900;
  color: var(--text);
  margin-bottom: 16px;
  line-height: 1.05;
}

.s04-sub {
  font-size: 16px;
  color: var(--text-dim);
  margin-bottom: 40px;
}

.s04-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 14px 32px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn--primary {
  background: linear-gradient(90deg, var(--blue), var(--purple));
  color: #fff;
  border: none;
}

.btn--primary:hover {
  filter: brightness(1.15);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(168,85,247,0.35);
}

.btn--ghost {
  background: transparent;
  color: var(--text-dim);
  border: 1px solid rgba(255,255,255,0.2);
}

.btn--ghost:hover {
  border-color: rgba(255,255,255,0.5);
  color: var(--text);
}
```

- [ ] **Step 2：在 `soai-landing.js` 末尾追加 S04 进场动画**

```js
/* ── S04 进场动画 ── */
(function initS04() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelector('.s04-content').style.opacity = '1';
    return;
  }

  ScrollTrigger.create({
    trigger: '#s04',
    start: 'top 65%',
    once: true,
    onEnter() {
      gsap.to('.s04-content', {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
      });
    },
  });
})();
```

- [ ] **Step 3：验证 S04**

滚动到 S04。预期：
- 紫色光晕从中心向外辐射
- 内容区淡入上升
- 「预约演示 →」按钮有蓝→紫渐变背景，hover 时上浮并发光
- 「了解更多」按钮透明描边，hover 时加亮

- [ ] **Step 4：提交**

```bash
git add soai-landing.css soai-landing.js
git commit -m "feat: S04 CTA 收尾布局和进场动画"
```

---

## Task 9：全页完整通读 + prefers-reduced-motion 验证

**Files:**
- Modify: `soai-landing.css`（如有遗漏的响应式修复）

- [ ] **Step 1：桌面端完整通读**

在 Chrome 打开 `soai-landing.html`，从顶部缓慢滚动到底部，逐项核对：

| 检查项 | 预期 |
|--------|------|
| S01 标题进场 | 三段逐步淡入，「的那一刻」是蓝→紫渐变 |
| S01 骑手图 | 有蓝色发光边框，不变形 |
| S02 骨骼生长 | 脊柱→头→肩臂→髋腿→脚踝顺序生长 |
| S02 文案切换 | 三段文案跟随进度切换，淡入淡出 |
| S02 数据标签 | 随对应骨骼完成后淡入 |
| S02 节点 tooltip | 悬停显示，点击固定，× 关闭 |
| S03 折线图 | 两条曲线分别从左生长，渐变曲线有延迟 |
| S03 数字计数 | 从 0 滚动到目标值 |
| S04 CTA | 内容淡入，按钮交互正常 |
| 粒子系统 | 全程可见极淡浮动粒子，鼠标移动有偏移 |

- [ ] **Step 2：验证 prefers-reduced-motion**

在 Chrome DevTools → Rendering → 勾选「Emulate CSS media feature prefers-reduced-motion: reduce」，刷新页面。预期：
- 所有 GSAP 动画跳过（内容直接可见）
- 骨骼、折线图直接显示完整状态
- 数字直接显示目标值
- 粒子仍然存在（Canvas 动效不影响可读性）

- [ ] **Step 3：Safari 兼容检查**

用 Safari 打开，确认：
- `-webkit-background-clip: text` 渐变文字正常显示
- `backdrop-filter` tooltip 模糊效果正常（Safari 需要 `-webkit-backdrop-filter`）

如果 Safari 下 tooltip 无模糊效果，在 `.tooltip` 中追加：

```css
.tooltip {
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
```

- [ ] **Step 4：最终提交**

```bash
git add soai-landing.html soai-landing.css soai-landing.js
git commit -m "feat: SOAI 交互式落地页完整实现"
```

---

## 自查：规格覆盖确认

| 设计规格 | 对应 Task |
|----------|-----------|
| 黑底 `#06000f` + 蓝→紫色彩系统 | Task 1 CSS 变量 |
| 网格背景 + 光晕 | Task 1 CSS + S01/S04 section 样式 |
| Canvas 粒子系统 | Task 2 |
| S01 全屏开场 + 逐字进场动画 | Task 3 |
| S01 骑手图发光边框 | Task 3 CSS |
| S02 ScrollTrigger 锁帧骨骼生长 | Task 5 |
| S02 马术坐姿骨骼 SVG | Task 1 HTML（SVG 坐标） |
| S02 数据标签随骨骼淡入 | Task 5 |
| S02 左侧文案三阶段切换 | Task 5 |
| S02 节点悬停/点击 Tooltip | Task 6 |
| S03 折线图描边生长 | Task 7 |
| S03 数字滚动计数 | Task 7 |
| S04 CTA + 按钮交互 | Task 8 |
| prefers-reduced-motion 降级 | Task 2/3/5/6/7/8 各自处理 |
| 不修改现有 index.html | Task 1（独立文件） |
| 产品章节暂缓 | 未实现，符合设计文档约定 |
