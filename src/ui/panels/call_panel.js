// src/ui/panels/call_panel.js
export function renderCallPanel(root, state) {
    if (!root) return;

    const hasCall = !!state.activeCall;
    const title = hasCall ? 'Видеоконференция' : 'Нет активного звонка';

    // ищем глобальный контейнер под потоки
    const streams = document.getElementById('streams');

    root.innerHTML = `
      <div class="call-header">${title}</div>
      <div class="call-body">
        <div class="call-streams-container"></div>
      </div>
    `;

    const container = root.querySelector('.call-streams-container');

    if (streams) {
        container.appendChild(streams);
    }

    // плейсхолдер на случай отсутствия контейнера или ещё нет звонка
    if (!streams || !hasCall) {
        const placeholder = document.createElement('div');
        placeholder.className = 'call-streams-placeholder';
        placeholder.textContent = hasCall
            ? 'Подключение к медиапотокам...'
            : 'Подключитесь к конференции';
        container.appendChild(placeholder);
    }
}
