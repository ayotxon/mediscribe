/**
 * Définitions des types d'examens médicaux
 * Chaque type contient : métadonnées + prompt Claude pour extraction structurée
 *
 * Le médecin LIT le résultat de l'examen à voix haute.
 * Claude extrait les paramètres pertinents selon le type.
 */

export const EXAM_TYPES = {
  echo_cardiaque: {
    id: 'echo_cardiaque',
    name: 'Échographie Cardiaque',
    shortName: 'Echo Cardio',
    icon: '🫀',
    color: '#ef4444',
    description: 'Doppler cardiaque, mesures des cavités',
    sections: ['Mesures', 'Doppler', 'Commentaires', 'Conclusion'],
    prompt: `Tu es un médecin spécialiste en imagerie cardiaque.
Extrait et structure les données de cette dictée d'échographie cardiaque en JSON strict.

IMPORTANT: N'invente aucune valeur. Si une valeur n'est pas mentionnée, mets null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null, "poids": null, "taille": null, "sc": null },
  "indication": null,
  "echogenicite": null,
  "mesures": {
    "ao_initiale_mm": null,
    "sigmoides_mm": null,
    "og_mm": null,
    "vg_diastole_mm": null,
    "vg_systole_mm": null,
    "masse_g_m2": null,
    "sv_diastole_mm": null,
    "sv_systole_mm": null,
    "pp_diastole_mm": null,
    "pp_systole_mm": null,
    "fr_pct": null,
    "fe": null,
    "e_a_ratio": null,
    "e_eprime": null,
    "vog_ml": null,
    "vtd_ml": null,
    "tapse_mm": null
  },
  "doppler": {
    "mitrale": null,
    "aorte": null,
    "pulmonaire": null,
    "tricuspide": null
  },
  "commentaires": [],
  "conclusion": null
}`
  },

  echo_abdominale: {
    id: 'echo_abdominale',
    name: 'Échographie Abdominale',
    shortName: 'Echo Abdo',
    icon: '🫁',
    color: '#f97316',
    description: 'Foie, vésicule, reins, rate, pancréas',
    sections: ['Organes', 'Observations', 'Conclusion'],
    prompt: `Tu es un médecin spécialiste en échographie abdominale.
Extrait et structure les données de cette dictée en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "organes": {
    "foie": { "taille_mm": null, "echostructure": null, "observations": null },
    "vesicule": { "taille_mm": null, "paroi_mm": null, "lithiase": null, "observations": null },
    "voies_biliaires": { "vbp_mm": null, "observations": null },
    "rate": { "taille_mm": null, "observations": null },
    "pancreas": { "observations": null },
    "rein_droit": { "taille_mm": null, "echostructure": null, "observations": null },
    "rein_gauche": { "taille_mm": null, "echostructure": null, "observations": null },
    "epanchement": null,
    "aorte": { "calibre_mm": null, "observations": null }
  },
  "observations_generales": [],
  "conclusion": null
}`
  },

  echo_obstetricale: {
    id: 'echo_obstetricale',
    name: 'Échographie Obstétricale',
    shortName: 'Echo Obstét.',
    icon: '🤰',
    color: '#ec4899',
    description: 'Grossesse, biométrie fœtale, placenta',
    sections: ['Biométrie', 'Morphologie', 'Annexes', 'Conclusion'],
    prompt: `Tu es un médecin spécialiste en échographie obstétricale.
Extrait et structure les données de cette dictée en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null },
  "indication": null,
  "grossesse": {
    "terme_sa": null,
    "gestite": null,
    "parite": null,
    "nombre_foetus": null,
    "presentation": null
  },
  "biometrie": {
    "bip_mm": null,
    "dfo_mm": null,
    "pc_mm": null,
    "pa_mm": null,
    "lf_mm": null,
    "poids_estime_g": null,
    "age_gestationnel_bio_sa": null
  },
  "morphologie": {
    "crane": null,
    "face": null,
    "colonne": null,
    "thorax": null,
    "coeur": null,
    "abdomen": null,
    "membres": null,
    "sexe": null
  },
  "annexes": {
    "placenta": { "localisation": null, "aspect": null },
    "liquide_amniotique": null,
    "cordon": null,
    "col_mm": null
  },
  "vitalite": { "rythme_cardiaque_bpm": null, "mouvements": null },
  "conclusion": null
}`
  },

  radiologie: {
    id: 'radiologie',
    name: 'Radiologie',
    shortName: 'Radio',
    icon: '🔬',
    color: '#6366f1',
    description: 'Radio pulmonaire, osseuse, abdominale',
    sections: ['Technique', 'Analyse', 'Conclusion'],
    prompt: `Tu es un radiologue.
Extrait et structure les données de cette dictée radiologique en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "type_incidence": null,
  "qualite_technique": null,
  "analyse": {
    "poumons": null,
    "pleutre": null,
    "mediastin": null,
    "coeur": { "index_cardiothoracique": null, "observations": null },
    "diaphragme": null,
    "parenchyme": null,
    "osseux": null,
    "parties_molles": null,
    "autres": null
  },
  "anomalies": [],
  "conclusion": null
}`
  },

  scanner: {
    id: 'scanner',
    name: 'Scanner / TDM',
    shortName: 'Scanner',
    icon: '💿',
    color: '#0ea5e9',
    description: 'Tomodensitométrie, coupes axiales',
    sections: ['Technique', 'Résultats', 'Conclusion'],
    prompt: `Tu es un radiologue spécialisé en TDM.
Extrait et structure les données de cette dictée scanner en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "region_exploree": null,
  "technique": { "injection": null, "coupes_mm": null, "reconstructions": null },
  "resultats": {
    "parenchyme": [],
    "vaisseaux": [],
    "ganglions": [],
    "structures_osseuses": [],
    "autres_structures": []
  },
  "mesures": [],
  "anomalies": [],
  "conclusion": null
}`
  },

  irm: {
    id: 'irm',
    name: 'IRM',
    shortName: 'IRM',
    icon: '🧲',
    color: '#8b5cf6',
    description: 'Imagerie par résonance magnétique',
    sections: ['Technique', 'Résultats', 'Conclusion'],
    prompt: `Tu es un radiologue spécialisé en IRM.
Extrait et structure les données de cette dictée IRM en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "region_exploree": null,
  "sequences": [],
  "technique": { "injection_gadolinium": null, "observations_technique": null },
  "resultats": {
    "signal_normal": [],
    "anomalies_signal": [],
    "structures_observees": [],
    "mesures": []
  },
  "anomalies": [],
  "conclusion": null
}`
  },

  biologie: {
    id: 'biologie',
    name: 'Bilan Biologique',
    shortName: 'Biologie',
    icon: '🧪',
    color: '#10b981',
    description: 'NFS, bilan métabolique, sérologies',
    sections: ['Hématologie', 'Biochimie', 'Autres', 'Interprétation'],
    prompt: `Tu es un biologiste médical.
Extrait et structure les données de ce bilan biologique en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "date_prelevement": null,
  "hematologie": {
    "gb_g_l": null, "gr_t_l": null, "hb_g_dl": null,
    "hte_pct": null, "vgm_fl": null, "ccmh_pct": null,
    "plaquettes_g_l": null, "formule": null
  },
  "biochimie": {
    "glycemie_g_l": null, "hba1c_pct": null,
    "creatinine_mg_l": null, "uree_g_l": null, "clairance_ml_min": null,
    "sodium_meq_l": null, "potassium_meq_l": null, "chlore_meq_l": null,
    "proteines_g_l": null, "albumine_g_l": null,
    "cholesterol_g_l": null, "hdl_g_l": null, "ldl_g_l": null, "tg_g_l": null,
    "got_ui_l": null, "gpt_ui_l": null, "ggt_ui_l": null, "pal_ui_l": null,
    "bilirubine_totale_mg_l": null, "bilirubine_directe_mg_l": null,
    "crp_mg_l": null, "vs_mm_h": null,
    "ferritine_ng_ml": null, "tsa_mUI_ml": null
  },
  "serologies": {},
  "autres": {},
  "valeurs_anormales": [],
  "interpretation": null
}`
  },

  eeg: {
    id: 'eeg',
    name: 'EEG',
    shortName: 'EEG',
    icon: '🧠',
    color: '#f59e0b',
    description: 'Électroencéphalogramme',
    sections: ['Tracé', 'Anomalies', 'Conclusion'],
    prompt: `Tu es un neurologue spécialisé en EEG.
Extrait et structure les données de cette dictée EEG en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "conditions_enregistrement": { "duree_min": null, "etat_vigilance": null, "manoeuvres": [] },
  "activite_de_fond": { "frequence_hz": null, "amplitude_uv": null, "rythme": null, "symetrie": null },
  "anomalies": { "type": null, "localisation": null, "caracteristiques": null },
  "organisation": null,
  "reactivite": null,
  "conclusion": null
}`
  },

  autre: {
    id: 'autre',
    name: 'Autre Examen',
    shortName: 'Autre',
    icon: '📋',
    color: '#64748b',
    description: 'EMG, endoscopie, anatomopathologie...',
    sections: ['Résultats', 'Conclusion'],
    prompt: `Tu es un médecin spécialiste.
Extrait et structure les données de cette dictée médicale en JSON strict.

N'invente aucune valeur. Si non mentionnée: null.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "type_examen": null,
  "indication": null,
  "technique": null,
  "resultats": [],
  "mesures": [],
  "anomalies": [],
  "commentaires": [],
  "conclusion": null
}`
  }
}

export const EXAM_TYPE_LIST = Object.values(EXAM_TYPES)

export function getExamType(id) {
  return EXAM_TYPES[id] || EXAM_TYPES.autre
}
