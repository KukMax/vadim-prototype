/* Карточка клиента кабинета тренера (#/coach-client). Источник данных —
   только фикстуры js/coach.js: карточка не читает ни состояние клиента, ни
   план, ни калории. Выбранный клиент лежит в памяти (STATE.coachClientId) и в
   URL не попадает. Анкета — медицинские данные: только вывод в разметку, без
   логов и storage. */
(function (App) {
  "use strict";

  const { escapeHtml, icon, num, percent, plural, weight } = App.util;
  App.views = App.views || {};

  // Вес без хвостового «,0»: «92», но «86,4».
  function kg(value) {
    return weight(value).replace(/,0$/, "");
  }

  // «сегодня / вчера / N дней назад» — без глагола, чтобы фраза «активирован
  // 12 дней назад» собиралась как есть.
  function ago(days) {
    if (days === 0) return "сегодня";
    if (days === 1) return "вчера";
    return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;
  }

  function params(client) {
    const years = `${client.age} ${plural(client.age, ["год", "года", "лет"])}`;
    return `${years} · ${client.height} см · ${weight(client.weight)} кг`;
  }

  function backLink() {
    return `<a class="coach-back" href="#/coach" data-nav="coach" data-focus="coach-back">${icon("chevron-left")}<span>Все клиенты</span></a>`;
  }

  function cardHead(client) {
    const demo = client.isDemo
      ? `<p class="coach-demo">Демо-клиент: данные совпадают с демо-кабинетом</p>`
      : "";
    return `
      <header class="coach-card-head">
        <span class="coach-avatar coach-avatar--lg" aria-hidden="true">${escapeHtml(client.initials)}</span>
        <div class="coach-card-id">
          <h1 class="coach-title" id="coach-client-title" tabindex="-1">${escapeHtml(client.name)}</h1>
          <p class="coach-client-meta">${escapeHtml(params(client))}</p>
          <span class="chip coach-goal">${escapeHtml(client.goal)}</span>
          ${demo}
          <p class="coach-seen">${escapeHtml(App.coach.lastSeenLabel(client))}</p>
        </div>
      </header>`;
  }

  function goalBlock(client) {
    const delta = App.coach.weightDelta(client);
    if (delta.direction === "none") {
      return `
        <section class="coach-goal-block card">
          <h2 class="coach-block-title">Вес и цель</h2>
          <p class="coach-goal-main">Поддержание веса</p>
          <p class="coach-goal-caption">Старт ${kg(delta.from)} · сейчас ${kg(delta.to)} · цель ${kg(delta.target)} кг</p>
        </section>`;
    }
    return `
      <section class="coach-goal-block card">
        <h2 class="coach-block-title">Вес и цель</h2>
        <div class="coach-goal-grid">
          <span class="coach-goal-cell">
            <span class="coach-goal-label">Старт</span>
            <strong class="coach-goal-num">${kg(delta.from)}</strong>
          </span>
          <span class="coach-goal-arrow" aria-hidden="true">${icon("arrow-right")}</span>
          <span class="coach-goal-cell">
            <span class="coach-goal-label">Сейчас</span>
            <strong class="coach-goal-num">${kg(delta.to)}</strong>
          </span>
          <span class="coach-goal-arrow" aria-hidden="true">${icon("arrow-right")}</span>
          <span class="coach-goal-cell">
            <span class="coach-goal-label">Цель</span>
            <strong class="coach-goal-num">${kg(delta.target)}<span class="coach-goal-unit"> кг</span></strong>
          </span>
        </div>
        <div class="progress-track coach-progress" role="progressbar" aria-label="Прогресс к цели" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${delta.percent}" aria-valuetext="пройдено ${delta.percent} %">
          <span class="progress-fill" style="--progress:${delta.percent}%"></span>
        </div>
        <p class="coach-goal-caption">Пройдено ${delta.percent} % · осталось ${kg(delta.left)} кг</p>
      </section>`;
  }

  function packageRow(client, key) {
    const pkg = client.packages[key];
    const state = App.coach.packageState(pkg);
    const done = Math.min(pkg.used, pkg.total);
    const when = pkg.startedDaysAgo === null ? "" : `активирован ${ago(pkg.startedDaysAgo)}`;
    return `
      <li class="coach-package coach-package--${state}">
        <span class="coach-package-top">
          <span class="coach-package-name">${escapeHtml(App.coach.packageTitle(key))}</span>
          <span class="coach-package-frac">${pkg.used}/${pkg.total}</span>
        </span>
        <span class="bar-track coach-bar"><span class="bar-fill" style="--bar-w:${percent(done, pkg.total)}%"></span></span>
        <span class="coach-package-bottom">
          <span class="coach-package-note">${escapeHtml(App.coach.packageLabel(pkg))}</span>
          <span class="coach-package-when">${escapeHtml(when)}</span>
        </span>
      </li>`;
  }

  function packagesBlock(client) {
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Пакеты</h2>
        <ul class="coach-packages">
          ${App.coach.packageKeys.map((key) => packageRow(client, key)).join("")}
        </ul>
      </section>`;
  }

  function fact(label, value) {
    const empty = value === null || value === undefined || value === "";
    const text = empty ? "не указано" : String(value);
    return `<div class="coach-fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd></div>`;
  }

  function factsBlock(client) {
    const questionnaire = client.questionnaire;
    const sessions = `${questionnaire.sessions} ${plural(questionnaire.sessions, ["раз", "раза", "раз"])} в неделю`;
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Анкета</h2>
        <dl class="coach-facts">
          ${fact("Пол", questionnaire.sex)}
          ${fact("Активность", questionnaire.activity)}
          ${fact("Тренировок в неделю", sessions)}
          ${fact("Уровень", questionnaire.level)}
          ${fact("Ограничения", questionnaire.limits)}
          ${fact("Аллергии", questionnaire.allergies)}
          ${fact("Пищевые ограничения", questionnaire.foodLimits)}
        </dl>
      </section>`;
  }

  function trainingBlock(client) {
    const pkg = client.packages.training;
    const last = client.lastTraining;
    const lastLine = last ? `${escapeHtml(last.title)} · ${escapeHtml(ago(last.daysAgo))}` : "Нет данных";
    const next = client.nextTraining ? escapeHtml(client.nextTraining) : "Не назначена";
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Тренировки</h2>
        <dl class="coach-rows">
          <div class="coach-row"><dt>Программа</dt><dd>${pkg.total} ${plural(pkg.total, ["занятие", "занятия", "занятий"])}</dd></div>
          <div class="coach-row"><dt>Выполнено</dt><dd>${pkg.used} из ${pkg.total}</dd></div>
          <div class="coach-row"><dt>Последняя</dt><dd>${lastLine}</dd></div>
          <div class="coach-row"><dt>Следующая по плану</dt><dd>${next}</dd></div>
        </dl>
      </section>`;
  }

  function nutritionBlock(client) {
    const nutrition = client.nutrition;
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Питание</h2>
        <dl class="coach-rows">
          <div class="coach-row"><dt>Норма</dt><dd>${num(nutrition.targetKcal)} ккал</dd></div>
          <div class="coach-row"><dt>Среднее за неделю</dt><dd>${num(nutrition.avgKcal)} ккал</dd></div>
          <div class="coach-row"><dt>Отклонение от нормы</dt><dd>${escapeHtml(App.coach.budgetLabel(client))}</dd></div>
          <div class="coach-row"><dt>Вода</dt><dd>${nutrition.avgWater} из ${nutrition.targetWater} стаканов</dd></div>
        </dl>
      </section>`;
  }

  function noteBlock(client) {
    return `
      <section class="coach-note card">
        <h2 class="coach-block-title">Заметка Вадима</h2>
        <p class="coach-note-text">${escapeHtml(client.note)}</p>
        <p class="coach-note-caption">Редактирование появится позже</p>
      </section>`;
  }

  function actionsBlock() {
    const coach = App.data.coach;
    return `
      <div class="coach-actions">
        <a class="btn btn--primary" href="tel:${escapeHtml(coach.phone)}">${icon("phone")}<span>Позвонить</span></a>
        <a class="btn btn--ghost" href="${escapeHtml(coach.telegramUrl)}" target="_blank" rel="noopener noreferrer">${icon("send")}<span>Написать в Telegram</span></a>
        <a class="btn btn--ghost" href="#/coach" data-nav="coach" data-focus="coach-back">${icon("chevron-left")}<span>Все клиенты</span></a>
      </div>`;
  }

  function coachClientView() {
    const client = App.coach.find(App.state.coachClientId);
    // guardRoute() уже увёл бы без выбранного клиента в список; ветка — только
    // страховка на случай прямого вызова render().
    if (!client) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Клиент не выбран.</p></div>`;
    }
    return `
    <div class="coach coach-client-page">
      ${backLink()}
      ${cardHead(client)}
      ${goalBlock(client)}
      ${packagesBlock(client)}
      ${factsBlock(client)}
      <div class="coach-blocks">
        ${trainingBlock(client)}
        ${nutritionBlock(client)}
      </div>
      ${noteBlock(client)}
      ${actionsBlock()}
    </div>`;
  }

  App.views["coach-client"] = { view: coachClientView };
})(window.App = window.App || {});
