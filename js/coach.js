/* Кабинет тренера: вымышленные клиенты и правила их пакетов (прототип).
   Модуль ничего не знает про App.state и не трогает демо-кабинет: только
   чтение собственных фикстур и чистые функции статусов. */
(function (App) {
  "use strict";

  const { percent, plural } = App.util;

  // Пакет: used — сколько уже израсходовано, total — сколько входит в пакет,
  // startedDaysAgo — сколько дней назад активирован (null — не активирован).
  // Все клиенты, кроме Алексея, вымышлены целиком.
  const CLIENTS = [
    {
      id: "alexey",
      name: "Алексей",
      initials: "А",
      age: 32,
      height: 180,
      weight: 86.4,
      goal: "Снизить вес",
      weightStart: 92,
      weightNow: 86.4,
      weightTarget: 78,
      packages: {
        training: { used: 7, total: 12, startedDaysAgo: 12 },
        nutrition: { used: 12, total: 30, startedDaysAgo: 12 },
      },
      lastSeenDaysAgo: 0,
      note: "Проверить технику приседа: вес растёт быстрее плана",
      // Анкета, тренировки и питание карточки. Пол, возраст и рост — часть
      // анкеты, но лежат выше: их читает и список. Данные медицинские по сути,
      // поэтому живут только в памяти и в storage не попадают.
      questionnaire: {
        sex: "Мужской",
        activity: "Средняя активность",
        sessions: 3,
        level: "Средний",
        limits: "Колено: без глубоких приседов",
        allergies: "Аллергий нет",
        foodLimits: "Не любит рыбу",
      },
      lastTraining: { title: "Верх тела", daysAgo: 1 },
      nextTraining: "Низ тела",
      nutrition: { targetKcal: 2100, avgKcal: 1980, targetWater: 8, avgWater: 6 },
      // Демо-клиент: цифры совпадают с демо-кабинетом Trenio.
      isDemo: true,
    },
    {
      id: "marina",
      name: "Марина",
      initials: "М",
      age: 28,
      height: 168,
      weight: 61.2,
      goal: "Набрать мышечную массу",
      weightStart: 58.4,
      weightNow: 61.2,
      weightTarget: 66,
      packages: {
        training: { used: 12, total: 12, startedDaysAgo: 20 },
        nutrition: { used: 12, total: 30, startedDaysAgo: 20 },
      },
      lastSeenDaysAgo: 1,
      note: "Готова продлить тренировки",
      questionnaire: {
        sex: "Женский",
        activity: "Высокая активность",
        sessions: 4,
        level: "Продвинутый",
        limits: "Ограничений нет",
        allergies: "Лактоза",
        foodLimits: "Без свинины",
      },
      lastTraining: { title: "Низ тела", daysAgo: 2 },
      nextTraining: "Верх тела",
      nutrition: { targetKcal: 2300, avgKcal: 2410, targetWater: 8, avgWater: 8 },
    },
    {
      id: "igor",
      name: "Игорь",
      initials: "И",
      age: 41,
      height: 176,
      weight: 94.8,
      goal: "Снизить вес",
      weightStart: 97.2,
      weightNow: 94.8,
      weightTarget: 85,
      packages: {
        training: { used: 3, total: 12, startedDaysAgo: 5 },
        nutrition: { used: 3, total: 30, startedDaysAgo: 5 },
      },
      lastSeenDaysAgo: 2,
      note: "Анкета заполнена, план готовлю",
      questionnaire: {
        sex: "Мужской",
        activity: "Низкая активность",
        sessions: 2,
        level: "Новичок",
        limits: "Спина: остеохондроз",
        allergies: "Аллергий нет",
        foodLimits: "Поздние ужины",
      },
      lastTraining: { title: "Всё тело", daysAgo: 3 },
      nextTraining: "Всё тело",
      nutrition: { targetKcal: 2400, avgKcal: 2650, targetWater: 8, avgWater: 5 },
    },
    {
      id: "olga",
      name: "Ольга",
      initials: "О",
      age: 35,
      height: 165,
      weight: 72.5,
      goal: "Поддерживать свою форму",
      weightStart: 72.5,
      weightNow: 72.5,
      weightTarget: 72.5,
      packages: {
        training: { used: 0, total: 12, startedDaysAgo: null },
        nutrition: { used: 30, total: 30, startedDaysAgo: 40 },
      },
      lastSeenDaysAgo: 9,
      note: "Не заходила 9 дней — написать",
      questionnaire: {
        sex: "Женский",
        activity: "Средняя активность",
        sessions: 2,
        level: "Средний",
        limits: "Ограничений нет",
        allergies: "Орехи",
        foodLimits: "Без сладкого вечером",
      },
      lastTraining: { title: "Всё тело", daysAgo: 9 },
      nextTraining: null,
      nutrition: { targetKcal: 1900, avgKcal: 1740, targetWater: 8, avgWater: 4 },
    },
  ];

  const FILTERS = [
    { key: "all", label: "Все" },
    { key: "active", label: "Активные" },
    { key: "ending", label: "Заканчиваются" },
    { key: "finished", label: "Завершённые" },
    { key: "inactive", label: "Без старта" },
  ];

  const PACKAGE_KEYS = ["training", "nutrition"];
  const PACKAGE_TITLES = { training: "Тренировки", nutrition: "Питание" };

  // «Заканчивается» считаем по последней неделе пакета.
  const ENDING_DAYS = 7;
  // Отклонение среднего калорий от нормы в пределах сотни — ещё «в норме».
  const BUDGET_TOLERANCE = 100;

  // Глубокая копия: карточка клиента читает вложенные анкету, тренировки и
  // питание, а ручной список полей уже терял новые данные. Фикстуры состоят
  // только из строк, чисел, null и простых объектов, поэтому JSON-копии хватает.
  function clone(client) {
    return JSON.parse(JSON.stringify(client));
  }

  function clients() {
    return CLIENTS.map(clone);
  }

  function find(id) {
    const found = CLIENTS.filter((client) => client.id === id)[0];
    return found ? clone(found) : null;
  }

  function packageState(pkg) {
    if (!pkg || !pkg.total) return "inactive";
    const notStarted = pkg.used === 0 && pkg.startedDaysAgo === null;
    if (notStarted) return "inactive";
    if (pkg.used >= pkg.total) return "finished";
    if (pkg.total - pkg.used <= ENDING_DAYS) return "ending";
    return "active";
  }

  function packageLabel(pkg) {
    const state = packageState(pkg);
    if (state === "inactive") return "не активирован";
    if (state === "finished") return "завершён";
    if (state === "ending") {
      const left = Math.max(pkg.total - pkg.used, 0);
      return `заканчивается, осталось ${left} ${plural(left, ["день", "дня", "дней"])}`;
    }
    return `активен, ${pkg.used} из ${pkg.total}`;
  }

  function packageTitle(key) {
    return PACKAGE_TITLES[key] || key;
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase().replace(/ё/g, "е");
  }

  function states(client) {
    return PACKAGE_KEYS.map((key) => packageState(client.packages[key]));
  }

  // Клиент попадает в фильтр, если под него подходит хотя бы один пакет:
  // «заканчивается» не прячет клиента со вторым, ещё активным пакетом.
  function match(client, filterKey, query) {
    const filter = filterKey || "all";
    if (filter !== "all" && states(client).indexOf(filter) === -1) return false;
    const text = normalize(query);
    if (!text) return true;
    return normalize(client.name).indexOf(text) !== -1;
  }

  function lastSeenLabel(client) {
    const days = client.lastSeenDaysAgo;
    if (days === 0) return "был(а) сегодня";
    if (days === 1) return "был(а) вчера";
    return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;
  }

  // Прогресс к цели: от старта через текущий вес к целевому. `left` — сколько
  // килограммов осталось, `percent` — какая доля пути пройдена. Цель совпала
  // со стартом — это поддержание: полосы нет, percent = null.
  function weightDelta(client) {
    const from = client.weightStart;
    const to = client.weightNow;
    const target = client.weightTarget;
    const left = Math.round(Math.abs(to - target) * 10) / 10;
    if (target === from) {
      return { from, to, target, left, percent: null, direction: "none" };
    }
    const done = percent(Math.abs(to - from), Math.abs(target - from));
    return {
      from,
      to,
      target,
      left,
      percent: Math.round(done),
      direction: target < from ? "down" : "up",
    };
  }

  // Среднее за неделю против нормы: «в норме» — пока отклонение в пределах
  // допуска, иначе знак и абсолютная разница. Точность до килокалории здесь
  // не обещание, а просто честная разница двух цифр.
  function budgetLabel(client) {
    const diff = client.nutrition.avgKcal - client.nutrition.targetKcal;
    if (Math.abs(diff) <= BUDGET_TOLERANCE) return "в норме";
    return (diff > 0 ? "+" : "\u2212") + Math.abs(diff) + " ккал к норме";
  }

  // Сводка по показанному списку: сколько клиентов и у скольких есть
  // активный (не завершённый и не заканчивающийся) пакет.
  function summary(list) {
    const active = list.filter((client) => states(client).indexOf("active") !== -1).length;
    return { total: list.length, active };
  }

  App.coach = {
    clients,
    find,
    packageState,
    packageLabel,
    packageTitle,
    packageKeys: PACKAGE_KEYS,
    filters: FILTERS,
    match,
    lastSeenLabel,
    weightDelta,
    budgetLabel,
    summary,
  };
})(window.App = window.App || {});
