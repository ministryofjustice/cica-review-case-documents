import { initAll } from '/node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js';
initAll();
document.addEventListener('click', event => {
  const targetElement = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
  if (
  // Ignore clicks that aren't left-clicks or that have modifier keys, or where the target can't be resolved to an Element
  !targetElement || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const backLink = targetElement.closest('[data-module="govuk-back-link"]');
  if (backLink) {
    event.preventDefault();
    window.history.back();
  }
});
