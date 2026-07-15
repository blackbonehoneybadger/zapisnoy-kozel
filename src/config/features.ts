// Фиче-флаги клиента.
//
// SOL_BETTING_ENABLED — legacy-механика ставок SOL (стол на реальные деньги
// вместо зёрен). Выключена по умолчанию в продакшене новой версии:
// UI ставок скрыт из создания стола/онбординга/комнаты ожидания. Сервер
// независимо игнорирует betLamports, если такой же флаг у него выключен
// (server/src/config.ts) — клиентский флаг только прячет интерфейс, не
// заменяет серверную проверку. См. docs/SOL_BETTING_LEGACY.md.
export const SOL_BETTING_ENABLED = (import.meta.env.VITE_SOL_BETTING_ENABLED ?? 'false').trim() === 'true';
