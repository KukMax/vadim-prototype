(function (App) {
  "use strict";

  const DATA = App.data;
  const UI = App.publicUi;
  const { icon } = App.util;
  App.views = App.views || {};

  function revealButton(target) {
    return `<button class="pub-reveal" type="button" data-action="toggle-password" data-target="${target}" aria-pressed="false">${icon("eye")}<span>Показать</span></button>`;
  }

  function registerView() {
    return `
      <div class="pub pub--auth">
        <header class="pub-topbar">
          <a class="pub-topbar-brand" href="#/welcome" aria-label="Trenio — на страницу входа">${UI.logoLockup("sm")}</a>
          <div class="pub-topbar-actions">${UI.themeToggle()}</div>
        </header>

        <div class="pub-body">
          ${UI.backLink("welcome", "Назад")}
          ${UI.stepLabel(1, "account")}
          <h1 class="pub-title" id="register-title" tabindex="-1">Регистрация</h1>
          <p class="pub-lead">Заведите аккаунт — дальше короткая анкета и план от Вадима.</p>

          <form class="card pub-form" data-form="register" novalidate>
            <div class="pub-field" data-field="register-email">
              <label class="pub-label" for="register-email">Почта</label>
              <input class="input" id="register-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="name@example.ru" aria-describedby="register-email-error">
              <p class="field-error" id="register-email-error" hidden></p>
            </div>

            <div class="pub-field" data-field="register-password">
              <div class="pub-label-row">
                <label class="pub-label" for="register-password">Пароль</label>
                ${revealButton("register-password")}
              </div>
              <input class="input" id="register-password" name="password" type="password" autocomplete="new-password" aria-describedby="register-password-hint register-password-error">
              <p class="pub-hint" id="register-password-hint" data-role="pw-hint">Не короче 8 символов</p>
              <p class="field-error" id="register-password-error" hidden></p>
            </div>

            <div class="pub-field" data-field="register-password2">
              <div class="pub-label-row">
                <label class="pub-label" for="register-password2">Повторите пароль</label>
                ${revealButton("register-password2")}
              </div>
              <input class="input" id="register-password2" name="password2" type="password" autocomplete="new-password" aria-describedby="register-password2-error">
              <p class="field-error" id="register-password2-error" hidden></p>
            </div>

            <div class="pub-field pub-field--consent" data-field="register-consent">
              <label class="consent" for="register-consent">
                <input class="consent-input" id="register-consent" name="consent" type="checkbox" aria-describedby="register-consent-error">
                <span class="consent-box" aria-hidden="true">${icon("check")}</span>
                <span class="consent-text">Я даю <button class="consent-link" type="button" data-action="legal" data-legal="consent">согласие</button> на обработку персональных данных, в том числе данных о здоровье, и принимаю <button class="consent-link" type="button" data-action="legal" data-legal="terms">условия использования</button></span>
              </label>
              <p class="field-error" id="register-consent-error" hidden></p>
            </div>

            <button class="btn btn--primary pub-submit" type="submit">Создать аккаунт</button>
          </form>

          <p class="pub-switch">Уже есть аккаунт? <a class="pub-link" href="#/welcome">Войти</a></p>
          <p class="pub-note">${DATA.registerNote}</p>
          ${UI.footer()}
        </div>
      </div>`;
  }

  App.views.register = { view: registerView };
})(window.App = window.App || {});
