(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const CYCLE = App.cycle;
  const SUB = App.subscription;
  const {
    icon, escapeHtml, plural, formatShortDateNoYear,
  } = App.util;
  App.views = App.views || {};

  // Название цели — из списка анкеты, без хардкода: у нового клиента своя цель.
  function goalText(key) {
    const goals = DATA.questionnaire && DATA.questionnaire.goals ? DATA.questionnaire.goals : [];
    const found = goals.filter((entry) => entry.key === key)[0];
    const label = found ? found.label : DATA.client.goal;
    return label.charAt(0).toLowerCase() + label.slice(1);
  }

  function profileView() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Аккаунт</span>
        <h1 class="page-title" id="profile-title" tabindex="-1">Профиль</h1>
      </div>
      <div class="profile-grid">
        ${identityCard()}
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
            <button class="action-row" type="button" data-action="open-questionnaire"><span class="action-icon">${icon("user")}</span><span class="action-label">Моя анкета</span><span class="action-chevron" aria-hidden="true">${icon("chevron-right")}</span></button>
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

  function identityCard() {
    const avatar = STATE.profile.avatar;
    const answers = STATE.questionnaire;
    return `
      <article class="identity-card card">
        <div class="identity-main">
          <span class="identity-avatar">
            ${avatar ? `<img class="avatar-img" src="${avatar}" alt="">` : `<span class="avatar avatar--xl" aria-hidden="true">${escapeHtml(App.profile.initial())}</span>`}
          </span>
          <div class="identity-copy">
            <h2>${escapeHtml(App.profile.displayName())}</h2>
            <span class="goal-chip">Цель: ${escapeHtml(goalText(answers && answers.goal))}</span>
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

  // Чип статуса пакета. «Срок истёк» — отдельное состояние: пакет активен по
  // статусу, но 30 дней уже прошли, поэтому он ведёт себя как завершённый.
  function statusChip(status, expired, completedLabel) {
    if (expired) return { className: "chip chip--done", label: "Срок истёк" };
    if (status === "active") return { className: "chip chip--accent", label: "Активен" };
    if (status === "completed") return { className: "chip chip--done", label: completedLabel || "Цикл завершён" };
    if (status === "pending") return { className: "chip chip--pending", label: "Ожидает активации" };
    return { className: "chip chip--muted", label: "Не активирован" };
  }

  // Срок действия пакета: строка «до <дата> · осталось N дн.» у активных
  // и короткая пометка у истёкших.
  function termLine(info) {
    if (info.expired) return `${info.days} ${plural(info.days, ["день", "дня", "дней"])} пакета закончились`;
    const left = info.daysLeft;
    return `до ${formatShortDateNoYear(info.until)} · осталось ${left} ${plural(left, ["день", "дня", "дней"])}`;
  }

  function termProgress(info, label) {
    const used = Math.max(0, info.days - info.daysLeft);
    return progressMarkup(used, info.days, label);
  }

  function subscriptionCard() {
    const total = DATA.subscription.training.sessions;
    const cycleData = CYCLE.current();
    const done = CYCLE.doneCount(cycleData);
    const trainingStatus = SUB.status("training");
    const nutritionStatus = SUB.status("nutrition");
    const trainingInfo = SUB.info("training");
    const nutritionInfo = SUB.info("nutrition");
    const training = statusChip(trainingStatus, trainingInfo.expired);
    const nutrition = statusChip(nutritionStatus, nutritionInfo.expired, "Пакет завершён");
    const allActive = trainingStatus === "active" && nutritionStatus === "active";
    const waiting = trainingStatus === "pending" || nutritionStatus === "pending";

    let trainingDetail = "Пакет не активирован";
    let trainingTerm = "";
    let trainingBar = "";
    if (trainingStatus === "pending") trainingDetail = "Активация после ответа Вадима";
    else if (trainingInfo.expired) {
      trainingDetail = `${done} из ${total} тренировок`;
      trainingTerm = termLine(trainingInfo);
      trainingBar = termProgress(trainingInfo, `Использовано ${trainingInfo.days - trainingInfo.daysLeft} из ${trainingInfo.days} дней пакета тренировок`);
    } else if (trainingStatus === "completed") {
      trainingDetail = `${total} из ${total} тренировок · цикл завершён`;
      trainingBar = progressMarkup(done, total, "Цикл тренировок завершён");
    } else if (trainingStatus === "active") {
      trainingDetail = `${done} из ${total} тренировок`;
      trainingTerm = termLine(trainingInfo);
      trainingBar = termProgress(trainingInfo, `Использовано ${trainingInfo.days - trainingInfo.daysLeft} из ${trainingInfo.days} дней пакета тренировок`);
    }

    let nutritionDetail = "Пакет не активирован";
    let nutritionTerm = "";
    let nutritionBar = "";
    if (nutritionStatus === "pending") nutritionDetail = "Активация после ответа Вадима";
    else if (nutritionInfo.expired) {
      nutritionDetail = termLine(nutritionInfo);
      nutritionBar = termProgress(nutritionInfo, `Использовано ${nutritionInfo.days} из ${nutritionInfo.days} дней пакета питания`);
    } else if (nutritionStatus === "completed") nutritionDetail = "Пакет завершён";
    else if (nutritionStatus === "active") {
      nutritionDetail = termLine(nutritionInfo);
      nutritionBar = termProgress(nutritionInfo, `Использовано ${nutritionInfo.days - nutritionInfo.daysLeft} из ${nutritionInfo.days} дней пакета питания`);
    }

    return `
      <article class="subscription-card card">
        <div class="card-head"><h2 class="card-title">Подписка</h2><span class="card-hint">${waiting ? "ожидает активации" : allActive ? "активна" : "пакеты"}</span></div>
        <div class="subscription-rows">
          <div class="subscription-row">
            <div class="subscription-row-head">
              <span class="subscription-name">Тренировки</span>
              <span class="${training.className}">${training.label}</span>
            </div>
            <p class="subscription-detail">${escapeHtml(trainingDetail)}</p>
            ${trainingTerm ? `<p class="subscription-detail">${escapeHtml(trainingTerm)}</p>` : ""}
            ${trainingBar}
          </div>
          <div class="subscription-row">
            <div class="subscription-row-head">
              <span class="subscription-name">Питание</span>
              <span class="${nutrition.className}">${nutrition.label}</span>
            </div>
            <p class="subscription-detail">${escapeHtml(nutritionDetail)}</p>
            ${nutritionTerm ? `<p class="subscription-detail">${escapeHtml(nutritionTerm)}</p>` : ""}
            ${nutritionBar}
          </div>
        </div>
      </article>`;
  }

  function progressMarkup(value, total, label) {
    const percentValue = total ? Math.round((value / total) * 100) : 0;
    return `<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${value}" aria-label="${label}"><span class="progress-fill" style="--progress:${percentValue}%"></span></div>`;
  }

  function segmentedMarkup(name, labelId, label, options, current, action) {
    return `
        <div class="demo-setting">
          <span class="demo-label" id="${labelId}">${label}</span>
          <div class="segmented segmented--wrap${options.length > 3 ? " segmented--4" : ""}" role="radiogroup" aria-labelledby="${labelId}">
            ${options.map((option) => `<label class="segment"><input type="radio" name="${name}" value="${option.value}" data-action="${action}" data-status="${option.value}"${current === option.value ? " checked" : ""}><span>${option.label}</span></label>`).join("")}
          </div>
        </div>`;
  }

  function demoCard() {
    const trainingOptions = [
      { value: "active", label: "Активен" },
      { value: "completed", label: "Цикл завершён" },
      { value: "expired", label: "Срок истёк" },
      { value: "pending", label: "Ожидает" },
      { value: "none", label: "Не активирован" },
    ];
    const nutritionOptions = [
      { value: "active", label: "Активен" },
      { value: "expired", label: "Срок истёк" },
      { value: "pending", label: "Ожидает" },
      { value: "none", label: "Не активирован" },
    ];
    const trainingStatus = STATE.training.status;
    const nutritionStatus = STATE.nutrition ? STATE.nutrition.status : "none";
    // «Срок истёк» — то же состояние active, поэтому сегмент выбираем по флагу.
    const trainingCurrent = trainingStatus === "active" && SUB.info("training").expired ? "expired" : trainingStatus;
    const nutritionCurrent = nutritionStatus === "active" && SUB.info("nutrition").expired ? "expired" : nutritionStatus;
    return `
      <article class="demo-card" data-demo="true">
        <div class="demo-head">
          <h2 class="demo-title">Только для демонстрации</h2>
          <span class="card-hint">демо</span>
        </div>
        <p class="demo-note">Состояние пакетов. На реальных данных этот блок убирается.</p>
        ${segmentedMarkup("training-status", "demo-training-label", "Тренировки", trainingOptions, trainingCurrent, "set-training-status")}
        ${segmentedMarkup("nutrition-status", "demo-nutrition-label", "Питание", nutritionOptions, nutritionCurrent, "set-nutrition-status")}
        <button class="btn btn--ghost demo-reset" type="button" data-action="reset-demo" data-focus="reset-demo">Сбросить демо-данные</button>
      </article>`;
  }

  App.views.profile = { view: profileView };
})(window.App = window.App || {});
