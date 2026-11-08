#!/usr/bin/env bash
# Установка browser-neko на чистый Ubuntu/Debian: Docker, настройки, запуск.
# Запуск из папки проекта: sudo bash install.sh
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "запустите через sudo: sudo bash install.sh"

# --- 1. Docker -------------------------------------------------------------
say "Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "уже установлен: $(docker --version)"
else
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates >/dev/null
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# --- 2. Настройки ----------------------------------------------------------
say "Настройки"
[ -f .env ] || cp .env.example .env

set_var() {  # set_var ИМЯ значение
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
get_var() { grep "^$1=" .env | head -1 | cut -d= -f2-; }

IP=$(curl -fsS --max-time 10 https://ifconfig.me || curl -fsS --max-time 10 https://api.ipify.org) \
  || die "не удалось определить внешний IP сервера"
set_var PUBLIC_IP "$IP"
set_var DOMAIN "$IP.sslip.io"
echo "IP сервера: $IP"

gen_password() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16 || true; }

ask_password() {  # ask_password ИМЯ_ПЕРЕМЕННОЙ "описание" пароль_по_умолчанию
  local name=$1 label=$2 default=$3 current value
  current=$(get_var "$name")
  if [ -n "$current" ] && [ "$current" != "$default" ]; then
    echo "$label: уже задан, оставляю"
    return
  fi
  value=""
  if [ -r /dev/tty ]; then
    while true; do
      read -rsp "$label (Enter — сгенерировать): " value </dev/tty; echo
      [ -z "$value" ] && break
      [[ "$value" =~ ^[A-Za-z0-9._-]{6,}$ ]] && break
      echo "  минимум 6 символов: латинские буквы, цифры, . _ -"
    done
  fi
  [ -n "$value" ] || value=$(gen_password)
  set_var "$name" "$value"
}
ask_password USER_PASSWORD  "Пароль пользователя"    neko
ask_password ADMIN_PASSWORD "Пароль администратора" admin

# --- 3. Запуск -------------------------------------------------------------
say "Запуск (первый раз скачивается ~1,5 ГБ, это займёт несколько минут)"
docker compose up -d

say "Сертификат HTTPS"
cert_ok() { local logs; logs=$(docker compose logs caddy 2>/dev/null || true); grep -qi "certificate obtained" <<<"$logs"; }
CERT=no
for _ in $(seq 1 30); do
  if cert_ok; then CERT=yes; echo "получен"; break; fi
  sleep 3
done
[ "$CERT" = yes ] \
  || echo "пока не получен — проверьте, что порты 80 и 443 открыты у хостера; Caddy продолжит попытки сам"

# --- Итог ------------------------------------------------------------------
cat <<INFO

========================================================
  Готово!

  Адрес:                 https://$IP.sslip.io/browser/
  Пароль пользователя:   $(get_var USER_PASSWORD)
  Пароль администратора: $(get_var ADMIN_PASSWORD)

  Если страница не открывается — разрешите у хостера
  входящие порты 80, 443 (TCP) и 52000 (TCP и UDP).
========================================================
INFO
