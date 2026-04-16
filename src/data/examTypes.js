/**
 * Définitions des types d'examens médicaux.
 * Chaque type contient :
 *   - métadonnées (id, name, icon, color…)
 *   - prompt Claude pour structuration (envoyé au backend)
 *   - layout : liste de sections qui pilote le rendu du rapport
 *
 * Types de sections disponibles :
 *   measurements_table  – tableau 4 colonnes (param:valeur | norme) × 2
 *   section_list        – section numérotée, tableau → tirets
 *   section_dict        – section numérotée, objet → "Label : valeur"
 *   section_conclusion  – section numérotée, tableau/string → bullets italiques gras
 *   section_text        – section numérotée, string → paragraphe
 *   section_biology     – section numérotée, liste de params avec normes entre parenthèses
 */

export const EXAM_TYPES = {
  // ─────────────────────────────────────────────────────────────────────────────
  echo_cardiaque: {
    id: 'echo_cardiaque',
    name: 'Échographie Doppler Cardiaque',
    shortName: 'Echo Cardio',
    icon: '🫀',
    color: '#ef4444',
    description: 'Doppler cardiaque, mesures des cavités',
    showEchogenicite: true,

    layout: [
      {
        type: 'measurements_table',
        dataKey: 'mesures',
        rows: [
          [
            { key: 'ao_initiale_mm',  label: 'AO Initiale',   normal: '(20-37 mm)' },
            { key: 'sv_diastole_mm',  label: 'SIV Diastole',  normal: '(6-11 mm)'  }
          ],
          [
            { key: 'sigmoides_mm',    label: 'Sigmoïdes',     normal: '(15-26 mm)' },
            { key: 'sv_systole_mm',   label: 'SIV Systole',   normal: '(9-15 mm)'  }
          ],
          [
            { key: 'og_mm',           label: 'OG Systole',    normal: '(19-40 mm)' },
            { key: 'pp_diastole_mm',  label: 'PP  Diastole',  normal: '(6-11 mm)'  }
          ],
          [
            { key: 'vg_diastole_mm',  label: 'VG Diastole',  normal: '(36-56 mm)' },
            { key: 'pp_systole_mm',   label: 'PP  Systole',   normal: '(12-18 mm)' }
          ],
          [
            { key: 'vg_systole_mm',   label: 'VG Systole',   normal: '(25-37 mm)' },
            { key: 'vd_diastole_mm',  label: 'VD  Diastole', normal: '(< 35 mm)'  }
          ],
          [
            { key: 'masse_g_m2',      label: 'Masse',         normal: '95 g/m² F\n115 g/m² M' },
            {
              composite: true,
              label: 'Autres',
              normal: null,
              items: [
                { key: 'hr_ratio',   prefix: 'h/r = '   },
                { key: 'e_a_ratio',  prefix: '   E/A = ' },
                { key: 'e_eprime',   prefix: "   E/E' = "}
              ]
            }
          ],
          [
            { key: 'fr_pct',          label: 'FR',            normal: '(28-42 %)' },
            {
              composite: true,
              label: null,
              normal: null,
              items: [
                { key: 'vog_ml', prefix: 'VOG = ', suffix: ' ml' },
                { key: 'vtd_ml', prefix: '   VOD = ', suffix: ' ml' }
              ]
            }
          ],
          [
            { key: 'fe',              label: 'FE',            normal: '0,60-0,80' },
            { key: 'tapse_mm',        label: 'TAPSE',         normal: null        }
          ]
        ]
      },
      {
        type: 'section_list',
        dataKey: 'commentaires',
        label: 'COMMENTAIRES',
        subtitle: 'BD-TM-Péricarde, Cavités, Valves, Parois, Cinétique'
      },
      {
        type: 'section_dict',
        dataKey: 'doppler',
        label: 'DOPPLER'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un médecin spécialiste en imagerie cardiaque. Tu structures une dictée d'échographie.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

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
    "hr_ratio": null,
    "sv_diastole_mm": null,
    "sv_systole_mm": null,
    "pp_diastole_mm": null,
    "pp_systole_mm": null,
    "vd_diastole_mm": null,
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
  "conclusion": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  echo_abdominale: {
    id: 'echo_abdominale',
    name: 'Échographie Abdominale',
    shortName: 'Echo Abdo',
    icon: '🫁',
    color: '#f97316',
    description: 'Foie, vésicule, reins, rate, pancréas',
    showEchogenicite: true,

    layout: [
      {
        type: 'section_dict',
        dataKey: 'organes',
        label: 'RÉSULTATS',
        nested: true
      },
      {
        type: 'section_list',
        dataKey: 'observations_generales',
        label: 'OBSERVATIONS GÉNÉRALES'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un médecin spécialiste en échographie abdominale. Tu structures une dictée.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "echogenicite": null,
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
  "conclusion": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  echo_obstetricale: {
    id: 'echo_obstetricale',
    name: 'Échographie Obstétricale',
    shortName: 'Echo Obstét.',
    icon: '🤰',
    color: '#ec4899',
    description: 'Grossesse, biométrie fœtale, placenta',
    showEchogenicite: false,

    layout: [
      {
        type: 'section_dict',
        dataKey: 'grossesse',
        label: 'GROSSESSE'
      },
      {
        type: 'measurements_table',
        dataKey: 'biometrie',
        rows: [
          [
            { key: 'bip_mm',                  label: 'BIP',           normal: null },
            { key: 'lf_mm',                   label: 'LF',            normal: null }
          ],
          [
            { key: 'dfo_mm',                  label: 'DFO',           normal: null },
            { key: 'poids_estime_g',          label: 'Poids estimé',  normal: null }
          ],
          [
            { key: 'pc_mm',                   label: 'PC',            normal: null },
            { key: 'age_gestationnel_bio_sa',  label: 'AG biométrique', normal: null }
          ],
          [
            { key: 'pa_mm',                   label: 'PA',            normal: null },
            { key: 'rythme_cardiaque_bpm',    label: 'Rythme cardiaque', normal: null }
          ]
        ]
      },
      {
        type: 'section_dict',
        dataKey: 'morphologie',
        label: 'MORPHOLOGIE'
      },
      {
        type: 'section_dict',
        dataKey: 'annexes',
        label: 'ANNEXES'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un médecin spécialiste en échographie obstétricale. Tu structures une dictée.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null },
  "indication": null,
  "grossesse": {
    "terme_sa": null, "gestite": null, "parite": null,
    "nombre_foetus": null, "presentation": null
  },
  "biometrie": {
    "bip_mm": null, "dfo_mm": null, "pc_mm": null, "pa_mm": null, "lf_mm": null,
    "poids_estime_g": null, "age_gestationnel_bio_sa": null
  },
  "morphologie": {
    "crane": null, "face": null, "colonne": null, "thorax": null,
    "coeur": null, "abdomen": null, "membres": null, "sexe": null
  },
  "annexes": {
    "placenta": { "localisation": null, "aspect": null },
    "liquide_amniotique": null,
    "cordon": null,
    "col_mm": null
  },
  "vitalite": { "rythme_cardiaque_bpm": null, "mouvements": null },
  "conclusion": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  radiologie: {
    id: 'radiologie',
    name: 'Radiologie',
    shortName: 'Radio',
    icon: '🔬',
    color: '#6366f1',
    description: 'Radio pulmonaire, osseuse, abdominale',
    showEchogenicite: false,

    layout: [
      {
        type: 'section_text',
        dataKey: 'qualite_technique',
        label: 'TECHNIQUE'
      },
      {
        type: 'section_text',
        dataKey: 'type_incidence',
        label: 'INCIDENCE'
      },
      {
        type: 'section_dict',
        dataKey: 'analyse',
        label: 'ANALYSE'
      },
      {
        type: 'section_list',
        dataKey: 'anomalies',
        label: 'ANOMALIES'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un radiologue. Tu structures une dictée radiologique.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "type_incidence": null,
  "qualite_technique": null,
  "analyse": {
    "poumons": null, "plevre": null, "mediastin": null,
    "coeur": { "index_cardiothoracique": null, "observations": null },
    "diaphragme": null, "parenchyme": null, "osseux": null,
    "parties_molles": null, "autres": null
  },
  "anomalies": [],
  "conclusion": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  scanner: {
    id: 'scanner',
    name: 'Scanner / TDM',
    shortName: 'Scanner',
    icon: '💿',
    color: '#0ea5e9',
    description: 'Tomodensitométrie, coupes axiales',
    showEchogenicite: false,

    layout: [
      {
        type: 'section_dict',
        dataKey: 'technique',
        label: 'TECHNIQUE'
      },
      {
        type: 'section_text',
        dataKey: 'region_exploree',
        label: 'RÉGION EXPLORÉE'
      },
      {
        type: 'section_dict',
        dataKey: 'resultats',
        label: 'RÉSULTATS'
      },
      {
        type: 'section_list',
        dataKey: 'anomalies',
        label: 'ANOMALIES'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un radiologue spécialisé en TDM. Tu structures une dictée scanner.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "region_exploree": null,
  "technique": { "injection": null, "coupes_mm": null, "reconstructions": null },
  "resultats": {
    "parenchyme": [], "vaisseaux": [], "ganglions": [],
    "structures_osseuses": [], "autres_structures": []
  },
  "anomalies": [],
  "conclusion": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  irm: {
    id: 'irm',
    name: 'IRM',
    shortName: 'IRM',
    icon: '🧲',
    color: '#8b5cf6',
    description: 'Imagerie par résonance magnétique',
    showEchogenicite: false,

    layout: [
      {
        type: 'section_dict',
        dataKey: 'technique',
        label: 'TECHNIQUE'
      },
      {
        type: 'section_text',
        dataKey: 'region_exploree',
        label: 'RÉGION EXPLORÉE'
      },
      {
        type: 'section_list',
        dataKey: 'sequences',
        label: 'SÉQUENCES'
      },
      {
        type: 'section_dict',
        dataKey: 'resultats',
        label: 'RÉSULTATS'
      },
      {
        type: 'section_list',
        dataKey: 'anomalies',
        label: 'ANOMALIES'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un radiologue spécialisé en IRM. Tu structures une dictée IRM.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "region_exploree": null,
  "sequences": [],
  "technique": { "injection_gadolinium": null, "observations_technique": null },
  "resultats": {
    "signal_normal": [], "anomalies_signal": [],
    "structures_observees": [], "mesures": []
  },
  "anomalies": [],
  "conclusion": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  biologie: {
    id: 'biologie',
    name: 'Bilan Biologique',
    shortName: 'Biologie',
    icon: '🧪',
    color: '#10b981',
    description: 'NFS, bilan métabolique, sérologies',
    showEchogenicite: false,

    layout: [
      {
        type: 'section_biology',
        dataKey: 'hematologie',
        label: 'HÉMATOLOGIE',
        rows: [
          { key: 'gb_g_l',        label: 'GB',         normal: '4-10 g/L'    },
          { key: 'gr_t_l',        label: 'GR',         normal: '4,5-5,5 T/L' },
          { key: 'hb_g_dl',       label: 'Hb',         normal: '12-16 g/dL'  },
          { key: 'hte_pct',       label: 'Hte',        normal: '36-48 %'     },
          { key: 'vgm_fl',        label: 'VGM',        normal: '80-100 fL'   },
          { key: 'ccmh_pct',      label: 'CCMH',       normal: '31-36 %'     },
          { key: 'plaquettes_g_l',label: 'Plaquettes', normal: '150-400 g/L' },
          { key: 'formule',       label: 'Formule',    normal: null           }
        ]
      },
      {
        type: 'section_biology',
        dataKey: 'biochimie',
        label: 'BIOCHIMIE',
        rows: [
          { key: 'glycemie_g_l',          label: 'Glycémie',       normal: '0,70-1,10 g/L'  },
          { key: 'hba1c_pct',             label: 'HbA1c',          normal: '< 6,5 %'        },
          { key: 'creatinine_mg_l',       label: 'Créatinine',     normal: '6-13 mg/L'      },
          { key: 'uree_g_l',              label: 'Urée',           normal: '0,15-0,45 g/L'  },
          { key: 'clairance_ml_min',      label: 'Clairance',      normal: '> 60 mL/min'    },
          { key: 'sodium_meq_l',          label: 'Sodium',         normal: '136-145 mEq/L'  },
          { key: 'potassium_meq_l',       label: 'Potassium',      normal: '3,5-5,0 mEq/L'  },
          { key: 'cholesterol_g_l',       label: 'Cholestérol',    normal: '< 2,0 g/L'      },
          { key: 'ldl_g_l',               label: 'LDL',            normal: '< 1,60 g/L'     },
          { key: 'hdl_g_l',               label: 'HDL',            normal: '> 0,40 g/L'     },
          { key: 'tg_g_l',                label: 'TG',             normal: '< 1,50 g/L'     },
          { key: 'got_ui_l',              label: 'GOT (ASAT)',     normal: '< 40 UI/L'      },
          { key: 'gpt_ui_l',              label: 'GPT (ALAT)',     normal: '< 41 UI/L'      },
          { key: 'ggt_ui_l',              label: 'GGT',            normal: '< 55 UI/L'      },
          { key: 'pal_ui_l',              label: 'PAL',            normal: '40-130 UI/L'    },
          { key: 'crp_mg_l',              label: 'CRP',            normal: '< 6 mg/L'       },
          { key: 'tsa_mUI_ml',            label: 'TSH',            normal: '0,27-4,2 mUI/mL'}
        ]
      },
      {
        type: 'section_dict',
        dataKey: 'serologies',
        label: 'SÉROLOGIES'
      },
      {
        type: 'section_list',
        dataKey: 'valeurs_anormales',
        label: 'VALEURS ANORMALES'
      },
      {
        type: 'section_conclusion',
        dataKey: 'interpretation',
        label: 'INTERPRÉTATION'
      }
    ],

    prompt: `Tu es un biologiste médical. Tu structures une dictée de bilan biologique.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

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
  "interpretation": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  eeg: {
    id: 'eeg',
    name: 'EEG',
    shortName: 'EEG',
    icon: '🧠',
    color: '#f59e0b',
    description: 'Électroencéphalogramme',
    showEchogenicite: false,

    layout: [
      {
        type: 'section_dict',
        dataKey: 'conditions_enregistrement',
        label: 'CONDITIONS D\'ENREGISTREMENT'
      },
      {
        type: 'section_dict',
        dataKey: 'activite_de_fond',
        label: 'ACTIVITÉ DE FOND'
      },
      {
        type: 'section_dict',
        dataKey: 'anomalies',
        label: 'ANOMALIES'
      },
      {
        type: 'section_text',
        dataKey: 'organisation',
        label: 'ORGANISATION'
      },
      {
        type: 'section_text',
        dataKey: 'reactivite',
        label: 'RÉACTIVITÉ'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un neurologue spécialisé en EEG. Tu structures une dictée EEG.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

Retourne UNIQUEMENT ce JSON:
{
  "patient": { "nom": null, "age": null, "sexe": null },
  "indication": null,
  "conditions_enregistrement": { "duree_min": null, "etat_vigilance": null, "manoeuvres": [] },
  "activite_de_fond": { "frequence_hz": null, "amplitude_uv": null, "rythme": null, "symetrie": null },
  "anomalies": { "type": null, "localisation": null, "caracteristiques": null },
  "organisation": null,
  "reactivite": null,
  "conclusion": []
}`
  },

  // ─────────────────────────────────────────────────────────────────────────────
  autre: {
    id: 'autre',
    name: 'Autre Examen',
    shortName: 'Autre',
    icon: '📋',
    color: '#64748b',
    description: 'EMG, endoscopie, anatomopathologie...',
    showEchogenicite: false,

    layout: [
      {
        type: 'section_text',
        dataKey: 'type_examen',
        label: 'TYPE D\'EXAMEN'
      },
      {
        type: 'section_text',
        dataKey: 'technique',
        label: 'TECHNIQUE'
      },
      {
        type: 'section_list',
        dataKey: 'resultats',
        label: 'RÉSULTATS'
      },
      {
        type: 'section_list',
        dataKey: 'anomalies',
        label: 'ANOMALIES'
      },
      {
        type: 'section_list',
        dataKey: 'commentaires',
        label: 'COMMENTAIRES'
      },
      {
        type: 'section_conclusion',
        dataKey: 'conclusion',
        label: 'CONCLUSION'
      }
    ],

    prompt: `Tu es un médecin spécialiste. Tu structures une dictée médicale.

RÈGLES ABSOLUES — ANTI-HALLUCINATION:
1. N'invente JAMAIS une valeur, même plausible. Toute valeur non dite explicitement = null.
2. Ne déduis pas, ne calcule pas, ne complète pas. Tu retranscris uniquement ce qui est dit.
3. Si la dictée est incomplète ou ambiguë, garde null. Ne fais jamais de supposition.
4. Retourne UNIQUEMENT du JSON valide, sans commentaire, sans markdown.

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
  "conclusion": []
}`
  }
}

export const EXAM_TYPE_LIST = Object.values(EXAM_TYPES)

export function getExamType(id) {
  return EXAM_TYPES[id] || EXAM_TYPES.autre
}
