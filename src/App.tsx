import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HomeScreen } from './screens/HomeScreen';
import { GameScreen } from './screens/GameScreen';
import { RulesScreen } from './screens/RulesScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useGameStore } from './store/gameStore';

export type Screen = 'home' | 'game' | 'rules' | 'stats' | 'settings';

const transition = {
  initial: { opacity: 0, scale: 0.98, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 1.01, y: -12 },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const start = useGameStore((s) => s.start);
  const quit = useGameStore((s) => s.quit);

  const startGame = () => {
    start();
    setScreen('game');
  };

  const exitGame = () => {
    quit();
    setScreen('home');
  };

  return (
    <div className="relative mx-auto min-h-[100dvh] max-w-md overflow-hidden">
      <PremiumBackground />
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={transition.initial}
            animate={transition.animate}
            exit={transition.exit}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {screen === 'home' && <HomeScreen navigate={setScreen} onPlay={startGame} />}
            {screen === 'game' && <GameScreen onExit={exitGame} />}
            {screen === 'rules' && <RulesScreen onBack={() => setScreen('home')} />}
            {screen === 'stats' && <StatsScreen onBack={() => setScreen('home')} />}
            {screen === 'settings' && <SettingsScreen onBack={() => setScreen('home')} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Глубокий тёмный фон с золотым свечением и мягкими «бликами стола». */
function PremiumBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0">
      <div className="absolute inset-0 bg-[#070a09]" />
      <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-felt-700/30 blur-[120px]" />
      <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-gold-600/10 blur-[120px]" />
      <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-felt-600/20 blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
    </div>
  );
}
