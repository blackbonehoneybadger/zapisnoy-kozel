// Дымовой тест: регистрация, стол, старт с ботами, один ход. Не входит в прод.
import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:8080');
let games = 0;
let sawHidden = false;
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const timer = setTimeout(() => fail('таймаут'), 8000);

ws.on('open', () => ws.send(JSON.stringify({ t: 'register', name: 'Tester' + Date.now(), password: '1234' })));

ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.t === 'auth:err') return fail('auth: ' + m.message);
  if (m.t === 'error') return fail('error: ' + m.message);
  if (m.t === 'auth:ok') {
    console.log('✓ авторизация:', m.user.name);
    ws.send(JSON.stringify({ t: 'table:create', name: 'Smoke', maxPlayers: 3 }));
  }
  if (m.t === 'table' && m.table.status === 'waiting') {
    console.log('✓ стол создан, мест:', m.table.maxPlayers);
    ws.send(JSON.stringify({ t: 'table:start' }));
  }
  if (m.t === 'game') {
    games++;
    const me = m.state.players[m.youSeat];
    const others = m.state.players.filter((_, i) => i !== m.youSeat);
    if (others.some((p) => p.hand.some((c) => String(c.id).startsWith('h-')))) sawHidden = true;
    console.log(`✓ game #${games}: моя рука ${me.hand.length}, ход игрока ${m.state.currentPlayerIndex}, фаза ${m.state.phase}`);
    if (games === 1) {
      if (m.state.currentPlayerIndex === m.youSeat && m.state.phase === 'playing') {
        ws.send(JSON.stringify({ t: 'game:move', move: { type: 'take' } }));
      }
    }
    if (games >= 2) {
      if (!sawHidden) return fail('чужие руки не скрыты!');
      console.log('✓ чужие руки скрыты (редактирование работает)');
      console.log('SMOKE OK');
      clearTimeout(timer);
      ws.close();
      process.exit(0);
    }
  }
});

ws.on('error', (e) => fail('ws error: ' + e.message));
