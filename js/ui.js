(function (App) {
  "use strict";

  const DATA = App.data;
  const { icon, escapeHtml, one, percent, clamp, TODAY, DAY_SHORT, WEEK_DATES, formatLongDate } = App.util;

  function ringMarkup(value, options = {}) {
    const size = options.size || 52;
    const stroke = options.stroke || 4.5;
    const label = options.label || "";
    const offset = (100 - clamp(value, 0, 100)).toFixed(2);
    return `
      <span class="ring" style="--ring-size:${size}px;--ring-stroke:${stroke}px" aria-hidden="true">
        <svg viewBox="0 0 44 44">
          <circle class="ring-track" cx="22" cy="22" r="18" pathLength="100"></circle>
          <circle class="ring-value" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" data-ring data-offset="${offset}" transform="rotate(-90 22 22)"></circle>
        </svg>
        ${label ? `<span class="ring-center">${label}</span>` : ""}
      </span>`;
  }
  function animateRings(root) {
    const rings = root.querySelectorAll("[data-ring]");
    if (!rings.length) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rings.forEach((ring) => {
          ring.style.strokeDashoffset = ring.dataset.offset;
        });
      });
    });
  }
  function macroRows(macros) {
    const rows = [
      { label: "Белки", letter: "Б", value: macros.p, target: DATA.targets.protein, tone: "protein" },
      { label: "Жиры", letter: "Ж", value: macros.f, target: DATA.targets.fat, tone: "fat" },
      { label: "Углеводы", letter: "У", value: macros.c, target: DATA.targets.carbs, tone: "carb" },
    ];
    return `
      <div class="macro-list">
        ${rows.map((row, index) => `
          <div class="macro-row macro-row--${row.tone}">
            <div class="macro-label">
              <span><i class="macro-dot"></i><span class="macro-letter">${row.letter}</span>${row.label}</span>
              <span><b>${one(row.value)}</b> <span class="macro-target">/ ${one(row.target)} г</span></span>
            </div>
            <div class="bar-track" aria-hidden="true">
              <span class="bar-fill bar-fill--${row.tone}" style="--bar-w:${percent(row.value, row.target)}%"></span>
            </div>
          </div>`).join("")}
      </div>`;
  }
  function sessionLabel(cycleData, number) {
    const current = App.cycle;
    if (current.isDone(cycleData, number)) return "выполнена";
    if (current.nextNumber(cycleData) === number) return "следующая";
    return "впереди";
  }
  function cycleStrip(cycleData, selected) {
    const current = App.cycle;
    const next = current.nextNumber(cycleData);
    return `
      <div class="session-strip" role="group" aria-label="Тренировки цикла">
        ${current.sessions(cycleData).map((session) => {
          const done = current.isDone(cycleData, session.number);
          const classes = `session-button${done ? " is-done" : ""}${session.number === next ? " is-next" : ""}${session.number === selected ? " is-selected" : ""}`;
          return `
            <button class="${classes}" type="button"
              data-action="open-session" data-session="${session.number}" data-focus="session-${session.number}"
              aria-pressed="${session.number === selected}"
              aria-label="Тренировка ${session.number}, ${sessionLabel(cycleData, session.number)}">
              <span class="session-num">${session.number}</span>
              ${done ? `<span class="session-mark" aria-hidden="true">${icon("check")}</span>` : `<span class="session-mark session-mark--dot" aria-hidden="true"></span>`}
            </button>`;
        }).join("")}
      </div>`;
  }
  function cycleMini(cycleData) {
    const current = App.cycle;
    const next = current.nextNumber(cycleData);
    return `
      <div class="cycle-mini" role="group" aria-label="Тренировки цикла">
        ${current.sessions(cycleData).map((session) => {
          const done = current.isDone(cycleData, session.number);
          return `
            <button class="cycle-mini-item${done ? " is-done" : ""}${session.number === next ? " is-next" : ""}" type="button"
              data-action="open-session" data-session="${session.number}" data-focus="cycle-mini-${session.number}"
              aria-label="Тренировка ${session.number}, ${sessionLabel(cycleData, session.number)}">
              <span aria-hidden="true">${session.number}</span>
            </button>`;
        }).join("")}
      </div>`;
  }
  function foodDays(selected) {
    return `
      <div class="food-days" role="group" aria-label="Выбор дня меню">
        ${DAY_SHORT.map((label, index) => {
          const date = WEEK_DATES[index];
          const isToday = index === TODAY;
          const pressed = selected === index;
          return `
            <button class="food-day${isToday ? " is-today" : ""}" type="button"
              data-action="pick-food-day" data-day="${index}" data-focus="food-day-${index}"
              aria-pressed="${pressed}" aria-label="${formatLongDate(date)}${isToday ? ", сегодня" : ""}">
              <span class="food-day-name">${label}</span>
              <span class="food-day-date">${date.getDate()}</span>
            </button>`;
        }).join("")}
      </div>`;
  }
  function coachNoteCard(text) {
    return `
      <aside class="note-card card" aria-label="Заметка от тренера">
        <div class="note-head">
          <span class="avatar avatar--sm avatar--coach" aria-hidden="true">В</span>
          <div class="note-ident"><strong>Вадим</strong><span>твой тренер</span></div>
        </div>
        <p class="note-text">${escapeHtml(text)}</p>
        <p class="note-sign">Заметка к тренировке</p>
      </aside>`;
  }
  // Общие рекомендации: аккордеон, первая карточка раскрыта.
  function recsList(items, prefix) {
    const cards = (items || []).map((rec, index) => `
      <div class="rec-card${index === 0 ? " is-open" : ""}">
        <button class="rec-toggle" type="button" data-action="toggle-rec" aria-expanded="${index === 0}" data-focus="${prefix}-${index}">
          <span>${escapeHtml(rec.title)}</span>
          <span class="rec-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="rec-body"><p>${escapeHtml(rec.text)}</p></div>
      </div>`).join("");
    return `<div class="recs">${cards}</div>`;
  }
  function statTile({ href, route, label, iconName, value, spoken, meta, note = "", visual = "", quick = "" }) {
    return `
      <article class="stat-card card${quick ? " stat-card--water" : ""}">
        <a class="stat-link" href="${href}" data-nav="${route}" data-focus="${route}-stat" aria-label="${label}: ${spoken}">
          <span class="stat-top">${icon(iconName)}<span>${label}</span>${icon("chevron-right", "stat-chevron")}</span>
          <span class="stat-main">
            <span>
              <span class="stat-value">${value}</span>
              <span class="stat-meta">${meta}</span>
              ${note ? `<span class="stat-note">${note}</span>` : ""}
            </span>
            ${visual ? `<span class="stat-viz" aria-hidden="true">${visual}</span>` : ""}
          </span>
        </a>
        ${quick}
      </article>`;
  }
  function miniBars(filled, total) {
    return `<span class="stat-mini-bars">${Array.from({ length: total }, (_, index) => `<span class="${index < filled ? "is-filled" : ""}"></span>`).join("")}</span>`;
  }
  function miniDots(filled, total) {
    return `<span class="stat-dots">${Array.from({ length: total }, (_, index) => `<i class="${index < filled ? "is-filled" : ""}"></i>`).join("")}</span>`;
  }

  const sheetState = { opener: null, onClose: null, closeTimer: 0 };

  function sheetRoot() {
    return document.getElementById("sheet-layer");
  }

  function sheetFocusable() {
    return Array.from(document.querySelectorAll("#sheet button, #sheet a[href], #sheet input, #sheet select, #sheet textarea, #sheet [tabindex]:not([tabindex='-1'])"))
      .filter((element) => !element.disabled && element.offsetParent !== null);
  }

  function onSheetKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = sheetFocusable();
    if (!focusable.length) {
      event.preventDefault();
      document.getElementById("sheet").focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openSheet({ title, bodyHtml, onClose }) {
    const layer = sheetRoot();
    if (!layer) return;
    if (!layer.hidden) closeSheet();
    sheetState.opener = document.activeElement;
    sheetState.onClose = onClose || null;
    document.getElementById("sheet-title").textContent = title;
    document.getElementById("sheet-body").innerHTML = bodyHtml;
    layer.hidden = false;
    document.body.classList.add("is-sheet-open");
    document.addEventListener("keydown", onSheetKeydown);
    requestAnimationFrame(() => {
      layer.classList.add("is-open");
      const focusable = sheetFocusable();
      (focusable[0] || document.getElementById("sheet")).focus({ preventScroll: true });
    });
  }

  function closeSheet() {
    const layer = sheetRoot();
    if (!layer || layer.hidden) return;
    layer.classList.remove("is-open");
    document.body.classList.remove("is-sheet-open");
    document.removeEventListener("keydown", onSheetKeydown);
    window.clearTimeout(sheetState.closeTimer);
    sheetState.closeTimer = window.setTimeout(() => {
      layer.hidden = true;
      document.getElementById("sheet-body").innerHTML = "";
    }, 200);
    if (sheetState.opener && typeof sheetState.opener.focus === "function") {
      sheetState.opener.focus({ preventScroll: true });
    }
    const callback = sheetState.onClose;
    sheetState.opener = null;
    sheetState.onClose = null;
    if (callback) callback();
  }

  App.ui = { ringMarkup, animateRings, macroRows, cycleStrip, cycleMini, foodDays, coachNoteCard, recsList, statTile, miniBars, openSheet, closeSheet };
})(window.App = window.App || {});
