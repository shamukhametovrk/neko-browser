// Сервис автоподстройки разрешения neko под экран пользователя.
// Страница присылает размер окна (CSS-пиксели), сервис логинится в neko как admin,
// выбирает ближайший доступный режим экрана той же ориентации и выставляет его.
import { createServer } from "node:http";

const ROOMS = JSON.parse(process.env.ROOMS); // {"browser":"http://neko-browser:8080/browser/"}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MIN_INTERVAL_MS = 3000; // не дёргать экран чаще, чем раз в 3 с на комнату
const last = {};

async function api(base, path, { token, method = "GET", body } = {}) {
  const res = await fetch(new URL(path, base), {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Ближайший режим: та же ориентация, минимальное отличие по логарифму сторон (масштаб ~1:1), 30 Гц приоритетнее
function pick(configs, w, h) {
  const portrait = h > w;
  const same = configs.filter((c) => (c.height > c.width) === portrait);
  const pool = same.length ? same : configs;
  const score = (c) => Math.abs(Math.log(c.width / w)) + Math.abs(Math.log(c.height / h)) + (c.rate === 30 ? 0 : 0.05);
  return pool.reduce((best, c) => (score(c) < score(best) ? c : best));
}

async function fit(room, w, h) {
  const base = ROOMS[room];
  const { token } = await api(base, "api/login", { method: "POST", body: { username: "autofit", password: ADMIN_PASSWORD } });
  try {
    const configs = await api(base, "api/room/screen/configurations", { token });
    const current = await api(base, "api/room/screen", { token });
    const target = pick(configs, w, h);
    if (target.width === current.width && target.height === current.height) return { changed: false, screen: current };
    await api(base, "api/room/screen", { token, method: "POST", body: target });
    return { changed: true, screen: target };
  } finally {
    await api(base, "api/logout", { token, method: "POST" }).catch(() => {});
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const room = url.pathname.split("/").filter(Boolean).pop();
  const w = parseInt(url.searchParams.get("w"), 10), h = parseInt(url.searchParams.get("h"), 10);
  const reply = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

  if (!ROOMS[room] || !(w > 200 && h > 200 && w < 8000 && h < 8000)) return reply(400, { error: "bad request" });
  if (Date.now() - (last[room] || 0) < MIN_INTERVAL_MS) return reply(429, { error: "too often" });
  last[room] = Date.now();

  try {
    const result = await fit(room, w, h);
    console.log(room, `${w}x${h}`, "->", `${result.screen.width}x${result.screen.height}`, result.changed ? "set" : "kept");
    reply(200, result);
  } catch (err) {
    console.error(room, err.message);
    reply(502, { error: err.message });
  }
}).listen(3000, () => console.log("autofit listening on :3000, rooms:", Object.keys(ROOMS).join(", ")));
