#!/bin/sh
# Профиль Chromium лежит в Docker-volume и переживает пересоздание контейнера.
# Chromium оставляет в нём lock-файлы с hostname старого контейнера и при следующем
# старте отказывается открывать профиль ("profile appears to be in use ... on another computer").
# Контейнер всегда один на профиль, поэтому lock-файлы безопасно удалять перед запуском.
rm -f /home/neko/.config/chromium/SingletonLock \
      /home/neko/.config/chromium/SingletonSocket \
      /home/neko/.config/chromium/SingletonCookie
mkdir -p /home/neko/Downloads   # сюда Chromium сохраняет файлы, отсюда их раздаёт панель neko
# RestoreOnStartup восстанавливает прошлые вкладки. START_URL открываем только при первом запуске
# (сессий ещё нет), иначе при каждом перезапуске добавлялась бы лишняя вкладка.
if [ -z "$(ls -A /home/neko/.config/chromium/Default/Sessions 2>/dev/null)" ]; then
  set -- "$@" "$START_URL"
fi
exec /usr/bin/chromium "$@"
