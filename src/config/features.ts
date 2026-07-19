// Фиче-флаги клиента.
//
// SOL_BETTING_ENABLED — legacy-механика ставок SOL (стол на реальные деньги
// вместо зёрен). Выключена по умолчанию в продакшене новой версии:
// UI ставок скрыт из создания стола/онбординга/комнаты ожидания. Сервер
// независимо игнорирует betLamports, если такой же флаг у него выключен
// (server/src/config.ts) — клиентский флаг только прячет интерфейс, не
// заменяет серверную проверку. VITE_ENABLE_SOL_BETS — актуальное имя
// переменной; VITE_SOL_BETTING_ENABLED сохранён как алиас для обратной
// совместимости. См. docs/SOL_BETTING_LEGACY.md.
export const SOL_BETTING_ENABLED =
  (import.meta.env.VITE_ENABLE_SOL_BETS ?? import.meta.env.VITE_SOL_BETTING_ENABLED ?? 'false').trim() === 'true';

// ENABLE_CRAZY8_CLASSIC — старый флагманский режим DOFFA Crazy 8 (карточная
// игра, офлайн-боты и онлайн-лобби). Crazy 8 полностью сохранён в коде
// (src/games/crazy8, server/src — лобби/стол/игра), но по умолчанию скрыт
// из production: недоступен ни через UI, ни через прямое знание прежнего
// состояния экрана (см. guard в App.tsx). Включается только явно через
// VITE_ENABLE_CRAZY8_CLASSIC=true — для локальной разработки/тестирования.
// См. docs/CRAZY8_ARCHIVE.md.
export const ENABLE_CRAZY8_CLASSIC = (import.meta.env.VITE_ENABLE_CRAZY8_CLASSIC ?? 'false').trim() === 'true';

// ENABLE_BEAN_DUEL — прежний основной режим DOFFA Bean Duel (дуэль один на
// один). Основным режимом стал DOFFA Defense (src/games/doffa-defense) —
// порт комнатного action-roguelite из одноимённой LibGDX-игры. Bean Duel
// полностью сохранён в коде (src/games/bean-duel), но по умолчанию скрыт из
// production по той же архивной схеме, что и Crazy 8: недоступен ни через
// UI, ни через прямое знание прежнего состояния экрана (см. guard в App.tsx).
// Включается только явно через VITE_ENABLE_BEAN_DUEL=true — для локальной
// разработки/тестирования. См. docs/BEAN_DUEL_ARCHIVE.md.
export const ENABLE_BEAN_DUEL = (import.meta.env.VITE_ENABLE_BEAN_DUEL ?? 'false').trim() === 'true';
