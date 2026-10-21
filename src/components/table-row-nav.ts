/** Ignore clicks on interactive controls so row navigation does not steal them. */
export function shouldIgnoreRowClick(target: HTMLElement) {
  return Boolean(
    target.closest(
      "a, button, input, select, textarea, label, [data-row-action], [role='button']",
    ),
  );
}
