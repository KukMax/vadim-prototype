(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const {
    NOW, TODAY, NOW_MINUTES, DAY_SHORT, WEEK_DATES, SESSION_COUNT, intFmt, oneFmt,
    weightFmt, addDays, icon, escapeHtml, plural, one, num, weight, formatLongDate,
    greetingForHour, getNextMeal, getNextWorkout, sumDishes, menuTotals, planTotals,
    eatenTotals, eatenMealCount, waterCount, workoutsDone, percent,
  } = App.util;
  const { ringMarkup, macroRows, weekStrip, foodDays, coachNoteCard, statTile, miniBars, miniDots } = App.ui;
  App.views = App.views || {};

  function workoutsView() {
    const day = DATA.schedule[STATE.workoutDay];
    const isToday = STATE.workoutDay === TODAY;
    const isFinished = STATE.finished[STATE.workoutDay];
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>План недели от Вадима</span>
        <h1 id="workouts-title" tabindex="-1">Тренировки</h1>
        <p class="screen-sub">${isToday ? "Сегодняшняя тренировка уже готова." : `${formatLongDate(WEEK_DATES[STATE.workoutDay])}.`} Отмечай упражнения и следи за прогрессом.</p>
      </div>
      <article class="week-panel card">
        <div class="card-head">
          <h2 class="card-title">Неделя</h2>
          <span class="card-hint">${workoutsDone()} из ${SESSION_COUNT} ${plural(SESSION_COUNT, ["тренировки", "тренировок", "тренировок"])}</span>
        </div>
        ${weekStrip(STATE.workoutDay, "select-workout-day")}
      </article>
      ${day.rest ? restDayView(STATE.workoutDay) : sessionView(STATE.workoutDay, isFinished)}
      ${!day.rest && !isFinished ? `<div class="dock-spacer" aria-hidden="true"></div>` : ""}`;
  }
  function sessionView(dayIndex, isFinished) {
    const day = DATA.schedule[dayIndex];
    const date = WEEK_DATES[dayIndex];
    const done = STATE.exerciseDone[dayIndex];
    const doneCount = done.filter(Boolean).length;
    const total = day.exercises.length;
    const progress = percent(doneCount, total);
    const status = isFinished ? "Завершена" : dayIndex === TODAY ? "Сегодня" : "Запланирована";
    return `
      <article class="session-card card">
        <div class="session-topline">
          <span class="eyebrow">${formatLongDate(date)}${dayIndex === TODAY ? " · сегодня" : ""}</span>
          <span class="badge${isFinished ? " badge--done" : ""}">${status}</span>
        </div>
        <h2 class="session-title">${escapeHtml(day.title)}</h2>
        <div class="session-meta">
          <span class="chip">${icon("clock")}${day.duration} мин</span>
          <span class="chip">${icon("dumbbell")}${total} ${plural(total, ["упражнение", "упражнения", "упражнений"])}</span>
          <span class="chip">${day.intensity}</span>
        </div>
        <div class="session-progress">
          <div class="progress-label"><span>Прогресс тренировки</span><b>${doneCount} из ${total} ${plural(total, ["упражнение", "упражнения", "упражнений"])}</b></div>
          <div class="progress-track" role="progressbar" aria-label="Выполнено упражнений" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${doneCount}">
            <span class="progress-fill" style="--progress:${progress}%"></span>
          </div>
        </div>
      </article>
      <div class="workout-grid">
        <div class="workout-main">
          <div class="section-line"><h2>Упражнения</h2><span>${total} ${plural(total, ["упражнение", "упражнения", "упражнений"])}</span></div>
          <div class="exercise-list">${day.exercises.map((exercise, index) => exerciseCard(dayIndex, exercise, index, isFinished)).join("")}</div>
        </div>
        <aside class="workout-side">${coachNoteCard(day.coachNote)}</aside>
      </div>`;
  }
  function exerciseCard(dayIndex, exercise, index, locked) {
    const key = `${dayIndex}-${index}`;
    const open = STATE.openExercise === key;
    const done = STATE.exerciseDone[dayIndex][index];
    const first = exercise.sets[0];
    const weightText = first[1] === null ? "свой вес" : `${one(first[1])} кг`;
    const summary = `${exercise.sets.length} × ${first[0]} · ${weightText} · отдых ${exercise.rest} с`;
    const checkLabel = `${done ? "Снять отметку" : "Отметить"} упражнение «${exercise.name}»`;
    return `
      <article class="exercise-card card${done ? " is-done" : ""}${open ? " is-open" : ""}">
        <div class="exercise-row">
          <button class="exercise-main" type="button" data-action="toggle-exercise" data-day="${dayIndex}" data-index="${index}" data-focus="exercise-toggle-${key}" aria-expanded="${open}" aria-controls="exercise-detail-${key}">
            <span class="exercise-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="exercise-info">
              <span class="exercise-name">${escapeHtml(exercise.name)}</span>
              <span class="exercise-meta"><span class="chip">${escapeHtml(exercise.muscle)}</span><span class="exercise-summary">${summary}</span></span>
            </span>
            <svg class="icon exercise-caret" aria-hidden="true"><use href="#i-chevron-down"></use></svg>
          </button>
          <button class="exercise-check" type="button" data-action="toggle-exercise-done" data-day="${dayIndex}" data-index="${index}" data-focus="exercise-check-${key}" aria-pressed="${done}" aria-label="${checkLabel}" ${locked ? "disabled" : ""}>
            ${icon("check")}
          </button>
        </div>
        <div class="exercise-detail" id="exercise-detail-${key}" ${open ? "" : "hidden"}>
          <div class="exercise-detail-inner">
            <div class="set-table-wrap">
              <table class="set-table">
                <caption class="sr-only">Подходы упражнения ${escapeHtml(exercise.name)}</caption>
                <thead><tr><th scope="col">Подход</th><th scope="col">Повторы</th><th scope="col">Вес</th></tr></thead>
                <tbody>${exercise.sets.map((set, setIndex) => `<tr><td>${setIndex + 1}</td><td>${set[0]}</td><td>${set[1] === null ? "—" : `${one(set[1])} кг`}</td></tr>`).join("")}</tbody>
              </table>
            </div>
            <p class="exercise-tip">${icon("spark")}<span><strong>Подсказка тренера.</strong> ${escapeHtml(exercise.tip)}</span></p>
          </div>
        </div>
      </article>`;
  }
  function restDayView(dayIndex) {
    const day = DATA.schedule[dayIndex];
    const base = Math.max(dayIndex, TODAY);
    const next = getNextWorkout(base);
    const nextHtml = next ? restNextCard(next, next.inWeek ? "select-workout-day" : null) : "";
    return `
      <article class="rest-card card">
        <div class="rest-head">
          <span class="rest-badge" aria-hidden="true">${icon("moon")}</span>
          <div class="rest-copy">
            <span class="eyebrow">${formatLongDate(WEEK_DATES[dayIndex])}${dayIndex === TODAY ? " · сегодня" : ""}</span>
            <h2>${dayIndex === TODAY ? "Сегодня отдых" : "День восстановления"}</h2>
            <p>${escapeHtml(day.tip)}</p>
          </div>
        </div>
        <div class="rest-ideas">
          ${day.ideas.map((idea) => `<span>${icon("check")}${escapeHtml(idea)}</span>`).join("")}
        </div>
        ${nextHtml}
        <p class="rest-quote">${icon("message")}<span>Мышцы растут не на тренировке, а во время восстановления. Отнесись к отдыху как к части плана.</span></p>
      </article>`;
  }
  function restNextCard(next, action) {
    const copy = `
      <span class="rest-next-copy">
        <span>Следующая тренировка</span>
        <strong>${DAY_SHORT[next.index]} · ${escapeHtml(next.session.title)}</strong>
        <small>${next.session.duration} мин · ${next.session.exercises.length} ${plural(next.session.exercises.length, ["упражнение", "упражнения", "упражнений"])}</small>
      </span>
      ${action ? `<span class="rest-next-arrow" aria-hidden="true">${icon("arrow-right")}</span>` : ""}`;
    return action
      ? `<button class="rest-next" type="button" data-action="${action}" data-day="${next.index}" aria-label="Открыть тренировку ${DAY_SHORT[next.index]}, ${escapeHtml(next.session.title)}">${copy}</button>`
      : `<div class="rest-next">${copy}</div>`;
  }

  App.views.workouts = { view: workoutsView };
})(window.App = window.App || {});
