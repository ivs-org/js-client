/**
 * control_ws.js - Protocol controller
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { showModal, showError } from '../ui/modal.js';
import { Storage } from '../data/storage.js';
import { MemberList } from '../data/member_list.js';
import { MessagesStorage } from '../data/messages_storage.js';
import { setState, appState } from '../core/app_state.js';

function saveCredsToStorage(server, login, pass, autoLogin) {
    try {
        const obj = { server, login, pass, autoLogin: !!autoLogin };
        localStorage.setItem('vg_client', JSON.stringify(obj));
    } catch (e) {
        console.warn('saveCredsToStorage failed', e);
    }
}

function bumpUnreadCounts(newMsgs) {
    if (!Array.isArray(newMsgs) || !newMsgs.length) return;

    const selfId = appState.user?.id;
    if (!selfId) return;

    const activeType = appState.activeContactType;
    const activeId = appState.activeContactId;
    const activeTag = appState.activeConferenceTag;

    // агрегируем, чтобы не писать в IndexedDB по 100 раз подряд
    const dmDelta = new Map();   // memberId -> count
    const confDelta = new Map(); // confId -> count

    for (const m of newMsgs) {
        // считаем unread только для входящих
        if ((m.author_id ?? 0) === selfId) continue;

        const ck = m.chatKey || '';
        if (ck.startsWith('dm:')) {
            const otherId = Number(ck.slice(3));
            if (!otherId) continue;

            if (activeType === 'member' && activeId === otherId) continue;

            dmDelta.set(otherId, (dmDelta.get(otherId) || 0) + 1);
            continue;
        }

        if (ck.startsWith('conf:')) {
            const tag = ck.slice(5);
            if (activeType === 'conference' && activeTag === tag) continue;

            const confId = Storage.getConferenceIdByTag(tag);
            if (!confId) continue;

            confDelta.set(confId, (confDelta.get(confId) || 0) + 1);
        }
    }

    // применяем дельты
    for (const [id, d] of dmDelta) {
        Storage.incrementMemberUnread(id, d).catch(() => { });
    }
    for (const [id, d] of confDelta) {
        Storage.incrementConferenceUnread(id, d).catch(() => { });
    }
}

export class ControlWS {
    constructor({
        server,
        login,
        password,
        autoReconnect = true,
    }) {
        // Реестр обработчиков событий
        this._handlers = {};

        this.client_id = 0;

        this.server = server;
        this.login = login;
        this.password = password;
        this.autoReconnect = !!autoReconnect;

        this.authToken = null;
        this.ws = null;

        // stores
        this.currentConference = null;

        // backoff state
        this._closing = false;     // безопасное закрытие
        this._retry = 0;           // счётчик попыток
        this._reconnectTimer = null;

        this._connect();
    }

    on(eventName, handler) {
        if (!this._handlers[eventName]) {
            this._handlers[eventName] = new Set();
        }
        this._handlers[eventName].add(handler);
        return () => this.off(eventName, handler);
    }

    off(eventName, handler) {
        const set = this._handlers[eventName];
        if (!set) return;
        set.delete(handler);
        if (!set.size) {
            delete this._handlers[eventName];
        }
    }

    _emit(eventName, payload) {
        const set = this._handlers[eventName];
        if (!set) return;
        for (const fn of set) {
            try {
                fn(payload);
            } catch (e) {
                console.error('ControlWS handler error for', eventName, e);
            }
        }
    }

    getClientId() {
        return this.client_id;
    }

    getCurrentConference() {
        return this.currentConference;
    }

    _scheduleReconnect() {
        if (!this.autoReconnect || this._closing) return;
        const base = 500; // ms
        const max = 8000;
        const jitter = Math.floor(Math.random() * 250);
        const delay = Math.min(max, base * Math.pow(2, this._retry)) + jitter;
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            this._connect();
        }, delay);
        this._retry++;
        console.log(`[control] reconnect in ${delay} ms (attempt ${this._retry})`);
    }

    _connect() {
        // защита от двойного коннекта
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        this._closing = false;

        this.ws = new WebSocket(this.server);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            this._retry = 0; // сбросить бэкофф
            console.log('control ws open, sending connect_request');
            this._send({ connect_request: { login: this.login, password: this.password, client_version: 1000 } });
        };

        this.ws.onmessage = async (ev) => {
            if (ev.data instanceof ArrayBuffer) return;
            
            const txt = typeof ev.data === 'string' ? ev.data : await ev.data.text();
            let msg; try { msg = JSON.parse(txt); } catch { }

            console.log(txt);

            if (txt.includes('ping')) {
                this._send({ ping: {} });
                this._emit('ping');
                return;
            }

            if (txt.includes('disconnect_from_conference')) {
                this._emit('disconnectFromConference');
                return;
            }

            if (msg.connect_response) {
                const r = msg.connect_response.result;
                switch (r) {
                    case 1:
                        this.authToken = msg.connect_response.access_token || null;
                        this.client_id = msg.connect_response.id;
                        saveCredsToStorage(this.server, this.login, this.password, true);
                        this._emit('auth', this.authToken);
                        let currentConf = localStorage.getItem('vg_current_conf');
                        if (currentConf) this.sendConnectToConference(currentConf);
                        break;
                    case 2: showError('Неверный логин или пароль'); break;
                    case 3: showError('Версия клиента устарела'); break;
                    case 4: showError('Перенаправление'); break;
                    case 5: showError('Закончились слоты подключения к серверу'); break;
                    case 6: showError('Внутренняя ошибка сервера'); break;
                    case 7: showError('IP забанен по причине частых неверных попыток входа'); break;
                    default: showError('Unknown connect_response: ' + r);
                }
                return;
            }

            if (msg.connect_to_conference_response) {
                this.currentConference = msg.connect_to_conference_response;
                this._emit('connectToConferenceResponse', msg.connect_to_conference_response);
                return;
            }

            if (msg.device_connect) {
                this.onDeviceConnected && this.onDeviceConnected(msg.device_connect);
                this._emit('deviceConnected', msg.device_connect);
                return;
            }

            if (msg.device_disconnect) {
                this._emit('deviceDisconnect', msg.device_disconnect);
                return;
            }

            if (msg.device_params) {
                this._emit('deviceParams', msg.device_params);
                return;
            }

            // Group list
            if (msg.group_list) {
                Storage.applyGroupList(msg.group_list || []).catch(err =>
                    console.warn('[Storage] applyGroupList failed', err)
                );
                setState({ lastSyncAt: Date.now() });
                return;
            }

            // Contact list
            if (msg.contact_list) {
                Storage.applyContactList(msg.contact_list || []).catch(err =>
                    console.warn('[Storage] applyContactList failed', err)
                );
                setState({ lastSyncAt: Date.now() });
                return;
            }

            if (msg.change_contact_state) {
                const { id, state } = msg.change_contact_state;

                Storage.updateMember(id, { state })
                    .catch((e) => console.warn('[Storage] updateMember(state) failed', e));

                setState({ lastSyncAt: Date.now() });
                return;
            }

            if (msg.change_member_state) {
                MemberList.updateStates(msg.change_member_state);
                setState({ lastSyncAt: Date.now() });
                return;
            }

            // Conferences list
            if (msg.conferences_list) {
                Storage.applyConferencesList(msg.conferences_list || []).catch(err =>
                    console.warn('[Storage] applyConferencesList failed', err)
                );
                setState({ lastSyncAt: Date.now() });
                return;
            }

            // Chat
            if (msg.delivery_messages) {
                try {
                    const newMsgs = await MessagesStorage.applyDeliveryMessages(msg.delivery_messages);
                    bumpUnreadCounts(newMsgs);
                    if (newMsgs?.length) {
                        this._emit('new_message', newMsgs);
                    }
                } catch (e) {
                    console.warn('[MessagesStorage] applyDeliveryMessages failed', e);
                }
                return;
            }
        };

        this.ws.onclose = (e) => {
            console.log('control ws closed', e.code, e.reason);
            this._emit('close');
            if (!this._closing) this._scheduleReconnect();
        };

        this.ws.onerror = (e) => {
            this._emit('error', e);
            try { this.ws && this.ws.close(); } catch { }
        };
    }

    sendCreatedDevice(payload) { this._send({ device_connect: payload }); }

    sendDeviceParamsMic({ name = 'Microphone' }) {
        const msg = {
            device_params: {
                id: 0, ssrc: 0,
                device_type: 4,
                ord: 0,
                name,
                metadata: "",
                resolution: 0,
                color_space: 0
            }
        };
        this._send(msg);
    }

    sendDeviceParamsCam({ name = 'Camera', resolution }) {
        const msg = {
            device_params: {
                id: 0, ssrc: 0,
                device_type: 1,
                ord: 0,
                name,
                metadata: "",
                resolution,
                color_space: 0
            }
        };
        this._send(msg);
    }

    sendDeviceParamsScr({ name = 'ScreenCapture', resolution }) {
        const msg = {
            device_params: {
                id: 0, ssrc: 0,
                device_type: 2,
                ord: 0,
                name,
                metadata: "",
                resolution,
                color_space: 0
            }
        };
        this._send(msg);
    }

    sendDisconnectDevice(device_id) {
        this._send({ device_disconnect: { device_id } });
    }

    sendDisconnectRenderer(device_id, ssrc = 0) {
        this._send({ renderer_disconnect: { device_id, ssrc } });
    }

    sendConnectToConference(tag) {
        this._send({ connect_to_conference_request: { tag } });
    }

    sendDisconnectFromConference() {
        this._send({ disconnect_from_conference: {} });
        this.currentConference = null;
    }

    _send(obj) { try { this.ws && this.ws.send(JSON.stringify(obj)); } catch (e) { console.warn('send failed', e); } }

    loadMessages() {
        const from = MessagesStorage.getLastMessageDt() || 0;
        const payload = { from };
        this._send({ load_messages: payload });
    }

    // безопасное отключение (останавливаем автореконнект)
    disconnect(code = 1000, reason = 'client stop') {
        this._closing = true;
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
        if (this.ws) {
            const ws = this.ws;
            this.ws = null;
            try { ws.close(code, reason); } catch { }
        }
    }
}
