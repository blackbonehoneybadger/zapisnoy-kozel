// Фиче-флаги клиента.
//
// SOL_BETTING_ENABLED — legacy-механика ставок SOL (стол на реальные деньги
// вместо зёрен). Выключена по умолчанию в продакшене новой версии:
// UI ставок скрыт из создания стола/онбординга/комнаты ожидания. Сервер
// независимо игнорирует betLamports, если такой же флаг у него выключен
// (server/src/config.ts) — клиентский флаг только прячет интерфейс, не
// заменяет серверную проверку. См. docs/SOL_BETTING_LEGACY.md.
export const SOL_BETTING_ENABLED = (import.meta.env.VITE_SOL_BETTING_ENABLED ?? 'false').trim() === 'true';

// ENABLE_CRAZY8_CLASSIC — старый флагманский режим DOFFA Crazy 8 (карточная
// игра, офлайн-боты и онлайн-лобби). Продукт переименован в DOFFA Games,
// новый основной режим — DOFFA Bean Duel (src/games/bean-duel). Crazy 8
// полностью сохранён в коде (src/games/crazy8, server/src — лобби/стол/игра),
// но по умолчанию скрыт из production: недоступен ни через UI, ни через
// прямое знание прежнего состояния экрана (см. guard в App.tsx). Включается
// только явно через VITE_ENABLE_CRAZY8_CLASSIC=true — для локальной
// разработки/тестирования. См. docs/CRAZY8_ARCHIVE.md.
export const ENABLE_CRAZY8_CLASSIC = (import.meta.env.VITE_ENABLE_CRAZY8_CLASSIC ?? 'false').trim() === 'true';
