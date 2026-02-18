import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// Kategorie-Mapping (Adzuna tags → einheitliche Slugs)
// ═══════════════════════════════════════════════════════════════

export const CATEGORY_MAP: Record<string, { slug: string; label: string }> = {
  'it-jobs': { slug: 'it-software', label: 'IT & Software' },
  'engineering-jobs': { slug: 'ingenieurwesen', label: 'Ingenieurwesen' },
  'accounting-finance-jobs': { slug: 'finanzen-controlling', label: 'Finanzen & Controlling' },
  'sales-jobs': { slug: 'vertrieb-sales', label: 'Vertrieb & Sales' },
  'marketing-jobs': { slug: 'marketing-kommunikation', label: 'Marketing & Kommunikation' },
  'hr-jobs': { slug: 'personal-hr', label: 'Personal & HR' },
  'logistics-warehouse-jobs': { slug: 'logistik-supply-chain', label: 'Logistik & Supply Chain' },
  'admin-jobs': { slug: 'verwaltung-office', label: 'Verwaltung & Office' },
  'legal-jobs': { slug: 'recht-jura', label: 'Recht & Jura' },
  'customer-services-jobs': { slug: 'kundenservice', label: 'Kundenservice' },
  'creative-design-jobs': { slug: 'design-ux', label: 'Design & UX' },
  'consultancy-jobs': { slug: 'beratung-consulting', label: 'Beratung & Consulting' },
  'healthcare-nursing-jobs': { slug: 'gesundheit-pflege', label: 'Gesundheit & Pflege' },
  'teaching-jobs': { slug: 'bildung-lehre', label: 'Bildung & Lehre' },
  'scientific-qa-jobs': { slug: 'forschung-entwicklung', label: 'Forschung & Entwicklung' },
  'hospitality-catering-jobs': { slug: 'gastronomie-hotel', label: 'Gastronomie & Hotel' },
  'retail-jobs': { slug: 'einzelhandel', label: 'Einzelhandel' },
  'manufacturing-jobs': { slug: 'produktion-fertigung', label: 'Produktion & Fertigung' },
  'graduate-jobs': { slug: 'berufseinsteiger', label: 'Berufseinsteiger' },
  'part-time-jobs': { slug: 'teilzeit', label: 'Teilzeit' },
  'other-general-jobs': { slug: 'sonstige', label: 'Sonstige' },
};

// ═══════════════════════════════════════════════════════════════
// Titel-basierte Kategorie-Erkennung (für Jooble/Careerjet)
// ═══════════════════════════════════════════════════════════════

const TITLE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  'it-software': ['software', 'entwickl', 'developer', 'java', 'python', 'react', 'frontend', 'backend', 'fullstack', 'devops', 'datenbank', 'it-', 'informatik', 'data science', 'machine learning'],
  'marketing-kommunikation': ['marketing', 'social media', 'content', 'seo', 'sem', 'online-marketing', 'kommunikation', 'pr ', 'werbung'],
  'finanzen-controlling': ['finanz', 'controlling', 'buchhalt', 'steuer', 'audit', 'accounting', 'rechnungswesen'],
  'vertrieb-sales': ['vertrieb', 'sales', 'verkauf', 'account manager', 'business development'],
  'personal-hr': ['personal', ' hr ', 'human resource', 'recruiting', 'talent'],
  'ingenieurwesen': ['ingenieur', 'maschinenbau', 'elektro', 'mechatronik', 'konstrukt', 'cad', 'engineering'],
  'design-ux': ['design', 'grafik', 'ux', 'ui ', 'creative', 'gestalt'],
  'logistik-supply-chain': ['logistik', 'supply chain', 'lager', 'warehouse', 'versand', 'einkauf'],
  'beratung-consulting': ['berat', 'consult', 'analyst'],
  'gesundheit-pflege': ['pflege', 'gesundheit', 'medizin', 'kranken', 'pharma', 'klinik'],
  'verwaltung-office': ['verwaltung', 'office', 'sekretär', 'assistenz', 'büro', 'sachbearbeit'],
  'gastronomie-hotel': ['gastro', 'hotel', 'restaurant', 'koch', 'küche', 'kellner'],
  'einzelhandel': ['einzelhandel', 'verkäufer', 'kasse', 'filiale', 'retail'],
  'bildung-lehre': ['lehrer', 'dozent', 'tutor', 'nachhilfe', 'pädagog', 'erzieher'],
};

export function detectCategoryFromTitle(title: string): { slug: string; label: string } {
  const lower = (title || '').toLowerCase();
  for (const [slug, keywords] of Object.entries(TITLE_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const mapped = Object.values(CATEGORY_MAP).find((c) => c.slug === slug);
        return mapped || { slug, label: slug };
      }
    }
  }
  return { slug: 'sonstige', label: 'Sonstige' };
}

// ═══════════════════════════════════════════════════════════════
// Stadt-Normalisierung
// ═══════════════════════════════════════════════════════════════

const CITY_NORMALIZE: Record<string, string> = {
  'berlin, berlin': 'Berlin',
  'hamburg, hamburg': 'Hamburg',
  'münchen, bayern': 'München',
  'muenchen, bayern': 'München',
  'köln, nordrhein-westfalen': 'Köln',
  'frankfurt am main, hessen': 'Frankfurt am Main',
  'stuttgart, baden-württemberg': 'Stuttgart',
  'düsseldorf, nordrhein-westfalen': 'Düsseldorf',
  'dortmund, nordrhein-westfalen': 'Dortmund',
  'essen, nordrhein-westfalen': 'Essen',
  'leipzig, sachsen': 'Leipzig',
  'bremen, bremen': 'Bremen',
  'dresden, sachsen': 'Dresden',
  'hannover, niedersachsen': 'Hannover',
  'nürnberg, bayern': 'Nürnberg',
  'duisburg, nordrhein-westfalen': 'Duisburg',
  'bochum, nordrhein-westfalen': 'Bochum',
  'wuppertal, nordrhein-westfalen': 'Wuppertal',
  'bielefeld, nordrhein-westfalen': 'Bielefeld',
  'bonn, nordrhein-westfalen': 'Bonn',
  'mannheim, baden-württemberg': 'Mannheim',
  'karlsruhe, baden-württemberg': 'Karlsruhe',
  'augsburg, bayern': 'Augsburg',
  'wiesbaden, hessen': 'Wiesbaden',
  'aachen, nordrhein-westfalen': 'Aachen',
  'braunschweig, niedersachsen': 'Braunschweig',
  'kiel, schleswig-holstein': 'Kiel',
  'magdeburg, sachsen-anhalt': 'Magdeburg',
  'freiburg, baden-württemberg': 'Freiburg',
  'lübeck, schleswig-holstein': 'Lübeck',
  'erfurt, thüringen': 'Erfurt',
  'rostock, mecklenburg-vorpommern': 'Rostock',
  'mainz, rheinland-pfalz': 'Mainz',
  'kassel, hessen': 'Kassel',
  'halle, sachsen-anhalt': 'Halle',
  'saarbrücken, saarland': 'Saarbrücken',
  'potsdam, brandenburg': 'Potsdam',
  'oldenburg, niedersachsen': 'Oldenburg',
  'darmstadt, hessen': 'Darmstadt',
  'heidelberg, baden-württemberg': 'Heidelberg',
  'regensburg, bayern': 'Regensburg',
  'würzburg, bayern': 'Würzburg',
  'ulm, baden-württemberg': 'Ulm',
  'schwerin, mecklenburg-vorpommern': 'Schwerin',
};

export function normalizeCity(locationDisplay: string | undefined | null): string | null {
  if (!locationDisplay) return null;
  const key = locationDisplay.toLowerCase().trim();
  if (CITY_NORMALIZE[key]) return CITY_NORMALIZE[key];
  // Fallback: Erster Teil vor dem Komma
  const firstPart = locationDisplay.split(',')[0].trim();
  return firstPart || null;
}

// ═══════════════════════════════════════════════════════════════
// Jooble Salary-Parsing
// ═══════════════════════════════════════════════════════════════

export function parseJoobleSalary(salaryStr: string | undefined | null): {
  min: number | null;
  max: number | null;
  unit: string;
} {
  if (!salaryStr) return { min: null, max: null, unit: 'MONTH' };

  const numbers = salaryStr.match(/[\d.,]+/g);
  if (!numbers || numbers.length === 0) return { min: null, max: null, unit: 'MONTH' };

  const vals = numbers.map((n) => parseFloat(n.replace(/\./g, '').replace(',', '.')));
  const lower = salaryStr.toLowerCase();

  let unit = 'YEAR';
  if (lower.includes('stunde') || lower.includes('hour') || lower.includes('/h')) unit = 'HOUR';
  else if (lower.includes('monat') || lower.includes('month')) unit = 'MONTH';

  return {
    min: vals[0] ? Math.round(vals[0]) : null,
    max: vals[1] ? Math.round(vals[1]) : vals[0] ? Math.round(vals[0]) : null,
    unit,
  };
}

// ═══════════════════════════════════════════════════════════════
// Slug-Generierung
// ═══════════════════════════════════════════════════════════════

export function generateSlug(title: string, company?: string | null): string {
  const base = `${company || 'extern'}-${title}`
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 250);
  return base;
}

// ═══════════════════════════════════════════════════════════════
// Title-Hash für Deduplizierung
// ═══════════════════════════════════════════════════════════════

export function createTitleHash(
  title: string,
  company?: string | null,
  city?: string | null,
): string {
  const normalized = [
    (title || '').toLowerCase().replace(/[^a-zäöüß0-9]/g, '').substring(0, 80),
    (company || '').toLowerCase().replace(/[^a-zäöüß0-9]/g, '').substring(0, 40),
    (city || '').toLowerCase().replace(/[^a-zäöüß0-9]/g, '').substring(0, 30),
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

// ═══════════════════════════════════════════════════════════════
// Portal-Mapping
// ═══════════════════════════════════════════════════════════════

export const JOB_TYPE_TO_PORTAL_ID: Record<string, number> = {
  ausbildung: 1,
  praktikum: 2,
  vollzeit: 3,
  minijob: 4,
  werkstudent: 6,
};

export const PORTAL_SEARCH_CONFIG = [
  {
    jobType: 'werkstudent',
    portalId: 6,
    searches: [
      { keyword: 'werkstudent' },
      { keyword: 'working student' },
      { keyword: 'studentische hilfskraft' },
      { keyword: 'studentenjob' },
    ],
  },
  {
    jobType: 'ausbildung',
    portalId: 1,
    searches: [
      { keyword: 'ausbildung' },
      { keyword: 'ausbildungsplatz' },
      { keyword: 'azubi' },
      { keyword: 'lehrling' },
    ],
  },
  {
    jobType: 'praktikum',
    portalId: 2,
    searches: [
      { keyword: 'praktikum' },
      { keyword: 'internship' },
      { keyword: 'pflichtpraktikum' },
      { keyword: 'praxissemester' },
    ],
  },
  {
    jobType: 'minijob',
    portalId: 4,
    searches: [
      { keyword: 'minijob' },
      { keyword: 'aushilfe' },
      { keyword: 'geringfügig' },
      { keyword: 'nebenjob' },
    ],
  },
  {
    jobType: 'vollzeit',
    portalId: 3,
    searches: [
      { keyword: 'vollzeit' },
      { keyword: 'festanstellung' },
      { keyword: 'teilzeit' },
    ],
    adzunaCategories: [
      'it-jobs',
      'engineering-jobs',
      'marketing-jobs',
      'sales-jobs',
      'accounting-finance-jobs',
      'hr-jobs',
      'healthcare-nursing-jobs',
      'admin-jobs',
    ],
  },
];
