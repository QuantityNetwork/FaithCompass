/**
 * The Tradition Layer.
 *
 * Each entry records what a tradition treats as authoritative and the
 * categories it uses for itself, so that comparisons can say when a tradition
 * is asking a different question rather than giving a different answer.
 *
 * Order follows historical emergence within each family. The record never
 * opens on one tradition's lens by default.
 */

import type { Tradition } from '../schema';

export const TRADITIONS: Tradition[] = [
  {
    id: 'rabbinic-judaism',
    name: 'Rabbinic Judaism',
    family: 'jewish',
    description:
      'The Judaism of the Mishnah, the Talmuds and the codes, in which the Written Torah is read through the Oral Torah received, by its own account, at Sinai.',
    authorities:
      'Tanakh; Mishnah and Talmuds; midrash; the codes (Mishneh Torah, Shulchan Arukh) and responsa.',
    nativeCategories: ['Torah she-bikhtav and Torah she-beʿal peh', 'brit', 'mitzvot', 'halakhah', 'peshat and derash'],
  },
  {
    id: 'catholic',
    name: 'Catholic',
    family: 'christian',
    description:
      'The Catholic Church, which receives Scripture and Sacred Tradition together, interpreted by the magisterium.',
    authorities: 'Old and New Testaments (with the deuterocanonical books); Sacred Tradition; councils and the magisterium.',
    nativeCategories: ['sacrament', 'apostolic succession', 'ministerial and common priesthood', 'typology', 'magisterium'],
  },
  {
    id: 'eastern-orthodox',
    name: 'Eastern Orthodox',
    family: 'christian',
    description:
      'The Orthodox churches in communion with one another, for which Scripture is read within the living Tradition of the Church and its councils.',
    authorities: 'Scripture (with the Septuagint as the received Old Testament); the seven ecumenical councils; the Fathers; liturgy.',
    nativeCategories: ['Holy Tradition', 'apostolic succession', 'mystery (sacrament)', 'theosis', 'typology'],
  },
  {
    id: 'lutheran',
    name: 'Lutheran',
    family: 'christian',
    description: 'Churches of the Lutheran Reformation, confessing the Book of Concord.',
    authorities: 'Old and New Testaments as the norm of doctrine; the Lutheran Confessions as its faithful exposition.',
    nativeCategories: ['law and gospel', 'justification by faith', 'priesthood of all the baptized', 'means of grace'],
  },
  {
    id: 'reformed',
    name: 'Reformed',
    family: 'christian',
    description: 'Churches of the Reformed tradition, shaped by the Reformed confessions and covenant theology.',
    authorities: 'Old and New Testaments; the Reformed confessions (e.g. Westminster, Heidelberg, Belgic) as subordinate standards.',
    nativeCategories: ['covenant of grace', 'sola scriptura', 'law: moral, ceremonial and civil', 'priesthood of believers'],
  },
  {
    id: 'evangelical',
    name: 'Evangelical',
    family: 'christian',
    description:
      'A transdenominational Protestant movement emphasising biblical authority, conversion and the atoning work of Christ.',
    authorities: 'Old and New Testaments as the final authority.',
    nativeCategories: ['biblical authority', 'conversion', 'atonement', 'priesthood of all believers'],
  },
  {
    id: 'dispensational',
    name: 'Dispensational',
    family: 'christian',
    description:
      'A Protestant hermeneutical system that distinguishes successive dispensations and keeps Israel and the church distinct in God’s purposes.',
    authorities: 'Old and New Testaments, read with a consistently literal hermeneutic.',
    nativeCategories: ['dispensations', 'Israel and the church', 'literal hermeneutic', 'future restoration of Israel'],
  },
  {
    id: 'sunni-islam',
    name: 'Sunni Islam',
    family: 'islamic',
    description:
      'The majority Muslim tradition, reading the Qurʾān with the sunna of the Prophet as transmitted in the canonical ḥadīth collections and the schools of law.',
    authorities: 'The Qurʾān; the sunna (ḥadīth); scholarly consensus (ijmāʿ); the legal schools; tafsīr.',
    nativeCategories: ['waḥy (revelation)', 'nubuwwa and risāla', 'millat Ibrāhīm', 'sharīʿa', 'naskh', 'taḥrīf'],
  },
  {
    id: 'shia-islam',
    name: 'Shiʿi Islam',
    family: 'islamic',
    description:
      'The Muslim tradition that holds leadership after the Prophet to belong to divinely designated Imams from his family; principally Twelver (Imāmī) Shiʿism in this record.',
    authorities: 'The Qurʾān; the sunna as transmitted through the Prophet’s family and the Imams; Shiʿi tafsīr and jurisprudence.',
    nativeCategories: ['imāma', 'ʿiṣma (protection from error)', 'waḥy', 'nubuwwa', 'millat Ibrāhīm'],
  },
  {
    id: 'latter-day-saint',
    name: 'Latter-day Saint',
    family: 'latter-day-saint',
    description:
      'The Church of Jesus Christ of Latter-day Saints, which holds that priesthood authority and an open canon were restored through Joseph Smith.',
    authorities:
      'The Bible (“as far as it is translated correctly”), the Book of Mormon, the Doctrine and Covenants and the Pearl of Great Price; continuing revelation through living prophets.',
    nativeCategories: ['Restoration', 'priesthood keys', 'Aaronic and Melchizedek priesthood', 'ordinances and covenants', 'Apostasy'],
  },
  {
    id: 'historical-critical',
    name: 'Historical-critical scholarship',
    family: 'scholarly',
    description:
      'A method rather than a tradition: texts are read first in their historical setting, and confessional claims are set aside for the purpose of analysis without being judged.',
    authorities: 'Critical editions, comparative evidence and peer-reviewed scholarship.',
    nativeCategories: ['original context', 'reception history', 'redaction', 'textual criticism'],
  },
];
