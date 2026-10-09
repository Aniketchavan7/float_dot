# M09 — Installer and release pipeline

**Status:** Packaged & Verified · **Owner:** either · **Dependencies:** M00; release candidate requires M08

Outcome: a versioned desktop release works outside this development checkout.

Entry: `package.json`, electron-builder configuration, `dist/win-unpacked`.

- [x] Configure electron-builder for Windows targets (`win-unpacked`, `portable`, `nsis`).
- [x] ASAR configuration with selective unpacking (`node_modules/tesseract.js*`).
- [x] Package speech binaries/assets into `resources/models` cleanly.
- [x] Verify packaged binary builds without error (`npm run pack` producing `dist/win-unpacked/Float Dot.exe`).
- [x] Verified binary includes all necessary DLLs (d3dcompiler, dxcompiler, ffmpeg, icudtl, vk_swiftshader) and Electron runtime.

**Verification:**
- `npm run pack`: Succeeded, output at `dist/win-unpacked/Float Dot.exe` (246 MB).
