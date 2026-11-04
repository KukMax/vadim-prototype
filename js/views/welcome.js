(function (App) {
  "use strict";

  const DATA = App.data;
  const UI = App.publicUi;
  const { escapeHtml, icon } = App.util;
  App.views = App.views || {};

  function welcomeView() {
    return `
    <div class="pub pub--welcome">
      <div class="pub-theme-slot">${UI.themeToggle()}</div>
      <header class="pub-head pub-head--center">
        ${UI.logoLockup("lg")}
        <h1 class="pub-title" id="welcome-title" tabindex="-1">Вход</h1>
        <p class="pub-lead">${escapeHtml(DATA.welcomeTagline)}</p>
      </header>

      <form class="card pub-form pub-form--login" data-form="login" novalidate>
        <div class="pub-field" data-field="login-email">
          <label class="pub-label" for="login-email">Почта</label>
          <input class="input" id="login-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="name@example.ru" aria-describedby="login-email-error">
          <p class="field-error" id="login-email-error" aria-live="polite" hidden></p>
        </div>
        <div class="pub-field" data-field="login-password">
          <div class="pub-label-row">
            <label class="pub-label" for="login-password">Пароль</label>
            <button class="pub-reveal" type="button" data-action="toggle-password" data-target="login-password" aria-pressed="false">${icon("eye")}<span>Показать</span></button>
          </div>
          <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" aria-describedby="login-password-error">
          <p class="field-error" id="login-password-error" aria-live="polite" hidden></p>
        </div>
        <button class="btn btn--primary pub-submit" type="submit">Войти</button>
        <p class="pub-aside"><button class="link-btn" type="button" data-action="forgot-password">Забыли пароль?</button></p>
      </form>

      <p class="pub-switch">Нет аккаунта? <a class="pub-link" href="#/register">Зарегистрироваться</a></p>
      <p class="pub-note">${escapeHtml(DATA.sessionNote)}</p>

      <a class="card pub-demo-card" href="#/demo">
        <span class="pub-demo-copy">
          <span class="card-title">Посмотреть демо</span>
          <span class="pub-demo-text">Как выглядят тренировки и питание — без регистрации</span>
        </span>
        <span class="pub-demo-arrow" aria-hidden="true">${icon("arrow-right")}</span>
      </a>

      <div class="pub-tail">
        <button class="link-btn" type="button" data-action="coach-soon">Я тренер</button>
        <button class="pub-shortcut" type="button" data-action="demo-client" data-demo="true">Войти как демо-клиент (для показа)</button>
      </div>

      <p class="pub-footer">${escapeHtml(DATA.publicFooter)}</p>
    </div>`;
  }

  App.views.welcome = { view: welcomeView };
})(window.App = window.App || {});
