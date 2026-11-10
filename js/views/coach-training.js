/* Тренировочный день кабинета тренера (#/coach-training). Программа клиента —
   копия шаблонов js/data.js, собранная в js/coach.js: дни живут только в памяти
   (STATE.coachPrograms), шаблоны, localStorage и URL не переписываются. Редактор
   правит название дня и упражнения; подходы, повторы и вес задаются общими для
   всех подходов упражнения. После перезагрузки остаются исходные шаблоны. */
(function (App) {
  "use strict";

  const { escapeHtml, icon, plural, weight } = App.util;
  App.views = App.views || {};

  const LIMITS = App.coach.dayLimits;

  // Вес без хвостового «,0»: «40», но «17,5».
  function kg(value) {
    return weight(value).replace(/,0$/, "");
  }

  function backLink() {
    // День открывали из редактора программы — возвращаемся туда, а не в карточку.
    const toProgram = !!App.state.coachPlanDraft || App.state.coachTrainingFrom === "program";
    const route = toProgram ? "coach-program" : "coach-client";
    const label = toProgram ? "Программа" : "Клиент";
    return `<a class="coach-back" href="#/${route}" data-nav="${route}" data-focus="coach-training-back">${icon("chevron-left")}<span>${label}</span></a>`;
  }

  // Сегментированный переключатель режима: две кнопки, каждая не ниже 44px.
  function modeToggle() {
    const editing = App.state.coachProgramMode === "edit";
    const button = (mode, label, focus) => {
      const on = editing === (mode === "edit");
      return `<button class="coach-mode-btn${on ? " is-on" : ""}" type="button" data-action="coach-program-mode" data-mode="${mode}" data-focus="${focus}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
    };
    return `
      <div class="coach-mode" role="group" aria-label="Режим тренировки">
        ${button("view", "Просмотр", "coach-program-view")}
        ${button("edit", "Редактор", "coach-program-edit")}
      </div>`;
  }

  function subline(count, sets, minutes) {
    const exercises = `${count} ${plural(count, ["упражнение", "упражнения", "упражнений"])}`;
    const approaches = `${sets} ${plural(sets, ["подход", "подхода", "подходов"])}`;
    return `${exercises} · ${minutes} мин · ${approaches}`;
  }

  function draftSets(draft) {
    return draft.exercises.reduce((sum, item) => sum + (Number(item.sets) || 0), 0);
  }

  // Подходы одного упражнения могут отличаться (в шаблонах есть пирамида):
  // в просмотре показываем диапазон, а не только первый подход.
  function span(values, format) {
    const list = values.filter((value) => value !== null && value !== undefined);
    if (!list.length) return "";
    const min = Math.min.apply(null, list);
    const max = Math.max.apply(null, list);
    return min === max ? format(min) : format(min) + "–" + format(max);
  }

  /* ---------- просмотр ---------- */

  function viewRow(item, index) {
    const seconds = item.unit === "sec";
    const reps = span(item.sets.map((set) => set.reps), (value) => (seconds ? value + " сек" : String(value)));
    const weights = span(item.sets.map((set) => set.weight), (value) => kg(value));
    return `
      <tr>
        <td class="coach-ex-num" data-label="№">${index + 1}</td>
        <td data-label="Упражнение">
          <span class="coach-ex-name">${escapeHtml(item.name)}</span>
          ${item.group ? `<span class="coach-ex-muscle">${escapeHtml(item.group)}</span>` : ""}
          ${item.note ? `<span class="coach-ex-note">${escapeHtml(item.note)}</span>` : ""}
        </td>
        <td data-label="Подходы">${item.sets.length}</td>
        <td data-label="Повторы">${escapeHtml(reps)}</td>
        <td data-label="Вес">${weights ? escapeHtml(weights + " кг") : "свой вес"}</td>
        <td data-label="Темп">${item.tempo ? escapeHtml(item.tempo) : "—"}</td>
        <td data-label="Отдых">${item.rest === null || item.rest === undefined ? "—" : item.rest + " сек"}</td>
      </tr>`;
  }

  function viewBlock(day) {
    if (!day.exercises.length) {
      return `
      <section class="coach-section card">
        <p class="coach-lead">В этом дне пока нет упражнений. Переключитесь в редактор и добавьте.</p>
      </section>`;
    }
    return `
      <section class="coach-section card">
        <div class="coach-table-wrap">
          <table class="coach-ex-table" aria-label="Упражнения дня">
            <thead>
              <tr>
                <th scope="col">№</th>
                <th scope="col">Упражнение</th>
                <th scope="col">Подходы</th>
                <th scope="col">Повторы</th>
                <th scope="col">Вес</th>
                <th scope="col">Темп</th>
                <th scope="col">Отдых</th>
              </tr>
            </thead>
            <tbody>${day.exercises.map(viewRow).join("")}</tbody>
          </table>
        </div>
      </section>`;
  }

  function dayHead(client, day) {
    const summary = App.coach.daySummary(day);
    return `
      <header class="coach-day-head">
        <p class="coach-client-line">${escapeHtml(client.name)}</p>
        <h1 class="coach-title" id="coach-training-title" tabindex="-1">${escapeHtml(day.title)}</h1>
        <p class="coach-client-meta">${escapeHtml(subline(summary.exercises, summary.sets, summary.minutes))}</p>
        ${modeToggle()}
      </header>`;
  }

  /* ---------- редактор ---------- */

  function editHead(client, draft) {
    return `
      <header class="coach-day-head">
        <p class="coach-client-line">${escapeHtml(client.name)}</p>
        <div class="coach-day-field coach-day-title">
          <label class="coach-field-label" for="coach-day-title">Название тренировки</label>
          <input class="coach-input" id="coach-day-title" type="text" maxlength="${LIMITS.titleMax}" autocomplete="off" value="${escapeHtml(draft.title)}" data-day-field="title" data-focus="coach-day-title">
        </div>
        <p class="coach-client-meta">${escapeHtml(subline(draft.exercises.length, draftSets(draft), draft.minutes))}</p>
        ${modeToggle()}
      </header>`;
  }

  function numField(label, field, index, value, min, max, step, mode) {
    const id = "coach-" + field + "-" + index;
    return `
          <div class="coach-day-field">
            <label class="coach-field-label" for="${id}">${label}</label>
            <input class="coach-input" id="${id}" type="number" min="${min}" max="${max}" step="${step}" inputmode="${mode}" autocomplete="off" value="${escapeHtml(value)}" data-day-field="${field}" data-item="${index}" data-focus="${id}">
          </div>`;
  }

  function editRow(item, index, total) {
    const seconds = item.unit === "sec";
    const muscle = item.group ? App.exercises.label(item) : "Группа не задана";
    return `
        <article class="coach-edit-row" data-item="${index}">
          <header class="coach-edit-head">
            <span class="coach-edit-num" aria-hidden="true">${index + 1}</span>
            <div class="coach-edit-id">
              <h3 class="coach-edit-name">${escapeHtml(item.name)}</h3>
              <p class="coach-edit-meta">${escapeHtml(muscle)}</p>
            </div>
            <div class="coach-edit-tools">
              <button class="coach-icon-btn" type="button" data-action="coach-move-exercise" data-dir="-1" data-item="${index}" data-focus="coach-up-${index}" aria-label="Выше" title="Выше"${index === 0 ? " disabled" : ""}>${icon("arrow-up")}</button>
              <button class="coach-icon-btn" type="button" data-action="coach-move-exercise" data-dir="1" data-item="${index}" data-focus="coach-down-${index}" aria-label="Ниже" title="Ниже"${index === total - 1 ? " disabled" : ""}>${icon("arrow-down")}</button>
              <button class="coach-icon-btn coach-icon-btn--danger" type="button" data-action="coach-remove-exercise" data-item="${index}" data-focus="coach-remove-${index}" aria-label="Удалить упражнение" title="Удалить">${icon("trash")}</button>
            </div>
          </header>
          <div class="coach-edit-fields">
            ${numField("Подходы", "sets", index, item.sets, LIMITS.setsMin, LIMITS.setsMax, 1, "numeric")}
            ${numField(seconds ? "Повторы, сек" : "Повторы", "reps", index, item.reps, LIMITS.repsMin, LIMITS.repsMax, 1, "numeric")}
            ${numField("Вес, кг", "weight", index, item.weight, 0, LIMITS.weightMax, 0.5, "decimal")}
            <div class="coach-day-field">
              <label class="coach-field-label" for="coach-tempo-${index}">Темп</label>
              <input class="coach-input" id="coach-tempo-${index}" type="text" maxlength="${LIMITS.tempoMax}" autocomplete="off" placeholder="2-0-1-0" value="${escapeHtml(item.tempo)}" data-day-field="tempo" data-item="${index}" data-focus="coach-tempo-${index}">
            </div>
            ${numField("Отдых, сек", "rest", index, item.rest, 0, LIMITS.restMax, 5, "numeric")}
          </div>
        </article>`;
  }

  function pickerResult(exercise) {
    return `
            <li class="coach-picker-item" data-picker-item data-name="${escapeHtml(exercise.name.toLowerCase().replace(/ё/g, "е"))}">
              <span class="coach-picker-text">
                <span class="coach-picker-name">${escapeHtml(exercise.name)}</span>
                <span class="coach-picker-meta">${escapeHtml(App.exercises.label(exercise))}</span>
              </span>
              <button class="coach-picker-add" type="button" data-action="coach-add-exercise" data-exercise="${escapeHtml(exercise.id)}" data-focus="coach-add-${escapeHtml(exercise.id)}" aria-label="Добавить: ${escapeHtml(exercise.name)}">Добавить</button>
            </li>`;
  }

  // Панель выбора: поиск фильтрует уже отрисованный список прямо в DOM, поэтому
  // ввод в поле не перерисовывает экран и не теряет каретку.
  function pickerBlock() {
    const picker = App.state.coachPicker || { open: false, query: "", group: "all" };
    if (!picker.open) {
      return `
      <section class="coach-section card">
        <button class="btn btn--ghost" type="button" data-action="coach-picker-toggle" data-focus="coach-picker-open">${icon("plus")}<span>Добавить упражнение</span></button>
      </section>`;
    }
    const current = picker.group || "all";
    const groups = ["all"].concat(App.exercises.groups || []);
    const chips = groups
      .map((group) => {
        const label = group === "all" ? "Все" : group;
        const on = current === group;
        return `<button class="chip coach-picker-chip${on ? " is-on" : ""}" type="button" data-action="coach-picker-group" data-group="${escapeHtml(group)}" data-focus="coach-picker-group-${escapeHtml(group)}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(label)}</button>`;
      })
      .join("");
    const list = current === "all" ? App.exercises.list : App.exercises.byGroup(current);
    const empty = list.length ? "" : `<li class="coach-picker-empty">В этой группе пока нет упражнений.</li>`;
    return `
      <section class="coach-section card coach-picker" data-picker>
        <div class="coach-picker-head">
          <h2 class="coach-block-title">Добавить упражнение</h2>
          <button class="coach-icon-btn" type="button" data-action="coach-picker-toggle" data-focus="coach-picker-open" aria-label="Закрыть выбор упражнения" title="Закрыть">${icon("x")}</button>
        </div>
        <div class="coach-day-field">
          <label class="coach-field-label" for="coach-picker-search">Поиск по названию</label>
          <input class="coach-input" id="coach-picker-search" type="search" autocomplete="off" placeholder="Например, приседания" value="${escapeHtml(picker.query || "")}" data-picker-search data-focus="coach-picker-search">
        </div>
        <div class="coach-picker-groups" role="group" aria-label="Группы мышц">${chips}</div>
        <ul class="coach-picker-results" data-picker-results>${empty}<li class="coach-picker-empty" data-picker-none hidden>Ничего не найдено. Измените запрос или группу.</li>${list.map(pickerResult).join("")}</ul>
      </section>`;
  }

  // Шапка таблицы редактора: видна только на широком экране, где строки
  // выстраиваются в колонки. На телефоне подписи живут в самих полях.
  function editHeadRow() {
    return `
        <div class="coach-edit-headrow" aria-hidden="true">
          <span>№</span>
          <span>Упражнение</span>
          <span>Подходы</span>
          <span>Повторы</span>
          <span>Вес, кг</span>
          <span>Темп</span>
          <span>Отдых</span>
          <span></span>
        </div>`;
  }

  function editBlock(draft) {
    const count = draft.exercises.length;
    const rows = count
      ? `<div class="coach-edit-list">${draft.exercises.map((item, index) => editRow(item, index, count)).join("")}</div>`
      : `<p class="coach-lead">Упражнений нет. Добавьте хотя бы одно — без них день не сохранить.</p>`;
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Упражнения</h2>
        <p class="coach-hint">Числа подходов, повторов и веса применяются ко всем подходам упражнения.</p>
        <div class="coach-day-errors" data-day-errors></div>
        ${count ? editHeadRow() : ""}
        ${rows}
      </section>`;
  }

  // Липкая панель сохранения. «Сохранить» включает app.js, когда черновик
  // расходится с сохранённым днём; ошибки проверяются при отправке.
  function saveBar() {
    return `
      <form class="coach-savebar" data-day-form novalidate>
        <button class="btn btn--ghost" type="button" data-action="coach-day-cancel" data-focus="coach-day-cancel">Отмена</button>
        <button class="btn btn--primary" type="submit" disabled aria-disabled="true">Сохранить</button>
      </form>`;
  }

  function coachTrainingView() {
    const client = App.coach.find(App.state.coachClientId);
    // guardRoute() уже увёл бы без клиента или дня; ветки — страховка на случай
    // прямого вызова render().
    if (!client) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Клиент не выбран.</p></div>`;
    }
    const day = App.coach.editDay(client.id, App.state.coachProgramDayId);
    if (!day) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Тренировка не выбрана.</p></div>`;
    }
    const editing = App.state.coachProgramMode === "edit";
    let draft = editing ? App.state.coachProgramDraft : null;
    if (editing && !draft) {
      draft = App.coach.dayDraft(day);
      App.state.coachProgramDraft = draft;
    }
    const canEdit = editing && !!draft;
    const banner = canEdit
      ? `<p class="coach-mode-banner" role="status">Режим редактора. Правки дня хранятся в памяти и исчезнут после перезагрузки.</p>`
      : "";
    // На ПК упражнения и библиотека — две колонки страницы; до 1100 px
    // библиотека остаётся шторкой под списком, как раньше.
    const body = canEdit
      ? `<div class="coach-training coach-training--edit">
        <div class="coach-training-main">${editBlock(draft)}</div>
        ${pickerBlock()}
      </div>`
      : `<div class="coach-training">${viewBlock(day)}</div>`;
    return `
    <div class="coach coach-training-page">
      ${backLink()}
      ${canEdit ? editHead(client, draft) : dayHead(client, day)}
      ${banner}
      ${body}
      ${canEdit ? saveBar() : ""}
    </div>`;
  }

  App.views["coach-training"] = { view: coachTrainingView };
})(window.App = window.App || {});
