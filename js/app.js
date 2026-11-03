/* Application shell: routing, chrome, delegated actions, global workout dock. */
(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const MEASUREMENTS = App.measurements;
  const CYCLE = App.cycle;
  const PROFILE = App.profile;
  const { ROUTES, SCREEN_IDS, PAGE_TITLES } = App.const;
  const { NOW, TODAY, isoDate, escapeHtml, icon, one, weight, plural, percent, formatShortDate } = App.util;
  const { openSheet, closeSheet } = App.ui;

  let currentRoute = null;
  let routeFocus = null;
  let toastTimer = 0;
  let installPrompt = null;
  let pendingWorkoutSelection = 0;

  const TRAININGS = DATA.subscription.training.sessions;

  /* ---------- routing ---------- */

  function rawRoute() {
    const value = location.hash.replace(/^#\/?/, "").split("?")[0];
    return value || "";
  }

  function resolveRoute() {
    let route = rawRoute();
    if (!route) {
      history.replaceState(null, "", "#/home");
      route = "home";
    } else if (route === "supplements") {
      history.replaceState(null, "", "#/nutrition");
      route = "nutrition";
    } else if (ROUTES.indexOf(route) === -1) {
      history.replaceState(null, "", "#/home");
      route = "home";
    }
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
    const settings = options || {};
    const previousRoute = currentRoute;
    // Only a real route change (first load, hashchange, nav link to another route)
    // may jump to the top. In-place updates — static: true or a same-route re-render
    // from handleAction — keep the current scroll position.
    const routeChanged = previousRoute !== route;
    const jumpTop = routeChanged || !!settings.scrollTop;
    const savedScrollY = window.scrollY || window.pageYOffset || 0;
    currentRoute = route;
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
    if (settings.static) {
      screen.querySelectorAll(".ring-value").forEach((ring) => {
        ring.style.strokeDashoffset = ring.dataset.offset;
      });
    } else {
      App.ui.animateRings(screen);
    }
    document.title = PAGE_TITLES[route] || "Trenio";
    document.body.dataset.route = route;
    syncNavigation(route);
    syncClientMeta();
    syncProfileChrome();
    syncDock();
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

  function syncProfileChrome() {
    const src = STATE.profile.avatar;
    const top = document.getElementById("topbar-avatar");
    if (top) {
      if (src) top.innerHTML = `<img class="avatar-img" src="${escapeHtml(src)}" alt="">`;
      else top.textContent = "А";
    }
    const side = document.getElementById("sidebar-avatar");
    if (side) {
      if (src) side.innerHTML = `<img class="avatar-img" src="${escapeHtml(src)}" alt="">`;
      else side.textContent = "А";
    }
  }

  function focusKey(key) {
    if (!key) return;
    const target = document.querySelector('[data-focus="' + String(key).replace(/"/g, '\\"') + '"]');
    if (target) target.focus({ preventScroll: true });
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

  /* ---------- actions ---------- */

  function handleAction(action, trigger, event) {
    switch (action) {
      case "close-sheet":
        closeSheet();
        break;
      case "add-water": {
        const day = Number(trigger.dataset.day);
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
        const day = Number(trigger.dataset.day);
        const index = Number(trigger.dataset.index);
        const slots = STATE.water[day];
        if (!slots || typeof slots[index] !== "boolean") return;
        slots[index] = !slots[index];
        render("nutrition", { static: true, focusKey: trigger.dataset.focus });
        break;
      }
      case "toggle-meal": {
        const day = Number(trigger.dataset.day);
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
        if (["active", "completed", "none"].indexOf(next) === -1) return;
        STATE.training.status = next;
        if (currentRoute === "workouts") render("workouts", { static: true });
        else if (currentRoute === "home") render("home", { static: true });
        else if (currentRoute === "profile") render("profile", { static: true });
        break;
      }
      case "reset-demo":
        try {
          window.localStorage.removeItem("trenio-profile");
        } catch (error) {
          /* хранилище недоступно — перезагрузка всё равно сбросит сессию */
        }
        location.reload();
        break;
      case "pick-food-day": {
        const day = Number(trigger.dataset.day);
        if (!DATA.menus[day]) return;
        STATE.foodDay = day;
        render("nutrition", { static: true, focusKey: trigger.dataset.focus });
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
    handleAction(trigger.dataset.action, trigger, event);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === "avatar-input") {
      handleAvatar(target.files && target.files[0]);
      target.value = "";
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.action === "set-theme") {
      applyTheme(target.value);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.closest('[data-form="contacts"]')) {
      if (target.name === "phone" || target.name === "email") fieldError({ key: target.name }, "");
      return;
    }
    if (!target.closest("#measure-form")) return;
    updateDelta(target);
    const field = DATA.measurementFields.find((item) => item.key === target.name);
    if (field) fieldError(field, "");
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.form === "contacts") {
      event.preventDefault();
      saveContacts(form);
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
