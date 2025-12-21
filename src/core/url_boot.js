// src/core/url_boot.js
//
// URL boot params -> sessionStorage, затем чистим URL (без роутинга).
// Пер-tab поведение: sessionStorage.

import { normalizeServer } from '../data/session_store.js';

const SS_KEY = 'vg_url_boot_v2';

function _safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function _safeStringify(obj) {
    try { return JSON.stringify(obj); } catch { return ''; }
}
function _parseCsv(v) {
    return String(v || '')
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean);
}
function _load() {
    try { return _safeParse(sessionStorage.getItem(SS_KEY)) || null; } catch { return null; }
}
function _save(obj) {
    try { sessionStorage.setItem(SS_KEY, _safeStringify(obj)); } catch { }
}
function _clearField(field) {
    const cur = _load();
    if (!cur) return;

    const next = { ...cur };

    if (field === 'reggroups' || field === 'regconferences') next[field] = [];
    else next[field] = '';

    const empty =
        !next.server &&
        !next.conference &&
        (!next.reggroups || next.reggroups.length === 0) &&
        (!next.regconferences || next.regconferences.length === 0);

    try {
        if (empty) sessionStorage.removeItem(SS_KEY);
        else _save(next);
    } catch { }
}

export class UrlBoot {
    /**
     * Забирает параметры из URL -> sessionStorage и чистит URL.
     * Вызывать 1 раз на старте (до bootstrap/autologin).
     *
     * @param {{ redirect?: boolean }} opts
     *   redirect=true  -> location.replace(cleanUrl) (перезагрузка)
     *   redirect=false -> history.replaceState(...)  (без перезагрузки) [по умолчанию]
     */
    static stashFromUrlAndCleanUrl(opts = {}) {
        const u = new URL(window.location.href);
        const sp = u.searchParams;

        // если параметров нет — ничего не делаем
        if (!sp || [...sp.keys()].length === 0) return;

        const payload = {
            server: normalizeServer(sp.get('server') || sp.get('s') || ''),            // чистый host
            conference: (sp.get('conference') || sp.get('c') || '').trim(),            // tag
            reggroups: _parseCsv(sp.get('reggroups') || sp.get('rg') || ''),           // ["main","buh"]
            regconferences: _parseCsv(sp.get('regconferences') || sp.get('rc') || ''), // ["default","show"]
        };

        const hasAny =
            !!payload.server ||
            !!payload.conference ||
            (payload.reggroups && payload.reggroups.length) ||
            (payload.regconferences && payload.regconferences.length);

        if (hasAny) _save(payload);

        // чистим URL: оставляем path + hash
        u.search = '';
        const cleanUrl = u.toString();

        if (opts.redirect) {
            // жёстко: перезагрузка, зато “как редирект”
            window.location.replace(cleanUrl);
        } else {
            // мягко: без перезагрузки, URL чистый
            history.replaceState(null, '', cleanUrl);
        }
    }

    // --- server ---
    static getBootServer() {
        const o = _load();
        return (o?.server || '').trim();
    }
    static clearBootServer() { _clearField('server'); }

    // --- conference ---
    static getBootConference() {
        const o = _load();
        return (o?.conference || '').trim();
    }
    static clearBootConference() { _clearField('conference'); }

    // --- reggroups ---
    static getBootRegGroups() {
        const o = _load();
        return Array.isArray(o?.reggroups) ? [...o.reggroups] : [];
    }
    static clearBootRegGroups() { _clearField('reggroups'); }

    // --- regconferences ---
    static getBootRegConferences() {
        const o = _load();
        return Array.isArray(o?.regconferences) ? [...o.regconferences] : [];
    }
    static clearBootRegConferences() { _clearField('regconferences'); }
}

