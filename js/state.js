(function (App) {
  "use strict";

  const DATA = App.data;
  const { NOW, NOW_MINUTES, TODAY, isoDate, parseIsoDate, daysBetween, plural, toMinutes } = App.util;
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

  function buildState() {
    const todayMeals = DATA.mealTimes.map((meal) => NOW_MINUTES >= toMinutes(meal.time));
    const seeded = seedCycle();
    let selected = 1;
    while (seeded.done[selected] && selected < 12) selected += 1;
    return {
      foodDay: TODAY,
      meals: Array.from({ length: 7 }, (_, day) => day < TODAY ? DATA.mealTimes.map(() => true) : day === TODAY ? todayMeals.slice() : DATA.mealTimes.map(() => false)),
      water: Array.from({ length: 7 }, (_, day) => Array.from({ length: DATA.targets.water }, (_, glass) => day < TODAY || (day === TODAY && glass < 5))),
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
      },
      training: { status: DATA.subscription.training.status },
      profile: loadProfile(),
      auth: { stage: loadStage(), email: "" },
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
      return STATE.training.status !== "none";
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
  };

  const profile = {
    save: persistProfile,
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

  App.state = STATE;
  App.measurements = measurements;
  App.cycle = cycle;
  App.profile = profile;
  App.auth = auth;
})(window.App = window.App || {});
