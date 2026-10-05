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

  // Get mountain surface elevation at a specific X coordinate
  function getMountainElevation(targetX, baseY, amplitude, frequency, octaves, parallaxOffset) {
    let nx = (targetX + parallaxOffset) * frequency;
    let elevation = 0;
    let amp = amplitude;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      elevation += Math.sin(nx * freq * 0.005 + o * 1.7) * amp;
      elevation += Math.cos(nx * freq * 0.0028 - o * 2.1) * (amp * 0.5);
      amp *= 0.48;
      freq *= 2.1;
    }
    return baseY + elevation;
  }

  // Authentic Kyoto Pagoda & Mountain Shrine Architecture
  function drawTemple(ctx, tx, ty, s) {
    ctx.save();
    ctx.translate(tx, ty);

    const lanternPulse = 0.85 + Math.sin(time * 2.2) * 0.15;

    // Atmospheric lantern glow radiating from temple sanctuary
    const sanctumGlow = ctx.createRadialGradient(0, -35 * s, 0, 0, -35 * s, 85 * s);
    sanctumGlow.addColorStop(0, `rgba(255, 120, 50, ${0.45 * lanternPulse})`);
    sanctumGlow.addColorStop(0.35, `rgba(224, 35, 28, ${0.22 * lanternPulse})`);
    sanctumGlow.addColorStop(0.7, `rgba(224, 35, 28, ${0.06 * lanternPulse})`);
    sanctumGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sanctumGlow;
    ctx.fillRect(-90 * s, -130 * s, 180 * s, 150 * s);

    function drawCurvedRoof(yBase, halfW, roofH, curveH) {
      ctx.beginPath();
      ctx.moveTo(-halfW, yBase);
      ctx.quadraticCurveTo(0, yBase + curveH * 0.45, halfW, yBase);
      ctx.quadraticCurveTo(halfW * 0.45, yBase - roofH * 0.7, halfW * 0.35, yBase - roofH);
      ctx.lineTo(-halfW * 0.35, yBase - roofH);
      ctx.quadraticCurveTo(-halfW * 0.45, yBase - roofH * 0.7, -halfW, yBase);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#05080c';
    ctx.strokeStyle = '#05080c';

    // Base timber terrace stilts into the mountain rock
    ctx.fillRect(-44 * s, -4 * s, 88 * s, 6 * s);
    ctx.fillRect(-38 * s, 2 * s, 6 * s, 32 * s);
    ctx.fillRect(32 * s, 2 * s, 6 * s, 32 * s);
    ctx.fillRect(-4 * s, 2 * s, 8 * s, 30 * s);
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(-36 * s, 4 * s); ctx.lineTo(-2 * s, 28 * s);
    ctx.moveTo(-2 * s, 4 * s); ctx.lineTo(-36 * s, 28 * s);
    ctx.moveTo(2 * s, 4 * s); ctx.lineTo(34 * s, 28 * s);
    ctx.moveTo(34 * s, 4 * s); ctx.lineTo(2 * s, 28 * s);
    ctx.stroke();

    // Balustrade Level 1
    ctx.fillRect(-42 * s, -10 * s, 84 * s, 2 * s);
    for (let bx = -40; bx <= 40; bx += 8) {
      ctx.fillRect(bx * s, -10 * s, 1.5 * s, 6 * s);
    }

    // Level 1 Chamber walls & pillars
    ctx.fillRect(-30 * s, -38 * s, 60 * s, 28 * s);

    // Central sanctuary warm shoji lantern glow
    const windowGlow = ctx.createLinearGradient(0, -36 * s, 0, -14 * s);
    windowGlow.addColorStop(0, `rgba(255, 140, 60, ${0.75 * lanternPulse})`);
    windowGlow.addColorStop(1, `rgba(224, 35, 28, ${0.55 * lanternPulse})`);
    ctx.fillStyle = windowGlow;
    ctx.fillRect(-12 * s, -31 * s, 24 * s, 19 * s);

    // Shoji lattice bars
    ctx.fillStyle = '#05080c';
    ctx.fillRect(-12 * s, -31 * s, 24 * s, 1.5 * s);
    ctx.fillRect(-12 * s, -22 * s, 24 * s, 1.5 * s);
    ctx.fillRect(-12 * s, -13 * s, 24 * s, 1.5 * s);
    ctx.fillRect(-0.9 * s, -31 * s, 1.8 * s, 19 * s);
    ctx.fillRect(-6 * s, -31 * s, 1.3 * s, 19 * s);
    ctx.fillRect(5 * s, -31 * s, 1.3 * s, 19 * s);

    // Pillars Level 1
    ctx.fillStyle = '#05080c';
    ctx.fillRect(-30 * s, -38 * s, 4 * s, 28 * s);
    ctx.fillRect(26 * s, -38 * s, 4 * s, 28 * s);
    ctx.fillRect(-16 * s, -38 * s, 3.2 * s, 28 * s);
    ctx.fillRect(13 * s, -38 * s, 3.2 * s, 28 * s);

    // Roof 1 (Lowest, widest)
    drawCurvedRoof(-38 * s, 54 * s, 15 * s, 5.5 * s);

    // Level 2 Chamber
    ctx.fillRect(-23 * s, -76 * s, 46 * s, 23 * s);
    ctx.fillStyle = `rgba(255, 120, 50, ${0.5 * lanternPulse})`;
    ctx.fillRect(-7 * s, -70 * s, 14 * s, 13 * s);
    ctx.fillStyle = '#05080c';
    ctx.fillRect(-0.9 * s, -70 * s, 1.8 * s, 13 * s);
    ctx.fillRect(-7 * s, -64 * s, 14 * s, 1.3 * s);
    ctx.fillRect(-23 * s, -76 * s, 3.5 * s, 23 * s);
    ctx.fillRect(19.5 * s, -76 * s, 3.5 * s, 23 * s);

    // Roof 2 (Middle)
    drawCurvedRoof(-76 * s, 44 * s, 13 * s, 4.5 * s);

    // Level 3 Chamber
    ctx.fillRect(-17 * s, -106 * s, 34 * s, 18 * s);
    ctx.fillRect(-17 * s, -106 * s, 2.8 * s, 18 * s);
    ctx.fillRect(14.2 * s, -106 * s, 2.8 * s, 18 * s);

    // Roof 3 (Top)
    drawCurvedRoof(-106 * s, 35 * s, 11 * s, 3.8 * s);

    // Spire (Sōrin)
    const spireY = -117 * s;
    ctx.beginPath();
    ctx.arc(0, spireY, 4.5 * s, 0, Math.PI, true);
    ctx.fill();
    ctx.fillRect(-1.3 * s, spireY - 40 * s, 2.6 * s, 40 * s);

    // 7 Sacred Rings (Kurin)
    for (let r = 0; r < 7; r++) {
      const ry = spireY - 13 * s - r * 3.6 * s;
      const rw = (5.8 - r * 0.42) * s;
      ctx.beginPath();
      ctx.ellipse(0, ry, rw, 1.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flame Jewel (Hōju)
    const hōjuY = spireY - 40 * s;
    ctx.beginPath();
    ctx.arc(0, hōjuY, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();

    // Jewel vermilion star glow
    ctx.fillStyle = `rgba(255, 90, 60, ${0.85 * lanternPulse})`;
    ctx.shadowColor = '#ff5a3c';
    ctx.shadowBlur = 7 * s;
    ctx.beginPath();
    ctx.arc(0, hōjuY, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Windswept Kyoto Mountain Pine (Matsu) on the left
    ctx.fillStyle = '#04060a';
    const pineX = -68 * s;
    const pineY = 16 * s;
    ctx.beginPath();
    ctx.moveTo(pineX, pineY);
    ctx.quadraticCurveTo(pineX - 14 * s, pineY - 26 * s, pineX - 8 * s, pineY - 54 * s);
    ctx.quadraticCurveTo(pineX + 4 * s, pineY - 70 * s, pineX + 2 * s, pineY - 84 * s);
    ctx.lineWidth = 4.2 * s;
    ctx.stroke();

    function drawFoliageCloud(cx, cy, rx, ry) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    drawFoliageCloud(pineX - 15 * s, pineY - 42 * s, 15 * s, 6 * s);
    drawFoliageCloud(pineX + 11 * s, pineY - 52 * s, 17 * s, 6.5 * s);
    drawFoliageCloud(pineX - 5 * s, pineY - 66 * s, 16 * s, 5.5 * s);
    drawFoliageCloud(pineX + 15 * s, pineY - 78 * s, 14 * s, 5 * s);
    drawFoliageCloud(pineX + 2 * s, pineY - 88 * s, 12 * s, 4.5 * s);

    // Stone Garden Lantern (Ishidōrō) on the right
    const lX = 62 * s;
    const lY = -2 * s;
    ctx.fillStyle = '#05080c';
    ctx.fillRect(lX - 4 * s, lY + 6 * s, 8 * s, 3.5 * s);
    ctx.fillRect(lX - 1.8 * s, lY - 6 * s, 3.6 * s, 12 * s);
    ctx.fillRect(lX - 5 * s, lY - 8 * s, 10 * s, 2 * s);

    // Glowing flame inside lantern
    ctx.fillStyle = `rgba(255, 120, 50, ${0.9 * lanternPulse})`;
    ctx.shadowColor = '#ff5a3c';
    ctx.shadowBlur = 8 * s;
    ctx.fillRect(lX - 2.5 * s, lY - 14 * s, 5 * s, 6 * s);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#05080c';
    ctx.fillRect(lX - 3.5 * s, lY - 15 * s, 1.2 * s, 7 * s);
    ctx.fillRect(lX + 2.3 * s, lY - 15 * s, 1.2 * s, 7 * s);
    ctx.beginPath();
    ctx.moveTo(lX - 8.5 * s, lY - 15 * s);
    ctx.quadraticCurveTo(lX, lY - 14 * s, lX + 8.5 * s, lY - 15 * s);
    ctx.lineTo(lX + 2 * s, lY - 20 * s);
    ctx.lineTo(lX - 2 * s, lY - 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lX, lY - 21.5 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Subtle ground mist
    const templeMist = ctx.createLinearGradient(-90 * s, -6 * s, 90 * s, 20 * s);
    templeMist.addColorStop(0, 'transparent');
    templeMist.addColorStop(0.3, 'rgba(223, 231, 224, 0.045)');
    templeMist.addColorStop(0.6, 'rgba(224, 35, 28, 0.035)');
    templeMist.addColorStop(1, 'transparent');
    ctx.fillStyle = templeMist;
    ctx.fillRect(-100 * s, -14 * s, 200 * s, 40 * s);

    ctx.restore();
  }

  // Torii Gate on distant left ridge
  function drawToriiGate(ctx, gx, gy, s) {
    ctx.save();
    ctx.translate(gx, gy);

    ctx.fillStyle = '#060a0f';
    ctx.strokeStyle = '#060a0f';

    // Vertical pillars (Hashira)
    ctx.fillRect(-14 * s, -24 * s, 2.8 * s, 28 * s);
    ctx.fillRect(11.2 * s, -24 * s, 2.8 * s, 28 * s);

    // Kasagi (top curved lintel)
    ctx.beginPath();
    ctx.moveTo(-20 * s, -28 * s);
    ctx.quadraticCurveTo(0, -26 * s, 20 * s, -28 * s);
    ctx.lineTo(21 * s, -30 * s);
    ctx.quadraticCurveTo(0, -28 * s, -21 * s, -30 * s);
    ctx.closePath();
    ctx.fill();

    // Shimaki & Nuki (cross-beams)
    ctx.fillRect(-17 * s, -26 * s, 34 * s, 2.2 * s);
    ctx.fillRect(-14 * s, -20 * s, 28 * s, 1.8 * s);

    // Gakuzuka (center plaque strut)
    ctx.fillRect(-1 * s, -26 * s, 2 * s, 6 * s);

    // Subtle vermilion lantern / portal aura
    const toriiAura = ctx.createRadialGradient(0, -12 * s, 0, 0, -12 * s, 22 * s);
    toriiAura.addColorStop(0, 'rgba(224, 35, 28, 0.16)');
    toriiAura.addColorStop(1, 'transparent');
    ctx.fillStyle = toriiAura;
    ctx.beginPath();
    ctx.arc(0, -12 * s, 22 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

    // Distant Torii Gate perched on left ridge
    const toriiTargetX = width * 0.18;
    const toriiX = toriiTargetX + mx * 25;
    const toriiY = getMountainElevation(toriiTargetX, m1Y, 110, 0.9, 4, mx * 25);
    const toriiScale = Math.min(0.9, Math.max(0.55, width / 1400));
    drawToriiGate(ctx, toriiX, toriiY, toriiScale);

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

    // Kyoto Pagoda Temple Blend on Ridge 2
    const templeScale = Math.min(1.15, Math.max(0.68, width / 1250));
    const templeTargetX = width * 0.78;
    const templeX = templeTargetX + mx * 55;
    const templeY = getMountainElevation(templeTargetX, m2Y, 135, 1.4, 4, mx * 55 + 500);
    drawTemple(ctx, templeX, templeY, templeScale);

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
