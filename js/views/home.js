(function (App) {
  "use strict";

  const DATA = App.data;
  const CYCLE = App.cycle;
  const STATE = App.state;
  const SUB = App.subscription;
  const CALORIES = App.calories;
  const {
    NOW, TODAY, WEEK_DATES, icon, escapeHtml, plural, num, weight, percent,
    formatLongDate, greetingForHour, getNextMeal, eatenTotals, waterCount,
  } = App.util;
  const { ringMarkup, macroRows, cycleMini, statTile, miniBars } = App.ui;
  App.views = App.views || {};

  const PENDING_TEXT = DATA.pendingText;

  // Пакеты, которые ждут активации: статусы ставит отправка анкеты, поэтому
  // достаточно их — демо-панель может активировать пакет, и чип исчезнет.
  function pendingPackages() {
    const packages = [];
    if (STATE.training.status === "pending") packages.push("training");
    if (STATE.nutrition && STATE.nutrition.status === "pending") packages.push("nutrition");
    return packages;
  }

  function pendingBanner() {
    const packages = pendingPackages();
    if (!packages.length) return "";
    const chips = packages.map((value) => `<span class="chip chip--pending">${value === "nutrition" ? "Питание" : "Тренировки"}</span>`).join("");
    return `
      <article class="pending-card card" aria-labelledby="home-pending-title">
        <span class="pending-icon" aria-hidden="true">${icon("clock")}</span>
        <div class="pending-body">
          <h2 class="pending-title" id="home-pending-title">Ожидает активации</h2>
          <p class="pending-text">${PENDING_TEXT}</p>
          <div class="pending-chips">${chips}</div>
        </div>
      </article>`;
  }

  // Название цели — тем же списком, что и на экране анкеты: своих текстов
  // главная не придумывает.
  function goalLabel(key) {
    const goals = DATA.questionnaire && DATA.questionnaire.goals ? DATA.questionnaire.goals : [];
    const found = goals.filter((entry) => entry.key === key)[0];
    return found ? found.label : "";
  }

  // Новый клиент — это тот, у кого пакет ещё ни разу не работал: если он уже
  // был активен и закончился, путь «анкета → ожидание» ему не показываем.
  function showNextSteps() {
    const statuses = [SUB.status("training"), SUB.status("nutrition")];
    return statuses.indexOf("active") === -1 && statuses.indexOf("completed") === -1;
  }

  // Пока клиент не внёс ни одного замера, графика и прогресса нет — вместо
  // них стартовая карточка с весом из анкеты и первым замером.
  function startCard() {
    const submission = STATE.submission;
    if (!submission) return "";
    const label = goalLabel(submission.goal);
    const current = submission.weight;
    const target = submission.targetWeight;
    const left = current != null && target != null ? current - target : 0;
    const goalText = label ? `Цель: ${escapeHtml(label.charAt(0).toLowerCase() + label.slice(1))}` : "Цель из анкеты";
    return `
      <article class="goal-card card goal-card--start" aria-labelledby="goal-title">
        <div class="goal-head">
          <div>
            <span class="eyebrow">Старт</span>
            <h2 id="goal-title">${goalText}</h2>
          </div>
        </div>
        <div class="goal-current">
          <strong>${current == null ? "—" : weight(current)}<small>кг</small></strong>
          <div class="goal-remaining">сейчас${left > 0 ? `<br>До цели <b>${weight(left)} кг</b>` : ""}</div>
        </div>
        <p class="goal-note">Динамика появится после первого замера: раз в неделю, утром и натощак. Замеры видит Вадим.</p>
        <button class="btn btn--primary goal-start-action" type="button" data-action="open-measure-form">Сделать первый замер</button>
      </article>`;
  }

  // «Что дальше»: путь нового клиента, пока ни один пакет ещё не активен.
  function nextStepsCard() {
    if (!showNextSteps()) return "";
    const items = DATA.nextSteps.map((step, index) => `
        <li class="next-step">
          <span class="next-step-num" aria-hidden="true">${index + 1}</span>
          <span class="next-step-copy"><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(step.text)}</span></span>
        </li>`).join("");
    return `
      <article class="next-steps card" aria-labelledby="home-next-title">
        <div class="card-head"><h2 class="card-title" id="home-next-title">Что дальше</h2></div>
        <ol class="next-steps-list">${items}
        </ol>
        <div class="next-steps-actions">
          <button class="btn btn--primary" type="button" data-action="open-contact" data-focus="home-next-contact">Связаться с Вадимом</button>
          <a class="btn btn--ghost" href="#/workouts" data-nav="workouts">Общие рекомендации</a>
        </div>
      </article>`;
  }

  function homeView() {
    const total = DATA.subscription.training.sessions;
    const cycleData = CYCLE.current();
    const trainingStatus = SUB.status("training");
    const nutritionActive = SUB.status("nutrition") === "active";
    const hasPlan = CYCLE.hasPlan();
    const done = CYCLE.doneCount(cycleData);
    // Истёкший пакет ведёт себя как завершённый: открывать тренировку нельзя.
    const next = trainingStatus === "active" ? CYCLE.nextSession(cycleData) : null;
    const eaten = eatenTotals(TODAY);
    const water = waterCount(TODAY);
    const latestMeasure = App.measurements.latest();
    const submission = STATE.submission;
    // Без замеров вес берём из анкеты, а если и её нет — прочерк: чужих цифр
    // на главной быть не должно.
    const currentWeight = latestMeasure ? latestMeasure.values.weight : submission && submission.weight != null ? submission.weight : null;
    const weightDelta = DATA.goal.start - currentWeight;
    const measuresDue = !!latestMeasure && App.measurements.isDue();
    // Норма калорий — из формулы (или правки тренера), поддержка — из формулы.
    const calorieTarget = CALORIES.target();
    const caloriePercent = percent(eaten.kcal, calorieTarget);
    const calorieRing = ringMarkup(caloriePercent, { size: 42, stroke: 4 });
    const waterFull = water >= DATA.targets.water;
    const trainingMeta = trainingStatus === "active"
      ? `цикл №${cycleData.number}`
      : trainingStatus === "completed"
        ? "цикл завершён"
        : CYCLE.isPending() ? "ожидает активации" : "план не активен";
    const trainingValue = hasPlan
      ? `${done} <span class="stat-divider">/</span> ${total}`
      : `<span class="stat-divider">—</span> / <span class="stat-divider">—</span>`;
    const trainingSpoken = hasPlan
      ? `${done} из ${total} тренировок цикла`
      : CYCLE.isPending() ? "Тренировки ожидают активации" : "Персональный план тренировок не активирован";
    // Калории и вода — часть пакета питания: без него плитки пустые, а не «ноль».
    const nutritionTiles = nutritionActive ? `
        ${statTile({
          href: "#/nutrition", route: "nutrition", label: "Калории", iconName: "flame",
          value: num(eaten.kcal), spoken: `${num(eaten.kcal)} из ${num(calorieTarget)} ккал`,
          meta: `из ${num(calorieTarget)} ккал`, note: `норма ${num(CALORIES.tdee())} ккал`, visual: calorieRing,
        })}
        ${statTile({
          href: "#/nutrition", route: "nutrition", label: "Вода", iconName: "drop",
          value: `${water} <span class="stat-divider">/</span> ${DATA.targets.water}`,
          spoken: `${water} из ${DATA.targets.water} стаканов`, meta: "стаканов",
          quick: `<button class="stat-quick" type="button" data-action="add-water" data-day="${TODAY}" data-focus="water-add" aria-disabled="${waterFull}" aria-label="${waterFull ? "Норма воды на сегодня выполнена" : "Добавить стакан воды"}">${icon(waterFull ? "check" : "plus")}</button>`,
        })}` : "";
    const stats = `
      <div class="stats-grid">
        ${nutritionTiles}
        ${statTile({
          href: "#/workouts", route: "workouts", label: "Тренировки", iconName: "dumbbell",
          value: trainingValue, spoken: trainingSpoken, meta: trainingMeta,
          visual: miniBars(hasPlan ? done : 0, total),
        })}
        ${statTile({
          href: "#/reports", route: "reports", label: "Вес", iconName: "scale",
          value: currentWeight == null ? `<span class="stat-divider">—</span>` : `${weight(currentWeight)} <span class="stat-unit">кг</span>`,
          spoken: currentWeight == null
            ? "Замеров пока нет"
            : latestMeasure
              ? `Текущий вес ${weight(currentWeight)} килограммов, минус ${weight(weightDelta)} килограмма с начала`
              : `Вес из анкеты ${weight(currentWeight)} килограммов`,
          meta: latestMeasure
            ? `<span class="stat-trend">${icon("trend-down")}−${weight(weightDelta)} кг с начала</span>`
            : currentWeight == null ? "замеров пока нет" : "из анкеты",
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
    // Сообщение от Вадима — демо-текст демо-клиента: у нового клиента
    // сообщений ещё нет, поэтому карточка не показывается.
    const sideCards = `${STATE.submission ? "" : messageCard()}${nutritionActive ? nextMealCard() : ""}`;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>${formatLongDate(WEEK_DATES[TODAY])}</span>
        <h1 class="home-title" id="home-title" tabindex="-1">${greetingForHour(NOW.getHours())}, <span class="home-name">${escapeHtml(App.profile.displayName())}</span></h1>
      </div>
      ${pendingBanner()}
      ${nextStepsCard()}
      ${measuresDue ? `<a class="measure-reminder" href="#/reports" data-action="open-measure-form"><span class="measure-reminder-icon">${icon("calendar")}</span><span class="measure-reminder-copy"><strong>Пора внести замеры — раз в неделю</strong><span>Так прогресс виден точнее</span></span><span class="measure-reminder-cta">Внести ${icon("chevron-right")}</span></a>` : ""}
      <div class="dash-grid">
        ${next ? trainingHero(cycleData, next, total) : planHero()}
        ${stats}
        ${latestMeasure ? goalCard() : startCard()}
        ${nutritionActive ? `<article class="macro-card card" aria-label="Макросы за сегодня">
          <div class="card-head"><h2 class="card-title">Макросы сегодня</h2><span class="card-hint">из нормы</span></div>
          ${macroRows(eaten)}
        </article>` : ""}
        ${cycleCardMarkup}
        ${sideCards ? `<div class="home-side">${sideCards}</div>` : ""}
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
    const status = SUB.status("training");
    const expired = status === "completed" && SUB.info("training").expired;
    const completed = status === "completed";
    const pending = CYCLE.isPending();
    const message = expired
      ? "30 дней пакета закончились. Новый план и продление — у Вадима."
      : completed
        ? "Цикл завершён — отличная работа! Новый персональный план готовит Вадим."
        : pending
          ? PENDING_TEXT
          : "Персональные тренировки не подключены. Пока доступны общие рекомендации.";
    const tag = expired ? "Срок пакета истёк" : completed ? "Цикл завершён" : pending ? "Ожидает активации" : "Пакет не активирован";
    return `
      <article class="today-card today-card--rest card">
        <span class="hero-art" aria-hidden="true"></span>
        <div class="hero-content">
          <div class="hero-top">
            <span class="hero-tag"><span class="eyebrow-dot"></span>${tag}</span>
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
