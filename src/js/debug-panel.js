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

function initializeDebugPanel() {
    const panel = document.querySelector('.debug-panel');
    if (!panel) {
        return;
    }

    const debugInfo = parseDebugInfoFromDom();
    const triggerButton = document.getElementById('debug-panel-toggle');
    const internalToggle = panel.querySelector('.debug-panel__toggle');
    const failuresOnlyCheckbox = panel.querySelector('#debug-api-failures-only');
    const copySnapshotButton = panel.querySelector('#debug-copy-snapshot');
    const copyStatus = panel.querySelector('#debug-copy-status');

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

    if (failuresOnlyCheckbox) {
        const apiCallRows = panel.querySelectorAll('.debug-panel__api-call');

        const applyApiFilter = () => {
            const failuresOnly = failuresOnlyCheckbox.checked;
            apiCallRows.forEach((row) => {
                const failed = row.getAttribute('data-failed') === 'true';
                row.classList.toggle('debug-panel__api-call--hidden', failuresOnly && !failed);
            });
        };

        failuresOnlyCheckbox.addEventListener('change', applyApiFilter);
        applyApiFilter();
    }

    const searchTypeRadios = panel.querySelectorAll('input[name="debug-search-type"]');
    if (searchTypeRadios.length > 0) {
        searchTypeRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    const nextType = radio.value;
                    const url = new URL(window.location.href);
                    url.searchParams.set('type', nextType);
                    window.location.assign(url.toString());
                }
            });
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
