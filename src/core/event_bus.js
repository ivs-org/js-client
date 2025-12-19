/**
 * event_bus.js - tiny event emitter (no deps, fast)
 */

export class EventBus {
    constructor() {
        /** @type {Map<string, Map<Function, {fn:Function, once:boolean}>>} */
        this._events = new Map();
    }

    on(eventName, handler, { once = false } = {}) {
        if (typeof handler !== 'function') {
            throw new TypeError('EventBus.on: handler must be a function');
        }

        let bucket = this._events.get(eventName);
        if (!bucket) {
            bucket = new Map();
            this._events.set(eventName, bucket);
        }

        bucket.set(handler, { fn: handler, once: !!once });

        // возвращаем отписку
        return () => this.off(eventName, handler);
    }

    once(eventName, handler) {
        return this.on(eventName, handler, { once: true });
    }

    off(eventName, handler) {
        const bucket = this._events.get(eventName);
        if (!bucket) return;

        bucket.delete(handler);

        if (bucket.size === 0) {
            this._events.delete(eventName);
        }
    }

    emit(eventName, payload) {
        const bucket = this._events.get(eventName);
        if (!bucket || bucket.size === 0) return 0;

        let called = 0;

        // важно: можно удалять during-iteration — Map это переживает
        for (const [orig, rec] of bucket) {
            try {
                rec.fn(payload);
            } catch (e) {
                console.error('[EventBus] handler error for', eventName, e);
            }
            called++;

            if (rec.once) {
                bucket.delete(orig);
            }
        }

        if (bucket.size === 0) this._events.delete(eventName);

        return called;
    }

    clear(eventName) {
        if (typeof eventName === 'string') this._events.delete(eventName);
        else this._events.clear();
    }

    listenerCount(eventName) {
        const bucket = this._events.get(eventName);
        return bucket ? bucket.size : 0;
    }
}
