// DOFFA Defense — экран комнатного action-roguelite режима (порт RoomScreen
// из Java-версии). React + canvas, по структуре повторяет BeanDuelScreen:
// rAF-цикл с накоплением dt и фиксированным шагом движка, DOM-оверлеи
// поверх канваса. Управление: виртуальный джойстик (тач/мышь) + WASD/стрелки;
// стоишь — авто-атакуешь ближайшего врага. ESC — пауза («ПАУЗА», ESC/Enter —
// продолжить, Q — выйти), 1-3 — выбор способности в драфте, Enter — комната
// восстановления / смерть / конец главы. Визуал — честные процедурные
// фигуры (круги/прямоугольники) в палитре DoffaPalette, как и плейсхолдер-
// графика Java-версии.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PremiumButton } from '../../components/shared/PremiumButton';
import { haptics } from '../../lib/haptics';
import { useOnlineStore } from '../../net/onlineStore';
import {
  DefenseRun,
  PLAYER_MAX_HP,
  draftHeaderFor,
  roomTypeLabel,
  type DefenseRun as Run,
  type RunPhase,
} from './engine';

interface Props {
  onExit: () => void;
}

// Виртуальный размер вьюпорта — как GameCamera в Java-версии.
const VW = 1280;
const VH = 720;
const JOYSTICK_MAX_RADIUS = 80;

// Палитра DoffaPalette (config/DoffaPalette.java).
const COLORS = {
  espressoDark: '#241408',
  darkWood: '#4A2F1D',
  cream: '#F4E3C1',
  copper: '#B5651D',
  foam: '#FFF7E8',
  alert: '#C1553E',
  ink: '#1F1712',
  gold: '#E0A43B',
};

const ENEMY_COLORS: Record<string, string> = {
  syndicate_chemical_runner: '#7FA653',
  syndicate_toxic_thrower: '#4E9A8E',
  syndicate_armored_brewer: '#8A7B6E',
  syndicate_mutated_dealer: '#A04EC1',
};

export function DoffaDefenseScreen({ onExit }: Props) {
  const runRef = useRef<Run>(new DefenseRun());
  const [, setFrame] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const joystickRef = useRef<{ id: number; anchorX: number; anchorY: number; curX: number; curY: number } | null>(null);
  const lastHpRef = useRef(PLAYER_MAX_HP);

  // ── Серверная экономика забега (см. server/src/services/runService.ts) ──
  // Вход списывается сервером при старте (run:start), награды приходят только
  // в ответе run:finished. Клиент суммы не считает — лишь показывает их на
  // оверлее после подтверждения. Без сессии забег остаётся играбельным офлайн.
  const onlineStatus = useOnlineStore((s) => s.status);
  const onlineUser = useOnlineStore((s) => s.user);
  const lastRunResult = useOnlineStore((s) => s.lastRunResult);
  /** Фаза движка на прошлом кадре — чтобы поймать переход в dead/complete один раз. */
  const prevPhaseRef = useRef<RunPhase>('combat');
  /** wall-clock старт забега — durationMs для серверной проверки правдоподобия. */
  const runStartedAtRef = useRef<number>(Date.now());
  /** finish уже отправлен за текущий забег (строго один раз). */
  const finishSentRef = useRef(false);
  /** runId, с которым ушёл finish — чтобы сопоставить ответ run:finished именно с этим забегом. */
  const finishSentRunIdRef = useRef<string | null>(null);
  /** Старт текущего забега уже запрошен — React StrictMode в dev дважды
   *  вызывает mount-эффект, а вход списывается сервером за КАЖДЫЙ run:start. */
  const startRequestedRef = useRef(false);

  // Старт забега на сервере (если есть сессия с кошельком) + сброс учётных меток.
  // Без сессии — тихий офлайн-режим: игра та же, наград нет.
  const beginServerRun = useCallback(() => {
    prevPhaseRef.current = 'combat';
    runStartedAtRef.current = Date.now();
    finishSentRef.current = false;
    finishSentRunIdRef.current = null;
    if (startRequestedRef.current) return; // один забег — один run:start
    startRequestedRef.current = true;
    const online = useOnlineStore.getState();
    if (online.status === 'connected' && online.user) {
      online.startRun();
    }
  }, []);

  // Первый забег — при монтировании экрана.
  useEffect(() => {
    beginServerRun();
  }, [beginServerRun]);

  // Игровой цикл: накапливаем dt, движок шагает фиксированным тиком.
  useEffect(() => {
    const loop = (ts: number) => {
      const last = lastTsRef.current;
      lastTsRef.current = ts;
      const dt = last === null ? 1 / 60 : Math.min(0.1, (ts - last) / 1000);

      const run = runRef.current;
      run.setMoveInput(...readMoveInput(keysRef.current, joystickRef.current));
      run.advance(dt);

      // Забег завершился (смерть или глава пройдена) — один раз шлём серверу
      // статистику; награду считает и подтверждает только сервер (run:finished).
      if (run.phase !== prevPhaseRef.current) {
        prevPhaseRef.current = run.phase;
        if ((run.phase === 'dead' || run.phase === 'complete') && !finishSentRef.current) {
          finishSentRef.current = true;
          const online = useOnlineStore.getState();
          const runId = online.activeRunId;
          if (online.status === 'connected' && online.user && runId) {
            finishSentRunIdRef.current = runId;
            online.finishRun({
              runId,
              roomsCleared: run.roomsCleared,
              miniBossKilled: run.miniBossKilled,
              chapterComplete: run.phase === 'complete',
              durationMs: Date.now() - runStartedAtRef.current,
              seed: run.runSeed,
            });
          }
        }
      }

      if (run.health.currentHp < lastHpRef.current) {
        haptics.special?.();
      }
      lastHpRef.current = run.health.currentHp;

      drawScene(canvasRef.current, run, joystickRef.current);
      setFrame((n) => n + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const restart = useCallback(() => {
    runRef.current = new DefenseRun();
    lastHpRef.current = PLAYER_MAX_HP;
    lastTsRef.current = null;
    startRequestedRef.current = false; // новый забег — новый runId и новая плата за вход
    beginServerRun();
  }, [beginServerRun]);

  // Клавиатура: движение + оверлеи.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);
      const run = runRef.current;

      if (key === 'escape') {
        e.preventDefault();
        if (run.phase === 'combat') {
          run.setPaused(!run.paused);
        } else if (run.phase === 'dead' || run.phase === 'complete') {
          onExit();
        }
        return;
      }
      if (run.paused) {
        if (key === 'enter') run.setPaused(false);
        else if (key === 'q' || key === 'backspace') onExit();
        return;
      }
      if (run.phase === 'draft' && ['1', '2', '3'].includes(key)) {
        run.pickDraft(Number(key) - 1);
        haptics.tap?.();
        return;
      }
      if (run.phase === 'recovery' && key === 'enter') {
        run.confirmRecovery();
        return;
      }
      if (run.phase === 'dead' && key === 'enter') {
        restart();
        return;
      }
      if (run.phase === 'complete' && key === 'enter') {
        onExit();
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onExit, restart]);

  // Виртуальный джойстик — координаты в виртуальном пространстве вьюпорта.
  const toVirtual = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VW,
      y: ((clientY - rect.top) / rect.height) * VH,
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toVirtual(e.clientX, e.clientY);
    if (!p || joystickRef.current) return;
    joystickRef.current = { id: e.pointerId, anchorX: p.x, anchorY: p.y, curX: p.x, curY: p.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const joy = joystickRef.current;
    if (!joy || joy.id !== e.pointerId) return;
    const p = toVirtual(e.clientX, e.clientY);
    if (!p) return;
    joy.curX = p.x;
    joy.curY = p.y;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (joystickRef.current?.id === e.pointerId) joystickRef.current = null;
  };

  const run = runRef.current;
  const boss = run.boss && run.boss.alive ? run.boss : null;

  // Строка серверной награды для оверлеев смерти/конца главы. Показываем
  // суммы ТОЛЬКО после подтверждения сервером (run:finished именно этого
  // забега); до ответа — «подтверждает», офлайн — подсказка про кошелёк.
  const resultForThisRun =
    lastRunResult && finishSentRunIdRef.current && lastRunResult.runId === finishSentRunIdRef.current
      ? lastRunResult
      : null;
  const runRewardLine = ((): string | undefined => {
    if (resultForThisRun) {
      const parts = [`+${resultForThisRun.beansGranted} зёрен`];
      if (resultForThisRun.doffaGranted > 0) {
        parts.push(`+${resultForThisRun.doffaGranted} $DOFFA (после подтверждения сервера)`);
      }
      return parts.join(' · ');
    }
    if (finishSentRunIdRef.current) return 'Сервер подтверждает награду…';
    if (onlineStatus !== 'connected' || !onlineUser) {
      return 'Подключитесь с кошельком, чтобы получить награду';
    }
    return 'Забег без серверных наград: вход не подтверждён сервером';
  })();

  return (
    <div className="relative flex min-h-[100dvh] flex-col px-4 pt-3 safe-top safe-bottom">
      {/* шапка */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={onExit}
          aria-label="Выйти из DOFFA Defense"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 transition active:scale-95 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <div className="font-display text-sm tracking-wide gold-text">DOFFA Defense</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">
            Комната {run.roomNumber}/{run.totalRooms}
          </div>
        </div>
        <div className="h-10 w-10" />
      </div>

      {/* игровое поле */}
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl glass-strong">
        <canvas
          ref={canvasRef}
          width={VW}
          height={VH}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block w-full touch-none select-none"
          style={{ aspectRatio: `${VW} / ${VH}` }}
        />

        {/* HUD */}
        <div className="pointer-events-none absolute left-3 top-3 space-y-0.5 text-[11px] leading-snug text-[#F4E3C1] drop-shadow">
          <div>
            HP: {Math.ceil(run.health.currentHp)} / {Math.ceil(run.health.maxHp)}
          </div>
          <div>
            Комната {run.roomNumber}/{run.totalRooms} — {roomTypeLabel(run.currentPlan.type)} ({run.template.displayName})
          </div>
          <div>Врагов: {run.enemiesRemaining}</div>
          <div>Способностей: {run.abilitiesPicked}</div>
          {boss && (
            <div className="text-[#E0A43B]">
              {boss.definition.displayName}, фаза {boss.currentPhaseIndex + 1}
              {boss.isTelegraphing ? ` — готовит: ${boss.telegraphingAttackName}` : ''}
            </div>
          )}
        </div>

        {/* оверлеи */}
        <AnimatePresence>
          {run.paused && (
            <Overlay key="pause" title="ПАУЗА" subtitle="ESC / Enter — продолжить, Q — выйти в меню" />
          )}
          {!run.paused && run.phase === 'recovery' && (
            <Overlay
              key="recovery"
              title="БЕЗОПАСНАЯ КОМНАТА"
              subtitle="Силы восстановлены. Нажмите Enter, чтобы продолжить"
              actionLabel="Продолжить"
              onAction={() => runRef.current.confirmRecovery()}
            />
          )}
          {!run.paused && run.phase === 'dead' && (
            <Overlay
              key="dead"
              title="ЗАВЕДЕНИЕ ЗАКРЫТО"
              subtitle={`Комната ${run.roomNumber} из ${run.totalRooms}. Enter — попробовать снова`}
              rewardLine={runRewardLine}
              actionLabel="Ещё раз"
              onAction={restart}
              secondaryLabel="В меню"
              onSecondary={onExit}
            />
          )}
          {!run.paused && run.phase === 'complete' && (
            <Overlay
              key="complete"
              title="ГЛАВА ПРОЙДЕНА"
              subtitle={`Все ${run.totalRooms} комнат зачищены. Нажмите Enter, чтобы вернуться в меню`}
              rewardLine={runRewardLine}
              actionLabel="В меню"
              onAction={onExit}
            />
          )}
          {!run.paused && run.phase === 'draft' && (
            <motion.div
              key="draft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 px-4 backdrop-blur-sm"
            >
              <p className="font-display text-lg gold-text">{draftHeaderFor(run.currentPlan.type)}</p>
              <p className="text-[11px] text-white/50">Выберите способность (клавиши 1 / 2 / 3):</p>
              <div className="flex w-full max-w-lg flex-col gap-2 sm:flex-row">
                {run.draftOptions.map((ability, i) => (
                  <motion.button
                    key={ability.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    onClick={() => {
                      runRef.current.pickDraft(i);
                      haptics.tap?.();
                    }}
                    className="glass-strong flex-1 rounded-2xl p-4 text-left transition active:scale-95 hover:bg-white/[0.07]"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-gold-500/70">{i + 1}</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#F4E3C1]">{ability.displayName}</div>
                    <div className="mt-1 text-[11px] leading-snug text-white/45">{ability.description}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-3 text-center text-[11px] text-white/35">
        WASD / стрелки или джойстик — движение · стоишь — атакуешь · ESC — пауза
      </p>
    </div>
  );
}

function Overlay({
  title,
  subtitle,
  rewardLine,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  subtitle: string;
  /** Серверно подтверждённая награда за забег (зёрна/DOFFA) или подсказка. */
  rewardLine?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 grid place-items-center bg-black/70 px-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        className="glass-strong w-full max-w-xs rounded-3xl p-7 text-center"
      >
        <h2 className="font-display text-2xl gold-text">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/50">{subtitle}</p>
        {rewardLine && (
          <p className="mt-3 text-sm font-semibold leading-snug text-[#E0A43B]">{rewardLine}</p>
        )}
        {(actionLabel || secondaryLabel) && (
          <div className="mt-5 space-y-3">
            {actionLabel && onAction && (
              <PremiumButton full variant="gold" onClick={onAction}>
                {actionLabel}
              </PremiumButton>
            )}
            {secondaryLabel && onSecondary && (
              <PremiumButton full variant="ghost" onClick={onSecondary}>
                {secondaryLabel}
              </PremiumButton>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/** WASD/стрелки приоритетнее джойстика; направление нормализуется движком. */
function readMoveInput(
  keys: Set<string>,
  joy: { anchorX: number; anchorY: number; curX: number; curY: number } | null,
): [number, number] {
  let x = 0;
  let y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (x !== 0 || y !== 0) return [x, y];
  if (joy) {
    const dx = joy.curX - joy.anchorX;
    const dy = joy.curY - joy.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 8) {
      const scale = Math.min(dist, JOYSTICK_MAX_RADIUS) / dist;
      return [dx * scale, dy * scale];
    }
  }
  return [0, 0];
}

/** Камера по образцу GameCamera: центр на игроке, зажат в границы комнаты. */
function cameraCenter(run: Run): [number, number] {
  const b = run.bounds;
  const roomW = b.maxX - b.minX;
  const roomH = b.maxY - b.minY;
  const cx = roomW <= VW ? b.minX + roomW / 2 : Math.max(b.minX + VW / 2, Math.min(b.maxX - VW / 2, run.playerX));
  const cy = roomH <= VH ? b.minY + roomH / 2 : Math.max(b.minY + VH / 2, Math.min(b.maxY - VH / 2, run.playerY));
  return [cx, cy];
}

function drawScene(canvas: HTMLCanvasElement | null, run: Run, joy: { anchorX: number; anchorY: number; curX: number; curY: number } | null): void {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  ctx.fillStyle = COLORS.espressoDark;
  ctx.fillRect(0, 0, VW, VH);

  const [camX, camY] = cameraCenter(run);
  ctx.save();
  ctx.translate(VW / 2 - camX, VH / 2 - camY);

  const b = run.bounds;
  const t = run.template;
  // Пол комнаты
  ctx.fillStyle = COLORS.darkWood;
  ctx.fillRect(b.minX + t.margin, b.minY + t.margin, t.width - t.margin * 2, t.height - t.margin * 2);
  ctx.strokeStyle = 'rgba(244,227,193,0.12)';
  ctx.strokeRect(b.minX + t.margin, b.minY + t.margin, t.width - t.margin * 2, t.height - t.margin * 2);

  // Телеграф босса — растущее кольцо (Line-проход в Java-версии).
  const boss = run.boss && run.boss.alive ? run.boss : null;
  if (boss && boss.isTelegraphing) {
    const r = boss.telegraphingAttackRangePx * boss.telegraphProgress01;
    if (r > 1) {
      ctx.strokeStyle = COLORS.alert;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Враги
  for (const enemy of run.encounter.enemies) {
    if (!enemy.alive) continue;
    const r = enemy.definition.radiusPx;
    ctx.fillStyle = ENEMY_COLORS[enemy.definition.id] ?? COLORS.copper;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
    ctx.fill();
    drawHpBar(ctx, enemy.x, enemy.y + r + 10, r * 2, enemy.currentHp / enemy.definition.stats.maxHp);
    if (enemy.isBurning) {
      ctx.fillStyle = COLORS.copper;
      ctx.beginPath();
      ctx.arc(enemy.x + r * 0.6, enemy.y + r * 0.6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Босс
  if (boss) {
    const r = boss.definition.radiusPx;
    ctx.fillStyle = COLORS.alert;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    drawHpBar(ctx, boss.x, boss.y + r + 14, 320, boss.currentHp / boss.definition.maxHp);
    if (boss.isBurning) {
      ctx.fillStyle = COLORS.copper;
      ctx.beginPath();
      ctx.arc(boss.x + r * 0.6, boss.y + r * 0.6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Снаряды врагов
  ctx.fillStyle = '#9FD65C';
  for (const p of run.encounter.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Снаряды игрока — зёрна
  ctx.fillStyle = COLORS.gold;
  for (const p of run.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Герой — чашка-бариста (круг + ручка)
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.arc(run.playerX, run.playerY, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.copper;
  ctx.beginPath();
  ctx.arc(run.playerX, run.playerY, 20, 0, Math.PI * 2);
  ctx.fill();
  if (run.attacking) {
    ctx.fillStyle = COLORS.alert;
    ctx.beginPath();
    ctx.arc(run.playerX, run.playerY - 64, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (run.invulnerabilityTimer > 0) {
    ctx.fillStyle = COLORS.foam;
    ctx.beginPath();
    ctx.arc(run.playerX, run.playerY + 44, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Джойстик: якорное кольцо + ручка
  if (joy) {
    const [jx, jy] = [camX - VW / 2 + joy.anchorX, camY - VH / 2 + joy.anchorY];
    const [kx, ky] = [camX - VW / 2 + joy.curX, camY - VH / 2 + joy.curY];
    ctx.strokeStyle = 'rgba(244,227,193,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(jx, jy, JOYSTICK_MAX_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.copper;
    ctx.beginPath();
    ctx.arc(kx, ky, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawHpBar(ctx: CanvasRenderingContext2D, centerX: number, y: number, width: number, fraction: number): void {
  const barX = centerX - width / 2;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(barX, y, width, 6);
  ctx.fillStyle = COLORS.alert;
  ctx.fillRect(barX, y, width * Math.max(0, fraction), 6);
}
