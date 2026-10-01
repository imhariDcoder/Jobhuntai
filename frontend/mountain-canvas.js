/**
 * SmartJobAI Atmospheric Mountain & Particle Canvas
 * Inspired by ThreeUI Kage Aesthetic
 * 
 * Renders layered mountain silhouettes, atmospheric fog,
 * vermilion celestial glow, and floating ember particles with mouse parallax.
 */

(function () {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'none';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;

  // Mouse Parallax tracking
  const mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };

  window.addEventListener('pointermove', (e) => {
    mouse.targetX = e.clientX / window.innerWidth;
    mouse.targetY = e.clientY / window.innerHeight;
  }, { passive: true });

  // Floating Ember Particles
  const PARTICLE_COUNT = 55;
  const particles = [];

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.2 + 0.8,
        speedY: Math.random() * 0.45 + 0.25,
        speedX: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.65 + 0.25,
        maxAlpha: Math.random() * 0.7 + 0.3,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulseVal: Math.random() * Math.PI * 2,
        isVermilion: Math.random() < 0.65 // 65% vermilion embers, 35% gold/bone
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    if (!particles.length) initParticles();
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Procedural Mountain Generator (Deterministic)
  function createMountainPath(baseY, amplitude, frequency, octaves, parallaxOffset) {
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    for (let x = 0; x <= width + 10; x += 12) {
      let nx = (x + parallaxOffset) * frequency;
      let elevation = 0;
      let amp = amplitude;
      let freq = 1;
      
      for (let o = 0; o < octaves; o++) {
        elevation += Math.sin(nx * freq * 0.005 + o * 1.7) * amp;
        elevation += Math.cos(nx * freq * 0.0028 - o * 2.1) * (amp * 0.5);
        amp *= 0.48;
        freq *= 2.1;
      }
      
      const y = baseY + elevation;
      if (x === 0) ctx.lineTo(0, y);
      else ctx.lineTo(x, y);
    }
    
    ctx.lineTo(width, height);
    ctx.closePath();
  }

  let time = 0;

  function render() {
    time += 0.01;

    // Smooth lerp mouse parallax
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    const mx = (mouse.x - 0.5) * 2; // -1 to 1
    const my = (mouse.y - 0.5) * 2;

    ctx.clearRect(0, 0, width, height);

    // 1. Deep Midnight Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#040609');
    skyGrad.addColorStop(0.45, '#070b10');
    skyGrad.addColorStop(0.85, '#0a0f17');
    skyGrad.addColorStop(1, '#0e141d');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Vermilion Celestial Horizon Glow (Subtle & Atmospheric)
    const glowX = width * 0.5 + mx * 35;
    const glowY = height * 0.28 + my * 20;
    const glowRad = Math.min(width, height) * 0.55;

    const radGlow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRad);
    radGlow.addColorStop(0, 'rgba(224, 35, 28, 0.14)');
    radGlow.addColorStop(0.35, 'rgba(255, 90, 60, 0.06)');
    radGlow.addColorStop(0.7, 'rgba(224, 35, 28, 0.02)');
    radGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, width, height);

    // 3. Moon / Vermilion Crest
    const moonX = width * 0.5 + mx * 20;
    const moonY = height * 0.22 + my * 15;
    const moonR = 48;
    const moonGrad = ctx.createRadialGradient(moonX, moonY, moonR * 0.2, moonX, moonY, moonR);
    moonGrad.addColorStop(0, 'rgba(255, 90, 60, 0.45)');
    moonGrad.addColorStop(0.5, 'rgba(224, 35, 28, 0.35)');
    moonGrad.addColorStop(1, 'rgba(224, 35, 28, 0.0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    // 4. Distant Mountain Ridge 1 (Far - Low opacity, high haze)
    const m1Y = height * 0.62 + my * 18;
    createMountainPath(m1Y, 110, 0.9, 4, mx * 25);
    const m1Grad = ctx.createLinearGradient(0, m1Y - 100, 0, height);
    m1Grad.addColorStop(0, 'rgba(15, 22, 32, 0.55)');
    m1Grad.addColorStop(0.5, 'rgba(12, 17, 24, 0.7)');
    m1Grad.addColorStop(1, 'rgba(8, 12, 18, 0.85)');
    ctx.fillStyle = m1Grad;
    ctx.fill();

    // Mist Haze between layer 1 and 2
    const mist1 = ctx.createLinearGradient(0, m1Y - 20, 0, m1Y + 90);
    mist1.addColorStop(0, 'transparent');
    mist1.addColorStop(0.5, 'rgba(223, 231, 224, 0.035)');
    mist1.addColorStop(1, 'transparent');
    ctx.fillStyle = mist1;
    ctx.fillRect(0, m1Y - 20, width, 110);

    // 5. Middle Mountain Ridge 2 (Mid - Sharper, atmospheric dark)
    const m2Y = height * 0.73 + my * 30;
    createMountainPath(m2Y, 135, 1.4, 4, mx * 55 + 500);
    const m2Grad = ctx.createLinearGradient(0, m2Y - 120, 0, height);
    m2Grad.addColorStop(0, '#090e14');
    m2Grad.addColorStop(0.4, '#060a0e');
    m2Grad.addColorStop(1, '#040609');
    ctx.fillStyle = m2Grad;
    ctx.fill();

    // 6. Near Mountain Silhouette / Temple Terrace (Near - Deepest ink)
    const m3Y = height * 0.86 + my * 45;
    createMountainPath(m3Y, 90, 2.0, 3, mx * 90 + 1200);
    ctx.fillStyle = '#030508';
    ctx.fill();

    // 7. Ambient Floating Embers (Upward drift with subtle sin wave)
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y -= p.speedY;
      p.x += p.speedX + Math.sin(time + i) * 0.3;
      p.pulseVal += p.pulseSpeed;

      const alpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulseVal));

      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x + mx * 12, p.y + my * 12, p.size, 0, Math.PI * 2);

      if (p.isVermilion) {
        ctx.fillStyle = `rgba(224, 35, 28, ${alpha})`;
        ctx.shadowColor = '#ff5a3c';
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = `rgba(223, 231, 224, ${alpha * 0.8})`;
        ctx.shadowColor = '#dfe7e0';
        ctx.shadowBlur = 4;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0; // reset shadow

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  // Card Mouse Hover Spotlight Engine
  function initCardSpotlights() {
    const cards = document.querySelectorAll('.card, .section-header, .topbar, .stat-card, .resume-card, .jd-bullet-item');
    cards.forEach(card => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      }, { passive: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCardSpotlights);
  } else {
    initCardSpotlights();
  }

  // Re-run spotlight initialization whenever dynamic cards are added
  const observer = new MutationObserver(() => {
    initCardSpotlights();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
