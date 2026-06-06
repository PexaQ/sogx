# Mobile Testing

Last updated: 2026-06-06

Use Android Chrome first. Android WebView testing is a separate follow-up.

## Start Server

```powershell
npm run viewer:build
npm run viewer:serve
```

Check from the host:

```text
http://127.0.0.1:4173/api/health
```

## Route A: USB ADB Reverse

```powershell
adb reverse tcp:4173 tcp:4173
adb shell am start -a android.intent.action.VIEW -d "http://127.0.0.1:4173/run?asset=%2Fassets%2Fscenes%2Fkaliurang%2Fscene.sog&mode=baselineA&scene=kaliurang&duration=30&autoStart=true&autoExport=server&resultEndpoint=%2Fapi%2Fsave-run&route=orbit-demo"
```

Print the exact current URL:

```powershell
npm run mobile:url -- --scene kaliurang
```

Print a Phase 3 static-budget URL after a streamed variant exists:

```powershell
npm run mobile:url -- --asset /assets/scenes/kaliurang/streamed/aggressive_sh0/lod-meta.json --mode staticBudget_100000 --duration 30 --resultName kaliurang_android_budget100k
```

Open automatically if `adb` is on PATH:

```powershell
node scripts/open-android-chrome.mjs --scene kaliurang
```

## Route B: LAN IP

Print the LAN URL:

```powershell
npm run mobile:url -- --scene kaliurang
```

Open on the phone in Chrome:

```text
http://<host-ip>:4173/run?asset=%2Fassets%2Fscenes%2Fkaliurang%2Fscene.sog&mode=baselineA&scene=kaliurang&duration=30&autoStart=true&autoExport=server&resultEndpoint=%2Fapi%2Fsave-run&route=orbit-demo
```

Check from the phone:

```text
http://<host-ip>:4173/api/health
```

## Troubleshooting

- Use Chrome, not an in-app browser.
- Keep phone and host on the same Wi-Fi for LAN mode.
- Allow Node/Vite through the Windows firewall.
- Use `/run` instead of `/benchmark` if blocking extensions or filters are active.
- Use `/api/save-run` and `/api/health`; avoid tracker-like endpoint names.
- Disable ad blockers/extensions if Chrome blocks local requests.
- If server POST is blocked, use the on-screen JSON and CSV buttons for browser-download fallback.
- If ADB reverse fails, run `adb devices`, accept the device authorization prompt, and retry.
- If WebGPU is unavailable, the viewer should fall back to WebGL2 and record the actual renderer/device path.

## Required Mobile Fields

Each mobile result should include:

- User agent, viewport, DPR, hardware concurrency, and `deviceMemory` where available.
- PlayCanvas graphics device type and `app.scene.gsplat.currentRenderer` where available.
- Average FPS, p50/p95/p99 frame time, first visible frame time.
- Dropped frames over 33.3 ms and 41.7 ms.
- Export method/status and failure state if any.
- Visual sanity status or a note explaining why it could not be captured.

## Phase 3 Android Priority Order

After generating at least one Streamed SOG `lod-meta.json`, run:

1. `staticBudget_100000`
2. `staticBudget_50000`
3. `lodClamp_coarseOnly`
4. `baselineB`

Example ADB reverse command:

```powershell
adb reverse tcp:4173 tcp:4173
adb shell am start -a android.intent.action.VIEW -d "http://127.0.0.1:4173/run?scene=kaliurang&asset=%2Fassets%2Fscenes%2Fkaliurang%2Fstreamed%2Faggressive_sh0%2Flod-meta.json&mode=staticBudget_100000&duration=30&autoStart=true&autoExport=server&resultEndpoint=%2Fapi%2Fsave-run&route=orbit-demo&captureScreenshot=true&resultName=kaliurang_android_budget100k"
```
