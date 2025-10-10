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
	const VERSION = '0.6.0';
	
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
	
	// Find React Fiber
	function getReactFiber(dom) {
		console.log('[JumpToCode] Searching for fiber on:', dom.tagName, dom.className);
		
		// First, check the clicked element directly with detailed logging
		console.log('[JumpToCode] Checking clicked element directly...');
		let foundKeys = [];
		for (const key in dom) {
			if (key.includes('react') || key.includes('fiber') || key.includes('Fiber')) {
				foundKeys.push(key);
			}
		}
		console.log('[JumpToCode] React-related keys on clicked element:', foundKeys);
		
		let el = dom;
		let attempts = 0;
		
		while (el && attempts < 100) {
			// Use for...in to iterate over all properties (including non-enumerable)
			for (const key in el) {
				if (key.startsWith("__reactFiber$") || 
				    key.startsWith("__reactInternalInstance$") ||
				    key.startsWith("__reactProps$") ||
				    key.startsWith("__reactContainer$")) {
					console.log(`[JumpToCode] ✅ Found fiber at attempt ${attempts}:`, key);
					
					let fiber = el[key];
					// Handle container
					if (key.startsWith("__reactContainer$") && fiber.current) {
						console.log('[JumpToCode] Converting container to fiber');
						fiber = fiber.current;
					}
					return fiber;
				}
			}
			
			el = el.parentNode;
			attempts++;
		}
		
		console.warn('[JumpToCode] ❌ No fiber found after', attempts, 'attempts');
		console.log('[JumpToCode] This is strange - the manual inspector found it!');
		console.log('[JumpToCode] Trying direct property access...');
		
		// Last resort: try to find the key directly
		const allKeys = Object.getOwnPropertyNames(dom);
		console.log('[JumpToCode] All own properties:', allKeys.filter(k => k.includes('react')));
		
		return null;
	}
	
	// Find debug source
	function findDebugSource(fiber) {
		if (!fiber) return null;
		
		let current = fiber;
		let depth = 0;
		
		while (current && depth < 50) {
			if (current._debugSource) {
				console.log(`[JumpToCode] ✅ Found _debugSource at depth ${depth}`);
				console.log('[JumpToCode] File:', current._debugSource.fileName);
				console.log('[JumpToCode] Line:', current._debugSource.lineNumber);
				return current._debugSource;
			}
			
			if (current._debugOwner?._debugSource) {
				return current._debugOwner._debugSource;
			}
			
			current = current.return;
			depth++;
		}
		
		console.warn('[JumpToCode] No _debugSource found');
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
	showNotification("JumpToCode: Click any React component");
	
	console.log('[JumpToCode] Ready! Click any component.');
}