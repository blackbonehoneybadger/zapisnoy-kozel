// Разовая миграция сохранений со старых ключей (до ребрендинга в DOFFA
// Crazy 8), чтобы игроки не потеряли статистику, настройки и вход в онлайн.
// Модуль импортируется ПЕРВЫМ в main.tsx: zustand-persist читает localStorage
// в момент создания сторов, а те создаются при импорте App — значит миграция
// обязана отработать раньше всех остальных импортов.
const LEGACY_KEYS: [string, string][] = [
  ['kozel-stats-v1', 'doffa-crazy8-stats-v1'],
  ['kozel-settings-v1', 'doffa-crazy8-settings-v1'],
  ['kozel.token', 'doffa-crazy8.token'],
];

try {
  for (const [oldKey, newKey] of LEGACY_KEYS) {
    const value = localStorage.getItem(oldKey);
    if (value !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, value);
    }
    if (value !== null) localStorage.removeItem(oldKey);
  }
} catch {
  /* приватный режим — просто начинаем с чистого листа */
}

export {};
