/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес онлайн-сервера, напр. wss://kozel.example.com */
  readonly VITE_SERVER_URL?: string;
  /** Сеть Solana для клиента: 'devnet' | 'mainnet-beta'. */
  readonly VITE_SOLANA_NETWORK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
