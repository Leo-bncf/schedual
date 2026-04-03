export const TIER_LIMITS = {
  tier1: {
    name: 'Starter',
    price: 599,
    studentLimit: 200,
    generationLimit: 3,
    savedVersionsLimit: 3,
    adminSeats: 1,
    support: 'Email support (48h)',
    exportPdf: true,
    exportExcel: true,
    manualAdjustments: true,
    onboardingCallIncluded: false,
  },
  tier2: {
    name: 'Standard',
    price: 1499,
    studentLimit: 600,
    generationLimit: null,
    savedVersionsLimit: null,
    adminSeats: 3,
    support: 'Email support (24h)',
    exportPdf: true,
    exportExcel: true,
    manualAdjustments: true,
    onboardingCallIncluded: false,
  },
  tier3: {
    name: 'Pro',
    price: 2999,
    studentLimit: 1200,
    generationLimit: null,
    savedVersionsLimit: null,
    adminSeats: null,
    support: 'Priority support (same day)',
    exportPdf: true,
    exportExcel: true,
    manualAdjustments: true,
    onboardingCallIncluded: true,
  },
};

export function getTierLimits(tierId) {
  return TIER_LIMITS[tierId] || null;
}

export function getSavedVersionsLimit(tierId) {
  return getTierLimits(tierId)?.savedVersionsLimit ?? 3;
}

export function getGenerationLimit(tierId) {
  return getTierLimits(tierId)?.generationLimit ?? 3;
}

export function getAdminSeatLimit(tierId, fallback = 3) {
  const limit = getTierLimits(tierId)?.adminSeats;
  return limit === null ? null : (limit ?? fallback);
}

export function getStudentLimit(tierId) {
  return getTierLimits(tierId)?.studentLimit ?? 200;
}