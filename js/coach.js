/* Кабинет тренера: вымышленные клиенты и правила их пакетов (прототип).
   Фикстуры модуль не переписывает. Правки тренера (целевой вес, заметка и
   объёмы пакетов) лежат в памяти App.state.coachOverrides и накладываются на
   копию фикстуры при чтении; чтение состояния необязательное, чтобы модуль
   работал и сам по себе. Демо-кабинет, анкета, план и калории не затрагиваются. */
(function (App) {
  "use strict";

  const { addDays, isoDate, formatDateRange, formatShortDate, percent, plural, NOW } = App.util;
  const DATA = App.data;

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
      checkedDishes: ["Овсянка с ягодами", "Омлет с овощами", "Сэндвич с курицей", "Горсть орехов", "Курица с гречкой", "Борщ с говядиной", "Овощной салат", "Паста с курицей", "Куриная грудка с салатом", "Котлеты из индейки", "Кефир перед сном", "Яблоко"],
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
      checkedDishes: ["Овсянка с ягодами", "Омлет с овощами", "Яичница с тостом", "Фрукт к завтраку", "Горсть орехов", "Курица с гречкой", "Рыба с рисом", "Плов с индейкой", "Овощной салат", "Треска с овощами", "Овощное рагу", "Яблоко"],
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
      checkedDishes: ["Овсянка с ягодами", "Гречневая каша с маслом", "Омлет с овощами", "Сэндвич с курицей", "Ложка мёда", "Суп с овощами", "Тефтели с пюре", "Компот", "Кусочек сыра", "Овощной салат"],
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
      checkedDishes: ["Сырники с йогуртом", "Творог с фруктами", "Гречневая каша с маслом", "Стакан кефира", "Курица с гречкой", "Салат с тунцом", "Борщ с говядиной", "Ломтик хлеба", "Творожная запеканка", "Омлет с зеленью", "Кефир перед сном", "Травяной чай"],
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
  const PACKAGE_MAX = { nutrition: 180 };

  // Программа: круги и срок задаёт тренер, объём тренировок считается из них.
  const PROGRAM_ROUNDS_MIN = 1;
  const PROGRAM_ROUNDS_MAX = 10;
  const PROGRAM_ROUNDS_DEFAULT = 3;
  const PROGRAM_DURATION_MIN = 7;
  const PROGRAM_DURATION_MAX = 90;
  const PROGRAM_DURATION_DEFAULT = 30;
  const PROGRAM_DAYS_MAX = 7;

  // Анкета в фикстурах хранит русские подписи, а формула калорий ждёт ключи.
  // Цель карточки («Снизить вес») короче подписей анкеты, поэтому в таблицах
  // обе формы.
  const SEX_KEYS = { "Мужской": "male", "Женский": "female" };
  const ACTIVITY_KEYS = {
    "Сидячая работа, малоподвижный образ жизни": "sedentary",
    "Низкая активность": "sedentary",
    "Средняя активность": "moderate",
    "Высокая активность": "high",
  };
  const GOAL_KEYS = {
    "Похудеть": "lose",
    "Снизить вес": "lose",
    "Поддерживать свою форму": "maintain",
    "Набрать мышечную массу": "gain",
  };

  // Границы полей экрана нормы: те же числа показывают подписи.
  const NORM_KCAL_MIN = 800;
  const NORM_KCAL_MAX = 5000;
  const NORM_PROTEIN_MIN = 40;
  const NORM_PROTEIN_MAX = 400;
  const NORM_FAT_MIN = 20;
  const NORM_FAT_MAX = 250;
  const NORM_CARBS_MIN = 50;
  const NORM_CARBS_MAX = 800;
  const NORM_WATER_MIN = 4;
  const NORM_WATER_MAX = 20;
  const NORM_DURATION_MIN = 7;
  const NORM_DURATION_MAX = 180;

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

  // Активация пакетов хранится отдельно от правок карточки: форма сохраняет
  // coachOverrides[id] целиком, а пакеты переключаются кнопкой.
  function packagePatches() {
    if (!App.state.coachPackages) App.state.coachPackages = {};
    return App.state.coachPackages;
  }

  function packagePatch(clientId, key) {
    const all = packagePatches()[clientId];
    return (all && all[key]) || null;
  }

  // Пакет для экрана: фикстура плюс активация, если она есть.
  function packageView(client, key) {
    const base = client && client.packages ? client.packages[key] : null;
    if (!base) return null;
    const patch = packagePatch(client.id, key);
    if (!patch) return base;
    return { used: patch.used, total: base.total, startedDaysAgo: patch.startedDaysAgo };
  }

  function packageActive(client, key) {
    const pkg = packageView(client, key);
    return pkg ? packageState(pkg) !== "inactive" : false;
  }

  // Показатели пакета как в фикстуре: нужны, чтобы возврат кнопкой не терял
  // прогресс, накопленный до выключения.
  function fixturePackage(clientId, key) {
    const clients = CLIENTS.filter((item) => item.id === clientId);
    const client = clients[0];
    const packs = client && client.packages ? client.packages : null;
    return packs ? packs[key] || null : null;
  }

  // Выключение обнуляет пакет, включение возвращает его к состоянию фикстуры:
  // у Алексея тренировки снова 7 из 12, а не 0 из 12. Пакет, который в фикстуре
  // не активирован (у Ольги), стартует сегодня с нуля.
  function togglePackage(clientId, key) {
    const client = find(clientId);
    if (!client) return null;
    const base = fixturePackage(clientId, key);
    if (!base || !base.total) return null;
    const active = packageActive(client, key);
    const started = base.startedDaysAgo === null || base.startedDaysAgo === undefined ? null : base.startedDaysAgo;
    const next = active
      ? { startedDaysAgo: null, used: 0 }
      : { startedDaysAgo: started === null ? 0 : started, used: base.used };
    const all = packagePatches();
    if (started === next.startedDaysAgo && base.used === next.used) {
      // Данные вернулись к фикстуре — правку убираем, чтобы «правки» в карточке
      // не горели зря.
      const entry = all[clientId];
      if (entry) {
        delete entry[key];
        if (Object.keys(entry).length === 0) delete all[clientId];
      }
    } else {
      const entry = all[clientId] || (all[clientId] = {});
      entry[key] = next;
    }
    return { client: client, key: key, active: !active };
  }

  // Правки накладываются на копию фикстуры при каждом чтении: исходные данные
  // не трогаются, а сброс правок возвращает прежние значения сам собой.
  function withOverrides(client) {
    if (!client) return null;
    const copy = clone(client);
    const patch = overrides(client.id);
    if (patch) {
      if (typeof patch.weightTarget === "number") copy.weightTarget = patch.weightTarget;
      if (typeof patch.note === "string") copy.note = patch.note;
      const nutrition = patch.packages && patch.packages.nutrition ? patch.packages.nutrition.total : null;
      if (typeof nutrition === "number") copy.packages.nutrition.total = nutrition;
    }
    // Активация пакетов живёт в отдельной карте и переносится на копию поверх
    // правок: правка формы не должна её затирать.
    const packs = (App.state.coachPackages && App.state.coachPackages[client.id]) || null;
    if (packs) {
      Object.keys(packs).forEach((key) => {
        const target = copy.packages[key];
        if (!target) return;
        target.startedDaysAgo = packs[key].startedDaysAgo;
        target.used = packs[key].used;
      });
    }
    // Объём тренировок руками не вводится: единственный источник — программа
    // (дни × круги), поэтому пакет получает цифру здесь, при чтении.
    const totals = programTotals(program(client.id));
    copy.packages.training.total = totals.workouts;
    // Срок пакета тоже выводится из программы, а не вводится в карточке.
    copy.packages.training.durationDays = totals.durationDays;
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
  // Объёма тренировок здесь нет: его считает программа.
  function draft(client) {
    if (!client) return null;
    return {
      targetWeight: String(client.weightTarget),
      note: String(client.note || ""),
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
    // Объём тренировок не проверяется: он выводится из программы и меняется
    // в редакторе программы, а не в карточке.
    const nutrition = intValue(data.nutritionTotal);
    const nutritionUsed = client && client.packages.nutrition ? client.packages.nutrition.used : 0;
    if (!isFinite(nutrition) || nutrition < 0 || nutrition > PACKAGE_MAX.nutrition) {
      errors.nutritionTotal = `Объём пакета ${PACKAGE_GENITIVE.nutrition} — целое от 0 до ${PACKAGE_MAX.nutrition}`;
    } else if (nutrition < nutritionUsed) {
      errors.nutritionTotal = `В пакете ${PACKAGE_GENITIVE.nutrition} сейчас израсходовано ${nutritionUsed} — объём не может быть меньше`;
    }
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
        nutrition: { total: intValue(data.nutritionTotal) },
      },
    };
    return find(id);
  }

  function hasOverrides(id) {
    const all = App.state && App.state.coachOverrides;
    const packs = App.state && App.state.coachPackages ? App.state.coachPackages : null;
    if (id) {
      const mine = packs && packs[id];
      return !!((all && all[id]) || (mine && Object.keys(mine).length > 0));
    }
    return !!((all && Object.keys(all).length > 0) || (packs && Object.keys(packs).length > 0));
  }

  function reset(id) {
    const all = App.state && App.state.coachOverrides;
    if (all) delete all[id];
    delete packagePatches()[id];
  }

  function resetAll() {
    if (App.state) {
      App.state.coachOverrides = {};
      App.state.coachPackages = {};
    }
  }

  /* ---------- норма питания клиента (КБЖУ) ---------- */

  // Сохранённые нормы: запись по id клиента, только в памяти. Чтение
  // необязательное — модуль работает и без состояния.
  function norms() {
    const all = App.state && App.state.coachNorms;
    return all || {};
  }

  // Вход формулы из фикстуры: пол, возраст, рост и вес — из карточки,
  // активность и цель — из анкеты, цель карточки важнее.
  function nutritionInput(client) {
    const questionnaire = client.questionnaire || {};
    return {
      sex: SEX_KEYS[questionnaire.sex] || "male",
      age: client.age,
      height: client.height,
      weight: client.weightNow || client.weight,
      activity: ACTIVITY_KEYS[questionnaire.activity] || "moderate",
      goal: GOAL_KEYS[client.goal] || GOAL_KEYS[questionnaire.goal] || "maintain",
    };
  }

  // Действующая норма: сохранённая правка тренера или расчёт по формуле.
  // Калорийность — главный параметр, граммы и доли выводятся из неё.
  function nutritionNorm(client) {
    const input = nutritionInput(client);
    const plan = App.calories.planFor(input);
    const saved = norms()[client.id] || null;
    const base = {
      input,
      bmr: Math.round(App.calories.bmr(input)),
      tdee: Math.round(App.calories.tdee(input)),
      adjustPercent: App.calories.adjustPercent(input),
      formulaKcal: plan.kcal,
      saved: !!saved,
    };
    if (!saved) {
      return Object.assign(base, {
        kcal: plan.kcal,
        protein: plan.grams.protein,
        fat: plan.grams.fat,
        carbs: plan.grams.carbs,
        percents: plan.percents,
        perKg: plan.perKg,
        macroKcal: plan.macroKcal,
        water: DATA.targets.water,
        durationDays: client.packages.nutrition.total,
        source: "formula",
      });
    }
    const set = App.calories.compose(saved, input.weight);
    return Object.assign(base, {
      kcal: saved.kcal,
      protein: set.grams.protein,
      fat: set.grams.fat,
      carbs: set.grams.carbs,
      percents: set.percents,
      perKg: set.perKg,
      macroKcal: set.macroKcal,
      water: saved.water,
      durationDays: saved.durationDays,
      source: "coach",
    });
  }

  // Черновик формы: все значения строками, как в карточке клиента.
  function normDraft(clientId) {
    const client = find(clientId);
    if (!client) return null;
    const norm = nutritionNorm(client);
    return {
      kcal: String(norm.kcal),
      protein: String(norm.protein),
      fat: String(norm.fat),
      carbs: String(norm.carbs),
      percentProtein: String(norm.percents.protein),
      percentFat: String(norm.percents.fat),
      percentCarbs: String(norm.percents.carbs),
      water: String(norm.water),
      durationDays: String(norm.durationDays),
    };
  }

  function normValue(value) {
    const number = Number(String(value === undefined || value === null ? "" : value).replace(",", "."));
    return isFinite(number) ? number : NaN;
  }

  // Связанная правка трёх уровней — правило одно и проговаривается в
  // подсказке: меняете калорийность — граммы считаются из процентов;
  // меняете граммы или проценты — калорийность пересчитывается по 4/9/4.
  function recalcNorm(draftValue, field) {
    const next = {};
    Object.keys(draftValue).forEach((key) => { next[key] = draftValue[key]; });
    const grams = {
      protein: Math.max(0, Math.round(normValue(draftValue.protein) || 0)),
      fat: Math.max(0, Math.round(normValue(draftValue.fat) || 0)),
      carbs: Math.max(0, Math.round(normValue(draftValue.carbs) || 0)),
    };
    const kcal = Math.max(0, Math.round(normValue(draftValue.kcal) || 0));
    if (field === "kcal") {
      const percents = {
        protein: normValue(draftValue.percentProtein) || 0,
        fat: normValue(draftValue.percentFat) || 0,
        carbs: normValue(draftValue.percentCarbs) || 0,
      };
      if (percents.protein + percents.fat + percents.carbs > 0) {
        Object.assign(grams, App.calories.gramsFromPercents(kcal, percents));
      }
    } else if (field.indexOf("percent") === 0) {
      const macro = field.slice("percent".length).toLowerCase();
      const divisor = macro === "fat" ? 9 : 4;
      const basis = kcal || 4 * grams.protein + 9 * grams.fat + 4 * grams.carbs;
      grams[macro] = Math.max(0, Math.round((basis * (normValue(draftValue[field]) || 0)) / 100 / divisor));
    }
    const set = App.calories.compose(grams);
    next.kcal = field === "kcal" && kcal > 0 ? String(kcal) : String(set.macroKcal);
    next.protein = String(set.grams.protein);
    next.fat = String(set.grams.fat);
    next.carbs = String(set.grams.carbs);
    next.percentProtein = String(set.percents.protein);
    next.percentFat = String(set.percents.fat);
    next.percentCarbs = String(set.percents.carbs);
    return next;
  }

  // Производные числа для подписей: граммы на кг, сумма БЖУ и расхождение
  // с калорийностью. Ничего не сохраняет.
  function normDerived(draftValue, client) {
    const grams = {
      protein: Math.max(0, Math.round(normValue(draftValue.protein) || 0)),
      fat: Math.max(0, Math.round(normValue(draftValue.fat) || 0)),
      carbs: Math.max(0, Math.round(normValue(draftValue.carbs) || 0)),
    };
    const set = App.calories.compose(grams, client ? (client.weightNow || client.weight) : 0);
    const kcal = Math.max(0, Math.round(normValue(draftValue.kcal) || 0));
    return Object.assign(set, { kcal, diff: kcal - set.macroKcal });
  }

  function validateNorm(client, draftValue) {
    const errors = {};
    const kcal = normValue(draftValue.kcal);
    if (!isFinite(kcal) || kcal < NORM_KCAL_MIN || kcal > NORM_KCAL_MAX) {
      errors.kcal = `Калорийность — от ${NORM_KCAL_MIN} до ${NORM_KCAL_MAX} ккал`;
    }
    const check = (key, label, min, max) => {
      const value = normValue(draftValue[key]);
      if (!isFinite(value) || value < min || value > max) errors[key] = `${label} — от ${min} до ${max} г`;
    };
    check("protein", "Белки", NORM_PROTEIN_MIN, NORM_PROTEIN_MAX);
    check("fat", "Жиры", NORM_FAT_MIN, NORM_FAT_MAX);
    check("carbs", "Углеводы", NORM_CARBS_MIN, NORM_CARBS_MAX);
    const water = normValue(draftValue.water);
    if (!isFinite(water) || water < NORM_WATER_MIN || water > NORM_WATER_MAX) {
      errors.water = `Вода — от ${NORM_WATER_MIN} до ${NORM_WATER_MAX} стаканов`;
    }
    const duration = normValue(draftValue.durationDays);
    const used = client && client.packages ? client.packages.nutrition.used : 0;
    if (!isFinite(duration) || duration < NORM_DURATION_MIN || duration > NORM_DURATION_MAX) {
      errors.durationDays = `Срок — от ${NORM_DURATION_MIN} до ${NORM_DURATION_MAX} дней`;
    } else if (duration < used) {
      errors.durationDays = `Пройдено ${used} ${plural(used, ["день", "дня", "дней"])} — срок не может быть меньше`;
    }
    return { ok: Object.keys(errors).length === 0, errors };
  }

  // Сохраняем только цифры нормы: анкета, вес и пакеты остаются фикстурой.
  function applyNorm(clientId, draftValue) {
    const client = find(clientId);
    if (!client) return null;
    const record = {
      kcal: Math.round(normValue(draftValue.kcal)),
      protein: Math.round(normValue(draftValue.protein)),
      fat: Math.round(normValue(draftValue.fat)),
      carbs: Math.round(normValue(draftValue.carbs)),
      water: Math.round(normValue(draftValue.water)),
      durationDays: Math.round(normValue(draftValue.durationDays)),
    };
    if (!App.state) return record;
    if (!App.state.coachNorms) App.state.coachNorms = {};
    App.state.coachNorms[clientId] = record;
    return record;
  }

  function resetNorm(clientId) {
    if (App.state && App.state.coachNorms) delete App.state.coachNorms[clientId];
  }

  function hasNorm(clientId) {
    return !!norms()[clientId];
  }

  function sameNormDraft(a, b) {
    if (!a || !b) return false;
    return Object.keys(a).every((key) => String(a[key]).trim() === String(b[key]).trim());
  }

  /* ---------- дни питания клиента ---------- */

  const DISH_MODE_CHECKED = "checked";
  const DISH_MODE_ALL = "all";
  const DISH_MODE_LABELS = { checked: "Только отмеченное", all: "Все блюда" };
  const FOOD_DAY_MAX_DISHES = 12;

  // Отмеченные блюда клиента. У фикстуры это готовый список; если клиент
  // проходил настоящую анкету, отметки лежат в STATE.questionnaire.dishesOff
  // — их формат другой, поэтому в кабинете используем фикстуру.
  function checkedDishes(client) {
    const list = client && Array.isArray(client.checkedDishes) ? client.checkedDishes : [];
    return list.slice();
  }

  function dishKnown(name) {
    return (DATA.dishCatalog || []).some((item) => item.name === name);
  }

  // Каталог для экрана: группы берём из анкеты (порядок и подписи), блюда —
  // из DATA.dishCatalog. В режиме «только отмеченное» пустые группы скрываются.
  function dishGroups(client, mode) {
    const showAll = mode === DISH_MODE_ALL;
    const on = checkedDishes(client);
    return (DATA.questionnaire.dishes || [])
      .map((group) => {
        const items = (DATA.dishCatalog || [])
          .filter((item) => item.group === group.key)
          .map((item) => ({
            name: item.name,
            group: item.group,
            g: item.g,
            k: item.k,
            p: item.p,
            f: item.f,
            c: item.c,
            checked: on.indexOf(item.name) !== -1,
          }))
          .filter((item) => showAll || item.checked);
        return { key: group.key, title: group.title, required: !!group.required, items };
      })
      .filter((group) => group.items.length > 0);
  }

  function dishSearchSource() { return DATA.dishCatalog || []; }

  // Сумма выбранного дня: блюда должны существовать в каталоге, чужие имена
  // молча отбрасываем — фикстура и каталог правятся независимо.
  // Калорийность итога считаем один раз из суммы БЖУ (4/9/4), иначе округление
  // каждого блюда накапливалось бы в «Расхождении» с нормой.
  function dishTotals(names) {
    const list = (names || [])
      .map((name) => dishSearchSource().filter((item) => item.name === name)[0])
      .filter(Boolean);
    const sum = list.reduce((acc, item) => {
      acc.protein += item.p;
      acc.fat += item.f;
      acc.carbs += item.c;
      return acc;
    }, { protein: 0, fat: 0, carbs: 0 });
    return {
      count: list.length,
      kcal: Math.round(sum.protein * 4 + sum.fat * 9 + sum.carbs * 4),
      protein: Math.round(sum.protein),
      fat: Math.round(sum.fat),
      carbs: Math.round(sum.carbs),
      dishes: list,
    };
  }

  function foodDay(clientId, dayNo) {
    const days = App.state && App.state.coachFoodDays ? App.state.coachFoodDays[clientId] : null;
    const saved = days && days[dayNo] ? days[dayNo] : null;
    return { dishes: saved && Array.isArray(saved.dishes) ? saved.dishes.filter(dishKnown) : [] };
  }

  function hasFoodDay(clientId, dayNo) {
    return foodDay(clientId, dayNo).dishes.length > 0;
  }

  // Черновик дня — всегда копия: сохранённый день не меняется до «Сохранить».
  function foodDayDraft(clientId, dayNo) {
    const day = foodDay(clientId, dayNo);
    return { dayNo: dayNo, dishes: day.dishes.slice() };
  }

  // Список дней пакета: номер, заполнен ли, калорийность и отклонение от нормы.
  function foodDays(clientId) {
    const client = find(clientId);
    if (!client) return [];
    const total = Math.max(1, Math.min(client.packages.nutrition.total, 180));
    const norm = nutritionNorm(client).kcal;
    const list = [];
    for (let index = 0; index < total; index += 1) {
      const totals = dishTotals(foodDay(clientId, index).dishes);
      list.push({
        dayNo: index,
        filled: totals.count > 0,
        count: totals.count,
        kcal: totals.kcal,
        delta: totals.kcal - norm,
      });
    }
    return list;
  }

  function foodDayCount(clientId) {
    return foodDays(clientId).filter((day) => day.filled).length;
  }

  function validateFoodDay(draft) {
    const errors = {};
    const names = (draft && draft.dishes) || [];
    const known = names.filter(dishKnown);
    if (known.length === 0) errors.dishes = "Добавьте хотя бы одно блюдо";
    else if (known.length > FOOD_DAY_MAX_DISHES) errors.dishes = "В дне не больше " + FOOD_DAY_MAX_DISHES + " блюд";
    return { ok: Object.keys(errors).length === 0, errors };
  }

  function applyFoodDay(clientId, dayNo, draft) {
    const known = ((draft && draft.dishes) || []).filter(dishKnown);
    if (!App.state) return null;
    if (known.length === 0) {
      if (App.state.coachFoodDays[clientId]) delete App.state.coachFoodDays[clientId][dayNo];
      return null;
    }
    App.state.coachFoodDays[clientId] = App.state.coachFoodDays[clientId] || {};
    App.state.coachFoodDays[clientId][dayNo] = { dishes: known.slice() };
    return App.state.coachFoodDays[clientId][dayNo];
  }

  function resetFoodDay(clientId, dayNo) {
    if (App.state && App.state.coachFoodDays[clientId]) delete App.state.coachFoodDays[clientId][dayNo];
  }

  function sameFoodDraft(a, b) {
    if (!a || !b) return false;
    return JSON.stringify((a.dishes || []).slice().sort()) === JSON.stringify((b.dishes || []).slice().sort());
  }

  /* ---------- программа клиента ---------- */

  // Программа собирается из тех же шаблонов, что видит клиент: один день на
  // шаблон. В программу входит только основная часть — разминка, заминка и
  // кардио остаются в шаблоне клиента. Исходные шаблоны не переписываются:
  // правки тренера лежат в памяти App.state.coachPrograms.
  const DAY_TITLE_MAX = 40;
  const DAY_SETS_MIN = 1;
  const DAY_SETS_MAX = 12;
  const DAY_REPS_MIN = 1;
  const DAY_REPS_MAX = 50;
  const DAY_WEIGHT_MAX = 300;
  const DAY_REST_MAX = 300;
  const DAY_TEMPO_MAX = 20;
  const DAY_EXERCISES_MAX = 15;

  const restSeconds = (value) => {
    const match = /^(\d+)/.exec(String(value == null ? "" : value).trim());
    return match ? Number(match[1]) : 0;
  };

  function exerciseFromTemplate(item) {
    const base = App.exercises && App.exercises.byName ? App.exercises.byName(item.name) : null;
    return {
      exerciseId: base ? base.id : "",
      name: item.name,
      group: base ? base.group : "",
      equipment: base ? base.equipment : "",
      unit: item.unit || (base ? base.unit : ""),
      sets: (item.sets || []).map((set) => ({ reps: set.reps, weight: set.weight === undefined ? null : set.weight })),
      tempo: item.tempo || "",
      rest: restSeconds(item.rest),
      note: item.note || "",
    };
  }

  function dayFromTemplate(template) {
    const main = (template.blocks || []).filter((block) => block.type === "main")[0];
    return {
      dayId: template.key,
      title: template.title,
      minutes: template.minutes,
      muscles: (template.muscles || []).slice(),
      exercises: main && main.items ? main.items.map(exerciseFromTemplate) : [],
    };
  }

  // Программа уровня клиента: круги и срок задаёт тренер, а объём тренировок
  // считается из них — 4 дня × 3 круга = 12 тренировок, как в пакете.
  function baseProgram() {
    return {
      rounds: PROGRAM_ROUNDS_DEFAULT,
      durationDays: PROGRAM_DURATION_DEFAULT,
      days: DATA.cycleTemplates.map(dayFromTemplate),
    };
  }

  function stored(id) {
    const all = App.state && App.state.coachPrograms;
    return (all && all[id]) || null;
  }

  // Копия программы: чтение не даёт править сохранённые дни по ссылке.
  function program(id) {
    const value = clone(stored(id) || baseProgram());
    if (typeof value.rounds !== "number") value.rounds = PROGRAM_ROUNDS_DEFAULT;
    if (typeof value.durationDays !== "number") value.durationDays = PROGRAM_DURATION_DEFAULT;
    return value;
  }

  function programDay(id, dayId) {
    const day = program(id).days.filter((item) => item.dayId === dayId)[0];
    return day || null;
  }

  // Короткое имя для вызовов из вьюхи: App.coach.day(clientId, dayId).
  const day = programDay;

  // Сводка по дню: количество упражнений, подходов и минут.
  function daySummary(value) {
    const exercises = (value && value.exercises) || [];
    return {
      exercises: exercises.length,
      minutes: (value && value.minutes) || 0,
      sets: exercises.reduce((sum, item) => sum + ((item.sets && item.sets.length) || 0), 0),
    };
  }

  // Сводка по программе: объём пакета тренировок — это дни × круги, поэтому
  // цифру «12 тренировок» нигде не приходится вводить и дублировать руками.
  function programTotals(value) {
    const data = value || {};
    const days = data.days || [];
    // Черновик хранит круги и срок строками полей: считаем как при валидации.
    const rounds = programNumber(data.rounds, PROGRAM_ROUNDS_DEFAULT);
    const totals = {
      days: days.length,
      rounds,
      workouts: days.length * rounds,
      sets: 0,
      exercises: 0,
      minutes: 0,
      durationDays: programNumber(data.durationDays, PROGRAM_DURATION_DEFAULT),
    };
    days.forEach((item) => {
      const summary = daySummary(item);
      totals.sets += summary.sets;
      totals.exercises += summary.exercises;
      totals.minutes += summary.minutes;
    });
    return totals;
  }

  // Строка объёма для интерфейса: «4 дня × 3 круга = 12 тренировок · 30 дней».
  // Формат общий для вьюхи и живого пересчёта черновика в js/app.js.
  function programLine(value) {
    const totals = value && typeof value.workouts === "number" ? value : programTotals(value);
    const word = (count, forms) => count + " " + plural(count, forms);
    return (
      word(totals.days, ["день", "дня", "дней"]) +
      " × " +
      word(totals.rounds, ["круг", "круга", "кругов"]) +
      " = " +
      word(totals.workouts, ["тренировка", "тренировки", "тренировок"]) +
      " · " +
      word(totals.durationDays, ["день", "дня", "дней"])
    );
  }

  // Подзаголовок экрана программы: дни · круги · тренировки · срок. Разделители
  // отличаются от programLine: там объём читается как формула «× … =».
  function programSummary(value) {
    const totals = value && typeof value.workouts === "number" ? value : programTotals(value);
    const word = (count, forms) => count + " " + plural(count, forms);
    return (
      word(totals.days, ["день", "дня", "дней"]) +
      " · " +
      word(totals.rounds, ["круг", "круга", "кругов"]) +
      " · " +
      word(totals.workouts, ["тренировка", "тренировки", "тренировок"]) +
      " · " +
      word(totals.durationDays, ["день", "дня", "дней"])
    );
  }

  // --- 11L. Объём пакета: тоннаж и КПШ ---
  // Один подход может иметь свой вес (пирамида 14×20, 12×22, 10×24, 8×26),
  // поэтому тоннаж считаем по подходам, а не по одному весу на упражнение.
  // Свой вес (weight === null) в тоннаж не входит, но повторы в КПШ входят.
  // Упражнения на время (unit === "sec", например планка 40 секунд) в КПШ и
  // тоннаж не идут: «40 повторов» планки — это секунды, а не повторы.
  function exerciseVolume(item) {
    const sets = Array.isArray(item.sets) ? item.sets : [];
    if (item.unit === "sec") return { reps: 0, tonnage: 0, timed: sets.length };
    let reps = 0;
    let tonnage = 0;
    sets.forEach((set) => {
      const count = Number(set.reps) || 0;
      reps += count;
      if (set.weight !== null && set.weight !== undefined) {
        tonnage += count * (Number(set.weight) || 0);
      }
    });
    return { reps, tonnage, timed: 0 };
  }

  function addVolume(a, b) {
    return {
      reps: a.reps + b.reps,
      tonnage: a.tonnage + b.tonnage,
      timed: a.timed + b.timed,
    };
  }

  // Название строки упражнения: в программе оно уже есть, но старые фикстуры
  // могут хранить только exerciseId — тогда спрашиваем справочник.
  function exerciseTitle(item, index) {
    if (item && item.name) return String(item.name);
    const id = item && item.exerciseId;
    const found = id && App.exercises && App.exercises.find ? App.exercises.find(id) : null;
    return found ? found.name : "Упражнение " + (index + 1);
  }

  // Кроме суммы за день отдаём объём по каждому упражнению: КПШ и тоннаж
  // считаются по упражнению, а не по группе мышц.
  function dayVolume(day) {
    const exercises = day && Array.isArray(day.exercises) ? day.exercises : [];
    let total = { reps: 0, tonnage: 0, timed: 0 };
    let sets = 0;
    const items = exercises.map((item, index) => {
      const volume = exerciseVolume(item);
      const count = Array.isArray(item.sets) ? item.sets.length : 0;
      sets += count;
      total = addVolume(total, volume);
      return {
        name: exerciseTitle(item, index),
        sets: count,
        reps: volume.reps,
        tonnage: volume.tonnage,
        timed: volume.timed > 0,
      };
    });
    return {
      exercises: exercises.length,
      sets,
      reps: total.reps,
      tonnage: total.tonnage,
      timed: total.timed,
      items,
    };
  }

  // Круг — один проход по дням программы. Дни возвращаем по порядку, чтобы
  // таблица на экране совпадала с программой.
  function roundVolume(program) {
    const source = program && Array.isArray(program.days) ? program.days : [];
    const days = source.map((day) => {
      const volume = dayVolume(day);
      return {
        dayId: day.dayId,
        title: day.title,
        items: volume.items,
        exercises: volume.exercises,
        sets: volume.sets,
        reps: volume.reps,
        tonnage: volume.tonnage,
        timed: volume.timed,
      };
    });
    let totals = { reps: 0, tonnage: 0, timed: 0 };
    days.forEach((day) => {
      totals = addVolume(totals, day);
    });
    return { rounds: program && program.rounds ? program.rounds : 1, days, totals };
  }

  // Пакет — это N кругов одной программы: дни показываем один раз, а объём
  // круга умножаем на число кругов.
  function packageVolume(program) {
    const round = roundVolume(program);
    const rounds = Math.max(1, round.rounds || 1);
    return {
      rounds,
      days: round.days,
      round: round.totals,
      month: {
        reps: round.totals.reps * rounds,
        tonnage: round.totals.tonnage * rounds,
        timed: round.totals.timed * rounds,
      },
    };
  }

  // Дата активации пакета: в фикстуре только «сколько дней назад», поэтому
  // считаем от App.util.NOW и не трогаем системные часы.
  function startedOn(pkg) {
    if (!pkg || pkg.startedDaysAgo === null || pkg.startedDaysAgo === undefined) return "";
    return isoDate(addDays(NOW, -pkg.startedDaysAgo));
  }

  function packageDates(pkg) {
    const from = startedOn(pkg);
    if (!from) return null;
    const to = isoDate(NOW);
    return { from, to, label: formatDateRange(from, to) };
  }

  function trainingArchive(client) {
    const pkg = client.packages.training;
    const volume = packageVolume(program(client.id));
    return {
      state: packageState(pkg),
      used: pkg.used,
      total: pkg.total,
      dates: packageDates(pkg),
      rounds: volume.rounds,
      days: volume.days,
      round: volume.round,
      month: volume.month,
    };
  }

  // Факт по дням питания: в фикстуре есть только среднее за неделю, поэтому
  // раскладываем его по дням фиксированными множителями. Их сумма ровно 7.00 —
  // среднее за неделю остаётся тем же, а дни не выглядят одинаковыми.
  // Округление до 10 ккал: точность до килокалории здесь ничего не значит.
  // Граммы БЖУ по дням не выдумываем — их в фикстуре нет.
  const DAY_FACTORS = [1.04, 0.97, 1.01, 0.94, 1.06, 0.99, 0.99];
  const DAY_WATER = [0, 1, -1, 0, 1, 0, -1];

  function nutritionArchive(client) {
    const pkg = client.packages.nutrition;
    const norm = nutritionNorm(client);
    const nutrition = client.nutrition;
    const used = Math.max(0, Math.min(pkg.used, pkg.total));
    const start = startedOn(pkg);
    const days = [];
    const weeks = [];
    if (start) {
      for (let index = 0; index < used; index += 1) {
        const factor = DAY_FACTORS[index % DAY_FACTORS.length];
        const dateIso = isoDate(addDays(NOW, index - pkg.startedDaysAgo));
        const day = {
          no: index + 1,
          dateIso,
          label: formatShortDate(dateIso),
          normKcal: norm.kcal,
          factKcal: Math.round((nutrition.avgKcal * factor) / 10) * 10,
          water: Math.max(0, nutrition.avgWater + DAY_WATER[index % DAY_WATER.length]),
        };
        days.push(day);
        const weekNo = Math.floor(index / 7) + 1;
        let week = weeks[weekNo - 1];
        if (!week) {
          week = { no: weekNo, days: [], normKcal: 0, factKcal: 0, label: "" };
          weeks.push(week);
        }
        week.days.push(day);
        week.normKcal += day.normKcal;
        week.factKcal += day.factKcal;
        week.label = formatDateRange(week.days[0].dateIso, day.dateIso);
      }
    }
    return {
      state: packageState(pkg),
      used,
      total: pkg.total,
      dates: packageDates(pkg),
      norm,
      avgKcal: nutrition.avgKcal,
      diff: nutrition.avgKcal - norm.kcal,
      avgWater: nutrition.avgWater,
      targetWater: nutrition.targetWater,
      days,
      weeks,
    };
  }

  function archive(clientId) {
    const client = find(clientId);
    if (!client) return null;
    return {
      client,
      training: trainingArchive(client),
      nutrition: nutritionArchive(client),
    };
  }

  function hasProgram(id) {
    return !!stored(id);
  }

  // Черновик редактора дня: числа становятся строками полей, подходы сжимаются
  // до первого: подходам одного упражнения тренер задаёт общие повторы и вес.
  function dayDraft(day) {
    if (!day) return null;
    return {
      dayId: day.dayId,
      title: String(day.title || ""),
      minutes: day.minutes,
      muscles: (day.muscles || []).slice(),
      exercises: (day.exercises || []).map((item) => {
        const sets = item.sets && item.sets.length ? item.sets : [{ reps: 12, weight: null }];
        const first = sets[0];
        return {
          exerciseId: item.exerciseId || "",
          name: item.name,
          group: item.group || "",
          equipment: item.equipment || "",
          unit: item.unit || "",
          sets: String(sets.length),
          reps: String(first.reps),
          weight: first.weight === null || first.weight === undefined ? "" : String(first.weight),
          tempo: item.tempo || "",
          rest: item.rest === null || item.rest === undefined ? "" : String(item.rest),
          note: item.note || "",
        };
      }),
    };
  }

  function dayInt(value, min, max) {
    const text = decimal(value);
    if (!/^\d+$/.test(text)) return null;
    const parsed = Number(text);
    return parsed >= min && parsed <= max ? parsed : null;
  }

  // Число для сводки программы: пустое или нечисловое поле показывает исходное
  // значение, чтобы живой пересчёт не выдавал «NaN тренировок».
  function programNumber(value, fallback) {
    const parsed = dayInt(value, 0, Number.MAX_SAFE_INTEGER);
    return parsed === null ? fallback : parsed;
  }

  // Ошибки привязаны к полям формы: "title" или "<field>-<index>".
  function validateDay(draftValue) {
    const data = draftValue || {};
    const errors = {};
    const title = String(data.title === null || data.title === undefined ? "" : data.title).trim();
    if (!title || title.length > DAY_TITLE_MAX) {
      errors.title = `Название — от 1 до ${DAY_TITLE_MAX} символов`;
    }
    const exercises = data.exercises || [];
    if (!exercises.length) errors.exercises = "Добавьте хотя бы одно упражнение";
    else if (exercises.length > DAY_EXERCISES_MAX) {
      errors.exercises = `В одном дне не больше ${DAY_EXERCISES_MAX} упражнений`;
    }
    exercises.forEach((item, index) => {
      const sets = dayInt(item.sets, DAY_SETS_MIN, DAY_SETS_MAX);
      if (sets === null) errors["sets-" + index] = `Подходы — целое от ${DAY_SETS_MIN} до ${DAY_SETS_MAX}`;
      const reps = dayInt(item.reps, DAY_REPS_MIN, DAY_REPS_MAX);
      if (reps === null) errors["reps-" + index] = `Повторы — целое от ${DAY_REPS_MIN} до ${DAY_REPS_MAX}`;
      const weightText = decimal(item.weight);
      if (weightText) {
        const weight = weightValue(weightText);
        if (!isFinite(weight) || weight < 0 || weight > DAY_WEIGHT_MAX) {
          errors["weight-" + index] = `Вес — от 0 до ${DAY_WEIGHT_MAX} кг или пустое поле`;
        }
      }
      const tempo = String(item.tempo === null || item.tempo === undefined ? "" : item.tempo).trim();
      if (tempo && (!/^\d+-\d+-\d+-\d+$/.test(tempo) || tempo.length > DAY_TEMPO_MAX)) {
        errors["tempo-" + index] = "Темп — четыре числа через дефис, например 2-0-1-0, или пусто";
      }
      const rest = dayInt(item.rest, 0, DAY_REST_MAX);
      if (rest === null) errors["rest-" + index] = `Отдых — целое от 0 до ${DAY_REST_MAX} сек`;
    });
    return { ok: Object.keys(errors).length === 0, errors };
  }

  // Валидный черновик превращается в день программы: повторы и вес из полей
  // повторяются во всех подходах упражнения.
  function dayFromDraft(draftValue, baseDay) {
    const data = draftValue || {};
    const base = baseDay || {};
    return {
      dayId: base.dayId || data.dayId || "",
      title: String(data.title || "").trim(),
      minutes: base.minutes || data.minutes || 0,
      muscles: (base.muscles || data.muscles || []).slice(),
      exercises: (data.exercises || []).map((item) => {
        const count = Number(decimal(item.sets));
        const reps = Number(decimal(item.reps));
        const weightText = decimal(item.weight);
        const weight = weightText ? weightValue(weightText) : null;
        const sets = [];
        for (let n = 0; n < count; n += 1) sets.push({ reps, weight });
        return {
          exerciseId: item.exerciseId || "",
          name: item.name,
          group: item.group || "",
          equipment: item.equipment || "",
          unit: item.unit || "",
          sets,
          tempo: String(item.tempo || "").trim(),
          rest: Number(decimal(item.rest)),
          note: item.note || "",
        };
      }),
    };
  }

  // Сохранение дня: черновик редактора нормализуется и кладётся поверх копии
  // программы клиента. Возвращает итоговый день (или null без базового дня).
  function applyDay(id, dayId, draftValue) {
    if (!App.state || !dayId) return null;
    const base = programDay(id, dayId);
    if (!base) return null;
    const day = dayFromDraft(draftValue, base);
    const current = program(id);
    const index = current.days.map((item) => item.dayId).indexOf(day.dayId);
    if (index !== -1) current.days[index] = clone(day);
    else current.days.push(clone(day));
    if (!App.state.coachPrograms) App.state.coachPrograms = {};
    App.state.coachPrograms[id] = current;
    return programDay(id, dayId);
  }

  // День из черновика программы по id — для только что добавленных дней.
  function planDraftDay(dayId) {
    const draft = App.state && App.state.coachPlanDraft;
    if (!draft || !draft.days || !dayId) return null;
    for (let i = 0; i < draft.days.length; i += 1) {
      if (draft.days[i].dayId === dayId) return draft.days[i];
    }
    return null;
  }

  // День для редактора 11E: сохранённый день программы или, у только что
  // добавленного, его копия из черновика программы — иначе тренер не смог бы
  // наполнить новый день упражнениями до сохранения всей программы.
  function editDay(id, dayId) {
    return programDay(id, dayId) || planDraftDay(dayId);
  }

  // Сохранение дня, которого ещё нет в программе: день остаётся в черновике
  // программы и уедет в неё вместе с «Сохранить» на экране программы.
  function applyPlanDay(dayId, draftValue) {
    const draft = App.state && App.state.coachPlanDraft;
    if (!draft || !draft.days || !dayId) return null;
    const index = draft.days.map((item) => item.dayId).indexOf(dayId);
    if (index === -1) return null;
    const base = draft.days[index];
    const day = dayFromDraft(draftValue, base);
    draft.days[index] = {
      dayId: day.dayId,
      title: String(day.title || ""),
      minutes: base.minutes || 0,
      muscles: (base.muscles || []).slice(),
      exercises: clone(day.exercises || []),
    };
    return draft.days[index];
  }

  // Копия дня в черновике программы обновляется после правки в 11E: иначе
  // «Сохранить» программы вернуло бы старый состав упражнений.
  function refreshPlanDay(dayId, day) {
    const draft = App.state && App.state.coachPlanDraft;
    if (!draft || !draft.days || !day) return;
    const index = draft.days.map((item) => item.dayId).indexOf(dayId);
    if (index === -1) return;
    draft.days[index] = {
      dayId: day.dayId,
      title: String(day.title || ""),
      minutes: day.minutes || 0,
      muscles: (day.muscles || []).slice(),
      exercises: clone(day.exercises || []),
    };
  }

  // Черновик программы: круги и срок — строки полей, дни остаются объектами.
  // Состав упражнений правит редактор дня (11E), программа только отбирает и
  // упорядочивает дни.
  function programDraft(value) {
    if (!value) return null;
    return {
      rounds: String(value.rounds === undefined ? PROGRAM_ROUNDS_DEFAULT : value.rounds),
      durationDays: String(value.durationDays === undefined ? PROGRAM_DURATION_DEFAULT : value.durationDays),
      days: (value.days || []).map((item) => ({
        dayId: item.dayId,
        title: String(item.title || ""),
        minutes: item.minutes || 0,
        muscles: (item.muscles || []).slice(),
        exercises: clone(item.exercises || []),
      })),
    };
  }

  // Ошибки привязаны к полям формы: "rounds", "durationDays", "days", "total"
  // (объём против израсходованного) и "title-<dayId>"/"exercises-<dayId>".
  function validateProgram(draftValue, client) {
    const data = draftValue || {};
    const errors = {};
    const days = data.days || [];
    const rounds = dayInt(data.rounds, PROGRAM_ROUNDS_MIN, PROGRAM_ROUNDS_MAX);
    if (rounds === null) {
      errors.rounds = `Кругов — целое от ${PROGRAM_ROUNDS_MIN} до ${PROGRAM_ROUNDS_MAX}`;
    }
    if (dayInt(data.durationDays, PROGRAM_DURATION_MIN, PROGRAM_DURATION_MAX) === null) {
      errors.durationDays = `Срок — целое от ${PROGRAM_DURATION_MIN} до ${PROGRAM_DURATION_MAX} дней`;
    }
    if (!days.length) errors.days = "В программе нужен хотя бы один день";
    else if (days.length > PROGRAM_DAYS_MAX) errors.days = `В программе не больше ${PROGRAM_DAYS_MAX} дней`;
    const used = client && client.packages.training ? client.packages.training.used : 0;
    // Объём пакета — дни × круги: ниже израсходованного его не опустить, иначе
    // в карточке появится «7 из 3».
    if (rounds !== null && days.length && days.length * rounds < used) {
      errors.total = `Израсходовано ${used} тренировок — уменьшить объём нельзя`;
    }
    // День проверяется тем же правилом, что и в редакторе дня: сохранённые
    // упражнения приводятся к черновику и проверяются как только что введённые.
    days.forEach((item) => {
      const check = validateDay(dayDraft(item));
      if (check.errors.title) errors["title-" + item.dayId] = check.errors.title;
      if (check.errors.exercises) errors["exercises-" + item.dayId] = check.errors.exercises;
    });
    return { ok: Object.keys(errors).length === 0, errors };
  }

  // Сохранение программы: дни нормализуются, круги и срок пишутся рядом. Объём
  // пакета здесь не пишется — его выводит чтение программы (см. withOverrides).
  function applyProgram(id, draftValue) {
    const client = find(id);
    if (!client) return null;
    const data = draftValue || {};
    if (!validateProgram(data, client).ok) return client;
    if (!App.state) return client;
    if (!App.state.coachPrograms) App.state.coachPrograms = {};
    App.state.coachPrograms[id] = {
      rounds: dayInt(data.rounds, PROGRAM_ROUNDS_MIN, PROGRAM_ROUNDS_MAX),
      durationDays: dayInt(data.durationDays, PROGRAM_DURATION_MIN, PROGRAM_DURATION_MAX),
      days: (data.days || []).map((item) => ({
        dayId: String(item.dayId || ""),
        title: String(item.title || "").trim(),
        minutes: item.minutes || 0,
        muscles: (item.muscles || []).slice(),
        exercises: clone(item.exercises || []),
      })),
    };
    return program(id);
  }

  function resetProgram(id) {
    const all = App.state && App.state.coachPrograms;
    if (all) delete all[id];
  }

  // Кнопка сброса нужна, только когда сохранённая программа отличается от
  // шаблонов: у нетронутой программы сбрасывать нечего.
  function isCustomProgram(id) {
    const saved = stored(id);
    if (!saved) return false;
    return JSON.stringify(saved) !== JSON.stringify(baseProgram());
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
    // Норма — из расчёта КБЖУ: у неё один источник с экраном питания.
    const diff = client.nutrition.avgKcal - nutritionNorm(client).kcal;
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
    packageView,
    packageActive,
    togglePackage,
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
    nutritionInput,
    nutritionNorm,
    normDraft,
    recalcNorm,
    normDerived,
    validateNorm,
    applyNorm,
    resetNorm,
    hasNorm,
    sameNormDraft,
    checkedDishes,
    dishGroups,
    dishTotals,
    foodDay,
    hasFoodDay,
    foodDayDraft,
    foodDays,
    foodDayCount,
    validateFoodDay,
    applyFoodDay,
    resetFoodDay,
    sameFoodDraft,
    dishModes: DISH_MODE_LABELS,
    foodDayLimits: { dishesMax: FOOD_DAY_MAX_DISHES, daysMax: 180 },
    normLimits: {
      kcalMin: NORM_KCAL_MIN,
      kcalMax: NORM_KCAL_MAX,
      proteinMin: NORM_PROTEIN_MIN,
      proteinMax: NORM_PROTEIN_MAX,
      fatMin: NORM_FAT_MIN,
      fatMax: NORM_FAT_MAX,
      carbsMin: NORM_CARBS_MIN,
      carbsMax: NORM_CARBS_MAX,
      waterMin: NORM_WATER_MIN,
      waterMax: NORM_WATER_MAX,
      durationMin: NORM_DURATION_MIN,
      durationMax: NORM_DURATION_MAX,
    },
    program,
    programDay,
    day,
    daySummary,
    programTotals,
    programLine,
    programSummary,
    dayVolume,
    roundVolume,
    packageVolume,
    packageDates,
    trainingArchive,
    nutritionArchive,
    archive,
    programDraft,
    validateProgram,
    applyProgram,
    dayDraft,
    baseProgram,
    validateDay,
    dayFromDraft,
    applyDay,
    planDraftDay,
    editDay,
    applyPlanDay,
    refreshPlanDay,
    resetProgram,
    hasProgram,
    isCustomProgram,
    dayLimits: {
      titleMax: DAY_TITLE_MAX,
      setsMin: DAY_SETS_MIN,
      setsMax: DAY_SETS_MAX,
      repsMin: DAY_REPS_MIN,
      repsMax: DAY_REPS_MAX,
      weightMax: DAY_WEIGHT_MAX,
      restMax: DAY_REST_MAX,
      tempoMax: DAY_TEMPO_MAX,
      exercisesMax: DAY_EXERCISES_MAX,
    },
    programLimits: {
      roundsMin: PROGRAM_ROUNDS_MIN,
      roundsMax: PROGRAM_ROUNDS_MAX,
      roundsDefault: PROGRAM_ROUNDS_DEFAULT,
      durationMin: PROGRAM_DURATION_MIN,
      durationMax: PROGRAM_DURATION_MAX,
      durationDefault: PROGRAM_DURATION_DEFAULT,
      daysMax: PROGRAM_DAYS_MAX,
    },
  };
})(window.App = window.App || {});
