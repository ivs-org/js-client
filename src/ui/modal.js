/**
 * modal.js - Modal dialog
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

export function showModal(title, message) {
    // модалка
    const modalEl = document.getElementById('appModal');
    const modalTitleEl = document.getElementById('appModalTitle');
    const modalBodyEl = document.getElementById('appModalBody');
    const modalOkBtn = document.getElementById('appModalOk');

    modalTitleEl.textContent = title || 'Сообщение';
    modalBodyEl.textContent = message || '';
    modalEl.classList.remove('hidden');

    const handler = () => {
        modalEl.classList.add('hidden');
        modalOkBtn.removeEventListener('click', handler);
    };
    modalOkBtn.addEventListener('click', handler, { once: true });
}

export function showError(message) {
    showModal('Ошибка', message);
}
