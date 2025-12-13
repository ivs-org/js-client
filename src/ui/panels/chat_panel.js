// src/ui/panels/chat_panel.js

import { Storage } from '../../data/storage.js';
import { appState, setState } from '../../core/app_state.js';
import { MessagesStorage } from '../../data/messages_storage.js';
import { isMobileLayout } from '../panels/buttons_panel.js';

const CHAT_PAGE_SIZE = 20;

let lastChatKey = null;
const lastRenderedCountByChatKey = new Map();

function getVisibleMessagesForChat(chatKey, allMessages, state) {
    const total = allMessages.length;
    if (!total) return [];

    const win = (state.chatWindow && state.chatWindow[chatKey]) || {};
    const currentLimit = win.limit || CHAT_PAGE_SIZE;

    const limit = Math.min(currentLimit, total);
    // Показываем последние `limit` сообщений
    return allMessages.slice(total - limit);
}

function isAtBottom(listEl, tolerancePx = 16) {
    const scrollBottom = listEl.scrollHeight - listEl.clientHeight - listEl.scrollTop;
    return scrollBottom <= tolerancePx;
}

function scrollToBottom(listEl) {
    if (!listEl) return;
    requestAnimationFrame(() => {
        const maxScroll = listEl.scrollHeight - listEl.clientHeight;
        if (maxScroll > 0) {
            listEl.scrollTop = maxScroll;
        }
    });
}

export function renderChatPanel(root, state) {
    if (!root) return;

    const chatKey = getActiveChatKey(state);
    const selfId = state.user && state.user.id;
    const allMessages = chatKey
        ? (MessagesStorage.getMessagesForChat(chatKey) || [])
        : [];

    const chatChanged = chatKey !== lastChatKey;

    const title = escapeHtml(getChatTitle(state) || '');

    let headerHtml = `
      <div class="chat-header">
        <span class="chat-title">${title}</span>
        <button
          type="button"
          class="panel-close-btn"
          title="Закрыть панель"
        >✕</button>
      </div>
    `;

    // 1) Если чата нет — просто показываем пустую панель
    if (!chatKey) {
        root.innerHTML = `
        <div class="chat-panel">
            ${headerHtml}
            <div class="chat-messages">
                Нет сообщений
            </div>
            <div class="chat-input-row">
                <textarea class="chat-input" rows="1"></textarea>
                <button class="chat-send-btn">⮞</button>
            </div>
        </div>
        `;
        lastChatKey = chatKey;
        lastRenderedCountByChatKey.set(chatKey, 0);
        attachChatHandlers(root, state, chatKey);
        return;
    }

    // 2) Если чат сменился — ПОЛНАЯ перерисовка + скролл вниз
    if (chatChanged || !root.querySelector('.chat-messages')) {
        const rowsHtml = allMessages
            .map(m => renderMessageRow(m, selfId))
            .join('');

        root.innerHTML = `
        <div class="chat-panel">
            ${headerHtml}
            <div class="chat-messages">
                ${rowsHtml}
            </div>
            <div class="chat-input-row">
                <textarea class="chat-input" rows="1"></textarea>
                <button class="chat-send-btn">⮞</button>
            </div>
        </div>
        `;

        attachChatHandlers(root, state, chatKey);

        const listEl = root.querySelector('.chat-messages');
        scrollToBottom(listEl);

        lastChatKey = chatKey;
        lastRenderedCountByChatKey.set(chatKey, allMessages.length);
        return;
    }

    // 3) Тот же чат — работаем ИНКРЕМЕНТАЛЬНО
    const listEl = root.querySelector('.chat-messages');
    if (!listEl) {
        // на всякий случай фулл-рендер, если что-то развалилось
        lastChatKey = null;
        return renderChatPanel(root, state);
    }

    const prevCount = lastRenderedCountByChatKey.get(chatKey) ?? 0;

    // сообщений не прибавилось — вообще ничего не делаем
    if (allMessages.length <= prevCount) {
        lastRenderedCountByChatKey.set(chatKey, allMessages.length);
        return;
    }

    const wasBottom = isAtBottom(listEl);

    const newMessages = allMessages.slice(prevCount);

    // аккуратно дописываем только новые сообщения
    for (const m of newMessages) {
        const rowHtml = renderMessageRow(m, selfId);
        listEl.insertAdjacentHTML('beforeend', rowHtml);
    }

    lastRenderedCountByChatKey.set(chatKey, allMessages.length);

    // если пользователь был внизу — держим его внизу
    if (wasBottom) {
        scrollToBottom(listEl);
    }
}


// ---------- вычисление chatKey ----------

// Для конфы:  "conf:<tag>"
// Для лички:  "dm:<min(selfId,memberId)>:<max(...)>"
function getActiveChatKey(state) {
    const { activeContactType, activeContactId, activeConferenceTag, user } = state;

    if (activeContactType === 'conference' && activeConferenceTag) {
        return `conf:${activeConferenceTag}`;
    }

    if (activeContactType === 'member' && activeContactId) {
        return `dm:${activeContactId}`;
    }

    return null;
}

function getChatTitle(state) {
    const { activeContactType, activeContactId, activeConferenceTag } = state;

    if (activeContactType === 'conference') {
        const conf = Storage.getConference(activeContactId);
        return conf && conf.name
            ? conf.name
            : activeConferenceTag
                ? `Конференция ${activeConferenceTag}`
                : 'Конференция';
    }

    if (activeContactType === 'member') {
        const member = Storage.getMember(activeContactId);
        if (!member) return 'Чат';
        return member.name || member.login || `ID ${member.id}`;
    }

    return 'Чат';
}

// ---------- рендер сообщений ----------

function renderMessageRow(msg, selfId) {
    const isMe = selfId &&
        (msg.author_id === selfId || msg.sender_id === selfId);

    const payload = parsePayload(msg.text);
    const mainText = payload.message || '';
    const replyBlock = payload.type === 'reply'
        ? renderReplyBlock(payload)
        : '';

    const timeStr = formatTimeFromUnix(msg.dt);

    const authorName = isMe
        ? 'Вы'
        : (msg.author_name || msg.sender_name || '');

    return `
      <div class="chat-message ${isMe ? 'me' : 'other'}">
        <div class="chat-message-meta">
          <span class="chat-author">${escapeHtml(authorName)}</span>
          <span class="chat-time">${timeStr}</span>
        </div>
        ${replyBlock}
        <div class="chat-text">
          ${escapeHtml(mainText)}
        </div>
      </div>
    `;
}

function renderReplyBlock(payload) {
    const author = payload.author_name || '';
    const text = payload.reply_text || '';

    return `
      <div class="chat-reply-block">
        <div class="chat-reply-author">${escapeHtml(author)}</div>
        <div class="chat-reply-text">${escapeHtml(text)}</div>
      </div>
    `;
}

function parsePayload(text) {
    if (!text) return { type: 'raw', message: '' };
    try {
        const obj = JSON.parse(text);
        // simple: { type: "simple", message: "..." }
        if (obj && typeof obj === 'object') {
            if (obj.type === 'simple') {
                return { type: 'simple', message: obj.message || '' };
            }
            if (obj.type === 'reply') {
                return {
                    type: 'reply',
                    guid: obj.guid,
                    author_id: obj.author_id,
                    author_name: obj.author_name,
                    dt: obj.dt,
                    reply_text: obj.reply_text || '',
                    message: obj.message || '',
                };
            }
        }
        // fallback
        return { type: 'raw', message: text };
    } catch {
        return { type: 'raw', message: text };
    }
}

// ---------- отправка ----------

function attachChatHandlers(root, state, chatKey) {
    // Закрытие панели
    const closeBtn = root.querySelector('.panel-close-btn');
    if (closeBtn) closeBtn.onclick = () => {
        setState({
            showChatPanel: false,
        });
        return;
    }

    const input = root.querySelector('.chat-input');
    const sendBtn = root.querySelector('.chat-send-btn');
    const listEl = root.querySelector('.chat-messages');

    if (!input || !sendBtn) return;

    const send = () => {
        const text = input.value.trim();
        if (!text) return;
        sendMessage(state, chatKey, text);
        input.value = '';
    };

    sendBtn.onclick = () => send();

    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            send();
        }
    });

    // Локальная пагинация: домотали вверх — раскрываем ещё 20 из локального стора
    listEl.addEventListener('scroll', () => {
        if (listEl.scrollTop > 0) return;

        const all = MessagesStorage.getMessagesForChat(chatKey) || [];
        const total = all.length;
        if (!total) return;

        const win = (appState.chatWindow && appState.chatWindow[chatKey]) || {};
        const currentLimit = win.limit || CHAT_PAGE_SIZE;
        if (currentLimit >= total) return;

        const nextLimit = Math.min(currentLimit + CHAT_PAGE_SIZE, total);

        setState({
            chatWindow: {
                ...(appState.chatWindow || {}),
                [chatKey]: { limit: nextLimit },
            },
        });
    });
}

function sendMessage(state, chatKey, text) {
    const user = state.user;
    if (!user || !user.id) {
        console.warn('[chat] no user.id, cannot send');
        return;
    }

    const selfId = user.id;
    const selfName = user.name || user.login || '';

    const { activeContactType, activeContactId, activeConferenceTag } = state;

    let msg = null;

    const nowSec = Math.floor(Date.now() / 1000);
    const guid = generateGuid();

    if (activeContactType === 'conference') {
        const conf = Storage.getConference(activeContactId);
        if (!conf || !activeConferenceTag) return;

        msg = buildTextMessage({
            guid,
            dt: nowSec,
            author_id: selfId,
            author_name: selfName,
            sender_id: selfId,
            sender_name: selfName,
            subscriber_id: 0,
            subscriber_name: '',
            conference_tag: activeConferenceTag,
            conference_name: conf.name || '',
            textPayload: text,
        });
    } else if (activeContactType === 'member') {
        const member = Storage.getMember(activeContactId);
        if (!member) return;

        msg = buildTextMessage({
            guid,
            dt: nowSec,
            author_id: selfId,
            author_name: selfName,
            sender_id: selfId,
            sender_name: selfName,
            subscriber_id: member.id,
            subscriber_name: member.name || member.login || '',
            conference_tag: '',
            conference_name: '',
            textPayload: text,
        });
    } else {
        return;
    }

    // локально в стор
    MessagesStorage.applyDeliveryMessages([msg]);

    // отправка на сервер — тут тебе нужно подставить свою обвязку ControlWS
    try {
        const ctrl = window.ctrl;
        const payload = { delivery_messages: [msg] };

        if (ctrl) {
            ctrl._send(payload);
        } else {
            console.warn('[chat] ctrl.send* not found, message not sent to server');
        }
    } catch (e) {
        console.warn('[chat] send failed', e);
    }
}

function buildTextMessage({
    guid,
    dt,
    author_id,
    author_name,
    sender_id,
    sender_name,
    subscriber_id,
    subscriber_name,
    conference_tag,
    conference_name,
    textPayload,
}) {
    const payload = {
        type: 'simple',
        message: textPayload,
    };

    return {
        guid,
        dt,
        type: 1,                 // MessageType::TextMessage
        author_id,
        author_name,
        sender_id,
        sender_name,
        subscriber_id,
        subscriber_name,
        conference_tag,
        conference_name,
        status: 1,               // MessageStatus::Created
        text: JSON.stringify(payload),
        call_duration: 0,
        call_result: 0,
    };
}

function generateGuid() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'm-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// ---------- утилиты ----------

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTimeFromUnix(sec) {
    if (!sec) return '';
    try {
        const d = new Date(sec * 1000);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    } catch {
        return '';
    }
}
