/**
 * S5 guardrails — batch limits for claim-file takeoff runs.
 * Prevents accidental full-file pipeline overload; aligned with SM list patterns.
 */

/** Max SM elements processed in a single createRun (all elements or subset). */
export const TAKEOFF_MAX_MEASURES_PER_RUN = 200;

/** Soft warning threshold for performance monitoring in tests. */
export const TAKEOFF_PERFORMANCE_WARN_MS = 5_000;
