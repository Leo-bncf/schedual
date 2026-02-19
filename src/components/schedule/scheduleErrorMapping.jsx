/**
 * BASE44 Schedule Generation Error Mapping & Normalization
 * Standardized UI messages for all OPTA failure stages
 */

const FIXED_PRESERVED_LINE = "Planning actuel conservé : aucune modification appliquée.";

const stageUiMap = {
  SOLUTION_INFEASIBLE: {
    toast: "Impossible de générer un planning réalisable",
    title: "Impossible de générer un emploi du temps réalisable",
    message: "Les contraintes obligatoires ne peuvent pas être satisfaites (hard).",
    userAction: "Réduisez la demande (minutes/sem) OU augmentez la capacité (créneaux/ressources), puis relancez.",
    preservedLine: FIXED_PRESERVED_LINE
  },
  PERSISTENCE_FAILED: {
    toast: "Échec d'enregistrement",
    title: "Échec d'enregistrement",
    message: "Le planning a été généré mais n'a pas pu être enregistré.",
    userAction: "Réessayez. Si ça persiste, contactez le support avec le requestId.",
    preservedLine: FIXED_PRESERVED_LINE
  },
  PERSISTENCE_ERROR: {
    toast: "Échec d'enregistrement",
    title: "Échec d'enregistrement",
    message: "Le planning a été généré mais n'a pas pu être enregistré.",
    userAction: "Réessayez. Si ça persiste, contactez le support avec le requestId.",
    preservedLine: FIXED_PRESERVED_LINE
  },
  PERSISTENCE_BLOCKED: {
    toast: "Aucun créneau généré",
    title: "Aucun créneau généré",
    message: "OPTA a terminé, mais aucun créneau n'a pu être inséré.",
    userAction: "Vérifiez les paramètres d'établissement (jours, horaires, durée), les ressources (profs/salles) et relancez.",
    preservedLine: FIXED_PRESERVED_LINE
  },
  buildProblem: {
    toast: "Configuration à corriger",
    title: "Configuration à corriger",
    message: "Certaines données sont manquantes ou incohérentes : la génération a été bloquée avant l'appel OPTA.",
    userAction: "Corrigez les paramètres (horaires, durée, jours, ressources), puis relancez.",
    preservedLine: FIXED_PRESERVED_LINE
  },
  validateScheduleSettings: {
    toast: "Configuration à corriger",
    title: "Configuration à corriger",
    message: "Certaines données sont manquantes ou incohérentes : la génération a été bloquée avant l'appel OPTA.",
    userAction: "Corrigez les paramètres (horaires, durée, jours, ressources), puis relancez.",
    preservedLine: FIXED_PRESERVED_LINE
  },
  SERVER_ERROR: {
    toast: "Échec de génération",
    title: "Échec de génération",
    message: "Une erreur interne est survenue pendant l'optimisation.",
    userAction: "Vérifiez les données d'entrée et relancez. Si le problème persiste, contactez le support avec le requestId.",
    preservedLine: FIXED_PRESERVED_LINE
  },
  AUTHENTICATION: {
    toast: "Authentification requise",
    title: "Authentification requise",
    message: "Clé API absente ou invalide.",
    userAction: "Vérifiez la clé API (header X-API-Key) puis relancez.",
    preservedLine: FIXED_PRESERVED_LINE
  }
};

/**
 * Normalize OPTA error payload to UI-friendly format
 * Applies stageUiMap fallbacks when fields are missing
 */
export function normalizeErrorPayload(payload) {
  const stage = payload.stage || "SERVER_ERROR";
  const code = payload.code || payload.errorCode || "UNKNOWN_ERROR";
  const mapEntry = stageUiMap[stage] || stageUiMap["SERVER_ERROR"];
  
  return {
    stage,
    code,
    toast: payload.toast || mapEntry.toast,
    title: payload.title || mapEntry.title,
    message: payload.message || mapEntry.message,
    userAction: payload.userAction || mapEntry.userAction,
    preservedLine: FIXED_PRESERVED_LINE,
    requestId: payload.requestId || null,
    validationErrors: payload.validationErrors || [],
    details: payload.details || [],
    // Pass through additional fields for specific stages
    constraintBreakdown: payload.constraintBreakdown || null,
    violatingConstraints: payload.violatingConstraints || null,
    meta: payload.meta || {}
  };
}

export { FIXED_PRESERVED_LINE, stageUiMap };