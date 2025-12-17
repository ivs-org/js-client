// src/ui/layout.js
import { appState, subscribe } from '../core/app_state.js';
import { renderLoginView } from './login_view.js';
import { renderRegisterView } from './register_view.js';
import { renderTopbar } from './panels/top_panel.js';
import { renderContactsPanel } from './panels/contacts_panel.js';
import { renderChatPanel } from './panels/chat_panel.js';
import { renderCallPanel } from './panels/call_panel.js';
import { renderButtonsPanel } from './panels/buttons_panel.js';
import { renderSettingsPanel } from './panels/settings_panel.js';
import { renderModalOverlay } from './modal_overlay.js';

export function initLayout() {
    const root = document.getElementById('appRoot');
    if (!root) {
        console.error('[UI] appRoot not found');
        return;
    }

    subscribe((state) => render(root, state));
    render(root, appState);
}

export function updateCallLayout(state) {
    const main = document.querySelector('.app-main');
    const appRoot = document.querySelector('.app');
    if (!main || !appRoot) return;

    const inCall = !!state.activeCall;

    main.classList.toggle('in-call', inCall);
    main.classList.toggle('no-call', !inCall);

    appRoot.classList.toggle('in-call', inCall);
    appRoot.classList.toggle('no-call', !inCall);

    syncOverlayClasses(state);
}

function syncOverlayClasses(state) {
    const appRoot = document.querySelector('.app');
    if (!appRoot) return;

    const layoutMode = state.layoutMode || 'desktop';

    appRoot.classList.remove('contacts-open', 'chat-open', 'settings-open');

    if (layoutMode !== 'mobile') return;

    if (state.showSettingsPanel) {
        appRoot.classList.add('settings-open');
        return; // settings важнее, чем contacts/chat
    }

    if (state.showChatPanel) appRoot.classList.add('chat-open');
    if (state.showContactsPanel) appRoot.classList.add('contacts-open');
}

function render(root, state) {
    if (state.view === 'login') {
        root.removeAttribute('data-main-init');
        renderLoginView(root, state);
    } else if (state.view === 'register') {
        root.removeAttribute('data-main-init');
        renderRegisterView(root, state);
    } else {
        updateCallLayout(state);
        renderMain(root, state);
    }

    const overlayRoot = document.getElementById('overlayRoot');
    renderModalOverlay(overlayRoot, state);
}

function updateLocalPreview(state) {
    const streams = document.getElementById('streams');
    if (!streams) return;

    let localPreview = document.getElementById('localPreview');
    let demoPreview = document.getElementById('demoPreview');

    const hasCall = !!state.activeCall;
    if (!hasCall) {
        if (localPreview) localPreview.remove();
        if (demoPreview) demoPreview.remove();
        return;
    }

    // Если превью нет в DOM — создаём новый canvas

    const hasCam = !!state.camEnabled;
    if (hasCam) {
        if (!localPreview) {
            localPreview = document.createElement('canvas');
            localPreview.id = 'localPreview';
        }
        localPreview.classList.add('local-preview');
        localPreview.style.display = 'block';
        if (!streams.contains(localPreview)) {
            streams.prepend(localPreview);
        }
    } else if (!hasCam && localPreview) {
        localPreview.remove();
    }

    const hasDemo = !!state.demoEnabled;
    if (hasDemo) {
        if (!demoPreview) {
            demoPreview = document.createElement('canvas');
            demoPreview.id = 'demoPreview';
        }
        demoPreview.classList.add('local-preview');
        demoPreview.style.display = 'block';
        if (!streams.contains(demoPreview)) {
            streams.prepend(demoPreview);
        }
    } else if (!hasDemo && demoPreview) {
        demoPreview.remove();
    }
}

function renderMain(root, state) {
    // Skeleton основного layout создаём ОДИН раз,
    // потом только обновляем содержимое панелей
    if (!root.dataset.mainInit) {
        root.innerHTML = `
          <div class="app">
            <header class="app-topbar" id="appTopbar"></header>

            <div class="app-buttons" id="appButtons"></div>

            <main class="app-main" id="appMain">
              <section class="panel panel-left" id="panelContacts"></section>
              <section class="panel panel-center" id="panelCall">
                <div class="call-header"></div>
                <div class="call-body">
                  <div id="streams" class="call-streams"></div>
                  <div class="call-placeholder"></div>
                </div>
              </section>
              <section class="panel panel-right" id="panelChat"></section>
            </main>

            <div class="settings-overlay" id="panelSettings"></div>
          </div>
        `;
        root.dataset.mainInit = '1';
    }

    renderTopbar(state);

    const buttonsRoot = document.getElementById('appButtons');
    const contactsRoot = document.getElementById('panelContacts');
    const chatRoot = document.getElementById('panelChat');
    const callRoot = document.getElementById('panelCall');

    const settingsRoot = document.getElementById('panelSettings');
    renderSettingsPanel(settingsRoot, state);

    contactsRoot.classList.add('overlay-panel');
    chatRoot.classList.add('overlay-panel');

    renderButtonsPanel(buttonsRoot, state);

    if (contactsRoot) {
        contactsRoot.style.display = state.showContactsPanel ? '' : 'none';
    }
    if (chatRoot) {
        chatRoot.style.display = state.showChatPanel ? '' : 'none';
    }

    renderContactsPanel(contactsRoot, state);
    if (!!state.activeCall) {
        renderCallPanel(callRoot, state);
    }
    renderChatPanel(chatRoot, state);

    updateLocalPreview(state);
}
