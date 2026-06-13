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
