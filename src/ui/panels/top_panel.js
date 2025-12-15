// src/ui/top_panel.js
import { appState, setState } from '../../core/app_state.js';
import { Storage } from '../../data/storage.js';

function getUserName(state) {
    if (!state.user) return '';
    return state.user.displayName || state.user.login || '';
}

// Пока делаем простой тайтл: можно потом углубиться через Storage
function getActiveChatTitle(state) {
    const { activeContactType, activeContactId, activeConferenceTag } = state;

    if (activeContactType === 'conference') {
        if (state.activeCall && state.activeCall.name) {
            return state.activeCall.name;
        }
        return activeConferenceTag || 'Конференция';
    }

    if (activeContactType === 'member') {
        const m = Storage.getMemberById?.(activeContactId);
        return (m && (m.name || m.login || m.number)) || `Контакт #${activeContactId}`;
    }

    return 'Чат';
}

function getAvatarLetter(title) {
    if (!title) return '?';
    return title.trim().charAt(0).toUpperCase();
}

function renderTopMenu(state) {
    const open = !!state.topMenuOpen;
    return `
    <div class="topbar-menu-wrap">
      <button type="button" class="topbar-menu-btn" id="btnTopMenu" aria-label="Меню">⋯</button>
      <div class="topbar-menu ${open ? 'open' : ''}" id="topbarMenu">
        <button class="topbar-menu-item" data-menu="open" data-section="general">Настройки</button>
        <button class="topbar-menu-item" data-menu="open" data-section="permissions">Разрешения</button>
        <button class="topbar-menu-item" data-menu="open" data-section="account">Аккаунт</button>
        <button class="topbar-menu-item" data-menu="open" data-section="connection">Подключение</button>
        <button class="topbar-menu-item" data-menu="open" data-section="recording">Запись</button>
        <div class="topbar-menu-sep"></div>
        <button class="topbar-menu-item" id="btnLogout">Выйти</button>
      </div>
    </div>
  `;
}

function renderBack(state) {
    return state.layoutMode === 'mobile' ?
    `<button
          type="button"
          class="topbar-back"
          id="topbarBackBtn"
          aria-label="Назад к контактам"
        >←</button>` : ``;
}

export function renderTopbar(state) {
    const el = document.getElementById('appTopbar');
    if (!el) return;

    const mobile = appState.layoutMode === 'mobile';

    const title = getActiveChatTitle(state);
    const avatarLetter = getAvatarLetter(title);

    let topbarClass = mobile ? 'topbar-mobile' : 'topbar-desktop';

    el.innerHTML = `
      <div class="${topbarClass}">
        ${renderBack(state)}

        <div class="topbar-chat-main">
          <div class="topbar-avatar">${avatarLetter}</div>
          <div class="topbar-chat-title" title="${title}">
            ${title}
          </div>
        </div>

        <div class="topbar-right">
          <button
            type="button"
            class="topbar-call"
            id="btnToggleCall"
            aria-label="Позвонить"
          >📞</button>
          <span class="topbar-sep"></span>
          ${renderTopMenu(state)}
        </div>
      </div>
    `;

    const inCall = !!state.activeCall;

    // Кнопка "Назад"
    const backBtn = document.getElementById('topbarBackBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            if (!mobile) return;

            if (!!state.topMenuOpen) {
                setState({ topMenuOpen: false });
            } else if (!!state.showSettingsPanel) {
                setState({ showSettingsPanel: false });
            } else if (!!state.showChatPanel) {
                setState({
                    showChatPanel: false,
                    showContactsPanel: true,
                });
            } else if (!!state.showContactsPanel) {
                if (!!inCall) {
                    setState({
                        showChatPanel: false,
                        showContactsPanel: false,
                    });
                }
            }
        };
    }

    const btnMenu = document.getElementById('btnTopMenu');
    if (btnMenu) {
        btnMenu.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setState({ topMenuOpen: !appState.topMenuOpen });
        };
    }

    const menu = document.getElementById('topbarMenu');
    if (menu) {
        menu.onclick = (e) => {
            const item = e.target.closest('[data-menu="open"]');
            if (!item) return;
            const sec = item.dataset.section || 'general';
            setState({
                topMenuOpen: false,
                showSettingsPanel: true,
                settingsSection: sec,
            });
        };
    }
}
