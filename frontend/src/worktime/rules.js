// Keep released profiles immutable. Add a new version when a law or TES changes.
export const RULES_V1 = Object.freeze({
  id: 'fi-general-2026-11-04-v1',
  name: 'Yleistyöaika 8 h / 40 h',
  law: 'Työaikalaki 872/2019',
  lawVersion: 'ajantasa/2025-06-27 (muutossäädökseen 739/2025 asti)',
  checkedAt: '2026-11-04',
  sourceNotice:
    'Finlex ilmoittaa ajantasaistamisen viiveestä. TES ja poikkeavat työaikajärjestelyt eivät sisälly tähän laskentaan.',
  timezone: 'Europe/Helsinki',
  dailyMinutes: 480,
  weeklyMinutes: 2400,
  daily50Minutes: 120,
  sections: [
    [3, 2, 'Työajaksi luettava aika'],
    [5, 3, 'Yleistyöaika'],
    [16, 5, 'Ylityön määrittely'],
    [17, 5, 'Ylityöhön suostuminen'],
    [18, 5, 'Työajan enimmäismäärä'],
    [20, 5, 'Ylityö- ja sunnuntaikorotukset'],
    [21, 5, 'Korvausten vaihtaminen vapaaksi'],
    [24, 6, 'Tauot'],
    [25, 6, 'Vuorokausilepo'],
    [27, 6, 'Viikkolepo'],
    [28, 6, 'Viikkolevosta poikkeaminen ja korvaaminen'],
    [42, 9, 'Vuorokauden ja viikon vaihtuminen'],
  ].map(([section, chapter, title]) => ({
    section,
    title,
    url: `https://www.finlex.fi/fi/lainsaadanto/2019/872#chp_${chapter}__sec_${section}`,
  })),
});

export const RULES_V2 = Object.freeze({
  ...RULES_V1,
  id: 'fi-general-2026-11-04-v2',
  missingDayPolicy: 'off',
  missingDayDescription:
    'Päivä ilman työmerkintää tulkitaan vapaapäiväksi. Käynnissä oleva vuoro ei ole vapaa-aikaa.',
});

export const RULES_V3 = Object.freeze({
  ...RULES_V2,
  id: 'fi-general-2026-11-04-v3',
  breakPolicy: 'assumed-taken',
  assumedBreakDeductionMinutes: 0,
  breakDescription:
    'Tauot oletetaan pidetyiksi. Uusista kirjauksista ei vähennetä automaattisesti taukoa. Aiemmin kirjatut tauot säilyvät.',
});

export const RULES_V4 = Object.freeze({
  ...RULES_V3,
  id: 'fi-general-2026-11-13-v4',
  balancePolicy: 'actual-minus-scheduled-plus-overtime-premiums-v1',
  defaultWeeklyMinutes: 2400,
  defaultWorkDays: [1, 2, 3, 4, 5],
});

export const RULES = Object.freeze({
  ...RULES_V4,
  id: 'fi-general-2026-11-19-v5',
  checkedAt: '2026-11-19',
  breakPolicy: 'explicit-meal-choice',
  breakDescription:
    'Ruokailu työn ohessa on työaikaa. Varsinainen vapaa ruokatauko vähennetään vain kirjatun keston mukaan. Aiemmat taukotiedot säilyvät.',
  balancePolicy: 'actual-minus-scheduled-plus-overtime-and-holiday-premiums-v2',
  compensation: 'time-off',
  weeklyRest: '35h-average-14-days-minimum-24h-each-7-days',
  dailyRestReplacement: 'confirmed-exception-and-actual-continuous-rest-within-14-days',
  sourceNotice:
    'Yleistyöaika ilman TES-lisiä. Lepopoikkeuksen peruste ja korvaavan levon toteutuminen vahvistetaan erikseen.',
});
