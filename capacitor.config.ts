import type { CapacitorConfig } from '@capacitor/cli';

// «Установил один раз — само обновляется».
// Если задан CAP_SERVER_URL (или это CI-сборка APK), WebView грузит живой сайт
// с Vercel напрямую. Тогда любой деплой на Vercel мгновенно появляется в уже
// установленном приложении — переустанавливать APK не нужно.
// Локально (без CAP_BUILD) server не задаётся — работают локальные ассеты из dist.
const isCapacitor = process.env.CAP_BUILD === '1';
// URL деплоя Vercel — сознательно НЕ переименован вслед за продуктом: домен
// принадлежит текущему Vercel-проекту (привязан к старому имени репозитория)
// и его смена без подтверждённого нового деплоя сломает автообновление уже
// установленных APK. Обновите здесь И задеплойте по новому адресу вместе,
// когда Vercel-проект будет переименован/пересоздан.
const serverUrl =
  process.env.CAP_SERVER_URL || (isCapacitor ? 'https://zapisnoy-kozel.vercel.app' : undefined);

const config: CapacitorConfig = {
  // appId сознательно НЕ меняется при ребрендинге в DOFFA Games — смена id
  // ломает обновление уже установленных APK (Android считает это другим
  // приложением). Если понадобится сменить — только по отдельному решению
  // владельца, см. docs/REPOSITORY_RENAME.md.
  appId: 'com.zapisnoy.kozel',
  appName: 'DOFFA Games',
  webDir: 'dist',
  backgroundColor: '#16110b',
  android: {
    backgroundColor: '#16110b',
    allowMixedContent: false,
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
        },
      }
    : {}),
};

export default config;
