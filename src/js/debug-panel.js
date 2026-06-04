/**
 * Reads and parses debug payload JSON embedded in the page.
 *
 * @returns {Record<string, unknown> | null} Parsed debug info object, or null when unavailable/invalid.
 */
function parseDebugInfoFromDom() {
    const debugInfoElement = document.getElementById('debug-panel-data');
    if (!debugInfoElement) {
        return null;
    }

    try {
        return JSON.parse(debugInfoElement.textContent || '{}');
    } catch (error) {
        console.error('Failed to parse debug panel data:', error);
        return null;
    }
}

/**
 * Wires up all client-side debug panel interactions.
 *
 * @returns {void}
 */
function initializeDebugPanel() {
    const panel = document.querySelector('.debug-panel');
    if (!panel) {
        return;
    }

    const debugInfo = parseDebugInfoFromDom();
    const triggerButton = document.getElementById('debug-panel-toggle');
    const internalToggle = panel.querySelector('.debug-panel__toggle');
    const alignRadios = panel.querySelectorAll('input[name="debug-flag-align"]');
    const debugRadios = panel.querySelectorAll('input[name="debug-flag-debug"]');
    const typeSelect = panel.querySelector('#debug-feature-type-select');
    const copySnapshotButton = panel.querySelector('#debug-copy-snapshot');
    const copyStatus = panel.querySelector('#debug-copy-status');

    /**
     * Shows or hides the panel and synchronizes persisted/ARIA state.
     *
     * @param {boolean} show - True to show the panel, false to hide it.
     * @returns {void}
     */
    const togglePanel = (show) => {
        if (show) {
            panel.classList.add('debug-panel--visible');
        } else {
            panel.classList.remove('debug-panel--visible');
        }

        if (triggerButton) {
            triggerButton.setAttribute('aria-expanded', String(show));
        }
        if (internalToggle) {
            internalToggle.setAttribute('aria-expanded', String(show));
            internalToggle.textContent = show ? 'Hide' : 'Show';
        }

        localStorage.setItem('debug-panel-visible', String(show));
    };

    // External trigger button (floating button)
    if (triggerButton) {
        triggerButton.addEventListener('click', () => {
            const isVisible = panel.classList.contains('debug-panel--visible');
            togglePanel(!isVisible);
        });
    }

    // Internal toggle button (in panel header)
    if (internalToggle) {
        internalToggle.addEventListener('click', () => {
            const isVisible = panel.classList.contains('debug-panel--visible');
            togglePanel(!isVisible);
        });
    }

    // Restore previous state
    const wasVisible = localStorage.getItem('debug-panel-visible') === 'true';
    togglePanel(wasVisible);

    /**
     * Applies a feature-flag change via query params while preserving existing URL state.
     *
     * @param {'align' | 'debug' | 'type'} flagName - Feature flag query key.
     * @param {string} value - Query value to apply.
     * @param {boolean} [resetPage=false] - Whether to reset pagination to first page.
     * @returns {void}
     */
    const applyFeatureFlag = (flagName, value, resetPage = false) => {
        const url = new URL(window.location.href);
        url.searchParams.set(flagName, value);

        if (resetPage) {
            url.searchParams.set('pageNumber', '1');
        }

        window.location.assign(url.toString());
    };

    if (alignRadios.length > 0) {
        alignRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    applyFeatureFlag('align', radio.value);
                }
            });
        });
    }

    if (debugRadios.length > 0) {
        debugRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    applyFeatureFlag('debug', radio.value);
                }
            });
        });
    }

    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            applyFeatureFlag('type', typeSelect.value, true);
        });
    }

    if (copySnapshotButton && debugInfo) {
        copySnapshotButton.addEventListener('click', () => {
            const snapshot = JSON.stringify(debugInfo, null, 2);
            const originalText = copySnapshotButton.textContent;
            copySnapshotButton.disabled = true;
            copySnapshotButton.textContent = 'Copying...';

            const copyToClipboard =
                navigator.clipboard?.writeText(snapshot) ||
                Promise.reject(new Error('Clipboard API unavailable'));

            copyToClipboard
                .then(() => {
                    copySnapshotButton.textContent = 'Copied';
                    if (copyStatus) {
                        copyStatus.textContent = 'Snapshot copied to clipboard';
                    }
                })
                .catch((error) => {
                    console.error('Failed to copy snapshot:', error);
                    copySnapshotButton.textContent = 'Copy failed';
                    if (copyStatus) {
                        copyStatus.textContent = 'Copy failed. Please try again.';
                    }
                })
                .finally(() => {
                    setTimeout(() => {
                        copySnapshotButton.disabled = false;
                        copySnapshotButton.textContent = originalText;
                        if (copyStatus) {
                            copyStatus.textContent = '';
                        }
                    }, 1500);
                });
        });
    }
}

initializeDebugPanel();
