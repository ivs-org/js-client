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

export function renderTopbar(state) {
    const el = document.getElementById('appTopbar');
    if (!el) return;

    const mobile = appState.layoutMode === 'mobile';
    const inCall = !!state.activeCall;
    const chatOpen = true;// !!appEl?.classList.contains('chat-open');
    // contactsOpen можно использовать, если нужно
    // const contactsOpen = !!appEl?.classList.contains('contacts-open');

    // === DESKTOP или режим звонка: показываем старый topbar ===
    /*if (!mobile || inCall) {
        let callTitle;

        if (state.online) {
            callTitle = state.activeCall
                ? 'ВКС: ' + (state.activeCall.name || state.activeCall.tag)
                : 'Нет активного звонка';
        } else {
            callTitle = 'Нет подключения к серверу';
        }

        const userName = getUserName(state);

        el.innerHTML = `
          <div class="topbar-desktop">
            <div class="topbar-left">VideoGrace Web</div>
            <div class="topbar-center">${callTitle}</div>
            <div class="topbar-right">
              <span class="topbar-user">${userName}</span>
              <button id="btnOpenSettings">⚙</button>
              <button id="btnLogout">Выйти</button>
            </div>
          </div>
        `;
        return;
    }*/

    // === МОБИЛКА + НЕТ ЗВОНКА: режим мессенджера ===

    // 1) Экран контактов (chat не открыт)
    if (!chatOpen) {
        const userName = getUserName(state);

        el.innerHTML = `
          <div class="topbar-mobile topbar-contacts">
            <div class="topbar-left">
              <span class="topbar-app-title">VideoGrace</span>
            </div>
            <div class="topbar-center">
              <span class="topbar-section">Контакты</span>
            </div>
            <div class="topbar-right">
              <span class="topbar-user">${userName}</span>
              <button id="btnOpenSettings">⚙</button>
              <button id="btnLogout">⎋</button>
            </div>
          </div>
        `;
        return;
    }

    // 2) Экран чата
    const title = getActiveChatTitle(state);
    const avatarLetter = getAvatarLetter(title);

    el.innerHTML = `
      <div class="topbar-mobile topbar-chat">
        <button
          type="button"
          class="topbar-back"
          id="topbarBackBtn"
          aria-label="Назад к контактам"
        >←</button>

        <div class="topbar-chat-main">
          <div class="topbar-avatar">${avatarLetter}</div>
          <div class="topbar-chat-title" title="${title}">
            ${title}
          </div>
        </div>

        <button
          type="button"
          class="topbar-call"
          id="btnToggleCall"
          aria-label="Позвонить"
        >📞</button>
        |
        <button
          type="button"
          id="btnLogout"
          aria-label="Выход из системы"
        >⎋</button>
      </div>
    `;

    // Кнопка "Назад"
    const backBtn = document.getElementById('topbarBackBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            if (!mobile) return;
            if (!!state.showChatPanel) {
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
}
