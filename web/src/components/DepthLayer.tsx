"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as THREE from "three";

const MAX = 32;
const SELECTOR = ".cbeam:has(> input), .cbeam:has(> textarea), .cbeam:has(> select), .tile, .pz-tilecard, .card.good, .btn:not(.ghost):not(.soft)";

/**
 * Soft contact shadows for search bars, fields, tiles and the primary buttons, drawn by ONE three.js canvas behind the page
 * (one WebGL context for the whole site, not one per field). A fragment shader evaluates a rounded-box distance for each
 * element's rectangle and paints a soft, downward-offset shadow; a focused field lifts, so its shadow grows and moves away.
 * It draws only when something changed (scroll, resize, focus, DOM change), at half resolution because the result is blurry by design.
 */
export function DepthLayer() {
  const path = usePathname();
  useEffect(() => {
    if (path === "/town" || !window.matchMedia("(min-width: 0px)").matches) return;
    let gl: THREE.WebGLRenderer;
    try { gl = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" }); } catch { return; }   // no WebGL: the CSS shadows stay
    const canvas = gl.domElement; canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "0" });
    document.body.prepend(canvas); document.documentElement.classList.add("has-depth");
    gl.setPixelRatio(0.5);
    const rects = Array.from({ length: MAX }, () => new THREE.Vector4(-9999, -9999, 0, 0));
    const lifts = new Float32Array(MAX);
    const uniforms = { uRects: { value: rects }, uLift: { value: lifts }, uRes: { value: new THREE.Vector2(1, 1) }, uShade: { value: 0.5 }, uGlow: { value: 0.3 }, uCount: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, uniforms,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `
        precision mediump float; varying vec2 vUv; uniform vec4 uRects[${MAX}]; uniform float uLift[${MAX}]; uniform vec2 uRes; uniform float uShade; uniform float uGlow; uniform int uCount;
        float box(vec2 p, vec2 c, vec2 h, float r){ vec2 d = abs(p - c) - h + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
        void main(){
          vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes; float a = 0.0; float g = 0.0;
          for (int i = 0; i < ${MAX}; i++) {
            if (i >= uCount) break;
            vec4 r = uRects[i]; float l = uLift[i];
            vec2 c = r.xy + r.zw * 0.5;
            float near = box(p, c + vec2(0.0, 5.0 + 7.0 * l), r.zw * 0.5, 16.0);          // tight contact shadow
            float far  = box(p, c + vec2(0.0, 18.0 + 16.0 * l), r.zw * 0.5 - 6.0, 22.0);  // wide ambient shadow
            g += (1.0 - smoothstep(0.0, 30.0, box(p, c, r.zw * 0.5, 16.0))) * l * uGlow;
            a += (1.0 - smoothstep(-2.0, 12.0 + 4.0 * l, near)) * 0.55 + (1.0 - smoothstep(-6.0, 34.0 + 12.0 * l, far)) * 0.5;
          }
          float sh = clamp(a, 0.0, 1.0) * uShade * 0.9; float gl = clamp(g, 0.0, 1.0); vec3 col = mix(vec3(0.0), vec3(0.43, 0.51, 1.0), gl / (gl + sh + 0.001));
          gl_FragColor = vec4(col, clamp(sh + gl * 0.5, 0.0, 1.0));
        }`,
    });
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const cam = new THREE.Camera();
    let raf = 0, alive = true, els: HTMLElement[] = [];
    const pick = () => { els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).slice(0, MAX); schedule(); };
    const size = () => { gl.setSize(innerWidth, innerHeight, false); uniforms.uRes.value.set(innerWidth, innerHeight); };
    const frame = () => {
      raf = 0; if (!alive) return;
      let moving = false, n = 0;
      for (const el of els) {
        const b = el.getBoundingClientRect();
        if (b.bottom < -60 || b.top > innerHeight + 60 || b.width < 8) continue;
        const focus = el.matches(":focus-within") ? 1 : 0;
        lifts[n] += (focus - lifts[n]) * 0.25; if (Math.abs(focus - lifts[n]) > 0.01) moving = true; else lifts[n] = focus;
        rects[n].set(b.left, b.top, b.width, b.height); n++;
      }
      uniforms.uCount.value = n;
      const light = document.documentElement.dataset.theme === "light"; uniforms.uShade.value = light ? 0.4 : 1.0; uniforms.uGlow.value = light ? 0.15 : 0.35;
      gl.render(scene, cam);
      if (moving) schedule();
    };
    function schedule() { if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame); }
    const on = () => { schedule(); };
    const mo = new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(pick, 120); }); let t = 0;
    size(); pick();
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-theme"] });
    addEventListener("scroll", on, { passive: true, capture: true }); addEventListener("resize", () => { size(); on(); });
    addEventListener("focusin", on); addEventListener("focusout", on); document.addEventListener("visibilitychange", on);
    return () => {
      alive = false; cancelAnimationFrame(raf); clearTimeout(t); mo.disconnect();
      removeEventListener("scroll", on, true); removeEventListener("focusin", on); removeEventListener("focusout", on);
      canvas.remove(); document.documentElement.classList.remove("has-depth"); mat.dispose(); gl.dispose();
    };
  }, [path]);
  return null;
}
