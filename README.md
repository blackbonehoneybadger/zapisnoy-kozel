# ☕ DOFFA Games

Игровая платформа экосистемы [DOFFA](https://doffa.coffee) — премиальная PWA
в фирменном стиле кофейни: тёплый эспрессо-фон, золото рассвета, стеклянные
панели, плавные анимации. Готова к публикации в App Store / Google Play как
PWA.

**Основной режим — DOFFA Bean Duel:** быстрая skill-based дуэль один на один
на маскотах-чашках DOFFA. **Зёрна** — внутренняя игровая энергия (не
криптовалюта, не выводится, не продаётся) — билет на вход в матч. **DOFFA** —
настоящая награда, начисляется только сервером за подтверждённую победу.

> Карточная игра **DOFFA Crazy 8** — прежний флагманский режим — полностью
> сохранена в коде, но скрыта из публичного интерфейса. См.
> [`docs/CRAZY8_ARCHIVE.md`](docs/CRAZY8_ARCHIVE.md).

## ✨ Что внутри

- **Стек:** React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand.
- **PWA:** офлайн-кэш, манифест, установка на домашний экран iPhone/Android.
- **DOFFA Bean Duel** (`src/games/bean-duel/`) — локальная дуэль игрок vs бот:
  чистый детерминированный движок (`engine.ts`) + React-рендер арены.
- **Тапалка «Зёрна»** (`src/features/beans/BeansScreen.tsx`) — маскот-чашка DOFFA,
  тап начисляет зерно оптимистично на клиенте, сервер периодически сверяет
  и урезает до правдоподобного (`server/src/services/beansService.ts`).
- **Экономика DOFFA:** серверный баланс зёрен, вход в матч за зёрна,
  начисление и получение DOFFA-наград, история операций
  (`server/src/services/`, `server/src/domain/`).
- **DOFFA Crazy 8** (`src/games/crazy8/`) — скрытый режим за
  `VITE_ENABLE_CRAZY8_CLASSIC`, см. `docs/CRAZY8_ARCHIVE.md`.
- **Сохранение:** зёрна/энергия — сервер (клиент кэширует в `localStorage`);
  настройки — `localStorage`.

## 🚀 Как запустить (для новичка)

1. Установи [Node.js](https://nodejs.org) (LTS) — если ещё не стоит.
2. Открой терминал в папке проекта и выполни по очереди:

```bash
npm install      # установить зависимости (один раз)
npm run dev      # запустить в режиме разработки
```

3. В терминале появится адрес, например `http://localhost:5173/`.
   Открой его в браузере — приложение запустится.
4. Нажми **«Играть в Bean Duel»** → веди пальцем/мышью по арене, кнопка
   «Рывок» — атака и уклонение.

### 📱 Как открыть на телефоне

- Телефон и компьютер должны быть в **одной Wi-Fi сети**.
- После `npm run dev` Vite покажет строку **Network: http://192.168.x.x:5173/** —
  открой этот адрес в браузере телефона.
- Чтобы установить как приложение: в Safari (iPhone) → «Поделиться» →
  «На экран „Домой"»; в Chrome (Android) → меню → «Установить приложение».

### 🏗️ Сборка для публикации

```bash
npm run build    # собрать продакшн-версию в папку dist/
npm run preview  # локально проверить собранную версию
```

Папку `dist/` можно залить на любой хостинг (Vercel, Netlify, GitHub Pages) —
это и будет устанавливаемое PWA.

## 📦 Android APK (скачать и установить)

Приложение упаковано в нативный Android-проект через **Capacitor**, а APK
собирается автоматически на GitHub Actions.

### Скачать готовый APK

1. Открой раздел **Releases** репозитория → релиз **«DOFFA Games — Android APK»**.
2. Скачай файл `doffa-games-latest.apk` на телефон.
3. На Android разреши установку из неизвестных источников (Настройки →
   Безопасность / «Установка неизвестных приложений»).
4. Открой скачанный файл → **«Установить»**.

> APK пересобирается автоматически при каждом пуше. Вручную запустить сборку:
> вкладка **Actions → Build Android APK → Run workflow**. Готовый файл также
> лежит в артефактах запуска (`doffa-games-apk`).

### Собрать APK локально

Нужны JDK 21 и Android SDK (через Android Studio).

```bash
npm run cap:build        # собрать веб-часть и синхронизировать в android/
cd android
./gradlew assembleDebug  # APK → android/app/build/outputs/apk/debug/app-debug.apk
```

Иконки и сплэш генерируются из эмблемы DOFFA:

```bash
npm run icons            # пересоздать иконки/сплэш для всех плотностей
```

> **appId остаётся прежним** (`com.zapisnoy.kozel`) несмотря на ребрендинг —
> смена id ломает автообновление уже установленных APK. См.
> [`docs/REPOSITORY_RENAME.md`](docs/REPOSITORY_RENAME.md).

## 🌐 Онлайн и серверная экономика

Сервер (`server/`) — Node + WebSocket. Аккаунты (вход через подпись
Solana-кошелька), авторитетный баланс зёрен и энергии, начисление/получение
DOFFA-наград, и — за скрытым флагом — лобби/столы/авторитетная игра Crazy 8.

### Запустить сервер

```bash
cd server
npm install
npm start            # слушает порт 8080 (переопределяется через PORT)
```

Данные (аккаунты, зёрна, награды, заявки на вывод) хранятся в
`server/data/*.json`. Секрет токенов и порт задаются переменными окружения
`AUTH_SECRET` и `PORT`.

### Подключить клиент к серверу

Адрес сервера задаётся на сборке через переменную `VITE_SERVER_URL`:

```bash
VITE_SERVER_URL=ws://localhost:8080 npm run dev      # локально
```

Для APK задайте repo variable `VITE_SERVER_URL` (Settings → Secrets and
variables → Actions → Variables), например `wss://game.example.com` — тогда
серверная экономика заработает и в приложении. Без адреса зёрна и награды
работают только локально (без серверной сверки).

> Сервер нужно где-то хостить (VPS/облако), чтобы он работал постоянно.
> Для боевого режима используйте `wss://` (TLS) и задайте `AUTH_SECRET`.

### Развернуть сервер в Docker

В репозитории есть `server/Dockerfile` (контекст сборки — корень проекта):

```bash
docker build -f server/Dockerfile -t doffa-games-server .
docker run -p 8080:8080 -e AUTH_SECRET=задайте-секрет doffa-games-server
```

Образ подходит для любого контейнерного хостинга (Render, Railway, Fly.io,
свой VPS). После деплоя возьмите публичный адрес (`wss://…`) и пропишите его
в `VITE_SERVER_URL`.

## 🗂️ Структура проекта

```
src/
  app/               # корень приложения: App.tsx (роутер), HomeScreen.tsx
  games/
    bean-duel/      # DOFFA Bean Duel — основной режим
      engine.ts     # чистая логика дуэли (без React)
      Duelist.tsx   # визуал бойца
      BeanDuelScreen.tsx
    crazy8/          # скрытый режим (см. docs/CRAZY8_ARCHIVE.md)
      engine/        # движок карточной игры (без UI)
      components/    # Card, GameTable, PlayerHand, ScoreBoard, SuitIcon…
      screens/       # GameScreen, OnlineScreen, RulesScreen, StatsScreen…
      store/         # gameStore, statsStore
  features/          # доменные модули платформы (общие, не дублируются между играми)
    beans/           # тапалка «Зёрна»: beansStore, BeansScreen, DoffaMascot
    rewards/         # rewardsStore, RewardsScreen, ClaimScreen
    profile/         # ProfileScreen
    wallet/          # кошелёк Solana: index.ts, walletStore.ts
  components/shared/ # общие UI-компоненты (кнопки, эмблема, оверлеи, BottomNav…)
  net/               # WebSocket-клиент (auth, зёрна, награды, Crazy8-лобби)
  lib/               # общие утилиты: haptics.ts, sound.ts
  config/            # фиче-флаги (ENABLE_CRAZY8_CLASSIC, SOL_BETTING_ENABLED)
  styles/            # globals.css (Tailwind)
server/
  src/
    services/        # beansService, rewardService, claimService — доменная экономика
    domain/          # типы доменной модели (DoffaUser, MatchResult, Reward…)
    repositories/    # файловое хранилище (заменяемо на БД)
    lobby.ts, match.ts, protocol.ts  # Crazy8-лобби/матч (используют src/games/crazy8/engine)
scripts/sim.ts        # авто-симуляция партий Crazy 8 для проверки движка
```

## 🛠️ Где что менять

- **Bean Duel — баланс/константы дуэли:** `src/games/bean-duel/engine.ts`
  (скорость, урон рывка, длительность матча).
- **Экономика зёрен/наград (сервер):** `server/src/services/beansService.ts`,
  `server/src/services/rewardService.ts`, `server/src/config.ts`.
- **Crazy 8 правила/очки:** `src/games/crazy8/engine/scoring.ts`.
- **Дизайн (цвета, тени, шрифты):** `tailwind.config.js` и `src/styles/globals.css`.
- **Фиче-флаги:** `src/config/features.ts` (клиент), `server/src/config.ts` (сервер).

## ✅ Проверка качества

- `npm run build` — типы (TypeScript, `tsc -b`) + продакшн-сборка проходят
  без ошибок. Точнее, чем `npm run lint` (`tsc --noEmit` без `-b`) — если
  сомневаетесь, доверяйте `npm run build`.
- `npx tsx scripts/sim.ts` — прогон 300 авто-партий Crazy 8: ходы ботов
  валидны, колода не «теряет» карт, нет зацикливаний.
- `cd server && npm run typecheck` — типы серверной части.

## 🔮 Что добавить дальше

- Сетевой (не только vs бот) режим DOFFA Bean Duel.
- Экономика Bean Duel: вход/награда за матч (пока матч бесплатный, без
  начисления зёрен/DOFFA).
- Реальные звуковые семплы и фоновая музыка.
- Локализация (EN/RU) и обучающий режим.
- Разделение `net/onlineStore.ts` на Crazy8-специфичную и общую части
  (см. `docs/CRAZY8_ARCHIVE.md`).
