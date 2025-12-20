// src/ui/register_view.js
import { appState, setState } from '../core/app_state.js';

export function renderRegisterView(root, state) {
    if (!root) return;

    const stored = (state && state.auth) ? state.auth : (appState.auth || {});
    const server = stored?.server || '';
    const login = stored?.login || '';

    root.innerHTML = `
        <div class="auth-shell">
            <div class="auth-hero" aria-hidden="true">
                <div class="auth-hero-inner">
            <div class="auth-hero-logo">VG</div>
            <div class="auth-hero-bottom">
              <div class="auth-hero-title">VideoGrace</div>
              <div class="auth-hero-sub">
                Вход в рабочий контур. Без лишних движений — кроме полезных.
              </div>
            </div>
          </div>
            </div>

            <div class="auth-panel">
                <div class="auth-card">
                    <h1 class="auth-title">Регистрация</h1>
                    <div class="auth-field">
                        <label for="regServer">Сервер</label>
                        <input id="regServer" type="text"
                            placeholder="wss://server:port/register"
                            value="${escapeHtml(server)}" />
                    </div>

                    <div class="auth-field">
                        <label for="regLogin">Логин</label>
                        <input id="regLogin" type="text"
                            value="${escapeHtml(login)}" />
                    </div>

                    <div class="auth-field">
                        <label for="regName">Имя (отображаемое)</label>
                        <input id="regName" type="text" />
                    </div>

                    <div class="auth-field">
                        <label for="regPassword">Пароль</label>
                        <input id="regPassword" type="password" />
                    </div>

                    <div class="auth-field">
                        <label for="regPassword2">Подтверждение пароля</label>
                        <input id="regPassword2" type="password" />
                    </div>

                    <!-- Капча: зарезервировано под бэкенд, пока отключено -->
                    <div class="auth-field reg-captcha reg-captcha-disabled">
                        <label>Капча</label>
                        <div class="reg-captcha-placeholder">
                        Капча будет здесь (сейчас отключена)
                    </div>
                </div>

                <div class="auth-actions">
                    <button id="btnRegisterSubmit" type="button">Зарегистрироваться</button>
                </div>

                <div class="auth-switch">
                    Уже есть аккаунт?
                    <button type="button" id="lnkBackToLogin" class="link-btn">
                    Войти
                    </button>
                </div>
            </div>
        </div>`;


    const serverEl = root.querySelector('#regServer');
    const loginEl = root.querySelector('#regLogin');
    const nameEl = root.querySelector('#regName');
    const passEl = root.querySelector('#regPassword');
    const pass2El = root.querySelector('#regPassword2');
    const submitEl = root.querySelector('#btnRegisterSubmit');
    const backLink = root.querySelector('#lnkBackToLogin');

    if (!serverEl || !loginEl || !passEl || !pass2El || !submitEl) return;

    submitEl.addEventListener('click', () => {
        const server = serverEl.value.trim();
        const login = loginEl.value.trim();
        const name = nameEl.value.trim();
        const password = passEl.value;
        const password2 = pass2El.value;

        if (!server || !login || !password) {
            document.dispatchEvent(new CustomEvent('app:register-error', {
                detail: { message: 'Укажите сервер, логин и пароль' }
            }));
            return;
        }

        if (password !== password2) {
            document.dispatchEvent(new CustomEvent('app:register-error', {
                detail: { message: 'Пароли не совпадают' }
            }));
            return;
        }

        const payload = {
            server,
            login,
            name,
            password,
            avatar: '',    // пока не трогаем
            captcha: null, // зарезервировано
        };

        document.dispatchEvent(new CustomEvent('app:register', {
            detail: payload
        }));
    });

    pass2El.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault(); // Предотвращаем лишние действия
            submitEl.click(); // Программный клик по кнопке
        }
    });

    if (backLink) {
        backLink.addEventListener('click', () => {
            setState({
                view: 'login'
            });
        });
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
