/* Норма питания клиента в кабинете тренера (#/coach-nutrition).
   Расчёт даёт js/calories.js: основной обмен по Миффлину — Сан-Жеору, суточные
   затраты, поправка на цель и стартовые граммы БЖУ. Тренер правит цифры руками;
   правка живёт в памяти (App.state.coachNorms) и исчезает после перезагрузки —
   анкета, фикстуры клиента и демо-нормы не переписываются. */
(function (App) {
  "use strict";

  const { escapeHtml, icon, num, one, plural, weight } = App.util;

  App.views = App.views || {};

  const LIMITS = App.coach.normLimits;

  // Подписи пола, активности и цели лежат в анкете — берём их там же, где
  // формула, чтобы экран не заводил второй словарь.
  function labelOf(group, key) {
    const list = App.data.questionnaire && App.data.questionnaire[group] ? App.data.questionnaire[group] : [];
    const found = list.filter((item) => item.key === key)[0];
    return found ? found.label : "";
  }

  function percentText(value) {
    if (!value) return "0 %";
    return (value > 0 ? "+" : "−") + Math.abs(value) + " %";
  }

  function ageText(age) {
    return age + " " + plural(age, ["год", "года", "лет"]);
  }

  function backLink() {
    return `<a class="coach-back" href="#/coach-client" data-nav="coach-client" data-focus="coach-nutrition-back">${icon("chevron-left")}<span>Клиент</span></a>`;
  }

  function head(client, norm) {
    const input = norm.input;
    const pkg = client.packages.nutrition;
    const meta = [
      labelOf("sexes", input.sex),
      ageText(input.age),
      num(input.height) + " см",
      weight(input.weight) + " кг",
      "пакет " + pkg.used + " из " + pkg.total + " дней",
    ].filter(Boolean).join(" · ");
    return `
      <header class="coach-day-head">
        <p class="coach-client-line">Норма питания</p>
        <h1 class="coach-title" id="coach-nutrition-title" tabindex="-1" data-focus="coach-nutrition-title">${escapeHtml(client.name)}</h1>
        <p class="coach-client-meta">${escapeHtml(meta)}</p>
      </header>`;
  }

  function row(label, value) {
    return `<div class="coach-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  // Расчёт слева, правка справа: на ПК видно, откуда взялась норма и что
  // именно тренер поменял руками.
  function sideBlock(client, norm) {
    const input = norm.input;
    const delta = norm.tdee - norm.kcal;
    const deltaLabel = delta > 0 ? "Дефицит" : delta < 0 ? "Профицит" : "Ровно по затратам";
    const factors = [
      ["Основной обмен", num(norm.bmr) + " ккал"],
      ["Суточные энергозатраты", num(norm.tdee) + " ккал"],
      ["Поправка на цель", percentText(norm.adjustPercent)],
      ["По формуле", num(norm.formulaKcal) + " ккал"],
      [deltaLabel, num(Math.abs(delta)) + " ккал"],
    ];
    const facts = [
      ["Пол", labelOf("sexes", input.sex)],
      ["Возраст", ageText(input.age)],
      ["Рост", num(input.height) + " см"],
      ["Вес", weight(input.weight) + " кг"],
      ["Активность", labelOf("activityLevels", input.activity)],
      ["Цель", labelOf("goals", input.goal)],
    ].filter((item) => item[1]);
    return `
      <div class="coach-norm-side">
        <section class="coach-section card">
          <h2 class="coach-block-title">Расчёт</h2>
          <dl class="coach-rows">${factors.map((item) => row(item[0], item[1])).join("")}</dl>
          <p class="coach-hint">Калорийность — главный параметр: правите её — граммы считаются из долей. Углеводы добираются остатком калорийности.</p>
        </section>
        <section class="coach-section card">
          <h2 class="coach-block-title">Параметры клиента</h2>
          <dl class="coach-rows">${facts.map((item) => row(item[0], item[1])).join("")}</dl>
          <p class="coach-hint">Пол, возраст, рост и активность — из анкеты, если она заполнена; иначе из карточки клиента. Вес — текущий замер.</p>
        </section>
      </div>`;
  }

  function numField(field, label, value) {
    const id = "coach-norm-" + field;
    return `
      <div class="coach-field">
        <label class="coach-field-label" for="${id}">${escapeHtml(label)}</label>
        <input class="coach-input coach-input--num" id="${id}" name="${field}" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(value)}" data-norm-field="${field}" data-focus="coach-norm-${field}">
      </div>`;
  }

  // Граммы, доля и производные граммы на кг стоят в одной строке макроса:
  // видно, какая цифра откуда взялась.
  function macroRow(draft, derived, macro, label) {
    const key = macro.toLowerCase();
    const outKey = "perKg" + macro;
    return `
        <div class="coach-norm-macro">
          <div class="coach-norm-macro-head">
            <span class="coach-norm-macro-name">${escapeHtml(label)}</span>
            <span class="coach-hint"><output data-norm-out="${outKey}">${one(derived.perKg[key])}</output> г/кг</span>
          </div>
          ${numField(key, "Граммы, г", draft[key])}
          ${numField("percent" + macro, "Доля, %", draft["percent" + macro])}
        </div>`;
  }

  function diffText(value) {
    return (value > 0 ? "+" : value < 0 ? "−" : "") + num(Math.abs(value)) + " ккал";
  }

  function formBlock(client, norm, draft) {
    const derived = App.coach.normDerived(draft, client);
    const hint = Math.abs(derived.diff) <= 60 ? " hidden" : "";
    const source = norm.source === "coach" ? "правка тренера" : "по формуле";
    // Черновик мог остаться от прошлой отрисовки (например, после отказа
    // валидации): кнопка обязана показывать, есть ли что сохранять.
    const dirty = !App.coach.sameNormDraft(draft, App.coach.normDraft(client.id));
    const used = client.packages.nutrition.used;
    const reset = App.coach.hasNorm(client.id)
      ? `
        <button class="btn btn--ghost coach-norm-reset" type="button" data-action="coach-norm-reset" data-focus="coach-norm-reset">Сбросить к расчёту</button>`
      : "";
    return `
      <form class="coach-section card coach-norm-form" data-norm-form novalidate>
        <div class="coach-norm-form-head">
          <h2 class="coach-block-title">Норма на день</h2>
          <span class="coach-badge">${escapeHtml(source)}</span>
        </div>
        ${numField("kcal", "Калорийность, ккал", draft.kcal)}
        <p class="coach-hint">От ${LIMITS.kcalMin} до ${LIMITS.kcalMax} ккал. Меняете калорийность — граммы пересчитываются по текущим долям; меняете граммы или доли — калорийность собирается по 4/9/4.</p>
        <div class="coach-norm-macros">
          ${macroRow(draft, derived, "Protein", "Белки")}
          ${macroRow(draft, derived, "Fat", "Жиры")}
          ${macroRow(draft, derived, "Carbs", "Углеводы")}
        </div>
        <dl class="coach-rows coach-norm-totals">
          <div class="coach-row"><dt>Сумма БЖУ</dt><dd><output data-norm-out="sum">${num(derived.macroKcal)} ккал</output></dd></div>
          <div class="coach-row"><dt>Расхождение с калорийностью</dt><dd><output data-norm-out="diff">${diffText(derived.diff)}</output></dd></div>
        </dl>
        <p class="coach-hint" data-norm-diff-hint${hint}>Сумма БЖУ расходится с калорийностью больше чем на 60 ккал — поправьте граммы или доли.</p>
        <div class="coach-norm-pair">
          ${numField("water", "Вода, стаканов", draft.water)}
          ${numField("durationDays", "Срок, дней", draft.durationDays)}
        </div>
        <p class="coach-hint">Вода от ${LIMITS.waterMin} до ${LIMITS.waterMax} стаканов; срок от ${LIMITS.durationMin} до ${LIMITS.durationMax} дней и не меньше пройденного — сейчас это ${used} ${plural(used, ["день", "дня", "дней"])}.</p>
        <div class="coach-savebar${dirty ? " is-dirty" : ""}">
          <button class="btn btn--ghost" type="button" data-action="coach-norm-cancel" data-focus="coach-norm-cancel">Отмена</button>
          <button class="btn btn--primary" type="submit"${dirty ? "" : " disabled aria-disabled=\"true\""}>Сохранить</button>
        </div>${reset}
      </form>`;
  }

  function coachNutritionView() {
    const client = App.coach.find(App.state.coachClientId);
    // guardRoute() уже увёл бы без клиента; ветка — страховка для прямого render().
    if (!client) {
      return `<div class="coach">${backLink()}<p class="coach-lead">Клиент не выбран.</p></div>`;
    }
    const norm = App.coach.nutritionNorm(client);
    const draft = App.state.coachNormDraft || App.coach.normDraft(client.id);
    // Норма помнится только в памяти: об этом честно сказано баннером, чтобы
    // тренер не ждал её после перезагрузки.
    const banner = `<p class="coach-mode-banner" role="status">Норма хранится в памяти и исчезнет после перезагрузки страницы. Главная и Питание клиента считают норму из анкеты — правка видна только в кабинете тренера.</p>`;
    return `
    <div class="coach coach-nutrition-page">
      ${backLink()}
      ${head(client, norm)}
      ${banner}
      <div class="coach-norm">
        ${sideBlock(client, norm)}
        <div class="coach-norm-main">${formBlock(client, norm, draft)}</div>
      </div>
    </div>`;
  }

  App.views["coach-nutrition"] = { view: coachNutritionView };
})(window.App = window.App || {});
