(function (App) {
  "use strict";

  // План питания на 30 дней. Меню-шаблонов семь, поэтому дни собираются
  // блоками по 7 из перемешанных шаблонов, а порции масштабируются под норму
  // калорий. Новых блюд здесь нет: всё берётся из DATA.menus.
  const DATA = App.data;
  const { NOW, addDays, clamp } = App.util;

  const LENGTH = DATA.planDays;
  const TEMPLATES = DATA.menus.length;
  // Фиксированное зерно: план одинаков при каждой загрузке страницы.
  const SEED = 20261107;
  const SCALE_MIN = 0.85;
  const SCALE_MAX = 1.15;

  // Линейный конгруэнтный генератор: обычный Math.random() дал бы разное
  // меню после каждой перезагрузки, а план должен быть стабильным.
  function createRandom(seed) {
    let value = seed >>> 0;
    return function next() {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function shuffledBlock(random) {
    const order = Array.from({ length: TEMPLATES }, (_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      const value = order[index];
      order[index] = order[swap];
      order[swap] = value;
    }
    return order;
  }

  // Порядок шаблонов на все 30 дней: блоки по 7, на стыке блоков один и тот
  // же шаблон не идёт два дня подряд.
  function templateOrder() {
    const random = createRandom(SEED);
    const order = [];
    while (order.length < LENGTH) {
      const block = shuffledBlock(random);
      const previous = order[order.length - 1];
      if (previous !== undefined && block[0] === previous) {
        const swap = block[0];
        block[0] = block[1];
        block[1] = swap;
      }
      order.push.apply(order, block);
    }
    return order.slice(0, LENGTH);
  }

  // Без App.calories (и до заполнения анкеты) масштабировать не к чему:
  // тогда работает базовая норма из DATA.targets.
  function targetCalories() {
    if (!App.calories) return DATA.targets.kcal;
    const value = Number(App.calories.target());
    return Number.isFinite(value) && value > 0 ? value : DATA.targets.kcal;
  }

  function dayKcal(template) {
    return template.reduce((total, meal) => total + meal.reduce((sum, dish) => sum + dish.k, 0), 0);
  }

  function scaleDish(dish, scale) {
    const p = Math.round(dish.p * scale * 10) / 10;
    const f = Math.round(dish.f * scale * 10) / 10;
    const c = Math.round(dish.c * scale * 10) / 10;
    return {
      n: dish.n,
      g: Math.round((dish.g * scale) / 5) * 5,
      p,
      f,
      c,
      k: Math.round(p * 4 + f * 9 + c * 4),
    };
  }

  // День плана — это копии блюд: DATA.menus не мутируется, иначе демо-кабинет
  // и рецепты показывали бы чужие граммы.
  function buildDay(templateIndex, target) {
    const template = DATA.menus[templateIndex];
    const sum = dayKcal(template);
    const scale = clamp(sum > 0 ? target / sum : 1, SCALE_MIN, SCALE_MAX);
    return template.map((meal) => meal.map((dish) => scaleDish(dish, scale)));
  }

  const clampIndex = (value) => {
    const number = Math.floor(Number(value));
    return clamp(Number.isFinite(number) ? number : 0, 0, LENGTH - 1);
  };

  let cache = null;
  let cacheTarget = null;
  let cacheLength = null;

  function days() {
    const target = targetCalories();
    if (cache && cacheTarget === target && cacheLength === LENGTH) return cache;
    cache = templateOrder().map((templateIndex) => buildDay(templateIndex, target));
    cacheTarget = target;
    cacheLength = LENGTH;
    return cache;
  }

  function menu(index) {
    return days()[clampIndex(index)];
  }

  // Срок пакета — единственный источник «сегодня»: это индекс дня плана,
  // а не день недели, поэтому меню и даты всегда совпадают.
  function sinceDays() {
    if (!App.subscription || App.subscription.status("nutrition") !== "active") return 0;
    const info = App.subscription.info("nutrition");
    const since = Number(info && info.since);
    return Number.isFinite(since) && since > 0 ? Math.floor(since) : 0;
  }

  function todayIndex() {
    return clamp(sinceDays(), 0, LENGTH - 1);
  }

  function startDate() {
    return addDays(NOW, -sinceDays());
  }

  function dateOf(index) {
    return addDays(startDate(), clampIndex(index));
  }

  // Норма калорий изменилась (анкета, правка тренера) — план собирается заново.
  function invalidate() {
    cache = null;
    cacheTarget = null;
    cacheLength = null;
  }

  App.plan = { LENGTH, days, menu, dateOf, todayIndex, startDate, invalidate };

  // state.js грузится раньше plan.js и сеет дневник с нулевого дня: настоящий
  // день плана становится известен только здесь, поэтому засеваем повторно.
  if (App.state && typeof App.state.seedFoodDays === "function") {
    const food = App.state.seedFoodDays(todayIndex());
    App.state.foodDay = food.foodDay;
    App.state.meals = food.meals;
    App.state.water = food.water;
  }
})(window.App = window.App || {});
