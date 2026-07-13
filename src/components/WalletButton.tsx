import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '../solana/walletStore';

function SolanaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="solGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0a43b" />
          <stop offset="1" stopColor="#14f195" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#solGrad)" opacity="0.15" />
      <path
        d="M6.5 15.5h9.3l-2.3 2.5H6.5l2.3-2.5zm0-4.5h11l-2.3 2.5H6.5L8.8 11zm2.3-4.5h9.3L15.8 9H6.5l2.3-2.5z"
        fill="url(#solGrad)"
      />
    </svg>
  );
}

interface Props {
  className?: string;
}

export function WalletButton({ className = '' }: Props) {
  const address = useWalletStore((s) => s.address);
  const balance = useWalletStore((s) => s.balance);
  const connecting = useWalletStore((s) => s.connecting);
  const error = useWalletStore((s) => s.error);
  const connect = useWalletStore((s) => s.connect);
  const disconnect = useWalletStore((s) => s.disconnect);

  const short = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  const handleClick = () => {
    if (address) disconnect();
    else connect();
  };

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <motion.button
        type="button"
        onClick={handleClick}
        whileTap={{ scale: 0.97 }}
        disabled={connecting}
        className="flex items-center gap-2 rounded-2xl glass-strong px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.06] disabled:opacity-60"
      >
        <SolanaIcon size={16} />

        <AnimatePresence mode="wait">
          {connecting ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-white/60"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="block h-3.5 w-3.5 rounded-full border-2 border-gold-500/40 border-t-gold-400"
              />
              Подключение…
            </motion.span>
          ) : address ? (
            <motion.span
              key="connected"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              className="flex items-center gap-2"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              <span className="font-mono text-[13px] text-gold-300">{short}</span>
              {balance !== null && (
                <span className="text-[11px] text-white/50">
                  {balance.toFixed(3)} SOL
                </span>
              )}
            </motion.span>
          ) : (
            <motion.span
              key="disconnected"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              className="text-white/70"
            >
              Подключить кошелёк
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-1 text-[11px] text-wine-400"
          >
            {error}
            {!address && (
              <a
                href="https://phantom.app"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline text-gold-400/70"
              >
                Скачать Phantom
              </a>
            )}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
