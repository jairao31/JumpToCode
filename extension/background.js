// background.js
chrome.action.onClicked.addListener(async (tab) => {
	// Check if we're on a localhost URL
	if (!tab.url || !tab.url.startsWith('http://localhost:')) {
		console.warn('[JumpToCode] Extension only works on localhost URLs');
		return;
	}

	try {
		// Inject inline into MAIN world to access React internals
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: initClickToCode,
			world: 'MAIN' // This is the key - inject into page context!
		});

		console.log('[JumpToCode] Injected successfully into MAIN world');
	} catch (err) {
		console.error('[JumpToCode] Injection failed:', err);
	}
});

// This function will be injected into the page
function initClickToCode() {
	const VERSION = '0.7.0';

	console.log(`%c[JumpToCode] v${VERSION} injected!`, 'color: #4CAF50; font-weight: bold; font-size: 14px');

	// Check if already exists
	if (window.clickToCodeEnabled !== undefined) {
		window.clickToCodeEnabled = !window.clickToCodeEnabled;
		document.body.style.cursor = window.clickToCodeEnabled ? "crosshair" : "auto";

		// Toggle hover highlighting
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
				background: white;
				color: #333;
				padding: 10px 18px;
				border-radius: 6px;
				font-family: system-ui, -apple-system, sans-serif;
				font-size: 13px;
				z-index: 999998;
				pointer-events: none;
				// box-shadow: 0 2px 10px rgba(0,0,0,0.15), 0 0 0 1px rgba(76, 175, 80, 0.2);
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
			const fileName = debugSource.fileName.split('/').pop();
			const componentInfo = getComponentName(element);
			infoBox.innerHTML = `
				<span style="color: #4CAF50; font-weight: bold; font-size: 14px;">●</span> 
				<strong style="color: #333; font-weight: 600;">${componentInfo}</strong> 
				<span style="color: #ccc;">|</span> 
				<span style="color: #666; font-family: 'Courier New', monospace; font-size: 12px;">${fileName}:<span style="color: #4CAF50; font-weight: 600;">${debugSource.lineNumber}</span></span>
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
				} else if (typeof current.type === 'string') {
					// HTML element, keep searching up
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
		console.log('[JumpToCode] Hover listener attached');
	}

	// Remove hover listener
	function removeHoverListener() {
		if (window.clickToCodeHoverListener) {
			document.removeEventListener('mouseover', window.clickToCodeHoverListener, true);
			window.clickToCodeHoverListener = null;
			console.log('[JumpToCode] Hover listener removed');
		}
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

			if (response.ok) {
				showNotification("✅ Opened in VS Code!");
				window.clickToCodeEnabled = false;
				document.body.style.cursor = "auto";
				removeHoverListener();
				removeHighlight();
			} else {
				const error = await response.text();
				showNotification(`❌ ${error}`, true);
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