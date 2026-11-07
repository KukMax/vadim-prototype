/* Экран онбординга: шаг 1 «О себе», шаг 2 «Выбор пакета» и шаг 3 «Предпочтения в питании».
   Поля живут в STATE.onboarding.data; ввод не перерисовывает экран. */
(function (App) {
  "use strict";

  const DATA = App.data;
  const STATE = App.state;
  const UI = App.publicUi;
  const { escapeHtml, icon, plural } = App.util;
  const Q = DATA.questionnaire;

  function fieldError(key) {
    return `<p class="field-error" id="onboarding-${key}-error" aria-live="polite" hidden></p>`;
  }

  function value(key) {
    return escapeHtml(String(STATE.onboarding.data[key] == null ? "" : STATE.onboarding.data[key]));
  }

  function textField(config) {
    return `
      <div class="pub-field" data-field="${config.key}">
        <label class="pub-label" for="onboarding-${config.key}">${config.label}</label>
        <input class="input" id="onboarding-${config.key}" name="${config.key}" type="text"
          value="${value(config.key)}"${config.attrs || ""} aria-describedby="onboarding-${config.key}-error">
        ${fieldError(config.key)}
      </div>`;
  }

  // Желаемый вес нужен только целям «похудеть» и «набрать»: у «поддерживать»
  // поле скрыто, целевой вес равен текущему.
  function asksTargetWeight() {
    const goal = STATE.onboarding.data.goal;
    return goal === "lose" || goal === "gain";
  }

  function targetWeightField() {
    const available = asksTargetWeight();
    return `
      <div class="pub-field" data-field="targetWeight"${available ? "" : " hidden"}>
        <label class="pub-label" for="onboarding-target-weight">Желаемый вес, кг</label>
        <input class="input" id="onboarding-target-weight" name="targetWeight" type="text"
          inputmode="decimal" maxlength="5" placeholder="65" value="${value("targetWeight")}"
          aria-describedby="onboarding-targetWeight-error">
        ${fieldError("targetWeight")}
      </div>`;
  }

  function optionMarkup(name, option, hint) {
    const checked = STATE.onboarding.data[name] === option.key;
    return `
      <label class="ob-option">
        <input class="ob-option-input" type="radio" name="${name}" value="${option.key}"${checked ? " checked" : ""}>
        <span class="ob-option-body">
          <span class="ob-option-mark" aria-hidden="true">${icon("check")}</span>
          <span class="ob-option-copy">
            <span class="ob-option-title">${escapeHtml(option.label)}</span>
            ${hint && option.hint ? `<span class="ob-option-hint">${escapeHtml(option.hint)}</span>` : ""}
          </span>
        </span>
      </label>`;
  }

  function pillMarkup(name, option) {
    const checked = STATE.onboarding.data[name] === option.key;
    return `
      <label class="ob-option">
        <input class="ob-option-input" type="radio" name="${name}" value="${option.key}"${checked ? " checked" : ""}>
        <span class="ob-option-body">
          <span class="ob-option-copy"><span class="ob-option-title">${escapeHtml(option.label)}</span></span>
        </span>
      </label>`;
  }

  function group(config) {
    const items = config.options
      .map((option) => (config.pill ? pillMarkup(config.key, option) : optionMarkup(config.key, option, config.hints)))
      .join("");
    return `
      <fieldset class="ob-fieldset pub-field" data-field="${config.key}" aria-required="true" aria-describedby="onboarding-${config.key}-error">
        <legend class="pub-label">${config.label}</legend>
        <div class="ob-choices${config.row ? " ob-choices--row" : ""}">${items}</div>
        ${fieldError(config.key)}
      </fieldset>`;
  }

  function sessionsText(count) {
    return `${count} ${plural(Number(count), Q.sessionsPerWeek.forms)} в неделю`;
  }

  function rangeField() {
    const raw = STATE.onboarding.data.sessionsPerWeek;
    const current = Math.min(Q.sessionsPerWeek.max, Math.max(Q.sessionsPerWeek.min, Number(raw) || Q.sessionsPerWeek.value));
    const ticks = [];
    for (let i = Q.sessionsPerWeek.min; i <= Q.sessionsPerWeek.max; i += Q.sessionsPerWeek.step) {
      ticks.push(`<span>${i}</span>`);
    }
    return `
      <div class="pub-field" data-field="sessionsPerWeek">
        <label class="pub-label" for="onboarding-sessions">Планируемое число тренировок в неделю</label>
        <div class="ob-range">
          <input class="ob-range-input" id="onboarding-sessions" name="sessionsPerWeek" type="range"
            min="${Q.sessionsPerWeek.min}" max="${Q.sessionsPerWeek.max}" step="${Q.sessionsPerWeek.step}"
            value="${current}" aria-describedby="onboarding-sessions-value">
          <div class="ob-range-ticks" aria-hidden="true">${ticks.join("")}</div>
        </div>
        <p class="ob-range-value" id="onboarding-sessions-value" data-role="sessions-value" aria-live="polite">${sessionsText(current)}</p>
        ${fieldError("sessionsPerWeek")}
      </div>`;
  }

  function limitationsField() {
    const data = STATE.onboarding.data;
    const disabled = data.noLimitations ? " disabled" : "";
    return `
      <div class="pub-field" data-field="limitations">
        <label class="pub-label" for="onboarding-limitations">Травмы и ограничения по здоровью</label>
        <textarea class="ob-textarea" id="onboarding-limitations" name="limitations" rows="3"
          maxlength="${Q.limits.limitations.max}" placeholder="Например: травма колена, боли в пояснице"
          aria-describedby="onboarding-limitations-hint onboarding-limitations-error"${disabled}>${value("limitations")}</textarea>
        <div class="ob-chip-row">
          <button class="ob-chip" id="onboarding-no-limits" type="button" data-action="onboarding-no-limits" aria-pressed="${data.noLimitations ? "true" : "false"}">
            ${icon("check")}<span>Нет ограничений</span>
          </button>
        </div>
        <p class="pub-hint" id="onboarding-limitations-hint">Необязательно. Опишите травмы, боли и запреты врача — тренер учтёт их в программе.</p>
        ${fieldError("limitations")}
      </div>`;
  }

  function stepOneForm() {
    return `
      <form class="card ob-form" id="onboarding-form" data-form="onboarding" novalidate>
        ${textField({ key: "name", label: "Имя", attrs: ' autocomplete="name" maxlength="40" placeholder="Как к вам обращаться"' })}
        ${textField({ key: "phone", label: "Телефон", attrs: ' autocomplete="tel" inputmode="tel" maxlength="18" placeholder="+7 900 000-00-00"' })}
        ${group({ key: "sex", label: "Пол", options: Q.sexes, row: true, pill: true })}
        <div class="ob-row">
          ${textField({ key: "height", label: "Рост, см", attrs: ' inputmode="numeric" maxlength="3" placeholder="180"' })}
          ${textField({ key: "weight", label: "Вес, кг", attrs: ' inputmode="decimal" maxlength="5" placeholder="72,5"' })}
        </div>
        ${targetWeightField()}
        ${textField({ key: "age", label: "Возраст, лет", attrs: ' inputmode="numeric" maxlength="3" placeholder="32"' })}
        ${group({ key: "goal", label: "Цель", options: Q.goals, hints: true })}
        ${rangeField()}
        ${group({ key: "fitness", label: "Уровень подготовки", options: Q.fitnessLevels, hints: true })}
        ${group({ key: "activity", label: "Уровень активности", options: Q.activityLevels, hints: true })}
        ${limitationsField()}
      </form>`;
  }

  // Правка анкеты переиспользует этот же экран: шаг 2 скрыт, пакет не меняется.
  function editing() {
    return App.onboarding.isEditing();
  }

  function visibleSteps() {
    const nutrition = App.onboarding.hasNutrition();
    if (editing()) return nutrition ? [1, 3] : [1];
    return nutrition ? [1, 2, 3] : [1, 2];
  }

  function cancelButton() {
    return `<button class="btn btn--ghost" type="button" data-action="cancel-questionnaire">${icon("chevron-left")}Отмена</button>`;
  }

  function stepOneActions() {
    if (editing()) {
      const last = !App.onboarding.hasNutrition();
      const next = last
        ? `<button class="btn btn--primary" type="button" data-action="save-questionnaire">Сохранить изменения</button>`
        : `<button class="btn btn--primary" type="submit" form="onboarding-form">Далее</button>`;
      return `
      <div class="pub-sticky ob-actions">
        <div class="ob-actions-inner">
          ${cancelButton()}
          ${next}
        </div>
      </div>`;
    }
    return `
      <div class="pub-sticky ob-actions">
        <div class="ob-actions-inner">
          <button class="btn btn--primary" type="submit" form="onboarding-form">Далее</button>
        </div>
      </div>`;
  }

  // Шаг 2: пакеты. Порядок карточек фиксирован, цены не показываем —
  // стоимость и оплату обсуждает Вадим.
  const PACKAGES = [
    { value: "training", title: "Тренировки", text: "Персональный план из 12 тренировок на 30 дней" },
    { value: "nutrition", title: "Питание", text: "Меню на 30 дней, рецепты, КБЖУ и рекомендации по спортпиту и витаминам" },
    { value: "both", title: "Тренировки + Питание", text: "Тренировки и питание вместе" },
  ];

  function selectedPackage() {
    const packages = STATE.onboarding.packages;
    const training = packages.indexOf("training") !== -1;
    const nutrition = packages.indexOf("nutrition") !== -1;
    if (nutrition) return training ? "both" : "nutrition";
    return "training";
  }

  function packageCard(item, checked) {
    return `
      <label class="ob-option">
        <input class="ob-option-input" type="radio" name="package" value="${item.value}"${checked ? " checked" : ""}>
        <span class="ob-option-body">
          <span class="ob-option-mark" aria-hidden="true">${icon("check")}</span>
          <span class="ob-option-copy">
            <span class="ob-option-title">${item.title}</span>
            <span class="ob-option-hint">${item.text}</span>
          </span>
        </span>
      </label>`;
  }

  function stepTwo() {
    const selected = selectedPackage();
    return `
      <div class="ob-packages" role="radiogroup" aria-label="Пакет занятий">
        ${PACKAGES.map((item) => packageCard(item, item.value === selected)).join("")}
      </div>
      <p class="ob-package-note">Вадим ответит в течение суток и подскажет, как оплатить.</p>`;
  }

  function stepTwoActions() {
    const next = STATE.onboarding.packages.indexOf("nutrition") !== -1;
    return `
      <div class="pub-sticky ob-actions">
        <div class="ob-actions-inner">
          <button class="btn btn--ghost" type="button" data-action="onboarding-back">${icon("chevron-left")}Назад</button>
          ${next
            ? `<button class="btn btn--primary" type="button" data-action="onboarding-next">Далее</button>`
            : `<button class="btn btn--primary" type="button" data-action="submit-onboarding" aria-live="polite">Отправить анкету</button>`}
        </div>
      </div>`;
  }

  // ---- Шаг 3 «Предпочтения в питании» ----
  // Чипы продуктов и блюд — настоящие чекбоксы. Переключение меняет только
  // чип и счётчики (см. обработчики в app.js), без перерисовки экрана.

  function selectedFoods(key) {
    const list = STATE.onboarding.data.foods[key];
    return Array.isArray(list) ? list : [];
  }

  function offDishes(key) {
    const list = STATE.onboarding.data.dishesOff[key];
    return Array.isArray(list) ? list : [];
  }

  function foodTotal() {
    return Q.foodCatalog.reduce((sum, category) => sum + selectedFoods(category.key).length, 0);
  }

  function dishTotal() {
    return Q.dishes.reduce((sum, group) => sum + group.items.length - offDishes(group.key).length, 0);
  }

  function pickMarkup(role, group, title, index, checked) {
    return `
      <label class="ob-pick">
        <input class="ob-pick-input" type="checkbox" id="ob-${role}-${group}-${index}"
          name="${role}-${group}" value="${escapeHtml(title)}"
          data-role="${role}" data-group="${group}"${checked ? " checked" : ""}>
        <span class="ob-pick-body">
          <span class="ob-pick-mark" aria-hidden="true">${icon("check")}</span>
          <span class="ob-pick-title">${escapeHtml(title)}</span>
        </span>
      </label>`;
  }

  // Категория продуктов: заголовок-аккордеон, счётчик «3 из 12» и чипы.
  function foodCategory(category) {
    const selected = selectedFoods(category.key);
    const open = category.key === Q.foodCatalog[0].key;
    const missing = Boolean(category.required) && selected.length === 0;
    return `
      <div class="ob-cat" data-cat="${category.key}">
        <button class="ob-cat-head" type="button" data-action="toggle-cat" data-cat="${category.key}"
          aria-expanded="${open}" aria-controls="ob-cat-${category.key}">
          <span class="ob-cat-title">${escapeHtml(category.title)}
            <span class="ob-req" data-req="${category.key}"${missing ? "" : " hidden"}>обязательно</span>
          </span>
          <span class="ob-count" data-role="cat-count-${category.key}">${selected.length} из ${category.items.length}</span>
          <span class="ob-cat-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="ob-cat-panel" id="ob-cat-${category.key}"${open ? "" : " hidden"}>
          ${category.hint ? `<p class="ob-cat-hint">${escapeHtml(category.hint)}</p>` : ""}
          <div class="ob-picks">
            ${category.items.map((title, index) => pickMarkup("food", category.key, title, index, selected.indexOf(title) !== -1)).join("")}
          </div>
          <div class="ob-cat-actions">
            <button class="link-btn" type="button" data-action="cat-all" data-cat="${category.key}">Выбрать все</button>
            <button class="link-btn" type="button" data-action="cat-none" data-cat="${category.key}">Снять все</button>
          </div>
        </div>
      </div>`;
  }

  function foodCard() {
    return `
      <section class="card ob-card" data-card="products">
        <button class="ob-card-head" type="button" data-action="toggle-card" data-card="products"
          aria-expanded="true" aria-controls="ob-panel-products">
          <span class="ob-card-titles">
            <span class="ob-card-title">Продукты</span>
            <span class="ob-card-hint">Отметьте то, что готовы есть</span>
          </span>
          <span class="ob-count" data-role="card-count-products">${foodTotal()}</span>
          <span class="ob-card-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="ob-card-panel" id="ob-panel-products">
          <div class="ob-search">
            <label class="sr-only" for="ob-food-search">Поиск по продуктам</label>
            <input class="input ob-search-input" id="ob-food-search" type="search" placeholder="Найти продукт"
              autocomplete="off" data-role="food-search">
            <button class="link-btn" type="button" data-action="food-search-clear" hidden>Очистить</button>
          </div>
          <p class="ob-empty" id="ob-food-empty" hidden>Ничего не найдено</p>
          ${fieldError("grains")}
          ${Q.foodCatalog.map(foodCategory).join("")}
        </div>
      </section>`;
  }

  // Сколько дней подряд готовить одно и то же блюдо: −/значение/+.
  function cookRow(meal) {
    const days = STATE.onboarding.data.cookDays[meal.key] || Q.cooking.value;
    const atMin = days <= Q.cooking.min;
    const atMax = days >= Q.cooking.max;
    return `
      <div class="ob-stepper-row">
        <span class="ob-stepper-label" id="ob-cook-${meal.key}-label">${escapeHtml(meal.title)}</span>
        <div class="ob-stepper" role="group" aria-labelledby="ob-cook-${meal.key}-label">
          <button class="ob-step-btn" type="button" data-action="cook-step" data-meal="${meal.key}" data-delta="-1"
            aria-label="Меньше дней: ${escapeHtml(meal.title)}"${atMin ? " disabled" : ""}>−</button>
          <output class="ob-step-value" data-role="cook-value-${meal.key}">${days} ${plural(days, Q.cooking.forms)}</output>
          <button class="ob-step-btn" type="button" data-action="cook-step" data-meal="${meal.key}" data-delta="1"
            aria-label="Больше дней: ${escapeHtml(meal.title)}"${atMax ? " disabled" : ""}>+</button>
        </div>
      </div>`;
  }

  function cookingCard() {
    const chosen = STATE.onboarding.data.snacks;
    return `
      <section class="card ob-card" data-card="cooking">
        <button class="ob-card-head" type="button" data-action="toggle-card" data-card="cooking"
          aria-expanded="true" aria-controls="ob-panel-cooking">
          <span class="ob-card-titles">
            <span class="ob-card-title">Готовка</span>
            <span class="ob-card-hint">Ритм приготовления и перекусы</span>
          </span>
          <span class="ob-card-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="ob-card-panel" id="ob-panel-cooking">
          <p class="ob-card-note">Сколько дней подряд вы готовы есть одно и то же — от этого зависит, как часто нужно готовить</p>
          ${Q.cooking.meals.map(cookRow).join("")}
          <p class="ob-subtitle">Перекусы</p>
          <div class="ob-picks ob-picks--chips" role="group" aria-label="Перекусы">
            ${Q.snacks.map((snack, index) => pickMarkup("snack", "snacks", snack.title, index, chosen.indexOf(snack.title) !== -1)).join("")}
          </div>
        </div>
      </section>`;
  }

  // Группа блюд: все отмечены, кроме снятых; счётчик «8 из 8».
  function dishGroup(group) {
    const off = offDishes(group.key);
    const checked = group.items.length - off.length;
    const open = group.key === Q.dishes[0].key;
    const missing = Boolean(group.required) && checked === 0;
    return `
      <div class="ob-cat" data-group="${group.key}">
        <button class="ob-cat-head" type="button" data-action="toggle-cat" data-cat="${group.key}"
          aria-expanded="${open}" aria-controls="ob-dishes-${group.key}">
          <span class="ob-cat-title">${escapeHtml(group.title)}
            <span class="ob-req" data-req="${group.key}"${missing ? "" : " hidden"}>обязательно</span>
          </span>
          <span class="ob-count" data-role="dish-count-${group.key}">${checked} из ${group.items.length}</span>
          <span class="ob-cat-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="ob-cat-panel" id="ob-dishes-${group.key}"${open ? "" : " hidden"}>
          <div class="ob-picks">
            ${group.items.map((title, index) => pickMarkup("dish", group.key, title, index, off.indexOf(title) === -1)).join("")}
          </div>
          <div class="ob-cat-actions">
            <button class="link-btn" type="button" data-action="dish-all" data-cat="${group.key}">Выбрать все</button>
            <button class="link-btn" type="button" data-action="dish-none" data-cat="${group.key}">Снять все</button>
          </div>
        </div>
      </div>`;
  }

  function dishesCard() {
    return `
      <section class="card ob-card" data-card="dishes">
        <button class="ob-card-head" type="button" data-action="toggle-card" data-card="dishes"
          aria-expanded="true" aria-controls="ob-panel-dishes">
          <span class="ob-card-titles">
            <span class="ob-card-title">Блюда</span>
            <span class="ob-card-hint">Что оставить в рационе</span>
          </span>
          <span class="ob-count" data-role="card-count-dishes">${dishTotal()}</span>
          <span class="ob-card-chevron" aria-hidden="true">${icon("chevron-down")}</span>
        </button>
        <div class="ob-card-panel" id="ob-panel-dishes">
          <p class="ob-card-note">Все блюда выбраны. Снимите галочки с тех, что не любите или не едите.</p>
          ${fieldError("dishes")}
          ${Q.dishes.map(dishGroup).join("")}
        </div>
      </section>`;
  }

  function allergiesCard() {
    const data = STATE.onboarding.data;
    return `
      <section class="card ob-card ob-allergies">
        <h2 class="ob-card-title">Аллергии и непереносимость продуктов</h2>
        <div class="pub-field" data-field="allergies">
          <label class="pub-label" for="onboarding-allergies">Аллергии и непереносимость</label>
          <textarea class="ob-textarea" id="onboarding-allergies" name="allergies" rows="3"
            maxlength="${Q.allergies.max}"
            aria-describedby="onboarding-allergies-hint onboarding-allergies-error">${escapeHtml(data.allergies)}</textarea>
          <p class="pub-hint" id="onboarding-allergies-hint">Необязательно. Укажите аллергии и непереносимость продуктов.</p>
          ${fieldError("allergies")}
        </div>
        <div class="ob-chip-row">
          <button class="ob-chip" type="button" id="onboarding-no-allergies"
            data-action="onboarding-no-allergies" aria-pressed="${data.noAllergies ? "true" : "false"}">Нет аллергий</button>
        </div>
      </section>`;
  }

  function stepThree() {
    return `
      <div class="ob-food">
        ${foodCard()}
        ${cookingCard()}
        ${dishesCard()}
        ${allergiesCard()}
      </div>`;
  }

  function stepThreeActions() {
    if (editing()) {
      return `
      <div class="pub-sticky ob-actions">
        <div class="ob-actions-inner">
          ${cancelButton()}
          <button class="btn btn--primary" type="button" data-action="save-questionnaire">Сохранить изменения</button>
        </div>
      </div>`;
    }
    return `
      <div class="pub-sticky ob-actions">
        <div class="ob-actions-inner">
          <button class="btn btn--ghost" type="button" data-action="onboarding-back">${icon("chevron-left")}Назад</button>
          <button class="btn btn--primary" type="button" data-action="submit-onboarding" aria-live="polite">Отправить анкету</button>
        </div>
      </div>`;
  }

  // Живая строка под заголовком: сколько выбрано продуктов и блюд.
  function liveLine() {
    return `<p class="ob-live" id="ob-selection" aria-live="polite">Выбрано продуктов: ${foodTotal()} · блюд: ${dishTotal()}</p>`;
  }

  function onboardingView() {
    const step = App.onboarding.step();
    const edit = editing();
    const steps = visibleSteps();
    const index = Math.max(0, steps.indexOf(step)) + 1;
    const total = steps.length;
    const percent = Math.round((index / total) * 100);
    const leads = edit
      ? {
        1: "Измените ответы и сохраните — анкета уйдёт Вадиму в обновлённом виде.",
        3: "Отметьте, что изменилось, и сохраните — рацион обновится.",
      }
      : {
        1: "Расскажите о себе — это займёт минуту. Ответы нужны, чтобы подобрать нагрузку и питание.",
        2: "Профиль готов. Выберите пакет — состав можно обсудить с Вадимом до оплаты.",
        3: "Чем больше вы отметите продуктов, тем разнообразнее будет рацион.",
      };
    const title = edit ? "Моя анкета" : step === 3 ? "Предпочтения в питании" : "Анкета";
    const body = step === 1
      ? stepOneForm() + stepOneActions()
      : step === 2
        ? stepTwo() + stepTwoActions()
        : stepThree() + stepThreeActions();
    return `
      <div class="pub pub--auth pub--onboarding">
        <header class="pub-topbar">
          <a class="pub-topbar-brand" href="#/welcome" aria-label="Trenio — на страницу входа">${UI.logoLockup("sm")}</a>
          <div class="pub-topbar-actions">${edit ? "" : `<button class="icon-button" type="button" data-action="leave-onboarding" aria-label="Выйти из анкеты">${icon("x")}</button>`}${UI.themeToggle()}</div>
        </header>
        <div class="pub-body">
          <div class="ob-step">
            <p class="ob-step-label" id="onboarding-step-label">Шаг ${index} из ${total}</p>
            <div class="ob-progress" role="progressbar" aria-labelledby="onboarding-step-label" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${index}">
              <span class="ob-progress-fill" style="width:${percent}%"></span>
            </div>
          </div>
          <h1 class="pub-title" id="onboarding-title" tabindex="-1">${title}</h1>
          <p class="pub-lead">${leads[step]}</p>
          ${edit ? `<p class="pub-note">Пакет занятий при правке не меняется — если нужно добавить или убрать пакет, напишите Вадиму.</p>` : ""}
          ${step === 3 ? liveLine() : ""}
          ${body}
          <p class="pub-note">Ответы анкеты хранятся только в памяти страницы и не сохраняются на устройстве.</p>
          ${UI.footer()}
        </div>
      </div>`;
  }

  App.views.onboarding = { view: onboardingView };
})(window.App = window.App || {});
