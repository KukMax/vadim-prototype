/* Библиотека упражнений кабинета тренера: справочник для выбора упражнения
   в редакторе дня (js/views/coach-training.js) и подписи группы мышц в
   таблице. Данные статичны, без картинок и ссылок: прототип работает офлайн.
   Имена совпадают с упражнениями основной части DATA.cycleTemplates, чтобы
   программа клиента и справочник говорили об одном и том же движении. */
(function (App) {
  "use strict";

  const GROUPS = ["Грудь", "Спина", "Плечи", "Руки", "Ноги", "Ягодицы", "Кор", "Кардио"];

  const list = [
    // Грудь
    { id: "bench-press", name: "Жим штанги лёжа", group: "Грудь", equipment: "Штанга", unit: "" },
    { id: "incline-dumbbell-press", name: "Жим гантелей на наклонной скамье", group: "Грудь", equipment: "Гантели", unit: "" },
    { id: "flat-dumbbell-fly", name: "Разведения гантелей лёжа", group: "Грудь", equipment: "Гантели", unit: "" },
    { id: "push-ups", name: "Отжимания", group: "Грудь", equipment: "Свой вес", unit: "" },
    { id: "cable-crossover", name: "Сведения рук в кроссовере", group: "Грудь", equipment: "Блок", unit: "" },
    { id: "chest-press-machine", name: "Жим в тренажёре «Грудь»", group: "Грудь", equipment: "Тренажёр", unit: "" },

    // Спина
    { id: "barbell-row", name: "Тяга штанги в наклоне", group: "Спина", equipment: "Штанга", unit: "" },
    { id: "lat-pulldown-to-belt", name: "Тяга в блочном тренажёре к поясу", group: "Спина", equipment: "Блок", unit: "" },
    { id: "pull-ups", name: "Подтягивания", group: "Спина", equipment: "Свой вес", unit: "" },
    { id: "hyperextension", name: "Гиперэкстензия", group: "Спина", equipment: "Свой вес", unit: "" },
    { id: "dumbbell-row", name: "Тяга гантели одной рукой", group: "Спина", equipment: "Гантели", unit: "" },
    { id: "shrugs", name: "Шраги со штангой", group: "Спина", equipment: "Штанга", unit: "" },

    // Плечи
    { id: "seated-dumbbell-press", name: "Жим гантелей сидя", group: "Плечи", equipment: "Гантели", unit: "" },
    { id: "lateral-raises", name: "Махи гантелями в стороны", group: "Плечи", equipment: "Гантели", unit: "" },
    { id: "upright-row", name: "Тяга к подбородку с гантелями", group: "Плечи", equipment: "Гантели", unit: "" },
    { id: "overhead-press", name: "Жим штанги стоя", group: "Плечи", equipment: "Штанга", unit: "" },
    { id: "front-raises", name: "Подъём гантелей перед собой", group: "Плечи", equipment: "Гантели", unit: "" },
    { id: "reverse-fly", name: "Разведения гантелей в наклоне", group: "Плечи", equipment: "Гантели", unit: "" },
    { id: "shoulder-press-machine", name: "Жим в тренажёре «Плечи»", group: "Плечи", equipment: "Тренажёр", unit: "" },

    // Руки
    { id: "dumbbell-curl", name: "Подъём гантелей на бицепс", group: "Руки", equipment: "Гантели", unit: "" },
    { id: "triceps-pushdown", name: "Разгибание на трицепс в блоке", group: "Руки", equipment: "Блок", unit: "" },
    { id: "barbell-curl", name: "Подъём штанги на бицепс", group: "Руки", equipment: "Штанга", unit: "" },
    { id: "hammer-curl", name: "Молотки с гантелями", group: "Руки", equipment: "Гантели", unit: "" },
    { id: "french-press", name: "Французский жим лёжа", group: "Руки", equipment: "Штанга", unit: "" },
    { id: "overhead-triceps-extension", name: "Разгибание гантели из-за головы", group: "Руки", equipment: "Гантели", unit: "" },
    { id: "close-grip-press", name: "Жим штанги узким хватом", group: "Руки", equipment: "Штанга", unit: "" },

    // Ноги
    { id: "back-squat", name: "Приседания со штангой", group: "Ноги", equipment: "Штанга", unit: "" },
    { id: "romanian-deadlift", name: "Румынская тяга со штангой", group: "Ноги", equipment: "Штанга", unit: "" },
    { id: "leg-press", name: "Жим ногами", group: "Ноги", equipment: "Тренажёр", unit: "" },
    { id: "dumbbell-lunges", name: "Выпады с гантелями", group: "Ноги", equipment: "Гантели", unit: "" },
    { id: "goblet-squat", name: "Приседания с гирей", group: "Ноги", equipment: "Гиря", unit: "" },
    { id: "reverse-lunges", name: "Обратные выпады с гантелями", group: "Ноги", equipment: "Гантели", unit: "" },
    { id: "leg-extension", name: "Разгибание ног в тренажёре", group: "Ноги", equipment: "Тренажёр", unit: "" },
    { id: "calf-raise-machine", name: "Подъём на носки в тренажёре", group: "Ноги", equipment: "Тренажёр", unit: "" },
    { id: "calf-raise-dumbbells", name: "Подъём на носки с гантелями", group: "Ноги", equipment: "Гантели", unit: "" },

    // Ягодицы
    { id: "hip-thrust-barbell", name: "Ягодичный мост со штангой", group: "Ягодицы", equipment: "Штанга", unit: "" },
    { id: "hip-thrust-plate", name: "Ягодичный мост с блином", group: "Ягодицы", equipment: "Свой вес", unit: "" },
    { id: "cable-kickback", name: "Отведение ноги в кроссовере", group: "Ягодицы", equipment: "Блок", unit: "" },
    { id: "hip-abduction", name: "Разведение ног в тренажёре", group: "Ягодицы", equipment: "Тренажёр", unit: "" },
    { id: "glute-bridge", name: "Ягодичный мост", group: "Ягодицы", equipment: "Свой вес", unit: "" },

    // Кор
    { id: "plank", name: "Планка", group: "Кор", equipment: "Свой вес", unit: "sec" },
    { id: "side-plank", name: "Боковая планка", group: "Кор", equipment: "Свой вес", unit: "sec" },
    { id: "crunches", name: "Скручивания", group: "Кор", equipment: "Свой вес", unit: "" },
    { id: "hanging-leg-raise", name: "Подъём ног в висе", group: "Кор", equipment: "Свой вес", unit: "" },
    { id: "russian-twist", name: "Русский твист", group: "Кор", equipment: "Свой вес", unit: "" },
    { id: "cable-crunch", name: "Скручивания на блоке", group: "Кор", equipment: "Блок", unit: "" },

    // Кардио
    { id: "burpee", name: "Бёрпи", group: "Кардио", equipment: "Свой вес", unit: "" },
    { id: "jump-rope", name: "Прыжки на скакалке", group: "Кардио", equipment: "Свой вес", unit: "" },
    { id: "rowing-machine", name: "Гребной тренажёр", group: "Кардио", equipment: "Тренажёр", unit: "" },
    { id: "stationary-bike", name: "Велотренажёр", group: "Кардио", equipment: "Тренажёр", unit: "" },
  ];

  // Поиск и сравнение не зависят от регистра и от «ё»: «берпи» находит «Бёрпи».
  const normalize = (value) => String(value == null ? "" : value).toLowerCase().replace(/ё/g, "е");

  const find = (id) => list.filter((item) => item.id === id)[0] || null;

  const byName = (name) => {
    const target = normalize(name);
    return list.filter((item) => normalize(item.name) === target)[0] || null;
  };

  const byGroup = (group) => (group && group !== "all" ? list.filter((item) => item.group === group) : list.slice());

  const search = (query) => {
    const needle = normalize(query).trim();
    if (!needle) return list.slice();
    return list.filter((item) => normalize(item.name).indexOf(needle) !== -1);
  };

  // Подпись упражнения в списке: «Ноги · Штанга».
  const label = (exercise) => {
    if (!exercise) return "";
    return `${exercise.group} · ${exercise.equipment}`;
  };

  App.exercises = { list, groups: GROUPS, find, byName, byGroup, search, label };
})(window.App = window.App || {});
