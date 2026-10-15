/**
 * Corpus registry: every work the record cites, and the edition it is cited
 * from.
 *
 * A reference that does not resolve to a work here cannot enter the record —
 * `ref()` throws at module load, so the build fails rather than publishing a
 * citation nobody can check.
 */

import type { Edition, Reference, Translation, Work } from '../schema';
import type { CorpusCategory, TraditionFamily } from '../taxonomy';

const BHS: Edition = {
  id: 'bhs',
  title: 'Biblia Hebraica Stuttgartensia, 5th edition',
  publisher: 'Deutsche Bibelgesellschaft, Stuttgart',
  year: '1997',
  language: 'Hebrew',
};

const NA28: Edition = {
  id: 'na28',
  title: 'Novum Testamentum Graece, 28th edition (Nestle–Aland)',
  publisher: 'Deutsche Bibelgesellschaft, Stuttgart',
  year: '2012',
  language: 'Greek',
};

const QURAN: Edition = {
  id: 'hafs-standard',
  title:
    'Muṣḥaf in the reading of Ḥafṣ ʿan ʿĀṣim (Cairo edition of 1924 and the King Fahd Complex standard text)',
  publisher: null,
  year: '1924',
  language: 'Arabic',
};

const LDS_2013 = (title: string): Edition => ({
  id: 'lds-2013',
  title: `${title} (2013 edition)`,
  publisher: 'The Church of Jesus Christ of Latter-day Saints, Salt Lake City',
  year: '2013',
  language: 'English',
});

const VILNA: Edition = {
  id: 'vilna',
  title: 'Babylonian Talmud, Vilna edition',
  publisher: 'Romm, Vilna',
  year: '1880–1886',
  language: 'Hebrew and Aramaic',
};

const SCRIPTURE_JC: TraditionFamily[] = ['jewish', 'christian', 'latter-day-saint'];
const SCRIPTURE_NT: TraditionFamily[] = ['christian', 'latter-day-saint'];

interface WorkInput {
  id: string;
  title: string;
  citeAs: string;
  aliases?: string[];
  category: CorpusCategory;
  collection: string;
  canonicalFor?: TraditionFamily[];
  edition: Edition;
  author?: string | null;
  date?: string | null;
}

function work(w: WorkInput): Work {
  return {
    id: w.id,
    title: w.title,
    citeAs: w.citeAs,
    aliases: w.aliases ?? [],
    category: w.category,
    collection: w.collection,
    canonicalFor: w.canonicalFor ?? [],
    edition: w.edition,
    author: w.author ?? null,
    date: w.date ?? null,
  };
}

const tanakh = (id: string, title: string, citeAs: string, aliases: string[] = []) =>
  work({
    id,
    title,
    citeAs,
    aliases,
    category: 'primary_text',
    collection: 'Tanakh / Old Testament',
    canonicalFor: SCRIPTURE_JC,
    edition: BHS,
  });

const nt = (id: string, title: string, citeAs: string, aliases: string[] = []) =>
  work({
    id,
    title,
    citeAs,
    aliases,
    category: 'primary_text',
    collection: 'New Testament',
    canonicalFor: SCRIPTURE_NT,
    edition: NA28,
  });

const bavli = (tractate: string) =>
  work({
    id: `bavli-${tractate.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    title: `Babylonian Talmud, tractate ${tractate}`,
    citeAs: `b. ${tractate}`,
    category: 'reception_history',
    collection: 'Babylonian Talmud',
    edition: VILNA,
    date: 'c. 6th century (redaction)',
  });

export const WORKS: Work[] = [
  /* Tanakh */
  tanakh('genesis', 'Genesis', 'Genesis', ['Gen']),
  tanakh('exodus', 'Exodus', 'Exodus', ['Exod']),
  tanakh('leviticus', 'Leviticus', 'Leviticus', ['Lev']),
  tanakh('numbers', 'Numbers', 'Numbers', ['Num']),
  tanakh('deuteronomy', 'Deuteronomy', 'Deuteronomy', ['Deut']),
  tanakh('2-samuel', '2 Samuel', '2 Samuel'),
  tanakh('1-kings', '1 Kings', '1 Kings'),
  tanakh('psalms', 'Psalms', 'Psalm', ['Psalms', 'Ps']),
  tanakh('isaiah', 'Isaiah', 'Isaiah', ['Isa']),
  tanakh('hosea', 'Hosea', 'Hosea', ['Hos']),
  tanakh('jeremiah', 'Jeremiah', 'Jeremiah', ['Jer']),
  tanakh('ezekiel', 'Ezekiel', 'Ezekiel', ['Ezek']),

  /* New Testament */
  nt('matthew', 'Gospel of Matthew', 'Matthew', ['Matt']),
  nt('mark', 'Gospel of Mark', 'Mark'),
  nt('luke', 'Gospel of Luke', 'Luke'),
  nt('john', 'Gospel of John', 'John'),
  nt('acts', 'Acts of the Apostles', 'Acts'),
  nt('romans', 'Romans', 'Romans', ['Rom']),
  nt('1-corinthians', '1 Corinthians', '1 Corinthians', ['1 Cor']),
  nt('galatians', 'Galatians', 'Galatians', ['Gal']),
  nt('1-timothy', '1 Timothy', '1 Timothy'),
  nt('hebrews', 'Epistle to the Hebrews', 'Hebrews', ['Heb']),
  nt('1-peter', '1 Peter', '1 Peter'),
  nt('revelation', 'Revelation', 'Revelation', ['Rev']),

  /* Qur'an */
  work({
    id: 'quran',
    title: 'The Qur’an',
    citeAs: 'Q',
    aliases: ['Qur’an', "Qur'an", 'Quran', 'Koran'],
    category: 'primary_text',
    collection: 'Qur’an',
    canonicalFor: ['islamic'],
    edition: QURAN,
  }),

  /* Latter-day Saint canon */
  ...(
    [
      ['1-nephi', '1 Nephi'],
      ['mosiah', 'Mosiah'],
      ['alma', 'Alma'],
      ['3-nephi', '3 Nephi'],
    ] as const
  ).map(([id, name]) =>
    work({
      id,
      title: `Book of Mormon, ${name}`,
      citeAs: name,
      category: 'primary_text',
      collection: 'Book of Mormon',
      canonicalFor: ['latter-day-saint'],
      edition: LDS_2013('The Book of Mormon'),
    }),
  ),
  work({
    id: 'doctrine-and-covenants',
    title: 'Doctrine and Covenants',
    citeAs: 'D&C',
    aliases: ['Doctrine and Covenants'],
    category: 'primary_text',
    collection: 'Doctrine and Covenants',
    canonicalFor: ['latter-day-saint'],
    edition: LDS_2013('The Doctrine and Covenants'),
  }),
  work({
    id: 'book-of-abraham',
    title: 'Pearl of Great Price, Book of Abraham',
    citeAs: 'Abraham',
    category: 'primary_text',
    collection: 'Pearl of Great Price',
    canonicalFor: ['latter-day-saint'],
    edition: LDS_2013('The Pearl of Great Price'),
  }),
  work({
    id: 'joseph-smith-history',
    title: 'Pearl of Great Price, Joseph Smith—History',
    citeAs: 'Joseph Smith—History',
    aliases: ['JS—H', 'Joseph Smith-History'],
    category: 'primary_text',
    collection: 'Pearl of Great Price',
    canonicalFor: ['latter-day-saint'],
    edition: LDS_2013('The Pearl of Great Price'),
  }),
  work({
    id: 'articles-of-faith',
    title: 'Pearl of Great Price, Articles of Faith',
    citeAs: 'Articles of Faith',
    category: 'primary_text',
    collection: 'Pearl of Great Price',
    canonicalFor: ['latter-day-saint'],
    edition: LDS_2013('The Pearl of Great Price'),
  }),

  /* Historical witnesses and material evidence */
  work({
    id: 'septuagint',
    title: 'Septuagint (Greek Jewish scriptures)',
    citeAs: 'LXX',
    aliases: ['Septuagint'],
    category: 'historical_witness',
    collection: 'Ancient versions',
    edition: {
      id: 'rahlfs-hanhart',
      title: 'Septuaginta, ed. Alfred Rahlfs, revised by Robert Hanhart',
      publisher: 'Deutsche Bibelgesellschaft, Stuttgart',
      year: '2006',
      language: 'Greek',
    },
    date: '3rd–1st centuries BCE (translation)',
  }),
  work({
    id: 'book-of-commandments-1833',
    title: 'A Book of Commandments, for the Government of the Church of Christ',
    citeAs: 'Book of Commandments (1833)',
    category: 'historical_witness',
    collection: 'Early Latter-day Saint printings',
    edition: {
      id: 'boc-1833',
      title: 'First printing (incomplete; press destroyed in July 1833)',
      publisher: 'W. W. Phelps & Co., Zion (Independence), Missouri',
      year: '1833',
      language: 'English',
    },
    date: '1833',
  }),
  work({
    id: 'doctrine-and-covenants-1835',
    title: 'Doctrine and Covenants of the Church of the Latter Day Saints',
    citeAs: 'Doctrine and Covenants (1835)',
    category: 'historical_witness',
    collection: 'Early Latter-day Saint printings',
    edition: {
      id: 'dc-1835',
      title: 'First edition',
      publisher: 'F. G. Williams & Co., Kirtland, Ohio',
      year: '1835',
      language: 'English',
    },
    date: '1835',
  }),
  work({
    id: 'messenger-and-advocate',
    title: 'Latter Day Saints’ Messenger and Advocate',
    citeAs: 'Messenger and Advocate',
    category: 'historical_witness',
    collection: 'Early Latter-day Saint printings',
    edition: {
      id: 'ma-1834',
      title: 'Periodical, Kirtland, Ohio',
      publisher: 'F. G. Williams & Co., Kirtland, Ohio',
      year: '1834–1837',
      language: 'English',
    },
    author: 'Oliver Cowdery (vol. 1, no. 1 letter)',
    date: 'October 1834',
  }),
  work({
    id: 'joseph-smith-history-1832',
    title: 'Joseph Smith, History, circa Summer 1832',
    citeAs: 'Joseph Smith, History (c. 1832)',
    category: 'historical_witness',
    collection: 'Early Latter-day Saint manuscripts',
    edition: {
      id: 'jsp-histories-1',
      title: 'The Joseph Smith Papers, Histories, Volume 1: 1832–1844',
      publisher: 'Church Historian’s Press, Salt Lake City',
      year: '2012',
      language: 'English',
    },
    author: 'Joseph Smith',
    date: '1832',
  }),

  /* Reception history — rabbinic */
  work({
    id: 'mishnah-avot',
    title: 'Mishnah, tractate Avot',
    citeAs: 'm. Avot',
    category: 'reception_history',
    collection: 'Mishnah',
    edition: { id: 'mishnah-standard', title: 'Mishnah, standard printed text', publisher: null, year: null, language: 'Hebrew' },
    date: 'c. 200 CE (redaction)',
  }),
  work({
    id: 'mishnah-sheviit',
    title: 'Mishnah, tractate Shevi’it',
    citeAs: 'm. Shevi’it',
    category: 'reception_history',
    collection: 'Mishnah',
    edition: { id: 'mishnah-standard', title: 'Mishnah, standard printed text', publisher: null, year: null, language: 'Hebrew' },
    date: 'c. 200 CE (redaction)',
  }),
  work({
    id: 'mishnah-kiddushin',
    title: 'Mishnah, tractate Kiddushin',
    citeAs: 'm. Kiddushin',
    category: 'reception_history',
    collection: 'Mishnah',
    edition: { id: 'mishnah-standard', title: 'Mishnah, standard printed text', publisher: null, year: null, language: 'Hebrew' },
    date: 'c. 200 CE (redaction)',
  }),
  work({
    id: 'yerushalmi-bikkurim',
    title: 'Jerusalem Talmud, tractate Bikkurim',
    citeAs: 'y. Bikkurim',
    category: 'reception_history',
    collection: 'Jerusalem Talmud',
    edition: {
      id: 'venice-1523',
      title: 'Jerusalem Talmud, editio princeps',
      publisher: 'Daniel Bomberg, Venice',
      year: '1523',
      language: 'Hebrew and Aramaic',
    },
    date: 'c. 400 CE (redaction)',
  }),
  bavli('Bava Metzia'),
  bavli('Shabbat'),
  bavli('Yevamot'),
  bavli('Niddah'),
  bavli('Nedarim'),
  bavli('Megillah'),
  bavli('Temurah'),
  bavli('Yoma'),
  bavli('Sanhedrin'),
  bavli('Gittin'),
  work({
    id: 'mishneh-torah',
    title: 'Mishneh Torah',
    citeAs: 'Maimonides, Mishneh Torah',
    category: 'reception_history',
    collection: 'Medieval Jewish law and thought',
    edition: { id: 'mt-standard', title: 'Mishneh Torah, standard printed edition', publisher: null, year: null, language: 'Hebrew' },
    author: 'Moses Maimonides',
    date: 'c. 1180',
  }),
  work({
    id: 'maimonides-commentary-mishnah',
    title: 'Commentary on the Mishnah',
    citeAs: 'Maimonides, Commentary on the Mishnah',
    category: 'reception_history',
    collection: 'Medieval Jewish law and thought',
    edition: { id: 'cm-standard', title: 'Commentary on the Mishnah (Judeo-Arabic original; Hebrew translations)', publisher: null, year: null, language: 'Judeo-Arabic' },
    author: 'Moses Maimonides',
    date: 'c. 1168',
  }),
  work({
    id: 'maimonides-letter-obadiah',
    title: 'Letter to Obadiah the Proselyte',
    citeAs: 'Maimonides, Letter to Obadiah the Proselyte',
    category: 'reception_history',
    collection: 'Medieval Jewish law and thought',
    edition: { id: 'letters-standard', title: 'Responsa and letters, standard editions', publisher: null, year: null, language: 'Hebrew' },
    author: 'Moses Maimonides',
    date: '12th century',
  }),
  work({
    id: 'rashi-torah',
    title: 'Rashi’s commentary on the Torah',
    citeAs: 'Rashi on',
    category: 'reception_history',
    collection: 'Medieval Jewish law and thought',
    edition: { id: 'rashi-standard', title: 'Standard printed edition (Mikraot Gedolot)', publisher: null, year: null, language: 'Hebrew' },
    author: 'Rabbi Shlomo Yitzchaki (Rashi)',
    date: '11th century',
  }),

  /* Reception history — Christian */
  work({
    id: '1-clement',
    title: '1 Clement',
    citeAs: '1 Clement',
    category: 'reception_history',
    collection: 'Apostolic Fathers',
    edition: {
      id: 'holmes-2007',
      title: 'The Apostolic Fathers: Greek Texts and English Translations, ed. Michael W. Holmes, 3rd edition',
      publisher: 'Baker Academic, Grand Rapids',
      year: '2007',
      language: 'Greek',
    },
    date: 'c. 96 CE (conventional dating)',
  }),
  work({
    id: 'irenaeus-against-heresies',
    title: 'Against Heresies (Adversus haereses)',
    citeAs: 'Irenaeus, Against Heresies',
    category: 'reception_history',
    collection: 'Church Fathers',
    edition: {
      id: 'sc-211',
      title: 'Sources Chrétiennes 211 (Book III), ed. A. Rousseau and L. Doutreleau',
      publisher: 'Éditions du Cerf, Paris',
      year: '1974',
      language: 'Latin (with Greek fragments)',
    },
    author: 'Irenaeus of Lyon',
    date: 'c. 180 CE',
  }),
  work({
    id: 'philo-allegorical-interpretation',
    title: 'Allegorical Interpretation (Legum allegoriae)',
    citeAs: 'Philo, Leg. All.',
    aliases: ['Philo, Allegorical Interpretation'],
    category: 'historical_witness',
    collection: 'Second Temple literature',
    edition: {
      id: 'lcl-226',
      title: 'Philo, Volume I, Loeb Classical Library 226, trans. F. H. Colson and G. H. Whitaker',
      publisher: 'Harvard University Press',
      year: '1929',
      language: 'Greek',
    },
    author: 'Philo of Alexandria',
    date: 'early 1st century CE',
  }),
  work({
    id: 'council-of-trent',
    title: 'Canons and Decrees of the Council of Trent',
    citeAs: 'Council of Trent',
    category: 'reception_history',
    collection: 'Councils and magisterial documents',
    edition: { id: 'trent', title: 'Conciliorum Oecumenicorum Decreta', publisher: null, year: null, language: 'Latin' },
    date: '1545–1563',
  }),
  ...(
    [
      ['lumen-gentium', 'Lumen Gentium (Dogmatic Constitution on the Church)', 'Lumen Gentium', '1964'],
      ['dei-verbum', 'Dei Verbum (Dogmatic Constitution on Divine Revelation)', 'Dei Verbum', '1965'],
      ['nostra-aetate', 'Nostra Aetate (Declaration on the Relation of the Church to Non-Christian Religions)', 'Nostra Aetate', '1965'],
    ] as const
  ).map(([id, title, citeAs, year]) =>
    work({
      id,
      title,
      citeAs,
      category: 'reception_history',
      collection: 'Councils and magisterial documents',
      edition: {
        id: 'vatican-ii',
        title: 'Second Vatican Council, official Latin text (Acta Apostolicae Sedis)',
        publisher: 'Holy See',
        year,
        language: 'Latin',
      },
      author: 'Second Vatican Council',
      date: year,
    }),
  ),
  work({
    id: 'luther-christian-nobility',
    title: 'To the Christian Nobility of the German Nation',
    citeAs: 'Luther, To the Christian Nobility',
    category: 'reception_history',
    collection: 'Reformation writings',
    edition: {
      id: 'wa-6',
      title: 'D. Martin Luthers Werke (Weimarer Ausgabe), vol. 6',
      publisher: 'Hermann Böhlau, Weimar',
      year: '1888',
      language: 'German',
    },
    author: 'Martin Luther',
    date: '1520',
  }),
  work({
    id: 'westminster-confession',
    title: 'Westminster Confession of Faith',
    citeAs: 'Westminster Confession',
    category: 'reception_history',
    collection: 'Reformation writings',
    edition: { id: 'wcf-1646', title: 'Westminster Assembly text', publisher: null, year: '1646', language: 'English' },
    author: 'Westminster Assembly',
    date: '1646',
  }),

  /* Reception history — Islamic */
  work({
    id: 'tabari-tafsir',
    title: 'Jāmiʿ al-bayān ʿan taʾwīl āy al-Qurʾān',
    citeAs: 'al-Ṭabarī, Jāmiʿ al-bayān',
    category: 'reception_history',
    collection: 'Tafsīr',
    edition: { id: 'tabari-standard', title: 'Standard printed editions', publisher: null, year: null, language: 'Arabic' },
    author: 'Muḥammad ibn Jarīr al-Ṭabarī (d. 923)',
    date: 'early 10th century',
  }),
  work({
    id: 'ibn-kathir-tafsir',
    title: 'Tafsīr al-Qurʾān al-ʿaẓīm',
    citeAs: 'Ibn Kathīr, Tafsīr',
    category: 'reception_history',
    collection: 'Tafsīr',
    edition: { id: 'ibn-kathir-standard', title: 'Standard printed editions', publisher: null, year: null, language: 'Arabic' },
    author: 'Ismāʿīl ibn Kathīr (d. 1373)',
    date: '14th century',
  }),
  work({
    id: 'tabatabai-mizan',
    title: 'al-Mīzān fī tafsīr al-Qurʾān',
    citeAs: 'Ṭabāṭabāʾī, al-Mīzān',
    category: 'reception_history',
    collection: 'Tafsīr',
    edition: { id: 'mizan-standard', title: 'Standard printed editions', publisher: null, year: null, language: 'Arabic' },
    author: 'Muḥammad Ḥusayn Ṭabāṭabāʾī (d. 1981)',
    date: '20th century',
  }),
  work({
    id: 'ibn-hazm-fisal',
    title: 'al-Fiṣal fī al-milal wa-l-ahwāʾ wa-l-niḥal',
    citeAs: 'Ibn Ḥazm, al-Fiṣal',
    category: 'reception_history',
    collection: 'Kalām and polemic',
    edition: { id: 'fisal-standard', title: 'Standard printed editions', publisher: null, year: null, language: 'Arabic' },
    author: 'Ibn Ḥazm of Córdoba (d. 1064)',
    date: '11th century',
  }),

  /* Reception history — Latter-day Saint institutional */
  work({
    id: 'gospel-topics-apostasy',
    title: 'Gospel Topics: “Apostasy”',
    citeAs: 'Gospel Topics, “Apostasy”',
    category: 'reception_history',
    collection: 'Latter-day Saint institutional publications',
    edition: {
      id: 'gospel-topics',
      title: 'Gospel Topics (online reference)',
      publisher: 'The Church of Jesus Christ of Latter-day Saints',
      year: null,
      language: 'English',
    },
  }),

  /* Modern scholarship */
  work({
    id: 'njps-1985',
    title: 'Tanakh: The Holy Scriptures (New JPS translation)',
    citeAs: 'NJPS',
    category: 'modern_scholarship',
    collection: 'Modern translations',
    edition: { id: 'njps-1985', title: 'New Jewish Publication Society translation', publisher: 'Jewish Publication Society, Philadelphia', year: '1985', language: 'English' },
    date: '1985',
  }),
  work({
    id: 'halot',
    title: 'The Hebrew and Aramaic Lexicon of the Old Testament (HALOT)',
    citeAs: 'HALOT',
    category: 'modern_scholarship',
    collection: 'Lexica',
    edition: { id: 'halot', title: 'L. Koehler, W. Baumgartner et al., English edition', publisher: 'Brill, Leiden', year: '1994–2000', language: 'English' },
  }),
  work({
    id: 'bdag',
    title: 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature (BDAG)',
    citeAs: 'BDAG',
    category: 'modern_scholarship',
    collection: 'Lexica',
    edition: { id: 'bdag-3', title: 'W. Bauer, F. W. Danker et al., 3rd edition', publisher: 'University of Chicago Press', year: '2000', language: 'English' },
  }),
  work({
    id: 'lane-lexicon',
    title: 'An Arabic-English Lexicon',
    citeAs: 'Lane, Arabic-English Lexicon',
    category: 'modern_scholarship',
    collection: 'Lexica',
    edition: { id: 'lane', title: 'Edward William Lane, An Arabic-English Lexicon', publisher: 'Williams and Norgate, London', year: '1863–1893', language: 'English' },
  }),
  work({
    id: 'prince-1995',
    title: 'Power from On High: The Development of Mormon Priesthood',
    citeAs: 'Prince, Power from On High',
    category: 'modern_scholarship',
    collection: 'History of religions',
    edition: { id: 'prince-1995', title: 'First edition', publisher: 'Signature Books, Salt Lake City', year: '1995', language: 'English' },
    author: 'Gregory A. Prince',
    date: '1995',
  }),
  work({
    id: 'nickel-2011',
    title: 'Narratives of Tampering in the Earliest Commentaries on the Qurʾān',
    citeAs: 'Nickel, Narratives of Tampering',
    category: 'modern_scholarship',
    collection: 'History of religions',
    edition: { id: 'nickel-2011', title: 'First edition', publisher: 'Brill, Leiden', year: '2011', language: 'English' },
    author: 'Gordon D. Nickel',
    date: '2011',
  }),
  work({
    id: 'adang-1996',
    title: 'Muslim Writers on Judaism and the Hebrew Bible: From Ibn Rabban to Ibn Hazm',
    citeAs: 'Adang, Muslim Writers on Judaism',
    category: 'modern_scholarship',
    collection: 'History of religions',
    edition: { id: 'adang-1996', title: 'First edition', publisher: 'Brill, Leiden', year: '1996', language: 'English' },
    author: 'Camilla Adang',
    date: '1996',
  }),
  work({
    id: 'firestone-1990',
    title: 'Journeys in Holy Lands: The Evolution of the Abraham-Ishmael Legends in Islamic Exegesis',
    citeAs: 'Firestone, Journeys in Holy Lands',
    category: 'modern_scholarship',
    collection: 'History of religions',
    edition: { id: 'firestone-1990', title: 'First edition', publisher: 'State University of New York Press, Albany', year: '1990', language: 'English' },
    author: 'Reuven Firestone',
    date: '1990',
  }),
  work({
    id: 'hughes-2012',
    title: 'Abrahamic Religions: On the Uses and Abuses of History',
    citeAs: 'Hughes, Abrahamic Religions',
    category: 'modern_scholarship',
    collection: 'History of religions',
    edition: { id: 'hughes-2012', title: 'First edition', publisher: 'Oxford University Press, New York', year: '2012', language: 'English' },
    author: 'Aaron W. Hughes',
    date: '2012',
  }),
];

export const TRANSLATIONS: Translation[] = [
  {
    id: 'world-english-bible',
    name: 'World English Bible',
    publisher: 'eBible.org',
    year: '2020',
    license: 'Public domain.',
    verified: false,
  },
  {
    id: 'jps-1917',
    name: 'The Holy Scriptures According to the Masoretic Text (JPS 1917)',
    publisher: 'Jewish Publication Society of America',
    year: '1917',
    license: 'Public domain.',
    verified: false,
  },
  {
    id: 'esv-2016',
    name: 'English Standard Version (2016 text)',
    publisher: 'Crossway',
    year: '2016',
    license: 'Quoted under the publisher’s published quotation allowance, with attribution. Wording to be confirmed by an editor.',
    verified: false,
  },
  {
    id: 'editorial-literal',
    name: 'AbrahamMoses editorial literal rendering',
    publisher: null,
    year: null,
    license:
      'Literal working rendering made for the record from the cited edition. Not a published translation; consult the original language.',
    verified: false,
  },
];

/* ------------------------------------------------------------------ *
 * Reference resolution
 * ------------------------------------------------------------------ */

const ALIAS_INDEX: Array<{ alias: string; work: Work }> = WORKS.flatMap((w) =>
  [w.citeAs, ...w.aliases].map((alias) => ({ alias, work: w })),
).sort((a, b) => b.alias.length - a.alias.length);

const WORK_BY_ID = new Map(WORKS.map((w) => [w.id, w]));

export function workById(id: string): Work | undefined {
  return WORK_BY_ID.get(id);
}

/**
 * Parse a human citation into a structured reference.
 *
 * Throws on an unknown work. Called at module load for every reference in the
 * record, so a typo is a build failure, not a dead citation.
 */
export function ref(citation: string): Reference {
  const text = citation.trim();
  for (const { alias, work: w } of ALIAS_INDEX) {
    if (text === alias || text.startsWith(`${alias} `) || text.startsWith(`${alias},`)) {
      const locator = text.slice(alias.length).replace(/^[,\s]+/, '').trim();
      return { work: w.id, locator, display: text };
    }
  }
  throw new Error(`Unresolvable reference "${citation}": no work in the corpus registry matches it.`);
}

export function refs(...citations: string[]): Reference[] {
  return citations.map(ref);
}
