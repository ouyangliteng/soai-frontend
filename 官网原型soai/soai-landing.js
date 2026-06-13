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

/* ── S01 进场动画 ── */
(function initS01() {
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
    .to('.s01-scroll-hint', { opacity: 0.6, duration: 0.6, onComplete() { gsap.set('.s01-scroll-hint', { clearProps: 'opacity' }); } }, '-=0.3');
})();

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
  Array.from(bones).map(initBoneDash);

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
  let phaseTimer = null;

  ScrollTrigger.create({
    trigger: '#s02',
    start: 'top top',
    end: '+=200%',
    pin: true,
    scrub: 0.6,
    onUpdate(self) {
      const p = self.progress;

      // 骨骼生长
      for (const g of groups) {
        const boneEls = g.el.querySelectorAll('.bone');
        const localP = Math.max(0, Math.min(1, (p - g.start) / (g.end - g.start)));
        boneEls.forEach(b => {
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
          clearTimeout(phaseTimer);
          phaseTimer = setTimeout(() => {
            phaseEl.textContent = phases[i].text;
            phaseEl.style.opacity = '1';
          }, 200);
        }
      }
    },
  });
})();
