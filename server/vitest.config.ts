import { defineConfig } from 'vitest/config';

// Явный конфиг обязателен: без него Vitest поднимается по каталогам и
// находит корневой client vite.config.ts (с vite-plugin-node-polyfills),
// который ломает резолвинг Node-модулей (url/punycode и т.п.) в чисто
// серверных тестах. Этот файл сам себе root — наружу не смотрит.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
