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
    const toggleButton = panel.querySelector('.debug-panel__toggle');
    const content = panel.querySelector('#debug-content');
    const failuresOnlyCheckbox = panel.querySelector('#debug-api-failures-only');
    const searchTypeSelect = panel.querySelector('#debug-search-type-select');
    const copySnapshotButton = panel.querySelector('#debug-copy-snapshot');

    if (toggleButton && content) {
        toggleButton.addEventListener('click', () => {
            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
            const newExpanded = !isExpanded;

            toggleButton.setAttribute('aria-expanded', String(newExpanded));
            content.style.display = newExpanded ? 'block' : 'none';
            toggleButton.textContent = newExpanded ? 'Hide' : 'Show';
            localStorage.setItem('debug-panel-expanded', String(newExpanded));
        });

        const wasExpanded = localStorage.getItem('debug-panel-expanded') !== 'false';
        if (!wasExpanded) {
            content.style.display = 'none';
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.textContent = 'Show';
        }
    }

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

    if (searchTypeSelect) {
        searchTypeSelect.addEventListener('change', () => {
            const nextType = searchTypeSelect.value;
            const url = new URL(window.location.href);
            url.searchParams.set('type', nextType);
            window.location.assign(url.toString());
        });
    }

    if (copySnapshotButton && debugInfo) {
        copySnapshotButton.addEventListener('click', () => {
            const snapshot = JSON.stringify(debugInfo, null, 2);
            navigator.clipboard
                .writeText(snapshot)
                .then(() => {
                    const originalText = copySnapshotButton.textContent;
                    copySnapshotButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copySnapshotButton.textContent = originalText;
                    }, 2000);
                })
                .catch((error) => {
                    console.error('Failed to copy snapshot:', error);
                });
        });
    }
}

initializeDebugPanel();
