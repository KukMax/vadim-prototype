/* Программа клиента кабинета тренера (#/coach-program). Тренер выбирает дни из
   шаблонов js/data.js, их порядок, число кругов и срок пакета; объём пакета
   тренировок не вводится — он считается как дни × круги (см. js/coach.js).
   Программа хранится только в памяти (STATE.coachPrograms), после перезагрузки
   остаются исходные шаблоны и объём 12 тренировок. Состав упражнений правится
   в редакторе дня (#/coach-training). */
(function (App) {
  "use strict";

  const { escapeHtml, icon, plural } = App.util;
  App.views = App.views || {};

  const LIMITS = App.coach.programLimits;
  const DAY_LIMITS = App.coach.dayLimits;
  const WORKOUT_WORD = ["тренировка", "тренировки", "тренировок"];
  const EXERCISE_WORD = ["упражнение", "упражнения", "упражнений"];
  const SET_WORD = ["подход", "подхода", "подходов"];

  function count(value, forms) {
    return value + " " + plural(value, forms);
  }

  function backLink() {
    return `<a class="coach-back" href="#/coach-client" data-nav="coach-client" data-focus="coach-program-back">${icon("chevron-left")}<span>Клиент</span></a>`;
  }

  // Живой пересчёт объёма: видно, откуда берётся «12 тренировок». Формат один
  // на весь экран — его же обновляет app.js при вводе кругов и срока.
  function calcLine(totals) {
    return App.coach.programLine(totals);
  }

  function packageLine(totals, used) {
    const left = Math.max(0, totals.workouts - used);
    return (
      count(totals.workouts, WORKOUT_WORD) +
      " · израсходовано " +
      used +
      " · осталось " +
      left
    );
  }

  // Сегментированный переключатель режима: две кнопки по 44px.
  function modeToggle() {
    const editing = App.state.coachPlanMode === "edit";
    const button = (mode, label, focus) => {
      const on = editing === (mode === "edit");
      return `<button class="coach-mode-btn${on ? " is-on" : ""}" type="button" data-action="coach-program-mode" data-mode="${mode}" data-focus="${focus}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
    };
    return `
      <div class="coach-mode" role="group" aria-label="Режим программы">
        ${button("view", "Просмотр", "coach-plan-view")}
        ${button("edit", "Редактор", "coach-plan-edit")}
      </div>`;
  }

  // Строка дня в просмотре — только счётчики: «День 1 · A · Грудь и спина ·
  // 6 упражнений · 24 подхода». Мышцы дня видны в редакторе дня, дублировать
  // их здесь незачем.
  function dayMeta(day) {
    const summary = App.coach.daySummary(day);
    return [count(summary.exercises, EXERCISE_WORD), count(summary.sets, SET_WORD)]
      .filter(Boolean)
      .join(" · ");
  }

  /* ---------- просмотр ---------- */

  // День из шаблона подписан его буквой (A/B/C/D), новый день — только номером:
  // "День 1 · A · Грудь и спина" против "День 5 · Новая тренировка".
  function dayLabel(day, index) {
    const key = String(day.dayId || "");
    const letter = key.length === 1 ? key + " · " : "";
    return "День " + (index + 1) + " · " + letter + day.title;
  }

  function viewRow(day, index) {
    const title = dayLabel(day, index);
    const id = escapeHtml(day.dayId);
    return `
      <li class="coach-program-day" data-day-row="${id}">
        <span class="coach-program-text">
          <span class="coach-program-name">${escapeHtml(title)}</span>
          <span class="coach-program-meta">${escapeHtml(dayMeta(day))}</span>
        </span>
        <button class="coach-program-open" type="button" data-action="open-coach-training" data-day="${id}" data-focus="coach-plan-open-${id}" aria-label="Открыть день ${index + 1}">Открыть</button>
      </li>`;
  }

  function viewDays(program) {
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Дни программы</h2>
        <ol class="coach-program-days">${program.days.map(viewRow).join("")}</ol>
      </section>`;
  }

  function packageBlock(totals, client) {
    const used = client.packages.training.used;
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Пакет</h2>
        <p class="coach-program-total">${escapeHtml(packageLine(totals, used))}</p>
        <p class="coach-hint">Объём считается из дней и кругов — ${escapeHtml(calcLine(totals))}.</p>
      </section>`;
  }

  // Пометка, что программа правилась: сброс возвращает шаблоны и 12 тренировок.
  function resetBlock(client) {
    if (!App.coach.isCustomProgram(client.id)) return "";
    return `
      <p class="coach-dirty">
        <span class="coach-dirty-text">Программа изменена — до перезагрузки</span>
        <button class="coach-reset" type="button" data-action="coach-program-reset" data-focus="coach-plan-reset">Сбросить программу</button>
      </p>`;
  }

  function viewMode(client, program, totals) {
    return `
      ${viewDays(program)}
      ${packageBlock(totals, client)}
      ${resetBlock(client)}`;
  }

  /* ---------- редактор ---------- */

  function numberField(label, field, value, min, max, id, hint) {
    return `
      <div class="coach-program-field">
        <label class="coach-field-label" for="${id}">${label}</label>
        <input class="coach-input" id="${id}" type="number" min="${min}" max="${max}" step="1" inputmode="numeric" autocomplete="off" value="${escapeHtml(value)}" data-program-field="${field}" data-focus="${id}">
        <span class="coach-hint">${escapeHtml(hint)}</span>
      </div>`;
  }

  function editPackage(draft) {
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Пакет</h2>
        <div class="coach-program-fields">
          ${numberField("Кругов в пакете", "rounds", draft.rounds, LIMITS.roundsMin, LIMITS.roundsMax, "coach-plan-rounds", "Сколько раз повторяется каждый день")}
          ${numberField("Срок пакета, дней", "durationDays", draft.durationDays, LIMITS.durationMin, LIMITS.durationMax, "coach-plan-duration", "От " + LIMITS.durationMin + " до " + LIMITS.durationMax + " дней")}
        </div>
        <p class="coach-program-total" data-program-total>${escapeHtml(calcLine(App.coach.programTotals(draft)))}</p>
        <p class="coach-hint">Объём пакета — это дни × круги, отдельно его вводить не нужно.</p>
        <div class="coach-program-errors" data-program-errors tabindex="-1"></div>
      </section>`;
  }

  function editTools(day, index, total) {
    const id = escapeHtml(day.dayId);
    return `
          <div class="coach-program-tools">
            <button class="coach-icon-btn" type="button" data-action="coach-move-day" data-dir="-1" data-day="${id}" data-focus="coach-plan-up-${id}" aria-label="Выше" title="Выше"${index === 0 ? " disabled" : ""}>${icon("arrow-up")}</button>
            <button class="coach-icon-btn" type="button" data-action="coach-move-day" data-dir="1" data-day="${id}" data-focus="coach-plan-down-${id}" aria-label="Ниже" title="Ниже"${index === total - 1 ? " disabled" : ""}>${icon("arrow-down")}</button>
            <button class="btn btn--ghost coach-program-open" type="button" data-action="open-coach-training" data-day="${id}" data-focus="coach-plan-open-${id}" aria-label="Открыть день ${index + 1}">Открыть</button>
            <button class="coach-reset coach-program-remove" type="button" data-action="coach-remove-day" data-day="${id}" data-focus="coach-plan-remove-${id}" aria-label="Убрать день ${index + 1}" title="Убрать день ${index + 1}"${total === 1 ? " disabled" : ""}><span class="coach-program-remove-icon" aria-hidden="true">${icon("trash")}</span><span class="coach-program-remove-text">Убрать</span></button>
          </div>`;
  }

  function editRow(day, index, total) {
    const id = escapeHtml(day.dayId);
    const summary = App.coach.daySummary(day);
    return `
      <li class="coach-program-day" data-day-row="${id}">
        <div class="coach-program-day-head">
          <div class="coach-program-field">
            <label class="coach-field-label" for="coach-plan-title-${id}">День ${index + 1}</label>
            <input class="coach-input" id="coach-plan-title-${id}" type="text" maxlength="${DAY_LIMITS.titleMax}" autocomplete="off" value="${escapeHtml(day.title)}" data-day-field="title" data-day="${id}" data-focus="coach-plan-title-${id}">
          </div>
          <p class="coach-program-meta">${escapeHtml(count(summary.exercises, EXERCISE_WORD) + " · " + count(summary.sets, SET_WORD))}</p>
        </div>
        ${editTools(day, index, total)}
      </li>`;
  }

  function editDays(draft) {
    const total = draft.days.length;
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Дни программы</h2>
        <ol class="coach-program-days coach-program-days--edit">${draft.days.map((item, index) => editRow(item, index, total)).join("")}</ol>
        <button class="btn btn--ghost coach-program-add" type="button" data-action="coach-add-day" data-focus="coach-plan-add">${icon("plus")}<span>Добавить день</span></button>
        <p class="coach-hint">Новый день открывается в редакторе тренировки — упражнения добавляются там.</p>
      </section>`;
  }

  function saveBar() {
    return `
      <form class="coach-savebar" data-program-form novalidate>
        <button class="btn btn--ghost" type="button" data-action="coach-program-cancel" data-focus="coach-plan-cancel">Отмена</button>
        <button class="btn btn--primary" type="submit" data-focus="coach-plan-save" disabled aria-disabled="true">Сохранить</button>
      </form>`;
  }

  function coachProgramView() {
    const client = App.coach.find(App.state.coachClientId);
    // guardRoute() уже увёл бы без клиента; ветка — страховка для прямого render().
    if (!client) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Клиент не выбран.</p></div>`;
    }
    const program = App.coach.program(client.id);
    const editing = App.state.coachPlanMode === "edit";
    let draft = editing ? App.state.coachPlanDraft : null;
    if (editing && !draft) {
      draft = App.coach.programDraft(program);
      App.state.coachPlanDraft = draft;
    }
    const canEdit = editing && !!draft;
    const totals = App.coach.programTotals(canEdit ? draft : program);
    return `
    <div class="coach coach-program-page">
      ${backLink()}
      <header class="coach-day-head">
        <p class="coach-client-line">${escapeHtml(client.name)}</p>
        <h1 class="coach-title" id="coach-program-title" tabindex="-1">Программа</h1>
        <p class="coach-client-meta" data-program-summary>${escapeHtml(App.coach.programSummary(totals))}</p>
        ${modeToggle()}
      </header>
      ${canEdit ? `<p class="coach-mode-banner" role="status">Режим редактора. Программа хранится в памяти и исчезнет после перезагрузки.</p>` : ""}
      ${canEdit ? editPackage(draft) : ""}
      ${canEdit ? editDays(draft) : viewMode(client, program, totals)}
      ${canEdit ? saveBar() : ""}
    </div>`;
  }

  App.views["coach-program"] = { view: coachProgramView };
})(window.App = window.App || {});
