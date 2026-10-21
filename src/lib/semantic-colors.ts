/**
 * Centralized semantic color utilities for the SS-Metals ERP.
 * These map to CSS custom properties defined in globals.css.
 */

export type SemanticTone = "success" | "warning" | "danger" | "info" | "neutral";

export const semanticColors = {
  success: {
    bg: "bg-success-soft",
    text: "text-success",
    border: "border-success-border",
  },
  warning: {
    bg: "bg-warning-soft",
    text: "text-warning",
    border: "border-warning-border",
  },
  danger: {
    bg: "bg-danger-soft",
    text: "text-danger",
    border: "border-danger-border",
  },
  info: {
    bg: "bg-info-soft",
    text: "text-info",
    border: "border-info-border",
  },
  neutral: {
    bg: "bg-neutral-soft",
    text: "text-neutral",
    border: "border-neutral-border",
  },
} as const;

/**
 * Get semantic color classes for a given tone.
 * Returns an object with bg, text, and optional border classes.
 */
export function getSemanticClasses(tone: SemanticTone, includeBorder = false) {
  const colors = semanticColors[tone];
  if (includeBorder) {
    return {
      bg: colors.bg,
      text: colors.text,
      border: colors.border,
    };
  }
  return {
    bg: colors.bg,
    text: colors.text,
  };
}

/**
 * Get icon container classes for KPI cards and similar components.
 * These provide a colored background with matching icon color.
 */
export function getIconContainerClass(tone: SemanticTone): string {
  return `${semanticColors[tone].bg} ${semanticColors[tone].text}`;
}

/**
 * Get alert/message box classes for form feedback and notifications.
 */
export function getAlertClass(tone: SemanticTone): string {
  return `rounded-[10px] ${semanticColors[tone].bg} px-3 py-2 text-sm ${semanticColors[tone].text}`;
}
