/* Application shell: routing, chrome, delegated actions, global workout dock. */
(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const MEASUREMENTS = App.measurements;
  const CYCLE = App.cycle;
  const PROFILE = App.profile;
  const { ROUTES, SCREEN_IDS, PAGE_TITLES } = App.const;
  const { NOW, TODAY, isoDate, escapeHtml, icon, one, num, weight, plural, percent, formatShortDate } = App.util;
  const { openSheet, closeSheet } = App.ui;

  let currentRoute = null;
  let routeFocus = null;
  let toastTimer = 0;
  let installPrompt = null;
  let pendingWorkoutSelection = 0;

  const TRAININGS = DATA.subscription.training.sessions;

  /* ---------- routing ---------- */

  // Публичный вход живёт вне кабинета: гость по умолчанию попадает на #/welcome,
  // клиент — на #/home. "verifying" и "onboarding" существуют только в памяти.
  const PUBLIC_ROUTES = ["welcome", "demo", "register", "verify", "onboarding"];
  // Кабинет тренера — третья оболочка: доступен и гостю, и клиенту, стадию
  // входа не меняет и в навигацию клиента не попадает.
  const COACH_ROUTES = ["coach", "coach-client", "coach-program", "coach-training", "coach-nutrition", "coach-food", "coach-archive"];

  function isPublicRoute(route) {
    return PUBLIC_ROUTES.indexOf(route) !== -1;
  }

  function isCoachRoute(route) {
    return COACH_ROUTES.indexOf(route) !== -1;
  }

  function startRoute() {
    return STATE.auth.stage === "client" ? "home" : "welcome";
  }

  function guardRoute(route) {
    // Карточка без выбранного клиента (прямая ссылка, сброс памяти) ведёт в
    // список, а не в «Экран недоступен»: id живёт только в памяти.
    if (route === "coach-client" && !coachClient()) return "coach";
    // Программа тоже открывается только из выбранной карточки: id клиента
    // живёт в памяти и перезагрузку не переживает.
    if (route === "coach-program" && !coachClient()) return "coach";
    // Редактор тренировки без клиента или дня (прямая ссылка, F5) — в карточку
    // клиента: ни id клиента, ни id дня не переживают перезагрузку.
    if (route === "coach-training") {
      const client = coachClient();
      if (!client) return "coach";
      const day = coachTrainingDay(client);
      if (!day) return "coach-client";
    }
    // Норма питания считается для выбранного клиента: без него — в список.
    if (route === "coach-nutrition" && !coachClient()) return "coach";
    // Дни питания тоже привязаны к клиенту из памяти.
    if (route === "coach-food" && !coachClient()) return "coach";
    // Архив пакетов привязан к выбранному клиенту из памяти.
    if (route === "coach-archive" && !coachClient()) return "coach";
    if (isCoachRoute(route)) return route;
    const stage = STATE.auth.stage;
    const client = stage === "client";
    const editing = route === "onboarding" && App.onboarding.isEditing();
    if (!client && !isPublicRoute(route)) return "welcome";
    if (client && isPublicRoute(route) && !editing) return "home";
    if (route === "verify" && stage !== "verifying") return "welcome";
    if (route === "onboarding" && stage !== "onboarding" && !editing) return "welcome";
    return route;
  }

  function rawRoute() {
    const value = location.hash.replace(/^#\/?/, "").split("?")[0];
    return value || "";
  }

  function resolveRoute() {
    let route = rawRoute();
    if (route === "supplements") {
      route = "nutrition";
    } else if (ROUTES.indexOf(route) === -1) {
      route = startRoute();
    }
    route = guardRoute(route);
    if (rawRoute() !== route) history.replaceState(null, "", "#/" + route);
    return route;
  }

  function screenErrorMarkup(route) {
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Trenio</span>
        <h1 class="page-title" id="${route}-title" tabindex="-1">Экран недоступен</h1>
      </div>
      <article class="card">
        <p class="page-lead">Не удалось показать экран. Обновите страницу.</p>
        <a class="btn btn--ghost" href="#/home" data-nav="home">Вернуться на главную</a>
      </article>`;
  }

  function render(route, options) {
    const view = App.views[route];
    const screen = document.getElementById(SCREEN_IDS[route]);
    if (!view || !screen) return;
    // Уход из карточки клиента бросает черновик редактора: возвращаться к нему
    // после другого экрана нечего, а правки в памяти остаются как есть.
    if (route !== "coach-client" && App.state && App.state.coachMode === "edit") {
      App.state.coachMode = "view";
      App.state.coachDraft = null;
    }
    // Черновик нормы питания живёт только на своём экране: уход его бросает,
    // сохранённая норма остаётся в памяти.
    if (route !== "coach-nutrition" && App.state) {
      App.state.coachNormDraft = null;
      App.state.coachNormErrors = {};
    }
    // Черновик дня питания живёт только на своём экране: уход его бросает,
    // сохранённые дни остаются в памяти.
    if (route !== "coach-food" && App.state) {
      App.state.coachFoodDraft = null;
    }
    // Уход с редактора дня бросает его черновик и открытую панель выбора:
    // сохранённая программа остаётся в памяти, несохранённые числа — нет.
    if (route !== "coach-training" && App.state) {
      if (App.state.coachProgramMode === "edit") {
        App.state.coachProgramMode = "view";
        App.state.coachProgramDraft = null;
      }
      if (App.state.coachPicker && App.state.coachPicker.open) {
        App.state.coachPicker = { open: false, query: "", group: "all" };
      }
    }
    // Черновик программы (#/coach-program) живёт на своём экране и в редакторе
    // дня: заход за упражнениями и возврат не теряют уже переставленные дни и
    // круги. Любой другой экран его бросает, иначе сохранение вернуло бы старые
    // копии упражнений уже отредактированных дней.
    if (route !== "coach-program" && route !== "coach-training" && App.state) {
      App.state.coachPlanMode = "view";
      App.state.coachPlanDraft = null;
      // Контекст «день открыт из программы» живёт только в паре этих экранов.
      App.state.coachTrainingFrom = "";
      // Вместе с черновиком пропадает и день, который в программе ещё не жил.
      const client = STATE.coachClientId ? App.coach.find(STATE.coachClientId) : null;
      if (
        client &&
        STATE.coachProgramDayId &&
        !App.coach.programDay(client.id, STATE.coachProgramDayId)
      ) {
        STATE.coachProgramDayId = null;
      }
    }
    // Правка анкеты живёт только внутри экрана онбординга: уход на другой
    // экран без сохранения отменяет черновик, чтобы режим правки не «залипал».
    if (route !== "onboarding" && App.onboarding.isEditing()) App.onboarding.cancelEdit();
    const settings = options || {};
    const previousRoute = currentRoute;
    // Only a real route change (first load, hashchange, nav link to another route)
    // may jump to the top. In-place updates — static: true or a same-route re-render
    // from handleAction — keep the current scroll position.
    const routeChanged = previousRoute !== route;
    const jumpTop = routeChanged || !!settings.scrollTop;
    const savedScrollY = window.scrollY || window.pageYOffset || 0;
    currentRoute = route;
    // Оболочка переключается до сборки вьюхи: публичные экраны рисуются без кабинета.
    document.body.dataset.shell = isCoachRoute(route) ? "coach" : isPublicRoute(route) ? "public" : "app";
    let html;
    try {
      html = view.view();
    } catch (error) {
      console.error(error);
      html = screenErrorMarkup(route);
    }
    screen.classList.toggle("is-static", !!settings.static);
    screen.innerHTML = html;
    document.querySelectorAll(".screen").forEach((item) => {
      item.hidden = item !== screen;
    });
    screen.hidden = false;
    // Отсчёт повторной отправки принадлежит только #/verify: уход со экрана его гасит.
    if (route === "verify") startResend();
    else stopResend();
    // Свежая разметка приходит с заблокированной кнопкой «Сохранить»: если день
    // уже отличается от сохранённого (добавили упражнение, переставили строки),
    // включаем её сразу, не дожидаясь ввода в поле.
    if (route === "coach-training") syncDaySave();
    // То же для программы: добавленный или переставленный день сразу включает
    // «Сохранить», хотя полей никто не трогал.
    if (route === "coach-program") syncPlanSave();
    // Норма питания: правка в памяти сразу делает черновик грязным, а
    // подписи-производные в разметке уже посчитаны вьюхой.
    if (route === "coach-nutrition") syncNormSave();
    if (route === "coach-food") syncFoodSave();
    if (settings.static) {
      screen.querySelectorAll(".ring-value").forEach((ring) => {
        ring.style.strokeDashoffset = ring.dataset.offset;
      });
    } else {
      App.ui.animateRings(screen);
    }
    document.title = PAGE_TITLES[route] || "Trenio";
    document.body.dataset.route = route;
    if (route === "nutrition") revealFoodDay();
    syncNavigation(route);
    syncClientMeta();
    syncProfileChrome();
    syncDock();
    syncDemoBar();
    if (jumpTop) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, savedScrollY);
      window.requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
    }
    if (settings.focus === "heading") {
      const heading = screen.querySelector("h1");
      if (heading) heading.focus({ preventScroll: true });
    } else if (settings.focusSelector) {
      const target = document.querySelector(settings.focusSelector);
      if (target) target.focus({ preventScroll: true });
    } else if (settings.focusKey) {
      focusKey(settings.focusKey);
    }
    // Удаление дня могло сделать программу меньше израсходованного: причина
    // видна сразу, иначе выключенная кнопка сохранения молчит о ней.
    if (route === "coach-program") revealPlanErrors();
  }

  function prepareWorkouts() {
    const cycleData = CYCLE.current();
    STATE.cycle.tab = "current";
    STATE.cycle.archiveOpen = null;
    const next = CYCLE.nextSession(cycleData);
    const fallback = cycleData.sessions[cycleData.sessions.length - 1];
    const target = pendingWorkoutSelection || (next ? next.number : fallback.number);
    STATE.cycle.selected = target;
    pendingWorkoutSelection = 0;
  }

  function onRouteChange() {
    const route = resolveRoute();
    const focus = routeFocus || "heading";
    routeFocus = null;
    const layer = document.getElementById("sheet-layer");
    if (layer && !layer.hidden) closeSheet();
    if (route === "workouts") prepareWorkouts();
    render(route, focus === "heading" ? { focus } : { focusSelector: focus });
  }

  function go(route, focus) {
    routeFocus = focus || "heading";
    if (currentRoute === route && resolveRoute() === route) {
      const pending = routeFocus;
      routeFocus = null;
      const options = pending === "heading" ? { focus: pending } : { focusSelector: pending };
      if (route === "workouts") {
        prepareWorkouts();
        options.scrollTop = true;
      }
      render(route, options);
      return;
    }
    if (location.hash === "#/" + route) onRouteChange();
    else location.hash = "#/" + route;
  }

  /* ---------- chrome ---------- */

  function syncNavigation(route) {
    if (isPublicRoute(route) || isCoachRoute(route)) {
      document.querySelectorAll(".nav-link[data-nav], .tab[data-nav]").forEach((link) => {
        link.removeAttribute("aria-current");
      });
      return;
    }
    document.querySelectorAll(".nav-link[data-nav], .tab[data-nav]").forEach((link) => {
      if (link.dataset.nav === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function syncClientMeta() {
    const target = document.getElementById("sidebar-client-meta");
    if (!target) return;
    const latest = MEASUREMENTS.latest();
    const current = latest ? latest.values.weight : DATA.goal.current;
    target.textContent = `${DATA.client.age} года · ${DATA.client.height} см · ${weight(current)} кг`;
  }

  // Логотип в шапке кабинета: гостю — на вход, клиенту — на главную.
  function syncBrandLinks() {
    const client = STATE.auth.stage === "client";
    const href = client ? "#/home" : "#/welcome";
    const label = client
      ? "Trenio — фитнес тренер Вадим, на главную"
      : "Trenio — фитнес тренер Вадим, на страницу входа";
    document.querySelectorAll("a.brand--logo").forEach((link) => {
      link.setAttribute("href", href);
      link.setAttribute("aria-label", label);
      if (client) link.dataset.nav = "home";
      else link.removeAttribute("data-nav");
    });
  }

  // Аватар в шапке и в сайдбаре: фото из профиля, иначе первая буква имени.
  // Имя берём из App.profile: после анкеты это имя из памяти, а не демо-«А».
  function syncProfileChrome() {
    const src = STATE.profile.avatar;
    const letter = App.profile.initial();
    const top = document.getElementById("topbar-avatar");
    if (top) {
      if (src) top.innerHTML = `<img class="avatar-img" src="${escapeHtml(src)}" alt="">`;
      else top.textContent = letter;
    }
    const side = document.getElementById("sidebar-avatar");
    if (side) {
      if (src) side.innerHTML = `<img class="avatar-img" src="${escapeHtml(src)}" alt="">`;
      else side.textContent = letter;
    }
    syncBrandLinks();
  }

  function focusKey(key) {
    if (!key) return;
    const target = document.querySelector('[data-focus="' + String(key).replace(/"/g, '\\"') + '"]');
    if (target) target.focus({ preventScroll: true });
  }

  // Лента дней плана длиннее экрана: выбранный чип подкручиваем в видимую
  // область без анимации, только если он вышел за край ленты.
  function revealFoodDay() {
    const strip = document.querySelector(".food-days");
    if (!strip) return;
    const chip = strip.querySelector('.food-day[aria-pressed="true"]');
    if (!chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    const visibleLeft = strip.scrollLeft;
    const visibleRight = visibleLeft + strip.clientWidth;
    if (left < visibleLeft || right > visibleRight) {
      chip.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
    }
  }

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    window.clearTimeout(toastTimer);
    node.textContent = message;
    node.classList.add("is-visible");
    toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    STATE.theme = next;
    document.documentElement.dataset.theme = next;
    const meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", next === "light" ? "#F6F5F3" : "#0E0F11");
    try {
      localStorage.setItem(App.util.THEME_KEY, next);
    } catch (error) {
      /* Storage may be unavailable; the session still keeps the theme. */
    }
  }

  // Кнопки темы на публичных экранах живут вне ре-рендера: правим их на месте,
  // чтобы фокус оставался на кнопке, а meta theme-color уже обновил applyTheme.
  function syncThemeControls() {
    const publicUi = App.publicUi;
    document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
      button.setAttribute("aria-pressed", STATE.theme === "light" ? "true" : "false");
      button.setAttribute("aria-label", publicUi.themeLabel());
      button.innerHTML = publicUi.themeIcon();
    });
  }

  /* ---------- workout dock ---------- */

  function syncDock() {
    const dock = document.getElementById("workout-dock");
    if (!dock) return;
    const cycleData = CYCLE.current();
    const session = CYCLE.findSession(cycleData, STATE.cycle.selected);
    const visible = currentRoute === "workouts"
      && STATE.cycle.tab === "current"
      && STATE.training.status === "active"
      && Boolean(session)
      && !CYCLE.isDone(cycleData, session.number);
    document.body.classList.toggle("has-dock", visible);
    dock.hidden = !visible;
    if (!visible) {
      dock.innerHTML = "";
      return;
    }
    const total = CYCLE.itemCount(session);
    const marked = CYCLE.itemDoneCount(cycleData, session);
    dock.innerHTML = `
      <div class="finish-dock">
        <button class="btn btn--primary" type="button" data-action="finish-workout" aria-label="Завершить тренировку ${session.number} из ${TRAININGS}. Отмечено ${marked} из ${total} ${plural(total, ["упражнение", "упражнения", "упражнений"])}">
          ${icon("check")}Завершить тренировку
        </button>
      </div>`;
  }

  function finishWorkout() {
    const cycleData = CYCLE.current();
    const session = CYCLE.findSession(cycleData, STATE.cycle.selected);
    if (STATE.training.status !== "active" || !session) return;
    if (CYCLE.isDone(cycleData, session.number)) return;
    STATE.cycle.done[session.number] = isoDate(NOW);
    session.blocks.forEach((block) => {
      block.items.forEach((item) => {
        STATE.cycle.itemDone[item.id] = true;
      });
    });
    const last = session.number >= TRAININGS;
    if (last) STATE.training.status = "completed";
    const next = CYCLE.nextSession(cycleData);
    STATE.cycle.selected = next ? next.number : session.number;
    if (last) {
      render("workouts", { focusKey: "cycle-tab-archive" });
      toast("Цикл завершён!");
      return;
    }
    render("workouts", { focus: "heading" });
    window.scrollTo(0, 0);
    toast(`Отличная работа! Тренировка ${session.number} из ${TRAININGS} выполнена`);
  }

  function undoSession() {
    const cycleData = CYCLE.current();
    const session = CYCLE.findSession(cycleData, STATE.cycle.selected);
    if (!session) return;
    delete STATE.cycle.done[session.number];
    session.blocks.forEach((block) => {
      block.items.forEach((item) => {
        delete STATE.cycle.itemDone[item.id];
      });
    });
    if (STATE.training.status === "completed") STATE.training.status = "active";
    render("workouts", { focusKey: "session-" + session.number });
  }

  /* ---------- подходы и комментарий клиента ---------- */

  // Правки клиента живут только в STATE.cycle.edits и никогда не меняют план.
  function sessionItem(itemId) {
    const cycleData = CYCLE.current();
    if (!CYCLE.isCurrent(cycleData)) return null;
    const session = CYCLE.findSession(cycleData, STATE.cycle.selected) ||
      CYCLE.findSession(cycleData, 1) || cycleData.sessions[0];
    if (!session) return null;
    let found = null;
    session.blocks.forEach((block) => {
      block.items.forEach((item) => {
        if (item.id === itemId) found = item;
      });
    });
    return found;
  }

  // Повторения: целое 1–999, для упражнений на время — 1–3600 секунд.
  function parseReps(value, isTime) {
    const raw = String(value).trim();
    if (!/^\d{1,4}$/.test(raw)) return null;
    const number = Number(raw);
    const max = isTime ? 3600 : 999;
    return number >= 1 && number <= max ? number : null;
  }

  // Вес: 0–500 с одним знаком после запятой или точки; пусто — «свой вес».
  function parseWeight(value) {
    const raw = String(value).trim().replace(",", ".");
    if (!raw) return null;
    if (!/^\d{1,3}(\.\d)?$/.test(raw)) return undefined;
    const number = Number(raw);
    return number >= 0 && number <= 500 ? number : undefined;
  }

  function weightField(weight) {
    return typeof weight === "number" && isFinite(weight) ? String(weight) : "";
  }

  function saveSetField(target) {
    const item = sessionItem(target.dataset.item);
    if (!item) return;
    const record = CYCLE.ensureEdit(item);
    const index = Number(target.dataset.set);
    const set = record.sets[index];
    if (!set) return;
    if (target.dataset.role === "set-reps") {
      const reps = parseReps(target.value, item.unit === "sec");
      // Некорректный ввод тихо возвращаем к сохранённому значению.
      if (reps === null) {
        target.value = String(set.reps);
        return;
      }
      set.reps = reps;
      target.value = String(reps);
      return;
    }
    const weight = parseWeight(target.value);
    if (weight === undefined) {
      target.value = weightField(set.weight);
      return;
    }
    set.weight = weight;
  }

  function saveComment(target) {
    const item = sessionItem(target.dataset.item);
    if (!item) return;
    const record = CYCLE.ensureEdit(item);
    record.comment = target.value.slice(0, 300);
  }

  function addSet(trigger) {
    const item = sessionItem(trigger.dataset.item);
    if (!item) return;
    const record = CYCLE.ensureEdit(item);
    if (record.sets.length >= DATA.maxSets) return;
    const last = record.sets[record.sets.length - 1] || { reps: 1, weight: null };
    record.sets.push({ reps: last.reps, weight: last.weight, added: true });
    render("workouts", {
      static: true,
      focusKey: "set-reps-" + item.id + "-" + (record.sets.length - 1)
    });
  }

  function removeSet(trigger) {
    const item = sessionItem(trigger.dataset.item);
    if (!item) return;
    const record = CYCLE.ensureEdit(item);
    const index = Number(trigger.dataset.set);
    // Удалять можно только подходы, добавленные клиентом.
    if (!record.sets[index] || !record.sets[index].added) return;
    record.sets.splice(index, 1);
    render("workouts", { static: true, focusKey: "add-set-" + item.id });
  }

  function toggleComment(trigger) {
    const item = sessionItem(trigger.dataset.item);
    if (!item) return;
    const open = STATE.cycle.commentOpen === item.id;
    STATE.cycle.commentOpen = open ? null : item.id;
    render("workouts", { static: true, focusKey: "comment-" + item.id });
  }

  /* ---------- демо: липкая панель ---------- */

  // Панель «Зарегистрироваться» появляется только после того, как первая
  // секция демо уехала за верх экрана: до этого кнопка и так видна в потоке.
  let demoObserver = null;

  function paintDemoBar(visible) {
    const bar = document.querySelector('[data-role="demo-bar"]');
    if (bar) bar.hidden = !visible;
  }

  function firstDemoSection() {
    return document.querySelector("#demo-workout") || document.querySelector(".pub-section");
  }

  function demoBarOnScroll() {
    const section = firstDemoSection();
    if (!section) return;
    paintDemoBar(section.getBoundingClientRect().bottom <= 0);
  }

  function syncDemoBar() {
    if (demoObserver) {
      demoObserver.disconnect();
      demoObserver = null;
    }
    window.removeEventListener("scroll", demoBarOnScroll);
    if (currentRoute !== "demo") {
      paintDemoBar(false);
      return;
    }
    const section = firstDemoSection();
    paintDemoBar(false);
    if (!section) return;
    // Старые WebView без IntersectionObserver получают проверку по скроллу.
    if (typeof window.IntersectionObserver !== "function") {
      window.addEventListener("scroll", demoBarOnScroll, { passive: true });
      demoBarOnScroll();
      return;
    }
    demoObserver = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        paintDemoBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
    }, { threshold: 0 });
    demoObserver.observe(section);
  }

  /* ---------- публичный вход ---------- */

  // Публичные формы живут вне клиентских обработчиков и на file:// без
  // preventDefault перезагружали бы страницу вместе с введёнными данными.
  const PUBLIC_FORMS = ["login", "register", "verify"];
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const CODE_LENGTH = 6;
  const RESEND_SECONDS = 30;

  function publicFieldError(form, name, message) {
    const wrapper = form ? form.querySelector(`.pub-field[data-field="${name}"]`) : null;
    if (!wrapper) return null;
    const input = wrapper.querySelector("input");
    const error = wrapper.querySelector(".field-error");
    wrapper.classList.toggle("is-invalid", !!message);
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
    return input;
  }

  // Демо-вход: проверяем формат и заполненность, но значения никуда не
  // сохраняем и не логируем — в сессии остаётся только этап "client".
  function submitLogin(form) {
    const emailInput = form.elements.email;
    const passwordInput = form.elements.password;
    const emailRaw = String((emailInput && emailInput.value) || "").trim();
    const passwordRaw = String((passwordInput && passwordInput.value) || "");
    let firstInvalid = null;
    if (!emailRaw) {
      publicFieldError(form, "login-email", "Введите почту.");
      firstInvalid = emailInput;
    } else if (!EMAIL_PATTERN.test(emailRaw)) {
      publicFieldError(form, "login-email", "Проверьте почту, например name@mail.ru.");
      firstInvalid = emailInput;
    } else {
      publicFieldError(form, "login-email", "");
    }
    if (!passwordRaw) {
      publicFieldError(form, "login-password", "Введите пароль.");
      if (!firstInvalid) firstInvalid = passwordInput;
    } else {
      publicFieldError(form, "login-password", "");
    }
    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: true });
      return;
    }
    App.auth.setStage("client");
    go("home");
    toast("Вы вошли в демо-кабинет");
  }

  /* ---------- регистрация, подтверждение, анкета ---------- */

  let resendTimer = 0;
  let resendLeft = 0;

  // Подсказка под паролем становится нейтральной галочкой, когда длина в норме.
  function updatePasswordHint(form) {
    const input = form.elements.password;
    const hint = form.querySelector('[data-role="pw-hint"]');
    if (!input || !hint) return;
    hint.classList.toggle("is-met", input.value.length >= 8);
  }

  // Почта и пароли остаются только в памяти страницы: ни логов, ни storage, ни URL.
  function submitRegister(form) {
    const emailInput = form.elements.email;
    const passwordInput = form.elements.password;
    const repeatInput = form.elements.password2;
    const consentInput = form.elements.consent;
    const emailRaw = String((emailInput && emailInput.value) || "").trim();
    const passwordRaw = String((passwordInput && passwordInput.value) || "");
    const repeatRaw = String((repeatInput && repeatInput.value) || "");
    let firstInvalid = null;
    if (!emailRaw) {
      publicFieldError(form, "register-email", "Введите почту.");
      firstInvalid = emailInput;
    } else if (!EMAIL_PATTERN.test(emailRaw)) {
      publicFieldError(form, "register-email", "Проверьте почту, например name@mail.ru.");
      firstInvalid = emailInput;
    } else {
      publicFieldError(form, "register-email", "");
    }
    if (passwordRaw.length < 8) {
      publicFieldError(form, "register-password", "Пароль должен быть не короче 8 символов.");
      if (!firstInvalid) firstInvalid = passwordInput;
    } else {
      publicFieldError(form, "register-password", "");
    }
    if (!repeatRaw) {
      publicFieldError(form, "register-password2", "Повторите пароль.");
      if (!firstInvalid) firstInvalid = repeatInput;
    } else if (repeatRaw !== passwordRaw) {
      publicFieldError(form, "register-password2", "Пароли не совпадают.");
      if (!firstInvalid) firstInvalid = repeatInput;
    } else {
      publicFieldError(form, "register-password2", "");
    }
    if (!consentInput || !consentInput.checked) {
      publicFieldError(form, "register-consent", "Отметьте согласие на обработку данных.");
      if (!firstInvalid) firstInvalid = consentInput;
    } else {
      publicFieldError(form, "register-consent", "");
    }
    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: true });
      return;
    }
    // После отправки пароли из формы убираем: они больше не нужны.
    if (passwordInput) passwordInput.value = "";
    if (repeatInput) repeatInput.value = "";
    updatePasswordHint(form);
    App.auth.setEmail(emailRaw);
    App.auth.setStage("verifying");
    go("verify");
  }

  function legalSheet(key) {
    const doc = DATA.legalDocs[key];
    if (!doc) return;
    openSheet({
      title: doc.title,
      bodyHtml: `
        <div class="contact-sheet">
          <p class="sheet-lead">${escapeHtml(doc.body)}</p>
          <button class="btn btn--ghost contact-sheet-cancel" type="button" data-action="close-sheet">Понятно</button>
        </div>`,
    });
  }

  // Отсчёт у кнопки повторной отправки: рисуем в разметку #/verify, живёт только там.
  function paintResend() {
    const button = document.querySelector('[data-role="resend"]');
    const timer = document.querySelector('[data-role="resend-timer"]');
    if (button) {
      button.disabled = resendLeft > 0;
      button.setAttribute("aria-disabled", String(resendLeft > 0));
    }
    if (timer) timer.textContent = resendLeft > 0 ? "через " + resendLeft + " с" : "";
  }

  function startResend() {
    window.clearInterval(resendTimer);
    resendLeft = RESEND_SECONDS;
    paintResend();
    resendTimer = window.setInterval(() => {
      resendLeft = resendLeft > 0 ? resendLeft - 1 : 0;
      if (!resendLeft) window.clearInterval(resendTimer);
      paintResend();
    }, 1000);
  }

  function stopResend() {
    window.clearInterval(resendTimer);
    resendTimer = 0;
    resendLeft = 0;
  }

  function codeFields(form) {
    return Array.prototype.slice.call(form.querySelectorAll(".code-input"));
  }

  function verifyError(message) {
    const error = document.getElementById("verify-error");
    if (!error) return;
    error.textContent = message || "";
    error.hidden = !message;
  }

  function fillCode(form, digits) {
    const fields = codeFields(form);
    fields.forEach((field, index) => {
      field.value = digits.charAt(index) || "";
    });
    const target = fields[Math.min(digits.length, fields.length - 1)];
    if (target) target.focus({ preventScroll: true });
  }

  function submitVerify(form) {
    const fields = codeFields(form);
    const code = fields.map((field) => field.value).join("");
    if (code.length < CODE_LENGTH) {
      verifyError("Введите все 6 цифр.");
      const empty = fields.find((field) => !field.value);
      if (empty) empty.focus({ preventScroll: true });
      return;
    }
    if (code !== DATA.demoCode) {
      verifyError("Неверный код");
      fillCode(form, "");
      return;
    }
    verifyError("");
    App.onboarding.reset();
    App.auth.setStage("onboarding");
    toast("Почта подтверждена");
    go("onboarding");
  }

  /* ---------- onboarding: шаги 1–3 и отправка анкеты ---------- */

  // Значения шага 1 живут только в памяти: STATE.onboarding.data.
  // Строки храним как введены (запятая в весе сохраняется), тренировки — числом.
  const ONBOARDING_FIELDS = ["name", "phone", "sex", "height", "weight", "targetWeight", "age", "goal", "sessionsPerWeek", "fitness", "activity", "limitations"];
  let limitationsBackup = "";

  function parseDecimal(raw) {
    const text = String(raw == null ? "" : raw).trim().replace(/\s+/g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(text)) return NaN;
    return Number(text);
  }

  // Поле «Желаемый вес» появляется только у целей «похудеть» и «набрать».
  // Переключаем атрибут hidden, а не перерисовываем шаг: фокус и прокрутка
  // остаются на месте, поле с уже введённой цифрой не теряется.
  function targetWeightAsked() {
    const goal = STATE.onboarding.data.goal;
    return goal === "lose" || goal === "gain";
  }

  function syncTargetWeightField() {
    const field = document.querySelector('#onboarding-form .pub-field[data-field="targetWeight"]');
    if (!field) return;
    field.hidden = !targetWeightAsked();
    if (field.hidden) publicFieldError(field.closest("form"), "targetWeight", "");
  }

  // Ввод не перерисовывает экран: обновляем состояние и живой текст, чтобы
  // не терять фокус и позицию прокрутки.
  function syncOnboardingDraft(target) {
    const data = STATE.onboarding.data;
    const name = target.name;
    const field = target.closest("[data-field]");
    if (!field || !name) return;
    if (target.type === "range") {
      data.sessionsPerWeek = Number(target.value);
      const label = field.querySelector('[data-role="sessions-value"]');
      if (label) {
        label.textContent = `${data.sessionsPerWeek} ${plural(data.sessionsPerWeek, DATA.questionnaire.sessionsPerWeek.forms)} в неделю`;
      }
    } else if (target.type === "radio") {
      if (!target.checked) return;
      data[name] = target.value;
      if (name === "goal") syncTargetWeightField();
    } else if (target instanceof HTMLTextAreaElement) {
      data.limitations = target.value;
    } else {
      data[name] = target.value;
    }
    publicFieldError(target.form || target.closest("form"), name, "");
  }

  function toggleNoLimitations(button) {
    const field = button.closest('[data-field="limitations"]');
    if (!field) return;
    const form = field.closest("form");
    const textarea = field.querySelector("textarea");
    const data = STATE.onboarding.data;
    const pressed = button.getAttribute("aria-pressed") === "true";
    if (pressed) {
      button.setAttribute("aria-pressed", "false");
      data.noLimitations = false;
      data.limitations = limitationsBackup;
      if (textarea) {
        textarea.disabled = false;
        textarea.value = limitationsBackup;
      }
      publicFieldError(form, "limitations", "");
      if (textarea) textarea.focus({ preventScroll: true });
      return;
    }
    limitationsBackup = data.limitations;
    button.setAttribute("aria-pressed", "true");
    data.noLimitations = true;
    data.limitations = "Нет ограничений";
    if (textarea) {
      textarea.value = "Нет ограничений";
      textarea.disabled = true;
    }
    publicFieldError(form, "limitations", "");
  }

  function clearOnboardingErrors(form) {
    ONBOARDING_FIELDS.forEach((key) => publicFieldError(form, key, ""));
  }

  // Проверки шага 1 живут отдельно от DOM: их нужно повторить и на шагах 2–3,
  // где форма анкеты уже не отрисована.
  function onboardingProblems() {
    const data = STATE.onboarding.data;
    const L = DATA.questionnaire.limits;
    const problems = [];
    const add = (key, message) => problems.push([key, message]);

    const name = String(data.name || "").trim();
    if (!name) add("name", "Введите имя.");
    else if (name.length < L.name.min) add("name", "Имя слишком короткое.");
    else if (name.length > L.name.max) add("name", "Слишком длинное имя.");

    const phone = String(data.phone || "").replace(/\D/g, "");
    if (!phone) add("phone", "Введите телефон.");
    else if (phone.length < L.phone.min || phone.length > L.phone.max) {
      add("phone", `Введите телефон: ${L.phone.min}–${L.phone.max} цифр.`);
    }

    if (!data.sex) add("sex", "Выберите пол.");

    const height = parseDecimal(data.height);
    if (!String(data.height || "").trim()) add("height", "Укажите рост.");
    else if (!isFinite(height)) add("height", "Рост указывается числом.");
    else if (height < L.height.min || height > L.height.max) add("height", `Рост — от ${L.height.min} до ${L.height.max} см.`);

    const weight = parseDecimal(data.weight);
    if (!String(data.weight || "").trim()) add("weight", "Укажите вес.");
    else if (!isFinite(weight)) add("weight", "Вес указывается числом.");
    else if (weight < L.weight.min || weight > L.weight.max) add("weight", `Вес — от ${L.weight.min} до ${L.weight.max} кг.`);

    // Желаемый вес спрашиваем только у целей «похудеть» и «набрать»:
    // у «поддерживать» целевой вес равен текущему, а поле скрыто.
    if (targetWeightAsked()) {
      const target = parseDecimal(data.targetWeight);
      if (!String(data.targetWeight || "").trim()) add("targetWeight", "Укажите желаемый вес.");
      else if (!isFinite(target)) add("targetWeight", "Желаемый вес указывается числом.");
      else if (target < L.targetWeight.min || target > L.targetWeight.max) {
        add("targetWeight", `Желаемый вес — от ${L.targetWeight.min} до ${L.targetWeight.max} кг.`);
      } else if (data.goal === "lose" && isFinite(weight) && target >= weight) {
        add("targetWeight", "Желаемый вес должен быть меньше текущего");
      } else if (data.goal === "gain" && isFinite(weight) && target <= weight) {
        add("targetWeight", "Желаемый вес должен быть больше текущего");
      }
    }

    const age = parseDecimal(data.age);
    if (!String(data.age || "").trim()) add("age", "Укажите возраст.");
    else if (!isFinite(age)) add("age", "Возраст указывается числом.");
    else if (age < L.age.min) add("age", L.age.minMessage);
    else if (age > L.age.max) add("age", `Возраст — до ${L.age.max} лет.`);

    if (!data.goal) add("goal", "Выберите цель.");

    const weeks = DATA.questionnaire.sessionsPerWeek;
    const sessions = Number(data.sessionsPerWeek);
    if (!isFinite(sessions) || sessions < weeks.min || sessions > weeks.max) {
      add("sessionsPerWeek", "Выберите число тренировок в неделю.");
    }

    if (!data.fitness) add("fitness", "Выберите уровень подготовки.");
    if (!data.activity) add("activity", "Выберите уровень активности.");

    // Ограничения — свободный текст и необязательное поле: пусто и при этом
    // не отмечено «Нет ограничений» — это тоже валидный ответ. Проверяем
    // только длину.
    const limitations = String(data.limitations || "").trim();
    if (limitations.length > L.limitations.max) add("limitations", `Не больше ${L.limitations.max} символов.`);

    return problems;
  }

  function validateOnboarding(form) {
    const problems = onboardingProblems();
    if (!form) return !problems.length;
    clearOnboardingErrors(form);
    problems.forEach((item) => publicFieldError(form, item[0], item[1]));
    if (!problems.length) return true;
    const first = problems[0][0];
    const invalid = form.querySelector(`.pub-field[data-field="${first}"] input, .pub-field[data-field="${first}"] textarea`);
    if (invalid) {
      invalid.focus({ preventScroll: true });
      invalid.scrollIntoView({ block: "center" });
    }
    return false;
  }

  function showOnboardingStep(step) {
    App.onboarding.setStep(step);
    render("onboarding", { focusSelector: "#onboarding-title", scrollTop: true });
  }

  function nextOnboardingStep() {
    const form = document.getElementById("onboarding-form");
    if (form) {
      const phoneField = form.querySelector('[data-field="phone"] input');
      const normalized = normalizePhone(STATE.onboarding.data.phone);
      STATE.onboarding.data.phone = normalized;
      if (phoneField) phoneField.value = normalized;
      if (!validateOnboarding(form)) return;
    }
    // В режиме правки шаг 2 недоступен: сразу к питанию или к сохранению.
    if (App.onboarding.isEditing()) {
      if (App.onboarding.hasNutrition()) showOnboardingStep(3);
      else saveQuestionnaire();
      return;
    }
    showOnboardingStep(App.onboarding.step() + 1);
  }

  // Сохранение правки анкеты: те же проверки, что при отправке, но без смены
  // стадии, статусов пакетов и выхода из кабинета.
  function saveQuestionnaire() {
    const form = document.getElementById("onboarding-form");
    if (form) {
      const phoneField = form.querySelector('[data-field="phone"] input');
      const normalized = normalizePhone(STATE.onboarding.data.phone);
      STATE.onboarding.data.phone = normalized;
      if (phoneField) phoneField.value = normalized;
      if (!validateOnboarding(form)) return;
    }
    if (App.onboarding.hasNutrition()) {
      if (!validateFood()) {
        if (App.onboarding.step() !== 3) showOnboardingStep(3);
        return;
      }
    }
    if (!App.onboarding.saveEdit()) return;
    // Новая анкета меняет норму калорий, а с ней и масштаб порций плана.
    if (App.plan) App.plan.invalidate();
    go("questionnaire");
    toast("Анкета обновлена");
  }

  function previousOnboardingStep() {
    showOnboardingStep(Math.max(1, App.onboarding.step() - 1));
  }

  // Выбор пакета: карточки-радио переключают STATE.onboarding.packages,
  // а от него зависят подпись шага, прогресс и главная кнопка.
  function pickPackage(value) {
    const packages = value === "both" ? ["training", "nutrition"] : value === "nutrition" ? ["nutrition"] : ["training"];
    const current = STATE.onboarding.packages;
    if (current.length === packages.length && current.every((item, index) => item === packages[index])) return;
    STATE.onboarding.packages = packages;
    // Фокус возвращаем на выбранную карточку: экран перерисовывается целиком.
    render("onboarding", { focusSelector: 'input[name="package"]:checked' });
  }

  // Отправка анкеты: 800 мс показываем «Отправляем…», затем фиксируем снимок
  // в памяти и открываем кабинет. Стадия "client" пишется в хранилище как раньше.
  function submitOnboarding(trigger) {
    if (App.onboarding.step() === 3) {
      // На шаге 3 формы нет: проверяем продукты, блюда и аллергии.
      if (!validateFood()) return;
    } else {
      const form = document.getElementById("onboarding-form");
      if (!validateOnboarding(form)) {
        if (!form) {
          showOnboardingStep(1);
          const stepOne = document.getElementById("onboarding-form");
          if (stepOne) validateOnboarding(stepOne);
        }
        return;
      }
    }
    if (trigger) {
      if (trigger.dataset.busy === "true") return;
      trigger.dataset.busy = "true";
      trigger.disabled = true;
      trigger.setAttribute("aria-busy", "true");
      trigger.textContent = "Отправляем…";
    }
    window.setTimeout(() => {
      App.state.submitForm();
      go("home");
      toast("Анкета отправлена Вадиму");
    }, 800);
  }

  /* ---------- onboarding: шаг 3 «Предпочтения в питании» ---------- */

  // Шаг 3 не перерисовывается на каждое нажатие: чипы, счётчики и живая
  // строка обновляются точечно, чтобы не терять фокус и позицию прокрутки.

  let allergiesBackup = "";

  function foodSelected(key) {
    const list = STATE.onboarding.data.foods[key];
    return Array.isArray(list) ? list : [];
  }

  function setFoodSelected(key, titles) {
    const foods = STATE.onboarding.data.foods;
    if (titles.length) foods[key] = titles;
    else delete foods[key];
  }

  function dishesPicked(group) {
    const off = STATE.onboarding.data.dishesOff[group.key] || [];
    return group.items.filter((title) => off.indexOf(title) === -1);
  }

  function setDishesOff(key, titles) {
    const map = STATE.onboarding.data.dishesOff;
    if (titles.length) map[key] = titles;
    else delete map[key];
  }

  function foodGroup(key) {
    return DATA.questionnaire.foodCatalog.filter((item) => item.key === key)[0] || null;
  }

  function dishGroup(key) {
    return DATA.questionnaire.dishes.filter((item) => item.key === key)[0] || null;
  }

  function setFoodError(id, message) {
    const error = document.getElementById(id);
    if (!error) return;
    error.textContent = message || "";
    error.hidden = !message;
  }

  function syncFoodTotals() {
    const foods = DATA.questionnaire.foodCatalog.reduce((sum, category) => sum + foodSelected(category.key).length, 0);
    const dishes = DATA.questionnaire.dishes.reduce((sum, group) => sum + dishesPicked(group).length, 0);
    const products = document.querySelector('[data-role="card-count-products"]');
    if (products) products.textContent = String(foods);
    const dishesChip = document.querySelector('[data-role="card-count-dishes"]');
    if (dishesChip) dishesChip.textContent = String(dishes);
    const line = document.getElementById("ob-selection");
    if (line) line.textContent = `Выбрано продуктов: ${foods} · блюд: ${dishes}`;
  }

  function syncFoodCounters(key) {
    const category = foodGroup(key);
    if (!category) return;
    const count = foodSelected(key).length;
    const chip = document.querySelector(`[data-role="cat-count-${key}"]`);
    if (chip) chip.textContent = `${count} из ${category.items.length}`;
    const req = document.querySelector(`[data-req="${key}"]`);
    if (req) req.hidden = !category.required || count > 0;
    if (count > 0) {
      setFoodError("onboarding-grains-error", "");
      const box = document.querySelector(`.ob-cat-head[data-cat="${key}"]`);
      if (box) box.closest(".ob-cat").classList.remove("is-invalid");
    }
    syncFoodTotals();
  }

  function syncDishCounters(key) {
    const group = dishGroup(key);
    if (!group) return;
    const picked = dishesPicked(group).length;
    const chip = document.querySelector(`[data-role="dish-count-${key}"]`);
    if (chip) chip.textContent = `${picked} из ${group.items.length}`;
    const req = document.querySelector(`[data-req="${key}"]`);
    if (req) req.hidden = !group.required || picked > 0;
    if (picked > 0) {
      // Ошибка снимается, когда во всех обязательных группах что-то осталось.
      const empty = DATA.questionnaire.dishes.filter((item) => item.required && !dishesPicked(item).length);
      if (!empty.length) setFoodError("onboarding-dishes-error", "");
      const box = document.querySelector(`.ob-cat-head[data-cat="${key}"]`);
      if (box) box.closest(".ob-cat").classList.remove("is-invalid");
    }
    syncFoodTotals();
  }

  function toggleFoodChip(input) {
    const key = input.dataset.group;
    const list = foodSelected(key).slice();
    const index = list.indexOf(input.value);
    if (input.checked && index === -1) list.push(input.value);
    if (!input.checked && index !== -1) list.splice(index, 1);
    setFoodSelected(key, list);
    syncFoodCounters(key);
  }

  function toggleDishChip(input) {
    const key = input.dataset.group;
    const off = (STATE.onboarding.data.dishesOff[key] || []).slice();
    const index = off.indexOf(input.value);
    if (input.checked && index !== -1) off.splice(index, 1);
    if (!input.checked && index === -1) off.push(input.value);
    setDishesOff(key, off);
    syncDishCounters(key);
  }

  function toggleSnackChip(input) {
    const data = STATE.onboarding.data;
    const list = data.snacks.slice();
    const index = list.indexOf(input.value);
    if (input.checked && index === -1) list.push(input.value);
    if (!input.checked && index !== -1) list.splice(index, 1);
    data.snacks = list;
  }

  function setCategoryAll(key, all) {
    const category = foodGroup(key);
    if (!category) return;
    setFoodSelected(key, all ? category.items.slice() : []);
    document.querySelectorAll(`.ob-pick-input[data-role="food"][data-group="${key}"]`).forEach((input) => {
      input.checked = all;
    });
    syncFoodCounters(key);
  }

  function setDishGroupAll(key, all) {
    const group = dishGroup(key);
    if (!group) return;
    setDishesOff(key, all ? [] : group.items.slice());
    document.querySelectorAll(`.ob-pick-input[data-role="dish"][data-group="${key}"]`).forEach((input) => {
      input.checked = all;
    });
    syncDishCounters(key);
  }

  function changeCookDays(button) {
    const key = button.dataset.meal;
    const C = DATA.questionnaire.cooking;
    const data = STATE.onboarding.data;
    const current = data.cookDays[key] || C.value;
    const next = Math.min(C.max, Math.max(C.min, current + Number(button.dataset.delta)));
    if (next === current) return;
    data.cookDays[key] = next;
    const value = document.querySelector(`[data-role="cook-value-${key}"]`);
    if (value) value.textContent = `${next} ${plural(next, C.forms)}`;
    const minus = document.querySelector(`[data-action="cook-step"][data-meal="${key}"][data-delta="-1"]`);
    const plus = document.querySelector(`[data-action="cook-step"][data-meal="${key}"][data-delta="1"]`);
    if (minus) minus.disabled = next <= C.min;
    if (plus) plus.disabled = next >= C.max;
  }

  function toggleCardPanel(button) {
    const panel = document.getElementById(`ob-panel-${button.dataset.card}`);
    if (!panel) return;
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", open ? "false" : "true");
    panel.hidden = open;
  }

  function toggleAccordion(button) {
    const key = button.dataset.cat;
    const panel = document.getElementById(`ob-cat-${key}`) || document.getElementById(`ob-dishes-${key}`);
    if (!panel) return;
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", open ? "false" : "true");
    panel.hidden = open;
  }

  // Живой поиск по всем продуктам: категории без совпадений скрываются,
  // найденные раскрываются; чипы фильтруются по названию.
  function filterFoods(query) {
    const text = String(query || "").trim().toLowerCase();
    const clear = document.querySelector('[data-action="food-search-clear"]');
    if (clear) clear.hidden = !text;
    let matches = 0;
    DATA.questionnaire.foodCatalog.forEach((category) => {
      const box = document.querySelector(`.ob-cat[data-cat="${category.key}"]`);
      const head = box && box.querySelector(".ob-cat-head");
      const panel = document.getElementById(`ob-cat-${category.key}`);
      if (!box || !head || !panel) return;
      const hits = category.items.filter((title) => title.toLowerCase().indexOf(text) !== -1).length;
      matches += hits;
      box.hidden = Boolean(text) && !hits;
      if (text) {
        head.setAttribute("aria-expanded", "true");
        panel.hidden = false;
      } else {
        const first = category.key === DATA.questionnaire.foodCatalog[0].key;
        head.setAttribute("aria-expanded", first ? "true" : "false");
        panel.hidden = !first;
      }
    });
    document.querySelectorAll('.ob-pick-input[data-role="food"]').forEach((input) => {
      const chip = input.closest(".ob-pick");
      if (chip) chip.hidden = Boolean(text) && input.value.toLowerCase().indexOf(text) === -1;
    });
    const empty = document.getElementById("ob-food-empty");
    if (empty) empty.hidden = !text || matches > 0;
  }

  function clearFoodSearch() {
    const input = document.getElementById("ob-food-search");
    if (input) {
      input.value = "";
      filterFoods("");
      input.focus({ preventScroll: true });
    }
  }

  function toggleNoAllergies(button) {
    const data = STATE.onboarding.data;
    const textarea = document.getElementById("onboarding-allergies");
    const field = document.querySelector('.pub-field[data-field="allergies"]');
    if (button.getAttribute("aria-pressed") === "true") {
      button.setAttribute("aria-pressed", "false");
      data.noAllergies = false;
      data.allergies = allergiesBackup;
      if (textarea) {
        textarea.disabled = false;
        textarea.value = allergiesBackup;
      }
      setFoodError("onboarding-allergies-error", "");
      if (field) field.classList.remove("is-invalid");
      if (textarea) textarea.focus({ preventScroll: true });
      return;
    }
    allergiesBackup = data.allergies;
    button.setAttribute("aria-pressed", "true");
    data.noAllergies = true;
    data.allergies = "Нет аллергий";
    if (textarea) {
      textarea.value = "Нет аллергий";
      textarea.disabled = true;
    }
    setFoodError("onboarding-allergies-error", "");
    if (field) field.classList.remove("is-invalid");
    if (textarea) textarea.setAttribute("aria-invalid", "false");
  }

  // Проверки шага 3: обязательные категории продуктов и блюда. Аллергии —
  // необязательное поле, у него проверяем только длину.
  function foodProblems() {
    const data = STATE.onboarding.data;
    const F = DATA.questionnaire.foodErrors;
    const problems = [];
    DATA.questionnaire.foodCatalog.forEach((category) => {
      if (category.required && !foodSelected(category.key).length) problems.push([`food:${category.key}`, F.grains]);
    });
    const emptyDishes = DATA.questionnaire.dishes.filter((group) => group.required && !dishesPicked(group).length);
    if (emptyDishes.length) problems.push([`dish:${emptyDishes[0].key}`, F.dishes]);
    const allergies = String(data.allergies || "").trim();
    if (allergies.length > DATA.questionnaire.allergies.max) {
      problems.push(["allergies", `Не больше ${DATA.questionnaire.allergies.max} символов.`]);
    }
    return problems;
  }

  function revealFoodProblem(key) {
    const parts = key.split(":");
    const kind = parts[0];
    const group = parts[1] || "";
    const card = kind === "dish" ? "dishes" : "products";
    const cardHead = document.querySelector(`.ob-card-head[data-card="${card}"]`);
    const cardPanel = document.getElementById(`ob-panel-${card}`);
    if (cardHead) cardHead.setAttribute("aria-expanded", "true");
    if (cardPanel) cardPanel.hidden = false;
    const head = document.querySelector(`.ob-cat-head[data-cat="${group}"]`);
    const panel = document.getElementById(kind === "dish" ? `ob-dishes-${group}` : `ob-cat-${group}`);
    if (head) {
      head.setAttribute("aria-expanded", "true");
      head.closest(".ob-cat").classList.add("is-invalid");
    }
    if (panel) panel.hidden = false;
    const error = document.getElementById(kind === "dish" ? "onboarding-dishes-error" : "onboarding-grains-error");
    if (error) error.scrollIntoView({ block: "center", behavior: "smooth" });
    if (head) head.focus({ preventScroll: true });
  }

  function validateFood() {
    ["onboarding-grains-error", "onboarding-dishes-error", "onboarding-allergies-error"].forEach((id) => setFoodError(id, ""));
    document.querySelectorAll(".ob-cat.is-invalid").forEach((box) => box.classList.remove("is-invalid"));
    const field = document.querySelector('.pub-field[data-field="allergies"]');
    const textarea = document.getElementById("onboarding-allergies");
    if (field) field.classList.remove("is-invalid");
    if (textarea) textarea.setAttribute("aria-invalid", "false");
    const problems = foodProblems();
    if (!problems.length) return true;
    problems.forEach((item) => {
      if (item[0].indexOf("food:") === 0) setFoodError("onboarding-grains-error", item[1]);
      else if (item[0].indexOf("dish:") === 0) setFoodError("onboarding-dishes-error", item[1]);
      else setFoodError("onboarding-allergies-error", item[1]);
    });
    if (problems[0][0] === "allergies") {
      if (field) field.classList.add("is-invalid");
      if (textarea) {
        textarea.setAttribute("aria-invalid", "true");
        textarea.focus({ preventScroll: true });
        textarea.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return false;
    }
    revealFoodProblem(problems[0][0]);
    return false;
  }

  /* ---------- measurement form ---------- */

  function fieldError(field, message) {
    const wrapper = document.querySelector(`.measure-field[data-field="${field.key}"]`);
    if (!wrapper) return;
    const input = wrapper.querySelector("input");
    const error = wrapper.querySelector(".field-error");
    wrapper.classList.toggle("is-invalid", !!message);
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
  }

  function readMeasurementForm(form) {
    const values = {};
    let firstInvalid = null;
    DATA.measurementFields.forEach((field) => {
      const input = form.elements[field.key];
      if (!input) return;
      const raw = String(input.value || "").trim();
      let message = "";
      let value = NaN;
      if (!raw) {
        message = "Укажите значение.";
      } else {
        value = Number(raw.replace(",", "."));
        if (!isFinite(value)) message = `Введите число, например ${one(field.min + 56.4)}.`;
        else if (value < field.min || value > field.max) message = `Допустимо от ${field.min} до ${field.max} ${field.unit}.`;
      }
      if (message) {
        fieldError(field, message);
        if (!firstInvalid) firstInvalid = input;
      } else {
        fieldError(field, "");
        values[field.key] = Math.round(value * 10) / 10;
      }
    });
    return { values, firstInvalid };
  }

  function saveMeasurements() {
    const form = document.getElementById("measure-form");
    if (!form) return;
    const result = readMeasurementForm(form);
    if (result.firstInvalid) {
      result.firstInvalid.focus();
      return;
    }
    MEASUREMENTS.save(result.values);
    STATE.reportFormOpen = false;
    STATE.reportShowAll = false;
    render("reports", { focusSelector: '[data-action="toggle-report-form"]' });
    toast("Замеры сохранены");
  }

  function updateDelta(input) {
    const field = DATA.measurementFields.find((item) => item.key === input.name);
    if (!field) return;
    const wrapper = input.closest(".measure-field");
    if (!wrapper) return;
    const delta = wrapper.querySelector("[data-delta]");
    if (!delta) return;
    const raw = String(input.value || "").trim().replace(",", ".");
    const value = Number(raw);
    const previous = MEASUREMENTS.latestValue(field.key);
    if (!raw || !isFinite(value) || previous === null || previous === undefined) {
      delta.hidden = true;
      delta.textContent = "";
      return;
    }
    const difference = Math.round((value - previous) * 10) / 10;
    delta.hidden = false;
    if (!difference) {
      delta.textContent = "Как в прошлый замер";
      delta.className = "field-delta";
      return;
    }
    delta.textContent = `${difference > 0 ? "▲" : "▼"} ${one(Math.abs(difference))} ${field.unit} к прошлому замеру`;
    delta.className = "field-delta is-changed";
  }

  /* ---------- sheets ---------- */

  function contactSheet() {
    const coach = DATA.coach;
    openSheet({
      title: "Связаться с Вадимом",
      bodyHtml: `
        <div class="contact-sheet">
          <p class="sheet-lead">Вадим на связи в течение дня. Выберите удобный способ.</p>
          <div class="contact-sheet-list">
            <a class="contact-sheet-row" href="tel:${coach.phone}">
              <span class="contact-sheet-icon">${icon("phone")}</span>
              <span class="contact-sheet-copy"><strong>Позвонить</strong><span>${escapeHtml(coach.phoneDisplay)}</span></span>
              <span class="contact-sheet-chevron" aria-hidden="true">${icon("chevron-right")}</span>
            </a>
            <a class="contact-sheet-row" href="${coach.telegramUrl}" target="_blank" rel="noopener noreferrer">
              <span class="contact-sheet-icon">${icon("send")}</span>
              <span class="contact-sheet-copy"><strong>Написать в Telegram</strong><span>${escapeHtml(coach.telegramHandle)}</span></span>
              <span class="contact-sheet-chevron" aria-hidden="true">${icon("chevron-right")}</span>
            </a>
          </div>
          <button class="btn btn--ghost contact-sheet-cancel" type="button" data-action="close-sheet">Отмена</button>
        </div>`,
    });
  }

  function logoutSheet() {
    openSheet({
      title: "Выйти из аккаунта?",
      bodyHtml: `
        <div class="contact-sheet">
          <p class="sheet-lead">Кабинет закроется на этом устройстве. Замеры и прогресс останутся, пока вы не сбросите демо-данные.</p>
          <div class="sheet-actions">
            <button class="btn btn--primary" type="button" data-action="logout-confirm">Выйти</button>
            <button class="btn btn--ghost" type="button" data-action="close-sheet">Отмена</button>
          </div>
        </div>`,
    });
  }

  // Индекс дня плана: всё, что приходит из data-атрибутов, приводим к 0..LENGTH-1,
  // чтобы правка не улетела за пределы тридцати дней.
  function planDay(value, fallback) {
    const length = App.plan ? App.plan.LENGTH : DATA.planDays;
    const index = Math.floor(Number(value));
    if (!Number.isFinite(index)) return typeof fallback === "number" ? fallback : 0;
    return Math.min(Math.max(0, index), length - 1);
  }

  // Рецепт берётся из каталога, а граммы, калории и макросы — из самого блюда:
  // в js/recipes.js чисел нет, чтобы они не разошлись с меню. План масштабирует
  // граммы, поэтому сначала ищем блюдо в плане, а демо-кабинету оставляем
  // шаблоны как есть.
  function findDish(dayIndex, name) {
    const days = [];
    if (currentRoute !== "demo" && App.plan) {
      days.push(App.plan.menu(dayIndex), App.plan.menu(STATE.foodDay));
      for (let index = 0; index < App.plan.LENGTH; index += 1) days.push(App.plan.menu(index));
    }
    for (const day of days.concat(DATA.menus)) {
      if (!day) continue;
      for (const dishes of day) {
        const dish = dishes.find((item) => item.n === name);
        if (dish) return dish;
      }
    }
    return null;
  }

  function openRecipeSheet(name, dish) {
    const entry = App.recipes ? App.recipes.get(name) : null;
    const target = dish && dish.n === name ? dish : findDish(0, name);
    const dishName = escapeHtml(name);
    if (!entry) {
      openSheet({
        title: "Рецепт",
        bodyHtml: `
          <div class="recipe-sheet">
            <p class="recipe-name">${dishName}</p>
            ${target ? `<p class="recipe-facts">≈ ${num(target.g)} г · ${num(target.k)} ккал</p>` : ""}
            <p class="recipe-foot">Рецепт скоро появится.</p>
            <button class="btn btn--ghost contact-sheet-cancel" type="button" data-action="close-sheet">Закрыть</button>
          </div>`,
      });
      return;
    }
    // Состав каталога — на базовую порцию, а в плане граммы масштабированы:
    // множитель держит строки состава в согласии с итогом «≈ N г» над списком.
    const base = entry.ingredients.reduce((total, item) => total + item.g, 0);
    const factor = target && base > 0 ? target.g / base : 1;
    const ingredientGrams = (value) => {
      const scaled = value * factor;
      return scaled >= 25 ? Math.round(scaled / 5) * 5 : Math.max(1, Math.round(scaled));
    };
    const ingredients = entry.ingredients.map((item) => `
      <div class="recipe-row"><span>${escapeHtml(item.n)}</span><span>${num(ingredientGrams(item.g))} г</span></div>`).join("");
    const steps = entry.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
    openSheet({
      title: "Рецепт",
      bodyHtml: `
        <div class="recipe-sheet">
          <p class="recipe-name">${dishName}</p>
          <p class="recipe-facts">≈ ${num(target.g)} г · ${num(target.k)} ккал · ${entry.time} мин</p>
          <p class="recipe-macros">Б ${one(target.p)} · Ж ${one(target.f)} · У ${one(target.c)}</p>
          <h3 class="recipe-title">Состав</h3>
          <div class="recipe-list">${ingredients}</div>
          <h3 class="recipe-title">Как готовить</h3>
          <ol class="recipe-steps">${steps}</ol>
          ${entry.note ? `<p class="recipe-note">${escapeHtml(entry.note)}</p>` : ""}
          <p class="recipe-foot">Граммы подобраны под твою норму калорий.</p>
          <button class="btn btn--ghost contact-sheet-cancel" type="button" data-action="close-sheet">Закрыть</button>
        </div>`,
    });
  }

  function editContactsSheet() {
    openSheet({
      title: "Контакты",
      bodyHtml: `
        <form class="contact-form" data-form="contacts" novalidate>
          <p class="sheet-lead">Эти контакты видит Вадим. Они не отображаются другим клиентам.</p>
          <div class="measure-field" data-field="phone">
            <label for="contact-phone">Телефон</label>
            <input class="input" id="contact-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${escapeHtml(STATE.profile.phone)}">
            <p class="field-error" hidden></p>
          </div>
          <div class="measure-field" data-field="email">
            <label for="contact-email">Почта</label>
            <input class="input" id="contact-email" name="email" type="email" inputmode="email" autocomplete="email" value="${escapeHtml(STATE.profile.email)}">
            <p class="field-error" hidden></p>
          </div>
          <div class="sheet-actions">
            <button class="btn btn--primary" type="submit">Сохранить</button>
            <button class="btn btn--ghost" type="button" data-action="close-sheet">Отмена</button>
          </div>
        </form>`,
    });
  }

  function normalizePhone(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 11 && (digits.charAt(0) === "7" || digits.charAt(0) === "8")) {
      const rest = "7" + digits.slice(1);
      return `+7 ${rest.slice(1, 4)} ${rest.slice(4, 7)}-${rest.slice(7, 9)}-${rest.slice(9, 11)}`;
    }
    return String(raw || "").trim();
  }

  function saveContacts(form) {
    const phoneField = { key: "phone" };
    const emailField = { key: "email" };
    const phoneInput = form.elements.phone;
    const emailInput = form.elements.email;
    const phoneRaw = String((phoneInput && phoneInput.value) || "").trim();
    const emailRaw = String((emailInput && emailInput.value) || "").trim();
    const digits = phoneRaw.replace(/\D/g, "");
    let firstInvalid = null;
    if (digits.length < 10 || digits.length > 15) {
      fieldError(phoneField, "Введите телефон: 10–15 цифр.");
      firstInvalid = phoneInput;
    } else {
      fieldError(phoneField, "");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw)) {
      fieldError(emailField, "Введите почту, например name@mail.ru.");
      if (!firstInvalid) firstInvalid = emailInput;
    } else {
      fieldError(emailField, "");
    }
    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: true });
      return;
    }
    STATE.profile.phone = normalizePhone(phoneRaw);
    STATE.profile.email = emailRaw;
    PROFILE.save();
    closeSheet();
    if (currentRoute === "profile") render("profile", { static: true, focusKey: "edit-contacts" });
    toast("Контакты сохранены");
  }

  function legendSheet() {
    openSheet({
      title: "Обозначения в таблице",
      bodyHtml: `
        <div class="contact-sheet">
          <p class="sheet-lead">Как читать таблицу упражнений.</p>
          <dl class="legend-list">
            ${DATA.tableLegend.map((row) => `
              <div class="legend-row">
                <dt>${escapeHtml(row.term)}</dt>
                <dd>${escapeHtml(row.text)}</dd>
              </div>`).join("")}
          </dl>
          <button class="btn btn--ghost contact-sheet-cancel" type="button" data-action="close-sheet">Понятно</button>
        </div>`,
    });
  }

  function installSheet() {
    const coach = DATA.coach;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const android = /Android/.test(navigator.userAgent);
    const promptButton = installPrompt
      ? `<button class="btn btn--primary install-submit" type="button" data-action="install-confirm">${icon("install")}Установить</button>`
      : "";
    const iosBlock = `
      <div class="install-block">
        <span class="install-block-icon">${icon("share")}</span>
        <div><h3>Safari на iPhone и iPad</h3>
        <ol><li>Откройте сайт в Safari.</li><li>Нажмите «Поделиться».</li><li>Выберите «На экран Домой».</li></ol></div>
      </div>`;
    const androidBlock = `
      <div class="install-block">
        <span class="install-block-icon">${icon("install")}</span>
        <div><h3>Chrome на Android</h3>
        <ol><li>Откройте меню ⋮.</li><li>Выберите «Добавить на главный экран» или «Установить приложение».</li></ol></div>
      </div>`;
    const primaryBlock = ios ? iosBlock : android ? androidBlock : androidBlock;
    const otherBlock = ios ? androidBlock : iosBlock;
    const other = `<details class="install-other"><summary>Другое устройство</summary>${otherBlock}</details>`;
    openSheet({
      title: "Добавить на главный экран",
      bodyHtml: `
        <div class="install-sheet">
          <p class="sheet-lead">Trenio открывается в одно касание и работает как обычное приложение.</p>
          ${promptButton}
          ${promptButton ? "" : primaryBlock}
          ${other}
          <p class="install-note">${icon("info")}Данные хранятся только на этом устройстве.</p>
          <button class="btn btn--ghost" type="button" data-action="close-sheet">Понятно</button>
        </div>`,
    });
  }

  async function confirmInstall() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      closeSheet();
      if (choice && choice.outcome === "accepted") toast("Приложение установлено");
    } catch (error) {
      toast("Не удалось открыть установку");
    }
  }

  /* ---------- sharing ---------- */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      /* Clipboard API can be unavailable on file://. */
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    area.remove();
    return copied;
  }

  async function shareApp() {
    const url = location.protocol === "file:" ? location.href.split("#")[0] : location.origin + location.pathname;
    const payload = {
      title: "Trenio — фитнес тренер Вадим",
      text: "Тренировки, питание и прогресс в одном приложении",
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
    const copied = await copyText(url);
    toast(copied ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
  }

  /* ---------- avatar ---------- */

  function pickAvatar() {
    const input = document.getElementById("avatar-input");
    if (input) input.click();
  }

  function handleAvatar(file) {
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      toast("Выберите изображение");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Файл больше 5 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          toast("Не удалось обработать фото");
          return;
        }
        const side = Math.min(image.width, image.height);
        if (!side) {
          toast("Не удалось обработать фото");
          return;
        }
        context.drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size
        );
        try {
          STATE.profile.avatar = canvas.toDataURL("image/jpeg", 0.85);
        } catch (error) {
          toast("Не удалось обработать фото");
          return;
        }
        PROFILE.save();
        syncProfileChrome();
        if (currentRoute === "profile") {
          render("profile", { static: true, focusSelector: '[data-action="pick-avatar"]' });
        }
        toast("Фото обновлено");
      };
      image.onerror = () => toast("Не удалось открыть изображение");
      image.src = String(reader.result || "");
    };
    reader.onerror = () => toast("Не удалось прочитать файл");
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    if (!STATE.profile.avatar) return;
    STATE.profile.avatar = "";
    PROFILE.save();
    syncProfileChrome();
    if (currentRoute === "profile") render("profile", { static: true, focusSelector: '[data-action="pick-avatar"]' });
    toast("Фото удалено");
  }

  /* ---------- кабинет тренера ---------- */

  // Поиск и фильтр — состояние прототипа в памяти. Перерисовка статичная:
  // анимации не перезапускаются, фокус возвращается на тот же элемент.
  function applyCoachQuery(value) {
    STATE.coachQuery = String(value || "");
    render("coach", { static: true, focusKey: "coach-search" });
    const input = document.querySelector("[data-coach-search]");
    if (!input) return;
    const end = input.value.length;
    try {
      input.setSelectionRange(end, end);
    } catch (error) {
      return;
    }
  }

  function setCoachFilter(key) {
    const known = App.coach.filters.some((filter) => filter.key === key);
    if (!known) return;
    STATE.coachFilter = key;
    render("coach", { static: true, focusKey: "coach-filter-" + key });
  }

  // Выбранный клиент — только в памяти: id не попадает в URL, storage или
  // снимок анкеты. Тренерская карточка читает исключительно фикстуры.
  function coachClient() {
    const id = STATE.coachClientId;
    return id ? App.coach.find(id) : null;
  }

  // День программы текущего клиента: id дня живёт в памяти и сверяется с
  // программой клиента — день другого клиента после смены не открывается.
  function coachTrainingDay(client) {
    if (!client || !STATE.coachProgramDayId) return null;
    // editDay() видит и день из черновика программы: только что добавленный
    // день наполняется упражнениями до сохранения всей программы.
    return App.coach.editDay(client.id, STATE.coachProgramDayId);
  }

  function openCoachClient(id) {
    const client = App.coach.find(id);
    if (!client) return;
    STATE.coachClientId = client.id;
    // Карточка всегда открывается в просмотре: чужой черновик редактора
    // не переезжает на другого клиента.
    STATE.coachMode = "view";
    STATE.coachDraft = null;
    STATE.coachProgramDayId = null;
    STATE.coachProgramMode = "view";
    STATE.coachProgramDraft = null;
    STATE.coachPicker = { open: false, query: "", group: "all" };
    STATE.coachNormDraft = null;
    STATE.coachNormErrors = {};
    go("coach-client");
  }

  // Режим карточки и черновик редактора — только в памяти: правки не попадают
  // ни в storage, ни в URL и исчезают после перезагрузки.
  function setCoachMode(mode) {
    if (mode === "edit") {
      const client = coachClient();
      if (!client) return;
      STATE.coachMode = "edit";
      STATE.coachDraft = App.coach.draft(client);
      render("coach-client", { static: true, focusKey: "coach-target-weight" });
      return;
    }
    // Возврат в просмотр и отмена ничего не сохраняют.
    STATE.coachMode = "view";
    STATE.coachDraft = null;
    render("coach-client", {
      static: true,
      focusKey: mode === "cancel" ? "coach-mode-edit" : "coach-mode-view",
    });
  }

  function coachFieldNode(field) {
    return document.querySelector('[data-coach-field="' + String(field) + '"]');
  }

  function coachFieldError(field, message) {
    const input = coachFieldNode(field);
    if (!input) return;
    const holder = input.closest(".coach-field") || input.parentElement;
    let box = holder ? holder.querySelector('[data-coach-error="' + field + '"]') : null;
    if (!message) {
      if (box) box.remove();
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      return;
    }
    if (!box && holder) {
      box = document.createElement("p");
      box.className = "coach-error";
      box.id = "coach-error-" + field;
      box.setAttribute("role", "alert");
      box.setAttribute("data-coach-error", field);
      holder.appendChild(box);
    }
    if (!box) return;
    box.innerHTML = '<span class="coach-error-icon" aria-hidden="true">!</span>' + escapeHtml(message);
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", box.id);
  }

  // Объёма тренировок здесь нет: он считается из программы клиента.
  const COACH_FIELDS = ["targetWeight", "note", "nutritionTotal"];

  function showCoachErrors(check) {
    COACH_FIELDS.forEach((field) => coachFieldError(field, check.errors[field] || ""));
    const first = COACH_FIELDS.filter((field) => check.errors[field])[0];
    if (!first) return;
    const input = coachFieldNode(first);
    if (!input) return;
    // Фокус ставим на месте: повторный рендер потерял бы каретку в поле.
    input.focus({ preventScroll: true });
    if (typeof input.scrollIntoView === "function") {
      input.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }

  function coachCounterText(note) {
    return String(note || "").length + " / " + App.coach.limits.noteMax;
  }

  function sameCoachDraft(a, b) {
    if (!a || !b) return false;
    return (
      a.targetWeight === b.targetWeight &&
      a.note === b.note &&
      a.nutritionTotal === b.nutritionTotal
    );
  }

  // Кнопка сохранения активна только когда черновик отличается от исходных
  // значений. Невалидный черновик проверяется при отправке: так ошибки видны
  // под полями, а не спрятаны за неактивной кнопкой.
  function syncCoachSave() {
    const form = document.querySelector("[data-coach-form]");
    const client = coachClient();
    if (!form || !client || !STATE.coachDraft) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    const same = sameCoachDraft(STATE.coachDraft, App.coach.draft(client));
    button.disabled = same;
    button.setAttribute("aria-disabled", String(same));
    const bar = form.closest(".coach-savebar");
    if (bar) bar.classList.toggle("is-dirty", !same);
  }

  function syncCoachField(field) {
    if (!STATE.coachDraft) {
      const client = coachClient();
      if (!client) return;
      STATE.coachDraft = App.coach.draft(client);
    }
    const input = coachFieldNode(field);
    if (!input) return;
    STATE.coachDraft[field] = input.value;
    coachFieldError(field, "");
    if (field === "note") {
      const counter = document.querySelector("[data-coach-counter]");
      if (counter) counter.textContent = coachCounterText(input.value);
    }
    syncCoachSave();
  }

  function submitCoachForm() {
    const client = coachClient();
    if (!client) return;
    if (!STATE.coachDraft) STATE.coachDraft = App.coach.draft(client);
    const check = App.coach.validate(client, STATE.coachDraft);
    if (!check.ok) {
      showCoachErrors(check);
      return;
    }
    App.coach.apply(client.id, STATE.coachDraft);
    STATE.coachMode = "view";
    STATE.coachDraft = null;
    toast("Сохранено. Правки действуют до перезагрузки");
    render("coach-client", { static: true, focusKey: "coach-client-title" });
  }

  /* ---------- норма питания клиента (КБЖУ) ---------- */

  // Черновик формы нормы живёт только на своём экране: уход его бросает,
  // сохранённая норма остаётся в памяти. Обнуляет черновик render().
  function normDraft() {
    const client = coachClient();
    if (!client) return null;
    if (!STATE.coachNormDraft) STATE.coachNormDraft = App.coach.normDraft(client.id);
    return STATE.coachNormDraft;
  }

  function normFieldNode(field) {
    return document.querySelector('[data-norm-field="' + String(field) + '"]');
  }

  // Ошибки нормы вставляет app.js, как у карточки и дня: вью рисует поля,
  // тексты и aria-связки ставятся здесь.
  function normFieldError(field, message) {
    const text = String(field);
    const input = normFieldNode(text);
    const holder = input ? input.closest(".coach-field") || input.parentElement : null;
    if (!holder) return;
    let box = holder.querySelector('[data-norm-error="' + text + '"]');
    if (!message) {
      if (box) box.remove();
      if (input) {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
      }
      return;
    }
    if (!box) {
      box = document.createElement("p");
      box.className = "coach-error";
      box.id = "coach-norm-error-" + text;
      box.setAttribute("role", "alert");
      box.setAttribute("data-norm-error", text);
      holder.appendChild(box);
    }
    box.innerHTML = '<span class="coach-error-icon" aria-hidden="true">!</span>' + escapeHtml(message);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", box.id);
    }
  }

  function clearNormErrors() {
    document.querySelectorAll("[data-norm-error]").forEach((node) => node.remove());
    document.querySelectorAll("[data-norm-field][aria-invalid]").forEach((input) => {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
  }

  function showNormErrors(check) {
    clearNormErrors();
    const errors = check.errors || {};
    Object.keys(errors).forEach((field) => normFieldError(field, errors[field]));
    const first = Object.keys(errors)[0];
    const input = first ? normFieldNode(first) : null;
    if (!input) return;
    input.focus({ preventScroll: true });
    if (typeof input.scrollIntoView === "function") {
      input.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }

  // Производные подписи — граммы на кг, сумма БЖУ и расхождение с
  // калорийностью — пересчитываются прямо в DOM: полная отрисовка на каждом
  // вводе сбивала бы каретку.
  function syncNormOutputs(draftValue, client) {
    const derived = App.coach.normDerived(draftValue, client);
    const write = (key, text) => {
      document.querySelectorAll('[data-norm-out="' + key + '"]').forEach((node) => {
        node.textContent = text;
      });
    };
    write("perKgProtein", one(derived.perKg.protein));
    write("perKgFat", one(derived.perKg.fat));
    write("perKgCarbs", one(derived.perKg.carbs));
    write("sum", num(derived.macroKcal) + " ккал");
    const diff = derived.diff;
    write("diff", (diff > 0 ? "+" : diff < 0 ? "−" : "") + num(Math.abs(diff)) + " ккал");
    const hint = document.querySelector("[data-norm-diff-hint]");
    if (hint) hint.hidden = Math.abs(diff) <= 60;
  }

  // «Сохранить» активна, пока черновик отличается от действующей нормы:
  // невалидный черновик ловит отправка, чтобы ошибки были видны под полями.
  function syncNormSave() {
    const form = document.querySelector("[data-norm-form]");
    const client = coachClient();
    const draftValue = STATE.coachNormDraft;
    if (!form || !client || !draftValue) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    const same = App.coach.sameNormDraft(draftValue, App.coach.normDraft(client.id));
    button.disabled = same;
    button.setAttribute("aria-disabled", String(same));
    const bar = form.querySelector(".coach-savebar");
    if (bar) bar.classList.toggle("is-dirty", !same);
  }

  // Пересчёт связывает три уровня: калорийность, граммы и доли. Поле под
  // курсором не переписываем — иначе каретка прыгнет в середину числа.
  function syncNormField(input) {
    const client = coachClient();
    const draftValue = normDraft();
    if (!client || !draftValue) return;
    const field = input.getAttribute("data-norm-field");
    draftValue[field] = input.value;
    const next = App.coach.recalcNorm(draftValue, field);
    Object.keys(next).forEach((key) => {
      draftValue[key] = next[key];
      if (key === field) return;
      const node = normFieldNode(key);
      if (node && node.value !== next[key]) node.value = next[key];
    });
    normFieldError(field, "");
    syncNormOutputs(draftValue, client);
    syncNormSave();
  }

  function submitNormForm() {
    const client = coachClient();
    if (!client) return;
    const draftValue = normDraft();
    if (!draftValue) return;
    const check = App.coach.validateNorm(client, draftValue);
    if (!check.ok) {
      showNormErrors(check);
      return;
    }
    App.coach.applyNorm(client.id, draftValue);
    STATE.coachNormDraft = null;
    STATE.coachNormErrors = {};
    toast("Норма сохранена. Правка действует до перезагрузки");
    render("coach-nutrition", { static: true, focusKey: "coach-nutrition-title" });
  }

  /* ---------- дни питания клиента ---------- */

  // Черновик дня питания: живёт только на экране #/coach-food, уход его
  // бросает (см. render), сохранённые дни остаются в памяти.
  function foodDraft() {
    const client = coachClient();
    if (!client) return null;
    const dayNo = STATE.coachFoodDayNo;
    if (!STATE.coachFoodDraft || STATE.coachFoodDraft.dayNo !== dayNo) {
      STATE.coachFoodDraft = App.coach.foodDayDraft(client.id, dayNo);
    }
    return STATE.coachFoodDraft;
  }

  function clearFoodErrors() {
    document.querySelectorAll("[data-food-error]").forEach((node) => node.remove());
  }

  // Ошибка дня одна и живёт над списком блюд: у выбора блюд нет поля ввода.
  function showFoodErrors(check) {
    clearFoodErrors();
    const box = document.querySelector("[data-food-errors]");
    if (!box) return;
    const message = check.errors.dishes;
    if (message) {
      const line = document.createElement("p");
      line.className = "coach-error";
      line.id = "coach-food-error";
      line.setAttribute("role", "alert");
      line.setAttribute("data-food-error", "dishes");
      line.innerHTML = '<span class="coach-error-icon" aria-hidden="true">!</span>' + escapeHtml(message);
      box.appendChild(line);
    }
    const first = document.querySelector('[data-action="coach-dish-add"]');
    if (first) first.focus({ preventScroll: true });
  }

  function syncFoodSave() {
    const form = document.querySelector("[data-food-form]");
    const client = coachClient();
    const draftValue = STATE.coachFoodDraft;
    if (!form || !client || !draftValue) return;
    const button = form.querySelector("[data-food-save]");
    if (!button) return;
    const same = App.coach.sameFoodDraft(
      draftValue,
      App.coach.foodDayDraft(client.id, draftValue.dayNo)
    );
    button.disabled = same;
    button.setAttribute("aria-disabled", String(same));
    const bar = form.querySelector(".coach-savebar");
    if (bar) bar.classList.toggle("is-dirty", !same);
  }

  function submitFoodForm() {
    const client = coachClient();
    if (!client) return;
    const draftValue = foodDraft();
    if (!draftValue) return;
    const check = App.coach.validateFoodDay(draftValue);
    if (!check.ok) {
      showFoodErrors(check);
      return;
    }
    App.coach.applyFoodDay(client.id, draftValue.dayNo, draftValue);
    STATE.coachFoodDraft = null;
    toast("День питания сохранён (до перезагрузки)");
    render("coach-food", { static: true, focusKey: "coach-food-days" });
  }

  function addFoodDish(name) {
    const client = coachClient();
    const draftValue = foodDraft();
    if (!client || !draftValue) return;
    if (draftValue.dishes.indexOf(name) !== -1) return;
    if (draftValue.dishes.length >= App.coach.foodDayLimits.dishesMax) {
      toast("В дне не больше " + App.coach.foodDayLimits.dishesMax + " блюд");
      return;
    }
    draftValue.dishes.push(name);
    // Фокус остаётся на кнопке каталога: список добавленных растёт ниже и
    // уже не прыгает. Клавиатурой можно добавить несколько блюд подряд.
    render("coach-food", { static: true, focusKey: "coach-food-pick-" + name });
  }

  function removeFoodDish(name) {
    const draftValue = foodDraft();
    if (!draftValue) return;
    const index = draftValue.dishes.indexOf(name);
    if (index === -1) return;
    draftValue.dishes.splice(index, 1);
    render("coach-food", { static: true, focusKey: "coach-food-pick-" + name });
  }

  /* ---------- редактор тренировочного дня ---------- */

  const DAY_FIELDS = ["sets", "reps", "weight", "tempo", "rest"];

  function coachDay() {
    const client = coachClient();
    return client ? coachTrainingDay(client) : null;
  }

  // Черновик дня живёт в памяти и создаётся лениво — как черновик карточки.
  function dayDraft() {
    const day = coachDay();
    if (!day) return null;
    if (!STATE.coachProgramDraft) STATE.coachProgramDraft = App.coach.dayDraft(day);
    return STATE.coachProgramDraft;
  }

  function dayFieldNode(key) {
    const text = String(key);
    const cut = text.lastIndexOf("-");
    if (cut === -1) return document.querySelector('[data-day-field="' + text + '"]');
    const field = text.slice(0, cut);
    const index = text.slice(cut + 1);
    return document.querySelector('[data-day-field="' + field + '"][data-item="' + index + '"]');
  }

  // Ошибки дня, как и ошибки карточки, вставляет app.js: у ключа "exercises"
  // нет поля ввода, поэтому он живёт в общем контейнере над списком.
  function dayFieldError(key, message) {
    const text = String(key);
    const input = dayFieldNode(text);
    const holder = input
      ? input.closest(".coach-day-field") || input.parentElement
      : document.querySelector("[data-day-errors]");
    if (!holder) return;
    let box = holder.querySelector('[data-day-error="' + text + '"]');
    if (!message) {
      if (box) box.remove();
      if (input) {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
      }
      return;
    }
    if (!box) {
      box = document.createElement("p");
      box.className = "coach-error";
      box.id = "coach-day-error-" + text;
      box.setAttribute("role", "alert");
      box.setAttribute("data-day-error", text);
      holder.appendChild(box);
    }
    box.innerHTML = '<span class="coach-error-icon" aria-hidden="true">!</span>' + escapeHtml(message);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", box.id);
    }
  }

  function clearDayErrors() {
    document.querySelectorAll("[data-day-error]").forEach((node) => node.remove());
    document.querySelectorAll("[data-day-field][aria-invalid]").forEach((input) => {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
  }

  function showDayErrors(check) {
    clearDayErrors();
    const errors = check.errors || {};
    Object.keys(errors).forEach((key) => dayFieldError(key, errors[key]));
    const first = Object.keys(errors)[0];
    if (!first) return;
    const input = dayFieldNode(first);
    const target =
      input ||
      document.querySelector("[data-picker-search]") ||
      document.querySelector('[data-action="coach-picker-toggle"]');
    if (!target) return;
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }

  // Черновик и сохранённый день собирает один App.coach.dayDraft, поэтому
  // порядок ключей совпадает и сравнение сериализацией корректно.
  function syncDaySave() {
    const form = document.querySelector("[data-day-form]");
    const day = coachDay();
    if (!form || !day || !STATE.coachProgramDraft) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    const same = JSON.stringify(STATE.coachProgramDraft) === JSON.stringify(App.coach.dayDraft(day));
    button.disabled = same;
    button.setAttribute("aria-disabled", String(same));
    const bar = form.closest(".coach-savebar");
    if (bar) bar.classList.toggle("is-dirty", !same);
  }

  function syncDayField(input) {
    const draft = dayDraft();
    if (!draft) return;
    const field = input.getAttribute("data-day-field");
    const index = input.getAttribute("data-item");
    if (index === null) {
      if (field === "title") draft.title = input.value;
    } else {
      const item = draft.exercises[Number(index)];
      if (!item) return;
      item[field] = input.value;
    }
    clearDayErrors();
    syncDaySave();
  }

  function submitDayForm() {
    const client = coachClient();
    const day = coachDay();
    if (!client || !day) return;
    const draft = dayDraft();
    const check = App.coach.validateDay(draft);
    if (!check.ok) {
      showDayErrors(check);
      return;
    }
    // День из черновика программы ещё не сохранён в программе: правка идёт в
    // сам черновик и уедет вместе с «Сохранить» на экране программы.
    const saved = App.coach.programDay(client.id, day.dayId)
      ? App.coach.applyDay(client.id, day.dayId, draft)
      : App.coach.applyPlanDay(day.dayId, draft);
    if (!saved) return;
    App.coach.refreshPlanDay(day.dayId, saved);
    STATE.coachProgramMode = "view";
    STATE.coachProgramDraft = null;
    STATE.coachPicker = { open: false, query: "", group: "all" };
    toast("Тренировка сохранена (до перезагрузки)");
    // Программу не бросаем: тренер вернулся в неё, чтобы сохранить её целиком.
    if (STATE.coachPlanDraft) {
      render("coach-program", { static: true, focusKey: "coach-plan-add" });
      return;
    }
    // День открыли из просмотра программы — туда и возвращаемся.
    if (STATE.coachTrainingFrom === "program" && STATE.coachProgramDayId) {
      const focusDay = STATE.coachProgramDayId;
      STATE.coachTrainingFrom = "";
      render("coach-program", { static: true, focusKey: "coach-plan-open-" + focusDay });
      return;
    }
    render("coach-training", { static: true, focusKey: "coach-program-view" });
  }

  // Программа открывается из карточки в просмотре: чужой черновик редактора
  // (другого клиента или прошлого захода) не переносится.
  function openCoachProgram() {
    const client = coachClient();
    if (!client) return;
    STATE.coachPlanMode = "view";
    STATE.coachPlanDraft = null;
    STATE.coachProgramDayId = null;
    go("coach-program");
  }

  function openCoachTraining(dayId) {
    const client = coachClient();
    if (!client) return;
    const day = App.coach.editDay(client.id, dayId);
    if (!day) return;
    STATE.coachProgramDayId = day.dayId;
    // Возврат после сохранения дня и стрелка «←» ведут туда, откуда открыли.
    STATE.coachTrainingFrom = currentRoute === "coach-program" ? "program" : "";
    STATE.coachProgramMode = "view";
    STATE.coachProgramDraft = null;
    STATE.coachPicker = { open: false, query: "", group: "all" };
    go("coach-training");
  }

  // Норма питания открывается из карточки: черновик создаётся заново, чтобы
  // не принести правки другого клиента или прошлого захода.
  function openCoachNutrition() {
    const client = coachClient();
    if (!client) return;
    STATE.coachNormDraft = null;
    STATE.coachNormErrors = {};
    go("coach-nutrition");
  }

  // «Отмена» бросает черновик и возвращает в карточку: молча оставлять форму
  // с правками на экране — значит делать вид, что они применены.
  function closeCoachNutrition() {
    STATE.coachNormDraft = null;
    STATE.coachNormErrors = {};
    go("coach-client", "#coach-client-title");
  }

  function resetNormAction() {
    const client = coachClient();
    if (!client) return;
    App.coach.resetNorm(client.id);
    STATE.coachNormDraft = null;
    STATE.coachNormErrors = {};
    toast("Норма снова считается по формуле");
    render("coach-nutrition", { static: true, focusKey: "coach-nutrition-title" });
  }

  // Дни питания открываются из карточки на текущем дне пакета: черновик не
  // переносим между заходами и клиентами.
  function openCoachFood() {
    const client = coachClient();
    if (!client) return;
    const pkg = client.packages.nutrition;
    // Открываем текущий день пакета; у последнего дня индекс не выходит за пакет.
    STATE.coachFoodDayNo = Math.min(pkg.used, Math.max(0, pkg.total - 1));
    STATE.coachFoodDraft = null;
    go("coach-food", '[data-focus="coach-food-day-' + STATE.coachFoodDayNo + '"]');
  }

  // «Отмена» бросает черновик и возвращает в карточку — как у нормы питания.
  function closeCoachFood() {
    STATE.coachFoodDraft = null;
    go("coach-client", '[data-focus="coach-food-open"]');
  }

  // Архив пакетов открывается из карточки клиента. Вкладку запоминаем, чтобы
  // «назад» в карточку и повторный вход не сбрасывали выбранный раздел.
  function openCoachArchive(tab) {
    const client = coachClient();
    if (!client) return;
    if (tab === "training" || tab === "nutrition") STATE.coachArchiveTab = tab;
    go("coach-archive", '[data-focus="coach-archive-' + STATE.coachArchiveTab + '"]');
  }

  function selectArchiveTab(value) {
    if (value !== "training" && value !== "nutrition") return;
    if (STATE.coachArchiveTab === value) return;
    STATE.coachArchiveTab = value;
    render("coach-archive", { static: true, focusKey: "coach-archive-" + value });
  }

  function selectFoodDay(value) {
    const dayNo = Number(value);
    const client = coachClient();
    if (!client || !isFinite(dayNo) || dayNo < 0) return;
    if (dayNo >= client.packages.nutrition.total) return;
    if (dayNo === STATE.coachFoodDayNo) return;
    STATE.coachFoodDayNo = dayNo;
    STATE.coachFoodDraft = null;
    render("coach-food", { static: true, focusKey: "coach-food-day-" + dayNo });
  }

  function setFoodDishMode(mode) {
    if (!App.coach.dishModes[mode]) return;
    if (STATE.coachDishMode === mode) return;
    STATE.coachDishMode = mode;
    render("coach-food", { static: true, focusKey: "coach-dish-mode-" + mode });
  }

  function resetFoodAction() {
    const client = coachClient();
    if (!client) return;
    App.coach.resetFoodDay(client.id, STATE.coachFoodDayNo);
    STATE.coachFoodDraft = null;
    toast("День питания очищен");
    render("coach-food", { static: true, focusKey: "coach-food-days" });
  }

  function setCoachProgramMode(mode) {
    const day = coachDay();
    if (!day) return;
    if (mode === "edit") {
      // Повторное нажатие «Редактор» не должно затирать уже начатые правки.
      if (STATE.coachProgramMode === "edit" && STATE.coachProgramDraft) {
        render("coach-training", { static: true, focusKey: "coach-day-title" });
        return;
      }
      STATE.coachProgramMode = "edit";
      STATE.coachProgramDraft = App.coach.dayDraft(day);
      render("coach-training", { static: true, focusKey: "coach-day-title" });
      return;
    }
    // Просмотр и отмена ничего не сохраняют: черновик просто выбрасывается.
    STATE.coachProgramMode = "view";
    STATE.coachProgramDraft = null;
    STATE.coachPicker = { open: false, query: "", group: "all" };
    // День открывали из редактора программы — туда и возвращаемся.
    if (STATE.coachPlanDraft) {
      dropEmptyPlanDay(day);
      render("coach-program", { static: true, focusKey: "coach-plan-add" });
      return;
    }
    // Отмена в дне, открытом из программы, возвращает в просмотр программы.
    if (STATE.coachTrainingFrom === "program") {
      const focusDay = day.dayId;
      STATE.coachTrainingFrom = "";
      render("coach-program", { static: true, focusKey: "coach-plan-open-" + focusDay });
      return;
    }
    render("coach-training", {
      static: true,
      focusKey: mode === "cancel" ? "coach-program-edit" : "coach-program-view",
    });
  }

  /* ---------- программа и объём пакета ---------- */

  // Черновик программы один на выход в редактор: переход в редактор дня и
  // обратно не должен терять уже переставленные дни и круги.
  function planDraft() {
    const client = coachClient();
    if (!client) return null;
    if (!STATE.coachPlanDraft) {
      STATE.coachPlanDraft = App.coach.programDraft(App.coach.program(client.id));
    }
    return STATE.coachPlanDraft;
  }

  function planFieldNode(key) {
    const text = String(key);
    if (text === "rounds" || text === "durationDays") {
      return document.querySelector('[data-program-field="' + text + '"]');
    }
    const cut = text.lastIndexOf("-");
    if (cut === -1) return null;
    const dayId = text.slice(cut + 1);
    return document.querySelector('[data-day-field="title"][data-day="' + dayId + '"]');
  }

  // Ошибки программы: у дней общий контейнер, у полей пакета — свои.
  function planFieldError(key, message) {
    const text = String(key);
    const input = planFieldNode(text);
    const holder = input
      ? input.closest(".coach-program-field") || input.parentElement
      : document.querySelector("[data-program-errors]");
    if (!holder) return;
    let box = holder.querySelector('[data-program-error="' + text + '"]');
    if (!message) {
      if (box) box.remove();
      if (input) {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
      }
      return;
    }
    if (!box) {
      box = document.createElement("p");
      box.className = "coach-error";
      box.id = "coach-program-error-" + text;
      box.setAttribute("role", "alert");
      box.setAttribute("data-program-error", text);
      holder.appendChild(box);
    }
    box.innerHTML = '<span class="coach-error-icon" aria-hidden="true">!</span>' + escapeHtml(message);
    if (input) {
      // У дня две ошибки (название и упражнения) живут в одной карточке:
      // поле ссылается на все сообщения, а не только на последнее.
      const ids = Array.prototype.map
        .call(holder.querySelectorAll("[data-program-error]"), (node) => node.id)
        .filter(Boolean);
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", ids.length ? ids.join(" ") : box.id);
    }
  }

  function clearPlanErrors() {
    document.querySelectorAll("[data-program-error]").forEach((node) => node.remove());
    document.querySelectorAll("[data-program-field][aria-invalid]").forEach((input) => {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
    document.querySelectorAll("[data-day-field][aria-invalid]").forEach((input) => {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
  }

  function showPlanErrors(check, silent) {
    clearPlanErrors();
    const errors = check.errors || {};
    Object.keys(errors).forEach((key) => planFieldError(key, errors[key]));
    const first = Object.keys(errors)[0];
    if (!first || silent) return;
    const target =
      planFieldNode(first) ||
      document.querySelector("[data-program-errors]") ||
      document.querySelector('[data-action="coach-add-day"]');
    if (!target) return;
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }

  // «Сохранить» активна, только пока программа отличается от сохранённой и
  // проходит проверку: черновик и программа собираются одним programDraft().
  // Возвращает результат проверки — ввод в поле показывает ошибки без фокуса.
  function syncPlanSave() {
    const form = document.querySelector("[data-program-form]");
    const client = coachClient();
    if (!form || !client || !STATE.coachPlanDraft) return null;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return null;
    const check = App.coach.validateProgram(STATE.coachPlanDraft, client);
    const same =
      JSON.stringify(STATE.coachPlanDraft) ===
      JSON.stringify(App.coach.programDraft(App.coach.program(client.id)));
    const locked = same || !check.ok;
    button.disabled = locked;
    button.setAttribute("aria-disabled", String(locked));
    const bar = form.closest(".coach-savebar");
    if (bar) bar.classList.toggle("is-dirty", !same);
    return check;
  }

  // Программа могла стать невалидной от удаления дня или круга: причина видна
  // сразу после отрисовки, иначе выключенная «Сохранить» молчит о ней.
  function revealPlanErrors() {
    const draft = STATE.coachPlanDraft;
    const client = coachClient();
    if (!draft || !client) return;
    const check = App.coach.validateProgram(draft, client);
    if (check.ok) {
      clearPlanErrors();
      return;
    }
    // Фокус после render() уже стоит на кнопке действия; перебиваем его только
    // тогда, когда фокуса нет вовсе.
    const active = document.activeElement;
    showPlanErrors(check, !!active && active !== document.body);
  }

  // Объём пакета — производная от дней и кругов, поэтому подпись
  // пересчитывается прямо в DOM: полная отрисовка сбивала бы каретку.
  function syncPlanTotals() {
    const draft = STATE.coachPlanDraft;
    if (!draft) return;
    const line = App.coach.programLine(draft);
    document.querySelectorAll("[data-program-total]").forEach((node) => {
      node.textContent = line;
    });
    const summary = App.coach.programSummary(draft);
    document.querySelectorAll("[data-program-summary]").forEach((node) => {
      node.textContent = summary;
    });
  }

  function syncPlanField(input) {
    const draft = planDraft();
    if (!draft) return;
    const field = input.getAttribute("data-program-field");
    if (field !== "rounds" && field !== "durationDays") return;
    draft[field] = input.value;
    syncPlanTotals();
    const check = syncPlanSave();
    if (!check || check.ok) clearPlanErrors();
    else showPlanErrors(check, true);
  }

  // Название дня в редакторе программы живёт в черновике программы, а не в
  // черновике дня — иначе правка потерялась бы при перерисовке списка.
  function syncPlanDayTitle(input) {
    const draft = planDraft();
    if (!draft) return;
    const dayId = input.getAttribute("data-day");
    const days = draft.days.filter((item) => item.dayId === dayId);
    if (!days.length) return;
    days[0].title = input.value;
    const check = syncPlanSave();
    if (!check || check.ok) clearPlanErrors();
    else showPlanErrors(check, true);
  }

  function planDayIndex(dayId) {
    const draft = STATE.coachPlanDraft;
    if (!draft || !draft.days) return -1;
    return draft.days.map((item) => item.dayId).indexOf(dayId);
  }

  function setPlanMode(mode) {
    const client = coachClient();
    if (!client) return;
    if (mode === "edit") {
      // Повторное нажатие «Редактор» не должно затирать уже начатые правки.
      if (STATE.coachPlanMode === "edit" && STATE.coachPlanDraft) {
        render("coach-program", { static: true, focusKey: "coach-plan-rounds" });
        return;
      }
      STATE.coachPlanMode = "edit";
      STATE.coachPlanDraft = App.coach.programDraft(App.coach.program(client.id));
      render("coach-program", { static: true, focusKey: "coach-plan-rounds" });
      return;
    }
    // Просмотр и отмена правки не сохраняют.
    STATE.coachPlanMode = "view";
    STATE.coachPlanDraft = null;
    render("coach-program", {
      static: true,
      focusKey: mode === "cancel" ? "coach-plan-edit" : "coach-plan-view",
    });
  }

  function submitPlanForm() {
    const client = coachClient();
    if (!client) return;
    const draft = planDraft();
    // Клиент обязателен: проверка «объём не меньше израсходованного» смотрит
    // на его пакет, иначе сохранение молча отклонялось бы в applyProgram().
    const check = App.coach.validateProgram(draft, client);
    if (!check.ok) {
      showPlanErrors(check);
      return;
    }
    App.coach.applyProgram(client.id, draft);
    STATE.coachPlanMode = "view";
    STATE.coachPlanDraft = null;
    // Открытый в редакторе день мог быть убран из программы: без сброса
    // guardRoute() увёл бы с экрана тренировки.
    if (STATE.coachProgramDayId && !App.coach.programDay(client.id, STATE.coachProgramDayId)) {
      STATE.coachProgramDayId = null;
    }
    toast("Программа сохранена (до перезагрузки)");
    render("coach-program", { static: true, focusKey: "coach-plan-edit" });
  }

  // Новый день сразу открывается в редакторе тренировки — упражнения
  // добавляются там, а программа забирает день вместе с «Сохранить».
  function addPlanDay() {
    const client = coachClient();
    const draft = planDraft();
    if (!client || !draft) return;
    const max = App.coach.programLimits.daysMax;
    if (draft.days.length >= max) {
      toast("В программе не больше " + max + " дней");
      return;
    }
    const day = {
      dayId: "d" + Date.now(),
      title: "Новая тренировка",
      minutes: 0,
      muscles: [],
      exercises: [],
    };
    draft.days.push(day);
    STATE.coachProgramDayId = day.dayId;
    STATE.coachProgramMode = "edit";
    STATE.coachProgramDraft = App.coach.dayDraft(day);
    STATE.coachPicker = { open: false, query: "", group: "all" };
    go("coach-training");
  }

  // День, добавленный в программу и брошенный без упражнений, в черновике не
  // остаётся: сохранить пустой день всё равно нельзя.
  function dropEmptyPlanDay(day) {
    const draft = STATE.coachPlanDraft;
    if (!draft || !day) return;
    const client = coachClient();
    if (client && App.coach.programDay(client.id, day.dayId)) return;
    if ((day.exercises || []).length) return;
    draft.days = draft.days.filter((item) => item.dayId !== day.dayId);
    if (STATE.coachProgramDayId === day.dayId) STATE.coachProgramDayId = null;
    clearPlanErrors();
  }

  function removePlanDay(dayId) {
    const draft = planDraft();
    if (!draft) return;
    if (draft.days.length <= 1) {
      toast("В программе нужен хотя бы один день");
      return;
    }
    const index = planDayIndex(dayId);
    if (index === -1) return;
    draft.days.splice(index, 1);
    // Убранный день мог быть открыт в редакторе тренировки.
    if (STATE.coachProgramDayId === dayId) STATE.coachProgramDayId = null;
    clearPlanErrors();
    render("coach-program", { static: true, focusKey: "coach-plan-add" });
  }

  function movePlanDay(dayId, dir) {
    const draft = planDraft();
    if (!draft) return;
    const index = planDayIndex(dayId);
    const next = index + dir;
    if (index === -1 || next < 0 || next >= draft.days.length) return;
    const moved = draft.days[index];
    draft.days[index] = draft.days[next];
    draft.days[next] = moved;
    clearPlanErrors();
    // Фокус остаётся на стрелке переставленного дня: у края списка стрелка
    // в ту же сторону уже недоступна, поэтому берём встречную.
    const up = next === 0 ? "down" : "up";
    render("coach-program", { static: true, focusKey: "coach-plan-" + up + "-" + dayId });
  }

  function resetProgramAction() {
    const client = coachClient();
    if (!client) return;
    App.coach.resetProgram(client.id);
    STATE.coachPlanMode = "view";
    STATE.coachPlanDraft = null;
    if (STATE.coachProgramDayId && !App.coach.programDay(client.id, STATE.coachProgramDayId)) {
      STATE.coachProgramDayId = null;
    }
    toast("Программа сброшена (до перезагрузки)");
    render("coach-program", { static: true, focusKey: "coach-plan-view" });
  }

  function togglePicker() {
    const picker = STATE.coachPicker || { open: false, query: "", group: "all" };
    const open = !picker.open;
    STATE.coachPicker = { open: open, query: "", group: "all" };
    render("coach-training", { static: true, focusKey: open ? "coach-picker-search" : "coach-picker-open" });
  }

  function setPickerGroup(group) {
    const known = ["all"].concat(App.exercises.groups || []);
    if (known.indexOf(group) === -1) return;
    // Поиск сбрасывается вместе с группой: список отрисован заново, и старое
    // значение в поле показывало бы нефильтрованные результаты.
    STATE.coachPicker = { open: true, query: "", group: group };
    render("coach-training", { static: true, focusKey: "coach-picker-group-" + group });
  }

  // Поиск фильтрует уже отрисованный список прямо в DOM: экран не
  // перерисовывается, каретка и введённый текст остаются на месте.
  function filterPicker(input) {
    const raw = input ? input.value : "";
    if (STATE.coachPicker) STATE.coachPicker.query = raw;
    const needle = String(raw).toLowerCase().replace(/ё/g, "е").trim();
    let shown = 0;
    document.querySelectorAll("[data-picker-item]").forEach((item) => {
      const name = item.getAttribute("data-name") || "";
      const match = !needle || name.indexOf(needle) !== -1;
      item.hidden = !match;
      if (match) shown += 1;
    });
    const none = document.querySelector("[data-picker-none]");
    if (none) none.hidden = shown > 0;
  }

  function addPickerExercise(exerciseId) {
    const draft = dayDraft();
    const exercise = App.exercises.find(exerciseId);
    if (!draft || !exercise) return;
    if (draft.exercises.length >= App.coach.dayLimits.exercisesMax) {
      toast("В одном дне не больше " + App.coach.dayLimits.exercisesMax + " упражнений");
      return;
    }
    // Порядок ключей совпадает с App.coach.dayDraft: иначе сравнение
    // черновика с сохранённым днём всегда считало бы день изменённым.
    draft.exercises.push({
      exerciseId: exercise.id,
      name: exercise.name,
      group: exercise.group,
      equipment: exercise.equipment,
      unit: exercise.unit || "",
      sets: "3",
      reps: "12",
      weight: "",
      tempo: "2-0-1-0",
      rest: "90",
      note: "",
    });
    const index = draft.exercises.length - 1;
    STATE.coachPicker = { open: false, query: "", group: "all" };
    clearDayErrors();
    render("coach-training", { static: true, focusKey: "coach-sets-" + index });
    toast("Добавлено: " + exercise.name);
  }

  function removeExercise(index) {
    const draft = dayDraft();
    if (!draft || !draft.exercises[index]) return;
    draft.exercises.splice(index, 1);
    clearDayErrors();
    // Фокус уезжает на соседнюю строку: удалённой кнопки больше нет.
    const focus = draft.exercises.length
      ? "coach-remove-" + Math.min(index, draft.exercises.length - 1)
      : "coach-picker-open";
    syncDaySave();
    render("coach-training", { static: true, focusKey: focus });
  }

  function moveExercise(index, dir) {
    const draft = dayDraft();
    if (!draft) return;
    const target = index + dir;
    if (!draft.exercises[index] || !draft.exercises[target]) return;
    const swap = draft.exercises[index];
    draft.exercises[index] = draft.exercises[target];
    draft.exercises[target] = swap;
    syncDaySave();
    render("coach-training", {
      static: true,
      focusKey: (dir < 0 ? "coach-up-" : "coach-down-") + target,
    });
  }

  function resetProgramAction() {
    const client = coachClient();
    if (!client) return;
    App.coach.resetProgram(client.id);
    STATE.coachProgramDayId = null;
    STATE.coachProgramMode = "view";
    STATE.coachProgramDraft = null;
    STATE.coachPicker = { open: false, query: "", group: "all" };
    const first = App.coach.program(client.id).days[0];
    toast("Программа сброшена до шаблона");
    render("coach-client", { static: true, focusKey: first ? "coach-day-" + first.dayId : "coach-back" });
  }

  /* ---------- actions ---------- */

  function handleAction(action, trigger, event) {
    switch (action) {
      case "close-sheet":
        closeSheet();
        break;
      case "add-water": {
        const day = planDay(trigger.dataset.day, STATE.foodDay);
        const slots = STATE.water[day];
        if (!slots) return;
        const index = slots.findIndex((value) => !value);
        if (index === -1) {
          toast("Норма воды на сегодня выполнена");
          return;
        }
        slots[index] = true;
        render("home", { static: true, focusKey: trigger.dataset.focus });
        break;
      }
      case "toggle-water": {
        const day = planDay(trigger.dataset.day, STATE.foodDay);
        const index = Number(trigger.dataset.index);
        const slots = STATE.water[day];
        if (!slots || typeof slots[index] !== "boolean") return;
        slots[index] = !slots[index];
        render("nutrition", { static: true, focusKey: trigger.dataset.focus });
        break;
      }
      case "toggle-meal": {
        const day = planDay(trigger.dataset.day, STATE.foodDay);
        const index = Number(trigger.dataset.index);
        const meals = STATE.meals[day];
        if (!meals || typeof meals[index] !== "boolean") return;
        meals[index] = !meals[index];
        render("nutrition", { static: true, focusKey: trigger.dataset.focus });
        break;
      }
      case "toggle-item": {
        const cycleData = CYCLE.current();
        if (!CYCLE.isCurrent(cycleData)) return;
        const session = CYCLE.findSession(cycleData, Number(trigger.dataset.session));
        const itemId = trigger.dataset.item;
        if (!session || !itemId) return;
        const known = session.blocks.some((block) => block.items.some((item) => item.id === itemId));
        if (!known) return;
        const nowDone = !CYCLE.isItemDone(cycleData, itemId);
        if (nowDone) STATE.cycle.itemDone[itemId] = true;
        else delete STATE.cycle.itemDone[itemId];
        trigger.classList.toggle("is-done", nowDone);
        trigger.setAttribute("aria-pressed", String(nowDone));
        const row = trigger.closest(".ex-row, .simple-row");
        if (row) row.classList.toggle("is-done", nowDone);
        const total = CYCLE.itemCount(session);
        const marked = CYCLE.itemDoneCount(cycleData, session);
        const fill = document.getElementById("session-progress-fill");
        const label = document.getElementById("session-progress-text");
        const track = fill ? fill.closest(".progress-track") : null;
        if (fill) fill.style.setProperty("--progress", Math.round(percent(marked, total)) + "%");
        if (label) label.textContent = marked + " из " + total;
        if (track) {
          track.setAttribute("aria-valuenow", String(marked));
          track.setAttribute("aria-valuetext", marked + " из " + total);
        }
        break;
      }
      case "add-set":
        addSet(trigger);
        break;
      case "remove-set":
        removeSet(trigger);
        break;
      case "toggle-comment":
        toggleComment(trigger);
        break;
      case "finish-workout":
        finishWorkout();
        break;
      case "undo-session":
        undoSession();
        break;
      case "open-session": {
        const number = Number(trigger.dataset.session);
        if (!number) return;
        STATE.cycle.tab = "current";
        STATE.cycle.archiveOpen = null;
        if (currentRoute === "workouts") {
          STATE.cycle.selected = number;
          render("workouts", { focusKey: "session-" + number });
        } else {
          pendingWorkoutSelection = number;
          go("workouts", '[data-focus="session-' + number + '"]');
        }
        break;
      }
      case "cycle-tab": {
        const tab = trigger.dataset.tab === "archive" ? "archive" : "current";
        if (STATE.cycle.tab === tab && !STATE.cycle.archiveOpen) return;
        STATE.cycle.tab = tab;
        STATE.cycle.archiveOpen = null;
        render("workouts", { focusKey: "cycle-tab-" + tab });
        break;
      }
      case "open-archive-cycle": {
        const id = trigger.dataset.cycle;
        if (!id || !CYCLE.byId(id)) return;
        STATE.cycle.archiveOpen = id;
        render("workouts", { focusKey: "back-to-archive" });
        break;
      }
      case "close-archive-cycle":
        STATE.cycle.archiveOpen = null;
        render("workouts", { focusKey: "cycle-tab-archive" });
        break;
      case "open-legend":
        legendSheet();
        break;
      case "toggle-rec": {
        const card = trigger.closest(".rec-card");
        if (!card) return;
        const open = !card.classList.contains("is-open");
        card.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", String(open));
        break;
      }
      case "set-training-status": {
        const next = trigger.dataset.status;
        if (["active", "completed", "pending", "none", "expired"].indexOf(next) === -1) return;
        // «Срок истёк» — активный пакет с закончившимися 30 днями.
        STATE.demoExpiry.training = next === "expired";
        STATE.training.status = next === "expired" ? "active" : next;
        // Фокус возвращаем на выбранный сегмент: панель перерисовывается целиком.
        if (currentRoute === "workouts") render("workouts", { static: true });
        else if (currentRoute === "home") render("home", { static: true });
        else if (currentRoute === "profile") {
          render("profile", { static: true, focusSelector: 'input[name="training-status"]:checked' });
        }
        break;
      }
      case "set-nutrition-status": {
        const next = trigger.dataset.status;
        if (["active", "completed", "pending", "none", "expired"].indexOf(next) === -1) return;
        // DATA.subscription не трогаем: демо-статус живёт только в STATE.
        if (!STATE.nutrition) STATE.nutrition = { status: "none" };
        STATE.demoExpiry.nutrition = next === "expired";
        STATE.nutrition.status = next === "expired" ? "active" : next;
        if (currentRoute === "profile") {
          render("profile", { static: true, focusSelector: 'input[name="nutrition-status"]:checked' });
        } else if (currentRoute === "home") render("home", { static: true });
        break;
      }
      case "reset-demo":
        try {
          window.localStorage.removeItem("trenio-profile");
        } catch (error) {
          /* хранилище недоступно — перезагрузка всё равно сбросит сессию */
        }
        // Анкета живёт только в памяти, но сброс демо-данных должен вернуть
        // чистый демо-клиент: имя, пакеты и ожидание активации тоже стираем.
        App.onboarding.reset();
        STATE.submission = null;
        STATE.questionnaire = null;
        STATE.training.status = DATA.subscription.training.status;
        STATE.nutrition = { status: DATA.subscription.nutrition.status };
        STATE.demoExpiry = { training: false, nutrition: false };
        // Сброс демо-данных выводит из кабинета: ключ сессии тоже чистим.
        App.auth.reset();
        location.reload();
        break;
      case "pick-food-day": {
        const day = planDay(trigger.dataset.day, STATE.foodDay);
        STATE.foodDay = day;
        render("nutrition", { static: true, focusKey: trigger.dataset.focus });
        break;
      }
      case "open-recipe": {
        const name = trigger.dataset.dish || "";
        const day = Number(trigger.dataset.day);
        openRecipeSheet(name, findDish(day, name));
        break;
      }
      case "open-measure-form":
        if (event) event.preventDefault();
        STATE.reportFormOpen = true;
        go("reports", "#measure-form input");
        break;
      case "toggle-supplements":
        STATE.supplementsOpen = !STATE.supplementsOpen;
        render("nutrition", { static: true, focusSelector: '[data-action="toggle-supplements"]' });
        break;
      case "open-contact":
        contactSheet();
        break;
      case "open-questionnaire":
        go("questionnaire");
        break;
      // Правка идёт через экран онбординга: второй формы для тех же полей нет.
      case "edit-questionnaire":
        if (!App.onboarding.beginEdit()) {
          toast("Ответы анкеты уже не в памяти — заполните её заново");
          contactSheet();
          break;
        }
        go("onboarding");
        break;
      case "cancel-questionnaire":
        App.onboarding.cancelEdit();
        go("questionnaire");
        break;
      case "save-questionnaire":
        saveQuestionnaire();
        break;
      case "toggle-report-form":
        STATE.reportFormOpen = !STATE.reportFormOpen;
        render("reports", {
          focusSelector: STATE.reportFormOpen ? "#measure-form input" : '[data-action="toggle-report-form"]',
        });
        break;
      case "cancel-measurements":
        STATE.reportFormOpen = false;
        render("reports", { focusSelector: '[data-action="toggle-report-form"]' });
        break;
      case "save-measurements":
        if (event) event.preventDefault();
        saveMeasurements();
        break;
      case "report-metric": {
        const key = trigger.dataset.key;
        if (!key) return;
        STATE.reportMetric = key;
        render("reports", {
          focusSelector: `[data-action="report-metric"][data-key="${key}"]`,
        });
        break;
      }
      case "toggle-history":
        STATE.reportShowAll = !STATE.reportShowAll;
        render("reports", { static: true, focusSelector: '[data-action="toggle-history"]' });
        break;
      case "toggle-field-help": {
        const key = trigger.dataset.key;
        const panel = document.getElementById("help-" + key);
        if (!panel) return;
        const open = panel.hidden;
        panel.hidden = !open;
        trigger.setAttribute("aria-expanded", String(open));
        break;
      }
      case "pick-avatar":
        pickAvatar();
        break;
      case "remove-avatar":
        removeAvatar();
        break;
      case "edit-contacts":
        editContactsSheet();
        break;
      case "share-app":
        shareApp();
        break;
      case "install-app":
        installSheet();
        break;
      case "install-confirm":
        confirmInstall();
        break;
      case "toggle-password": {
        const input = document.getElementById(trigger.dataset.target || "");
        if (!(input instanceof HTMLInputElement)) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        trigger.setAttribute("aria-pressed", String(show));
        trigger.innerHTML = `${icon(show ? "eye-off" : "eye")}<span>${show ? "Скрыть" : "Показать"}</span>`;
        break;
      }
      case "toggle-theme":
        applyTheme(STATE.theme === "light" ? "dark" : "light");
        syncThemeControls();
        break;
      case "forgot-password":
        openSheet({
          title: "Восстановление пароля",
          bodyHtml: `
            <div class="contact-sheet">
              <p class="sheet-lead">В демо-версии восстановление недоступно. В рабочей версии ссылка для сброса придёт на вашу почту.</p>
              <button class="btn btn--ghost contact-sheet-cancel" type="button" data-action="close-sheet">Понятно</button>
            </div>`,
        });
        break;
      case "open-coach":
        go("coach");
        break;
      case "exit-coach":
        go(startRoute());
        break;
      case "coach-filter":
        setCoachFilter(trigger.dataset.filter);
        break;
      case "open-coach-client":
        openCoachClient(trigger.dataset.client);
        break;
      case "coach-mode":
        setCoachMode(trigger.dataset.mode);
        break;
      case "coach-cancel":
        setCoachMode("cancel");
        break;
      case "coach-reset": {
        const clientId = trigger.dataset.client;
        if (clientId) App.coach.reset(clientId);
        else App.coach.resetAll();
        if (STATE.coachMode === "edit") STATE.coachMode = "view";
        STATE.coachDraft = null;
        if (clientId) render("coach-client", { static: true, focusKey: "coach-mode-view" });
        else render("coach", { static: true });
        toast("Правки сброшены");
        break;
      }
      case "coach-package-toggle": {
        const result = App.coach.togglePackage(trigger.dataset.client, trigger.dataset.package);
        if (!result) break;
        render("coach-client", { static: true, focusKey: "coach-package-toggle-" + result.key });
        toast(result.active ? "Пакет активирован (до перезагрузки)" : "Пакет деактивирован (до перезагрузки)");
        break;
      }
      case "open-coach-training":
        openCoachTraining(trigger.dataset.day);
        break;
      case "open-coach-program":
        openCoachProgram();
        break;
      case "open-coach-nutrition":
        openCoachNutrition();
        break;
      case "coach-norm-cancel":
        closeCoachNutrition();
        break;
      case "coach-norm-reset":
        resetNormAction();
        break;
      case "open-coach-food":
        openCoachFood();
        break;
      case "coach-food-cancel":
        closeCoachFood();
        break;
      case "coach-food-day":
        selectFoodDay(trigger.dataset.day);
        break;
      case "coach-dish-mode":
        setFoodDishMode(trigger.dataset.mode);
        break;
      case "coach-dish-add":
        addFoodDish(trigger.dataset.dish);
        break;
      case "coach-dish-remove":
        removeFoodDish(trigger.dataset.dish);
        break;
      case "coach-food-reset":
        resetFoodAction();
        break;
      case "open-coach-archive":
        openCoachArchive(trigger.dataset.tab);
        break;
      case "coach-archive-tab":
        selectArchiveTab(trigger.dataset.tab);
        break;
      case "coach-program-mode":
        // Одна кнопка на два экрана: у программы свой режим и черновик.
        if (currentRoute === "coach-program") setPlanMode(trigger.dataset.mode);
        else setCoachProgramMode(trigger.dataset.mode);
        break;
      case "coach-add-day":
        addPlanDay();
        break;
      case "coach-remove-day":
        removePlanDay(trigger.dataset.day);
        break;
      case "coach-move-day":
        movePlanDay(trigger.dataset.day, Number(trigger.dataset.dir));
        break;
      case "coach-program-cancel":
        setPlanMode("cancel");
        break;
      case "coach-day-cancel":
        setCoachProgramMode("cancel");
        break;
      case "coach-picker-toggle":
        togglePicker();
        break;
      case "coach-picker-group":
        setPickerGroup(trigger.dataset.group);
        break;
      case "coach-add-exercise":
        addPickerExercise(trigger.dataset.exercise);
        break;
      case "coach-remove-exercise":
        removeExercise(Number(trigger.dataset.item));
        break;
      case "coach-move-exercise":
        moveExercise(Number(trigger.dataset.item), Number(trigger.dataset.dir));
        break;
      case "coach-program-reset":
        resetProgramAction();
        break;
      case "legal":
        legalSheet(trigger.dataset.legal);
        break;
      case "resend-code":
        if (resendLeft > 0) return;
        startResend();
        toast("Код отправлен повторно");
        break;
      case "onboarding-no-limits":
        toggleNoLimitations(trigger);
        break;
      case "onboarding-back":
        previousOnboardingStep();
        break;
      case "onboarding-next":
        nextOnboardingStep();
        break;
      case "submit-onboarding":
        submitOnboarding(trigger);
        break;
      case "toggle-card":
        toggleCardPanel(trigger);
        break;
      case "toggle-cat":
        toggleAccordion(trigger);
        break;
      case "cat-all":
        setCategoryAll(trigger.dataset.cat, true);
        break;
      case "cat-none":
        setCategoryAll(trigger.dataset.cat, false);
        break;
      case "dish-all":
        setDishGroupAll(trigger.dataset.cat, true);
        break;
      case "dish-none":
        setDishGroupAll(trigger.dataset.cat, false);
        break;
      case "cook-step":
        changeCookDays(trigger);
        break;
      case "food-search-clear":
        clearFoodSearch();
        break;
      case "onboarding-no-allergies":
        toggleNoAllergies(trigger);
        break;
      case "leave-onboarding":
        App.onboarding.reset();
        App.auth.setStage("guest");
        go("welcome");
        break;
      case "demo-client":
        if (trigger.dataset.demo !== "true") return;
        App.auth.setStage("client");
        go("home");
        break;
      case "logout":
        logoutSheet();
        break;
      case "logout-confirm":
        // Стадия — единственное, что пишется в хранилище; введённых данных нет.
        // Ответы анкеты живут в памяти, поэтому выход их тоже стирает.
        App.onboarding.reset();
        STATE.submission = null;
        STATE.questionnaire = null;
        // Правки подходов и комментарии клиента — тоже только в памяти.
        STATE.cycle.edits = {};
        STATE.cycle.commentOpen = null;
        App.auth.setStage("guest");
        closeSheet();
        go("welcome");
        toast("Вы вышли из аккаунта");
        break;
      default:
        break;
    }
  }

  /* ---------- events ---------- */

  document.addEventListener("click", (event) => {
    const navLink = event.target.closest("[data-nav]");
    // Re-clicking the nav link of the current route is an explicit "back to top".
    if (navLink && navLink.dataset.nav === currentRoute) window.scrollTo(0, 0);
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    // Радиокнопки обрабатываем по change: стрелки клавиатуры тоже меняют выбор.
    if (trigger instanceof HTMLInputElement && trigger.type === "radio") return;
    handleAction(trigger.dataset.action, trigger, event);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === "package") {
      pickPackage(target.value);
      return;
    }
    if (target instanceof HTMLElement && target.closest('[data-form="onboarding"]')) {
      syncOnboardingDraft(target);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.role === "food") {
      toggleFoodChip(target);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.role === "dish") {
      toggleDishChip(target);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.role === "snack") {
      toggleSnackChip(target);
      return;
    }
    if (target instanceof HTMLInputElement && target.id === "avatar-input") {
      handleAvatar(target.files && target.files[0]);
      target.value = "";
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.action === "set-theme") {
      applyTheme(target.value);
      return;
    }
    if (target instanceof HTMLInputElement &&
        (target.dataset.action === "set-training-status" || target.dataset.action === "set-nutrition-status")) {
      handleAction(target.dataset.action, target);
      return;
    }
    if (target instanceof HTMLInputElement &&
        (target.dataset.role === "set-reps" || target.dataset.role === "set-weight")) {
      saveSetField(target);
      return;
    }
    if (target instanceof HTMLTextAreaElement && target.dataset.role === "set-comment") {
      saveComment(target);
      return;
    }
    if (target instanceof HTMLInputElement && target.name === "consent") {
      const form = target.closest('[data-form="register"]');
      if (form) publicFieldError(form, "register-consent", "");
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('[data-form="onboarding"]')) {
      syncOnboardingDraft(target);
      return;
    }
    if (target instanceof HTMLInputElement && target.id === "ob-food-search") {
      filterFoods(target.value);
      return;
    }
    if (target instanceof HTMLInputElement && target.hasAttribute("data-coach-search")) {
      applyCoachQuery(target.value);
      return;
    }
    // Поля редактора обновляют только черновик: без перерисовки, чтобы не
    // терять каретку; ошибки поля гасятся, кнопка сохранения пересчитывается.
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      target.hasAttribute("data-coach-field")
    ) {
      syncCoachField(target.dataset.coachField);
      return;
    }
    // Норма питания: ввод идёт в черновик и сразу связывает калорийность,
    // граммы и доли — без перерисовки, чтобы не терять каретку.
    if (target instanceof HTMLInputElement && target.hasAttribute("data-norm-field")) {
      syncNormField(target);
      return;
    }
    // Поиск упражнений фильтрует отрисованный список в DOM.
    if (target instanceof HTMLInputElement && target.hasAttribute("data-picker-search")) {
      filterPicker(target);
      return;
    }
    // Поля дня тоже обновляют только черновик.
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      target.hasAttribute("data-day-field")
    ) {
      // Название дня в редакторе программы правит черновик программы.
      if (target.getAttribute("data-day-field") === "title" && !target.hasAttribute("data-item")) {
        syncPlanDayTitle(target);
        return;
      }
      syncDayField(target);
      return;
    }
    // Круги и срок программы — в её черновике, без перерисовки экрана.
    if (target instanceof HTMLInputElement && target.hasAttribute("data-program-field")) {
      syncPlanField(target);
      return;
    }
    if (target instanceof HTMLElement && target.id === "onboarding-allergies") {
      STATE.onboarding.data.allergies = target.value;
      setFoodError("onboarding-allergies-error", "");
      const field = target.closest(".pub-field");
      if (field) field.classList.remove("is-invalid");
      target.setAttribute("aria-invalid", "false");
      return;
    }
    if (!(target instanceof HTMLInputElement)) return;
    const loginForm = target.closest('[data-form="login"]');
    if (loginForm) {
      if (target.name === "email") publicFieldError(loginForm, "login-email", "");
      if (target.name === "password") publicFieldError(loginForm, "login-password", "");
      return;
    }
    const registerForm = target.closest('[data-form="register"]');
    if (registerForm) {
      if (target.name === "email") publicFieldError(registerForm, "register-email", "");
      if (target.name === "password") {
        publicFieldError(registerForm, "register-password", "");
        updatePasswordHint(registerForm);
      }
      if (target.name === "password2") publicFieldError(registerForm, "register-password2", "");
      return;
    }
    const verifyForm = target.closest('[data-form="verify"]');
    if (verifyForm) {
      // В поле кода остаётся одна цифра, ввод переводит фокус на следующее поле.
      target.value = target.value.replace(/\D/g, "").slice(-1);
      if (target.value) {
        const fields = codeFields(verifyForm);
        const index = fields.indexOf(target);
        if (index > -1 && index < fields.length - 1) fields[index + 1].focus({ preventScroll: true });
      }
      verifyError("");
      return;
    }
    if (target.closest('[data-form="contacts"]')) {
      if (target.name === "phone" || target.name === "email") fieldError({ key: target.name }, "");
      return;
    }
    if (!target.closest("#measure-form")) return;
    updateDelta(target);
    const field = DATA.measurementFields.find((item) => item.key === target.name);
    if (field) fieldError(field, "");
  });

  document.addEventListener("keydown", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("code-input")) return;
    const form = input.closest('[data-form="verify"]');
    if (!form) return;
    const fields = codeFields(form);
    const index = fields.indexOf(input);
    if (event.key === "Backspace" && !input.value && index > 0) {
      event.preventDefault();
      fields[index - 1].value = "";
      fields[index - 1].focus({ preventScroll: true });
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      fields[index - 1].focus({ preventScroll: true });
    } else if (event.key === "ArrowRight" && index < fields.length - 1) {
      event.preventDefault();
      fields[index + 1].focus({ preventScroll: true });
    }
  });

  document.addEventListener("paste", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("code-input")) return;
    const form = input.closest('[data-form="verify"]');
    if (!form) return;
    const data = event.clipboardData;
    const digits = String((data && data.getData("text")) || "").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!digits) return;
    event.preventDefault();
    fillCode(form, digits);
    verifyError("");
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.hasAttribute("data-coach-form")) {
      event.preventDefault();
      submitCoachForm();
      return;
    }
    if (form.hasAttribute("data-day-form")) {
      event.preventDefault();
      submitDayForm();
      return;
    }
    if (form.hasAttribute("data-program-form")) {
      event.preventDefault();
      submitPlanForm();
      return;
    }
    if (form.hasAttribute("data-norm-form")) {
      event.preventDefault();
      submitNormForm();
      return;
    }
    if (form.hasAttribute("data-food-form")) {
      event.preventDefault();
      submitFoodForm();
      return;
    }
    if (PUBLIC_FORMS.indexOf(form.dataset.form) !== -1) {
      event.preventDefault();
      if (form.dataset.form === "login") submitLogin(form);
      else if (form.dataset.form === "register") submitRegister(form);
      else if (form.dataset.form === "verify") submitVerify(form);
      return;
    }
    if (form.dataset.form === "contacts") {
      event.preventDefault();
      saveContacts(form);
      return;
    }
    if (form.dataset.form === "onboarding") {
      event.preventDefault();
      nextOnboardingStep();
      return;
    }
    if (form.dataset.form !== "measure") return;
    event.preventDefault();
    saveMeasurements();
  });

  window.addEventListener("hashchange", onRouteChange);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    toast("Приложение установлено");
    if (currentRoute === "profile") render("profile", { static: true });
  });

  /* ---------- boot ---------- */

  const initialRoute = resolveRoute();
  render(initialRoute, {});
  applyTheme(STATE.theme);
})(window.App = window.App || {});
