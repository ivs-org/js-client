# Debugging playbook

## Audio: "sound doesn't start after F5"
Symptoms:
- InvalidStateError: AudioWorkletNode cannot be created: node name not defined

Cause:
- AudioWorklet addModule not awaited before creating AudioWorkletNode

Fix:
- `await AudioShared.ensureWorklet()` before `new AudioWorkletNode(...)`

## Video: "VideoFrame was garbage collected without being closed"
Cause:
- Some VideoFrames not closed in error/early-return paths
- Decoder keeps `_lastFrame` without closing previous

Fix:
- wrap with try/finally and always `frame.close()`
- close previous `_lastFrame` on overwrite

## Video freezes after long background
Possible causes:
- WS throttled / killed on mobile
- decoder left in broken state after background
- missing resume logic

Fix:
- background pause: close ws, reset collector
- resume: recreate decoder, reconnect ws, force keyframe
- watchdog: lastRxAt > 30s => reconnect

## Device lists empty in Settings
Cause:
- enumerateDevices before permissions: labels empty / limited list
Fix:
- Permissions section: request camera/mic once
- refresh devices on settings open and on devicechange event

## Scrollbars not styled in Yandex/Chrome
Cause:
- scrollbar-color/width override webkit scrollbar in Chromium 121+
Fix:
- use `@supports(scrollbar-color:...)` + webkit fallback

## Logging policy
- use `console.debug` for idempotent repeats
- `warn` for recoverable problems
- `error` for fatal

## Useful instrumentation (optional)
- lastRxAt / lastVideoAt timestamps
- AudioContext state (running/suspended)
- media ws readyState transitions
