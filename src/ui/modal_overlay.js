// src/ui/modal_overlay.js
import { appState, setState } from '../core/app_state.js';
import { _resolveModal } from './modal.js';

function esc(s) {
    return String(s ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
        .replaceAll("'", "&#039;");
}

export function renderModalOverlay(root, state) {
    if (!root) return;

    const m = state.modal || { open: false };
    if (!m.open) {
        root.innerHTML = '';
        return;
    }

    const avatar = m.avatarUrl
        ? `<img class="app-modal-avatar-img" src="${esc(m.avatarUrl)}" alt="">`
        : `<div class="app-modal-avatar-letter">${esc(m.avatarLetter || '?')}</div>`;

    root.innerHTML = `
    <div class="app-modal ${esc(m.variant || 'info')}">
      <div class="app-modal-backdrop" data-action="modal:cancel"></div>

      <div class="app-modal-dialog" role="dialog" aria-modal="true">
        <div class="app-modal-head">
          <div class="app-modal-avatar">${avatar}</div>
          <div class="app-modal-headtext">
            <div class="app-modal-title">${esc(m.title)}</div>
          </div>
          <button class="app-modal-x" data-action="modal:cancel" aria-label="Закрыть">✕</button>
        </div>

        <div class="app-modal-body">${esc(m.message)}</div>

        <div class="app-modal-actions">
          ${m.showCancel ? `<button class="secondary" data-action="modal:cancel">${esc(m.cancelText || 'Нет')}</button>` : ''}
          <button class="primary" data-action="modal:ok">${esc(m.okText || 'OK')}</button>
        </div>
      </div>
    </div>
  `;

    // делегирование
    if (!root.dataset.bound) {
        root.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const a = el.dataset.action;

            if (a === 'modal:ok') {
                _resolveModal(true);
                setState({ modal: { ...appState.modal, open: false } });
            } else if (a === 'modal:cancel') {
                _resolveModal(false);
                setState({ modal: { ...appState.modal, open: false } });
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!appState.modal?.open) return;
            if (e.key === 'Escape') {
                _resolveModal(false);
                setState({ modal: { ...appState.modal, open: false } });
            }
        });

        root.dataset.bound = '1';
    }
}
