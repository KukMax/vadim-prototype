(function (App) {
  "use strict";

  const DATA = App.data;
  const { NOW, NOW_MINUTES, TODAY, isoDate, parseIsoDate, daysBetween, toMinutes } = App.util;

  function buildState() {
    const finished = DATA.schedule.map((day, index) => !day.rest && index < TODAY);
    const exerciseDone = DATA.schedule.map((day, index) => {
      if (!day.exercises) return [];
      return day.exercises.map(() => finished[index]);
    });
    const todayMeals = DATA.mealTimes.map((meal) => NOW_MINUTES >= toMinutes(meal.time));
    if (!DATA.schedule[TODAY].rest) {
      const startedCount = NOW.getHours() >= 18 ? 3 : NOW.getHours() >= 11 ? 2 : 0;
      exerciseDone[TODAY] = DATA.schedule[TODAY].exercises.map((_, index) => index < startedCount);
    }
    return {
      workoutDay: TODAY,
      foodDay: TODAY,
      meals: Array.from({ length: 7 }, (_, day) => day < TODAY ? DATA.mealTimes.map(() => true) : day === TODAY ? todayMeals.slice() : DATA.mealTimes.map(() => false)),
      water: Array.from({ length: 7 }, (_, day) => Array.from({ length: DATA.targets.water }, (_, glass) => day < TODAY || (day === TODAY && glass < 5))),
      finished,
      exerciseDone,
      openExercise: null,
      reportFormOpen: false,
      reportMetric: "weight",
      reportShowAll: false,
      supplementsOpen: false,
      avatar: null,
      measurements: DATA.measurementsSeed.map((entry) => ({
        date: entry.date,
        values: Object.assign({}, entry.values),
      })),
      theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
    };
  }

  const STATE = buildState();

  const measurements = {
    all() {
      return STATE.measurements;
    },
    sorted() {
      return STATE.measurements.slice().sort((a, b) => a.date.localeCompare(b.date));
    },
    latest() {
      const list = this.sorted();
      return list.length ? list[list.length - 1] : null;
    },
    previous() {
      const list = this.sorted();
      return list.length > 1 ? list[list.length - 2] : null;
    },
    latestValue(key) {
      const entry = this.latest();
      return entry ? entry.values[key] : null;
    },
    previousValue(key) {
      const entry = this.previous();
      return entry ? entry.values[key] : null;
    },
    isDue() {
      const entry = this.latest();
      if (!entry) return true;
      return daysBetween(entry.date, isoDate(NOW)) >= 7;
    },
    nextDate() {
      const entry = this.latest();
      if (!entry) return isoDate(NOW);
      return isoDate(new Date(parseIsoDate(entry.date).getTime() + 7 * 86400000));
    },
    save(values) {
      const today = isoDate(NOW);
      const entry = { date: today, values: Object.assign({}, values) };
      const index = STATE.measurements.findIndex((item) => item.date === today);
      if (index >= 0) STATE.measurements[index] = entry;
      else STATE.measurements.push(entry);
      return entry;
    },
  };

  App.state = STATE;
  App.measurements = measurements;
})(window.App = window.App || {});
