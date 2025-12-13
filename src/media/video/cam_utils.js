
const EVEN = v => v & ~1;
const CANDIDATES = [
    //{ w: 1080, h: 1920 }, { w: 1920, h: 1080 },
    { w: 864, h: 480 }, { w: 480, h: 864 },
    { w: 720, h: 1280 }, { w: 1280, h: 720 },
    { w: 1600, h: 900 }, { w: 900, h: 1600 },
    { w: 1024, h: 576 },
    { w: 960, h: 540 }, { w: 854, h: 480 }, { w: 800, h: 600 }, { w: 640, h: 480 }, { w: 640, h: 360 },
    { w: 320, h: 240 }
];

export async function pickCameraResolution({ fps = 25 } = {}) {
    // нужно разрешение на enumerateDevices → берём временный поток
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const track = tmp.getVideoTracks()[0];
    const caps = track.getCapabilities?.() ?? {};
    const settings = track.getSettings?.() ?? {};
    const fr = caps.frameRate?.max ? Math.min(caps.frameRate.max, fps) : fps;

    // перебираем кандидатов по убыванию
    for (const cand of CANDIDATES) {
        try {
            await track.applyConstraints({
                width: { exact: cand.w },
                height: { exact: cand.h },
                frameRate: { ideal: fr },
                resizeMode: 'crop-and-scale'
            });
            const s = track.getSettings();
            // проверим, что реально выставилось и чётное
            if (s.width && s.height && !(s.width & 1) && !(s.height & 1)) {
                // возвращаем готовый поток этой же камеры — уже с нужным размером
                return { stream: tmp, track, width: s.width, height: s.height, fps: Math.round(s.frameRate ?? fr) };
            }
        } catch (_) {
            // не подошло — пробуем следующий
        }
    }

    // фоллбек: оставляем как есть, но приведём к чётным
    const s = track.getSettings();
    const fw = EVEN(s.width || 640), fh = EVEN(s.height || 480);
    try {
        await track.applyConstraints({ width: { exact: fw }, height: { exact: fh }, frameRate: { ideal: fps }, resizeMode: 'crop-and-scale' });
    } catch { }
    const s2 = track.getSettings();
    return { stream: tmp, track, width: s2.width || fw, height: s2.height || fh, fps: Math.round(s2.frameRate ?? fps) };
}
