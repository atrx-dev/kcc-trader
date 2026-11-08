import { useEffect, useRef } from "react";

const WIDTH = 444;
const HEIGHT = 666;
const TAU = Math.PI * 2;

function fract(value: number) {
  return value - Math.floor(value);
}

function hsl(hue: number) {
  return `hsl(${hue % 360} 100% 68%)`;
}

type Paint = (time: number, pointerX?: number, pointerY?: number, intensity?: number) => void;

function createPaint(foilCanvas: HTMLCanvasElement, lightsCanvas: HTMLCanvasElement): Paint {
  const foil = foilCanvas.getContext("2d");
  const lights = lightsCanvas.getContext("2d");
  if (!foil || !lights) throw new Error("Canvas unavailable");

  const mask = document.createElement("canvas");
  mask.width = WIDTH;
  mask.height = HEIGHT;
  const maskCtx = mask.getContext("2d");
  if (!maskCtx) throw new Error("Canvas unavailable");

  maskCtx.fillStyle = "#fff";
  maskCtx.fillRect(0, 0, WIDTH, HEIGHT);
  maskCtx.globalCompositeOperation = "destination-out";

  function cutHole(x: number, y: number, scaleX: number, scaleY: number, alpha: number) {
    maskCtx!.save();
    maskCtx!.translate(x, y);
    maskCtx!.scale(scaleX, scaleY);
    const gradient = maskCtx!.createRadialGradient(0, 0, 0.15, 0, 0, 1);
    gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
    gradient.addColorStop(0.65, `rgba(0,0,0,${alpha * 0.95})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    maskCtx!.fillStyle = gradient;
    maskCtx!.fillRect(-1, -1, 2, 2);
    maskCtx!.restore();
  }

  cutHole(241, 254, 110, 112, 0.91);
  cutHole(236, 583, 222, 83, 0.55);
  maskCtx.globalCompositeOperation = "source-over";

  function drawDiamond(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    hue: number,
    alpha: number,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = hsl(hue);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.12, -size * 0.12, size, 0);
    ctx.quadraticCurveTo(size * 0.12, size * 0.12, 0, size);
    ctx.quadraticCurveTo(-size * 0.12, size * 0.12, -size, 0);
    ctx.quadraticCurveTo(-size * 0.12, -size * 0.12, 0, -size);
    ctx.fill();
    ctx.restore();
  }

  function drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hue: number,
    alpha: number,
  ) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `hsla(${hue % 360},100%,88%,${alpha})`);
    gradient.addColorStop(0.18, `hsla(${hue % 360},100%,65%,${alpha * 0.4})`);
    gradient.addColorStop(1, `hsla(${hue % 360},100%,50%,0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
  }

  function drawBeam(
    ctx: CanvasRenderingContext2D,
    phase: number,
    offset: number,
    angle: number,
    strength: number,
    pointerX: number,
  ) {
    ctx.save();
    ctx.translate(222, 333);
    ctx.rotate(angle);
    const shift = (fract(phase + offset) * 2 - 1) * 650 + (pointerX - 0.5) * 100;
    const gradient = ctx.createLinearGradient(shift - 100, 0, shift + 100, 0);
    gradient.addColorStop(0, "#0000");
    gradient.addColorStop(0.22, "#60dfff00");
    gradient.addColorStop(0.4, `rgba(94,238,255,${strength * 0.22})`);
    gradient.addColorStop(0.48, `rgba(255,255,255,${strength})`);
    gradient.addColorStop(0.53, `rgba(255,171,248,${strength * 0.55})`);
    gradient.addColorStop(0.69, `rgba(255,218,104,${strength * 0.17})`);
    gradient.addColorStop(1, "#0000");
    ctx.fillStyle = gradient;
    ctx.fillRect(shift - 100, -800, 200, 1600);
    ctx.restore();
  }

  return (time, pointerX = 0.5, pointerY = 0.5, intensity = 100) => {
    const pattern = "Full spectrum";
    const phase = (time % 18_000) / 18_000;
    const hue = phase * 360 + (pointerX - 0.5) * 100;
    const strength = intensity / 100;

    foil.clearRect(0, 0, WIDTH, HEIGHT);
    lights.clearRect(0, 0, WIDTH, HEIGHT);

    if (strength) {
      for (let row = 0; row < 23; row++) {
        for (let col = 0; col < 16; col++) {
          const x = col * 30 + (row % 2) * 15 - 15;
          const y = row * 30 - 15;
          const wave = Math.sin(col * 0.61 - row * 0.43 + phase * TAU * 2 + (pointerX - pointerY) * 2);
          const alpha = Math.max(0, wave) ** 5 * 0.36 * strength;
          foil.fillStyle = `hsla(${(hue + x * 0.51 + y * 0.26) % 360},95%,59%,${alpha})`;
          foil.beginPath();
          foil.moveTo(x, y - 20);
          foil.lineTo(x + 29, y);
          foil.lineTo(x, y + 20);
          foil.lineTo(x - 29, y);
          foil.closePath();
          foil.fill();
          foil.strokeStyle = `hsla(${(hue + x * 0.3 - y * 0.17 + 180) % 360},100%,76%,${alpha * 0.6})`;
          foil.lineWidth = 0.6;
          foil.stroke();
        }
      }

      drawBeam(foil, phase, 0, -0.62, 0.48 * strength, pointerX);
      drawBeam(foil, 1 - phase, 0.42, 0.69, 0.33 * strength, pointerX);

      for (let i = 0; i < 24; i++) {
        const bend = Math.sin(phase * TAU) * 70 + (pointerX - 0.5) * 65;
        const y = 38 + i * 27;
        foil.beginPath();
        foil.moveTo(-50, y + bend);
        foil.bezierCurveTo(120, y - 120 - bend, 290, y + 180 + bend, 500, y - 50);
        foil.strokeStyle = `hsla(${hue + i * 18},100%,${i % 3 === 0 ? 36 : 72}%,${(0.13 + 0.15 * Math.max(0, Math.cos(i * 0.39 - phase * TAU * 2)) ** 5) * strength})`;
        foil.lineWidth = i % 3 === 0 ? 3 : 1.2;
        foil.stroke();
      }

      for (let i = 0; i < 7; i++) {
        foil.beginPath();
        const cx = 222 + Math.cos((i / 7) * TAU) * 171;
        const cy = 325 + Math.sin((i / 7) * TAU) * 265;
        for (let step = 0; step <= 180; step++) {
          const angle = (step / 180) * TAU;
          const radius = 43 + Math.sin(angle * 9 + phase * TAU + i) * 10;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius * 0.76;
          if (step === 0) foil.moveTo(x, y);
          else foil.lineTo(x, y);
        }
        foil.strokeStyle = `hsla(${hue + i * 51},100%,70%,${(0.28 + 0.12 * Math.sin(phase * TAU + i)) * strength})`;
        foil.lineWidth = 1.1;
        foil.stroke();
      }

      for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 12; col++) {
          const x = col * 40 + (row % 2) * 20 - 20;
          const y = 80 + row * 34;
          const pulse = Math.max(0, Math.sin(row * 0.47 + col * 0.24 - phase * TAU * 2)) ** 8;
          foil.beginPath();
          foil.ellipse(x, y, 25, 18, 0, Math.PI * 0.1, Math.PI * 0.9);
          foil.strokeStyle = `hsla(${hue + row * 12 + col * 8},90%,75%,${(0.035 + pulse * 0.34) * strength})`;
          foil.lineWidth = 0.85;
          foil.stroke();
        }
      }

      foil.save();
      foil.translate(222, 333);
      foil.rotate(-0.58);
      foil.font = "600 8px sans-serif";
      foil.textAlign = "center";
      for (let row = -10; row < 11; row++) {
        for (let col = -4; col < 5; col++) {
          const pulse = Math.max(0, Math.cos(row * 0.55 + col * 0.32 - phase * TAU)) ** 10;
          foil.fillStyle = `hsla(${hue + row * 17},95%,80%,${pulse * 0.22 * strength})`;
          foil.fillText("KCC  ◇  KOI", col * 82, row * 29);
        }
      }
      foil.restore();
    }

    foil.globalCompositeOperation = "destination-in";
    foil.drawImage(mask, 0, 0);
    foil.globalCompositeOperation = "source-over";

    if (pattern === "Full spectrum" && strength) {
      for (let i = 0; i < 7; i++) {
        const cycle = fract(phase + i / 7) * 4;
        const side = Math.floor(cycle);
        const t = fract(cycle);
        const x = side === 0 ? 12 + t * 420 : side === 1 ? 432 : side === 2 ? 432 - t * 420 : 12;
        const y = side === 0 ? 12 : side === 1 ? 12 + t * 642 : side === 2 ? 654 : 654 - t * 642;
        drawGlow(lights, x, y, 42, hue + i * 51, 0.53 * strength);
        drawDiamond(lights, x, y, 9, hue + i * 51, 0.78 * strength);
        lights.strokeStyle = `hsla(${hue + i * 51},100%,80%,${0.45 * strength})`;
        lights.lineWidth = 1.2;
        lights.beginPath();
        lights.moveTo(x - 20, y);
        lights.lineTo(x + 20, y);
        lights.moveTo(x, y - 20);
        lights.lineTo(x, y + 20);
        lights.stroke();
      }

      for (let i = 0; i < 52; i++) {
        const x = 12 + fract(i * 0.618034) * 420;
        const y = 12 + fract(i * 0.414214) * 642;
        const pulse = Math.max(0, Math.sin(phase * TAU * 2 + i * 1.7)) ** 14;
        if (((x - 241) / 110) ** 2 + ((y - 254) / 112) ** 2 < 1) continue;
        drawDiamond(lights, x, y, 2 + (i % 5), hue + i * 29, pulse * 0.65 * strength);
      }

      const ring = 170 + Math.sin(phase * TAU) * 60;
      lights.save();
      lights.translate(360 + (pointerX - 0.5) * 45, 105 + (pointerY - 0.5) * 30);
      for (let i = 0; i < 4; i++) {
        lights.beginPath();
        lights.ellipse(0, 0, ring + i * 5, (ring + i * 5) * 0.45, -0.65, 0.1, TAU);
        lights.lineWidth = 0.7;
        lights.strokeStyle = `hsla(${hue + i * 55},100%,80%,${0.1 * strength})`;
        lights.stroke();
      }
      lights.restore();
      lights.globalCompositeOperation = "destination-in";
      lights.drawImage(mask, 0, 0);
      lights.globalCompositeOperation = "source-over";
    }

    foilCanvas.dataset.phase = phase.toFixed(4);
    foilCanvas.dataset.pattern = pattern;
  };
}

export function KccChanHolo({ intensity = 100 }: { intensity?: number }) {
  const foilRef = useRef<HTMLCanvasElement>(null);
  const lightsRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(3900);

  useEffect(() => {
    const foilCanvas = foilRef.current;
    const lightsCanvas = lightsRef.current;
    const stage = foilCanvas?.parentElement;
    if (!foilCanvas || !lightsCanvas || !stage) return;

    let paint: Paint;
    try {
      paint = createPaint(foilCanvas, lightsCanvas);
    } catch {
      return;
    }

    let frame = 0;
    let last = 0;
    let drawn = 0;
    let alive = true;
    let visible = false;
    let pointerX = 0.5;
    let pointerY = 0.5;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");

    const effectsOff = () => document.documentElement.hasAttribute("data-no-card-effects");
    const scrolling = () => Boolean(stage.closest(".virtual-grid[data-scrolling]"));

    const render = () => {
      paint(timeRef.current, pointerX, pointerY, Math.max(0, Math.min(160, intensity)));
    };

    const tick = (now: number) => {
      frame = 0;
      if (!alive || !visible || document.hidden || reduced.matches || effectsOff()) return;
      if (scrolling()) {
        last = 0;
        frame = requestAnimationFrame(tick);
        return;
      }
      if (last) timeRef.current += Math.min(100, now - last);
      last = now;
      if (now - drawn >= 33) {
        render();
        drawn = now;
      }
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (!alive) return;
      render();
      if (visible && !document.hidden && !reduced.matches && !effectsOff() && !scrolling()) {
        frame = requestAnimationFrame(tick);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reduced.matches || effectsOff()) return;
      const rect = stage.getBoundingClientRect();
      pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    };

    const onLeave = () => {
      pointerX = pointerY = 0.5;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });

    const effectsObserver = new MutationObserver(sync);
    effectsObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-no-card-effects"],
    });

    observer.observe(foilCanvas);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    sync();

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      effectsObserver.disconnect();
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, [intensity]);

  return (
    <>
      <canvas ref={foilRef} width={WIDTH} height={HEIGHT} className="kcc-holo-layer kcc-holo-foil" aria-hidden="true" />
      <canvas ref={lightsRef} width={WIDTH} height={HEIGHT} className="kcc-holo-layer kcc-holo-lights" aria-hidden="true" />
    </>
  );
}
