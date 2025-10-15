// popup.js
const SERVER_URL = 'http://localhost:5123';

// DOM elements
const serverStatus = document.getElementById('serverStatus');
const activateBtn = document.getElementById('activateBtn');
const testServerBtn = document.getElementById('testServerBtn');
const message = document.getElementById('message');

// Check server health
async function checkServer() {
	try {
		const response = await fetch(`${SERVER_URL}/health`);
		const data = await response.json();

		serverStatus.textContent = '🟢 Online';
		serverStatus.classList.add('online');
		serverStatus.classList.remove('offline');

		return true;
	} catch (err) {
		serverStatus.textContent = '🔴 Offline';
		serverStatus.classList.add('offline');
		serverStatus.classList.remove('online');

		return false;
	}
}

// Show message
function showMessage(text, type = 'success') {
	message.textContent = text;
	message.className = `message ${type}`;

	setTimeout(() => {
		message.className = 'message';
	}, 3000);
}

// Check extension state on popup load
async function checkExtensionState() {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

		if (!tab.url || !tab.url.startsWith('http://localhost:')) {
			activateBtn.textContent = '🎯 Activate Click Mode';
			activateBtn.disabled = true;
			activateBtn.style.opacity = '0.5';
			activateBtn.style.cursor = 'not-allowed';
			showMessage('⚠️ Only works on localhost', 'error');
			return;
		}

		// Try to check if extension is already active
		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => window.clickToCodeEnabled,
			world: 'MAIN'
		});

		const isActive = results && results[0] && results[0].result === true;
		updateButtonState(isActive);
	} catch (err) {
		// Extension not injected yet
		updateButtonState(false);
	}
}

// Update button state
function updateButtonState(isActive) {
	if (isActive) {
		activateBtn.textContent = '⏸️ Deactivate Click Mode';
		activateBtn.classList.remove('primary');
		activateBtn.classList.add('secondary');
	} else {
		activateBtn.textContent = '🎯 Activate Click Mode';
		activateBtn.classList.remove('secondary');
		activateBtn.classList.add('primary');
	}
}

// Activate click mode
activateBtn.addEventListener('click', async () => {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

		if (!tab.url || !tab.url.startsWith('http://localhost:')) {
			showMessage('⚠️ This extension only works on localhost', 'error');
			return;
		}

		// Inject the script
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: initClickToCode,
			world: 'MAIN'
		});

		// Check new state after toggle
		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => window.clickToCodeEnabled,
			world: 'MAIN'
		});

		const isActive = results && results[0] && results[0].result === true;
		updateButtonState(isActive);

		showMessage(isActive ? '🎯 Click mode activated!' : '⏸️ Click mode deactivated!', 'success');

		// Close popup after a short delay only if activating
		if (isActive) {
			setTimeout(() => window.close(), 800);
		}
	} catch (err) {
		showMessage('❌ Failed to activate: ' + err.message, 'error');
	}
});

// Test server connection
testServerBtn.addEventListener('click', async () => {
	const isOnline = await checkServer();
	if (isOnline) {
		showMessage('✅ Server is running correctly!', 'success');
	} else {
		showMessage('❌ Server is not running. Start it with: node open-in-editor-server.js', 'error');
	}
});

// Initialize on load
(async () => {
	await checkServer();
	await checkExtensionState();
})();

// This function gets injected into the page (same as background.js)
function initClickToCode() {
	const VERSION = '0.9.0';

	console.log(`%c[JumpToCode] v${VERSION} injected!`, 'color: #4CAF50; font-weight: bold; font-size: 14px');

	// Check if already exists
	if (window.clickToCodeEnabled !== undefined) {
		window.clickToCodeEnabled = !window.clickToCodeEnabled;
		document.body.style.cursor = window.clickToCodeEnabled ? "crosshair" : "auto";

		if (window.clickToCodeEnabled) {
			attachHoverListener();
		} else {
			removeHoverListener();
			removeHighlight();
		}

		showNotification(window.clickToCodeEnabled ? "JumpToCode: Enabled" : "JumpToCode: Disabled");
		console.log(`[JumpToCode] Toggled: ${window.clickToCodeEnabled ? 'ON' : 'OFF'}`);
		return;
	}

	window.clickToCodeEnabled = false;
	window.clickToCodeVersion = VERSION;
	window.clickToCodeHoverListener = null;
	window.clickToCodeHighlightOverlay = null;
	window.clickToCodeInfoBox = null;

	// Notification system
	function showNotification(message, isError = false) {
		const existing = document.querySelector('.JumpToCode-notification');
		if (existing) existing.remove();

		const notification = document.createElement('div');
		notification.className = 'JumpToCode-notification';
		notification.textContent = message;
		notification.style.cssText = `
			position: fixed;
			bottom: 20px;
			right: 20px;
			padding: 12px 20px;
			background: ${isError ? '#f44336' : '#4CAF50'};
			color: white;
			border-radius: 4px;
			z-index: 999999;
			font-family: system-ui, -apple-system, sans-serif;
			font-size: 14px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.2);
			animation: slideIn 0.3s ease;
		`;

		const style = document.createElement('style');
		style.textContent = `
			@keyframes slideIn {
				from { transform: translateX(400px); opacity: 0; }
				to { transform: translateX(0); opacity: 1; }
			}
			@keyframes slideOut {
				from { transform: translateX(0); opacity: 1; }
				to { transform: translateX(400px); opacity: 0; }
			}
			@keyframes pulse {
				0%, 100% { opacity: 0.7; }
				50% { opacity: 0.9; }
			}
		`;
		if (!document.querySelector('style[data-JumpToCode]')) {
			style.setAttribute('data-JumpToCode', 'true');
			document.head.appendChild(style);
		}

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.style.animation = 'slideOut 0.3s ease';
			setTimeout(() => notification.remove(), 300);
		}, 3000);
	}

	// Create highlight overlay
	function createHighlight() {
		if (!window.clickToCodeHighlightOverlay) {
			const overlay = document.createElement('div');
			overlay.className = 'JumpToCode-highlight';
			overlay.style.cssText = `
				position: absolute;
				pointer-events: none;
				z-index: 999997;
				border: 2px solid #4CAF50;
				background: rgba(76, 175, 80, 0.1);
				border-radius: 4px;
				transition: all 0.15s ease;
				box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.2),
				            0 0 10px rgba(76, 175, 80, 0.3);
				animation: pulse 2s ease-in-out infinite;
			`;
			document.body.appendChild(overlay);
			window.clickToCodeHighlightOverlay = overlay;
		}
		return window.clickToCodeHighlightOverlay;
	}

	// Create info box
	function createInfoBox() {
		if (!window.clickToCodeInfoBox) {
			const infoBox = document.createElement('div');
			infoBox.className = 'JumpToCode-info';
			infoBox.style.cssText = `
				position: fixed;
				top: 20px;
				left: 50%;
				transform: translateX(-50%);
				background: #4CAF50;
				color: white;
				padding: 10px 18px;
				border-radius: 4px;
				font-family: system-ui, -apple-system, sans-serif;
				font-size: 13px;
				z-index: 999998;
				pointer-events: none;
				box-shadow: 0 2px 8px rgba(0,0,0,0.2);
				white-space: nowrap;
				max-width: 90vw;
				overflow: hidden;
				text-overflow: ellipsis;
				display: flex;
				align-items: center;
				gap: 8px;
			`;
			document.body.appendChild(infoBox);
			window.clickToCodeInfoBox = infoBox;
		}
		return window.clickToCodeInfoBox;
	}

	// Get relative file path
	function getRelativePath(fullPath) {
		// Remove common prefixes to get relative path
		let relativePath = fullPath;

		// Remove webpack prefixes
		relativePath = relativePath.replace(/^webpack:\/\/\//, '');
		relativePath = relativePath.replace(/^webpack:\/\//, '');

		// Try to extract from common project structures
		const srcMatch = relativePath.match(/\/src\/(.+)$/);
		if (srcMatch) return 'src/' + srcMatch[1];

		const appMatch = relativePath.match(/\/app\/(.+)$/);
		if (appMatch) return 'app/' + appMatch[1];

		const componentsMatch = relativePath.match(/\/components\/(.+)$/);
		if (componentsMatch) return 'components/' + componentsMatch[1];

		const pagesMatch = relativePath.match(/\/pages\/(.+)$/);
		if (pagesMatch) return 'pages/' + pagesMatch[1];

		// If no match, return last 2-3 segments of path
		const pathParts = relativePath.split('/');
		if (pathParts.length > 3) {
			return '.../' + pathParts.slice(-2).join('/');
		}

		return relativePath.split('/').pop(); // fallback to filename
	}

	// Update highlight position
	function updateHighlight(element, debugSource) {
		const overlay = createHighlight();
		const infoBox = createInfoBox();
		const rect = element.getBoundingClientRect();

		overlay.style.left = (rect.left + window.scrollX) + 'px';
		overlay.style.top = (rect.top + window.scrollY) + 'px';
		overlay.style.width = rect.width + 'px';
		overlay.style.height = rect.height + 'px';
		overlay.style.display = 'block';

		if (debugSource) {
			const relativePath = getRelativePath(debugSource.fileName);
			const componentInfo = getComponentName(element);
			infoBox.innerHTML = `
				<strong style="font-weight: 600;">${componentInfo}</strong> 
				<span style="opacity: 0.7;">|</span> 
				<span style="font-family: 'Courier New', monospace; font-size: 12px; opacity: 0.95; font-weight: 600;">${relativePath}:<span style="font-weight: 600;">${debugSource.lineNumber}</span></span>
			`;
			infoBox.style.display = 'flex';
		}
	}

	// Remove highlight
	function removeHighlight() {
		if (window.clickToCodeHighlightOverlay) {
			window.clickToCodeHighlightOverlay.style.display = 'none';
		}
		if (window.clickToCodeInfoBox) {
			window.clickToCodeInfoBox.style.display = 'none';
		}
	}

	// Get component name from fiber
	function getComponentName(element) {
		const fiber = getReactFiber(element);
		if (!fiber) return 'Unknown';

		let current = fiber;
		let depth = 0;

		while (current && depth < 20) {
			if (current.type) {
				if (typeof current.type === 'function') {
					return current.type.name || current.type.displayName || 'Anonymous';
				}
			}
			current = current.return;
			depth++;
		}

		return element.tagName.toLowerCase();
	}

	// Hover handler
	function handleHover(e) {
		if (!window.clickToCodeEnabled) return;

		const fiber = getReactFiber(e.target);
		if (!fiber) {
			removeHighlight();
			return;
		}

		const debugSource = findDebugSource(fiber);
		updateHighlight(e.target, debugSource);
	}

	// Attach hover listener
	function attachHoverListener() {
		if (window.clickToCodeHoverListener) return;

		window.clickToCodeHoverListener = handleHover;
		document.addEventListener('mouseover', window.clickToCodeHoverListener, true);
	}

	// Remove hover listener
	function removeHoverListener() {
		if (window.clickToCodeHoverListener) {
			document.removeEventListener('mouseover', window.clickToCodeHoverListener, true);
			window.clickToCodeHoverListener = null;
		}
	}

	// Show alert with file location
	function showFileLocationAlert(file, line, errorMsg) {
		const alertDiv = document.createElement('div');
		alertDiv.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: white;
			padding: 24px;
			border-radius: 8px;
			box-shadow: 0 4px 20px rgba(0,0,0,0.3);
			z-index: 9999999;
			font-family: system-ui, -apple-system, sans-serif;
			max-width: 500px;
			width: 90%;
		`;

		alertDiv.innerHTML = `
			<div style="margin-bottom: 16px;">
				<h3 style="margin: 0 0 8px 0; color: #f44336; font-size: 18px;">⚠️ VS Code Not Found</h3>
				<p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">${errorMsg || 'VS Code is not installed or the "code" command is not in your PATH.'}</p>
			</div>
			<div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
				<div style="margin-bottom: 8px;">
					<strong style="color: #333; font-size: 13px;">📄 File:</strong>
					<div style="color: #666; font-size: 12px; word-break: break-all; margin-top: 4px; font-family: monospace;">${file}</div>
				</div>
				<div>
					<strong style="color: #333; font-size: 13px;">📍 Line:</strong>
					<span style="color: #666; font-size: 12px; margin-left: 8px;">${line}</span>
				</div>
			</div>
			<div style="display: flex; gap: 8px;">
				<button id="copyPath" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">
					Copy Path
				</button>
				<button id="closeAlert" style="flex: 1; padding: 10px; background: #757575; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">
					Close
				</button>
			</div>
		`;

		document.body.appendChild(alertDiv);

		document.getElementById('copyPath').addEventListener('click', () => {
			const textToCopy = `${file}:${line}`;
			navigator.clipboard.writeText(textToCopy).then(() => {
				showNotification('✅ Path copied to clipboard!');
				alertDiv.remove();
			}).catch(() => {
				showNotification('❌ Failed to copy', true);
			});
		});

		document.getElementById('closeAlert').addEventListener('click', () => {
			alertDiv.remove();
		});

		const escHandler = (e) => {
			if (e.key === 'Escape') {
				alertDiv.remove();
				document.removeEventListener('keydown', escHandler);
			}
		};
		document.addEventListener('keydown', escHandler);
	}

	// Find React Fiber
	function getReactFiber(dom) {
		let el = dom;
		let attempts = 0;

		while (el && attempts < 100) {
			for (const key in el) {
				if (key.startsWith("__reactFiber$") ||
					key.startsWith("__reactInternalInstance$") ||
					key.startsWith("__reactProps$") ||
					key.startsWith("__reactContainer$")) {

					let fiber = el[key];
					if (key.startsWith("__reactContainer$") && fiber.current) {
						fiber = fiber.current;
					}
					return fiber;
				}
			}

			el = el.parentNode;
			attempts++;
		}

		return null;
	}

	// Find debug source
	function findDebugSource(fiber) {
		if (!fiber) return null;

		let current = fiber;
		let depth = 0;

		while (current && depth < 50) {
			if (current._debugSource) {
				return current._debugSource;
			}

			if (current._debugOwner?._debugSource) {
				return current._debugOwner._debugSource;
			}

			current = current.return;
			depth++;
		}

		return null;
	}

	// Click handler
	async function handleClick(e) {
		if (!window.clickToCodeEnabled) return;

		e.preventDefault();
		e.stopPropagation();

		const fiber = getReactFiber(e.target);
		if (!fiber) {
			showNotification("⚠️ No React fiber found", true);
			return;
		}

		const debugSource = findDebugSource(fiber);
		if (!debugSource) {
			showNotification("⚠️ No debug source found", true);
			return;
		}

		const file = debugSource.fileName;
		const line = debugSource.lineNumber;

		showNotification(`Opening ${file.split('/').pop()}:${line}`);

		try {
			const response = await fetch("http://localhost:5123/open", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ file, line })
			});

			const result = await response.json();

			if (response.ok) {
				showNotification(`✅ Opened in VS Code!`);
				window.clickToCodeEnabled = false;
				document.body.style.cursor = "auto";
				removeHoverListener();
				removeHighlight();
			} else {
				if (result.alertUser) {
					if (result.vscodeNotInstalled) {
						showFileLocationAlert(result.file, result.line, result.error);
					} else {
						showNotification(`❌ ${result.error}`, true);
					}
				} else {
					showNotification(`❌ ${result.error || 'Failed to open file'}`, true);
				}
			}
		} catch (err) {
			console.error('[JumpToCode] Error:', err);
			showNotification("❌ Helper server not running", true);
		}
	}

	document.addEventListener("click", handleClick, true);

	// Enable immediately
	window.clickToCodeEnabled = true;
	document.body.style.cursor = "crosshair";
	attachHoverListener();
	showNotification("JumpToCode: Hover over any React component");

	console.log('[JumpToCode] Ready! Hover and click any component.');
}