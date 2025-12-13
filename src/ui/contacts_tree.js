// src/ui/contacts_tree.js

// Узлы дерева:
// { type: 'group', id, name, tag, children: ContactNode[], level }
// { type: 'member', id, name, number, login, onlineState, unreaded_count, groups: [groupId...] }
// { type: 'conference', id, name, tag, unreaded_count, members: Member[], ... }

export function buildContactsTree(contactsData) {
    const groups = contactsData.groups || [];
    const members = contactsData.members || [];
    const conferences = contactsData.conferences || [];

    const groupById = new Map();
    const rootGroups = [];

    // 1. Строим карту групп
    for (const g of groups) {
        if (g.deleted) continue;
        groupById.set(g.id, {
            type: 'group',
            id: g.id,
            parent_id: g.parent_id,
            name: g.name,
            tag: g.tag,
            level: g.level,
            grants: g.grants,
            owner_id: g.owner_id,
            deleted: !!g.deleted,
            rolled: !!g.rolled,
            children: [],
        });
    }

    // 2. Строим иерархию групп
    for (const group of groupById.values()) {
        if (group.parent_id && groupById.has(group.parent_id)) {
            groupById.get(group.parent_id).children.push(group);
        } else {
            rootGroups.push(group);
        }
    }

    // 3. Раскидываем участников по группам
    for (const m of members) {
        if (m.deleted) continue;

        const memberNode = {
            type: 'member',
            id: m.id,
            name: m.name,
            number: m.number,
            login: m.login,
            avatar: m.avatar,
            icon: m.icon,
            state: m.state,   // Online/Offline и т.п.
            has_camera: !!m.has_camera,
            has_microphone: !!m.has_microphone,
            has_demonstration: !!m.has_demonstration,
            unreaded_count: m.unreaded_count || 0,
            groups: (m.groups || []).map(g => g.id),
            grants: m.grants,
        };

        const groupsOfMember = m.groups || [];
        if (!groupsOfMember.length) {
            // если у контакта нет групп — можно:
            // 1) либо игнорировать,
            // 2) либо добавить в виртуальную группу "Прочие".
            // Пока просто скипаем.
            continue;
        }

        for (const g of groupsOfMember) {
            const parent = groupById.get(g.id);
            if (!parent) continue;
            parent.children.push(memberNode);
        }
    }

    // 4. Корень "Конференции"
    const conferencesRoot = {
        type: 'group',
        id: 'conf-root',
        name: 'Конференции',
        tag: 'conferences',
        level: 0,
        children: [],
        grants: 0,
        owner_id: 0,
        deleted: false,
        rolled: !!contactsData.conferencesRolled,
    };

    for (const c of conferences) {
        if (c.deleted) continue;

        conferencesRoot.children.push({
            type: 'conference',
            id: c.id,
            name: c.name,
            tag: c.tag,
            descr: c.descr,
            founder: c.founder,
            founder_id: c.founder_id,
            confType: c.type,
            grants: c.grants,
            duration: c.duration,
            members: c.members || [],
            connect_members: !!c.connect_members,
            temp: !!c.temp,
            unreaded_count: c.unreaded_count || 0,
            rolled: !!c.rolled,
        });
    }

    const treeRoots = [];

    // сначала корень "Конференции", если есть что показывать
    if (conferencesRoot.children.length > 0) {
        treeRoots.push(conferencesRoot);
    }

    // дальше — обычные корневые группы
    // (можно отсортировать по name/level при желании)
    treeRoots.push(...rootGroups);

    return treeRoots;
}
