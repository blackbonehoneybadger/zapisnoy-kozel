import { motion } from 'framer-motion';
import { RuleCard } from '../components/RuleCard';
import { CARD_POINTS } from '../game/scoring';
import { RANKS } from '../game/deck';

interface Props {
  onBack: () => void;
}

export function RulesScreen({ onBack }: Props) {
  return (
    <div className="min-h-[100dvh] px-5 pt-4 safe-top safe-bottom">
      <Header title="Правила" onBack={onBack} />

      <div className="space-y-3 pb-8">
        <RuleCard title="Цель игры" index={0}>
          Колода из 36 карт (6–туз, четыре масти). Каждому раздаётся по 6 карт, одна
          кладётся в сброс. Цель — первым избавиться от всех карт. Карту можно класть,
          если совпадает <strong className="text-white/90 font-medium">масть</strong> или <strong className="text-white/90 font-medium">значение</strong>, а также если это <strong className="text-white/90 font-medium">дама</strong> —
          она меняет масть. Нет хода — берёте карту из колоды.
        </RuleCard>

        <h2 className="px-1 pt-2 font-display text-xl gold-text">Спец-карты</h2>

        <RuleCard title="Шестёрка" badge="6" accent="red" index={1}>
          Следующий игрок берёт <strong className="text-white/90 font-medium">2 карты</strong>. Можно перевести другой шестёркой — тогда
          следующий берёт уже 4, затем 6 и так далее. Переводится <strong className="text-white/90 font-medium">только шестёркой</strong>.
        </RuleCard>

        <RuleCard title="Семёрка" badge="7" accent="red" index={2}>
          Следующий игрок <strong className="text-white/90 font-medium">по-любому берёт 1 карту</strong>. Семёрка <strong className="text-white/90 font-medium">не переводится</strong> —
          даже если у соперника есть семёрка, он всё равно берёт.
        </RuleCard>

        <RuleCard title="Туз" badge="A" accent="gold" index={3}>
          Следующий игрок <strong className="text-white/90 font-medium">пропускает ход</strong>. Туз можно перевести другим тузом — тогда
          пропуск переходит дальше по кругу.
        </RuleCard>

        <RuleCard title="Дама" badge="Q" accent="gold" index={4}>
          Кладётся в любой момент и <strong className="text-white/90 font-medium">выбирает новую масть</strong>. Даму можно перевести другой
          дамой, которая снова выберет масть.
        </RuleCard>

        <RuleCard title="Девятка" badge="9" accent="gold" index={5}>
          Девятку нужно <strong className="text-white/90 font-medium">накрыть картой той же масти</strong>. Можно перевести другой девяткой.
          Если накрыть нечем — берёте карту и пропускаете.
        </RuleCard>

        <RuleCard title="Пиковый король" badge="K♠" accent="red" index={6}>
          Следующий игрок берёт <strong className="text-white/90 font-medium">4 карты</strong>. Пиковый король <strong className="text-white/90 font-medium">не переводится</strong>.
        </RuleCard>

        <RuleCard title="Что переводится" accent="gold" index={7}>
          Переводятся: <strong className="text-white/90 font-medium">6, туз, дама, 9</strong>. Не переводятся: <strong className="text-white/90 font-medium">7</strong> и <strong className="text-white/90 font-medium">пиковый король</strong>.
        </RuleCard>

        <h2 className="px-1 pt-2 font-display text-xl gold-text">Счёт и лимит</h2>

        <RuleCard title="Подсчёт очков" index={8}>
          Кто вышел — получает 0. Остальные считают очки оставшихся карт и прибавляют их к
          таблице.
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {RANKS.map((r) => (
              <div
                key={r}
                className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs"
              >
                <span className="font-display text-base text-white/80">{r}</span>
                <span className="text-gold-300">{CARD_POINTS[r]}</span>
              </div>
            ))}
          </div>
        </RuleCard>

        <RuleCard title="Лимит и «вылет»" accent="red" index={9}>
          По умолчанию лимит <strong className="text-white/90 font-medium">101</strong>. Перебрал лимит — <strong className="text-white/90 font-medium">«улетел»</strong> и выбываешь. Набрал
          <strong className="text-white/90 font-medium"> ровно лимит</strong> — счёт <strong className="text-white/90 font-medium">обнуляется до 0</strong>. Лимит меняется в настройках.
        </RuleCard>
      </div>
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-center gap-3"
    >
      <button
        onClick={onBack}
        className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 active:scale-95"
        aria-label="Назад"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h1 className="font-display text-3xl gold-text">{title}</h1>
    </motion.div>
  );
}
