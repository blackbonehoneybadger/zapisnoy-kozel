/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес онлайн-сервера, напр. wss://kozel.example.com */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
