import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { RuleCard } from '../components/RuleCard';
import { Card } from '../components/Card';
import { CARD_POINTS } from '../game/scoring';
import { RANKS } from '../game/deck';
import type { Card as CardType } from '../game/types';

interface Props {
  onBack: () => void;
}

// Карты-иллюстрации для спец-правил (рендерятся настоящим компонентом Card).
const ART = {
  six: { id: 'art-6', suit: 'hearts', rank: '6' },
  seven: { id: 'art-7', suit: 'hearts', rank: '7' },
  ace: { id: 'art-a', suit: 'spades', rank: 'A' },
  queen: { id: 'art-q', suit: 'diamonds', rank: 'Q' },
  nine: { id: 'art-9', suit: 'clubs', rank: '9' },
  king: { id: 'art-k', suit: 'spades', rank: 'K' },
} satisfies Record<string, CardType>;

const FLOW: { icon: string; title: string; text: string }[] = [
  {
    icon: '👛',
    title: 'Подключи кошелёк',
    text: 'Phantom или Solflare — без регистрации. Это твой вход и твой счёт в SOL.',
  },
  {
    icon: '🪑',
    title: 'Найди или создай комнату',
    text: 'Видишь, кто в сети и кому нужны игроки. Или создай свою на 2–4 человек и позови друзей.',
  },
  {
    icon: '💰',
    title: 'Все вносят ставку',
    text: 'Перед стартом каждый переводит одинаковую ставку в банк партии. Играют только живые игроки.',
  },
  {
    icon: '🃏',
    title: 'Играете партию',
    text: 'Обычный «Crazy 8»: первым сбросил все карты — победил. Правила ниже.',
  },
  {
    icon: '🏆',
    title: 'Победитель забирает банк',
    text: 'Весь банк уходит победителю автоматически. Площадка удерживает 5% комиссии.',
  },
];

export function RulesScreen({ onBack }: Props) {
  return (
    <div className="min-h-[100dvh] px-5 pt-4 safe-top safe-bottom">
      <Header title="Как играть" onBack={onBack} />

      {/* ─── Иллюстрированная инструкция: как играть на SOL ─── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong relative overflow-hidden rounded-3xl p-5"
      >
        {/* фирменное свечение Solana */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative">
          <span className="text-[11px] uppercase tracking-[0.3em] text-gold-400/80">
            Solana · игра на токены
          </span>
          <h2 className="mt-1 font-display text-2xl gold-text">Как это работает</h2>
          <p className="mt-1 text-sm text-white/55">
            Децентрализованная площадка: вход кошельком, ставка в SOL, банк — победителю.
          </p>

          <div className="mt-5 space-y-1">
            {FLOW.map((s, i) => (
              <FlowStep key={s.title} {...s} index={i} last={i === FLOW.length - 1} />
            ))}
          </div>
        </div>
      </motion.section>

      <div className="space-y-3 pb-8 pt-5">
        <h2 className="px-1 font-display text-xl gold-text">Правила игры</h2>

        <RuleCard
          title="Цель игры"
          index={0}
          art={
            <div className="flex -space-x-5">
              <Card small card={{ id: 'c1', suit: 'hearts', rank: '10' }} className="rotate-[-8deg]" />
              <Card small card={{ id: 'c2', suit: 'spades', rank: 'K' }} className="rotate-[6deg]" />
            </div>
          }
        >
          Колода из 36 карт (6–туз, четыре масти). Каждому раздаётся по 6 карт, одна
          кладётся в сброс. Цель — первым избавиться от всех карт. Карту можно класть,
          если совпадает <Hl>масть</Hl> или <Hl>значение</Hl>, а также если это <Hl>дама</Hl> —
          она меняет масть. Нет хода — берёте карту из колоды.
        </RuleCard>

        <h2 className="px-1 pt-2 font-display text-xl gold-text">Спец-карты</h2>

        <RuleCard title="Шестёрка" badge="6" accent="red" index={1} art={<Card small card={ART.six} />}>
          Следующий игрок берёт <Hl>2 карты</Hl>. Можно перевести другой шестёркой — тогда
          следующий берёт уже 4, затем 6 и так далее. Переводится <Hl>только шестёркой</Hl>.
        </RuleCard>

        <RuleCard title="Семёрка" badge="7" accent="red" index={2} art={<Card small card={ART.seven} />}>
          Следующий игрок <Hl>по-любому берёт 1 карту</Hl>. Семёрка <Hl>не переводится</Hl> —
          даже если у соперника есть семёрка, он всё равно берёт.
        </RuleCard>

        <RuleCard title="Туз" badge="A" accent="gold" index={3} art={<Card small card={ART.ace} />}>
          Следующий игрок <Hl>пропускает ход</Hl>. Туз можно перевести другим тузом — тогда
          пропуск переходит дальше по кругу.
        </RuleCard>

        <RuleCard title="Дама" badge="Q" accent="gold" index={4} art={<Card small card={ART.queen} />}>
          Кладётся в любой момент и <Hl>выбирает новую масть</Hl>. Даму можно перевести другой
          дамой, которая снова выберет масть.
        </RuleCard>

        <RuleCard title="Девятка" badge="9" accent="gold" index={5} art={<Card small card={ART.nine} />}>
          Девятку нужно <Hl>накрыть картой той же масти</Hl>. Можно перевести другой девяткой.
          Если накрыть нечем — берёте карту и пропускаете.
        </RuleCard>

        <RuleCard title="Пиковый король" badge="K♠" accent="red" index={6} art={<Card small card={ART.king} />}>
          Следующий игрок берёт <Hl>4 карты</Hl>. Пиковый король <Hl>не переводится</Hl>.
        </RuleCard>

        <RuleCard title="Что переводится" accent="gold" index={7}>
          Переводятся: <Hl>6, туз, дама, 9</Hl>. Не переводятся: <Hl>7</Hl> и <Hl>пиковый король</Hl>.
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
          По умолчанию лимит <Hl>101</Hl>. Перебрал лимит — <Hl>«улетел»</Hl> и выбываешь. Набрал
          <Hl> ровно лимит</Hl> — счёт <Hl>обнуляется до 0</Hl>. Лимит меняется в настройках.
        </RuleCard>
      </div>
    </div>
  );
}

/** Подсветка ключевого слова в тексте правил. */
function Hl({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-white/90">{children}</strong>;
}

/** Шаг иллюстрированной инструкции с иконкой и вертикальной линией-связкой. */
function FlowStep({
  icon,
  title,
  text,
  index,
  last,
}: {
  icon: string;
  title: string;
  text: string;
  index: number;
  last: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.07 }}
      className="flex gap-3.5"
    >
      <div className="flex flex-col items-center">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-sheen text-lg shadow-glow">
          <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">{icon}</span>
        </div>
        {!last && <div className="my-1 w-px flex-1 bg-gradient-to-b from-gold-500/40 to-transparent" />}
      </div>
      <div className={last ? '' : 'pb-4'}>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-gold-300">
            {index + 1}
          </span>
          <h3 className="font-display text-lg leading-tight text-white/90">{title}</h3>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-white/60">{text}</p>
      </div>
    </motion.div>
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
