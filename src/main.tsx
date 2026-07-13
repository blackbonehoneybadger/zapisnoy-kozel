// ВАЖНО: миграция localStorage должна идти первым импортом (до App/сторов).
import './migrateLegacyStorage';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Авто-обновление PWA. Service worker регистрируется плагином (registerType:
// 'autoUpdate') и сам применяет новую версию + перезагружает страницу.
// Здесь лишь подталкиваем проверку обновлений: периодически и при возврате
// во вкладку — чтобы установленное приложение обновлялось без переустановки.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((reg) => {
      const check = () => reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000); // раз в 30 минут
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    })
    .catch(() => {
      /* нет SW (например, сборка под Capacitor) — игнорируем */
    });
}
