export const TIER_LIMITS = {
  tier1: {
    id: 'tier1',
    name: 'Starter',
    subtitle: 'Starter',
    description: 'Up to 200 students · 3 saved schedule versions · 1 admin account',
    price: 599,
    priceLabel: '€599/year',
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
    id: 'tier2',
    name: 'Standard',
    subtitle: 'Standard',
    description: 'Up to 600 students · Unlimited generations · 3 admin accounts',
    price: 1499,
    priceLabel: '€1,499/year',
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
    id: 'tier3',
    name: 'Pro',
    subtitle: 'Pro',
    description: 'Up to 1,200 students · Unlimited generations · Unlimited admin accounts',
    price: 2999,
    priceLabel: '€2,999/year',
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