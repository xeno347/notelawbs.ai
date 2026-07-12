export type Judgment = {
  id: string;
  title: string;
  citation: string;
  court: string;
  year: number;
  topics: string[];
  headnote: string;
};

export const JUDGMENTS: Judgment[] = [
  {
    id: 'mc-mehta-1987',
    title: 'M.C. Mehta v. Union of India',
    citation: '(1987) 1 SCC 395',
    court: 'Supreme Court of India',
    year: 1987,
    topics: ['environment', 'pollution', 'tanneries', 'ganga', 'precautionary principle'],
    headnote:
      'The Supreme Court directed closure of tanneries discharging effluents into the Ganga, holding that industries cannot be permitted to operate at the cost of public health and ecology. Established the polluter-pays principle in Indian environmental jurisprudence.',
  },
  {
    id: 'vellore-citizen-1996',
    title: 'Vellore Citizens Welfare Forum v. Union of India',
    citation: '(1996) 5 SCC 647',
    court: 'Supreme Court of India',
    year: 1996,
    topics: ['environment', 'sustainable development', 'precautionary principle', 'polluter pays', 'tanneries'],
    headnote:
      'Recognised sustainable development, precautionary principle, and polluter-pays principle as part of Indian environmental law. Held that once ecological degradation is proved, the burden shifts to the polluter to show compliance with environmental norms.',
  },
  {
    id: 'indian-council-env-1996',
    title: 'Indian Council for Env-Legal Action v. Union of India',
    citation: '(1996) 3 SCC 212',
    court: 'Supreme Court of India',
    year: 1996,
    topics: ['environment', 'hazardous waste', 'remediation', 'polluter pays', 'chemical industry'],
    headnote:
      'Directed remediation of soil and groundwater contaminated by chemical industries in Bichhri. Affirmed that polluters must bear the cost of restoring the environment and compensating affected communities.',
  },
  {
    id: 'tn-godavarman-1996',
    title: 'T.N. Godavarman Thirumulpad v. Union of India',
    citation: '(1997) 2 SCC 267',
    court: 'Supreme Court of India',
    year: 1996,
    topics: ['forest', 'conservation', 'environment', 'felling', 'forest clearance'],
    headnote:
      "Expanded the definition of 'forest' under the Forest Conservation Act. Established continuous monitoring of forest cover and strict regulation of non-forest activities in forest areas without prior central approval.",
  },
  {
    id: 'l-chandra-kumar-1997',
    title: 'L. Chandra Kumar v. Union of India',
    citation: '(1997) 3 SCC 261',
    court: 'Supreme Court of India',
    year: 1997,
    topics: ['administrative tribunal', 'judicial review', 'constitutional', 'writ jurisdiction'],
    headnote:
      'Held that decisions of Tribunals are subject to judicial review by High Courts under Articles 226/227. Tribunals cannot be the final arbiters of constitutional validity; HC writ jurisdiction remains intact.',
  },
  {
    id: 'samatha-1997',
    title: 'Samatha v. State of Andhra Pradesh',
    citation: '(1997) 8 SCC 191',
    court: 'Supreme Court of India',
    year: 1997,
    topics: ['tribal', 'scheduled areas', 'mining', 'land rights', 'panchayat'],
    headnote:
      'Held that transfer of tribal land to non-tribals in Scheduled Areas is void. Mining leases in Scheduled Areas require compliance with the Fifth Schedule and Panchayat (Extension to Scheduled Areas) Act.',
  },
  {
    id: 'narmada-bachao-2000',
    title: 'Narmada Bachao Andolan v. Union of India',
    citation: '(2000) 10 SCC 664',
    court: 'Supreme Court of India',
    year: 2000,
    topics: ['environment', 'displacement', 'rehabilitation', 'dam', 'public interest litigation'],
    headnote:
      'Balanced development needs against environmental and rehabilitation concerns for the Sardar Sarovar Project. Emphasised that displacement must be accompanied by adequate rehabilitation and that cost-benefit analysis alone cannot override human rights.',
  },
  {
    id: 'intellectuals-forum-2006',
    title: 'Intellectuals Forum v. State of A.P.',
    citation: '(2006) 3 SCC 549',
    court: 'Supreme Court of India',
    year: 2006,
    topics: ['environment', 'wetland', 'lake', 'conservation', 'urban development'],
    headnote:
      'Directed protection of Hussain Sagar lake and surrounding wetlands from encroachment and pollution. Held that water bodies are ecologically sensitive and must be preserved against unauthorised construction.',
  },
  {
    id: 'central-empowerment-2011',
    title: 'Central Empowered Committee v. State of Karnataka',
    citation: '(2011) 12 SCC 758',
    court: 'Supreme Court of India',
    year: 2011,
    topics: ['mining', 'forest', 'illegal mining', 'bellary', 'environment'],
    headnote:
      'Imposed strict penalties for illegal mining in forest areas of Bellary. Reinforced that mining without environmental clearance and forest clearance is illegal and subject to cancellation and restoration orders.',
  },
  {
    id: 'goa-foundation-2014',
    title: 'Goa Foundation v. Union of India',
    citation: '(2014) 6 SCC 590',
    court: 'Supreme Court of India',
    year: 2014,
    topics: ['mining', 'environment', 'intergenerational equity', 'goa', 'mineral conservation'],
    headnote:
      'Suspended iron ore mining in Goa pending renewal of leases with proper environmental clearances. Applied intergenerational equity principle — current generation cannot exhaust natural resources to the detriment of future generations.',
  },
  {
    id: 'alembic-pharma-2020',
    title: 'Alembic Pharmaceuticals v. Rohit Prajapati',
    citation: '(2020) 13 SCC 265',
    court: 'Supreme Court of India',
    year: 2020,
    topics: ['environment', 'environmental clearance', 'ec', 'industry', 'compliance'],
    headnote:
      'Held that environmental clearance is mandatory before commencement of industrial operations. Post-facto clearance cannot legitimise operations that began without prior EC; strict compliance with EIA notification requirements is essential.',
  },
  {
    id: 'anuj-garg-2007',
    title: 'Anuj Garg v. Hotel Association of India',
    citation: '(2008) 3 SCC 1',
    court: 'Supreme Court of India',
    year: 2007,
    topics: ['discrimination', 'gender', 'constitutional', 'article 14', 'reasonable classification'],
    headnote:
      'Struck down a rule prohibiting women from working in premises where liquor is served. Applied the anti-stereotyping principle under Article 15 — laws based on gender stereotypes fail the test of reasonable classification.',
  },
  {
    id: 'subhash-kumar-1991',
    title: 'Subhash Kumar v. State of Bihar',
    citation: '(1991) 1 SCC 598',
    court: 'Supreme Court of India',
    year: 1991,
    topics: ['environment', 'right to life', 'article 21', 'pollution', 'water'],
    headnote:
      'Held that right to life under Article 21 includes the right to live in a pollution-free environment. Any person can move the court to prevent pollution — the right to a wholesome environment is a fundamental right.',
  },
  {
    id: 'cbse-rti-2011',
    title: 'CBSE v. Aditya Bandopadhyay',
    citation: '(2011) 8 SCC 497',
    court: 'Supreme Court of India',
    year: 2011,
    topics: ['rti', 'right to information', 'transparency', 'public authority', 'examination'],
    headnote:
      'Clarified the scope of RTI Act — evaluated answer sheets are not held in fiduciary capacity. Public authorities must furnish information unless specifically exempted; transparency is the rule, exemption the exception.',
  },
];
