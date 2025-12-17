// src/ui/panels/contacts_panel.js

import { appState, setState } from '../../core/app_state.js';
import { Storage } from '../../data/storage.js';
import { MemberList } from '../../data/member_list.js';
import { isMobileLayout } from '../panels/buttons_panel.js';

function maybeOpenChatOnMobile() {
    // Авто-открытие чата только в мобильном мессенджере
    if (!isMobileLayout()) return;

    setState({
        showContactsPanel: false,
        showChatPanel: true,
    });
}

export function renderContactsPanel(root, state) {
    if (!root) return;

    const {
        lastSyncAt,
        activeContactId,
        activeContactType,
        contactsView = 'contacts',
    } = state;

    const meta = Storage.getMeta();
    const showNumbers = !!(meta && meta.show_numbers);

    const treeRoots = Storage.getContactsTree();
    const conferenceMembers = MemberList.getMembers() || [];
    const hasActiveConference = !!appState.activeCall;

    // Если сейчас выбрана вкладка "Участники", но конфы нет — рисуем как "Контакты"
    const effectiveView =
        contactsView === 'members' && !hasActiveConference ? 'contacts' : contactsView;

    const contactsHtml = `
      <div class="contacts-tree">
        ${treeRoots.map(node =>
        renderTreeNode(node, 0, activeContactId, activeContactType, showNumbers)
    ).join('')}
      </div>
    `;

    const membersHtml = renderCurrentConferenceMembersFromMemberList(
        activeContactId,
        activeContactType,
        conferenceMembers
    );

    /*
    <div class="contacts-header">
          <span class="contacts-title">Контакты</span>
          ${lastSyncAt
            ? `<span class="contacts-sync-time">обновлено ${formatTime(lastSyncAt)}</span>`
            : ''}
        </div>
    */

    root.innerHTML = `
      <div class="contacts-panel">
        <div class="contacts-header">
          <div class="contacts-tabs">
            <button
              class="tab-btn ${effectiveView === 'contacts' ? 'active' : ''}"
              data-contacts-view="contacts"
            >
              Контакты
            </button>
            <button
              class="tab-btn ${effectiveView === 'members' ? 'active' : ''} ${!hasActiveConference ? 'disabled' : ''}"
              data-contacts-view="members"
              ${!hasActiveConference ? 'disabled' : ''}
            >
              Участники
            </button>
            <button
              type="button"
              class="panel-close-btn"
              data-action="close-contacts"
              title="Скрыть список контактов"
            >✕</button>
          </div>
        </div>
        ${effectiveView === 'contacts' ? contactsHtml : membersHtml}
      </div>
    `;

    attachContactsHandlers(root);
}

// ---------- дерево "Контакты" ----------

function renderTreeNode(node, level, activeId, activeType, showNumbers) {
    switch (node.type) {
        case 'group':
            return renderGroupNode(node, level, activeId, activeType, showNumbers);
        case 'member':
            return renderMemberNode(node, level, activeId, activeType, showNumbers);
        case 'conference':
            return renderConferenceNode(node, level, activeId, activeType, showNumbers);
        default:
            return '';
    }
}

function renderGroupNode(group, level, activeId, activeType, showNumbers) {
    const indent = level * 12;
    const rolled = !!group.rolled;

    const hasChildren = group.children && group.children.length > 0;
    const arrow = hasChildren ? (rolled ? '▸' : '▾') : '•';

    const childrenHtml = (!rolled && hasChildren)
        ? group.children
            .map(ch => renderTreeNode(ch, level + 1, activeId, activeType, showNumbers))
            .join('')
        : '';

    return `
      <div class="contact-node group-node" data-node-type="group" data-group-id="${group.id}">
        <div
          class="contact-row group-row"
          data-group-id="${group.id}"
          style="padding-left:${8 + indent}px"
        >
          <span class="group-arrow" data-action="toggle-group" data-group-id="${group.id}">${arrow}</span>
          <span class="group-name" title="${escapeHtml(group.name || '')}">
            ${escapeHtml(group.name || '')}
          </span>
        </div>
        ${childrenHtml}
      </div>
    `;
}

function renderMemberNode(member, level, activeId, activeType, showNumbers) {
    const indent = level * 12;
    const isActive = activeType === 'member' && activeId === member.id;

    // MemberState: считаем state == 2 => online
    const isOnline = typeof member.state === 'number'
        ? member.state === 2
        : false;

    const unread = member.unreaded_count || 0;

    return `
      <div
        class="contact-row member-row ${isActive ? 'active' : ''}"
        data-node-type="member"
        data-node-id="${member.id}"
        style="padding-left:${24 + indent}px"
      >
        ${showNumbers && member.number
            ? `<span class="contact-number-left">${escapeHtml(member.number)}</span>`
            : '<span class="contact-number-left"></span>'
        }
        <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
        <span class="contact-name" title="${escapeHtml(member.name || member.login || '')}">
          ${escapeHtml(member.name || member.login || '')}
        </span>
        ${unread > 0
            ? `<span class="unread-badge">${unread > 99 ? '99+' : unread}</span>`
            : ''
        }
      </div>
    `;
}

// Конференция как раскрываемый узел со снапшота conferences_list
function renderConferenceNode(conf, level, activeId, activeType, showNumbers) {
    const indent = level * 12;
    const isActive = activeType === 'conference' && activeId === conf.id;
    const unread = conf.unreaded_count || 0;

    const hasMembers = conf.members && conf.members.length > 0;
    const rolled = !!conf.rolled;
    const arrow = hasMembers ? (rolled ? '▸' : '▾') : '•';

    const childrenHtml = (!rolled && hasMembers)
        ? conf.members.map(m =>
            renderMemberNode(m, level + 1, activeId, activeType, showNumbers)
        ).join('')
        : '';

    return `
  <div class="contact-node conf-node" data-conf-id="${conf.id}">
    <div
      class="contact-row conf-row ${isActive ? 'active' : ''}"
      data-node-type="conference"
      data-node-id="${conf.id}"
      data-node-tag="${conf.tag}"
      style="padding-left:${8 + indent}px">
      <span class="group-arrow" data-action="toggle-conf" data-conf-id="${conf.id}">
        ${arrow}
      </span>
      <span class="conf-icon">🖥️</span>
      <span class="contact-name" title="${escapeHtml(conf.name || '')}">
        ${escapeHtml(conf.name || '')}
      </span>
      ${hasMembers
            ? `<span class="conf-members-count">${conf.members.length}</span>`
            : ''
        }
      ${unread > 0
            ? `<span class="unread-badge">${unread > 99 ? '99+' : unread}</span>`
            : ''
        }
    </div>
    ${childrenHtml}
  </div>
`;
}

// ---------- вкладка "Участники" (MemberList) ----------

function renderCurrentConferenceMembersFromMemberList(activeId, activeType, members) {
    if (!members || !members.length) {
        return `
          <div class="contacts-tree contacts-tree-members">
            <div class="contacts-empty">Нет активной конференции</div>
          </div>
        `;
    }

    const rows = members.map(m => {
        const isActive = activeType === 'member' && activeId === m.id;
        const isOnline = true;// typeof m.state === 'number' ? m.state === 2 : true;

        return `
          <div
            class="contact-row member-row ${isActive ? 'active' : ''}"
            data-node-type="member"
            data-node-id="${m.id}">
            <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
            <span class="contact-name" title="${escapeHtml(m.name || m.login || '')}">
              ${escapeHtml(m.name || m.login || '')}
            </span>
          </div>
        `;
    }).join('');

    return `
      <div class="contacts-tree contacts-tree-members">
        ${rows}
      </div>
    `;
}

// ---------- обработчики ----------

function attachContactsHandlers(root) {
    root.onclick = (ev) => {
        const target = ev.target;
        if (!(target instanceof HTMLElement)) return;

        // Закрытие панели
        const closeBtn = target.closest('[data-action="close-contacts"]');
        if (closeBtn) {
            if (isMobileLayout() && !appState.activeCall) return; // На мобилке в stand-by не даем закрыть основной экран
            setState({
                showContactsPanel: false,
            });
            return;
        }

        // Переключение вкладок
        const tab = target.closest('[data-contacts-view]');
        if (tab) {
            const view = tab.getAttribute('data-contacts-view');
            // если вкладка физически дизаблена — игнорируем
            if (tab.hasAttribute('disabled')) {
                return;
            }
            if (view === 'contacts' || view === 'members') {
                setState({ contactsView: view });
            }
            return;
        }

        // Сворачивание/разворачивание группы
        const toggleGroup = target.closest('[data-action="toggle-group"]');
        if (toggleGroup) {
            const row = target.closest('.contact-row');
            if (!row) return;

            const idStr = toggleGroup.getAttribute('data-group-id');
            if (!idStr) return;
            const groupId = Number.isNaN(Number(idStr)) ? idStr : Number(idStr);
            Storage.toggleGroupRolled(groupId);
            return;
        }

        // Сворачивание/разворачивание конференции
        const toggleConf = target.closest('[data-action="toggle-conf"]');
        if (toggleConf) {
            const idStr = toggleConf.getAttribute('data-node-id')
                || toggleConf.getAttribute('data-conf-id');
            if (!idStr) return;
            const confId = Number(idStr);
            Storage.toggleConferenceRolled(confId);
            return;
        }

        // Выбор контакта / конференции
        const row = target.closest('.contact-row');
        if (!row) return;

        const type = row.getAttribute('data-node-type');
        const idStr = row.getAttribute('data-node-id');
        if (!type || !idStr) return;

        const id = Number(idStr);

        switch (type) {
            case 'member':
                Storage.updateMember(id, { unreaded_count: 0 }).catch(() => { });
                setState({
                    activeContactId: id,
                    activeContactType: 'member',
                    activeConferenceTag: null,
                });
                maybeOpenChatOnMobile();
                break;

            case 'conference': {
                const tag = row.getAttribute('data-node-tag') || null;
                Storage.updateConference(id, { unreaded_count: 0 }).catch(() => { });
                setState({
                    activeContactId: id,
                    activeContactType: 'conference',
                    activeConferenceTag: tag,
                });
                maybeOpenChatOnMobile();
                break;
            }
        }
    };
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

function formatTime(ts) {
    try {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    } catch {
        return '';
    }
}
