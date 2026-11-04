(function (App) {
  "use strict";

  const UI = App.publicUi;
  const { icon } = App.util;
  App.views = App.views || {};

  function onboardingView() {
    return `
      <div class="pub pub--auth">
        <header class="pub-topbar">
          <a class="pub-topbar-brand" href="#/welcome" aria-label="Trenio — на страницу входа">${UI.logoLockup("sm")}</a>
          <div class="pub-topbar-actions">${UI.themeToggle()}</div>
        </header>

        <div class="pub-body">
          ${UI.stepLabel(2, "profile")}
          <h1 class="pub-title" id="onboarding-title" tabindex="-1">Анкета</h1>
          <p class="pub-lead">Пара вопросов о цели и опыте — чтобы план подошёл именно вам.</p>

          <article class="card pub-calm">
            <span class="pub-calm-icon" aria-hidden="true">${icon("user")}</span>
            <p class="pub-calm-text">Анкета появится в следующей версии прототипа. Здесь вы выберете пакет и расскажете о себе.</p>
          </article>

          <button class="btn btn--primary pub-submit" type="button" data-action="finish-onboarding">Перейти в демо-кабинет</button>
          <p class="pub-aside"><button class="link-btn" type="button" data-action="leave-onboarding">Выйти</button></p>
          ${UI.footer()}
        </div>
      </div>`;
  }

  App.views.onboarding = { view: onboardingView };
})(window.App = window.App || {});
