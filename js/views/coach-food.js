/* Дни питания клиента в кабинете тренера (#/coach-food).
   Каталог блюд — те же имена, что клиент отмечает в анкете, поэтому фильтр
   «Только отмеченное» сравнивает имена с отметками клиента (checkedDishes),
   а не с продуктами: порции каталога уже посчитаны по 4/9/4. Черновик дня
   живёт в STATE.coachFoodDraft и не трогает сохранённый день до «Сохранить». */
(function (App) {
  "use strict";

  const DATA = App.data;
  const { escapeHtml, icon, num } = App.util;

  App.views = App.views || {};

  const MODES = App.coach.dishModes;

  function backLink() {
    return `<a class="coach-back" href="#/coach-client" data-nav="coach-client" data-focus="coach-food-back">${icon("chevron-left")}<span>Клиент</span></a>`;
  }

  function head(client, filled, norm) {
    const pkg = client.packages.nutrition;
    return `
      <header class="coach-day-head">
        <h1 class="coach-title" id="coach-food-title" tabindex="-1" data-focus="coach-food-title">Дни питания · ${escapeHtml(client.name)}</h1>
        <p class="coach-lead">Пакет ${pkg.used} из ${pkg.total} дней · норма ${num(norm)} ккал · заполнено ${filled}</p>
      </header>
      <p class="coach-note-line">Ограничения: ${escapeHtml(client.questionnaire.foodLimits)} · Аллергии: ${escapeHtml(client.questionnaire.allergies)}</p>`;
  }

  function dayMeta(day) {
    return day.filled ? "заполнен · " + num(day.kcal) + " ккал" : "пусто";
  }

  // «сейчас» — текущий день пакета; у последнего дня индекс не выходит за пакет.
  function daysBlock(client, days, dayNo) {
    const current = Math.min(client.packages.nutrition.used, days.length - 1);
    const items = days.map((day) => {
      const selected = day.dayNo === dayNo;
      return `
        <button class="coach-food-day${selected ? " is-on" : ""}" type="button" data-action="coach-food-day" data-day="${day.dayNo}" data-focus="coach-food-day-${day.dayNo}" aria-pressed="${selected}">
          <span class="coach-food-day-text">
            <span class="coach-food-day-name">День ${day.dayNo + 1}</span>
            <span class="coach-food-day-meta">${escapeHtml(dayMeta(day))}</span>
          </span>
          ${day.dayNo === current ? '<span class="coach-badge">сейчас</span>' : ""}
        </button>`;
    }).join("");
    return `
      <aside class="coach-food-side" data-food-days>
        <h2 class="coach-block-title" tabindex="-1" data-focus="coach-food-days">Дни пакета</h2>
        <div class="coach-food-days">${items}</div>
      </aside>`;
  }

  function modeButton(mode) {
    const on = App.state.coachDishMode === mode;
    return `<button class="coach-mode-btn${on ? " is-on" : ""}" type="button" data-action="coach-dish-mode" data-mode="${mode}" data-focus="coach-dish-mode-${mode}" aria-pressed="${on}">${escapeHtml(MODES[mode])}</button>`;
  }

  function emptyBlock(title, text) {
    return `<div class="coach-empty"><p class="coach-empty-title">${escapeHtml(title)}</p><p class="coach-empty-text">${escapeHtml(text)}</p></div>`;
  }

  // Выбранные блюда показываем по группам анкеты: так день читается как меню,
  // а не как список добавлений. Номер в data-focus — позиция в дне (1-based).
  function selectedBlock(draft) {
    if (draft.dishes.length === 0) {
      return emptyBlock("День пока пуст", "Отметьте блюда в каталоге ниже — калорийность посчитаем сразу.");
    }
    const byName = {};
    (DATA.dishCatalog || []).forEach((item) => { byName[item.name] = item; });
    const groups = (DATA.questionnaire.dishes || []).map((group) => ({
      key: group.key,
      title: group.title,
      items: draft.dishes
        .filter((name) => byName[name] && byName[name].group === group.key)
        .map((name) => byName[name]),
    })).filter((group) => group.items.length > 0);
    return groups.map((group) => `
      <section class="coach-dish-group">
        <h3 class="coach-dish-group-title">${escapeHtml(group.title)}</h3>
        <ul class="coach-dish-list">${group.items.map((item) => {
          const pos = draft.dishes.indexOf(item.name) + 1;
          return `
            <li class="coach-dish">
              <span class="coach-dish-text">
                <span class="coach-dish-name">${escapeHtml(item.name)}</span>
                <span class="coach-dish-meta">${item.g} г · ${num(item.k)} ккал</span>
              </span>
              <button class="coach-dish-remove" type="button" data-action="coach-dish-remove" data-dish="${escapeHtml(item.name)}" data-focus="coach-food-dish-${pos}" aria-label="Убрать «${escapeHtml(item.name)}»" title="Убрать «${escapeHtml(item.name)}»">Убрать</button>
            </li>`;
        }).join("")}</ul>
      </section>`).join("");
  }

  function totalsBlock(client, draft) {
    const totals = App.coach.dishTotals(draft.dishes);
    const norm = App.coach.nutritionNorm(client).kcal;
    const delta = totals.kcal - norm;
    const deltaText = (delta > 0 ? "+" : delta < 0 ? "−" : "") + num(Math.abs(delta)) + " ккал";
    const rows = [
      ["Блюд", num(totals.count)],
      ["Калорийность", num(totals.kcal) + " ккал"],
      ["Белки", num(totals.protein) + " г"],
      ["Жиры", num(totals.fat) + " г"],
      ["Углеводы", num(totals.carbs) + " г"],
      ["Норма", num(norm) + " ккал"],
      ["Расхождение", deltaText],
    ];
    return `
      <dl class="coach-rows">${rows.map((row) => `<div class="coach-row"><dt>${escapeHtml(row[0])}</dt><dd>${escapeHtml(row[1])}</dd></div>`).join("")}</dl>
      ${Math.abs(delta) > 150 ? '<p class="coach-hint">День сильно отличается от нормы — проверьте порции и состав.</p>' : ""}`;
  }

  // Каталог: в режиме «Все блюда» показываем и не отмеченное клиентом, но
  // помечаем его — тренер видит, что выходит за рамки анкеты.
  function catalogBlock(client) {
    const mode = App.state.coachDishMode;
    if (!DATA.dishCatalog || DATA.dishCatalog.length === 0) {
      return emptyBlock("Каталог блюд недоступен", "Блюда анкеты не загрузились — обновите страницу.");
    }
    const groups = App.coach.dishGroups(client, mode);
    if (groups.length === 0) {
      return emptyBlock("Клиент не отметил ни одного блюда", "Включите «Все блюда», чтобы добавить блюдо вне анкеты.");
    }
    const draft = App.state.coachFoodDraft;
    const title = mode === "all" ? "Все блюда" : "Блюда клиента";
    const body = groups.map((group) => `
      <section class="coach-dish-group">
        <h3 class="coach-dish-group-title">${escapeHtml(group.title)}</h3>
        <div class="coach-dish-picks">${group.items.map((item) => {
          const inDay = draft && draft.dishes.indexOf(item.name) !== -1;
          const off = mode === "all" && !item.checked;
          const mark = inDay ? "уже в дне" : off ? "не отмечено" : "";
          return `
            <button class="coach-dish-pick${inDay ? " is-on" : ""}${off ? " is-off" : ""}" type="button" data-action="coach-dish-add" data-dish="${escapeHtml(item.name)}" data-focus="coach-food-pick-${escapeHtml(item.name)}" aria-pressed="${inDay}">
              <span class="coach-dish-pick-name">${escapeHtml(item.name)}</span>
              <span class="coach-dish-pick-meta">${item.g} г · ${num(item.k)} ккал${mark ? " · " + mark : ""}</span>
            </button>`;
        }).join("")}</div>
      </section>`).join("");
    return `<h3 class="coach-block-title">${escapeHtml(title)}</h3>${body}`;
  }

  function formBlock(client, days, dayNo) {
    const draft = App.state.coachFoodDraft;
    const dirty = !App.coach.sameFoodDraft(draft, App.coach.foodDayDraft(client.id, dayNo));
    const reset = App.coach.hasFoodDay(client.id, dayNo)
      ? `<button class="btn btn--ghost" type="button" data-action="coach-food-reset" data-focus="coach-food-reset">Убрать день</button>`
      : "";
    return `
      <div class="coach-food-main">
        <form class="coach-food-form" data-food-form novalidate>
          <div class="coach-food-head">
            <h2 class="coach-block-title">День ${dayNo + 1}</h2>
            <div class="coach-mode" role="group" aria-label="Фильтр блюд">${modeButton("checked")}${modeButton("all")}</div>
          </div>
          <div data-food-errors></div>
          ${selectedBlock(draft)}
          ${totalsBlock(client, draft)}
          ${catalogBlock(client)}
          <div class="coach-savebar${dirty ? " is-dirty" : ""}">
            <button class="btn btn--ghost" type="button" data-action="coach-food-cancel" data-focus="coach-food-cancel">Отмена</button>
            ${reset}
            <button class="btn btn--primary" type="submit" data-food-save${dirty ? "" : " disabled aria-disabled=\"true\""}>Сохранить день</button>
          </div>
        </form>
      </div>`;
  }

  function coachFoodView() {
    const client = App.coach.find(App.state.coachClientId);
    // guardRoute() уже увёл бы без клиента; ветка — страховка для прямого render().
    if (!client) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Клиент не выбран.</p></div>`;
    }
    const days = App.coach.foodDays(client.id);
    const dayNo = Math.max(0, Math.min(App.state.coachFoodDayNo, days.length - 1));
    // Зажим пишем обратно в STATE: по нему app.js пересобирает черновик и сохраняет день.
    App.state.coachFoodDayNo = dayNo;
    // Черновик от другой отрисовки (другой день, другой клиент) не подходит:
    // пересобираем из сохранённого дня, чтобы «Сохранить» не включилось зря.
    const saved = App.state.coachFoodDraft;
    if (!saved || saved.dayNo !== dayNo) {
      App.state.coachFoodDraft = App.coach.foodDayDraft(client.id, dayNo);
    }
    const norm = App.coach.nutritionNorm(client).kcal;
    return `
    <div class="coach coach-food-page">
      ${backLink()}
      ${head(client, App.coach.foodDayCount(client.id), norm)}
      <div class="coach-food">
        ${daysBlock(client, days, dayNo)}
        ${formBlock(client, days, dayNo)}
      </div>
    </div>`;
  }

  App.views["coach-food"] = { view: coachFoodView };
})(window.App = window.App || {});
