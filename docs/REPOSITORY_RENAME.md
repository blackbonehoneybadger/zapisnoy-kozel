# Переименование репозитория → `doffa-games`

## Статус

**Репозиторий НЕ переименован.** Инструменты, доступные в этой сессии
(GitHub MCP server), не включают операцию переименования репозитория —
только `create_repository`, `fork_repository`, `create_or_update_file` и
подобные. Прямого способа выполнить
`PATCH /repos/{owner}/{repo}` (переименование) отсюда нет.

Код подготовлен к новому имени (см. ниже), но фактическое переименование
репозитория `blackbonehoneybadger/zapisnoy-kozel` →
`blackbonehoneybadger/doffa-games` должен выполнить владелец вручную.

## Ручной шаг (владелец репозитория)

1. Открыть репозиторий на GitHub.
2. **Settings → General → Repository name**.
3. Ввести `doffa-games` → **Rename**.

GitHub автоматически создаёт redirect со старого URL
(`github.com/blackbonehoneybadger/zapisnoy-kozel`) на новый
(`github.com/blackbonehoneybadger/doffa-games`) для веб-интерфейса, git
clone/fetch/push по HTTPS и SSH — старые ссылки и локальные клоны
продолжат работать какое-то время, но рекомендуется обновить remote:

```bash
git remote set-url origin https://github.com/blackbonehoneybadger/doffa-games.git
```

## Что уже подготовлено в коде к новому имени

- `package.json` (клиент): `name: "doffa-games"`.
- `server/package.json`: `name: "doffa-games-server"`.
- `server/Dockerfile`: комментарии и пример команд используют
  `doffa-games`/`doffa-games-server` вместо `kozel-server`.
- `.github/workflows/android.yml`: артефакты и релиз APK переименованы
  (`doffa-games-*.apk`, `doffa-games-apk`, релиз «DOFFA Games — Android
  APK»). Триггер по ветке (`claude/zapisnoy-kozel-game-b217qd`) **оставлен
  как есть** — это реальное имя git-ветки, а не бренд.
- `index.html`, PWA-манифест (`vite.config.ts`), `capacitor.config.ts`
  (`appName`), Android `strings.xml` (`app_name`) — везде «DOFFA Games».

## Что НЕ переименовано и почему

- **Android `appId`** (`com.zapisnoy.kozel`) — сознательно оставлен без
  изменений. Смена `applicationId` для Android означает для системы
  «другое приложение»: у пользователей с уже установленным APK не будет
  автообновления, они получат отдельную установку рядом со старой. Менять
  можно только по отдельному решению владельца — см. пометку в
  `capacitor.config.ts`.
- **Домен Vercel-деплоя** (`zapisnoy-kozel.vercel.app`) — используется в
  `capacitor.config.ts` и `android.yml` как адрес, который грузит
  установленный APK (механизм «поставил один раз — само обновляется»).
  Смена домена без реального пере-деплоя на новый адрес сломает
  автообновление у пользователей. Обновите значение **одновременно** с
  переименованием/пересозданием самого Vercel-проекта, не раньше.
- **Git-ветка `claude/zapisnoy-kozel-game-b217qd`** — имя ветки этой
  рабочей сессии, не бренд. Переименование ветки — отдельное решение,
  не связанное с переименованием репозитория или продукта.
- **Внутренний путь `com/zapisnoy/kozel`** в Android-проекте
  (`android/app/src/main/java/com/zapisnoy/kozel/MainActivity.java`) —
  жёстко завязан на `appId`/`namespace`; меняется только вместе с ними.

## После переименования репозитория

1. Обновить `homepage`/`repository` поля в `package.json`, если будут
   добавлены (сейчас их нет).
2. Проверить, что GitHub Actions секреты/переменные (`CAP_SERVER_URL`,
   `VITE_SERVER_URL`, `ANDROID_KEYSTORE_BASE64` и т.д.) не привязаны к
   старому имени репозитория — обычно они на уровне репозитория и
   переносятся автоматически при rename, но стоит перепроверить после.
3. Если Vercel-проект тоже будет переименован/пересоздан — обновить
   `capacitor.config.ts` и `.github/workflows/android.yml`
   (`CAP_SERVER_URL` fallback) на новый домен одним коммитом с реальным
   деплоем по этому адресу.
