// src/ui/panels/call_panel.js
export function renderCallPanel(root, state) {
    if (!root) return;

    const hasCall = !!state.activeCall;
    const call = state.activeCall;
    const callType = call?.type || 'conference';

    let statusText = '';
    let actionHtml = '';
    if (!hasCall) {
        statusText = 'Подключитесь к конференции';
    } else if (callType === 'p2p') {
        const name = call?.peerName || 'контакт';
        switch (call?.status) {
            case 'dialing':
                statusText = `Звоним ${name}...`;
                actionHtml = `
                  <button type="button" class="btn-call-action" id="btnCancelOutgoingCall">
                    Отменить
                  </button>
                `;
                break;
            case 'ringing':
                statusText = `Входящий звонок от ${name}`;
                break;
            case 'connecting':
                statusText = 'Подключение к разговору...';
                break;
            case 'connected':
                statusText = `Разговор с ${name}`;
                break;
            default:
                statusText = 'Подготовка звонка...';
                break;
        }
    } else {
        statusText = hasCall
            ? (call?.name || 'Подключение к конференции...')
            : 'Подключитесь к конференции';
    }
    
    // ищем глобальный контейнер под потоки
    const streams = document.getElementById('streams');

    const actionBarHtml = statusText
        ? `
          <div class="call-action-bar">
            ${actionHtml}
            <div class="call-status">${statusText}</div>
          </div>
        `
        : '';

    root.innerHTML = `
      <div class="call-body">
        <div class="call-streams-container"></div>
        ${actionBarHtml}
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
