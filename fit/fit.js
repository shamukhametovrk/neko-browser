// Вставляется nginx-ом в страницу neko. Сообщает серверу размер области под видео, чтобы
// виртуальный экран совпадал с ней (текст без масштабирования). В полном интерфейсе neko рядом
// есть панели, поэтому меряем не окно, а самый крупный контейнер вокруг <video>.
(function () {
  var room = location.pathname.split("/").filter(Boolean)[0];
  if (!room) return;
  var timer = null, lastKey = "", observed = null;

  function area() {
    var video = document.querySelector("video");
    if (!video) return { w: window.innerWidth, h: window.innerHeight, el: null };
    var best = video, el = video.parentElement;
    for (var i = 0; el && i < 5 && el !== document.body; i++, el = el.parentElement) {
      var r = el.getBoundingClientRect(), b = best.getBoundingClientRect();
      if (r.width * r.height > b.width * b.height) best = el;
    }
    var rect = best.getBoundingClientRect();
    return { w: rect.width, h: rect.height, el: best };
  }

  function send() {
    var a = area();
    if (a.el && a.el !== observed && window.ResizeObserver) {
      observed = a.el;
      new ResizeObserver(schedule).observe(a.el);   // панели neko открылись/закрылись
    }
    var w = Math.round(a.w), h = Math.round(a.h);
    if (w < 200 || h < 200) return;
    var key = w + "x" + h;
    if (key === lastKey) return;
    lastKey = key;
    fetch("/_fit/" + room + "?w=" + w + "&h=" + h, { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (j) { console.log("[autofit]", key, j); })
      .catch(function (e) { console.warn("[autofit]", e); });
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(send, 1000); }
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  // видео появляется только после входа — проверяем периодически, пока не найдём
  var poll = setInterval(function () { if (document.querySelector("video")) { clearInterval(poll); schedule(); } }, 1000);
  if (document.readyState === "complete") schedule(); else window.addEventListener("load", schedule);
})();
