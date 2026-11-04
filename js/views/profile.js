(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const CYCLE = App.cycle;
  const {
    NOW, icon, escapeHtml, plural, weight, daysBetween, isoDate,
    parseIsoDate, formatShortDateNoYear,
  } = App.util;
  App.views = App.views || {};

  function profileView() {
    const latest = App.measurements.latest();
    const currentWeight = latest ? weight(latest.values.weight) : weight(DATA.goal.current);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Аккаунт</span>
        <h1 class="page-title" id="profile-title" tabindex="-1">Профиль</h1>
      </div>
      <div class="profile-grid">
        ${identityCard(currentWeight)}
        ${contactsCard()}
        ${subscriptionCard()}
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
        <article class="actions-card card">
          <div class="card-head"><h2 class="card-title">Аккаунт</h2></div>
          <div class="action-list">
            <button class="action-row" type="button" data-action="logout"><span class="action-icon">${icon("log-out")}</span><span class="action-label">Выйти из аккаунта</span><span class="action-chevron" aria-hidden="true">${icon("chevron-right")}</span></button>
          </div>
        </article>
        ${demoCard()}
      </div>`;
  }

  function identityCard(currentWeight) {
    const avatar = STATE.profile.avatar;
    return `
      <article class="identity-card card">
        <div class="identity-main">
          <span class="identity-avatar">
            ${avatar ? `<img class="avatar-img" src="${avatar}" alt="">` : `<span class="avatar avatar--xl" aria-hidden="true">А</span>`}
          </span>
          <div class="identity-copy">
            <h2>${escapeHtml(DATA.client.name)}</h2>
            <p class="identity-meta">${DATA.client.age} года · ${DATA.client.height} см · ${currentWeight} кг</p>
            <span class="goal-chip">Цель: ${escapeHtml(DATA.client.goal.toLowerCase())}</span>
          </div>
        </div>
        <div class="photo-actions">
          <button class="btn btn--ghost identity-photo" type="button" data-action="pick-avatar" data-focus="pick-avatar">${avatar ? "Изменить фото" : "Добавить фото"}</button>
          ${avatar ? `<button class="btn btn--ghost identity-photo identity-photo--remove" type="button" data-action="remove-avatar" data-focus="remove-avatar">Удалить фото</button>` : ""}
        </div>
        <input class="visually-hidden" id="avatar-input" type="file" accept="image/*" tabindex="-1" aria-hidden="true">
      </article>`;
  }

  function contactsCard() {
    return `
      <article class="contact-card card">
        <div class="card-head">
          <h2 class="card-title">Контакты</h2>
          <button class="link-btn" type="button" data-action="edit-contacts" data-focus="edit-contacts">Изменить</button>
        </div>
        <dl class="contact-list">
          <div><dt>${icon("phone")}Телефон</dt><dd><span class="contact-value">${escapeHtml(STATE.profile.phone)}</span></dd></div>
          <div><dt>${icon("mail")}Email</dt><dd><span class="contact-value">${escapeHtml(STATE.profile.email)}</span></dd></div>
        </dl>
      </article>`;
  }

  function subscriptionCard() {
    const training = DATA.subscription.training;
    const nutrition = DATA.subscription.nutrition || { status: "none", days: 0, activatedDaysAgo: 0 };
    const cycleData = CYCLE.current();
    const done = CYCLE.doneCount(cycleData);
    const total = training.sessions;
    const status = CYCLE.status();
    const trainingChip = status === "active" ? "chip chip--accent" : status === "completed" ? "chip chip--done" : "chip chip--muted";
    const trainingLabel = status === "active" ? "Активен" : status === "completed" ? "Цикл завершён" : "Не активирован";
    let trainingDetail = "Пакет не активирован";
    if (status === "active") trainingDetail = `${done} из ${total} тренировок · цикл №${cycleData.number}`;
    if (status === "completed") trainingDetail = `${total} из ${total} тренировок · цикл завершён`;
    const trainingProgress = status === "none" ? "" : progressMarkup(done, total, status === "active" ? `Выполнено ${done} из ${total} тренировок цикла` : "Цикл тренировок завершён");
    const nutritionActive = nutrition.status === "active";
    const days = Number(nutrition.days) || 0;
    const todayIso = isoDate(NOW);
    const activated = parseIsoDate(todayIso);
    activated.setDate(activated.getDate() - (Number(nutrition.activatedDaysAgo) || 0));
    const until = new Date(activated);
    until.setDate(until.getDate() + days);
    const untilIso = isoDate(until);
    const remaining = Math.max(0, daysBetween(todayIso, untilIso));
    const elapsed = Math.max(0, days - remaining);
    return `
      <article class="subscription-card card">
        <div class="card-head"><h2 class="card-title">Подписка</h2><span class="card-hint">${status === "active" && nutrition.status === "active" ? "активна" : "пакеты"}</span></div>
        <div class="subscription-rows">
          <div class="subscription-row">
            <div class="subscription-row-head">
              <span class="subscription-name">Тренировки</span>
              <span class="${trainingChip}">${trainingLabel}</span>
            </div>
            <p class="subscription-detail">${escapeHtml(trainingDetail)}</p>
            ${trainingProgress}
          </div>
          <div class="subscription-row">
            <div class="subscription-row-head">
              <span class="subscription-name">Питание</span>
              <span class="${nutritionActive ? "chip chip--accent" : "chip chip--muted"}">${nutritionActive ? "Активен" : "Не активирован"}</span>
            </div>
            ${nutritionActive ? `<p class="subscription-detail">до ${formatShortDateNoYear(untilIso)} · осталось ${remaining} ${plural(remaining, ["день", "дня", "дней"])}</p>
            ${progressMarkup(elapsed, days, `Использовано ${elapsed} из ${days} дней пакета питания`)}` : '<p class="subscription-detail">Пакет не активирован</p>'}
          </div>
        </div>
      </article>`;
  }

  function progressMarkup(value, total, label) {
    const percentValue = total ? Math.round((value / total) * 100) : 0;
    return `<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${value}" aria-label="${label}"><span class="progress-fill" style="--progress:${percentValue}%"></span></div>`;
  }

  function demoCard() {
    const status = CYCLE.status();
    const options = [
      { value: "active", label: "Активен" },
      { value: "completed", label: "Цикл завершён" },
      { value: "none", label: "Не активирован" },
    ];
    return `
      <article class="demo-card" data-demo="true">
        <div class="demo-head">
          <h2 class="demo-title">Только для демонстрации</h2>
          <span class="card-hint">демо</span>
        </div>
        <p class="demo-note">Состояние пакета тренировок. На реальных данных этот блок убирается.</p>
        <div class="demo-setting">
          <span class="demo-label" id="demo-training-label">Тренировки</span>
          <div class="segmented segmented--wrap" role="radiogroup" aria-labelledby="demo-training-label">
            ${options.map((option) => `<label class="segment"><input type="radio" name="training-status" value="${option.value}" data-action="set-training-status" data-status="${option.value}"${status === option.value ? " checked" : ""}><span>${option.label}</span></label>`).join("")}
          </div>
        </div>
        <button class="btn btn--ghost demo-reset" type="button" data-action="reset-demo" data-focus="reset-demo">Сбросить демо-данные</button>
      </article>`;
  }

  App.views.profile = { view: profileView };
})(window.App = window.App || {});
