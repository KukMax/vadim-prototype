/* Архив пакетов кабинета тренера (#/coach-archive). Показывает пройденную
   часть пакета: тоннаж и КПШ по программе и по дням, норму и факт питания по
   дням, динамику веса. Все числа считает js/coach.js, экран только
   раскладывает их в разметку. */
(function (App) {
  "use strict";

  const { escapeHtml, icon, num, plural, weight } = App.util;
  App.views = App.views || {};

  const TABS = [
    { id: "training", label: "Тренировки" },
    { id: "nutrition", label: "Питание" },
  ];

  function tabId() {
    return App.state.coachArchiveTab === "nutrition" ? "nutrition" : "training";
  }

  function backLink() {
    return `<a class="coach-back" href="#/coach-client" data-nav="coach-client" data-focus="coach-archive-back">${icon("chevron-left")}<span>Клиент</span></a>`;
  }

  function head(client) {
    return `
      <header class="coach-day-head">
        <h1 class="coach-title" id="coach-archive-title" tabindex="-1" data-focus="coach-archive-title">Архив · ${escapeHtml(client.name)}</h1>
        <p class="coach-lead">Пройденная часть пакета: объём тренировок, норма и факт питания.</p>
      </header>`;
  }

  function tabsBlock() {
    const on = tabId();
    const buttons = TABS.map((tab) => {
      const active = tab.id === on;
      return `<button class="coach-mode-btn${active ? " is-on" : ""}" type="button" data-action="coach-archive-tab" data-tab="${tab.id}" data-focus="coach-archive-${tab.id}" aria-pressed="${active}">${escapeHtml(tab.label)}</button>`;
    }).join("");
    return `<div class="coach-mode" role="group" aria-label="Раздел архива">${buttons}</div>`;
  }

  function emptyBlock(title, text) {
    return `<div class="coach-empty"><p class="coach-empty-title">${escapeHtml(title)}</p><p class="coach-empty-text">${escapeHtml(text)}</p></div>`;
  }

  function tonnageText(value) {
    return value > 0 ? num(value) : "—";
  }

  function repsText(value) {
    return value > 0 ? num(value) : "—";
  }

  function volumeCell(label, value, unit) {
    return `
      <div class="coach-volume-cell">
        <span class="coach-volume-label">${escapeHtml(label)}</span>
        <span class="coach-volume-num">${escapeHtml(value)}</span>
        ${unit ? `<span class="coach-volume-unit">${escapeHtml(unit)}</span>` : ""}
      </div>`;
  }

  function volumeNote(data) {
    const base = "Тоннаж = вес × повторы в каждом подходе. Свой вес в тоннаж не входит, а повторы в КПШ входят.";
    const timed = data.round.timed
      ? " Упражнения на время в КПШ и тоннаж не идут: за круг " +
        data.round.timed +
        " " +
        plural(data.round.timed, ["подход", "подхода", "подходов"]) +
        " на время."
      : " Упражнения на время считаем отдельно и в КПШ не берём.";
    return `<p class="coach-note-line">${escapeHtml(base + timed)}</p>`;
  }

  function statusRows(data) {
    return `
      <dl class="coach-rows">
        <div class="coach-row"><dt>Пройдено</dt><dd>${data.used} из ${data.total}</dd></div>
        <div class="coach-row"><dt>Даты</dt><dd>${escapeHtml(data.dates ? data.dates.label : "—")}</dd></div>
        <div class="coach-row"><dt>Кругов в пакете</dt><dd>${num(data.rounds)}</dd></div>
        <div class="coach-row"><dt>Дней в круге</dt><dd>${num(data.days.length)}</dd></div>
      </dl>`;
  }

  // День — одна карточка: строка с итогами дня, под ней по строке на
  // упражнение. Упражнения на время (планка) остаются без КПШ и тоннажа.
  function exerciseRow(item) {
    return `
      <tr class="coach-archive-exercise">
        <td data-label="Упражнение">${escapeHtml(item.name)}${item.timed ? ' <span class="coach-archive-timed">на время</span>' : ""}</td>
        <td class="coach-archive-skip" data-label="Упражнений"></td>
        <td data-label="Подходов">${num(item.sets)}</td>
        <td data-label="КПШ">${item.timed ? "—" : repsText(item.reps)}</td>
        <td data-label="Тоннаж, кг">${item.timed ? "—" : tonnageText(item.tonnage)}</td>
      </tr>`;
  }

  function daysTable(data) {
    const groups = data.days.map((row) => `
      <tbody class="coach-archive-day">
        <tr class="coach-archive-dayrow">
          <td data-label="День">${escapeHtml(row.title)}</td>
          <td data-label="Упражнений">${num(row.exercises)}</td>
          <td data-label="Подходов">${num(row.sets)}</td>
          <td data-label="КПШ">${repsText(row.reps)}</td>
          <td data-label="Тоннаж, кг">${tonnageText(row.tonnage)}</td>
        </tr>
        ${row.items.map(exerciseRow).join("")}
      </tbody>`).join("");
    return `
      <div class="coach-table-wrap">
        <table class="coach-archive-table">
          <thead>
            <tr>
              <th scope="col">День</th>
              <th scope="col">Упражнений</th>
              <th scope="col">Подходов</th>
              <th scope="col">КПШ</th>
              <th scope="col">Тоннаж, кг</th>
            </tr>
          </thead>
          ${groups}
          <tbody class="coach-archive-totals">
            <tr class="coach-archive-total">
              <td data-label="Итого">Круг</td>
              <td data-label="Упражнений">—</td>
              <td data-label="Подходов">—</td>
              <td data-label="КПШ">${repsText(data.round.reps)}</td>
              <td data-label="Тоннаж, кг">${tonnageText(data.round.tonnage)}</td>
            </tr>
            <tr class="coach-archive-total">
              <td data-label="Итого">Пакет</td>
              <td data-label="Упражнений">—</td>
              <td data-label="Подходов">—</td>
              <td data-label="КПШ">${repsText(data.month.reps)}</td>
              <td data-label="Тоннаж, кг">${tonnageText(data.month.tonnage)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  function trainingTab(client) {
    const data = App.coach.trainingArchive(client);
    if (!data.dates) {
      return emptyBlock("Пакет тренировок не активирован", "Когда пакет начнётся, здесь появятся тоннаж, КПШ и дни программы.");
    }
    return `
      <div class="coach-archive-grid">
        <div class="coach-archive-side">
          <section class="coach-section card">
            <h2 class="coach-block-title">Объём</h2>
            <div class="coach-volume">
              ${volumeCell("Тоннаж за круг, кг", tonnageText(data.round.tonnage), "")}
              ${volumeCell("КПШ за круг", repsText(data.round.reps), plural(data.round.reps, ["раз", "раза", "раз"]))}
              ${volumeCell("Тоннаж за пакет, кг", tonnageText(data.month.tonnage), "")}
              ${volumeCell("КПШ за пакет", repsText(data.month.reps), plural(data.month.reps, ["раз", "раза", "раз"]))}
            </div>
            ${volumeNote(data)}
          </section>
          <section class="coach-section card">
            <h2 class="coach-block-title">Пакет</h2>
            ${statusRows(data)}
          </section>
        </div>
        <div class="coach-archive-main">
          <section class="coach-section card">
            <h2 class="coach-block-title">По дням</h2>
            ${daysTable(data)}
          </section>
        </div>
      </div>`;
  }

  function diffText(diff) {
    if (!diff) return "точно по норме";
    return (diff > 0 ? "+" : "\u2212") + num(Math.abs(diff)) + " ккал к норме";
  }

  function nutritionRows(data) {
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Норма и факт</h2>
        <dl class="coach-rows">
          <div class="coach-row"><dt>Пройдено</dt><dd>${data.used} из ${data.total} дней</dd></div>
          <div class="coach-row"><dt>Даты</dt><dd>${escapeHtml(data.dates ? data.dates.label : "—")}</dd></div>
          <div class="coach-row"><dt>Норма в день</dt><dd>${num(data.norm.kcal)} ккал</dd></div>
          <div class="coach-row"><dt>Среднее за неделю</dt><dd>${num(data.avgKcal)} ккал</dd></div>
          <div class="coach-row"><dt>Отклонение от нормы</dt><dd>${escapeHtml(diffText(data.diff))}</dd></div>
          <div class="coach-row"><dt>Вода</dt><dd>${data.avgWater} из ${data.targetWater} стаканов</dd></div>
        </dl>
        <p class="coach-note-line">Норма одна на весь пакет. Факт — среднее недели клиента, разложенное по дням; граммы БЖУ по дням не придумываем.</p>
      </section>`;
  }

  function weightBlock(client) {
    const delta = App.coach.weightDelta(client);
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Вес</h2>
        <dl class="coach-rows">
          <div class="coach-row"><dt>Старт</dt><dd>${weight(delta.from)} кг</dd></div>
          <div class="coach-row"><dt>Сейчас</dt><dd>${weight(delta.to)} кг</dd></div>
          <div class="coach-row"><dt>Цель</dt><dd>${weight(delta.target)} кг</dd></div>
          <div class="coach-row"><dt>Осталось</dt><dd>${weight(delta.left)} кг</dd></div>
        </dl>
      </section>`;
  }

  function weeksBlock(data) {
    const groups = data.weeks.map((week, index) => {
      const rows = week.days.map((day) => `
        <tr>
          <td data-label="День">День ${day.no}</td>
          <td data-label="Дата">${escapeHtml(day.label)}</td>
          <td data-label="Норма, ккал">${num(day.normKcal)}</td>
          <td data-label="Факт, ккал">${num(day.factKcal)}</td>
          <td data-label="Вода">${day.water} из ${data.targetWater}</td>
        </tr>`).join("");
      return `
        <details class="coach-archive-week"${index === 0 ? " open" : ""}>
          <summary class="coach-archive-week-head">
            <span class="coach-archive-week-name">Неделя ${week.no}</span>
            <span class="coach-archive-week-meta">${escapeHtml(week.label)} · ${num(week.factKcal)} / ${num(week.normKcal)} ккал</span>
          </summary>
          <div class="coach-table-wrap">
            <table class="coach-archive-table">
              <thead>
                <tr>
                  <th scope="col">День</th>
                  <th scope="col">Дата</th>
                  <th scope="col">Норма, ккал</th>
                  <th scope="col">Факт, ккал</th>
                  <th scope="col">Вода</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </details>`;
    }).join("");
    return `
      <section class="coach-section card">
        <h2 class="coach-block-title">Дни пакета</h2>
        <div class="coach-archive-weeks">${groups}</div>
      </section>`;
  }

  function nutritionTab(client) {
    const data = App.coach.nutritionArchive(client);
    if (!data.dates) {
      return emptyBlock("Пакет питания не активирован", "Когда пакет начнётся, здесь появятся норма, факт по дням и вода.");
    }
    return `
      <div class="coach-archive-grid">
        <div class="coach-archive-side">
          ${nutritionRows(data)}
          ${weightBlock(client)}
        </div>
        <div class="coach-archive-main">
          ${weeksBlock(data)}
        </div>
      </div>`;
  }

  function coachArchiveView() {
    const client = App.coach.find(App.state.coachClientId);
    // guardRoute() уже увёл бы без клиента; ветка — страховка для прямого render().
    if (!client) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Клиент не выбран.</p></div>`;
    }
    const tab = tabId();
    return `
      <div class="coach coach-archive-page">
        ${backLink()}
        ${head(client)}
        ${tabsBlock()}
        ${tab === "nutrition" ? nutritionTab(client) : trainingTab(client)}
      </div>`;
  }

  App.views["coach-archive"] = { view: coachArchiveView };
})(window.App = window.App || {});
