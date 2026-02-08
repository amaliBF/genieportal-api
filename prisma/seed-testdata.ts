import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Einheitliches Passwort für alle Test-Firmen
const TEST_PASSWORD = 'TestFirma2026!';

// Portal-IDs (nur die 5 LIVE Landing Pages)
const PORTALS = {
  ausbildungsgenie: 1,
  praktikumsgenie: 2,
  berufsgenie: 3,
  minijobgenie: 4,
  werkstudentengenie: 6,
};
const PORTAL_IDS = [1, 2, 3, 4, 6];

// 10 Test-Firmen
const companies = [
  {
    name: 'TEST - Müller Elektrotechnik GmbH',
    slug: 'test-mueller-elektrotechnik',
    email: 'test-mueller@genieportal.de',
    city: 'München',
    postalCode: '80331',
    industry: 'Elektrotechnik',
    shortDescription: 'TEST - Elektroinstallationen und Smart-Home-Lösungen seit 2005',
    employeeCount: '15-50',
    contactFirst: 'Thomas',
    contactLast: 'Müller',
  },
  {
    name: 'TEST - Schreiner & Söhne Holzbau OHG',
    slug: 'test-schreiner-soehne-holzbau',
    email: 'test-schreiner@genieportal.de',
    city: 'Stuttgart',
    postalCode: '70173',
    industry: 'Holzbau',
    shortDescription: 'TEST - Traditioneller Holzbaubetrieb in 3. Generation',
    employeeCount: '5-15',
    contactFirst: 'Markus',
    contactLast: 'Schreiner',
  },
  {
    name: 'TEST - AutoFit Werkstatt GmbH',
    slug: 'test-autofit-werkstatt',
    email: 'test-autofit@genieportal.de',
    city: 'Hamburg',
    postalCode: '20095',
    industry: 'KFZ-Werkstatt',
    shortDescription: 'TEST - Moderne KFZ-Werkstatt mit Spezialisierung auf E-Autos',
    employeeCount: '15-50',
    contactFirst: 'Sabine',
    contactLast: 'Fischer',
  },
  {
    name: 'TEST - Digital Solutions GmbH',
    slug: 'test-digital-solutions',
    email: 'test-digital@genieportal.de',
    city: 'Berlin',
    postalCode: '10115',
    industry: 'IT & Software',
    shortDescription: 'TEST - Softwareentwicklung und IT-Dienstleistungen',
    employeeCount: '50-200',
    contactFirst: 'Jan',
    contactLast: 'Weber',
  },
  {
    name: 'TEST - Bäckerei Goldkruste',
    slug: 'test-baeckerei-goldkruste',
    email: 'test-goldkruste@genieportal.de',
    city: 'Köln',
    postalCode: '50667',
    industry: 'Bäckerei',
    shortDescription: 'TEST - Handwerksbäckerei mit 8 Filialen im Raum Köln',
    employeeCount: '15-50',
    contactFirst: 'Petra',
    contactLast: 'Becker',
  },
  {
    name: 'TEST - Sanitär Hoffmann GmbH',
    slug: 'test-sanitaer-hoffmann',
    email: 'test-hoffmann@genieportal.de',
    city: 'Frankfurt',
    postalCode: '60311',
    industry: 'Sanitär & Heizung',
    shortDescription: 'TEST - SHK-Fachbetrieb für Bad-Sanierung und Wärmepumpen',
    employeeCount: '5-15',
    contactFirst: 'Andreas',
    contactLast: 'Hoffmann',
  },
  {
    name: 'TEST - Praxis Dr. Weber & Kollegen',
    slug: 'test-praxis-weber',
    email: 'test-praxis@genieportal.de',
    city: 'Düsseldorf',
    postalCode: '40213',
    industry: 'Gesundheit',
    shortDescription: 'TEST - Allgemeinmedizinische Gemeinschaftspraxis',
    employeeCount: '5-15',
    contactFirst: 'Lisa',
    contactLast: 'Wagner',
  },
  {
    name: 'TEST - Hotel Seeblick GmbH',
    slug: 'test-hotel-seeblick',
    email: 'test-seeblick@genieportal.de',
    city: 'Konstanz',
    postalCode: '78462',
    industry: 'Gastronomie & Hotellerie',
    shortDescription: 'TEST - 4-Sterne Hotel am Bodensee mit Restaurant',
    employeeCount: '50-200',
    contactFirst: 'Michael',
    contactLast: 'Schmidt',
  },
  {
    name: 'TEST - Malermeister Fuchs',
    slug: 'test-malermeister-fuchs',
    email: 'test-fuchs@genieportal.de',
    city: 'Nürnberg',
    postalCode: '90402',
    industry: 'Malerbetrieb',
    shortDescription: 'TEST - Maler- und Lackierbetrieb für Innen und Außen',
    employeeCount: '5-15',
    contactFirst: 'Stefan',
    contactLast: 'Fuchs',
  },
  {
    name: 'TEST - Logistik Express GmbH',
    slug: 'test-logistik-express',
    email: 'test-logistik@genieportal.de',
    city: 'Leipzig',
    postalCode: '04109',
    industry: 'Logistik & Versand',
    shortDescription: 'TEST - Lager- und Versandlogistik für den E-Commerce',
    employeeCount: '50-200',
    contactFirst: 'Maria',
    contactLast: 'Braun',
  },
];

// Profession-IDs (aus DB abgefragt)
const PROFESSIONS: Record<string, string> = {
  'kfz-mechatroniker': '1d6d2914-9710-463d-ac80-d1e85d0dbafd',
  'elektroniker': '804a2eec-b0cd-4dd0-a2c5-f477dcd409f0',
  'anlagenmechaniker-shk': 'fa9b4a0d-984d-4704-b07c-17dce5eabb29',
  'tischler': 'fe2cef88-8f9f-4778-9aa1-28be6b509fd9',
  'maler-und-lackierer': 'f64e9cdf-f51e-4621-87c0-8ced7f0b2309',
  'friseur': 'ad49a41d-3102-4d3a-97c5-43da3d067d1f',
  'kaufmann-einzelhandel': '45fbf60f-9546-4f73-9eb5-8d547dffb8d6',
  'kauffrau-bueromanagement': 'e0898158-931b-4791-9cb3-fe30ce75fc08',
  'fachinformatiker-ae': '3b317d77-cbf3-4d79-b839-0525c52aa7ba',
  'fachinformatiker-si': 'c1ecd5c6-17f6-41a3-83a1-4933c36a2507',
  'koch': '3cb77793-f391-48fe-a9b3-749b9ebd4fe4',
  'fachkraft-lagerlogistik': 'eb6f5355-8166-4b27-a91f-9ab7c090ca43',
  'mfa': '900d946c-2121-4767-8881-71414fdccbd5',
  'industriemechaniker': '311e0646-e33b-4722-b6a0-b048a9e7ff74',
  'zimmerer': 'cb5627ff-7fee-401c-be3b-f9edc29fa337',
};

// Job-Definitionen pro Firma (5 Stellen je Firma, mit Portal-Zuweisung)
interface JobDef {
  title: string;
  profession: string;
  portalId: number;
  description: string;
  requirements: string;
  benefits: string;
  city: string;
  postalCode: string;
  salaryYear1?: number;
  salaryYear2?: number;
  salaryYear3?: number;
}

const companyJobs: JobDef[][] = [
  // Firma 1: Müller Elektrotechnik
  [
    { title: 'TEST - Ausbildung Elektroniker/in (m/w/d)', profession: 'elektroniker', portalId: 1, description: 'Starte deine Ausbildung in einem modernen Elektrobetrieb! Du lernst Smart-Home-Installationen, Photovoltaik und klassische Elektroinstallationen.', requirements: 'Hauptschulabschluss, technisches Interesse, handwerkliches Geschick', benefits: '30 Tage Urlaub, Übernahmegarantie, Firmenhandy', city: 'München', postalCode: '80331', salaryYear1: 920, salaryYear2: 970, salaryYear3: 1060 },
    { title: 'TEST - Praktikum Elektroniker/in', profession: 'elektroniker', portalId: 2, description: 'Schnuppere in den Beruf des Elektronikers rein! 2-wöchiges Schülerpraktikum mit echten Projekten.', requirements: 'Schüler ab Klasse 8', benefits: 'Praktikumszeugnis, Mittagessen', city: 'München', postalCode: '80331' },
    { title: 'TEST - Werkstudent/in Elektroplanung', profession: 'elektroniker', portalId: 6, description: 'Unterstütze unser Planungsteam bei der CAD-Elektroplanung als Werkstudent.', requirements: 'Eingeschriebener Student Elektrotechnik', benefits: 'Flexible Zeiten, 16€/h', city: 'München', postalCode: '80331' },
    { title: 'TEST - Minijob Lager & Materialverwaltung', profession: 'elektroniker', portalId: 4, description: 'Hilf uns bei der Verwaltung unseres Elektromaterial-Lagers auf 520€-Basis.', requirements: 'Zuverlässigkeit, körperliche Fitness', benefits: '520€/Monat, flexible Einteilung', city: 'München', postalCode: '80331' },
    { title: 'TEST - Ausbildung Elektroniker/in Energie- und Gebäudetechnik', profession: 'elektroniker', portalId: 3, description: 'Werde Experte für Gebäudeautomation und Energietechnik in einem zukunftssicheren Beruf.', requirements: 'Realschulabschluss, Physik-Kenntnisse', benefits: 'Tablet, Weiterbildungsbudget, Firmenfitness', city: 'München', postalCode: '80331', salaryYear1: 950, salaryYear2: 1000, salaryYear3: 1100 },
  ],
  // Firma 2: Schreiner & Söhne
  [
    { title: 'TEST - Ausbildung Tischler/in (m/w/d)', profession: 'tischler', portalId: 1, description: 'Lerne das Tischlerhandwerk von Grund auf in unserer familiären Werkstatt.', requirements: 'Hauptschulabschluss, Freude an Holz', benefits: 'Eigenes Werkzeugset, Meisterkurs-Förderung', city: 'Stuttgart', postalCode: '70173', salaryYear1: 750, salaryYear2: 850, salaryYear3: 950 },
    { title: 'TEST - Ausbildung Zimmerer/in (m/w/d)', profession: 'zimmerer', portalId: 1, description: 'Baue Dachstühle und Holzrahmenhäuser mit uns! Tradition trifft Moderne.', requirements: 'Hauptschulabschluss, körperliche Fitness', benefits: 'Baustellen-Zulagen, Firmenwagen ab 2. Lehrjahr', city: 'Stuttgart', postalCode: '70173', salaryYear1: 850, salaryYear2: 1050, salaryYear3: 1260 },
    { title: 'TEST - Praktikum Holzbau / Tischlerei', profession: 'tischler', portalId: 2, description: 'Erlebe das Tischlerhandwerk hautnah! BOGY/BORS-Praktikum willkommen.', requirements: 'Schüler ab Klasse 7', benefits: 'Praktikumszeugnis, eigenes kleines Werkstück', city: 'Stuttgart', postalCode: '70173' },
    { title: 'TEST - Minijob Werkstatthilfe Holzbau', profession: 'tischler', portalId: 4, description: 'Unterstütze uns bei Aufräumarbeiten und einfachen Holzarbeiten auf Minijob-Basis.', requirements: 'Mindestalter 16, Zuverlässigkeit', benefits: '520€/Monat, flexible Zeiten', city: 'Stuttgart', postalCode: '70173' },
    { title: 'TEST - Berufsorientierung Holzhandwerk', profession: 'zimmerer', portalId: 3, description: 'Informiere dich über Karrieremöglichkeiten im Holzhandwerk bei uns.', requirements: 'Interesse am Handwerk', benefits: 'Unverbindliche Beratung, Betriebsführung', city: 'Stuttgart', postalCode: '70173' },
  ],
  // Firma 3: AutoFit Werkstatt
  [
    { title: 'TEST - Ausbildung KFZ-Mechatroniker/in (m/w/d)', profession: 'kfz-mechatroniker', portalId: 1, description: 'Werde KFZ-Profi bei AutoFit! Schwerpunkt E-Mobilität und Diagnosetechnik.', requirements: 'Hauptschulabschluss, Auto-Begeisterung', benefits: 'Tablet, Führerschein-Zuschuss, Überstundenkonto', city: 'Hamburg', postalCode: '20095', salaryYear1: 880, salaryYear2: 935, salaryYear3: 1000 },
    { title: 'TEST - Ausbildung KFZ-Mechatroniker/in Nutzfahrzeuge', profession: 'kfz-mechatroniker', portalId: 1, description: 'Spezialisiere dich auf LKW und Transporter bei unserem Nutzfahrzeug-Team.', requirements: 'Hauptschulabschluss, technisches Verständnis', benefits: 'LKW-Führerschein, Werkzeugzuschuss', city: 'Hamburg', postalCode: '20095', salaryYear1: 900, salaryYear2: 960, salaryYear3: 1040 },
    { title: 'TEST - Praktikum KFZ-Werkstatt', profession: 'kfz-mechatroniker', portalId: 2, description: 'Schau den Profis über die Schulter! 1-3 wöchiges Praktikum in unserer Werkstatt.', requirements: 'Schüler ab Klasse 8', benefits: 'Praxiserfahrung, Zeugnis', city: 'Hamburg', postalCode: '20095' },
    { title: 'TEST - Werkstudent/in KFZ-Diagnose & Softwareupdate', profession: 'kfz-mechatroniker', portalId: 6, description: 'Du studierst Fahrzeugtechnik? Arbeite bei uns an modernen Diagnosesystemen.', requirements: 'Studium Fahrzeugtechnik/Maschinenbau', benefits: '17€/h, flexible Arbeitszeiten', city: 'Hamburg', postalCode: '20095' },
    { title: 'TEST - Minijob Fahrzeugpflege & Aufbereitung', profession: 'kfz-mechatroniker', portalId: 4, description: 'Fahrzeugpflege, Aufbereitung und Kundenfahrzeug-Annahme auf 520€-Basis.', requirements: 'Führerschein Klasse B', benefits: '520€/Monat, kostenlose Autowäsche', city: 'Hamburg', postalCode: '20095' },
  ],
  // Firma 4: Digital Solutions
  [
    { title: 'TEST - Ausbildung Fachinformatiker/in Anwendungsentwicklung', profession: 'fachinformatiker-ae', portalId: 1, description: 'Lerne Programmieren in einem echten Software-Unternehmen! React, Node.js, Cloud.', requirements: 'Realschulabschluss, Programmierkenntnisse von Vorteil', benefits: 'MacBook, Home-Office, Konferenz-Budget', city: 'Berlin', postalCode: '10115', salaryYear1: 1050, salaryYear2: 1100, salaryYear3: 1200 },
    { title: 'TEST - Ausbildung Fachinformatiker/in Systemintegration', profession: 'fachinformatiker-si', portalId: 1, description: 'Administriere Netzwerke, Server und Cloud-Infrastrukturen.', requirements: 'Realschulabschluss, IT-Interesse', benefits: 'Zertifizierungs-Budget, Home-Office, Laptop', city: 'Berlin', postalCode: '10115', salaryYear1: 1050, salaryYear2: 1100, salaryYear3: 1200 },
    { title: 'TEST - Werkstudent/in Frontend-Entwicklung (React)', profession: 'fachinformatiker-ae', portalId: 6, description: 'Entwickle mit uns moderne Web-Applikationen in React und TypeScript.', requirements: 'Informatik-Studium, React-Kenntnisse', benefits: '20€/h, Home-Office, Mentoring', city: 'Berlin', postalCode: '10115' },
    { title: 'TEST - Werkstudent/in DevOps & Cloud', profession: 'fachinformatiker-si', portalId: 6, description: 'Unterstütze unser DevOps-Team bei CI/CD, Kubernetes und AWS.', requirements: 'Informatik-Studium, Linux-Kenntnisse', benefits: '20€/h, Remote möglich', city: 'Berlin', postalCode: '10115' },
    { title: 'TEST - Praktikum Softwareentwicklung', profession: 'fachinformatiker-ae', portalId: 2, description: 'Sammle erste Programmiererfahrung bei spannenden Web-Projekten.', requirements: 'Schüler ab Klasse 9, Informatik-Interesse', benefits: 'Eigenes Mini-Projekt, Zeugnis, Laptop', city: 'Berlin', postalCode: '10115' },
  ],
  // Firma 5: Bäckerei Goldkruste
  [
    { title: 'TEST - Ausbildung Bäcker/in (m/w/d)', profession: 'koch', portalId: 1, description: 'Lerne das Bäckerhandwerk! Brot, Brötchen und feinste Backwaren aus eigener Herstellung.', requirements: 'Hauptschulabschluss, Frühaufsteher', benefits: 'Kostenlose Backwaren, 30 Tage Urlaub', city: 'Köln', postalCode: '50667', salaryYear1: 800, salaryYear2: 900, salaryYear3: 1000 },
    { title: 'TEST - Ausbildung Kaufmann/-frau im Einzelhandel (Bäckerei)', profession: 'kaufmann-einzelhandel', portalId: 1, description: 'Verkaufe Backwaren, berate Kunden und organisiere den Filialbetrieb.', requirements: 'Hauptschulabschluss, Freundlichkeit', benefits: 'Mitarbeiterrabatt, Filialleiter-Perspektive', city: 'Köln', postalCode: '50667', salaryYear1: 880, salaryYear2: 960, salaryYear3: 1090 },
    { title: 'TEST - Minijob Verkauf Bäckerei', profession: 'kaufmann-einzelhandel', portalId: 4, description: 'Verkaufe unsere Backwaren samstags und an Feiertagen auf 520€-Basis.', requirements: 'Freundliches Auftreten, ab 16 Jahren', benefits: '520€/Monat, kostenlose Backwaren', city: 'Köln', postalCode: '50667' },
    { title: 'TEST - Praktikum in der Backstube', profession: 'koch', portalId: 2, description: 'Erlebe die Backstube hautnah! 1-2 Wochen Praktikum mit echtem Backen.', requirements: 'Schüler ab Klasse 7, Frühaufsteher', benefits: 'Eigene Brote backen, Zeugnis', city: 'Köln', postalCode: '50667' },
    { title: 'TEST - Minijob Auslieferung Backwaren', profession: 'fachkraft-lagerlogistik', portalId: 4, description: 'Liefere frische Backwaren an unsere Filialen aus (früh morgens).', requirements: 'Führerschein Klasse B, Frühaufsteher', benefits: '520€/Monat, Frühstück gratis', city: 'Köln', postalCode: '50667' },
  ],
  // Firma 6: Sanitär Hoffmann
  [
    { title: 'TEST - Ausbildung Anlagenmechaniker/in SHK', profession: 'anlagenmechaniker-shk', portalId: 1, description: 'Installiere Wärmepumpen, saniere Bäder und werde Spezialist für grüne Energie.', requirements: 'Hauptschulabschluss, handwerkliches Geschick', benefits: 'Firmenwagen, Weiterbildung, 30 Tage Urlaub', city: 'Frankfurt', postalCode: '60311', salaryYear1: 900, salaryYear2: 960, salaryYear3: 1040 },
    { title: 'TEST - Ausbildung Anlagenmechaniker/in SHK (Kundendienst)', profession: 'anlagenmechaniker-shk', portalId: 3, description: 'Schwerpunkt Kundendienst: Reparaturen, Wartung und Notdienst.', requirements: 'Hauptschulabschluss, Kommunikationsstärke', benefits: 'Diensthandy, Überstundenzuschläge', city: 'Frankfurt', postalCode: '60311', salaryYear1: 900, salaryYear2: 960, salaryYear3: 1040 },
    { title: 'TEST - Praktikum SHK-Handwerk', profession: 'anlagenmechaniker-shk', portalId: 2, description: 'Erlebe den SHK-Alltag auf echten Baustellen und in unserer Werkstatt.', requirements: 'Schüler ab Klasse 8', benefits: 'Zeugnis, Einblick in echte Projekte', city: 'Frankfurt', postalCode: '60311' },
    { title: 'TEST - Werkstudent/in Technische Planung SHK', profession: 'anlagenmechaniker-shk', portalId: 6, description: 'Unterstütze uns bei der CAD-Planung von Heizungs- und Sanitäranlagen.', requirements: 'Studium Versorgungstechnik/Maschinenbau', benefits: '16€/h, Praxiserfahrung, Werkstudenten-Vertrag', city: 'Frankfurt', postalCode: '60311' },
    { title: 'TEST - Minijob Lager & Materialwirtschaft SHK', profession: 'fachkraft-lagerlogistik', portalId: 4, description: 'Hilf bei der Lagerverwaltung von Sanitärmaterial auf 520€-Basis.', requirements: 'Zuverlässigkeit, ordentliche Arbeitsweise', benefits: '520€/Monat, flexible Tage', city: 'Frankfurt', postalCode: '60311' },
  ],
  // Firma 7: Praxis Dr. Weber
  [
    { title: 'TEST - Ausbildung Medizinische/r Fachangestellte/r', profession: 'mfa', portalId: 1, description: 'Werde MFA in unserer modernen Gemeinschaftspraxis mit netten Kollegen.', requirements: 'Realschulabschluss, Einfühlungsvermögen', benefits: 'Keine Wochenendarbeit, Fortbildungen, Gesundheitsbonus', city: 'Düsseldorf', postalCode: '40213', salaryYear1: 920, salaryYear2: 980, salaryYear3: 1060 },
    { title: 'TEST - Ausbildung MFA (Schwerpunkt Labor)', profession: 'mfa', portalId: 3, description: 'Spezialisiere dich auf Labordiagnostik in unserer Praxis.', requirements: 'Realschulabschluss, naturwissenschaftliches Interesse', benefits: 'Labor-Fortbildungen, Prämien', city: 'Düsseldorf', postalCode: '40213', salaryYear1: 920, salaryYear2: 980, salaryYear3: 1060 },
    { title: 'TEST - Praktikum Arztpraxis', profession: 'mfa', portalId: 2, description: 'Lerne den Praxisalltag kennen! Ideal für alle, die einen Gesundheitsberuf anstreben.', requirements: 'Schüler ab Klasse 9', benefits: 'Zeugnis, Einblick in Medizin', city: 'Düsseldorf', postalCode: '40213' },
    { title: 'TEST - Minijob Praxis-Empfang', profession: 'kauffrau-bueromanagement', portalId: 4, description: 'Empfange Patienten und bearbeite Terminanfragen auf 520€-Basis.', requirements: 'Freundliches Auftreten, PC-Kenntnisse', benefits: '520€/Monat, nachmittags', city: 'Düsseldorf', postalCode: '40213' },
    { title: 'TEST - Werkstudent/in Praxismanagement', profession: 'kauffrau-bueromanagement', portalId: 6, description: 'Unterstütze uns bei Verwaltung, Abrechnung und Digitalisierung der Praxis.', requirements: 'Studium Gesundheitsmanagement o.ä.', benefits: '15€/h, flexible Zeiten', city: 'Düsseldorf', postalCode: '40213' },
  ],
  // Firma 8: Hotel Seeblick
  [
    { title: 'TEST - Ausbildung Koch/Köchin (m/w/d)', profession: 'koch', portalId: 1, description: 'Koche in unserem ausgezeichneten Hotelrestaurant am Bodensee! Regionale Küche trifft Kreativität.', requirements: 'Hauptschulabschluss, Leidenschaft fürs Kochen', benefits: 'Kost & Logis möglich, 30 Tage Urlaub', city: 'Konstanz', postalCode: '78462', salaryYear1: 800, salaryYear2: 900, salaryYear3: 1000 },
    { title: 'TEST - Ausbildung Kaufmann/-frau für Büromanagement (Hotel)', profession: 'kauffrau-bueromanagement', portalId: 1, description: 'Organisiere den Hotelbetrieb von Reservierung bis Buchhaltung.', requirements: 'Realschulabschluss, Organisationstalent', benefits: 'Hotelübernachtungen, Verpflegung', city: 'Konstanz', postalCode: '78462', salaryYear1: 900, salaryYear2: 1000, salaryYear3: 1100 },
    { title: 'TEST - Praktikum Hotelküche', profession: 'koch', portalId: 2, description: 'Erlebe die Profiküche eines 4-Sterne-Hotels hautnah.', requirements: 'Schüler ab Klasse 8', benefits: 'Mittagessen, Zeugnis, Kochkurs', city: 'Konstanz', postalCode: '78462' },
    { title: 'TEST - Minijob Service / Frühstücksbuffet', profession: 'koch', portalId: 4, description: 'Unterstütze unser Service-Team beim Frühstücksbuffet am Wochenende.', requirements: 'Freundlichkeit, ab 16 Jahren', benefits: '520€/Monat, Trinkgeld, Verpflegung', city: 'Konstanz', postalCode: '78462' },
    { title: 'TEST - Werkstudent/in Hotelmanagement & Rezeption', profession: 'kauffrau-bueromanagement', portalId: 6, description: 'Arbeite an der Rezeption und unterstütze das Hotelmanagement.', requirements: 'Studium Tourismus/BWL', benefits: '15€/h, Zimmer-Rabatt, Verpflegung', city: 'Konstanz', postalCode: '78462' },
  ],
  // Firma 9: Malermeister Fuchs
  [
    { title: 'TEST - Ausbildung Maler/in und Lackierer/in', profession: 'maler-und-lackierer', portalId: 1, description: 'Gestalte Innenräume und Fassaden mit Farbe! Kreatives Handwerk mit Zukunft.', requirements: 'Hauptschulabschluss, Farbgefühl', benefits: 'Firmenwagen, Arbeitskleidung, Weiterbildung', city: 'Nürnberg', postalCode: '90402', salaryYear1: 770, salaryYear2: 850, salaryYear3: 980 },
    { title: 'TEST - Ausbildung Maler/in (Schwerpunkt Fassade)', profession: 'maler-und-lackierer', portalId: 3, description: 'Spezialisiere dich auf Fassadengestaltung und Wärmedämmung.', requirements: 'Hauptschulabschluss, Schwindelfreiheit', benefits: 'Gerüstausbildung inklusive, Zulagen', city: 'Nürnberg', postalCode: '90402', salaryYear1: 770, salaryYear2: 850, salaryYear3: 980 },
    { title: 'TEST - Praktikum Malerbetrieb', profession: 'maler-und-lackierer', portalId: 2, description: 'Streiche, tapeziere und gestalte mit uns! Praxisnah und bunt.', requirements: 'Schüler ab Klasse 7', benefits: 'Eigene Malerarbeiten, Zeugnis', city: 'Nürnberg', postalCode: '90402' },
    { title: 'TEST - Minijob Malerhelfer/in', profession: 'maler-und-lackierer', portalId: 4, description: 'Unterstütze uns auf Baustellen: Abkleben, streichen, aufräumen.', requirements: 'Zuverlässigkeit, ab 16 Jahren', benefits: '520€/Monat, Arbeitskleidung', city: 'Nürnberg', postalCode: '90402' },
    { title: 'TEST - Berufsorientierung Maler & Lackierer', profession: 'maler-und-lackierer', portalId: 3, description: 'Informiere dich über den Malerberuf und mache einen Probetag bei uns.', requirements: 'Keine Vorkenntnisse nötig', benefits: 'Unverbindlich, Betriebsführung', city: 'Nürnberg', postalCode: '90402' },
  ],
  // Firma 10: Logistik Express
  [
    { title: 'TEST - Ausbildung Fachkraft für Lagerlogistik', profession: 'fachkraft-lagerlogistik', portalId: 1, description: 'Organisiere den Warenfluss in unserem hochmodernen Logistikzentrum.', requirements: 'Hauptschulabschluss, Organisationstalent', benefits: 'Gabelstapler-Schein, Prämien, Firmenfitness', city: 'Leipzig', postalCode: '04109', salaryYear1: 870, salaryYear2: 940, salaryYear3: 1020 },
    { title: 'TEST - Ausbildung Kaufmann/-frau für Büromanagement (Logistik)', profession: 'kauffrau-bueromanagement', portalId: 1, description: 'Organisiere Logistikprozesse, bearbeite Aufträge und koordiniere Sendungen.', requirements: 'Realschulabschluss, PC-Kenntnisse', benefits: 'Home-Office-Tage, Weiterbildung', city: 'Leipzig', postalCode: '04109', salaryYear1: 900, salaryYear2: 1000, salaryYear3: 1100 },
    { title: 'TEST - Werkstudent/in Logistik-IT', profession: 'fachinformatiker-ae', portalId: 6, description: 'Entwickle mit uns Lagerverwaltungs-Software und Automatisierungslösungen.', requirements: 'Informatik-Studium, Python/SQL-Kenntnisse', benefits: '18€/h, flexible Zeiten, Remote teilweise', city: 'Leipzig', postalCode: '04109' },
    { title: 'TEST - Minijob Lagerhelfer/in', profession: 'fachkraft-lagerlogistik', portalId: 4, description: 'Kommissioniere Bestellungen und bereite Versandpakete vor auf 520€-Basis.', requirements: 'Körperliche Fitness, ab 16 Jahren', benefits: '520€/Monat, Pausenraum, Getränke', city: 'Leipzig', postalCode: '04109' },
    { title: 'TEST - Praktikum Logistik & Versand', profession: 'fachkraft-lagerlogistik', portalId: 2, description: 'Erlebe moderne E-Commerce-Logistik: Wareneingang, Lager, Versand und Retouren.', requirements: 'Schüler ab Klasse 8', benefits: 'Zeugnis, Einblick in Automation', city: 'Leipzig', postalCode: '04109' },
  ],
];

async function main() {
  console.log('🏗️  Erstelle Testdaten...\n');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  console.log(`📧  Einheitliches Passwort: ${TEST_PASSWORD}`);
  console.log('─'.repeat(70));

  const results: { company: string; email: string; password: string; jobs: number }[] = [];

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const jobs = companyJobs[i];

    console.log(`\n📦 Firma ${i + 1}/10: ${c.name}`);

    // Prüfe ob Firma schon existiert
    const existing = await prisma.company.findUnique({
      where: { slug: c.slug },
    });
    if (existing) {
      console.log(`   ⚠️  Slug "${c.slug}" existiert bereits – überspringe.`);
      continue;
    }

    // Erstelle Firma + CompanyUser
    const company = await prisma.company.create({
      data: {
        name: c.name,
        slug: c.slug,
        email: c.email,
        city: c.city,
        postalCode: c.postalCode,
        industry: c.industry,
        shortDescription: c.shortDescription,
        employeeCount: c.employeeCount,
        status: 'ACTIVE',
        verified: true,
        verifiedAt: new Date(),
        subscriptionPlan: 'PRO',
        portalId: 1,
        companyUsers: {
          create: {
            email: c.email,
            passwordHash,
            firstName: c.contactFirst,
            lastName: c.contactLast,
            role: 'owner',
            canEditProfile: true,
            canManageJobs: true,
            canChat: true,
            canManageTeam: true,
            canManageBilling: true,
            emailVerified: true,
            joinedAt: new Date(),
          },
        },
      },
    });

    console.log(`   ✅ Firma erstellt (ID: ${company.id})`);

    // Erstelle 5 Stellen
    let jobCount = 0;
    for (const job of jobs) {
      const professionId = PROFESSIONS[job.profession];

      await prisma.jobPost.create({
        data: {
          title: job.title,
          companyId: company.id,
          professionId: professionId || null,
          description: job.description,
          requirements: job.requirements,
          benefits: job.benefits,
          city: job.city,
          postalCode: job.postalCode,
          salaryYear1: job.salaryYear1 || null,
          salaryYear2: job.salaryYear2 || null,
          salaryYear3: job.salaryYear3 || null,
          status: 'ACTIVE',
          showOnWebsite: true,
          portalId: job.portalId,
          publishedAt: new Date(),
          positionsAvailable: 1,
        },
      });
      jobCount++;
    }

    console.log(`   ✅ ${jobCount} Stellen erstellt`);

    results.push({
      company: c.name,
      email: c.email,
      password: TEST_PASSWORD,
      jobs: jobCount,
    });
  }

  // Zusammenfassung
  console.log('\n' + '═'.repeat(70));
  console.log('📋 ZUSAMMENFASSUNG - Zugangsdaten');
  console.log('═'.repeat(70));
  console.log(`\n🔑 Passwort für ALLE Firmen: ${TEST_PASSWORD}`);
  console.log(`🔗 Dashboard: https://dashboard.genieportal.de\n`);

  console.log('Nr  | Firma                               | Login-Email');
  console.log('----+-------------------------------------+-----------------------------------');
  results.forEach((r, idx) => {
    console.log(`${String(idx + 1).padStart(2)}  | ${r.company.padEnd(35)} | ${r.email}`);
  });

  console.log('\n📊 Stellen nach Portal:');
  const portalCounts: Record<number, number> = {};
  for (const jobs of companyJobs) {
    for (const job of jobs) {
      portalCounts[job.portalId] = (portalCounts[job.portalId] || 0) + 1;
    }
  }
  const portalNames: Record<number, string> = {
    1: 'ausbildungsgenie.de',
    2: 'praktikumsgenie.de',
    3: 'berufsgenie.de',
    4: 'minijobgenie.de',
    6: 'werkstudentengenie.de',
  };
  for (const [pid, count] of Object.entries(portalCounts).sort()) {
    console.log(`   Portal ${pid} (${portalNames[Number(pid)] || '?'}): ${count} Stellen`);
  }

  console.log(`\n✅ Insgesamt: ${results.length} Firmen, ${results.reduce((sum, r) => sum + r.jobs, 0)} Stellen\n`);
}

main()
  .catch((e) => {
    console.error('❌ Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
