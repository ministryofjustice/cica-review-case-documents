import { initAll } from '/node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js';
import './debug-panel.js';

initAll();

document.addEventListener('click', (event) => {
    let targetElement = null;
    if (event.target instanceof Element) {
        targetElement = event.target;
    } else if (event.target instanceof Node) {
        targetElement = event.target.parentElement;
    }

    if (
        // Ignore clicks that aren't left-clicks or that have modifier keys, or where the target can't be resolved to an Element
        !targetElement ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    ) {
        return;
    }

    const backLink = targetElement.closest('[data-module="govuk-back-link"]');
    if (backLink) {
        event.preventDefault();
        window.history.back();
    }
});
