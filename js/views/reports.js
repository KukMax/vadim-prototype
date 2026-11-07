(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const {
    TODAY, icon, escapeHtml, plural, one, weight, percent, formatLongDate,
    formatShortDate, parseIsoDate,
  } = App.util;
  App.views = App.views || {};

  const METRICS = [
    { key: "weight", label: "Вес", short: "Вес" },
    { key: "underBust", label: "Под грудью", short: "Под грудью" },
    { key: "waist", label: "Талия", short: "Талия" },
    { key: "navel", label: "По пупку", short: "По пупку" },
    { key: "glutes", label: "Ягодицы", short: "Ягодицы" },
    { key: "underGlutes", label: "Под ягодицами", short: "Под ягодицами" },
    { key: "thigh", label: "Бедро", short: "Бедро" },
    { key: "calf", label: "Голень", short: "Голень" },
    { key: "biceps", label: "Бицепс", short: "Бицепс" },
  ];

  function fieldByKey(key) {
    return DATA.measurementFields.find((field) => field.key === key);
  }

  function metricValue(entry, key) {
    return entry ? entry.values[key] : null;
  }

  function reportsView() {
    const latest = App.measurements.latest();
    const due = App.measurements.isDue();
    const next = App.measurements.nextDate();
    const statusCopy = due
      ? "Внесите новые данные, чтобы видеть динамику и не терять неделю."
      : `Следующие — ${formatShortDate(next)}`;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Прогресс</span>
        <h1 class="page-title" id="reports-title" tabindex="-1">Отчёты</h1>
        <p class="page-lead">Замеры раз в неделю показывают, что меняется не только на весах.</p>
      </div>
      ${latest ? `<article class="report-status card${due ? " report-status--due" : ""}">
        <span class="report-status-icon" aria-hidden="true">${icon(due ? "calendar" : "check")}</span>
        <div class="report-status-copy">
          <h2>${due ? "Пора внести замеры" : `Замеры внесены ${formatShortDate(latest.date)}`}</h2>
          <p>${statusCopy}</p>
        </div>
        <button class="btn ${due ? "btn--primary" : "btn--ghost"}" type="button" data-action="toggle-report-form" aria-expanded="${!!STATE.reportFormOpen}" aria-controls="measure-form-wrap">${due ? "Внести замеры" : "Изменить"}</button>
      </article>` : `<article class="report-status card">
        <span class="report-status-icon" aria-hidden="true">${icon("calendar")}</span>
        <div class="report-status-copy">
          <h2>Первый замер — точка отсчёта</h2>
          <p>Внесите вес и обхваты — динамика появится сразу после первого замера. Измеряйтесь раз в неделю, утром и натощак.</p>
        </div>
        <button class="btn btn--primary" type="button" data-action="toggle-report-form" aria-expanded="${!!STATE.reportFormOpen}" aria-controls="measure-form-wrap">Сделать первый замер</button>
      </article>`}
      <div id="measure-form-wrap"${STATE.reportFormOpen ? "" : " hidden"}>
        ${measureForm(latest)}
      </div>
      ${latest ? dynamicsCard() : ""}
      ${latest ? historyCard() : ""}
    `;
  }

  function measureForm(latest) {
    const groups = [];
    DATA.measurementFields.forEach((field) => {
      let group = groups.find((item) => item.name === field.group);
      if (!group) {
        group = { name: field.group, fields: [] };
        groups.push(group);
      }
      group.fields.push(field);
    });
    const body = groups.map((group) => `
      <fieldset class="measure-group">
        <legend>${escapeHtml(group.name)}</legend>
        <div class="measure-fields">
          ${group.fields.map((field) => measureField(field, latest)).join("")}
        </div>
      </fieldset>`).join("");
    return `
      <form class="measure-form card" id="measure-form" novalidate data-form="measure">
        <div class="measure-form-head">
          <h2>Новые замеры</h2>
          <p>Заполните все поля. Ошибки подсветятся, ничего не потеряется.</p>
        </div>
        <div class="measure-guidance">
          <span aria-hidden="true">${icon("info")}</span>
          <p>Измеряйтесь раз в неделю: в один и тот же день, утром, натощак. Лента плотно прилегает, но не сдавливает.</p>
        </div>
        ${body}
        <div class="measure-form-actions">
          <button class="btn btn--primary" type="submit" data-action="save-measurements">Сохранить замеры</button>
          <button class="btn btn--ghost" type="button" data-action="cancel-measurements">Отмена</button>
        </div>
      </form>`;
  }

  function measureField(field, latest) {
    const previous = latest ? latest.values[field.key] : null;
    // Первый замер: вес берём из анкеты, остальные поля пустые — без демо-цифр.
    const submission = STATE.submission;
    const prefill = !latest && field.key === "weight" && submission && submission.weight != null
      ? one(submission.weight)
      : "";
    const hint = previous === null || previous === undefined
      ? prefill ? "Вес из анкеты" : "Первый замер"
      : `Прошлый раз: ${one(previous)}`;
    return `
      <div class="measure-field" data-field="${field.key}">
        <div class="measure-label-row">
          <label for="measure-${field.key}">${escapeHtml(field.label)}</label>
          <button class="field-help" type="button" data-action="toggle-field-help" data-key="${field.key}" aria-expanded="false" aria-controls="help-${field.key}" aria-label="Как измерить: ${escapeHtml(field.label)}">${icon("info")}</button>
        </div>
        <div class="measure-input-wrap">
          <input id="measure-${field.key}" name="${field.key}" type="text" inputmode="decimal" autocomplete="off" step="0.1"${prefill ? ` value="${escapeHtml(prefill)}"` : ""} aria-describedby="hint-${field.key} error-${field.key}" aria-invalid="false">
          <span class="measure-unit">${field.unit}</span>
        </div>
        <p class="field-hint" id="hint-${field.key}">${hint}</p>
        <p class="field-delta" data-delta="${field.key}" hidden></p>
        <p class="field-error" id="error-${field.key}" hidden></p>
        <div class="field-help-text" id="help-${field.key}" hidden>
          <strong>Как измерить</strong>
          <p>${escapeHtml(field.howTo)}</p>
        </div>
      </div>`;
  }

  function dynamicsCard() {
    const entries = App.measurements.sorted().slice(-8);
    const metric = METRICS.find((item) => item.key === STATE.reportMetric) || METRICS[0];
    const values = entries.map((entry) => entry.values[metric.key]);
    const first = values.length ? values[0] : 0;
    const last = values.length ? values[values.length - 1] : 0;
    const change = last - first;
    return `
      <article class="dynamics-card card">
        <div class="card-head">
          <h2 class="card-title">Динамика</h2>
          <span class="card-hint">${entries.length} ${plural(entries.length, ["замер", "замера", "замеров"])}</span>
        </div>
        <div class="metric-chips" role="group" aria-label="Показатель для графика">
          ${METRICS.map((item) => `<button class="metric-chip${item.key === metric.key ? " is-active" : ""}" type="button" data-action="report-metric" data-key="${item.key}" aria-pressed="${item.key === metric.key}">${item.short}</button>`).join("")}
        </div>
        ${lineChart(metric, entries)}
        <dl class="dynamics-summary">
          <div><dt>Первый</dt><dd>${one(first)} ${fieldByKey(metric.key).unit}</dd></div>
          <div><dt>Последний</dt><dd>${one(last)} ${fieldByKey(metric.key).unit}</dd></div>
          <div><dt>Изменение</dt><dd class="${change < 0 ? "is-down" : change > 0 ? "is-up" : ""}">${change > 0 ? "+" : change < 0 ? "−" : ""}${one(Math.abs(change))} ${fieldByKey(metric.key).unit}</dd></div>
        </dl>
      </article>`;
  }

  function lineChart(metric, entries) {
    const width = 640;
    const height = 176;
    const padded = 14;
    // Без замеров графика нет: динамика строится только по реальным точкам,
    // а не по пустому списку с делением на ноль.
    if (!entries || !entries.length) return "";
    const values = entries.map((entry) => entry.values[metric.key]);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const span = maxValue - minValue || 1;
    const points = values.map((value, index) => {
      const x = values.length === 1 ? width / 2 : padded + index * ((width - padded * 2) / (values.length - 1));
      const y = padded + ((maxValue - value) / span) * (height - padded * 2);
      return [x, y];
    });
    const line = points.reduce((path, point, index) => {
      if (index === 0) return `M${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
      const previous = points[index - 1];
      const middle = (previous[0] + point[0]) / 2;
      return `${path} C${middle.toFixed(1)} ${previous[1].toFixed(1)}, ${middle.toFixed(1)} ${point[1].toFixed(1)}, ${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
    }, "");
    const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height - 2} L${points[0][0].toFixed(1)} ${height - 2} Z`;
    const grid = [0, 0.5, 1].map((ratio) => {
      const value = maxValue - span * ratio;
      const y = padded + ratio * (height - padded * 2);
      return `<line class="chart-grid" x1="${padded}" x2="${width - padded}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line><text class="chart-axis" x="${padded}" y="${(y - 4).toFixed(1)}">${one(value)}</text>`;
    }).join("");
    return `
      <figure class="metric-chart" role="img" aria-label="График: ${escapeHtml(metric.label)}, с ${one(values[0])} до ${one(values[values.length - 1])}">
        <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
          <defs>
            <linearGradient id="metric-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style="stop-color:var(--accent);stop-opacity:.2"></stop>
              <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0"></stop>
            </linearGradient>
          </defs>
          ${grid}
          <path class="chart-area" d="${area}" fill="url(#metric-area)"></path>
          <path class="chart-line" pathLength="1" d="${line}"></path>
          ${points.map((point, index) => `<circle class="chart-dot${index === points.length - 1 ? " chart-dot--last" : ""}" cx="${point[0].toFixed(1)}" cy="${point[1].toFixed(1)}" r="${index === points.length - 1 ? 4 : 2.4}"></circle>`).join("")}
        </svg>
        <figcaption class="chart-caption"><span>${formatShortDate(entries[0].date)}</span><span>${formatShortDate(entries[entries.length - 1].date)}</span></figcaption>
      </figure>`;
  }

  function historyCard() {
    const entries = App.measurements.sorted();
    const columns = (STATE.reportShowAll ? entries.slice().reverse() : entries.slice(-4).reverse());
    const rows = METRICS.map((metric) => {
      const cells = columns.map((entry, index) => {
        const older = columns[index + 1];
        const diff = older ? entry.values[metric.key] - older.values[metric.key] : null;
        const diffText = diff === null ? "" : `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${one(Math.abs(diff))}`;
        return `<td><span class="history-value">${one(entry.values[metric.key])}</span>${diffText ? `<span class="history-diff" aria-label="изменение ${diffText}">(${diffText})</span>` : ""}</td>`;
      }).join("");
      return `<tr><th scope="row">${metric.label}</th>${cells}</tr>`;
    }).join("");
    return `
      <article class="history-card card">
        <div class="card-head">
          <h2 class="card-title">История замеров</h2>
          ${entries.length > 4 ? `<button class="link-button" type="button" data-action="toggle-history">${STATE.reportShowAll ? "Свернуть" : "Показать все"}</button>` : ""}
        </div>
        <div class="history-scroll" tabindex="0" role="region" aria-label="Таблица замеров, прокручивается по горизонтали">
          <table class="history-table">
            <thead><tr><th scope="col">Показатель</th>${columns.map((entry) => `<th scope="col">${formatShortDate(entry.date)}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="history-note">В скобках — изменение к предыдущему замеру.</p>
      </article>`;
  }

  App.views.reports = { view: reportsView, lineChart };
})(window.App = window.App || {});
