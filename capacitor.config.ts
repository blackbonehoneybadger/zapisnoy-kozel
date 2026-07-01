import type { CapacitorConfig } from '@capacitor/cli';

// «Установил один раз — само обновляется».
// Если задан CAP_SERVER_URL (или это CI-сборка APK), WebView грузит живой сайт
// с Vercel напрямую. Тогда любой деплой на Vercel мгновенно появляется в уже
// установленном приложении — переустанавливать APK не нужно.
// Локально (без CAP_BUILD) server не задаётся — работают локальные ассеты из dist.
const isCapacitor = process.env.CAP_BUILD === '1';
const serverUrl =
  process.env.CAP_SERVER_URL || (isCapacitor ? 'https://zapisnoy-kozel.vercel.app' : undefined);

const config: CapacitorConfig = {
  appId: 'com.zapisnoy.kozel',
  appName: 'Записной Козёл',
  webDir: 'dist',
  backgroundColor: '#08090b',
  android: {
    backgroundColor: '#08090b',
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
