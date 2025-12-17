# Storage (IndexedDB + In-Memory)

## Goals
- Fast reads for UI (in-memory)
- Persistent UX state (settings, rolled, last selected, etc.)
- Safe init on empty storage (first login)

## Stores
- `STORE_GROUPS`
- `STORE_MEMBERS`
- `STORE_CONFS`
- `STORE_SETTINGS`
- `STORE_MESSAGES`
- `STORE_FILES`

## Init flow
1) open DB
2) `Promise.all(loadAllFromStore(...))`
3) fill in-memory maps
4) only after this UI is allowed to rely on settingsByKey

## Settings keys (examples)
- `ui.groupsRootRolled` (default expanded)
- `ui.contactsRootRolled`
- `media.cameraDeviceId`
- `media.micDeviceId`
- `media.speakerDeviceId`
- `notify.enabled`
- `notify.onlyWhenHidden`

> TODO: add full list + defaults

## Defaults policy
- If setting missing -> return default
- Root groups (parent_id==0) should default to expanded

## Update policy
- Updates should:
  1) update in-memory map immediately
  2) persist to IndexedDB (best effort)
  3) notify subscribers

## Migration policy
- `dbVersion` bump and migration steps documented here
- data loss policy: TODO

## Debug
- How to inspect:
  - DevTools -> Application -> IndexedDB
- Common issue:
  - settings present in IDB but not loaded: init flow bug
