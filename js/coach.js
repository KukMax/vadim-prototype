/* Кабинет тренера: вымышленные клиенты и правила их пакетов (прототип).
   Фикстуры модуль не переписывает. Правки тренера (целевой вес, заметка и
   объёмы пакетов) лежат в памяти App.state.coachOverrides и накладываются на
   копию фикстуры при чтении; чтение состояния необязательное, чтобы модуль
   работал и сам по себе. Демо-кабинет, анкета, план и калории не затрагиваются. */
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
  // Для сообщений об ошибке: «в пакете тренировок», «объём пакета питания».
  const PACKAGE_GENITIVE = { training: "тренировок", nutrition: "питания" };

  // «Заканчивается» считаем по последней неделе пакета.
  const ENDING_DAYS = 7;
  // Отклонение среднего калорий от нормы в пределах сотни — ещё «в норме».
  const BUDGET_TOLERANCE = 100;

  // Границы редактора карточки: их же показывают подписи полей.
  const WEIGHT_MIN = 30;
  const WEIGHT_MAX = 300;
  const NOTE_MAX = 400;
  const PACKAGE_MAX = { training: 60, nutrition: 180 };

  // Глубокая копия: карточка клиента читает вложенные анкету, тренировки и
  // питание, а ручной список полей уже терял новые данные. Фикстуры состоят
  // только из строк, чисел, null и простых объектов, поэтому JSON-копии хватает.
  function clone(client) {
    return JSON.parse(JSON.stringify(client));
  }

  function overrides(id) {
    const all = App.state && App.state.coachOverrides;
    return (all && all[id]) || null;
  }

  // Правки накладываются на копию фикстуры при каждом чтении: исходные данные
  // не трогаются, а сброс правок возвращает прежние значения сам собой.
  function withOverrides(client) {
    if (!client) return null;
    const copy = clone(client);
    const patch = overrides(client.id);
    if (!patch) return copy;
    if (typeof patch.weightTarget === "number") copy.weightTarget = patch.weightTarget;
    if (typeof patch.note === "string") copy.note = patch.note;
    PACKAGE_KEYS.forEach((key) => {
      const total = patch.packages && patch.packages[key] ? patch.packages[key].total : null;
      if (typeof total === "number") copy.packages[key].total = total;
    });
    return copy;
  }

  function clients() {
    return CLIENTS.map(withOverrides);
  }

  function find(id) {
    const found = CLIENTS.filter((client) => client.id === id)[0];
    return found ? withOverrides(found) : null;
  }

  /* ---------- редактор карточки ---------- */

  // Значение поля как число: в прототипе допускаем запятую вместо точки.
  function decimal(value) {
    return String(value === null || value === undefined ? "" : value).trim().replace(",", ".");
  }

  function weightValue(value) {
    const text = decimal(value);
    if (!text) return NaN;
    const parsed = Number(text);
    return isFinite(parsed) ? parsed : NaN;
  }

  function intValue(value) {
    const text = decimal(value);
    if (!/^\d+$/.test(text)) return NaN;
    return Number(text);
  }

  // Черновик повторяет значения карточки строками — ровно то, что стоит в полях.
  function draft(client) {
    if (!client) return null;
    return {
      targetWeight: String(client.weightTarget),
      note: String(client.note || ""),
      trainingTotal: String(client.packages.training.total),
      nutritionTotal: String(client.packages.nutrition.total),
    };
  }

  function validate(client, draftValue) {
    const data = draftValue || {};
    const errors = {};
    const weight = weightValue(data.targetWeight);
    if (!isFinite(weight) || weight < WEIGHT_MIN || weight > WEIGHT_MAX) {
      errors.targetWeight = `Целевой вес — от ${WEIGHT_MIN} до ${WEIGHT_MAX} кг`;
    }
    const note = String(data.note === null || data.note === undefined ? "" : data.note);
    if (note.length > NOTE_MAX) errors.note = `Заметка — не больше ${NOTE_MAX} символов`;
    PACKAGE_KEYS.forEach((key) => {
      const field = key + "Total";
      const value = intValue(data[field]);
      const used = client && client.packages[key] ? client.packages[key].used : 0;
      const max = PACKAGE_MAX[key];
      if (!isFinite(value) || value < 0 || value > max) {
        errors[field] = `Объём пакета ${PACKAGE_GENITIVE[key]} — целое от 0 до ${max}`;
      } else if (value < used) {
        errors[field] = `В пакете ${PACKAGE_GENITIVE[key]} сейчас израсходовано ${used} — объём не может быть меньше`;
      }
    });
    return { ok: Object.keys(errors).length === 0, errors };
  }

  // Валидный черновик превращается в правку: значение нормализуется, чтобы
  // повторный вход в редактор показывал те же числа, что и после сохранения.
  function apply(id, draftValue) {
    const client = find(id);
    if (!client) return null;
    const data = draftValue || {};
    if (!validate(client, data).ok) return client;
    if (!App.state) return client;
    if (!App.state.coachOverrides) App.state.coachOverrides = {};
    App.state.coachOverrides[id] = {
      weightTarget: Math.round(weightValue(data.targetWeight) * 10) / 10,
      note: String(data.note === null || data.note === undefined ? "" : data.note).trim(),
      packages: {
        training: { total: intValue(data.trainingTotal) },
        nutrition: { total: intValue(data.nutritionTotal) },
      },
    };
    return find(id);
  }

  function hasOverrides(id) {
    const all = App.state && App.state.coachOverrides;
    if (!all) return false;
    if (id) return !!all[id];
    return Object.keys(all).length > 0;
  }

  function reset(id) {
    const all = App.state && App.state.coachOverrides;
    if (all) delete all[id];
  }

  function resetAll() {
    if (App.state) App.state.coachOverrides = {};
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

  // Родительный падеж нужен подписям полей редактора: два поля «Объём пакета»
  // подряд читались бы одинаково, а скринридер их не различит.
  function packageGenitive(key) {
    return PACKAGE_GENITIVE[key] || key;
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
      // Явный выход за цель (например, целью сделали вес больше текущего, но
      // меньше стартового) не должен рисовать полосу длиннее 100 %.
      percent: Math.max(0, Math.min(100, Math.round(done))),
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
    draft,
    validate,
    apply,
    hasOverrides,
    reset,
    resetAll,
    limits: {
      weightMin: WEIGHT_MIN,
      weightMax: WEIGHT_MAX,
      noteMax: NOTE_MAX,
      packageMax: PACKAGE_MAX,
    },
    packageState,
    packageLabel,
    packageTitle,
    packageGenitive,
    packageKeys: PACKAGE_KEYS,
    filters: FILTERS,
    match,
    lastSeenLabel,
    weightDelta,
    budgetLabel,
    summary,
  };
})(window.App = window.App || {});
