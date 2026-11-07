(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const C = App.cycle;
  const SUB = App.subscription;
  const {
    icon, escapeHtml, plural, formatShortDate, formatDateRange, percent, isoDate, addDays, NOW,
  } = App.util;
  const { cycleStrip, recsList } = App.ui;
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

  // Мягкий ориентир по темпу: сколько тренировок сделано на текущей неделе
  // пакета. Без предупреждений и цветов — просто справка под подзаголовком.
  function paceLine() {
    if (SUB.status("training") !== "active" || STATE.cycle.tab !== "current") return "";
    const info = SUB.info("training");
    const week = Math.floor(info.since / 7) + 1;
    const weekStart = isoDate(addDays(NOW, -(info.since % 7)));
    const target = Number(STATE.submission && STATE.submission.sessionsPerWeek) || 3;
    let done = 0;
    for (let number = 1; number <= TOTAL; number += 1) {
      if (C.isDone(C.current(), number) && C.doneDate(C.current(), number) >= weekStart) done += 1;
    }
    return `<p class="pace-line">Неделя ${week} · на этой неделе ${done} из ${target}</p>`;
  }

  function pageHead() {
    const status = SUB.status("training");
    const cycleData = C.current();
    let sub;
    if (status === "none") sub = "Пакет не активирован";
    else if (status === "pending") sub = "Ожидает активации";
    else sub = `Цикл №${cycleData.number} · ${C.doneCount(cycleData)} из ${TOTAL} тренировок`;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>План от Вадима</span>
        <h1 id="workouts-title" tabindex="-1">Тренировки</h1>
        <p class="screen-sub">${sub}</p>
        ${paceLine()}
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

  // readOnly: true — архивный цикл (статические отметки), "demo" — публичное демо
  // без отметок: ни живого прогресса, ни зелёных галочек.
  function simpleRow(cycleData, session, item, readOnly) {
    const demo = readOnly === "demo";
    const done = !demo && C.isItemDone(cycleData, item.id);
    return `
      <div class="simple-row${done ? " is-done" : ""}">
        <span class="simple-name">${escapeHtml(item.name)}</span>
        <span class="chip chip--meta">${icon("clock")}${escapeHtml(item.duration)}</span>
        ${demo ? "" : readOnly || !C.isCurrent(cycleData) ? `<span class="simple-mark" aria-hidden="true">${icon("check")}</span>` : checkButton(session, item, done)}
      </div>`;
  }

  function checkButton(session, item, done) {
    return `
      <button class="check-btn${done ? " is-done" : ""}" type="button" data-action="toggle-item" data-session="${session.number}" data-item="${item.id}" data-focus="check-${item.id}" aria-pressed="${done}" aria-label="${done ? "Снять отметку" : "Отметить выполненным"}: ${escapeHtml(item.name)}">
        ${icon("check")}
      </button>`;
  }

  /* ---------- sets table ---------- */

  function repsCaption(item) {
    return item.unit === "sec" ? "Время (сек)" : "Повторения";
  }

  function weightText(weight) {
    return weight === null || weight === undefined ? "" : String(weight);
  }

  function setRowEditable(item, set, index, added) {
    return `
      <div class="set-row">
        <span class="set-num">${index + 1}</span>
        <input class="set-input" type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(String(set.reps))}" aria-label="Подход ${index + 1}: ${escapeHtml(repsCaption(item).toLowerCase())}" data-role="set-reps" data-item="${item.id}" data-set="${index}" data-focus="set-reps-${item.id}-${index}">
        <input class="set-input" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(weightText(set.weight))}" placeholder="свой вес" aria-label="Подход ${index + 1}: вес, кг" data-role="set-weight" data-item="${item.id}" data-set="${index}" data-focus="set-weight-${item.id}-${index}">
        ${added
          ? `<button class="set-remove" type="button" data-action="remove-set" data-item="${item.id}" data-set="${index}" data-focus="remove-set-${item.id}-${index}" aria-label="Удалить подход ${index + 1}">${icon("x")}</button>`
          : `<span class="set-remove-slot" aria-hidden="true"></span>`}
      </div>`;
  }

  function setRowStatic(set, index) {
    const weight = weightText(set.weight);
    return `
      <div class="set-row">
        <span class="set-num">${index + 1}</span>
        <span class="set-plain">${escapeHtml(String(set.reps))}</span>
        <span class="set-plain${weight ? "" : " is-muted"}">${weight ? escapeHtml(weight) : "свой вес"}</span>
      </div>`;
  }

  function commentPreview(comment) {
    const flat = comment.replace(/\s+/g, " ").trim();
    return flat.length > 70 ? flat.slice(0, 70).trim() + "…" : flat;
  }

  // Архив и демо показывают комментарий клиента текстом: править там нечего.
  function commentView(item, readOnly) {
    const comment = C.getComment(item);
    if (readOnly) {
      return comment
        ? `<div class="ex-comment-read"><span class="ex-cap">Комментарий клиента</span><p>${escapeHtml(comment)}</p></div>`
        : "";
    }
    if (STATE.cycle.commentOpen === item.id) {
      return `
        <div class="ex-comment">
          <textarea class="comment-input" rows="3" maxlength="300" placeholder="Как прошло, что мешало, что изменить" aria-label="Комментарий к упражнению: ${escapeHtml(item.name)}" data-role="set-comment" data-item="${item.id}" data-focus="comment-${item.id}">${escapeHtml(comment)}</textarea>
          <button class="link-btn ex-comment-hide" type="button" data-action="toggle-comment" data-item="${item.id}">Свернуть</button>
        </div>`;
    }
    return `
      <button class="comment-btn${comment ? " has-value" : ""}" type="button" data-action="toggle-comment" data-item="${item.id}" data-focus="comment-${item.id}" aria-expanded="false">
        ${icon("message")}<span>Комментарий к упражнению</span>
      </button>
      ${comment ? `<p class="comment-preview">${escapeHtml(commentPreview(comment))}</p>` : ""}`;
  }

  function mainRow(cycleData, session, item, index, readOnly) {
    const demo = readOnly === "demo";
    const done = !demo && C.isItemDone(cycleData, item.id);
    const editable = !readOnly && C.isCurrent(cycleData);
    const sets = C.getSets(cycleData, item);
    const rows = sets.map((set, setIndex) => (editable
      ? setRowEditable(item, set, setIndex, C.isAdded(item.id, setIndex))
      : setRowStatic(set, setIndex))).join("");
    const canAdd = editable && sets.length < DATA.maxSets;
    return `
      <div class="ex-row${done ? " is-done" : ""}">
        <div class="ex-head">
          <span class="ex-index">${index}</span>
          <span class="ex-name">${escapeHtml(item.name)}</span>
          <div class="ex-actions">
            <a class="tool-btn" href="${item.videoUrl}" target="_blank" rel="noopener noreferrer" data-focus="video-${item.id}" aria-label="Смотреть видео: ${escapeHtml(item.name)}">${icon("play")}</a>
            ${demo ? "" : readOnly || !C.isCurrent(cycleData) ? `<span class="check-btn is-static is-done" aria-hidden="true">${icon("check")}</span>` : checkButton(session, item, done)}
          </div>
        </div>
        <div class="set-table${editable ? "" : " set-table--static"}">
          <div class="set-table-head" aria-hidden="true">
            <span></span><span>${escapeHtml(repsCaption(item))}</span><span>Вес (кг)</span>${editable ? "<span></span>" : ""}
          </div>
          ${rows}
        </div>
        ${canAdd ? `<button class="set-add" type="button" data-action="add-set" data-item="${item.id}" data-focus="add-set-${item.id}">${icon("plus")}Добавить подход</button>` : ""}
        <div class="ex-tiles">
          <span class="ex-tile"><span class="ex-cap">Темп</span><span class="ex-val">${escapeHtml(item.tempo)}</span></span>
          <span class="ex-tile"><span class="ex-cap">Отдых</span><span class="ex-val">${escapeHtml(item.rest)}</span></span>
        </div>
        ${item.note ? `<p class="ex-note">${escapeHtml(item.note)}</p>` : ""}
        ${demo ? "" : commentView(item, readOnly)}
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
    // Пояснение над первой таблицей: почему поля можно править.
    const setsHint = main && !readOnly && C.isCurrent(cycleData)
      ? `<p class="sets-hint">Можно изменить вес и повторения или добавить подход — Вадим увидит.</p>`
      : "";
    return `<section class="block">${head}${setsHint}${rows}</section>`;
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
    if (SUB.status("training") === "completed") list.unshift(C.current());
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
    return `
      ${recsList(DATA.generalRecs.training, "rec")}
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

  // Завершённый и истёкший пакет показывают один и тот же экран: архив циклов
  // плюс общие рекомендации. Отличается только текст баннера.
  function completedView(cycleData) {
    const expired = SUB.info("training").expired;
    const options = expired
      ? {
        icon: "check",
        title: "Срок пакета истёк",
        text: "30 дней пакета закончились. Новый цикл и продление — у Вадима.",
        action: contactButton("plan-banner-action"),
      }
      : {
        icon: "check",
        title: "Цикл завершён — отличная работа!",
        text: "Новый персональный план готовит Вадим.",
        action: contactButton("plan-banner-action"),
      };
    return `${bannerView(options)}${recsView()}`;
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

  // Ожидание активации показываем тем же экраном, что и «нет пакета»,
  // но с объяснением, что происходит и когда откроется доступ.
  function pendingView() {
    return `
      ${bannerView({
        icon: "clock",
        title: "Анкета отправлена",
        text: "Вадим ответит в течение суток и откроет доступ. Пока доступны общие рекомендации.",
        action: contactButton("plan-banner-action"),
      })}
      ${recsView()}`;
  }

  /* ---------- entry ---------- */

  function isWaiting() {
    const status = SUB.status("training");
    return status === "none" || status === "pending";
  }

  function workoutsView() {
    const status = SUB.status("training");
    let body;
    if (status === "none") body = noneView();
    else if (status === "pending") body = pendingView();
    else if (STATE.cycle.tab === "archive") body = archiveTabView();
    else if (status === "completed") body = completedView(C.current());
    else body = currentCycleView(C.current());
    const withTabs = isWaiting() ? "" : tabsView();
    return pageHead() + withTabs + body;
  }

  App.views.workouts = { view: workoutsView, sessionCard, blocksView, legendButton };
})(window.App = window.App || {});
