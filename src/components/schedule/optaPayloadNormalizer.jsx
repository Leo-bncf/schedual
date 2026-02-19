/**
 * Normalize OptaPlanner response payload for safe UI handling.
 * 
 * Ensures critical fields are always arrays (never null), handles field name variations,
 * and extracts hardScore from nested locations. Called immediately after res?.data.
 * 
 * @param {Object} raw - Raw response payload from OptaPlanner
 * @returns {Object} Normalized payload safe for UI display
 */
export function normalizeOptaPayload(raw) {
  const p = raw || {};

  // Start with a copy to avoid mutations
  const normalized = { ...p };

  // ========================================
  // CRITICAL: Array fields must never be null
  // ========================================
  normalized.details = Array.isArray(p.details) ? p.details : [];
  normalized.violatingConstraints = Array.isArray(p.violatingConstraints) ? p.violatingConstraints : [];
  normalized.constraintBreakdown = Array.isArray(p.constraintBreakdown) ? p.constraintBreakdown : [];
  normalized.validationErrors = Array.isArray(p.validationErrors) ? p.validationErrors : [];

  // ========================================
  // Field name compatibility (code variations)
  // ========================================
  normalized.code = p.code || p.errorCode || p.error_code || null;
  normalized.errorCode = p.errorCode || p.code || null;

  // ========================================
  // Extract hardScore (may be in root or nested in meta)
  // ========================================
  normalized.hardScore =
    (typeof p.hardScore === "number" ? p.hardScore :
    (typeof p.meta?.hardScore === "number" ? p.meta.hardScore : null));

  // ========================================
  // Ensure boolean ok field for guard assertions
  // ========================================
  if (typeof normalized.ok !== "boolean") {
    // If ok is missing or not boolean, default to false (safer)
    normalized.ok = false;
  }

  // ========================================
  // Preserve request tracking
  // ========================================
  normalized.requestId = p.requestId || p.meta?.requestId || null;

  return normalized;
}

/**
 * Detect if payload is an infeasible solution with no constraint details.
 * 
 * This occurs when OPTA returns hardScore < 0 but does not provide
 * constraintBreakdown (empty arrays). In this case, display generic
 * fallback message to user - do NOT use violatingConstraints array
 * (it contains only technical placeholders like "HARD_CONSTRAINTS_VIOLATED_UNEXPLAINED").
 * 
 * @param {Object} payload - Normalized payload from normalizeOptaPayload()
 * @returns {boolean} True if this is infeasible without constraint details
 */
export function isInfeasibleFallback(payload) {
  const isInfeasible = payload.ok === false && payload.stage === "SOLUTION_INFEASIBLE";
  
  if (!isInfeasible) return false;
  
  const hasNegativeHardScore = typeof payload.hardScore === "number" && payload.hardScore < 0;
  const noConstraintDetails = payload.constraintBreakdown.length === 0;
  
  // Both conditions must be true: infeasible + no breakdown
  return hasNegativeHardScore && noConstraintDetails;
}

/**
 * Usage pattern in components:
 * 
 * const raw = res?.data || {};
 * 
 * // Guard: verify ok is boolean
 * if (typeof raw.ok !== "boolean") {
 *   return handleCriticalError({ stage: 'PARSE', code: 'INVALID_RESPONSE_STRUCTURE' });
 * }
 * 
 * // Normalize
 * const payload = normalizeOptaPayload(raw);
 * 
 * // Detect fallback mode (no constraint details available)
 * if (isInfeasibleFallback(payload)) {
 *   // Display generic "no details available" message
 *   // Do NOT display violatingConstraints - it's technical only
 * }
 * 
 * // Safe to use now - arrays always defined, fields normalized
 * setOptaPlannerResultSafe(payload);
 */