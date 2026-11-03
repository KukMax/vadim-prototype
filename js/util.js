(function (App) {
  "use strict";

  const DATA = App.data;
  const DAY_SHORT = App.const.DAY_SHORT;
  const THEME_KEY = "vadim-theme";
  const NOW = new Date();
  const TODAY = (NOW.getDay() + 6) % 7;
  const NOW_MINUTES = NOW.getHours() * 60 + NOW.getMinutes();
  const intFmt = new Intl.NumberFormat("ru-RU");
  const oneFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  const weightFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const longDateFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  const WEEK_START = addDays(NOW, -TODAY);
  const WEEK_DATES = App.const.DAY_SHORT.map((_, index) => addDays(WEEK_START, index));
  const pad2 = (value) => String(value).padStart(2, "0");
  const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());
  const isoDate = (date) => (isValidDate(date) ? `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` : "");
  const parseIsoDate = (value) => {
    if (value instanceof Date) return isValidDate(value) ? value : new Date(NaN);
    const parts = String(value == null ? "" : value).split("-").map(Number);
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return new Date(NaN);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };
  const daysBetween = (fromIso, toIso) => {
    const from = typeof fromIso === "string" ? parseIsoDate(fromIso) : fromIso;
    const to = typeof toIso === "string" ? parseIsoDate(toIso) : toIso;
    if (!isValidDate(from) || !isValidDate(to)) return 0;
    return Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()) - new Date(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
  };
  const shortDateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
  const formatShortDate = (value) => {
    const date = parseIsoDate(value);
    return isValidDate(date) ? shortDateFmt.format(date).replace(".", "") : "—";
  };
  const formatShortDateNoYear = (value) => {
    const date = parseIsoDate(value);
    return isValidDate(date) ? shortDateFmt.format(date) : "—";
  };
  const formatDateRange = (fromIso, toIso) => {
    if (!fromIso || !toIso) return "";
    return formatShortDate(fromIso) + " – " + formatShortDate(toIso);
  };

  function toMinutes(value) {
    const parts = value.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  function plural(number, forms) {
    const n = Math.abs(number) % 100;
    const last = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function percent(part, total) {
    if (!total) return 0;
    return clamp((part / total) * 100, 0, 100);
  }
  function num(value) {
    return intFmt.format(Math.round(value));
  }
  function one(value) {
    return oneFmt.format(value);
  }
  function weight(value) {
    return weightFmt.format(value);
  }
  function icon(name, extraClass = "") {
    return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }
  function formatLongDate(date) {
    return isValidDate(date) ? capitalize(longDateFmt.format(date)) : "—";
  }
  function greetingForHour(hour) {
    if (hour >= 5 && hour < 12) return "Доброе утро";
    if (hour >= 12 && hour < 18) return "Добрый день";
    if (hour >= 18) return "Добрый вечер";
    return "Доброй ночи";
  }
  function getNextMeal() {
    for (let index = 0; index < DATA.mealTimes.length; index += 1) {
      if (toMinutes(DATA.mealTimes[index].time) > NOW_MINUTES) {
        return { day: TODAY, index, label: "сегодня" };
      }
    }
    return { day: (TODAY + 1) % 7, index: 0, label: "завтра" };
  }
  function sumDishes(dishes) {
    const totals = dishes.reduce((total, dish) => ({
      p: total.p + dish.p,
      f: total.f + dish.f,
      c: total.c + dish.c,
    }), { p: 0, f: 0, c: 0 });
    totals.kcal = Math.round(totals.p * 4 + totals.f * 9 + totals.c * 4);
    return totals;
  }
  function menuTotals(dayIndex) {
    return DATA.menus[dayIndex].map((dishes) => sumDishes(dishes));
  }
  function planTotals(dayIndex) {
    const meals = menuTotals(dayIndex);
    const totals = meals.reduce((total, meal) => ({
      p: total.p + meal.p,
      f: total.f + meal.f,
      c: total.c + meal.c,
    }), { p: 0, f: 0, c: 0 });
    totals.kcal = Math.round(totals.p * 4 + totals.f * 9 + totals.c * 4);
    return totals;
  }
  function eatenTotals(dayIndex) {
    const meals = menuTotals(dayIndex);
    const totals = meals.reduce((total, meal, index) => {
      if (!App.state.meals[dayIndex][index]) return total;
      return {
        p: total.p + meal.p,
        f: total.f + meal.f,
        c: total.c + meal.c,
      };
    }, { p: 0, f: 0, c: 0 });
    totals.kcal = Math.round(totals.p * 4 + totals.f * 9 + totals.c * 4);
    return totals;
  }
  function eatenMealCount(dayIndex) {
    return App.state.meals[dayIndex].filter(Boolean).length;
  }
  function waterCount(dayIndex) {
    return App.state.water[dayIndex].filter(Boolean).length;
  }
  App.util = { THEME_KEY, NOW, TODAY, NOW_MINUTES, intFmt, oneFmt, weightFmt, longDateFmt,
    addDays, isoDate, parseIsoDate, daysBetween, formatShortDate, formatShortDateNoYear, formatDateRange, DAY_SHORT, WEEK_START, WEEK_DATES, toMinutes, capitalize, plural, clamp,
    percent, num, one, weight, icon, escapeHtml, formatLongDate, greetingForHour,
    getNextMeal, sumDishes, menuTotals, planTotals, eatenTotals,
    eatenMealCount, waterCount };
})(window.App = window.App || {});
