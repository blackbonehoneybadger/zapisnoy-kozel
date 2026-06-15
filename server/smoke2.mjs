// Тест на двух живых игроков за одним столом. Не входит в прод.
import { WebSocket } from 'ws';

const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const timer = setTimeout(() => fail('таймаут'), 10000);
const tag = Date.now();

function client(name) {
  const ws = new WebSocket(`ws://localhost:${process.env.PORT ?? 8080}`);
  const api = { ws, send: (m) => ws.send(JSON.stringify(m)), on: {} };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t === 'auth:err' || m.t === 'error') return fail(`${name}: ${m.message}`);
    api.on[m.t]?.(m);
  });
  ws.on('open', () => api.send({ t: 'register', name: `${name}-${tag}`, password: '1234' }));
  ws.on('error', (e) => fail(`${name} ws: ${e.message}`));
  return api;
}

const A = client('Alice');
const B = client('Bob');
let tableId = null;
let aGames = 0;
let bGames = 0;

A.on['auth:ok'] = () => A.send({ t: 'table:create', name: 'Дуэт', maxPlayers: 4 });
A.on['table'] = (m) => {
  tableId = m.table.id;
  const seated = m.table.seats.filter((s) => s.userId).length;
  if (seated === 2 && m.table.status === 'waiting') {
    console.log('✓ за столом двое людей — A стартует');
    A.send({ t: 'table:start' });
  }
};
A.on['game'] = (m) => {
  aGames++;
  if (aGames === 1) {
    const opp = m.state.players.filter((_, i) => i !== m.youSeat);
    const humanOpp = opp.filter((p) => !p.isBot).length;
    const bots = m.state.players.filter((p) => p.isBot).length;
    console.log(`✓ A видит партию: людей-соперников ${humanOpp}, ботов ${bots}`);
    if (humanOpp !== 1) return fail('A не видит второго человека');
    if (bots !== 2) return fail('боты не добили стол до 4');
  }
  maybeMove('A', A, m);
};

B.on['auth:ok'] = () => B.send({ t: 'lobby:subscribe' });
B.on['lobby'] = (m) => {
  const found = m.tables.find((t) => t.id === tableId);
  if (found && !B._joined) {
    B._joined = true;
    console.log('✓ B видит стол в лобби — подсаживается');
    B.send({ t: 'table:join', tableId });
  }
};
B.on['game'] = (m) => {
  bGames++;
  maybeMove('B', B, m);
};

let moved = false;
function maybeMove(who, c, m) {
  if (m.state.phase !== 'playing') return;
  if (m.state.currentPlayerIndex === m.youSeat && !moved) {
    moved = true;
    console.log(`✓ ход у ${who} — делает «взять»`);
    c.send({ t: 'game:move', move: { type: 'take' } });
    setTimeout(() => {
      if (aGames >= 1 && bGames >= 1) {
        console.log('✓ оба игрока получают синхронные обновления стола');
        console.log('SMOKE2 OK');
        clearTimeout(timer);
        process.exit(0);
      } else {
        fail('не оба игрока получили состояние');
      }
    }, 600);
  }
}
