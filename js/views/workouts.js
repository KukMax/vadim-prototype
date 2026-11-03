(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const C = App.cycle;
  const {
    icon, escapeHtml, plural, formatShortDate, formatDateRange, percent, isoDate, NOW,
  } = App.util;
  const { cycleStrip } = App.ui;
  App.views = App.views || {};

  const TOTAL = DATA.cycles.current.sessions.length;

  /* ---------- shared bits ---------- */

  function cycleCountText(cycleData) {
    const total = cycleData.sessions.length;
    const done = C.doneCount(cycleData);
    return done + " из " + total + " " + plural(total, ["тренировки", "тренировок", "тренировок"]);
  }

  function cycleEndDate(cycleData) {
    return cycleData.finishedAt || C.lastDoneDate(cycleData) || isoDate(NOW);
  }

  function sessionBadge(cycleData, session) {
    const done = C.isDone(cycleData, session.number);
    if (done) {
      const date = C.doneDate(cycleData, session.number);
      return `<span class="badge badge--done">Выполнена${date ? " " + formatShortDate(date) : ""}</span>`;
    }
    if (session.number === C.nextNumber(cycleData)) return `<span class="badge">Следующая</span>`;
    return `<span class="badge">Впереди</span>`;
  }

  function progressMarkup(cycleData, session) {
    const doneItems = C.itemDoneCount(cycleData, session);
    const total = C.itemCount(session);
    return `
      <div class="session-progress">
        <div class="progress-label"><span>Отмечено</span><b id="session-progress-text">${doneItems} из ${total}</b></div>
        <div class="progress-track" role="progressbar" aria-label="Отмеченные упражнения" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${doneItems}" aria-valuetext="${doneItems} из ${total}">
          <span class="progress-fill" id="session-progress-fill" style="--progress:${percent(doneItems, total)}%"></span>
        </div>
      </div>`;
  }

  function metaMarkup(session) {
    const muscles = session.muscles.map((muscle) => `<span class="chip">${escapeHtml(muscle)}</span>`).join("");
    return `
      <div class="session-meta">
        ${muscles}
        <span class="chip chip--meta">${icon("clock")}${session.minutes} мин</span>
      </div>`;
  }

  /* ---------- header ---------- */

  function pageHead() {
    const status = STATE.training.status;
    const cycleData = C.current();
    let sub;
    if (status === "none") sub = "Пакет не активирован";
    else sub = `Цикл №${cycleData.number} · ${C.doneCount(cycleData)} из ${TOTAL} тренировок`;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>План от Вадима</span>
        <h1 id="workouts-title" tabindex="-1">Тренировки</h1>
        <p class="screen-sub">${sub}</p>
      </div>`;
  }

  function tabsView() {
    const active = STATE.cycle.tab === "current";
    return `
      <div class="cycle-tabs" role="group" aria-label="Разделы плана тренировок">
        <button class="cycle-tab${active ? " is-active" : ""}" type="button" data-action="cycle-tab" data-tab="current" data-focus="cycle-tab-current" aria-pressed="${active}">Текущий цикл</button>
        <button class="cycle-tab${active ? "" : " is-active"}" type="button" data-action="cycle-tab" data-tab="archive" data-focus="cycle-tab-archive" aria-pressed="${!active}">Архив</button>
      </div>`;
  }

  /* ---------- session card ---------- */

  function sessionCard(cycleData, session, readOnly) {
    const isNext = !readOnly && session.number === C.nextNumber(cycleData) && !C.isDone(cycleData, session.number);
    const lastText = isNext ? C.lastDoneText(cycleData) : "";
    return `
      <article class="session-card card">
        <div class="session-topline">
          <span class="eyebrow">Тренировка ${session.number} из ${TOTAL}</span>
          ${sessionBadge(cycleData, session)}
        </div>
        <h2 class="session-title">${escapeHtml(session.title)}</h2>
        ${metaMarkup(session)}
        ${readOnly ? "" : progressMarkup(cycleData, session)}
        ${lastText ? `<p class="session-last">Последняя тренировка: ${lastText}</p>` : ""}
        ${readOnly ? "" : `<p class="session-hint">${escapeHtml(DATA.restHint)}</p>`}
        ${readOnly || !C.isDone(cycleData, session.number) ? "" : `
          <button class="link-btn session-undo" type="button" data-action="undo-session" data-session="${session.number}" data-focus="undo-session-${session.number}">Отметить невыполненной</button>`}
      </article>`;
  }

  /* ---------- blocks & rows ---------- */

  function legendButton() {
    return `
      <div class="table-tools">
        <button class="legend-btn" type="button" data-action="open-legend" data-focus="legend-open">
          ${icon("info")}Как читать таблицу
        </button>
      </div>`;
  }

  function simpleRow(cycleData, session, item, readOnly) {
    const done = C.isItemDone(cycleData, item.id);
    return `
      <div class="simple-row${done ? " is-done" : ""}">
        <span class="simple-name">${escapeHtml(item.name)}</span>
        <span class="chip chip--meta">${icon("clock")}${escapeHtml(item.duration)}</span>
        ${readOnly || !C.isCurrent(cycleData) ? `<span class="simple-mark" aria-hidden="true">${icon("check")}</span>` : checkButton(session, item, done)}
      </div>`;
  }

  function checkButton(session, item, done) {
    return `
      <button class="check-btn${done ? " is-done" : ""}" type="button" data-action="toggle-item" data-session="${session.number}" data-item="${item.id}" data-focus="check-${item.id}" aria-pressed="${done}" aria-label="${done ? "Снять отметку" : "Отметить выполненным"}: ${escapeHtml(item.name)}">
        ${icon("check")}
      </button>`;
  }

  function mainRow(cycleData, session, item, index, readOnly) {
    const done = C.isItemDone(cycleData, item.id);
    const cells = [
      ["Подходы", item.sets],
      ["Вес", item.weight],
      ["Темп", item.tempo],
      ["Отдых", item.rest],
    ].map((cell) => `<span class="ex-cell"><span class="ex-cap">${cell[0]}</span><span class="ex-val">${escapeHtml(cell[1])}</span></span>`).join("");
    return `
      <div class="ex-row${done ? " is-done" : ""}">
        <div class="ex-head">
          <span class="ex-index">${index}</span>
          <span class="ex-name">${escapeHtml(item.name)}</span>
        </div>
        ${cells}
        ${item.note ? `<p class="ex-note">${escapeHtml(item.note)}</p>` : ""}
        <div class="ex-actions">
          <a class="tool-btn" href="${item.videoUrl}" target="_blank" rel="noopener noreferrer" data-focus="video-${item.id}" aria-label="Смотреть видео: ${escapeHtml(item.name)}">${icon("play")}</a>
          ${readOnly || !C.isCurrent(cycleData) ? `<span class="check-btn is-static is-done" aria-hidden="true">${icon("check")}</span>` : checkButton(session, item, done)}
        </div>
      </div>`;
  }

  function blockMarkup(cycleData, session, block, readOnly) {
    const main = block.type === "main";
    const rows = block.items.map((item, index) => (main
      ? mainRow(cycleData, session, item, index + 1, readOnly)
      : simpleRow(cycleData, session, item, readOnly))).join("");
    const hint = main ? `<span class="block-hint">${block.items.length} ${plural(block.items.length, ["упражнение", "упражнения", "упражнений"])}</span>` : "";
    const head = `
      <div class="block-head">
        <h3 class="block-title">${escapeHtml(block.title)}</h3>
        ${hint}
      </div>`;
    const tableHead = main ? `
      <div class="ex-table-head" aria-hidden="true">
        <span>Упражнение</span><span>Подходы</span><span>Вес</span><span>Темп</span><span>Отдых</span><span></span>
      </div>` : "";
    return `<section class="block">${head}${tableHead}${rows}</section>`;
  }

  function blocksView(cycleData, session, readOnly) {
    return `
      ${session.blocks.some((block) => block.type === "main") ? legendButton() : ""}
      <div class="blocks">${session.blocks.map((block) => blockMarkup(cycleData, session, block, readOnly)).join("")}</div>`;
  }

  /* ---------- current cycle ---------- */

  function currentCycleView(cycleData) {
    const selected = C.findSession(cycleData, STATE.cycle.selected) || C.findSession(cycleData, 1);
    const session = selected || cycleData.sessions[0];
    const done = C.isDone(cycleData, session.number);
    return `
      ${cycleStrip(cycleData, session.number)}
      ${sessionCard(cycleData, session, false)}
      ${blocksView(cycleData, session, false)}
      ${done ? "" : `<div class="dock-spacer"></div>`}`;
  }

  /* ---------- archive ---------- */

  function archiveCycles() {
    const list = C.archive().slice();
    if (STATE.training.status === "completed") list.unshift(C.current());
    return list;
  }

  function cycleCard(cycleData) {
    const end = cycleEndDate(cycleData);
    const range = formatDateRange(cycleData.startedAt, end);
    return `
      <button class="cycle-card" type="button" data-action="open-archive-cycle" data-cycle="${cycleData.id}" data-focus="archive-${cycleData.id}">
        <span class="cycle-card-copy">
          <strong>Цикл ${cycleData.number}</strong>
          <span>${cycleCountText(cycleData)} · ${range}</span>
        </span>
        <span class="cycle-card-chevron" aria-hidden="true">${icon("chevron-right")}</span>
      </button>`;
  }

  function archiveTabView() {
    const openId = STATE.cycle.archiveOpen;
    if (openId) {
      const cycleData = C.byId(openId);
      if (cycleData) return archiveDetailView(cycleData);
    }
    const list = archiveCycles();
    const body = list.length
      ? `<div class="cycle-list">${list.map(cycleCard).join("")}</div>`
      : `<p class="archive-empty">Здесь появятся завершённые циклы.</p>`;
    return `
      <div class="card archive-card">
        <div class="card-head">
          <h2 class="card-title">Завершённые циклы</h2>
          <span class="card-hint">${list.length} ${plural(list.length, ["цикл", "цикла", "циклов"])}</span>
        </div>
        ${body}
      </div>`;
  }

  function staticStrip(cycleData) {
    const cells = cycleData.sessions.map((session) => `
      <span class="session-button is-done is-static" aria-hidden="true">
        <span class="session-num">${session.number}</span>
        <span class="session-mark">${icon("check")}</span>
      </span>`).join("");
    return `<div class="session-strip">${cells}</div>`;
  }

  function archiveDetailView(cycleData) {
    return `
      <button class="back-btn" type="button" data-action="close-archive-cycle" data-focus="back-to-archive"><span class="back-arrow" aria-hidden="true">${icon("chevron-right")}</span>К архиву</button>
      <div class="archive-head">
        <h2 class="archive-title">Цикл ${cycleData.number}</h2>
        <p class="archive-sub">${cycleCountText(cycleData)} · ${formatDateRange(cycleData.startedAt, cycleEndDate(cycleData))}</p>
      </div>
      ${staticStrip(cycleData)}
      ${cycleData.sessions.map((session) => `
        <article class="session-card session-card--archive card">
          <div class="session-topline">
            <span class="eyebrow">Тренировка ${session.number} из ${TOTAL}</span>
            <span class="badge badge--done">Выполнена${C.doneDate(cycleData, session.number) ? " " + formatShortDate(C.doneDate(cycleData, session.number)) : ""}</span>
          </div>
          <h2 class="session-title">${escapeHtml(session.title)}</h2>
          ${metaMarkup(session)}
          ${blocksView(cycleData, session, true)}
        </article>`).join("")}`;
  }

  /* ---------- general recommendations ---------- */

  function contactButton(extraClass) {
    return `<button class="btn btn--primary${extraClass ? " " + extraClass : ""}" type="button" data-action="open-contact" data-focus="contact-coach">Связаться с Вадимом</button>`;
  }

  function recsView() {
    const cards = DATA.generalRecs.training.map((rec, index) => `
      <div class="rec-card${index === 0 ? " is-open" : ""}">
        <button class="rec-toggle" type="button" data-action="toggle-rec" aria-expanded="${index === 0}" data-focus="rec-${index}">
          <span>${escapeHtml(rec.title)}</span>
          <span class="rec-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="rec-body"><p>${escapeHtml(rec.text)}</p></div>
      </div>`).join("");
    return `
      <div class="recs">${cards}</div>
      <p class="recs-note">${escapeHtml(DATA.generalRecs.note)}</p>`;
  }

  function bannerView(options) {
    return `
      <article class="plan-banner card">
        <span class="plan-banner-icon" aria-hidden="true">${icon(options.icon)}</span>
        <h2 class="plan-banner-title">${escapeHtml(options.title)}</h2>
        <p class="plan-banner-copy">${escapeHtml(options.text)}</p>
        ${options.action || ""}
      </article>`;
  }

  function completedView(cycleData) {
    return `
      ${bannerView({
        icon: "check",
        title: "Цикл завершён — отличная работа!",
        text: "Новый персональный план готовит Вадим.",
        action: contactButton("plan-banner-action"),
      })}
      ${recsView()}`;
  }

  function noneView() {
    return `
      ${bannerView({
        icon: "info",
        title: "Персональные тренировки не подключены",
        text: "Пока доступны общие рекомендации.",
        action: contactButton("plan-banner-action"),
      })}
      ${recsView()}`;
  }

  /* ---------- entry ---------- */

  function workoutsView() {
    let body;
    if (STATE.training.status === "none") body = noneView();
    else if (STATE.cycle.tab === "archive") body = archiveTabView();
    else if (STATE.training.status === "completed") body = completedView(C.current());
    else body = currentCycleView(C.current());
    const withTabs = STATE.training.status === "none" ? "" : tabsView();
    return pageHead() + withTabs + body;
  }

  App.views.workouts = { view: workoutsView };
})(window.App = window.App || {});
