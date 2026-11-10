import { useEffect, useRef } from "react";
import { STANDARD_SHINE_BORDERS, type StandardShineBorder } from "../frame.ts";

export type { StandardShineBorder };
export { isStandardShineBorder } from "../frame.ts";

const WIDTH = 444;
const HEIGHT = 666;
const TAU = Math.PI * 2;

function fract(value: number) {
  return value - Math.floor(value);
}

function ease(value: number) {
  return 0.5 - 0.5 * Math.cos(value * Math.PI);
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: string,
  alpha = 1,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(0.17, `rgba(${rgb},${alpha * 0.5})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function spark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.22, y - size * 0.22);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.22, y + size * 0.22);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.22, y + size * 0.22);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x - size * 0.22, y - size * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function sweep(
  ctx: CanvasRenderingContext2D,
  phase: number,
  angle: number,
  rgb: string,
  width = 32,
  alpha = 0.7,
  offset = 0,
) {
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.rotate(angle);
  const shift = (fract(phase + offset) * 2 - 1) * 680;
  const gradient = ctx.createLinearGradient(shift - width, 0, shift + width, 0);
  gradient.addColorStop(0, `rgba(${rgb},0)`);
  gradient.addColorStop(0.4, `rgba(${rgb},${alpha * 0.2})`);
  gradient.addColorStop(0.5, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(0.6, `rgba(${rgb},${alpha * 0.2})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(shift - width, -900, width * 2, 1800);
  ctx.restore();
}

function diamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.45);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size * 0.45);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function softenMask(image: CanvasImageSource): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
  const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  let centerMax = 0;
  for (let i = 3; i < pixels.data.length; i += 4) {
    const alpha = pixels.data[i];
    const weight = Math.max(0, Math.min(1, (alpha - 48) / 48));
    pixels.data[i] = Math.round(alpha * weight * weight * (3 - 2 * weight));
    const index = (i - 3) / 4;
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    if (x >= 100 && x < 330 && y >= 160 && y < 440) centerMax = Math.max(centerMax, pixels.data[i]);
  }
  ctx.putImageData(pixels, 0, 0);
  canvas.dataset.centerMax = String(centerMax);
  return canvas;
}

const maskCache = new Map<string, Promise<HTMLCanvasElement>>();

function loadMask(border: StandardShineBorder): Promise<HTMLCanvasElement> {
  const cached = maskCache.get(border);
  if (cached) return cached;
  const next = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        resolve(softenMask(image));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("Border image could not load"));
    image.src = `/frames/sss-${border}.webp`;
  });
  maskCache.set(border, next);
  next.catch(() => maskCache.delete(border));
  return next;
}

function paintShine(
  ctx: CanvasRenderingContext2D,
  border: StandardShineBorder,
  mask: HTMLCanvasElement,
  phase: number,
) {
  const id = STANDARD_SHINE_BORDERS.indexOf(border) + 1;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.globalCompositeOperation = "source-over";

  if (id === 1) {
    sweep(ctx, phase, -0.55, "255,217,133", 105, 0.52);
    glow(ctx, 95, 590, 230, "255,139,25", 0.14 + 0.09 * Math.sin(phase * TAU));
    for (let i = 0; i < 34; i++) {
      const t = fract(phase + i * 0.618);
      const x = 24 + fract(i * 0.381) * 380 + Math.sin(t * TAU + i) * 15;
      const y = 680 - t * 470;
      const alpha = Math.sin(t * Math.PI) * (0.3 + 0.5 * fract(i * 0.21));
      glow(ctx, x, y, 8, "255,186,69", alpha * 0.6);
      spark(ctx, x, y, 2 + fract(i * 0.8) * 4, "#fff0ae", alpha);
    }
  } else if (id === 2) {
    for (let i = 0; i < 3; i++) {
      sweep(ctx, phase, -0.74, i === 1 ? "222,234,255" : "93,145,255", i === 1 ? 17 : 28, i === 1 ? 0.9 : 0.6, i * 0.047);
    }
    glow(ctx, 410, 50 + ease(fract(phase)) * 580, 110, "118,122,255", 0.3);
    for (let i = 0; i < 6; i++) {
      const t = fract(phase + i / 6);
      spark(ctx, 20 + t * 404, 650 - t * 100, 3, "#c0deff", 0.25 + 0.4 * Math.sin(t * Math.PI));
    }
  } else if (id === 3) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 525, WIDTH, 141);
    ctx.clip();
    sweep(ctx, phase, 0.6, "194,109,249", 160, 0.28);
    ctx.restore();
    for (let i = 0; i < 7; i++) {
      const t = fract(phase + i / 7);
      const x = 20 + t * 404;
      for (const y of [25 + Math.sin(t * TAU * 2) * 10, 638 + Math.sin(t * TAU * 2) * 8]) {
        glow(ctx, x, y, 18, "255,215,130", 0.38);
        spark(ctx, x, y, 4, "#fff1bd", 0.3 + 0.5 * Math.sin(t * Math.PI));
      }
    }
    glow(ctx, 36, 472, 38, "255,228,149", 0.3 + 0.16 * Math.sin(phase * TAU));
    sweep(ctx, phase, -0.2, "250,225,166", 45, 0.3, 0.4);
  } else if (id === 4) {
    const band = fract(phase) * 800 - 70;
    const gradient = ctx.createLinearGradient(0, band - 45, 0, band + 45);
    gradient.addColorStop(0, "#c9f5ff00");
    gradient.addColorStop(0.5, "#e8f6ff85");
    gradient.addColorStop(1, "#c9f5ff00");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, band - 45, WIDTH, 90);
    for (let i = 0; i < 22; i++) {
      const t = fract(phase + i * 0.217);
      const alpha = Math.sin(t * Math.PI) ** 6 * 0.45;
      const x = Math.floor(fract(i * 0.618 + phase) * 11) * 40;
      const y = i % 2 ? Math.floor(fract(i * 0.31) * 3) * 24 : 540 + Math.floor(fract(i * 0.71) * 5) * 24;
      ctx.fillStyle = `rgba(${["0,246,255", "255,72,210", "255,242,73"][i % 3]},${alpha})`;
      ctx.fillRect(x, y, 30 + (i % 3) * 12, 10 + (i % 2) * 10);
    }
  } else if (id === 5) {
    sweep(ctx, phase, -0.48, "255,70,88", 70, 0.7);
    sweep(ctx, 1 - phase, 0.48, "77,181,255", 70, 0.75);
    glow(ctx, 22, 40 + fract(phase) * 600, 95, "255,46,70", 0.35);
    glow(ctx, 422, 640 - fract(phase) * 600, 95, "28,169,255", 0.45);
    glow(ctx, 220, 570, 100, "223,237,255", Math.max(0, Math.cos(phase * TAU)) ** 12 * 0.6);
  } else {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 15; col++) {
        const x = 18 + col * 30 + (row % 2) * 15;
        const y = 533 + row * 13;
        const pulse = fract(phase - col * 0.034 - row * 0.047);
        diamond(ctx, x, y, 11, "#99ffd6", Math.max(0, Math.sin(pulse * TAU)) ** 12 * 0.55);
      }
    }
    sweep(ctx, phase, 0.55, "115,255,192", 28, 0.65);
    const cycle = fract(phase) * 4;
    const side = Math.floor(cycle);
    const t = fract(cycle);
    glow(
      ctx,
      side === 0 ? 20 + t * 404 : side === 1 ? 424 : side === 2 ? 424 - t * 404 : 20,
      side === 0 ? 15 : side === 1 ? 15 + t * 635 : side === 2 ? 650 : 650 - t * 635,
      58,
      "128,255,201",
      0.8,
    );
  }

  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0, WIDTH, HEIGHT);
  ctx.globalCompositeOperation = "source-over";
}

export function StandardBorderShine({
  border,
  intensity = 80,
}: {
  border: StandardShineBorder;
  intensity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(2600);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let dead = false;
    let mask: HTMLCanvasElement | undefined;
    let visible = true;
    let frame = 0;
    let last = 0;
    let drawn = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");

    const effectsOff = () => document.documentElement.hasAttribute("data-no-card-effects");
    const scrolling = () => Boolean(canvas.closest(".virtual-grid[data-scrolling]"));

    const render = () => {
      if (!mask) return;
      paintShine(ctx, border, mask, (timeRef.current % 12_000) / 12_000);
    };

    const tick = (now: number) => {
      frame = 0;
      if (dead || !visible || document.hidden || reduced.matches || effectsOff()) return;
      if (scrolling()) {
        last = 0;
        frame = requestAnimationFrame(tick);
        return;
      }
      if (last) timeRef.current += Math.min(now - last, 100);
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
      if (dead || !mask) return;
      render();
      if (visible && !document.hidden && !reduced.matches && !effectsOff() && !scrolling()) {
        frame = requestAnimationFrame(tick);
      }
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

    observer.observe(canvas);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    loadMask(border)
      .then((loaded) => {
        if (dead) return;
        mask = loaded;
        sync();
      })
      .catch(() => {});

    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      effectsObserver.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [border]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="standard-border-shine"
      aria-hidden="true"
      data-standard-shine={border}
      style={{ opacity: Math.max(0, Math.min(1, intensity / 100)) * 0.875 }}
    />
  );
}
