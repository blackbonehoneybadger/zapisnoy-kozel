/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес онлайн-сервера, напр. wss://game.example.com */
  readonly VITE_SERVER_URL?: string;
  /** Сеть Solana для клиента: 'devnet' | 'mainnet-beta'. */
  readonly VITE_SOLANA_NETWORK?: string;
  /** Legacy-механика ставок SOL — 'true' включает UI (см. docs/SOL_BETTING_LEGACY.md). */
  readonly VITE_SOL_BETTING_ENABLED?: string;
  /** Старый режим DOFFA Crazy 8 — 'true' открывает его в UI (см. docs/CRAZY8_ARCHIVE.md). */
  readonly VITE_ENABLE_CRAZY8_CLASSIC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
