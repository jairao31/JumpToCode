# JumpToCode - React Click-to-Navigate

A developer tool that lets you click any React component in your locally running app and instantly jump to its source code in VS Code.

## Features

- Click any React component to open its source file
- Jump directly to the correct line number
- Works with any React app (Next.js, CRA, Vite, etc.)
- Hover to preview component name and file location
- VS Code integration (opens in the same window)

## How It Works

JumpToCode consists of two parts:

1. **Helper Server** - A local Node.js server that handles file opening in VS Code
2. **Chrome Extension** - A browser extension that detects clicks on React components

When you click a component, the extension finds the React fiber, extracts the source file and line number, and sends it to the helper server, which opens the file in VS Code.

## Installation & Setup

### Prerequisites

- Node.js installed
- VS Code installed with the `code` command in your PATH
- Chrome/Chromium browser
- React app running on localhost

### Step 1: Install and Run the Helper Server

```bash
git clone https://github.com/yourusername/jumptocode.git
cd jumptocode/helper-server
npm install
node open-in-editor-server.js
```

Leave this terminal open while using the extension.

### Step 2: Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Navigate to the cloned repository and select the `extension/` folder
5. The JumpToCode extension should now appear in your extensions list

### Step 3: Use the Extension

1. Start your React dev server (e.g., `npm start`)
2. Navigate to your app in Chrome (usually `http://localhost:3000`)
3. Click the JumpToCode extension icon in the Chrome toolbar
4. Click **Activate Click Mode**
5. Cursor changes to crosshair - click mode is now active
6. Hover over any React component to see the green highlight with component name, file path, and line number
7. Click the component to open its source file in VS Code at the correct line
8. Click mode automatically deactivates after a successful file open

Toggle on/off by clicking the extension icon and pressing the button again.

## Supported React Versions

- React 16+
- React 17
- React 18

## Known Limitations

- Only works with React components (not plain HTML elements)
- Requires React in development mode with source maps
- Only works on localhost URLs
- Helper server must be running on `http://localhost:5123`
- Only works in Chrome (for now)

## Architecture

```
JumpToCode/
├── extension/                          # Chrome extension
│   ├── manifest.json
│   ├── background.js
│   ├── popup.js
│   ├── popup.html
│   ├── content.js
│   └── icon.png
│
├── helper-server/                      # Express server
│   ├── package.json
│   └── open-in-editor-server.js
│
└── README.md
```

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Feedback & Issues

Found a bug or have a feature request? Open an issue on GitHub.