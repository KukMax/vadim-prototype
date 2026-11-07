/* «Моя анкета»: компактный просмотр отправленных ответов.
   Здесь только чтение — правка идёт через экран онбординга, поэтому второй
   формы для тех же полей не появляется. Ответы живут в памяти страницы. */
(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const Q = DATA.questionnaire;
  const {
    escapeHtml, icon, plural, weight, num, formatShortDate,
  } = App.util;
  App.views = App.views || {};

  const DASH = "—";

  function labelOf(list, key) {
    const item = list.filter((entry) => entry.key === key)[0];
    return item ? item.label : "";
  }

  function hintOf(list, key) {
    const item = list.filter((entry) => entry.key === key)[0];
    return item && item.hint ? item.hint : "";
  }

  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function textValue(value) {
    const raw = String(value == null ? "" : value).trim();
    return raw ? escapeHtml(raw) : DASH;
  }

  function measure(value, unit) {
    return isNumber(value) ? `${num(value)} ${escapeHtml(unit)}` : DASH;
  }

  function weightValue(value) {
    return isNumber(value) ? `${weight(value)} ${escapeHtml(Q.limits.weight.unit)}` : DASH;
  }

  // at — полный ISO-таймстемп отправки, а подписи нужна только дата.
  function takenAt(value) {
    const raw = String(value == null ? "" : value).trim();
    return raw ? escapeHtml(formatShortDate(raw.slice(0, 10))) : DASH;
  }

  function row(title, value, extraClass) {
    const cls = extraClass ? `questionnaire-value ${extraClass}` : "questionnaire-value";
    // Длинный текст (ограничения, аллергии) читается лучше под подписью, а не
    // справа от неё: такие строки складываются в один столбец.
    const stacked = extraClass && extraClass.indexOf("questionnaire-multiline") !== -1;
    const rowClass = stacked ? "questionnaire-row questionnaire-row--stack" : "questionnaire-row";
    return `<div class="${rowClass}"><dt>${escapeHtml(title)}</dt><dd class="${cls}">${value}</dd></div>`;
  }

  function hint(text) {
    return text ? `<span class="questionnaire-hint">${escapeHtml(text)}</span>` : "";
  }

  function questionnaireCard(title, rows) {
    return `
      <article class="card questionnaire-card">
        <div class="card-head"><h2 class="card-title">${escapeHtml(title)}</h2></div>
        <dl class="questionnaire-list">${rows.join("")}</dl>
      </article>`;
  }

  function asksTarget(q) {
    return q.goal === "lose" || q.goal === "gain";
  }

  function hasNutrition(q) {
    return Array.isArray(q.packages) && q.packages.indexOf("nutrition") !== -1;
  }

  function aboutRows(q) {
    const rows = [
      row("Имя", textValue(q.name)),
      row("Пол", textValue(labelOf(Q.sexes, q.sex))),
      row("Возраст", isNumber(q.age) ? `${num(q.age)} ${plural(q.age, ["год", "года", "лет"])}` : DASH),
      row("Рост", measure(q.height, Q.limits.height.unit)),
      row("Вес", weightValue(q.weight)),
    ];
    if (asksTarget(q)) rows.push(row("Желаемый вес", weightValue(q.targetWeight)));
    return rows;
  }

  function goalRows(q) {
    const label = labelOf(Q.goals, q.goal);
    if (!label) return [row("Цель", DASH)];
    return [row("Цель", `${escapeHtml(label)}${hint(hintOf(Q.goals, q.goal))}`)];
  }

  function trainingRows(q) {
    const sessions = isNumber(q.sessionsPerWeek) ? q.sessionsPerWeek : Q.sessionsPerWeek.value;
    return [
      row("Тренировок в неделю", `${sessions} ${plural(sessions, Q.sessionsPerWeek.forms)}`),
      row("Подготовка", textValue(labelOf(Q.fitnessLevels, q.fitness))),
      row("Активность", textValue(labelOf(Q.activityLevels, q.activity))),
    ];
  }

  function limitationsRows(q) {
    const text = String(q.limitations || "").trim();
    if (q.noLimitations || !text) return [row("Ограничения", "Нет ограничений", "questionnaire-muted")];
    return [row("Ограничения", escapeHtml(text), "questionnaire-multiline")];
  }

  function pickedFoods(foods) {
    const titles = [];
    Q.foodCatalog.forEach((category) => {
      const list = foods && Array.isArray(foods[category.key]) ? foods[category.key] : [];
      list.forEach((title) => titles.push(title));
    });
    return titles;
  }

  function productsValue(q) {
    const titles = pickedFoods(q.foods);
    if (!titles.length) return DASH;
    const count = titles.length;
    const head = `${count} ${plural(count, ["продукт", "продукта", "продуктов"])}`;
    const first = titles.slice(0, 6);
    const rest = titles.length - first.length;
    return `${head}${hint(first.join(", ") + (rest > 0 ? ` и ещё ${rest}` : ""))}`;
  }

  function cookValue(q) {
    const days = q.cookDays && typeof q.cookDays === "object" ? q.cookDays : {};
    return Q.cooking.meals.map((meal) => {
      const value = isNumber(days[meal.key]) ? days[meal.key] : Q.cooking.value;
      return `${meal.title} — ${value} ${plural(value, Q.cooking.forms)}`;
    }).join(" · ");
  }

  function snacksValue(q) {
    const chosen = Array.isArray(q.snacks) ? q.snacks : [];
    return chosen.length ? escapeHtml(chosen.join(", ")) : "Не выбраны";
  }

  function nutritionCard(q) {
    const allergies = String(q.allergies || "").trim();
    const allergyRow = q.noAllergies || !allergies
      ? row("Аллергии", "Нет аллергий", "questionnaire-muted")
      : row("Аллергии", escapeHtml(allergies), "questionnaire-multiline");
    const snackChosen = Array.isArray(q.snacks) && q.snacks.length > 0;
    return questionnaireCard("Питание", [
      row("Продукты", productsValue(q), "questionnaire-multiline"),
      row("Готовка", escapeHtml(cookValue(q)), "questionnaire-multiline"),
      row("Перекусы", snacksValue(q), snackChosen ? "" : "questionnaire-muted"),
      allergyRow,
    ]);
  }

  const PACKAGE_TITLES = { training: "Тренировки", nutrition: "Питание" };

  function packagesCard(q) {
    const packages = Array.isArray(q.packages) ? q.packages : [];
    const chips = packages
      .filter((value) => PACKAGE_TITLES[value])
      .map((value) => `<span class="chip chip--meta">${PACKAGE_TITLES[value]}</span>`);
    return `
      <article class="card questionnaire-card">
        <div class="card-head"><h2 class="card-title">Пакеты</h2></div>
        <div class="questionnaire-chips">${chips.length ? chips.join("") : `<span class="questionnaire-muted">Пакеты не выбраны</span>`}</div>
      </article>`;
  }

  function filledView(q) {
    const note = "Ответы отправленной анкеты живут только в памяти этой страницы — на устройстве они не сохраняются, и после перезагрузки их придётся заполнить заново.";
    return `
      <div class="questionnaire-grid">
        ${questionnaireCard("О себе", aboutRows(q))}
        ${questionnaireCard("Цель", goalRows(q))}
        ${questionnaireCard("Тренировки", trainingRows(q))}
        ${questionnaireCard("Ограничения", limitationsRows(q))}
        ${hasNutrition(q) ? nutritionCard(q) : ""}
        ${packagesCard(q)}
      </div>
      <p class="questionnaire-note">${escapeHtml(note)}</p>
      <div class="questionnaire-actions">
        <button class="btn btn--primary" type="button" data-action="edit-questionnaire">Изменить анкету</button>
      </div>`;
  }

  // После перезагрузки ответов в памяти нет: показываем объяснение вместо
  // пустых строк, чтобы экран не врал про «пустую анкету».
  function emptyView() {
    return `
      <article class="card questionnaire-empty">
        <div class="card-head"><h2 class="card-title">Ответы анкеты не сохраняются на устройстве</h2></div>
        <p class="questionnaire-note">После перезагрузки страницы ответы удаляются — так приватнее. Чтобы увидеть анкету снова, её нужно заполнить заново, а с изменениями рациона и плана поможет Вадим.</p>
        <div class="questionnaire-actions">
          <button class="btn btn--primary" type="button" data-action="open-contact">${icon("message")}Связаться с Вадимом</button>
        </div>
      </article>`;
  }

  function questionnaireView() {
    const q = STATE.questionnaire;
    return `
      <div class="screen-head">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Анкета</span>
        <h1 class="page-title" id="questionnaire-title" tabindex="-1">Моя анкета</h1>
        ${q ? `<p class="page-lead">Отправлена ${takenAt(q.at)}</p>` : ""}
      </div>
      ${q ? filledView(q) : emptyView()}`;
  }

  App.views.questionnaire = { view: questionnaireView };
})(window.App);
