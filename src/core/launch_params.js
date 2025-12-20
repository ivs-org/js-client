// src/core/launch_params.js

function splitList(v) {
    return String(v || '')
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean);
}

export function parseLaunchParams(href = window.location.href) {
    const u = new URL(href);
    const p = u.searchParams;

    return {
        server: (p.get('s') || '').trim(),
        conference: (p.get('c') || p.get('conf') || '').trim(),
        reggroups: splitList(p.get('rg')),
        regconferences: splitList(p.get('rc')),
    };
}
