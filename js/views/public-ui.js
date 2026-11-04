(function (App) {
  "use strict";

  const { icon, escapeHtml } = App.util;
  const DATA = App.data;

  // size: "sm" — только знак для тонкой шапки, "lg" — крупный лок-ап входа.
  function logoLockup(size) {
    const mod = size === "lg" ? " pub-brand--lg" : size === "sm" ? " pub-brand--sm" : "";
    const caption = size === "sm" ? "" : `<span class="brand-caption">фитнес тренер Вадим</span>`;
    return `
      <span class="brand brand--logo pub-brand${mod}">
        <svg class="brand-mark" viewBox="8 10 1134 262" aria-hidden="true" focusable="false"><use href="#logo-trenio"></use></svg>
        ${caption}
      </span>`;
  }

  function themeIcon() {
    return App.state.theme === "light" ? icon("moon") : icon("sun");
  }

  function themeLabel() {
    return App.state.theme === "light" ? "Включить тёмную тему" : "Включить светлую тему";
  }

  // Кнопка живёт вне ре-рендера: обработчик toggle-theme правит её на месте,
  // чтобы фокус не терялся.
  function themeToggle() {
    return `<button class="icon-button pub-theme" type="button" data-action="toggle-theme" aria-label="${themeLabel()}" aria-pressed="${App.state.theme === "light" ? "true" : "false"}">${themeIcon()}</button>`;
  }

  function backLink(route, label) {
    return `<a class="pub-back" href="#/${route}">${icon("chevron-left")}<span>${escapeHtml(label)}</span></a>`;
  }

  function notice() {
    return `
      <div class="pub-notice">
        <span class="pub-notice-badge">${icon("info")}${escapeHtml(DATA.demoNotice.title)}</span>
        <p class="pub-notice-text">${escapeHtml(DATA.demoNotice.text)}</p>
      </div>`;
  }

  function footer() {
    return `<p class="pub-footer">${escapeHtml(DATA.publicFooter)}</p>`;
  }

  function stepLabel(number, key) {
    const steps = DATA.signupSteps;
    return `<p class="pub-step">Шаг ${number} из ${steps.total} · ${escapeHtml(steps[key] || "")}</p>`;
  }

  App.publicUi = { logoLockup, themeToggle, themeIcon, themeLabel, backLink, notice, footer, stepLabel };
})(window.App = window.App || {});
