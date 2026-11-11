/* Карточка клиента кабинета тренера (#/coach-client). Источник данных —
   только фикстуры js/coach.js: карточка не читает ни состояние клиента, ни
   план, ни калории. Выбранный клиент лежит в памяти (STATE.coachClientId) и в
   URL не попадает. Анкета — медицинские данные: только вывод в разметку, без
   логов и storage.

   Режим «Просмотр | Редактор»: тренер правит целевой вес, заметку и объёмы
   пакетов. Правки складываются в STATE.coachOverrides и живут до перезагрузки:
   localStorage, URL и фикстуры js/coach.js не трогаются. Анкета, тренировки,
   питание и прогресс остаются только для чтения. */
(function (App) {
  "use strict";

  const { escapeHtml, icon, num, percent, plural, weight } = App.util;
  App.views = App.views || {};

  const LIMITS = App.coach.limits;

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

  // Сегментированный переключатель режима: две кнопки, каждая не ниже 44px.
  function modeToggle() {
    const editing = App.state.coachMode === "edit";
    const button = (mode, label, focus) => {
      const on = editing === (mode === "edit");
      return `<button class="coach-mode-btn${on ? " is-on" : ""}" type="button" data-action="coach-mode" data-mode="${mode}" data-focus="${focus}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
    };
    return `
      <div class="coach-mode" role="group" aria-label="Режим карточки">
        ${button("view", "Просмотр", "coach-mode-view")}
        ${button("edit", "Редактор", "coach-mode-edit")}
      </div>`;
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
        ${modeToggle()}
      </header>`;
  }

  // Редактор веса: числа и полоса слева остаются от сохранённых значений,
  // меняется только поле цели. Пересчёт — после сохранения.
  function goalEditBlock(client, draft) {
    const delta = App.coach.weightDelta(client);
    const bar =
      delta.percent === null
        ? ""
        : `<div class="progress-track coach-progress" role="progressbar" aria-label="Прогресс к цели" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${delta.percent}" aria-valuetext="пройдено ${delta.percent} %">
          <span class="progress-fill" style="--progress:${delta.percent}%"></span>
        </div>`;
    return `
      <section class="coach-goal-block coach-goal-block--edit card">
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
          <span class="coach-field coach-goal-cell">
            <label class="coach-field-label" for="coach-target-weight">Целевой вес, кг</label>
            <input class="coach-input coach-input--num" id="coach-target-weight" type="number" min="${LIMITS.weightMin}" max="${LIMITS.weightMax}" step="0.1" inputmode="decimal" autocomplete="off" value="${escapeHtml(draft.targetWeight)}" data-coach-field="targetWeight" data-focus="coach-target-weight">
          </span>
        </div>
        ${bar}
        <p class="coach-goal-caption">Прогресс и статусы пакетов пересчитаются после сохранения.</p>
      </section>`;
  }

  function goalBlock(client, draft) {
    if (draft) return goalEditBlock(client, draft);
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

  // Объём тренировок полем не вводится: он считается из программы (дни ×
  // круги), поэтому в редакторе стоит только чтение. Объём питания правится.
  function packageVolumeEdit(client, key, pkg, draft) {
    if (key === "training") {
      const totals = App.coach.programTotals(App.coach.program(client.id));
      return `
        <span class="coach-field coach-package-edit">
          <span class="coach-field-label">Объём пакета тренировок</span>
          <span class="coach-package-static" data-package-static="training">${totals.workouts} ${plural(totals.workouts, ["тренировка", "тренировки", "тренировок"])} · ${totals.days} ${plural(totals.days, ["день", "дня", "дней"])} × ${totals.rounds} ${plural(totals.rounds, ["круг", "круга", "кругов"])}</span>
          <span class="coach-hint">считается из программы клиента</span>
        </span>`;
    }
    return `
        <span class="coach-field coach-package-edit">
          <label class="coach-field-label" for="coach-${key}-total">Объём пакета ${escapeHtml(App.coach.packageGenitive(key))}</label>
          <input class="coach-input coach-input--num" id="coach-${key}-total" type="number" min="0" max="${LIMITS.packageMax[key]}" step="1" inputmode="numeric" autocomplete="off" value="${escapeHtml(draft[key + "Total"])}" data-coach-field="${key}Total" data-focus="coach-${key}-total">
          <span class="coach-hint">израсходовано ${pkg.used} из ${pkg.total}</span>
        </span>`;
  }

  function packageRow(client, key, draft) {
    const pkg = App.coach.packageView(client, key) || client.packages[key];
    const state = App.coach.packageState(pkg);
    const done = Math.min(pkg.used, pkg.total);
    const when = pkg.startedDaysAgo === null ? "" : `активирован ${ago(pkg.startedDaysAgo)}`;
    const field = draft ? packageVolumeEdit(client, key, pkg, draft) : "";
    const active = App.coach.packageActive(client, key);
    const canToggle = pkg.total > 0;
    // 11N. Класс кнопки показывает состояние пакета, а не только её текст.
    const toggleState = active ? "is-on" : "is-off";
    const toggle = `
        <button class="btn coach-package-toggle ${toggleState}" type="button" data-action="coach-package-toggle" data-client="${escapeHtml(client.id)}" data-package="${escapeHtml(key)}" data-focus="coach-package-toggle-${escapeHtml(key)}"${canToggle ? "" : " disabled aria-disabled=\"true\""}>${active ? "Деактивировать" : "Активировать"}</button>`;
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
        ${field}
        ${toggle}
      </li>`;
  }

  function packagesBlock(client, draft) {
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Пакеты</h2>
        <ul class="coach-packages">
          ${App.coach.packageKeys.map((key) => packageRow(client, key, draft)).join("")}
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

  // Сводка программы: дни, круги, срок и производный объём пакета. Формат общий
  // с экраном программы — его собирает App.coach.programLine().
  function programSummary(client) {
    return App.coach.programLine(App.coach.program(client.id));
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
          <div class="coach-row"><dt>Программа</dt><dd data-program-line>${escapeHtml(programSummary(client))}</dd></div>
          <div class="coach-row"><dt>Выполнено</dt><dd>${pkg.used} из ${pkg.total}</dd></div>
          <div class="coach-row"><dt>Последняя</dt><dd>${lastLine}</dd></div>
          <div class="coach-row"><dt>Следующая по плану</dt><dd>${next}</dd></div>
        </dl>
        <div class="coach-program" data-program>
          <button class="coach-program-day coach-program-day--link" type="button" data-action="open-coach-program" data-focus="coach-program-link">
            <span class="coach-program-text">
              <span class="coach-program-name">Открыть программу</span>
              <span class="coach-program-meta">дни, круги и срок пакета</span>
            </span>
            ${icon("chevron-right")}
          </button>
          <button class="coach-program-day coach-program-day--link" type="button" data-action="open-coach-archive" data-tab="training" data-focus="coach-archive-open-training">
            <span class="coach-program-text">
              <span class="coach-program-name">Архив тренировок</span>
              <span class="coach-program-meta">тоннаж, КПШ и дни пакета</span>
            </span>
            ${icon("chevron-right")}
          </button>
        </div>
      </section>`;
  }

  function nutritionBlock(client) {
    const nutrition = client.nutrition;
    const norm = App.coach.nutritionNorm(client);
    const badge = App.coach.hasNorm(client.id)
      ? ' <span class="coach-badge">правка тренера</span>'
      : "";
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Питание${badge}</h2>
        <dl class="coach-rows">
          <div class="coach-row"><dt>Норма</dt><dd data-norm-kcal>${num(norm.kcal)} ккал</dd></div>
          <div class="coach-row"><dt>БЖУ</dt><dd data-norm-macros>${num(norm.protein)} / ${num(norm.fat)} / ${num(norm.carbs)} г</dd></div>
          <div class="coach-row"><dt>Среднее за неделю</dt><dd>${num(nutrition.avgKcal)} ккал</dd></div>
          <div class="coach-row"><dt>Отклонение от нормы</dt><dd>${escapeHtml(App.coach.budgetLabel(client))}</dd></div>
          <div class="coach-row"><dt>Вода</dt><dd>${nutrition.avgWater} из ${nutrition.targetWater} стаканов</dd></div>
        </dl>
        <div class="coach-program" data-norm>
          <button class="coach-program-day coach-program-day--link" type="button" data-action="open-coach-nutrition" data-focus="coach-nutrition-open">
            <span class="coach-program-text">
              <span class="coach-program-name">Настроить КБЖУ</span>
              <span class="coach-program-meta">калорийность, граммы и доли</span>
            </span>
            ${icon("chevron-right")}
          </button>
          <button class="coach-program-day coach-program-day--link" type="button" data-action="open-coach-food" data-focus="coach-food-open">
            <span class="coach-program-text">
              <span class="coach-program-name">Дни питания</span>
              <span class="coach-program-meta">${App.coach.foodDayCount(client.id)} из ${client.packages.nutrition.used} дней заполнено</span>
            </span>
            ${icon("chevron-right")}
          </button>
          <button class="coach-program-day coach-program-day--link" type="button" data-action="open-coach-archive" data-tab="nutrition" data-focus="coach-archive-open-nutrition">
            <span class="coach-program-text">
              <span class="coach-program-name">Архив питания</span>
              <span class="coach-program-meta">норма, факт по дням и вес</span>
            </span>
            ${icon("chevron-right")}
          </button>
        </div>
      </section>`;
  }

  function noteCounter(note) {
    return String(note || "").length + " / " + LIMITS.noteMax;
  }

  function noteBlock(client, draft) {
    if (draft) {
      return `
      <section class="coach-note card">
        <h2 class="coach-block-title">Заметка Вадима</h2>
        <div class="coach-field">
          <label class="coach-field-label" for="coach-note">Заметка</label>
          <textarea class="coach-input coach-textarea" id="coach-note" rows="4" data-coach-field="note" data-focus="coach-note">${escapeHtml(draft.note)}</textarea>
          <span class="coach-hint coach-counter" data-coach-counter aria-live="polite">${noteCounter(draft.note)}</span>
        </div>
      </section>`;
    }
    return `
      <section class="coach-note card">
        <h2 class="coach-block-title">Заметка Вадима</h2>
        <p class="coach-note-text">${escapeHtml(client.note)}</p>
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

  // Пометка в режиме просмотра: правки есть, но живут только в памяти.
  function overridesBlock(client) {
    if (!App.coach.hasOverrides(client.id)) return "";
    return `
      <p class="coach-dirty">
        <span class="coach-dirty-text">Есть правки — до перезагрузки</span>
        <button class="coach-reset" type="button" data-action="coach-reset" data-client="${escapeHtml(client.id)}" data-focus="coach-reset">Сбросить правки</button>
      </p>`;
  }

  // Липкая панель редактора. Кнопка «Сохранить» включает app.js, когда черновик
  // расходится с сохранёнными значениями.
  function saveBar() {
    return `
      <form class="coach-savebar" data-coach-form novalidate>
        <button class="btn btn--ghost" type="button" data-action="coach-cancel" data-focus="coach-cancel">Отмена</button>
        <button class="btn btn--primary" type="submit" disabled aria-disabled="true">Сохранить</button>
      </form>`;
  }

  function coachClientView() {
    const client = App.coach.find(App.state.coachClientId);
    // guardRoute() уже увёл бы без выбранного клиента в список; ветка — только
    // страховка на случай прямого вызова render().
    if (!client) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Клиент не выбран.</p></div>`;
    }
    const editing = App.state.coachMode === "edit";
    let draft = editing ? App.state.coachDraft : null;
    if (editing && !draft) {
      draft = App.coach.draft(client);
      App.state.coachDraft = draft;
    }
    const banner = editing
      ? `<p class="coach-mode-banner" role="status">Режим редактора. Правки хранятся в памяти и исчезнут после перезагрузки.</p>`
      : "";
    return `
    <div class="coach coach-client-page">
      <div class="coach-client-top">
        ${backLink()}
        ${cardHead(client)}
      </div>
      ${banner}
      <div class="coach-client-cols">
        <div class="coach-col">
          ${goalBlock(client, draft)}
          ${packagesBlock(client, draft)}
          ${factsBlock(client)}
        </div>
        <div class="coach-col">
          <div class="coach-blocks">
            ${trainingBlock(client)}
            ${nutritionBlock(client)}
          </div>
          ${noteBlock(client, draft)}
          ${editing ? "" : overridesBlock(client)}
          ${actionsBlock()}
        </div>
      </div>
      ${editing ? saveBar() : ""}
    </div>`;
  }

  App.views["coach-client"] = { view: coachClientView };
})(window.App = window.App || {});
