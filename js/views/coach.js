/* Экран «Клиенты» кабинета тренера. Прототип: список клиентов из фикстур
   js/coach.js, поиск и фильтры в памяти App.state, переход в карточку —
   маршрут #/coach-client (js/views/coach-client.js). Файл грузится раньше
   js/views/public-ui.js, поэтому App.publicUi берём лениво внутри функций,
   а не в шапке модуля. */
(function (App) {
  "use strict";

  const { escapeHtml, icon, percent, plural, weight } = App.util;
  App.views = App.views || {};

  const FILTERS = App.coach.filters;

  function pubUi() {
    return App.publicUi || {};
  }

  function params(client) {
    const years = `${client.age} ${plural(client.age, ["год", "года", "лет"])}`;
    return `${years} · ${client.height} см · ${weight(client.weight)} кг`;
  }

  function filterChips() {
    const current = App.state.coachFilter;
    return FILTERS.map((filter) => {
      const on = filter.key === current;
      return `<button class="coach-chip${on ? " is-on" : ""}" type="button" data-action="coach-filter" data-filter="${filter.key}" data-focus="coach-filter-${filter.key}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(filter.label)}</button>`;
    }).join("");
  }

  function packageRow(client, key) {
    const pkg = client.packages[key];
    const state = App.coach.packageState(pkg);
    const done = Math.min(pkg.used, pkg.total);
    return `
      <li class="coach-package coach-package--${state}">
        <span class="coach-package-top">
          <span class="coach-package-name">${escapeHtml(App.coach.packageTitle(key))}</span>
          <span class="coach-package-frac">${pkg.used}/${pkg.total}</span>
        </span>
        <span class="bar-track coach-bar"><span class="bar-fill" style="--bar-w:${percent(done, pkg.total)}%"></span></span>
        <span class="coach-package-note">${escapeHtml(App.coach.packageLabel(pkg))}</span>
      </li>`;
  }

  function clientCard(client) {
    return `
      <article class="coach-client card">
        <div class="coach-client-head">
          <span class="coach-avatar" aria-hidden="true">${escapeHtml(client.initials)}</span>
          <div class="coach-client-id">
            <h2 class="coach-client-name">${escapeHtml(client.name)}</h2>
            <p class="coach-client-meta">${escapeHtml(params(client))}</p>
            <span class="chip coach-goal">${escapeHtml(client.goal)}</span>
          </div>
        </div>
        <ul class="coach-packages">
          ${App.coach.packageKeys.map((key) => packageRow(client, key)).join("")}
        </ul>
        <div class="coach-client-foot">
          <span class="coach-seen">${escapeHtml(App.coach.lastSeenLabel(client))}</span>
          <button class="coach-open" type="button" data-action="open-coach-client" data-client="${client.id}" data-focus="coach-open-${client.id}" aria-label="Открыть клиента ${escapeHtml(client.name)}">Открыть${icon("chevron-right")}</button>
        </div>
      </article>`;
  }

  function emptyState() {
    return `
      <div class="coach-empty card">
        <p class="coach-empty-title">Никого не нашлось</p>
        <p class="coach-empty-text">Попробуйте другое имя или снимите фильтр.</p>
        <button class="btn btn--ghost" type="button" data-action="coach-filter" data-filter="all" data-focus="coach-filter-all">Показать всех</button>
      </div>`;
  }

  function coachHeading() {
    return `
      <div class="coach-intro">
        <p class="coach-eyebrow">Кабинет тренера</p>
        <h1 class="coach-title" id="coach-title" tabindex="-1">Клиенты</h1>
        <p class="coach-lead">Прототип: клиенты вымышлены, данные не сохраняются.</p>
      </div>`;
  }

  function coachHeader() {
    const ui = pubUi();
    return `
      <header class="coach-head">
        <div class="coach-brand">
          ${ui.logoLockup ? ui.logoLockup("sm") : ""}
          <span class="coach-badge">Прототип</span>
        </div>
        <div class="coach-head-actions">
          ${ui.themeToggle ? ui.themeToggle() : ""}
          <button class="coach-exit" type="button" data-action="exit-coach" data-focus="coach-exit">${icon("log-out")}<span>Выйти</span></button>
        </div>
      </header>`;
  }

  function coachView() {
    const list = App.coach.clients().filter((client) => (
      App.coach.match(client, App.state.coachFilter, App.state.coachQuery)
    ));
    const stats = App.coach.summary(list);
    const total = stats.total;
    const countLine = `${total} ${plural(total, ["клиент", "клиента", "клиентов"])} · ${stats.active} с активным пакетом`;
    return `
    <div class="coach">
      ${coachHeader()}
      ${coachHeading()}

      <div class="coach-tools">
        <label class="coach-search">
          <span class="sr-only">Поиск клиента по имени</span>
          <input class="input coach-search-input" type="search" data-coach-search data-focus="coach-search" value="${escapeHtml(App.state.coachQuery)}" placeholder="Найти клиента" autocomplete="off" spellcheck="false">
        </label>
        <p class="coach-count" aria-live="polite">${escapeHtml(countLine)}</p>
      </div>

      <div class="coach-filters" role="group" aria-label="Фильтр клиентов">
        ${filterChips()}
      </div>

      ${App.coach.hasOverrides() ? `
      <p class="coach-dirty">
        <span class="coach-dirty-text">Есть правки — до перезагрузки</span>
        <button class="coach-reset" type="button" data-action="coach-reset" data-focus="coach-reset-all">Сбросить все правки</button>
      </p>` : ""}

      <div class="coach-list">
        ${list.length ? list.map(clientCard).join("") : emptyState()}
      </div>
    </div>`;
  }

  App.views.coach = { view: coachView };
})(window.App = window.App || {});