/* Норма калорий по формуле Миффлина — Сан-Жеора.
   Считается из анкеты онбординга; пока анкеты нет — из демо-данных клиента.
   Ручная правка тренера (STATE.calorieOverride) важнее любого расчёта.
   Всё живёт в памяти: ни анкета, ни правка в storage не попадают. */
(function (App) {
  "use strict";

  const DATA = App.data;

  // Коэффициенты активности и поправка на цель — единственные числа,
  // которые меняют формулу. Ключи совпадают с анкетой.
  const ACTIVITY_FACTORS = { sedentary: 1.2, moderate: 1.45, high: 1.7 };
  const GOAL_PERCENTS = { lose: -15, maintain: 0, gain: 10 };

  const factorFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

  function numberOr(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function labelOf(group, key) {
    const list = DATA.questionnaire && DATA.questionnaire[group] ? DATA.questionnaire[group] : [];
    const found = list.filter((item) => item.key === key)[0];
    return found ? found.label : "";
  }

  // Демо-фолбэк: пол, активность и цель фиксированы, вес — последний замер,
  // а если замеров нет — текущий вес из цели.
  function demoInput() {
    const latest = App.measurements && typeof App.measurements.latest === "function"
      ? App.measurements.latest()
      : null;
    const measured = latest && latest.values ? latest.values.weight : null;
    return {
      source: "demo",
      sex: "male",
      age: DATA.client.age,
      height: DATA.client.height,
      weight: numberOr(measured, DATA.goal.current),
      activity: "moderate",
      goal: "lose",
    };
  }

  function normalize(snapshot, source) {
    return {
      source,
      sex: snapshot.sex === "female" ? "female" : "male",
      age: numberOr(snapshot.age, DATA.client.age),
      height: numberOr(snapshot.height, DATA.client.height),
      weight: numberOr(snapshot.weight, DATA.goal.current),
      activity: ACTIVITY_FACTORS[snapshot.activity] ? snapshot.activity : "moderate",
      goal: GOAL_PERCENTS[snapshot.goal] !== undefined ? snapshot.goal : "maintain",
    };
  }

  // Вход формулы: заполненная анкета, иначе демо-данные.
  function input() {
    const snapshot = App.state ? App.state.questionnaire : null;
    return snapshot ? normalize(snapshot, "questionnaire") : demoInput();
  }

  function fromQuestionnaire() {
    const snapshot = App.state ? App.state.questionnaire : null;
    return snapshot ? normalize(snapshot, "questionnaire") : null;
  }

  function bmr(data) {
    const item = data || input();
    const sexShift = item.sex === "female" ? -161 : 5;
    return 10 * item.weight + 6.25 * item.height - 5 * item.age + sexShift;
  }

  function tdee(data) {
    const item = data || input();
    return bmr(item) * (ACTIVITY_FACTORS[item.activity] || ACTIVITY_FACTORS.moderate);
  }

  function adjustPercent(data) {
    const item = data || input();
    return GOAL_PERCENTS[item.goal] !== undefined ? GOAL_PERCENTS[item.goal] : 0;
  }

  // Норму показываем «круглой» вниз: 2 260,4 → 2 260.
  function roundDown(value) {
    return Math.floor(value / 10) * 10;
  }

  function calculatedTarget(data) {
    const item = data || input();
    return roundDown(tdee(item) * (1 + adjustPercent(item) / 100));
  }

  // Правка тренера: пустое значение правкой не считается.
  function overrideValue() {
    const raw = App.state ? App.state.calorieOverride : null;
    if (raw === null || raw === undefined || raw === "") return null;
    const value = Number(raw);
    return isFinite(value) && value > 0 ? value : null;
  }

  // Приоритет: ручная правка → расчёт по анкете → константа демо-клиента.
  function target() {
    const override = overrideValue();
    if (override !== null) return Math.round(override);
    const questionnaire = fromQuestionnaire();
    if (questionnaire) return calculatedTarget(questionnaire);
    return DATA.targets.kcal;
  }

  function percentText(percent) {
    if (percent > 0) return `+${percent}%`;
    if (percent < 0) return `−${Math.abs(percent)}%`;
    return "0%";
  }

  // Числа и подписи для карточки «Откуда норма калорий».
  function explain() {
    const item = input();
    const base = bmr(item);
    const support = tdee(item);
    const percent = adjustPercent(item);
    const factor = ACTIVITY_FACTORS[item.activity] || ACTIVITY_FACTORS.moderate;
    return {
      source: item.source,
      sex: item.sex,
      age: item.age,
      height: item.height,
      weight: item.weight,
      bmr: base,
      tdee: support,
      adjustPercent: percent,
      target: roundDown(support * (1 + percent / 100)),
      activity: {
        key: item.activity,
        label: labelOf("activityLevels", item.activity),
        factor,
        factorText: factorFmt.format(factor),
      },
      goal: {
        key: item.goal,
        label: labelOf("goals", item.goal),
        percent,
        percentText: percentText(percent),
      },
    };
  }

  App.calories = { bmr, tdee, adjustPercent, target, fromQuestionnaire, explain };
})(window.App = window.App || {});
