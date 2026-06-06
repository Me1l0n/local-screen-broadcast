# 📡 local-screen-broadcast

> **LAN screen broadcasting dashboard for gaming tournaments.**  
> Players share their screens over the local network — the organizer watches and switches between them in real time, with no internet required.

**[🇷🇺 Читать на русском](#-описание)**

![WebRTC](https://img.shields.io/badge/WebRTC-P2P-blueviolet?style=flat-square) ![Node.js](https://img.shields.io/badge/Node.js-LTS-green?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey?style=flat-square)

---

## 📋 Table of Contents

- [Description](#-description)
- [Features](#-features)
- [Architecture](#️-architecture)
- [Quick Start](#-quick-start)
- [Browser Setup](#-browser-setup-important)
- [Admin Dashboard Controls](#-admin-dashboard-controls)
- [Player Settings](#️-player-settings)
- [Project Structure](#-project-structure)
- [Tech Stack](#️-tech-stack)
- [Pre-event Checklist](#-pre-event-checklist)
- [Описание](#-описание)
- [Возможности](#-возможности)
- [Быстрый старт](#-быстрый-старт)
- [Настройка браузера](#-настройка-браузера-важно)
- [Управление панелью](#-управление-панелью-организатора)

---

## 📖 Description

**local-screen-broadcast** is a self-hosted LAN tool for gaming tournaments. It lets the tournament organizer view and switch between participants' screens in real time — all without an internet connection.

Built for situations where cloud-based solutions (OBS Ninja, etc.) don't work well due to poor or unstable internet connectivity. Everything runs inside the local network.

---

## ✨ Features

- 🖥️ **Multi-screen dashboard** — view all player streams in a grid
- ⌨️ **Keyboard shortcuts** — switch between players with keys `1–9 / 0` and Numpad
- ⏸️ **Smart pause/resume** — inactive streams are paused to save CPU and bandwidth
- 🔊 **Auto audio** — sound unmutes automatically when a player is in fullscreen
- 🔒 **Localhost-only admin** — players cannot access the organizer dashboard
- 🔐 **Self-signed TLS** — required for `getDisplayMedia`, auto-generated on startup
- 🎮 **H.264 hardware acceleration** — low CPU usage via GPU encoding/decoding
- 🚀 **Zero-config setup** — `run.bat` installs everything on a clean Windows PC
- 🌐 **No internet needed** — video is 100% peer-to-peer on your LAN

---

## 🏗️ Architecture

```
Streamer PC (Node.js server)
       │
       │  WebRTC P2P (video goes directly, no relay)
       │
       ├──── Player 1 browser  →  https://192.168.x.x:3456/stream
       ├──── Player 2 browser  →  https://192.168.x.x:3456/stream
       ├──── Player 3 browser  →  https://192.168.x.x:3456/stream
       └──── ...
       
       Admin browser (localhost only)
             https://localhost:3456
```

The Node.js server handles **signaling only** (who connects to whom via Socket.io). Video travels **peer-to-peer** between each player's PC and the organizer's browser — the server never touches the video stream.

---

## 🚀 Quick Start

### Option A — Windows one-click

Double-click **`run.bat`**. It will:
1. Check if Node.js is installed (installs automatically via `winget` or MSI download if not)
2. Run `npm install`
3. Start the server

### Option B — Manual (any OS)

**Requirement:** [Node.js LTS v18+](https://nodejs.org/en/download)

```bash
git clone https://github.com/Me1l0n/local-screen-broadcast.git
cd local-screen-broadcast
npm install
node server.js
```

After startup the console shows your LAN IP and all URLs:

```
╔══════════════════════════════════════════════════╗
║     🎮  TOURNAMENT STREAM SERVER  READY  🎮      ║
╚══════════════════════════════════════════════════╝

  🔒  Admin panel  : https://localhost:3456/
  🎮  Player link  : https://192.168.0.100:3456/stream
```

---

## 🌐 Browser Setup (IMPORTANT)

### Self-signed certificate warning

On **every device** (both organizer and players), Chrome will show:

> ⚠️ **"Your connection is not private"** / **NET::ERR_CERT_AUTHORITY_INVALID**

This is **expected and safe** — the certificate is self-signed and only used on your local network.

**How to proceed:**
1. Click **Advanced**
2. Click **Proceed to `<ip>` (unsafe)**

This needs to be done **once per device per server restart**.

---

### Enable Hardware Acceleration in Chrome

Without hardware acceleration, the CPU will hit 100% and frames will drop.

**Steps (do this on every PC):**

1. Open Chrome → click **⋮** (three dots, top right) → **Settings**
2. In the left sidebar: **System**
3. Turn ON: **"Use hardware acceleration when available"**
4. Click **Relaunch**

**Verify it works:**
1. Open a new tab → type `chrome://gpu` → press Enter
2. Find the **"Video Encode"** row in the "Graphics Feature Status" section
3. It should say: ✅ **Hardware accelerated**
4. If it says ❌ `Software only` — the GPU doesn't support hardware encoding; CPU load will be higher

> **Note for NVIDIA users:** Make sure your GPU drivers are up to date. Outdated drivers often disable hardware video encoding.

---

### Allow screen capture (players only)

When a player clicks "Start Broadcast":
- Chrome will ask **"Choose what to share"**
- Player must select **"Entire Screen"** (not a window or tab)
- Then click **"Share"**

> ⚠️ Selecting a window instead of the full screen may miss the game overlay, FPS counter, etc.

---

## 🎮 Admin Dashboard Controls

### Keyboard shortcuts

| Key | Action |
|---|---|
| `1` – `9` | Switch to player 1–9 (fullscreen + audio) |
| `0` | Switch to player 10 |
| `Numpad 1–9 / 0` | Same, on the numeric keypad |
| `Esc` | Exit fullscreen → back to grid |
| `Double-click` on video card | Same as pressing the player's number key |

### Smart switching logic

When you press a player's key:
1. 📡 Server tells that player to **resume** their stream
2. ⏳ Dashboard waits for **real decoded frames** (not the first black frame)
3. ➕ **+1 second** stabilization buffer
4. 🖥️ Enters **fullscreen** with a live image already showing
5. 🔇 After **3.5 seconds** — the previous player is paused (saves CPU/bandwidth)

If you press another key while switching → the request is **queued** and runs after the current switch completes. Rapid pressing will always end on the last key you pressed.

### Grid view

When no player is fullscreen, all cards show a **frozen last frame** with a pause overlay. Streams are not decoded → minimal CPU usage.

---

## ⚙️ Player Settings

Each player can adjust on their `/stream` page:

| Setting | Options | Recommended |
|---|---|---|
| FPS | 15 / 30 / 60 | **30** for most cases |
| Bitrate | Auto / 10 / 25 / 50 Mbps | **10 Mbps** on LAN |

> **60 FPS / 25+ Mbps** — only if the network is stable and PCs are powerful.  
> **Auto bitrate** can spike and overload weak PCs.

---

## 📁 Project Structure

```
├── server.js              # Express + Socket.io signaling server
├── package.json           # Dependencies
├── run.bat                # Windows auto-installer + launcher
├── tournament_guide.md    # Full day-of-event guide (Russian)
└── public/
    ├── index.html         # Admin dashboard  (localhost only)
    ├── stream.html        # Player screen-share page
    └── view.html          # OBS Browser Source view (/view?player=N)
```

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Server | Node.js, Express, Socket.io |
| Video transport | WebRTC (P2P, H.264 preferred) |
| TLS | Self-signed via `selfsigned` package |
| Frontend | Vanilla HTML / CSS / JS |
| Installer | Windows Batch + winget / PowerShell |

---

## 📋 Pre-event Checklist

- [ ] All PCs connected to the same LAN (same Wi-Fi router or switch)
- [ ] `run.bat` executed — console shows **SERVER READY**
- [ ] Admin panel open at `https://localhost:3456` — certificate warning accepted
- [ ] Hardware acceleration enabled in Chrome on all PCs
- [ ] Each player: opened `/stream`, accepted certificate, clicked **Start Broadcast**, selected **Entire Screen**
- [ ] All player cards visible in the dashboard grid
- [ ] Keyboard switching tested (keys `1`–`9`)

---

---

# 🇷🇺 Русская версия

## 📖 Описание

**local-screen-broadcast** — локальный инструмент для трансляции экранов участников на турнире. Организатор видит экраны всех игроков в реальном времени и переключается между ними с клавиатуры — без интернета, всё внутри локальной сети.

Создан для случаев, когда облачные решения (OBS Ninja / VDO.Ninja) не работают из-за слабого интернета. Видео идёт напрямую между устройствами (WebRTC P2P) внутри LAN.

---

## ✨ Возможности

- 🖥️ **Панель со всеми экранами** — сетка карточек всех подключённых игроков
- ⌨️ **Горячие клавиши** — переключение между игроками клавишами `1–9 / 0` и Numpad
- ⏸️ **Умная пауза** — неактивные потоки останавливаются, экономя CPU и сеть
- 🔊 **Автозвук** — звук включается автоматически при открытии игрока в полный экран
- 🔒 **Защита панели** — панель организатора открывается только на его ПК (localhost)
- 🔐 **Авто-сертификат** — TLS-сертификат генерируется сам при каждом запуске
- 🎮 **Аппаратное ускорение** — H.264 через GPU, низкая нагрузка на процессор
- 🚀 **Автоустановка** — `run.bat` сам установит Node.js и зависимости на чистой Windows
- 🌐 **Без интернета** — видео 100% в пределах локальной сети

---

## 🚀 Быстрый старт

### Вариант А — Windows одним кликом

Дважды кликнуть на **`run.bat`**. Скрипт:
1. Проверит наличие Node.js (установит сам через winget или MSI если нет)
2. Запустит `npm install`
3. Запустит сервер

### Вариант Б — Вручную (любая ОС)

**Требование:** [Node.js LTS v18+](https://nodejs.org/en/download)

```bash
git clone https://github.com/Me1l0n/local-screen-broadcast.git
cd local-screen-broadcast
npm install
node server.js
```

После запуска консоль покажет IP твоего ПК и все ссылки:

```
╔══════════════════════════════════════════════════╗
║     🎮  TOURNAMENT STREAM SERVER  READY  🎮      ║
╚══════════════════════════════════════════════════╝

  🔒  Панель хоста  : https://localhost:3456/
  🎮  Игрок (стрим) : https://192.168.0.100:3456/stream
```

---

## 🌐 Настройка браузера (ВАЖНО)

### Предупреждение о сертификате

На **каждом устройстве** Chrome покажет:

> ⚠️ **«Ваше подключение не защищено»** / **NET::ERR_CERT_AUTHORITY_INVALID**

Это **нормально** — сертификат самоподписанный, он нужен только для работы захвата экрана.

**Как пройти:**
1. Нажать **«Дополнительно»**
2. Нажать **«Перейти на сайт (небезопасно)»**

Нужно сделать **один раз на каждом устройстве** при каждом новом запуске сервера.

---

### Включить аппаратное ускорение в Chrome

Без аппаратного ускорения процессор будет загружен на 100%, кадры будут пропускаться.

**Шаги (на каждом ПК):**

1. Открыть Chrome → нажать **⋮** (три точки, вверху справа) → **Настройки**
2. В меню слева: **Система**
3. Включить: **«Использовать аппаратное ускорение (при наличии)»**
4. Нажать **«Перезапустить»**

**Проверить что работает:**
1. Открыть новую вкладку → ввести `chrome://gpu` → Enter
2. Найти строку **«Video Encode»** в разделе «Graphics Feature Status»
3. Должно быть написано: ✅ **Hardware accelerated**
4. Если написано ❌ `Software only` — GPU не поддерживает аппаратное кодирование, CPU нагрузка будет выше

> **Для NVIDIA:** убедитесь что драйверы GPU актуальные. Устаревшие драйверы часто отключают аппаратное кодирование видео.

---

### Разрешить захват экрана (для игроков)

Когда игрок нажимает «Начать трансляцию»:
- Chrome спросит **«Что вы хотите показать?»**
- Нужно выбрать **«Экран»** (не окно и не вкладку!)
- Нажать **«Поделиться»**

> ⚠️ Если выбрать окно игры — оверлей, счётчик FPS и другие элементы могут не попасть в трансляцию.

---

## 🎮 Управление панелью организатора

### Горячие клавиши

| Клавиша | Действие |
|---|---|
| `1` – `9` | Открыть игрока 1–9 на весь экран + звук |
| `0` | Открыть игрока 10 |
| `Numpad 1–9 / 0` | То же самое, цифровой блок |
| `Esc` | Выйти из полного экрана → вернуться к сетке |
| **Двойной клик** на карточке | То же что нажать цифру |

### Логика переключения

При нажатии клавиши игрока:
1. 📡 Сервер даёт команду игроку возобновить трансляцию
2. ⏳ Ждём пока появятся реальные декодированные кадры (не первый чёрный)
3. ➕ **+1 секунда** для стабилизации картинки
4. 🖥️ Входим в **полный экран** с уже живым изображением
5. 🔇 Через **3.5 секунды** — предыдущий игрок ставится на паузу

Если нажать клавишу пока идёт переключение → запрос **встаёт в очередь** и выполняется после. Быстрые нажатия всегда приведут к последнему выбранному игроку.

### Сетка (главный экран)

Когда никто не в полном экране — все карточки показывают **замороженный последний кадр**. Видео не воспроизводится, потоки приостановлены → минимальная нагрузка на CPU.

---

## 📋 Чеклист перед трансляцией

- [ ] Все ПК в одной локальной сети (один роутер или свитч)
- [ ] `run.bat` запущен, в консоли написано **SERVER READY**
- [ ] Панель открыта на `https://localhost:3456`, принято предупреждение о сертификате
- [ ] На всех ПК включено аппаратное ускорение в Chrome
- [ ] Каждый игрок: открыл `/stream`, принял сертификат, нажал **«Начать трансляцию»**, выбрал **«Экран»**
- [ ] В панели видны карточки всех игроков
- [ ] Протестировано переключение клавишами `1–9`

---

## 📄 Лицензия / License

MIT — свободное использование, изменение и распространение.
