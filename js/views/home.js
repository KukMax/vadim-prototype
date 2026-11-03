(function (App) {
  "use strict";

  const DATA = App.data;
  const CYCLE = App.cycle;
  const {
    NOW, TODAY, WEEK_DATES, icon, escapeHtml, plural, num, weight, percent,
    formatLongDate, greetingForHour, getNextMeal, eatenTotals, waterCount,
  } = App.util;
  const { ringMarkup, macroRows, cycleMini, statTile, miniBars } = App.ui;
  App.views = App.views || {};

  function homeView() {
    const total = DATA.subscription.training.sessions;
    const cycleData = CYCLE.current();
    const hasPlan = CYCLE.hasPlan();
    const done = CYCLE.doneCount(cycleData);
    const next = hasPlan ? CYCLE.nextSession(cycleData) : null;
    const eaten = eatenTotals(TODAY);
    const water = waterCount(TODAY);
    const latestMeasure = App.measurements.latest();
    const currentWeight = latestMeasure ? latestMeasure.values.weight : DATA.goal.current;
    const weightDelta = DATA.goal.start - currentWeight;
    const measuresDue = App.measurements.isDue();
    const caloriePercent = percent(eaten.kcal, DATA.targets.kcal);
    const calorieRing = ringMarkup(caloriePercent, { size: 42, stroke: 4 });
    const waterFull = water >= DATA.targets.water;
    const trainingMeta = hasPlan
      ? CYCLE.status() === "completed" ? "цикл завершён" : `цикл №${cycleData.number}`
      : "план не активен";
    const trainingValue = hasPlan
      ? `${done} <span class="stat-divider">/</span> ${total}`
      : `<span class="stat-divider">—</span> / <span class="stat-divider">—</span>`;
    const trainingSpoken = hasPlan
      ? `${done} из ${total} тренировок цикла`
      : "Персональный план тренировок не активирован";
    const stats = `
      <div class="stats-grid">
        ${statTile({
          href: "#/nutrition", route: "nutrition", label: "Калории", iconName: "flame",
          value: num(eaten.kcal), spoken: `${num(eaten.kcal)} из ${num(DATA.targets.kcal)} ккал`,
          meta: `из ${num(DATA.targets.kcal)} ккал`, visual: calorieRing,
        })}
        ${statTile({
          href: "#/nutrition", route: "nutrition", label: "Вода", iconName: "drop",
          value: `${water} <span class="stat-divider">/</span> ${DATA.targets.water}`,
          spoken: `${water} из ${DATA.targets.water} стаканов`, meta: "стаканов",
          quick: `<button class="stat-quick" type="button" data-action="add-water" data-day="${TODAY}" data-focus="water-add" aria-disabled="${waterFull}" aria-label="${waterFull ? "Норма воды на сегодня выполнена" : "Добавить стакан воды"}">${icon(waterFull ? "check" : "plus")}</button>`,
        })}
        ${statTile({
          href: "#/workouts", route: "workouts", label: "Тренировки", iconName: "dumbbell",
          value: trainingValue, spoken: trainingSpoken, meta: trainingMeta,
          visual: miniBars(done, total),
        })}
        ${statTile({
          href: "#/reports", route: "reports", label: "Вес", iconName: "scale",
          value: `${weight(currentWeight)} <span class="stat-unit">кг</span>`,
          spoken: `Текущий вес ${weight(currentWeight)} килограммов, минус ${weight(weightDelta)} килограмма с начала`,
          meta: `<span class="stat-trend">${icon("trend-down")}−${weight(weightDelta)} кг с начала</span>`,
        })}
      </div>`;
    const cycleCardMarkup = hasPlan
      ? `<article class="week-card card">
          <div class="card-head">
            <h2 class="card-title">Цикл тренировок</h2>
            <span class="card-hint">${done} из ${total}</span>
          </div>
          ${cycleMini(cycleData)}
        </article>`
      : "";
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>${formatLongDate(WEEK_DATES[TODAY])}</span>
        <h1 class="home-title" id="home-title" tabindex="-1">${greetingForHour(NOW.getHours())}, <span class="home-name">${DATA.client.name}</span></h1>
      </div>
      ${measuresDue ? `<a class="measure-reminder" href="#/reports" data-action="open-measure-form"><span class="measure-reminder-icon">${icon("calendar")}</span><span class="measure-reminder-copy"><strong>Пора внести замеры — раз в неделю</strong><span>Так прогресс виден точнее</span></span><span class="measure-reminder-cta">Внести ${icon("chevron-right")}</span></a>` : ""}
      <div class="dash-grid">
        ${next ? trainingHero(cycleData, next, total) : planHero()}
        ${stats}
        ${goalCard()}
        <article class="macro-card card" aria-label="Макросы за сегодня">
          <div class="card-head"><h2 class="card-title">Макросы сегодня</h2><span class="card-hint">из нормы</span></div>
          ${macroRows(eaten)}
        </article>
        ${cycleCardMarkup}
        <div class="home-side">
          ${messageCard()}
          ${nextMealCard()}
        </div>
      </div>`;
  }

  function trainingHero(cycleData, session, total) {
    const count = CYCLE.itemCount(session);
    const days = CYCLE.daysSince(CYCLE.lastDoneDate(cycleData));
    const lastText = CYCLE.lastDoneText(cycleData);
    let note = "";
    if (days === 0) {
      note = `Сегодня вы уже тренировались. Отдых — часть плана; следующая тренировка — №${session.number}.`;
    } else if (lastText) {
      note = `Последняя тренировка: ${lastText}`;
    }
    return `
      <article class="today-card card">
        <span class="hero-art" aria-hidden="true"></span>
        <div class="hero-content">
          <div class="hero-top">
            <span class="hero-tag"><span class="eyebrow-dot"></span>Тренировка ${session.number} из ${total}</span>
            <span class="hero-status">Следующая</span>
          </div>
          <h2 class="today-title">${escapeHtml(session.title)}</h2>
          <div class="hero-meta">
            <span>${icon("clock")}${session.minutes} мин</span>
            <span>${icon("dumbbell")}${count} ${plural(count, ["упражнение", "упражнения", "упражнений"])}</span>
          </div>
          <div class="hero-chips">${session.muscles.map((muscle) => `<span class="chip">${escapeHtml(muscle)}</span>`).join("")}</div>
          ${note ? `<p class="today-copy">${escapeHtml(note)}</p>` : ""}
          <button class="btn btn--primary hero-action" type="button" data-action="open-session" data-session="${session.number}" data-focus="home-open-session">
            Открыть тренировку ${icon("arrow-right")}
          </button>
        </div>
      </article>`;
  }

  function planHero() {
    const completed = CYCLE.status() === "completed";
    const message = completed
      ? "Цикл завершён — отличная работа! Новый персональный план готовит Вадим."
      : "Персональные тренировки не подключены. Пока доступны общие рекомендации.";
    return `
      <article class="today-card today-card--rest card">
        <span class="hero-art" aria-hidden="true"></span>
        <div class="hero-content">
          <div class="hero-top">
            <span class="hero-tag"><span class="eyebrow-dot"></span>${completed ? "Цикл завершён" : "Пакет не активирован"}</span>
            <span class="rest-badge" aria-hidden="true">${icon("user")}</span>
          </div>
          <h2 class="today-title">Персональный план</h2>
          <p class="today-copy">${escapeHtml(message)}</p>
          <button class="btn btn--primary hero-action" type="button" data-action="open-contact" data-focus="home-contact">
            Связаться с Вадимом ${icon("arrow-right")}
          </button>
        </div>
      </article>`;
  }

  function goalCard() {
    const start = DATA.goal.start;
    const latest = App.measurements.latest();
    const current = latest ? latest.values.weight : DATA.goal.current;
    const target = DATA.goal.target;
    const progress = percent(start - current, start - target);
    const lost = start - current;
    const left = Math.max(0, current - target);
    const values = App.measurements.sorted().slice(-8).map((entry) => entry.values.weight);
    const width = 640;
    const height = 142;
    const minValue = Math.min(target - 2, ...values) - 1;
    const maxValue = Math.max(...values, start) + 1;
    const padded = 10;
    const points = values.map((value, index) => {
      const x = padded + index * ((width - padded * 2) / (values.length - 1));
      const y = padded + ((maxValue - value) / (maxValue - minValue)) * (height - padded * 2);
      return [x, y];
    });
    const line = points.reduce((path, point, index) => {
      if (index === 0) return `M${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
      const previous = points[index - 1];
      const middle = (previous[0] + point[0]) / 2;
      return `${path} C${middle.toFixed(1)} ${previous[1].toFixed(1)}, ${middle.toFixed(1)} ${point[1].toFixed(1)}, ${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
    }, "");
    const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height - 2} L${points[0][0].toFixed(1)} ${height - 2} Z`;
    const gridLines = [84, 87, 90].map((value) => {
      const y = padded + ((maxValue - value) / (maxValue - minValue)) * (height - padded * 2);
      return `<line class="chart-grid" x1="${padded}" x2="${width - padded}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line>`;
    }).join("");
    return `
      <article class="goal-card card" aria-labelledby="goal-title">
        <div class="goal-head">
          <div>
            <span class="eyebrow">Прогресс цели</span>
            <h2 id="goal-title">Цель: снизить вес</h2>
          </div>
          <span class="goal-delta">${icon("trend-down")}−${weight(lost)} кг</span>
        </div>
        <div class="goal-current">
          <strong>${weight(current)}<small>кг</small></strong>
          <div class="goal-remaining">сейчас<br>До цели <b>${weight(left)} кг</b></div>
        </div>
        <div class="goal-track-wrap">
          <div class="goal-track" role="img" aria-label="Прогресс от ${weight(start)} до ${weight(target)} килограммов, сейчас ${weight(current)} килограммов">
            <span class="goal-fill" style="--goal-p:${progress.toFixed(2)}%"></span>
            <span class="goal-marker" style="--goal-p:${progress.toFixed(2)}%"></span>
          </div>
          <div class="goal-ends"><span>Старт <b>${weight(start)}</b></span><span>Цель <b>${weight(target)}</b></span></div>
        </div>
        <figure class="goal-chart" role="img" aria-label="График веса за последние ${values.length} ${plural(values.length, ["неделю", "недели", "недель"])}: с ${weight(values[0])} до ${weight(values[values.length - 1])} килограммов">
          <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
            <defs>
              <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style="stop-color:var(--accent);stop-opacity:.22"></stop>
                <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0"></stop>
              </linearGradient>
            </defs>
            ${gridLines}
            <path class="chart-area" d="${area}" fill="url(#weight-area)"></path>
            <path class="chart-line" pathLength="1" d="${line}"></path>
            ${points.map((point, index) => `<circle class="chart-dot${index === points.length - 1 ? " chart-dot--last" : ""}" cx="${point[0].toFixed(1)}" cy="${point[1].toFixed(1)}" r="${index === points.length - 1 ? 4 : 2.4}"></circle>`).join("")}
          </svg>
          <figcaption class="chart-caption"><span>${values.length} ${plural(values.length, ["неделя", "недели", "недель"])} назад</span><span><b>−${weight(lost)} кг</b> за ${values.length} ${plural(values.length, ["неделю", "недели", "недель"])}</span></figcaption>
        </figure>
      </article>`;
  }

  function messageCard() {
    return `
      <article class="message-card card">
        <div class="message-head">
          <span class="avatar avatar--sm avatar--coach" aria-hidden="true">В</span>
          <div class="message-ident"><strong>Сообщение от Вадима</strong><span>${escapeHtml(DATA.message.time)}</span></div>
          <span class="message-mark" aria-hidden="true">${icon("message")}</span>
        </div>
        <p class="message-text">${escapeHtml(DATA.message.text)}</p>
        <button class="message-contact" type="button" data-action="open-contact">Связаться с Вадимом ${icon("arrow-right")}</button>
      </article>`;
  }

  function nextMealCard() {
    const next = getNextMeal();
    const meal = DATA.mealTimes[next.index];
    const dish = DATA.menus[next.day][next.index][0];
    return `
      <a class="next-meal-card card" href="#/nutrition" data-nav="nutrition" aria-label="Следующий приём пищи: ${next.label}, ${meal.time}, ${meal.name} — ${dish.n}. Открыть питание">
        <span class="next-meal-time"><strong>${meal.time}</strong><span>${next.label}</span></span>
        <span class="next-meal-copy">
          <span class="eyebrow">Следующий приём пищи</span>
          <strong>${meal.name}</strong>
          <small>${escapeHtml(dish.n)} · ${dish.g} г</small>
        </span>
        <span class="next-meal-arrow" aria-hidden="true">${icon("chevron-right")}</span>
      </a>`;
  }

  App.views.home = { view: homeView };
})(window.App = window.App || {});
