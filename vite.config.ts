/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { realmnestProcessBridge } from './src/runtime/process/node/bridge';
import { claudeHostProgram } from './src/runtime/providers/claude-code/host';
import { codexHostProgram } from './src/runtime/providers/codex/host';

// `base: './'` keeps asset URLs relative so the build also loads from a
// Tauri webview (file / custom protocol) — no web server assumptions.
export default defineConfig({
  base: './',
  // the process bridge lets local providers (Claude Code) run during `npm run dev`;
  // it is serve-only and never part of a build
  plugins: [react(), realmnestProcessBridge([claudeHostProgram(), codexHostProgram()])],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: 'es2021', outDir: 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
