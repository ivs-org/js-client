/**
 * modal.js - Modal dialog
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { setState } from '../core/app_state.js';

let _resolver = null;

export function _resolveModal(result) {
    if (_resolver) {
        const r = _resolver;
        _resolver = null;
        try { r(result); } catch { }
    }
}

export function showModal(opts) {
    // если уже висит модалка — закрываем предыдущую (чтобы не копить)
    _resolveModal(false);

    const o = opts || {};
    const modal = {
        open: true,
        variant: o.variant || 'info',
        title: o.title || '',
        message: o.message || '',
        okText: o.okText || 'OK',
        cancelText: o.cancelText || 'Нет',
        showCancel: !!o.showCancel,
        avatarUrl: o.avatarUrl || '',
        avatarLetter: o.avatarLetter || '',
    };

    setState({ modal });

    return new Promise((resolve) => {
        _resolver = resolve;
    });
}

export function showError(message) {
    return showModal({
        variant: 'error',
        title: 'Ошибка',
        message: message || '',
        okText: 'OK',
        showCancel: false,
    });
}

export function showOk(title, message) {
    return showModal({
        variant: 'success',
        title: title || 'Готово',
        message: message || '',
        okText: 'OK',
        showCancel: false,
    });
}

export function confirmDialog(opts) {
    return showModal({
        variant: 'confirm',
        title: opts?.title || 'Подтвердите',
        message: opts?.message || '',
        okText: opts?.okText || 'Да',
        cancelText: opts?.cancelText || 'Нет',
        showCancel: true,
        avatarUrl: opts?.avatarUrl || '',
        avatarLetter: opts?.avatarLetter || '',
    });
}
