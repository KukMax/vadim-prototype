(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const {
    NOW, TODAY, NOW_MINUTES, DAY_SHORT, WEEK_DATES, SESSION_COUNT, intFmt, oneFmt,
    weightFmt, addDays, icon, escapeHtml, plural, one, num, weight, formatLongDate,
    greetingForHour, getNextMeal, getNextWorkout, sumDishes, menuTotals, planTotals,
    eatenTotals, eatenMealCount, waterCount, workoutsDone, percent, clamp,
  } = App.util;
  const { ringMarkup, macroRows, weekStrip, foodDays, coachNoteCard, statTile, miniBars } = App.ui;
  App.views = App.views || {};

  function nutritionView() {
    const dayIndex = STATE.foodDay;
    const eaten = eatenTotals(dayIndex);
    const eatenMeals = eatenMealCount(dayIndex);
    const caloriePercent = percent(eaten.kcal, DATA.targets.kcal);
    const remaining = DATA.targets.kcal - eaten.kcal;
    const dateLabel = formatLongDate(WEEK_DATES[dayIndex]);
    const water = waterCount(dayIndex);
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Дневник питания</span>
        <h1 id="nutrition-title" tabindex="-1">Питание</h1>
        <p class="screen-sub">${dateLabel}${dayIndex === TODAY ? " · сегодня" : ""}. Норма и меню уже собраны тренером.</p>
      </div>
      <div class="day-picker card">
        ${foodDays(dayIndex)}
      </div>
      <div class="nutrition-layout">
        <div class="nutrition-main">
          <article class="target-card card" aria-label="Дневные цели по калориям и макронутриентам">
            <div class="target-top">
              <div class="target-copy">
                <span class="eyebrow">Съедено за день</span>
                <div class="target-value">${num(eaten.kcal)}<small>/ ${num(DATA.targets.kcal)} ккал</small></div>
                <div class="target-left">${remaining >= 0 ? `Осталось <b>${num(remaining)} ккал</b>` : `Выше нормы на <b>${num(-remaining)} ккал</b>`}</div>
              </div>
              <div class="target-ring">${ringMarkup(caloriePercent, { size: 94, stroke: 5, label: `${Math.round(caloriePercent)}%` })}</div>
            </div>
            ${macroRows(eaten)}
            <p class="advice-line">${icon("spark")}<span>${escapeHtml(DATA.nutritionAdvice)}</span></p>
          </article>
          <div class="meal-section">
            <div class="meal-section-head"><h2>Приёмы пищи</h2><span>${eatenMeals} из ${DATA.mealTimes.length} отмечено</span></div>
            <div class="meal-list">
              ${DATA.menus[dayIndex].map((dishes, mealIndex) => mealCard(dayIndex, mealIndex, dishes)).join("")}
            </div>
          </div>
        </div>
        <aside class="nutrition-side">
          <article class="water-card card">
            <div class="water-top">
              <div>
                <div class="card-head"><h2 class="card-title">Вода</h2></div>
                <div class="water-count">${water} <small>/ ${DATA.targets.water}</small></div>
                <p class="water-copy">${num(water * 250)} мл из 2 л</p>
              </div>
            </div>
            <div class="water-glasses" role="group" aria-label="Отметить выпитые стаканы воды">
              ${Array.from({ length: DATA.targets.water }, (_, glassIndex) => {
                const filled = STATE.water[dayIndex][glassIndex];
                return `<button class="glass-button" type="button" data-action="toggle-water" data-day="${dayIndex}" data-index="${glassIndex}" data-focus="water-${dayIndex}-${glassIndex}" aria-pressed="${filled}" aria-label="Стакан ${glassIndex + 1} из ${DATA.targets.water}">${icon("glass")}</button>`;
              }).join("")}
            </div>
          </article>
          ${weekCaloriesCard(dayIndex)}
          ${nutritionTipsCard()}
          ${supplementsCard()}
        </aside>
      </div>`;
  }
  function mealCard(dayIndex, mealIndex, dishes) {
    const meal = DATA.mealTimes[mealIndex];
    const totals = sumDishes(dishes);
    const eaten = STATE.meals[dayIndex][mealIndex];
    return `
      <article class="meal-card card${eaten ? " is-eaten" : ""}">
        <div class="meal-head">
          <div class="meal-name-row"><h3>${meal.name}</h3><span class="meal-time">${meal.time}</span></div>
          <div class="meal-kcal"><span class="meal-kcal-label">Итого</span>${num(totals.kcal)} <span>ккал</span></div>
        </div>
        <ul class="dishes">
          ${dishes.map((dish) => `
            <li class="dish">
              <div class="dish-main"><span class="dish-name">${escapeHtml(dish.n)}</span><span class="dish-kcal">${num(dish.k)} ккал</span></div>
              <div class="dish-meta"><span class="dish-grams">${dish.g} г</span><span class="dish-sep"></span><span>Б ${one(dish.p)}</span><span class="dish-sep"></span><span>Ж ${one(dish.f)}</span><span class="dish-sep"></span><span>У ${one(dish.c)}</span></div>
            </li>`).join("")}
        </ul>
        <div class="meal-foot">
          <div class="meal-total"><span>Итого за приём</span><strong>Б ${one(totals.p)} · Ж ${one(totals.f)} · У ${one(totals.c)}</strong></div>
          <button class="meal-toggle" type="button" data-action="toggle-meal" data-day="${dayIndex}" data-index="${mealIndex}" data-focus="meal-${dayIndex}-${mealIndex}" aria-pressed="${eaten}" aria-label="${eaten ? "Снять отметку" : "Отметить"} «${meal.name}»">
            ${icon(eaten ? "check" : "plus")}${eaten ? "Съедено" : "Съел"}
          </button>
        </div>
      </article>`;
  }
  function weekCaloriesCard(selected) {
    const calorieMax = 2350;
    const targetLine = (DATA.targets.kcal / calorieMax) * 100;
    const days = DAY_SHORT.map((label, index) => {
      const eaten = eatenTotals(index).kcal;
      const plan = planTotals(index).kcal;
      return {
        label,
        eaten,
        plan,
        height: clamp((eaten / calorieMax) * 100, 0, 100),
        planLine: clamp((plan / calorieMax) * 100, 0, 100),
      };
    });
    const a11y = days.map((day) => `${day.label}: ${num(day.eaten)}`).join(", ");
    return `
      <article class="week-chart-card card">
        <div class="card-head"><h2 class="card-title">Калории за неделю</h2><span class="card-hint">цель ${num(DATA.targets.kcal)}</span></div>
        <div class="week-chart" role="img" aria-label="Съедено калорий: ${a11y}. Цель ${num(DATA.targets.kcal)} калорий.">
          <div class="chart-target-line" style="--target-line:${targetLine}%"><span>${num(DATA.targets.kcal)}</span></div>
          <div class="week-bars">
            ${days.map((day, index) => `
              <div class="week-col${index === selected ? " is-selected" : ""}${index === TODAY ? " is-today" : ""}">
                <span class="plan-tick" style="--plan-line:${day.planLine}%"></span>
                <span class="week-bar-fill" style="--bar-h:${Math.max(day.height, day.eaten > 0 ? 2 : 0)}%"></span>
              </div>`).join("")}
          </div>
        </div>
        <div class="week-axis" aria-hidden="true">
          ${DAY_SHORT.map((label, index) => `<span class="${index === selected ? "is-accent" : ""}">${label}</span>`).join("")}
        </div>
        <div class="chart-legend" aria-hidden="true">
          <span><i class="legend-dot"></i>съедено</span>
          <span><i class="legend-dot legend-dot--plan"></i>план</span>
        </div>
      </article>`;
  }
  function nutritionTipsCard() {
    return `
      <article class="tips-card card">
        <div class="card-head"><h2 class="card-title">Советы Вадима</h2><span class="card-hint">на неделю</span></div>
        <div class="tips-list">
          ${DATA.nutritionTips.map((tip, index) => `<div class="tip"><span class="tip-num">0${index + 1}</span><p>${escapeHtml(tip)}</p></div>`).join("")}
        </div>
      </article>`;
  }

  function supplementsCard() {
    const open = !!STATE.supplementsOpen;
    const items = DATA.supplementsInfo.items.map((item) => `
      <li class="supp-item">
        <h3 class="supp-name">${escapeHtml(item.name)}</h3>
        <dl class="supp-facts">
          <div><dt>Суточная доза</dt><dd>${escapeHtml(item.dose)}</dd></div>
          <div><dt>Как принимать</dt><dd>${escapeHtml(item.how)}</dd></div>
          <div><dt>Длительность</dt><dd>${escapeHtml(item.duration)}</dd></div>
        </dl>
        <p class="supp-why"><span>Зачем</span>${escapeHtml(item.why)}</p>
      </li>`).join("");
    return `
      <article class="supplements-card card">
        <button class="supplements-toggle" type="button" data-action="toggle-supplements" aria-expanded="${open}" aria-controls="supplements-body">
          <span class="supplements-head-copy">
            <span class="eyebrow">Добавки</span>
            <strong>Рекомендации по добавкам</strong>
          </span>
          <span class="supplements-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="supplements-body" id="supplements-body"${open ? "" : " hidden"}>
          <div class="info-callout">
            <span class="info-callout-icon" aria-hidden="true">${icon("info")}</span>
            <p>${escapeHtml(DATA.supplementsInfo.disclaimer)}</p>
          </div>
          <ul class="supp-list">${items}</ul>
        </div>
      </article>`;
  }

  App.views.nutrition = { view: nutritionView };
})(window.App = window.App || {});
