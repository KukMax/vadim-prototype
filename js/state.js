(function (App) {
  "use strict";

  const DATA = App.data;
  const { NOW, NOW_MINUTES, isoDate, parseIsoDate, addDays, daysBetween, plural, clamp, toMinutes } = App.util;
  const PROFILE_KEY = "trenio-profile";
  // Хранится только стадия "guest" | "client". Почта, код и пароль — никогда.
  const SESSION_KEY = "trenio-session";

  function loadStage() {
    try {
      const saved = window.localStorage.getItem(SESSION_KEY);
      return saved === "client" || saved === "guest" ? saved : "guest";
    } catch (error) {
      return "guest";
    }
  }

  function defaultProfile() {
    return {
      avatar: "",
      phone: DATA.client.phone,
      email: DATA.client.email,
    };
  }

  function loadProfile() {
    const fallback = defaultProfile();
    try {
      const raw = window.localStorage.getItem(PROFILE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return fallback;
      const text = (value, base) => (typeof value === "string" && value.trim() ? value : base);
      return {
        avatar: typeof parsed.avatar === "string" ? parsed.avatar : "",
        phone: text(parsed.phone, fallback.phone),
        email: text(parsed.email, fallback.email),
      };
    } catch (error) {
      return fallback;
    }
  }

  function persistProfile() {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({
        avatar: STATE.profile.avatar,
        phone: STATE.profile.phone,
        email: STATE.profile.email,
      }));
    } catch (error) {
      /* приватный режим или переполнение хранилища — работаем без сохранения */
    }
  }

  function seedCycle() {
    const done = {};
    const itemDone = {};
    DATA.cycles.current.sessions.forEach((session) => {
      if (!session.doneDate) return;
      done[session.number] = session.doneDate;
      session.blocks.forEach((block) => {
        block.items.forEach((item) => {
          itemDone[item.id] = true;
        });
      });
    });
    return { done, itemDone };
  }

  // Шаг 3: сколько дней подряд человек готов есть одно и то же блюдо.
  function defaultCookDays() {
    const cooking = DATA.questionnaire.cooking;
    const days = {};
    cooking.meals.forEach((meal) => {
      days[meal.key] = cooking.value;
    });
    return days;
  }

  // Анкета: значения по умолчанию для шага 1. Ответы — данные о здоровье,
  // поэтому копия живёт только в памяти страницы и сбрасывается на входе.
  function defaultOnboardingData() {
    return {
      name: "",
      phone: "",
      sex: "",
      height: "",
      weight: "",
      // Желаемый вес спрашиваем сразу: он нужен виджету цели в кабинете.
      targetWeight: "",
      age: "",
      goal: "",
      sessionsPerWeek: DATA.questionnaire.sessionsPerWeek.value,
      fitness: "",
      activity: "",
      limitations: "",
      noLimitations: false,
      // Шаг 3 «Предпочтения в питании»: отмеченные продукты по категориям,
      // дни готовки, перекусы и снятые галочки блюд (пусто — все выбраны).
      foods: {},
      cookDays: defaultCookDays(),
      snacks: [],
      dishesOff: {},
      allergies: "",
      noAllergies: false,
    };
  }

  // Пакет на шаге 2: по умолчанию отмечены «Тренировки + Питание», поэтому
  // сразу видны три шага анкеты и кнопка «Далее». Один клик по карточке
  // переключает на пакет без питания — тогда шагов два.
  function defaultPackages() {
    return ["training", "nutrition"];
  }

  // Копия ответов анкеты: вложенные категории продуктов и блюд не должны
  // ссылаться на объекты черновика — правка формы не меняет снимок.
  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === "object") {
      const copy = {};
      Object.keys(value).forEach((key) => {
        copy[key] = cloneValue(value[key]);
      });
      return copy;
    }
    return value;
  }

  // Дневник питания живёт по плану на 30 дней: дни до «сегодня» уже съедены
  // и выпиты, «сегодня» заполняется по времени, будущие дни пустые. Индекс дня
  // плана знает App.plan, но state.js грузится раньше — поэтому засев вынесен
  // в функцию и plan.js вызывает её ещё раз, уже со своим индексом.
  function seedFoodDays(todayIndex) {
    const today = clamp(Number(todayIndex) || 0, 0, DATA.planDays - 1);
    const todayMeals = DATA.mealTimes.map((meal) => NOW_MINUTES >= toMinutes(meal.time));
    return {
      foodDay: today,
      meals: Array.from({ length: DATA.planDays }, (_, day) => day < today
        ? DATA.mealTimes.map(() => true)
        : day === today ? todayMeals.slice() : DATA.mealTimes.map(() => false)),
      water: Array.from({ length: DATA.planDays }, (_, day) => Array.from(
        { length: DATA.targets.water },
        (_, glass) => day < today || (day === today && glass < 5),
      )),
    };
  }

  function buildState() {
    const seeded = seedCycle();
    let selected = 1;
    while (seeded.done[selected] && selected < 12) selected += 1;
    const food = seedFoodDays(App.plan ? App.plan.todayIndex() : 0);
    return {
      foodDay: food.foodDay,
      meals: food.meals,
      water: food.water,
      reportFormOpen: false,
      reportMetric: "weight",
      reportShowAll: false,
      supplementsOpen: false,
      measurements: DATA.measurementsSeed.map((entry) => ({
        date: entry.date,
        values: Object.assign({}, entry.values),
      })),
      theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
      cycle: {
        selected,
        tab: "current",
        archiveOpen: null,
        done: seeded.done,
        itemDone: seeded.itemDone,
        // Правки клиента: подходы и комментарий к упражнению. Ключ — id
        // упражнения, запись создаётся лениво при первой правке.
        edits: {},
        // id упражнения с раскрытым полем комментария: раскрытие — не правка.
        commentOpen: null,
      },
      training: { status: DATA.subscription.training.status },
      // Статус питания меняется только в демо-панели: дни и дата активации
      // остаются в DATA.subscription.
      nutrition: { status: DATA.subscription.nutrition.status },
      // Демо-переключатель «Срок истёк»: пакет остаётся активным по статусу,
      // но срок действия считается законченным.
      demoExpiry: { training: false, nutrition: false },
      // Отправленная анкета — короткий снимок без телефона. Живёт только
      // в памяти и сбрасывается вместе с демо-данными.
      submission: null,
      // Полная анкета для экрана «Моя анкета»: в отличие от submission здесь
      // есть телефон, ограничения и аллергии. Живёт только в памяти страницы.
      questionnaire: null,
      // Ручная правка нормы калорий: ставится тренером из кабинета — пока
      // только хук. Пустое значение правкой не считается.
      calorieOverride: null,
      profile: loadProfile(),
      auth: { stage: loadStage(), email: "" },
      onboarding: { mode: "signup", step: 1, data: defaultOnboardingData(), errors: {}, packages: defaultPackages() },
      // Фильтры кабинета тренера, только в памяти: из демо-сброса и снимка
      // анкеты исключены — это состояние прототипа панели, а не клиента.
      coachQuery: "",
      coachFilter: "all",
      // Открытая карточка клиента: только id в памяти, чтобы прямая ссылка без
      // выбранного клиента возвращала в список. Снимок анкеты и демо-сброс её не
      // видят — это состояние просмотра панели.
      coachClientId: null,
      // Режим карточки клиента и черновик редактора: правки кабинета тренера
      // не сохраняются между перезагрузками — это прототип. В снимок анкеты и
      // демо-сброс они не входят: к данным клиента отношения не имеют.
      coachMode: "view",
      coachDraft: null,
      // Наложенные правки по id клиента: целевой вес, заметка и объёмы пакетов.
      // Только в памяти; фикстуры в js/coach.js не переписываются.
      coachOverrides: {},
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

  const cycle = {
    current() {
      return DATA.cycles.current;
    },
    archive() {
      return DATA.cycles.archive;
    },
    list() {
      return [DATA.cycles.current].concat(DATA.cycles.archive);
    },
    byId(id) {
      return this.list().filter((item) => item.id === id)[0] || null;
    },
    isCurrent(cycleData) {
      return Boolean(cycleData) && cycleData.id === DATA.cycles.current.id;
    },
    status() {
      return STATE.training.status;
    },
    hasPlan() {
      // "pending" ждёт активации: плана ещё нет, поэтому доступны только
      // общие рекомендации — как и при "none".
      return STATE.training.status === "active" || STATE.training.status === "completed";
    },
    isPending() {
      return STATE.training.status === "pending";
    },
    sessions(cycleData) {
      return cycleData ? cycleData.sessions : [];
    },
    findSession(cycleData, number) {
      const sessions = this.sessions(cycleData);
      return sessions.filter((session) => session.number === number)[0] || null;
    },
    isDone(cycleData, number) {
      if (!this.isCurrent(cycleData)) {
        const session = this.findSession(cycleData, number);
        return Boolean(session && session.doneDate);
      }
      if (STATE.training.status === "completed") return true;
      return Boolean(STATE.cycle.done[number]);
    },
    doneDate(cycleData, number) {
      if (!this.isCurrent(cycleData)) {
        const session = this.findSession(cycleData, number);
        return (session && session.doneDate) || "";
      }
      return STATE.cycle.done[number] || "";
    },
    doneCount(cycleData) {
      if (!this.hasPlan()) return 0;
      let total = 0;
      for (let number = 1; number <= 12; number += 1) {
        if (this.isDone(cycleData, number)) total += 1;
      }
      return total;
    },
    lastDoneNumber(cycleData) {
      for (let number = 12; number >= 1; number -= 1) {
        if (this.isDone(cycleData, number)) return number;
      }
      return 0;
    },
    lastDoneDate(cycleData) {
      const number = this.lastDoneNumber(cycleData);
      return number ? this.doneDate(cycleData, number) : "";
    },
    nextNumber(cycleData) {
      if (!this.hasPlan()) return 0;
      for (let number = 1; number <= 12; number += 1) {
        if (!this.isDone(cycleData, number)) return number;
      }
      return 0;
    },
    nextSession(cycleData) {
      const number = this.nextNumber(cycleData);
      return number ? this.findSession(cycleData, number) : null;
    },
    daysSince(iso) {
      if (!iso) return null;
      return Math.max(0, daysBetween(iso, isoDate(NOW)));
    },
    agoText(days) {
      if (days === null || days === undefined) return "";
      if (days <= 0) return "сегодня";
      if (days === 1) return "вчера";
      return days + " " + plural(days, ["день", "дня", "дней"]) + " назад";
    },
    lastDoneText(cycleData) {
      const days = this.daysSince(this.lastDoneDate(cycleData));
      return days === null ? "" : this.agoText(days);
    },
    itemCount(session) {
      return session.blocks.reduce((total, block) => total + block.items.length, 0);
    },
    itemDoneCount(cycleData, session) {
      if (!this.hasPlan()) return 0;
      if (!this.isCurrent(cycleData)) return this.itemCount(session);
      if (STATE.training.status === "completed") return this.itemCount(session);
      if (this.isDone(cycleData, session.number)) return this.itemCount(session);
      return session.blocks.reduce((total, block) => total + block.items.filter((item) => STATE.cycle.itemDone[item.id]).length, 0);
    },
    isItemDone(cycleData, itemId) {
      if (!this.hasPlan()) return false;
      if (!this.isCurrent(cycleData)) return true;
      if (STATE.training.status === "completed") return true;
      return Boolean(STATE.cycle.itemDone[itemId]);
    },
    isSelectedDone() {
      return this.isDone(DATA.cycles.current, STATE.cycle.selected);
    },
    // Правки клиента живут только в памяти: подходы и комментарий к упражнению.
    edits(itemId) {
      return (itemId && STATE.cycle.edits[itemId]) || null;
    },
    // Подходы для показа: правка клиента, если она есть, иначе план тренера.
    getSets(cycleData, item) {
      const edit = this.edits(item && item.id);
      if (edit && Array.isArray(edit.sets) && edit.sets.length) return edit.sets;
      return (item && item.sets) || [];
    },
    getComment(item) {
      const edit = this.edits(item && item.id);
      return (edit && edit.comment) || "";
    },
    isAdded(itemId, index) {
      const edit = this.edits(itemId);
      const set = edit && Array.isArray(edit.sets) ? edit.sets[index] : null;
      return Boolean(set && set.added);
    },
    // Копия подходов из плана: с этого момента упражнение правится отдельно
    // и шаблон с архивными циклами не меняются.
    ensureEdit(item) {
      if (!item || !item.id) return null;
      if (!STATE.cycle.edits[item.id]) {
        const sets = (item.sets || []).map((set) => ({
          reps: set.reps,
          weight: set.weight === undefined ? null : set.weight,
          added: false,
        }));
        STATE.cycle.edits[item.id] = { sets, comment: "" };
      }
      return STATE.cycle.edits[item.id];
    },
  };

  // Срок действия пакета: 30 дней от активации. Демо-дата активации хранится
  // как activatedDaysAgo, поэтому остаток пересчитывается от текущей даты.
  // STATE.demoExpiry переводит пакет в «истёкший» вид из демо-панели, не меняя DATA.
  function subscriptionInfo(key) {
    const pkg = DATA.subscription[key] || {};
    const days = Math.max(0, Number(pkg.days) || 0);
    const forced = Boolean(STATE.demoExpiry && STATE.demoExpiry[key]);
    const since = forced ? days : Math.max(0, Number(pkg.activatedDaysAgo) || 0);
    const daysLeft = days ? clamp(days - since, 0, days) : 0;
    return {
      until: isoDate(addDays(NOW, days - since)),
      daysLeft,
      percentUsed: days ? Math.round(clamp((since / days) * 100, 0, 100)) : 0,
      days,
      since,
      expired: Boolean(days) && since >= days,
    };
  }

  function packageStatus(key) {
    if (key === "training") return STATE.training.status;
    return STATE.nutrition ? STATE.nutrition.status : "none";
  }

  const subscription = {
    info: subscriptionInfo,
    expired(key) {
      return packageStatus(key) === "active" && subscriptionInfo(key).expired;
    },
    // Активный, но истёкший пакет показываем как завершённый: плана и меню
    // больше нет, вместо них — общие рекомендации.
    status(key) {
      const status = packageStatus(key);
      return status === "active" && subscriptionInfo(key).expired ? "completed" : status;
    },
  };

  const profile = {
    save: persistProfile,
    // Имя из анкеты живёт только в памяти: оно подменяет демо-имя на главной
    // и в шапке профиля, но не попадает ни в хранилище, ни в DATA.
    displayName() {
      const submission = STATE.submission;
      const name = submission && submission.name ? String(submission.name).trim() : "";
      return name || DATA.client.name;
    },
    initial() {
      const name = this.displayName();
      return name ? name.charAt(0).toUpperCase() : "—";
    },
    reset() {
      try {
        window.localStorage.removeItem(PROFILE_KEY);
      } catch (error) {
        /* хранилище недоступно — сбрасывать нечего */
      }
    },
  };

  const auth = {
    stage() {
      return STATE.auth.stage;
    },
    isClient() {
      return STATE.auth.stage === "client";
    },
    isPublic() {
      return STATE.auth.stage !== "client";
    },
    email() {
      return STATE.auth.email;
    },
    // Почта живёт только в памяти страницы: ни storage, ни URL, ни лог.
    setEmail(value) {
      STATE.auth.email = typeof value === "string" ? value.trim() : "";
    },
    // "verifying" и "onboarding" не переживают перезагрузку — сохраняем только
    // стадии, которые можно восстановить без введённых данных.
    setStage(stage) {
      if (["guest", "verifying", "onboarding", "client"].indexOf(stage) === -1) return;
      STATE.auth.stage = stage;
      if (stage === "guest") STATE.auth.email = "";
      try {
        if (stage === "client" || stage === "guest") window.localStorage.setItem(SESSION_KEY, stage);
        else window.localStorage.removeItem(SESSION_KEY);
      } catch (error) {
        /* приватный режим — сессия останется только в памяти */
      }
    },
    reset() {
      STATE.auth.stage = "guest";
      STATE.auth.email = "";
      try {
        window.localStorage.removeItem(SESSION_KEY);
      } catch (error) {
        /* хранилище недоступно — сбрасывать нечего */
      }
    },
  };

  // Число из поля анкеты: запятая разрешена, пустая строка и мусор — null.
  function decimalValue(raw) {
    const text = String(raw == null ? "" : raw).trim().replace(/\s+/g, "").replace(",", ".");
    if (!text) return null;
    const value = Number(text);
    return isFinite(value) ? value : null;
  }

  // Снимок анкеты для экрана «Моя анкета»: цифры — числами, тексты — строками.
  // Пакеты фиксируются на момент отправки: в правке их изменить нельзя.
  function questionnaireSnapshot(data, at, packages) {
    const weight = decimalValue(data.weight);
    const asksTarget = data.goal === "lose" || data.goal === "gain";
    return {
      at,
      packages: packages.slice(),
      name: String(data.name || "").trim(),
      phone: String(data.phone || "").trim(),
      sex: data.sex,
      age: decimalValue(data.age),
      height: decimalValue(data.height),
      weight,
      targetWeight: asksTarget ? decimalValue(data.targetWeight) : weight,
      goal: data.goal,
      sessionsPerWeek: Number(data.sessionsPerWeek),
      fitness: data.fitness,
      activity: data.activity,
      limitations: String(data.limitations || "").trim(),
      noLimitations: !!data.noLimitations,
      allergies: String(data.allergies || "").trim(),
      noAllergies: !!data.noAllergies,
      foods: cloneValue(data.foods),
      cookDays: cloneValue(data.cookDays),
      snacks: Array.isArray(data.snacks) ? data.snacks.slice() : [],
      dishesOff: cloneValue(data.dishesOff),
    };
  }

  // Демо-история принадлежит демо-клиенту: после анкеты у нового клиента нет
  // ни замеров, ни дневника, ни воды. Статусы пакетов здесь не трогаем — их
  // выставляет отправка анкеты, а демо-история возвращается только по кнопке
  // «Сбросить демо-данные» (она перезагружает страницу).
  function resetClientHistory() {
    STATE.measurements = [];
    const food = seedFoodDays(App.plan ? App.plan.todayIndex() : 0);
    STATE.foodDay = food.foodDay;
    STATE.meals = food.meals;
    STATE.water = food.water;
    STATE.cycle.done = {};
    STATE.cycle.itemDone = {};
    STATE.cycle.edits = {};
    STATE.cycle.commentOpen = null;
    STATE.cycle.selected = 1;
  }

  // Анкета онбординга: сброс при входе с экрана подтверждения и при выходе.
  const onboarding = {
    reset() {
      STATE.onboarding.mode = "signup";
      STATE.onboarding.step = 1;
      STATE.onboarding.data = defaultOnboardingData();
      STATE.onboarding.errors = {};
      STATE.onboarding.packages = defaultPackages();
    },
    data() {
      return STATE.onboarding.data;
    },
    step() {
      return STATE.onboarding.step;
    },
    setStep(value) {
      STATE.onboarding.step = value === 2 ? 2 : value === 3 ? 3 : 1;
    },
    packages() {
      return STATE.onboarding.packages.slice();
    },
    hasTraining() {
      return STATE.onboarding.packages.indexOf("training") !== -1;
    },
    hasNutrition() {
      return STATE.onboarding.packages.indexOf("nutrition") !== -1;
    },
    // Правка отправленной анкеты — тот же набор полей и валидаторы, что в
    // онбординге. Пакет при правке не меняется, поэтому шаг 2 недоступен:
    // видимые шаги — «О себе» и, если пакет с питанием, «Питание».
    isEditing() {
      return STATE.onboarding.mode === "edit";
    },
    beginEdit() {
      const source = STATE.questionnaire;
      if (!source) return false;
      const draft = defaultOnboardingData();
      Object.keys(draft).forEach((key) => {
        if (!(key in source)) return;
        const raw = source[key];
        if (key === "height" || key === "weight" || key === "targetWeight" || key === "age") {
          draft[key] = raw == null || raw === "" ? "" : String(raw);
        } else if (Array.isArray(raw)) {
          draft[key] = raw.slice();
        } else if (raw && typeof raw === "object") {
          draft[key] = cloneValue(raw);
        } else {
          draft[key] = raw;
        }
      });
      STATE.onboarding.mode = "edit";
      STATE.onboarding.step = 1;
      STATE.onboarding.errors = {};
      STATE.onboarding.packages = source.packages.slice();
      STATE.onboarding.data = draft;
      return true;
    },
    // Отмена правки: черновик и пакеты остаются как были, анкета не меняется.
    cancelEdit() {
      STATE.onboarding.mode = "signup";
      STATE.onboarding.step = 1;
      STATE.onboarding.errors = {};
    },
    // Сохранение правки: обновляем анкету и короткий снимок для кабинета.
    // Статусы пакетов и сессию не трогаем — это не новая отправка анкеты.
    saveEdit() {
      const previous = STATE.questionnaire;
      if (!previous) return null;
      const data = STATE.onboarding.data;
      const updated = questionnaireSnapshot(data, previous.at, previous.packages);
      STATE.questionnaire = updated;
      if (STATE.submission) {
        STATE.submission.name = updated.name;
        STATE.submission.goal = updated.goal;
        STATE.submission.sessionsPerWeek = updated.sessionsPerWeek;
        STATE.submission.height = updated.height;
        STATE.submission.weight = updated.weight;
        STATE.submission.targetWeight = updated.targetWeight;
      }
      this.cancelEdit();
      return updated;
    },
    // Шаг 3 нужен только пакету с питанием: у одних тренировок анкета
    // отправляется прямо со шага 2, поэтому шагов всего два.
    steps() {
      return this.hasNutrition() ? 3 : 2;
    },
    // Отправка анкеты: стадия "client" сохраняется как раньше, ответы — нет.
    // В снимок не попадают ни телефон, ни ограничения, ни аллергии: это
    // медицинские подробности, экранам кабинета они не нужны. Цифры анкеты —
    // числа: рост, текущий и желаемый вес. Для цели «поддерживать» желаемый
    // вес равен текущему, его не спрашивают.
    submitForm() {
      const data = STATE.onboarding.data;
      const packages = this.packages();
      const weight = decimalValue(data.weight);
      const goal = data.goal;
      const asksTarget = goal === "lose" || goal === "gain";
      STATE.submission = {
        at: new Date().toISOString(),
        packages,
        name: String(data.name || "").trim(),
        goal,
        sessionsPerWeek: Number(data.sessionsPerWeek),
        height: decimalValue(data.height),
        weight,
        targetWeight: asksTarget ? decimalValue(data.targetWeight) : weight,
      };
      // Полная анкета для «Моей анкеты»: телефон и медицинские подробности
      // остаются в памяти страницы и в снимок кабинета не попадают.
      STATE.questionnaire = questionnaireSnapshot(data, STATE.submission.at, packages);
      // Контакты в профиле — свои: телефон из анкеты, почта из регистрации.
      // Демо-контакты остаются только у демо-клиента.
      const phone = String(data.phone || "").trim();
      const email = auth.email();
      if (phone) STATE.profile.phone = phone;
      if (email) STATE.profile.email = email;
      if (phone || email) profile.save();
      resetClientHistory();
      STATE.training.status = packages.indexOf("training") !== -1 ? "pending" : "none";
      if (!STATE.nutrition) STATE.nutrition = { status: "none" };
      STATE.nutrition.status = packages.indexOf("nutrition") !== -1 ? "pending" : "none";
      App.auth.setStage("client");
      return STATE.submission;
    },
  };

  App.state = STATE;
  // Повторный засев дневника: plan.js вызывает его, когда App.plan уже собран.
  STATE.seedFoodDays = seedFoodDays;
  App.measurements = measurements;
  App.cycle = cycle;
  App.subscription = subscription;
  App.profile = profile;
  App.auth = auth;
  App.onboarding = onboarding;
  // В спецификации шага 2 метод называется App.state.submitForm(): объект
  // состояния и есть App.state, поэтому даём ссылку с того же объекта.
  // Реализация одна — в модуле онбординга.
  STATE.submitForm = function submitForm() {
    return onboarding.submitForm();
  };
})(window.App = window.App || {});
