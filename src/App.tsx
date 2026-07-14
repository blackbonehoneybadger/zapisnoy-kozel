import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HomeScreen } from './screens/HomeScreen';
import { GameScreen } from './screens/GameScreen';
import { RulesScreen } from './screens/RulesScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnlineScreen } from './screens/OnlineScreen';
import { ClaimScreen } from './screens/ClaimScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { BeansScreen } from './screens/BeansScreen';
import { BottomNav } from './components/BottomNav';
import { useGameStore } from './store/gameStore';

export type Screen =
  | 'home'
  | 'game'
  | 'rules'
  | 'stats'
  | 'settings'
  | 'online'
  | 'claim'
  | 'rewards'
  | 'profile'
  | 'beans';

/** Экраны-хабы, на которых показывается нижнее меню. */
const HUB_SCREENS: Screen[] = ['home', 'beans', 'rewards', 'profile'];

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

  const showNav = HUB_SCREENS.includes(screen);

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
            // отступ снизу под фиксированное меню на хабовых экранах
            className={showNav ? 'pb-24' : ''}
          >
            {screen === 'home' && <HomeScreen navigate={setScreen} onPlay={startGame} />}
            {screen === 'game' && <GameScreen onExit={exitGame} />}
            {screen === 'rules' && <RulesScreen onBack={() => setScreen('home')} />}
            {screen === 'stats' && <StatsScreen onBack={() => setScreen('home')} />}
            {screen === 'settings' && <SettingsScreen onBack={() => setScreen('home')} />}
            {screen === 'online' && <OnlineScreen onBack={() => setScreen('home')} />}
            {screen === 'claim' && <ClaimScreen onBack={() => setScreen('home')} />}
            {screen === 'rewards' && <RewardsScreen onBack={() => setScreen('profile')} />}
            {screen === 'profile' && (
              <ProfileScreen onBack={() => setScreen('home')} navigate={setScreen} />
            )}
            {screen === 'beans' && (
              <BeansScreen navigate={setScreen} onPlay={() => setScreen('online')} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {showNav && <BottomNav screen={screen} navigate={setScreen} />}
    </div>
  );
}

/** Кинематографичный фон: AI-текстура (если сгенерирована) + обсидиан + аврора + зерно. */
function PremiumBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      {/* AI-сгенерированный фон (public/art/app-bg.*). CSS-фоллбэк — обсидиан */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/art/app-bg.webp'), url('/art/app-bg.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* базовый обсидиан с тёплым центром (фоллбэк + усиление) */}
      <div className="absolute inset-0 bg-[radial-gradient(140%_120%_at_50%_-10%,#10130f_0%,#0a0b0c_45%,#08090b_100%)] opacity-70" />

      {/* мягкие цветовые блики — медленно дрейфуют */}
      <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-felt-700/25 blur-[130px] animate-drift" />
      <div className="absolute top-1/3 -right-28 h-80 w-80 rounded-full bg-gold-600/[0.08] blur-[120px] animate-drift" style={{ animationDelay: '-9s' }} />
      <div className="absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-felt-600/15 blur-[130px] animate-drift" style={{ animationDelay: '-16s' }} />

      {/* тончайшая шампань-дымка сверху */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-gold-500/[0.06] to-transparent" />

      {/* плёночное зерно */}
      <div className="absolute inset-0 grain opacity-[0.05] mix-blend-soft-light" />

      {/* виньетка для глубины */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_40%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
