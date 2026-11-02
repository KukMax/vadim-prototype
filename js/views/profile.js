(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const {
    icon, escapeHtml, plural, weight, daysBetween, isoDate, formatShortDate, parseIsoDate, NOW,
  } = App.util;
  App.views = App.views || {};

  function profileView() {
    const latest = App.measurements.latest();
    const currentWeight = latest ? weight(latest.values.weight) : weight(DATA.goal.current);
    const subscription = DATA.subscription;
    const until = subscription.packages.reduce((value, item) => item.until > value ? item.until : value, subscription.packages[0].until);
    const remaining = Math.max(0, daysBetween(isoDate(NOW), until));
    const elapsed = Math.max(0, Math.min(subscription.periodDays, subscription.periodDays - remaining));
    const progress = Math.round((elapsed / subscription.periodDays) * 100);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Аккаунт</span>
        <h1 class="page-title" id="profile-title" tabindex="-1">Профиль</h1>
      </div>
      <div class="profile-grid">
        <article class="identity-card card">
          <div class="identity-main">
            <span class="identity-avatar">
              ${STATE.avatar ? `<img src="${STATE.avatar}" alt="Фото профиля">` : `<span class="avatar avatar--xl" aria-hidden="true">А</span>`}
            </span>
            <div class="identity-copy">
              <h2>${escapeHtml(DATA.client.name)}</h2>
              <p class="identity-meta">${DATA.client.age} года · ${DATA.client.height} см · ${currentWeight} кг</p>
              <span class="goal-chip">Цель: ${escapeHtml(DATA.client.goal.toLowerCase())}</span>
            </div>
          </div>
          <button class="btn btn--ghost identity-photo" type="button" data-action="pick-avatar">Изменить фото</button>
          <input class="visually-hidden" id="avatar-input" type="file" accept="image/*" tabindex="-1" aria-hidden="true">
        </article>

        <article class="contact-card card">
          <div class="card-head"><h2 class="card-title">Контакты</h2><span class="card-hint">для связи</span></div>
          <dl class="contact-list">
            <div><dt>${icon("phone")}Телефон</dt><dd><a href="tel:+79000000000">${escapeHtml(DATA.client.phone)}</a></dd></div>
            <div><dt>${icon("mail")}Email</dt><dd><a href="mailto:${escapeHtml(DATA.client.email)}">${escapeHtml(DATA.client.email)}</a></dd></div>
          </dl>
        </article>

        <article class="subscription-card card">
          <div class="card-head"><h2 class="card-title">Подписка</h2><span class="card-hint">активна</span></div>
          <div class="subscription-chips">${subscription.packages.map((item) => `<span class="chip chip--accent">${escapeHtml(item.title)}</span>`).join("")}</div>
          <p class="subscription-text">Подписка активна до ${formatShortDate(until)} · осталось ${remaining} ${plural(remaining, ["день", "дня", "дней"])}</p>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${subscription.periodDays}" aria-valuenow="${elapsed}" aria-label="Использовано ${elapsed} из ${subscription.periodDays} дней подписки">
            <span class="progress-fill" style="width:${progress}%"></span>
          </div>
        </article>

        <article class="settings-card card">
          <div class="card-head"><h2 class="card-title">Настройки</h2></div>
          <div class="theme-setting">
            <span class="theme-label">Тема</span>
            <div class="segmented" role="radiogroup" aria-label="Тема оформления">
              <label class="segment"><input type="radio" name="theme" value="dark" data-action="set-theme"${STATE.theme === "dark" ? " checked" : ""}><span>${icon("moon")}Тёмная</span></label>
              <label class="segment"><input type="radio" name="theme" value="light" data-action="set-theme"${STATE.theme === "light" ? " checked" : ""}><span>${icon("sun")}Светлая</span></label>
            </div>
          </div>
        </article>

        <article class="actions-card card">
          <div class="card-head"><h2 class="card-title">Связь и приложение</h2></div>
          <div class="action-list">
            <button class="action-row" type="button" data-action="open-contact"><span class="action-icon">${icon("message")}</span><span class="action-label">Связаться с Вадимом</span><span class="action-chevron" aria-hidden="true">${icon("chevron-right")}</span></button>
            <button class="action-row" type="button" data-action="share-app"><span class="action-icon">${icon("share")}</span><span class="action-label">Поделиться приложением</span><span class="action-chevron" aria-hidden="true">${icon("chevron-right")}</span></button>
            <button class="action-row" type="button" data-action="install-app"${standalone ? " hidden" : ""}><span class="action-icon">${icon("install")}</span><span class="action-label">Добавить на главный экран</span><span class="action-chevron" aria-hidden="true">${icon("chevron-right")}</span></button>
          </div>
        </article>
      </div>`;
  }

  App.views.profile = { view: profileView };
})(window.App = window.App || {});
