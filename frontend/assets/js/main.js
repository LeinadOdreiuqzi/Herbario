import { qs, qsa } from './shared.js';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateHero() { /* no-op: GSAP animations removed by request */ }

function animateFeatures() { /* no-op: GSAP animations removed by request */ }

function animateSections() { /* no-op: GSAP animations removed by request */ }

function animateLogo() { /* no-op: GSAP animations removed by request */ }

function init() {
  // Animations removed per request; keep init for future use if needed
  animateHero();
  animateFeatures();
  animateSections();
  animateLogo();
}

export async function mountHome() {
  init();
}