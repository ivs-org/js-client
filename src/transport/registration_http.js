// src/transport/registration_http.js

// Гипотеза по URL:
//   - в форме можно указать:
//       wss://host:port/control
//       ws://host:port/control
//       https://host:port
//       http://host:port
//       host:port
//   - мы приводим к
//       https://host:port/api/v1.0/register_user

function buildRegistrationUrl(serverField) {
    if (!serverField) {
        throw new Error('Не указан адрес сервера');
    }

    let url = serverField.trim();

    // ws:// → http://, wss:// → https://
    if (url.startsWith('ws://')) {
        url = 'http://' + url.slice('ws://'.length);
    } else if (url.startsWith('wss://')) {
        url = 'https://' + url.slice('wss://'.length);
    }

    // если без протокола — считаем https
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    try {
        const u = new URL(url);

        // срезаем /control, если есть
        if (u.pathname === '/control') {
            u.pathname = '';
        }

        // убираем хвостовые слеши и добавляем /api/v1.0/register_user
        u.pathname = u.pathname.replace(/\/+$/, '') + '/api/v1.0/register_user';
        u.search = '';
        u.hash = '';

        return u.toString();
    } catch {
        // на всякий случай fallback
        return url.replace(/\/+$/, '') + '/api/v1.0/register_user';
    }
}

/**
 * Регистрация пользователя через HTTP POST.
 *
 * Тело:
 * {
 *   name: string,
 *   login: string,
 *   password: string,
 *   captcha: string
 * }
 *
 * Ответ — текст, в котором ищем "OK", "duplicated", "Forbidden".
 */
export async function registerUserViaHttp({ server, login, password, name, captcha }) {
    const url = buildRegistrationUrl(server);

    const payload = {
        name: name || '',
        login,
        password,
        captcha: captcha || '',
    };

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await resp.text();

    let result = 'Unknown';
    if (text.includes('OK')) {
        result = 'OK';
    } else if (text.includes('duplicated')) {
        result = 'DuplicateLogin';
    } else if (text.includes('Forbidden')) {
        result = 'RegistrationDenied';
    }

    return { url, result, text };
}

export function interpretRegistrationResult({ result, text }) {
    switch (result) {
        case 'OK':
            return { ok: true, message: 'Регистрация успешна' };

        case 'DuplicateLogin':
            return { ok: false, message: 'Такой логин уже используется' };

        case 'RegistrationDenied':
            return { ok: false, message: 'Регистрация запрещена администратором' };

        default:
            return {
                ok: false,
                message: 'Ошибка регистрации: ' + (text ? text.slice(0, 200) : 'неизвестная'),
            };
    }
}
