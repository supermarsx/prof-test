/**
 * ProfTest Global Type Declarations (Tauri)
 * 
 * With Tauri, there is no window.profTestAPI preload bridge.
 * Instead, the renderer uses the typed `api` object from `lib/api.ts`.
 * 
 * This file only declares ambient types needed by the renderer.
 */

export {};

// Extend Window for legacy compatibility (some tests may still reference this)
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}
