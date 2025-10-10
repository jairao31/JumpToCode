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

		showMessage('🎯 Click mode activated!', 'success');

		// Close popup after a short delay
		setTimeout(() => window.close(), 800);
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
})();

// This function gets injected into the page (same as background.js)
function initClickToCode() {
	const VERSION = '0.8.0';

	console.log(`%c[JumpToCode] v${VERSION} injected!`, 'color: #4CAF50; font-weight: bold; font-size: 14px');

	// Check if already exists
	if (window.clickToCodeEnabled !== undefined) {
		window.clickToCodeEnabled = !window.clickToCodeEnabled;
		document.body.style.cursor = window.clickToCodeEnabled ? "crosshair" : "auto";
		showNotification(window.clickToCodeEnabled ? "JumpToCode: Enabled" : "JumpToCode: Disabled");
		console.log(`[JumpToCode] Toggled: ${window.clickToCodeEnabled ? 'ON' : 'OFF'}`);
		return;
	}

	window.clickToCodeEnabled = false;
	window.clickToCodeVersion = VERSION;

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

		// Copy path functionality
		document.getElementById('copyPath').addEventListener('click', () => {
			const textToCopy = `${file}:${line}`;
			navigator.clipboard.writeText(textToCopy).then(() => {
				showNotification('✅ Path copied to clipboard!');
				alertDiv.remove();
			}).catch(() => {
				showNotification('❌ Failed to copy', true);
			});
		});

		// Close button
		document.getElementById('closeAlert').addEventListener('click', () => {
			alertDiv.remove();
		});

		// Close on escape key
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
					console.log(`[JumpToCode] ✅ Found fiber at attempt ${attempts}:`, key);

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
			} else {
				// Check if we should show alert
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
	showNotification("JumpToCode: Click any React component");

	console.log('[JumpToCode] Ready! Click any component.');
}