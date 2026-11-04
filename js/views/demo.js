(function (App) {
  "use strict";

  App.views = App.views || {};

  const DATA = App.data;
  const UI = App.publicUi;
  const { icon, num, one, percent, planTotals } = App.util;
  const { ringMarkup } = App.ui;

  // Другие вьюхи читаем только в момент вызова: порядок <script> может быть любым.
  const workouts = () => App.views.workouts;
  const nutrition = () => App.views.nutrition;
  const reports = () => App.views.reports;

  const CYCLE = DATA.demoCycle;
  const SESSION = DATA.demoSession;
  const DAY = 0;

  function nutritionCard() {
    const plan = planTotals(DAY);
    const target = DATA.targets;
    const macros = [
      ["Белки", plan.p, target.protein],
      ["Жиры", plan.f, target.fat],
      ["Углеводы", plan.c, target.carbs],
    ].map((row) => `
      <div class="demo-macro">
        <span>${row[0]}</span>
        <b>${one(row[1])} <span>/ ${one(row[2])} г</span></b>
      </div>`).join("");
    return `
      <article class="card demo-ring-card">
        <div class="demo-ring">
          ${ringMarkup(percent(plan.kcal, target.kcal), { size: 96, stroke: 8, label: `<b>${num(plan.kcal)}</b><span>ккал</span>` })}
        </div>
        <div class="demo-ring-copy">
          <h3 class="card-title">План на день</h3>
          <p class="demo-ring-text">Пять приёмов пищи — без подсчёта вручную: меню уже собрано под норму.</p>
          <div class="demo-macros">${macros}</div>
        </div>
      </article>`;
  }

  function progressCard() {
    const rows = DATA.measurementsSeed.slice(-8);
    return `
      <article class="card demo-progress-card">
        <div class="demo-progress-head">
          <h3 class="card-title">Вес, кг</h3>
          <span class="demo-progress-delta">−5,6 кг за 7 недель</span>
        </div>
        <div class="demo-chart" role="img" aria-label="График веса: с 92,0 до 86,4 кг за семь недель">
          ${reports().lineChart({ key: "weight", label: "Вес" }, rows)}
        </div>
        <p class="demo-progress-note">Раз в неделю вы вносите замеры — Вадим видит динамику и корректирует план.</p>
      </article>`;
  }

  function demoView() {
    const meals = DATA.menus[DAY];
    return `
      <div class="pub pub--demo">
        <header class="pub-topbar">
          <a class="pub-topbar-brand" href="#/welcome" aria-label="Trenio — фитнес тренер Вадим, на страницу входа">
            ${UI.logoLockup("sm")}
          </a>
          <div class="pub-topbar-actions">
            <a class="btn btn--ghost pub-login" href="#/welcome">Войти</a>
            ${UI.themeToggle()}
          </div>
        </header>

        <div class="pub-body">
          <h1 class="sr-only" id="demo-title" tabindex="-1">Демо-кабинет</h1>
          ${UI.backLink("welcome", "Назад")}
          ${UI.notice()}

          <section class="pub-section" id="demo-workout" aria-labelledby="demo-workout-title">
            <div class="pub-section-head">
              <h2 class="pub-h2" id="demo-workout-title">Тренировка</h2>
              <p class="pub-section-sub">${icon("dumbbell")}Одна тренировка из плана — так выглядит ваша неделя.</p>
            </div>
            ${workouts().sessionCard(CYCLE, SESSION, "demo")}
            ${workouts().blocksView(CYCLE, SESSION, "demo")}
          </section>

          <section class="pub-section" aria-labelledby="demo-food-title">
            <div class="pub-section-head">
              <h2 class="pub-h2" id="demo-food-title">Питание на день</h2>
              <p class="pub-section-sub">${icon("apple")}Меню под вашу норму калорий и белка.</p>
            </div>
            ${nutritionCard()}
            <div class="demo-meals">
              ${meals.map((dishes, index) => nutrition().mealCard(DAY, index, dishes, true)).join("")}
            </div>
          </section>

          <section class="pub-section" aria-labelledby="demo-progress-title">
            <div class="pub-section-head">
              <h2 class="pub-h2" id="demo-progress-title">Прогресс</h2>
              <p class="pub-section-sub">${icon("chart")}Замеры раз в неделю — видно, что план работает.</p>
            </div>
            ${progressCard()}
          </section>

          <article class="card pub-cta">
            <h2 class="card-title">Готовы начать?</h2>
            <p class="pub-cta-text">Зарегистрируйтесь, заполните анкету — Вадим составит персональный план.</p>
            <a class="btn btn--primary" href="#/register">Зарегистрироваться</a>
          </article>

          ${UI.footer()}
        </div>

        <div class="pub-sticky" data-role="demo-bar" hidden>
          <a class="btn btn--primary pub-sticky-btn" href="#/register">Зарегистрироваться</a>
        </div>
      </div>`;
  }

  App.views.demo = { view: demoView };
})(window.App = window.App || {});
