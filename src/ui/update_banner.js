// src/ui/update_banner.js

import { appState, setState } from '../core/app_state.js';
import { applyUpdateNow, dismissUpdateBanner } from '../core/version_watch.js';
import { CLIENT_VERSION } from '../core/build_info.js';

export function renderUpdateBanner(state) {
    const host = document.getElementById('updateBannerHost');
    if (!host) return;

    const u = (state?.update ?? appState.update) || {};
    const visible = !!(u.available && !u.dismissed && u.latest && u.latest !== CLIENT_VERSION);

    if (!visible) {
        host.innerHTML = '';
        host.classList.add('hidden');
        return;
    }

    host.classList.remove('hidden');
    host.innerHTML = `
    <div class="update-banner">
      <div class="update-banner__text">
        Доступна новая версия <b>${escapeHtml(u.latest)}</b>
        <span class="update-banner__muted"> (у вас ${escapeHtml(CLIENT_VERSION)})</span>
      </div>
      <div class="update-banner__actions">
        <button type="button" class="btn btn-primary" data-act="update-now">Обновить</button>
        <button type="button" class="btn btn-ghost" data-act="update-later">Позже</button>
      </div>
    </div>
  `;
}

export function wireUpdateBanner(root) {
    // делегирование: клики будут работать даже если innerHTML баннера перерисовывается
    root.addEventListener('click', async (e) => {
        const btn = e.target?.closest?.('[data-act]');
        if (!btn) return;

        const act = btn.getAttribute('data-act');
        if (act === 'update-now') {
            await applyUpdateNow();
            return;
        }
        if (act === 'update-later') {
            dismissUpdateBanner();
            // setState дернет renderMain -> renderUpdateBanner -> баннер исчезнет
            return;
        }
    });
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
