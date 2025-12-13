// src/ui/buttons_panel.js
import { setState, appState } from '../../core/app_state.js';

export function isMobileLayout() {
    return appState.layoutMode === 'mobile';
}

export function renderButtonsPanel(root, state) {
    if (!root) return;

    const inCall = !!state.activeCall;
    const camOn = !!state.camEnabled;
    const demoOn = !!state.demoEnabled;
    const micOn = !!state.micEnabled;

    const showContacts = state.showContactsPanel !== false;
    const showChat = !!state.showChatPanel;

    const callHint = inCall
        ? 'Отключиться от конференции'
        : 'Подключиться к конференции';
    const camHint = camOn ? 'Выключить камеру' : 'Включить камеру';
    const demoHint = demoOn ? 'Выключить показ экрана' : 'Включить показ экрана';
    const micHint = micOn ? 'Выключить микрофон' : 'Включить микрофон';
    const contactsHint = showContacts
        ? 'Скрыть список контактов'
        : 'Показать список контактов';
    const chatHint = showChat ? 'Скрыть чат' : 'Показать чат';

    const callIcon = inCall ? '📴' : '📞';
    const camIcon = camOn ? '📷' : '📷';//'🚫';
    const demoIcon = demoOn ? '🖥️' : '🖥️';
    const micIcon = micOn ? '🎙️' : '🔇';
    const contactsIcon = '👥';
    const chatIcon = '💬';

    root.innerHTML = `
      <div class="buttons-panel">
        <div class="buttons-panel-main">
          <button
            type="button"
            class="btn-icon ${inCall ? 'active' : ''}"
            id="btnToggleCall"
            title="${callHint}"
            aria-label="${callHint}"
          >
            <span class="btn-icon-inner">${callIcon}</span>
          </button>
          <button
            type="button"
            class="btn-icon ${camOn ? 'active' : ''}"
            id="btnToggleCam"
            title="${camHint}"
            aria-label="${camHint}"
          >
            <span class="btn-icon-inner">${camIcon}</span>
          </button>
          <button
            type="button"
            class="btn-icon ${demoOn ? 'active' : ''}"
            id="btnToggleDemo"
            title="${demoHint}"
            aria-label="${demoHint}"
          >
            <span class="btn-icon-inner">${demoIcon}</span>
          </button>
          <button
            type="button"
            class="btn-icon ${micOn ? 'active' : ''}"
            id="btnToggleMic"
            title="${micHint}"
            aria-label="${micHint}"
          >
            <span class="btn-icon-inner">${micIcon}</span>
          </button>
        </div>

        <div class="buttons-panel-layout">
          <button
            type="button"
            class="btn-icon small ${showContacts ? 'active' : ''}"
            id="btnToggleContacts"
            title="${contactsHint}"
            aria-label="${contactsHint}"
          >
            <span class="btn-icon-inner">${contactsIcon}</span>
          </button>
          <button
            type="button"
            class="btn-icon small ${showChat ? 'active' : ''}"
            id="btnToggleChat"
            title="${chatHint}"
            aria-label="${chatHint}"
          >
            <span class="btn-icon-inner">${chatIcon}</span>
          </button>
        </div>
      </div>
    `;

    const btnContacts = root.querySelector('#btnToggleContacts');
    const btnChat = root.querySelector('#btnToggleChat');

    if (btnContacts) {
        btnContacts.onclick = () => {
            const mobile = isMobileLayout();
            const inCallNow = !!appState.activeCall;
            const showContactsNow = appState.showContactsPanel !== false;
            const showChatNow = !!appState.showChatPanel;

            if (mobile && inCallNow) {
                // мобилка + звонок: контакты/чат как оверлеи, только один за раз
                const nextShowContacts = !showContactsNow;
                setState({
                    showContactsPanel: nextShowContacts,
                    showChatPanel: false,
                });
            } else {
                // десктоп: просто скрыть/показать левую панель
                setState({
                    showContactsPanel: !showContactsNow,
                });
            }
        };
    }

    if (btnChat) {
        btnChat.onclick = () => {
            const mobile = isMobileLayout();
            const inCallNow = !!appState.activeCall;
            const showChatNow = !!appState.showChatPanel;
            const showContactsNow = appState.showContactsPanel !== false;

            if (mobile && inCallNow) {
                const nextShowChat = !showChatNow;
                setState({
                    showChatPanel: nextShowChat,
                    showContactsPanel: false,
                });
            } else {
                setState({
                    showChatPanel: !showChatNow,
                });
            }
        };
    }

    // call/cam/mic по-прежнему обрабатываются в app.js делегированием по id
}
