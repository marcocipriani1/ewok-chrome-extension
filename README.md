# Ewok Chrome Extension

Ewok Chrome Extension integrates your browser with the `ewokd` daemon and bot.  
It handles task tracking, notification forwarding, and automated reporting.

## 🛠️ Installation

1. Open Chrome and go to **chrome://extensions/**
2. Enable **Developer mode** (top-right corner).
3. Click **Load unpacked**.
4. Select the folder containing the extracted Ewok extension files.  
   The extension will appear in your list and is ready to run.

## 🚪 Log in to Ewok

1. Enter your **Discord User ID** in the extension when prompted.
2. Open the **Ewoq home page** in a browser tab.
3. Keep that tab open. The bot relies on it to read notifications and forward them to your Discord.

## 📝 Tracking Tasks & Generating Reports

1. Work on tasks as usual in Ewoq.
2. Once done, open the Ewok extension.
3. Hit **Send Report**.  
   The daemon will process it and send the work time to your Discord chat with the bot.

## 📂 Requirements

- `ewokd` daemon running on your system
- Browser with extension developer mode available

## 📣 Notes

- The Ewoq tab must stay open for live notifications.
- Reports are generated based on the activity the extension records while you're working.

