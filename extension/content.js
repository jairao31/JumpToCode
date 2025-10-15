// content.js
(function () {
	// Version check - helps with cache issues
	const EXTENSION_VERSION = '0.4.0';
	console.log(`%c[JumpToCode] v${EXTENSION_VERSION} loading...`, 'color: #4CAF50; font-weight: bold');

	// Prevent multiple injections
	if (window.clickToCodeInjected) {
		console.log('[JumpToCode] Already injected v' + window.clickToCodeVersion + ', re-initializing');
		// Toggle if already exists
		if (window.clickToCodeToggle) {
			window.clickToCodeToggle();
		}
		return;
	}
	window.clickToCodeInjected = true;
	window.clickToCodeVersion = EXTENSION_VERSION;

	let clickModeEnabled = false;
	let clickHandler = null;

	// Show visual feedback
	function showNotification(message, isError = false) {
		const notification = document.createElement('div');
		notification.textContent = message;
		notification.style.cssText = `
			position: fixed;
			top: 20px;
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

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.style.animation = 'slideOut 0.3s ease';
			setTimeout(() => notification.remove(), 300);
		}, 3000);
	}

	// Add CSS animations
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
	document.head.appendChild(style);

	// Debug: Check React setup on load
	function checkReactSetup() {
		const hasReact = typeof window.React !== 'undefined';
		const hasDevTools = typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
		const testEl = document.querySelector('[data-reactroot], [data-reactid]')| document.body;
		const hasReactKeys = Object.keys(testEl).some(k => k.includes('react')| k.includes('fiber'));

		// Detect UI framework
		const hasChakra = !!document.querySelector('[class*="chakra"]');
		const hasMui = !!document.querySelector('[class*="Mui"]');
		const hasEmotion = !!document.querySelector('[class*="css-"]');

		console.log('%c[JumpToCode] React Setup Check:', 'font-weight: bold; font-size: 12px;');
		console.log('  React global:', hasReact ? '✅' : '❌');
		console.log('  DevTools hook:', hasDevTools ? '✅' : '❌');
		console.log('  React keys on elements:', hasReactKeys ? '✅' : '❌');

		if (hasChakra) {
			console.log('  UI Framework: Chakra UI detected');
			console.log('  💡 Tip: Click on interactive elements (buttons, links) for best results');
		} else if (hasMui) {
			console.log('  UI Framework: Material-UI detected');
		} else if (hasEmotion) {
			console.log('  UI Framework: Emotion/styled-components detected');
		}

		if (!hasDevTools) {
			console.warn('%c[JumpToCode] React DevTools hook not detected at load time.', 'color: orange');
			console.log('%c  This is normal if React is still initializing.', 'color: gray');
			console.log('%c  The extension will still try to find fibers when you click.', 'color: gray');
		}
	}

	// Run check after React has time to initialize
	setTimeout(checkReactSetup, 2000);

	chrome.runtime.onMessage.addListener((msg) => {
		if (msg.toggleClickMode) {
			toggleClickMode();
		}
	});

	// Also expose toggle globally for easy access
	window.clickToCodeToggle = toggleClickMode;

	function toggleClickMode() {
		clickModeEnabled = !clickModeEnabled;

		if (clickModeEnabled) {
			document.body.style.cursor = "crosshair";
			showNotification("JumpToCode: Click any React component");
			attachClickHandler();
			console.log('%c[JumpToCode] Enabled', 'color: #4CAF50; font-weight: bold');
		} else {
			document.body.style.cursor = "auto";
			showNotification("JumpToCode: Disabled");
			removeClickHandler();
			console.log('%c[JumpToCode] Disabled', 'color: gray');
		}
	}

	function attachClickHandler() {
		if (clickHandler) return; // Prevent duplicate listeners

		clickHandler = async (e) => {
			if (!clickModeEnabled) return;

			e.preventDefault();
			e.stopPropagation();

			// Add visual feedback on click
			const ripple = document.createElement('div');
			ripple.style.cssText = `
				position: absolute;
				border: 2px solid #4CAF50;
				border-radius: 4px;
				pointer-events: none;
				z-index: 999998;
			`;
			const rect = e.target.getBoundingClientRect();
			ripple.style.left = rect.left + window.scrollX + 'px';
			ripple.style.top = rect.top + window.scrollY + 'px';
			ripple.style.width = rect.width + 'px';
			ripple.style.height = rect.height + 'px';
			document.body.appendChild(ripple);
			setTimeout(() => ripple.remove(), 500);

			const fiber = getReactFiber(e.target);
			if (!fiber) {
				console.warn("[JumpToCode] React fiber not found on clicked element");
				console.log("[JumpToCode] Element:", e.target);
				console.log("[JumpToCode] Element keys:", Object.keys(e.target).filter(k => k.includes('react')));
				showNotification("⚠️ Not a React component or dev mode disabled", true);
				return;
			}

			console.log("[JumpToCode] Fiber found:", fiber);

			const debugSource = findDebugSource(fiber);
			if (!debugSource) {
				console.warn("[JumpToCode] _debugSource not found in fiber tree");
				console.log("[JumpToCode] Fiber type:", fiber.type);
				console.log("[JumpToCode] Try clicking directly on a component element (button, div with content, etc.)");
				showNotification("⚠️ Debug source not found. Try clicking a different element", true);
				return;
			}

			const file = debugSource.fileName;
			const line = debugSource.lineNumber;

			console.log(`[JumpToCode] Opening ${file}:${line}`);
			showNotification(`Opening ${file.split('/').pop()}:${line}`);

			try {
				const response = await fetch("http://localhost:5123/open", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ file, line })
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("[JumpToCode] Server error:", errorText);
					throw new Error(errorText);
				}

				const result = await response.json();
				console.log("[JumpToCode] Success:", result);
				showNotification("✅ Opened in VS Code!");
			} catch (err) {
				console.error("[JumpToCode] Error details:", {
					message: err.message,
					type: err.name,
					stack: err.stack
				});

				if (err.message && err.message.includes('Failed to fetch')) {
					showNotification("❌ Helper server not running on port 5123", true);
				} else if (err.message) {
					showNotification(`❌ ${err.message}`, true);
				} else {
					showNotification("❌ Failed to open file", true);
				}
			}

			// Auto-disable after successful click
			clickModeEnabled = false;
			document.body.style.cursor = "auto";
		};

		document.addEventListener("click", clickHandler, true);
	}

	function removeClickHandler() {
		if (clickHandler) {
			document.removeEventListener("click", clickHandler, true);
			clickHandler = null;
		}
	}

	function getReactFiber(dom) {
		// First, try the element itself and its parents
		let el = dom;
		let attempts = 0;
		const maxAttempts = 100; // Increased significantly

		console.log('[JumpToCode] Searching for React fiber on:', dom.tagName, dom.className);

		while (el && attempts < maxAttempts) {
			// Check all properties on the element
			for (const key in el) {
				// React 16+
				if (key.startsWith("__reactFiber$")) {
					console.log('[JumpToCode] ✅ Found React Fiber (v16+) at attempt', attempts, ':', key);
					return el[key];
				}
				// React 15
				if (key.startsWith("__reactInternalInstance$")) {
					console.log('[JumpToCode] ✅ Found React Internal Instance (v15) at attempt', attempts, ':', key);
					return el[key];
				}
				// Alternative React property
				if (key.startsWith("__reactProps$")) {
					console.log('[JumpToCode] ✅ Found React Props at attempt', attempts, ':', key);
					const props = el[key];
					// Try to get fiber from props
					if (props && props._owner && props._owner.stateNode) {
						return props._owner;
					}
					return props;
				}
				// React 17+ container
				if (key.startsWith("__reactContainer$")) {
					console.log('[JumpToCode] ✅ Found React Container at attempt', attempts, ':', key);
					const container = el[key];
					// Navigate from container to the actual fiber tree
					if (container && container.current) {
						console.log('[JumpToCode] Navigating from container to fiber tree');
						return container.current;
					}
					return container;
				}
			}

			// Also check children on first iteration (for Chakra/Emotion wrappers)
			if (attempts === 0 && el.children && el.children.length > 0) {
				for (let i = 0; i < el.children.length; i++) {
					const child = el.children[i];
					for (const key in child) {
						if (key.startsWith("__reactFiber$")| key.startsWith("__reactInternalInstance$")) {
							console.log('[JumpToCode] ✅ Found fiber on child element');
							return child[key];
						}
					}
				}
			}

			// Try siblings
			if (attempts < 3) {
				// Try previous sibling
				if (el.previousElementSibling) {
					for (const key in el.previousElementSibling) {
						if (key.startsWith("__reactFiber$")| key.startsWith("__reactInternalInstance$")) {
							console.log('[JumpToCode] ✅ Found fiber on previous sibling');
							return el.previousElementSibling[key];
						}
					}
				}
				// Try next sibling
				if (el.nextElementSibling) {
					for (const key in el.nextElementSibling) {
						if (key.startsWith("__reactFiber$")| key.startsWith("__reactInternalInstance$")) {
							console.log('[JumpToCode] ✅ Found fiber on next sibling');
							return el.nextElementSibling[key];
						}
					}
				}
			}

			el = el.parentNode;
			attempts++;
		}

		console.warn('[JumpToCode] ❌ Could not find React fiber after', attempts, 'attempts');
		console.log('[JumpToCode] Attempting DevTools hook fallback...');

		// Last resort: Use React DevTools hook to find the fiber
		if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
			const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
			if (hook.getFiberRoots) {
				try {
					const roots = hook.getFiberRoots(1);
					if (roots && roots.size > 0) {
						console.log('[JumpToCode] ✅ Found fiber roots via DevTools hook');
						const root = Array.from(roots)[0];
						if (root && root.current) {
							// Try to find the fiber for the clicked element by traversing
							const result = findFiberForElement(root.current, dom);
							if (result) return result;

							// If exact match not found, return root and we'll traverse to find source
							console.log('[JumpToCode] Using root fiber, will traverse for _debugSource');
							return root.current;
						}
					}
				} catch (err) {
					console.error('[JumpToCode] Error accessing DevTools hook:', err);
				}
			}
		} else {
			console.warn('[JumpToCode] DevTools hook not available');
		}

		return null;
	}

	// Helper function to find fiber for a specific DOM element
	function findFiberForElement(fiber, targetElement) {
		if (!fiber) return null;

		// Check if this fiber's DOM node matches our target
		if (fiber.stateNode === targetElement) {
			console.log('[JumpToCode] ✅ Found matching fiber via tree traversal');
			return fiber;
		}

		// Traverse children
		let child = fiber.child;
		while (child) {
			const result = findFiberForElement(child, targetElement);
			if (result) return result;
			child = child.sibling;
		}

		return null;
	}

	function findDebugSource(fiber) {
		if (!fiber) return null;

		let current = fiber;
		let depth = 0;
		const maxDepth = 50; // Increased from 30

		console.log('[JumpToCode] Starting fiber traversal from:', fiber.type?.name| fiber.type| 'unknown');

		while (current && depth < maxDepth) {
			// Check current fiber
			if (current._debugSource) {
				console.log('[JumpToCode] ✅ Found _debugSource at depth', depth);
				console.log('[JumpToCode] File:', current._debugSource.fileName);
				console.log('[JumpToCode] Line:', current._debugSource.lineNumber);
				return current._debugSource;
			}

			// Check debug owner
			if (current._debugOwner) {
				if (current._debugOwner._debugSource) {
					console.log('[JumpToCode] ✅ Found _debugSource in _debugOwner at depth', depth);
					return current._debugOwner._debugSource;
				}
			}

			// For React 18+ - check alternate
			if (current.alternate && current.alternate._debugSource) {
				console.log('[JumpToCode] ✅ Found _debugSource in alternate at depth', depth);
				return current.alternate._debugSource;
			}

			// Check if this is a composite component (class or function)
			if (current.type && typeof current.type === 'function') {
				const componentName = current.type.name| current.type.displayName| 'anonymous';
				console.log(`[JumpToCode] Depth ${depth}: Component "${componentName}"`);
			}

			current = current.return;
			depth++;
		}

		console.warn('[JumpToCode] ❌ No _debugSource found after traversing', depth, 'fibers');
		console.log('[JumpToCode] This might mean:');
		console.log('  - Clicked on a built-in HTML element (not a custom component)');
		console.log('  - Clicked on a node without source mapping');
		console.log('  - Component tree depth exceeds', maxDepth);
		return null;
	}
})();