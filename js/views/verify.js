(function (App) {
  "use strict";

  const DATA = App.data;
  const UI = App.publicUi;
  const { escapeHtml } = App.util;
  App.views = App.views || {};

  const LENGTH = 6;

  function codeInputs() {
    const inputs = [];
    for (let index = 0; index < LENGTH; index += 1) {
      const digit = index + 1;
      inputs.push(`<input class="code-input" id="verify-code-${digit}" type="text" inputmode="numeric" autocomplete="${index === 0 ? "one-time-code" : "off"}" maxlength="1" pattern="[0-9]*" aria-label="Цифра ${digit} из ${LENGTH}">`);
    }
    return inputs.join("");
  }

  function verifyView() {
    const email = App.auth.email();
    return `
      <div class="pub pub--auth">
        <header class="pub-topbar">
          <a class="pub-topbar-brand" href="#/welcome" aria-label="Trenio — на страницу входа">${UI.logoLockup("sm")}</a>
          <div class="pub-topbar-actions">${UI.themeToggle()}</div>
        </header>

        <div class="pub-body">
          ${UI.stepLabel(1, "confirm")}
          <h1 class="pub-title" id="verify-title" tabindex="-1">Подтверждение почты</h1>
          <p class="pub-lead">Мы отправили код на <b class="pub-email">${escapeHtml(email)}</b></p>

          <form class="card pub-form" data-form="verify" novalidate>
            <div class="code-group" role="group" aria-labelledby="verify-code-label">
              <p class="pub-label" id="verify-code-label">Код из ${LENGTH} цифр</p>
              <div class="code-inputs">${codeInputs()}</div>
            </div>
            <p class="field-error" id="verify-error" role="alert" hidden></p>
            <button class="btn btn--primary pub-submit" type="submit">Подтвердить</button>
          </form>

          <p class="pub-demo-code">Демо: введите код ${DATA.demoCode}</p>

          <div class="pub-resend">
            <button class="link-btn" type="button" data-action="resend-code" data-role="resend">Отправить код ещё раз</button>
            <span class="pub-resend-timer" data-role="resend-timer" aria-live="polite"></span>
          </div>

          <p class="pub-aside"><a class="pub-link" href="#/register">Изменить почту</a></p>
          ${UI.footer()}
        </div>
      </div>`;
  }

  App.views.verify = { view: verifyView };
})(window.App = window.App || {});
