export type AtsType = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "career-page";

export interface CompanyRegistryEntry {
  name: string;
  slug: string;
  website: string;
  careersUrl: string;
  industry: string;
  location: string;
  size: string;
  stage: string;
  description: string;
  ats?: { type: AtsType; identifier: string };
  verified: boolean;
  tags: string[];
}

/**
 * Curated company registry.
 *
 * - Entries with `ats` have been verified against the public ATS API and are
 *   actively polled by the discovery engine.
 * - `verified: false` entries are company/careers-page targets only. We never
 *   claim they have open roles until a live adapter or career-page check finds one.
 */
export const COMPANY_REGISTRY: CompanyRegistryEntry[] = [
  // Verified public ATS boards (live-checked during build)
  {
    name: "Groww", slug: "groww", website: "https://groww.in", careersUrl: "https://groww.in/careers",
    industry: "FinTech", location: "Bengaluru, India", size: "1,001–5,000", stage: "Growth",
    description: "Investment platform serving millions of Indian retail investors.",
    ats: { type: "greenhouse", identifier: "groww" }, verified: true, tags: ["fintech", "consumer", "bengaluru"],
  },
  {
    name: "Meesho", slug: "meesho", website: "https://www.meesho.io", careersUrl: "https://www.meesho.io/jobs",
    industry: "E-commerce", location: "Bengaluru, India", size: "1,001–5,000", stage: "Late stage",
    description: "Democratising internet commerce for Bharat; social commerce and logistics at scale.",
    ats: { type: "lever", identifier: "meesho" }, verified: true, tags: ["ecommerce", "logistics", "bengaluru"],
  },
  {
    name: "CRED", slug: "cred", website: "https://cred.club", careersUrl: "https://careers.cred.club",
    industry: "FinTech", location: "Bengaluru, India", size: "501–1,000", stage: "Late stage",
    description: "Members-only credit card bill payment and rewards platform.",
    ats: { type: "lever", identifier: "cred" }, verified: true, tags: ["fintech", "consumer", "bengaluru"],
  },
  {
    name: "Zeta", slug: "zeta", website: "https://www.zeta.tech", careersUrl: "https://www.zeta.tech/careers",
    industry: "FinTech", location: "Bengaluru, India", size: "1,001–5,000", stage: "Late stage",
    description: "Banking technology platform for issuers and processors.",
    ats: { type: "lever", identifier: "zeta" }, verified: true, tags: ["fintech", "banking", "bengaluru"],
  },
  {
    name: "FamPay", slug: "fampay", website: "https://fampay.in", careersUrl: "https://fampay.in/careers",
    industry: "FinTech", location: "Bengaluru, India", size: "201–500", stage: "Series B",
    description: "Teen-focused payments and banking app.",
    ats: { type: "lever", identifier: "fampay" }, verified: true, tags: ["fintech", "consumer", "startup"],
  },
  {
    name: "Paytm", slug: "paytm", website: "https://paytm.com", careersUrl: "https://paytm.com/careers",
    industry: "FinTech", location: "Noida, India", size: "5,000+", stage: "Public",
    description: "Payments, lending, commerce and financial services platform.",
    ats: { type: "lever", identifier: "paytm" }, verified: true, tags: ["fintech", "payments", "noida"],
  },
  {
    name: "Mindtickle", slug: "mindtickle", website: "https://www.mindtickle.com", careersUrl: "https://www.mindtickle.com/careers",
    industry: "SaaS", location: "Pune, India", size: "501–1,000", stage: "Series D",
    description: "Sales readiness and revenue productivity platform.",
    ats: { type: "lever", identifier: "mindtickle" }, verified: true, tags: ["saas", "sales-tech", "pune"],
  },
  {
    name: "Atlan", slug: "atlan", website: "https://atlan.com", careersUrl: "https://atlan.com/careers",
    industry: "Data & AI", location: "India (remote-first)", size: "201–500", stage: "Series C",
    description: "Data catalog and context layer for enterprise AI.",
    ats: { type: "ashby", identifier: "atlan" }, verified: true, tags: ["data", "ai", "remote", "startup"],
  },
  {
    name: "Bosch Group", slug: "bosch-group", website: "https://www.bosch.in", careersUrl: "https://www.bosch.in/careers",
    industry: "Automotive & Engineering", location: "Bengaluru, India", size: "10,000+", stage: "Enterprise",
    description: "Global supplier of automotive technology, industrial technology and consumer goods.",
    ats: { type: "smartrecruiters", identifier: "BoschGroup" }, verified: true, tags: ["automotive", "engineering", "manufacturing"],
  },
  {
    name: "Continental", slug: "continental", website: "https://www.continental.com", careersUrl: "https://www.continental.com/en/career",
    industry: "Automotive & Engineering", location: "Bengaluru, India", size: "10,000+", stage: "Enterprise",
    description: "Automotive technology company focused on mobility, tyres and software.",
    ats: { type: "smartrecruiters", identifier: "Continental" }, verified: true, tags: ["automotive", "engineering", "manufacturing"],
  },
  {
    name: "Swiggy", slug: "swiggy", website: "https://www.swiggy.com", careersUrl: "https://www.swiggy.com/careers",
    industry: "E-commerce", location: "Bengaluru, India", size: "5,000+", stage: "Public",
    description: "On-demand food and grocery delivery platform.",
    ats: { type: "smartrecruiters", identifier: "Swiggy" }, verified: true, tags: ["ecommerce", "logistics", "bengaluru"],
  },
  {
    name: "Freshworks", slug: "freshworks", website: "https://www.freshworks.com", careersUrl: "https://www.freshworks.com/company/careers",
    industry: "SaaS", location: "Chennai, India", size: "5,000+", stage: "Public",
    description: "Customer engagement and IT service management software.",
    ats: { type: "smartrecruiters", identifier: "Freshworks" }, verified: true, tags: ["saas", "support", "chennai"],
  },

  // Automotive, manufacturing and engineering career-page targets
  ...[
    ["Tata Motors", "https://www.tatamotors.com", "https://www.tatamotors.com/careers/", "Automotive & Engineering", "Mumbai, India", "10,000+", "Enterprise", "Indian automotive manufacturer across passenger, commercial and electric vehicles."],
    ["Maruti Suzuki", "https://www.marutisuzuki.com", "https://www.marutisuzuki.com/corporate/careers", "Automotive & Engineering", "Gurugram, India", "10,000+", "Enterprise", "India's largest passenger vehicle manufacturer."],
    ["Mahindra & Mahindra", "https://www.mahindra.com", "https://www.mahindra.com/careers", "Automotive & Engineering", "Mumbai, India", "10,000+", "Enterprise", "Automotive, farm equipment and mobility group."],
    ["Royal Enfield", "https://www.royalenfield.com", "https://www.royalenfield.com/in/en/careers/", "Automotive & Engineering", "Chennai, India", "5,001–10,000", "Enterprise", "Motorcycle manufacturer with global design and manufacturing operations."],
    ["Ather Energy", "https://www.atherenergy.com", "https://www.atherenergy.com/careers", "EV & Mobility", "Bengaluru, India", "1,001–5,000", "Series E", "Electric scooter manufacturer and charging network."],
    ["Ola Electric", "https://www.olaelectric.com", "https://www.olaelectric.com/careers", "EV & Mobility", "Bengaluru, India", "1,001–5,000", "Public", "Electric vehicle manufacturer focused on scooters and cells."],
    ["TVS Motor", "https://www.tvsmotor.com", "https://www.tvsmotor.com/careers", "Automotive & Engineering", "Chennai, India", "10,000+", "Enterprise", "Two- and three-wheeler manufacturer with global operations."],
    ["Hero MotoCorp", "https://www.heromotocorp.com", "https://www.heromotocorp.com/en-in/careers.html", "Automotive & Engineering", "New Delhi, India", "5,001–10,000", "Enterprise", "World's largest two-wheeler manufacturer."],
    ["Bajaj Auto", "https://www.bajajauto.com", "https://www.bajajauto.com/careers", "Automotive & Engineering", "Pune, India", "10,000+", "Enterprise", "Two- and three-wheeler manufacturer and exporter."],
    ["Ashok Leyland", "https://www.ashokleyland.com", "https://www.ashokleyland.com/careers", "Automotive & Engineering", "Chennai, India", "10,000+", "Enterprise", "Commercial vehicle manufacturer."],
    ["Hyundai Motor India", "https://www.hyundai.com/in", "https://www.hyundai.com/in/en/company/careers", "Automotive & Engineering", "Chennai, India", "5,001–10,000", "Enterprise", "Passenger vehicle manufacturer with a large Chennai plant."],
    ["Kia India", "https://www.kia.com/in", "https://www.kia.com/in/careers.html", "Automotive & Engineering", "Anantapur, India", "1,001–5,000", "Enterprise", "Passenger vehicle manufacturer."],
    ["Mercedes-Benz India", "https://www.mercedes-benz.co.in", "https://www.mercedes-benz.co.in/passengercars/careers.html", "Automotive & Engineering", "Pune, India", "1,001–5,000", "Enterprise", "Luxury vehicle manufacturing and sales."],
    ["BMW India", "https://www.bmw.in", "https://www.bmw.in/en/careers.html", "Automotive & Engineering", "Chennai, India", "501–1,000", "Enterprise", "Luxury vehicle assembly and sales."],
    ["Toyota Kirloskar Motor", "https://www.toyotabharat.com", "https://www.toyotabharat.com/careers/", "Automotive & Engineering", "Bengaluru, India", "5,001–10,000", "Enterprise", "Passenger vehicle manufacturing joint venture."],
    ["Honda Cars India", "https://www.hondacarindia.com", "https://www.hondacarindia.com/careers", "Automotive & Engineering", "Greater Noida, India", "5,001–10,000", "Enterprise", "Passenger vehicle manufacturer."],
    ["Renault India", "https://www.renault.co.in", "https://www.renault.co.in/careers.html", "Automotive & Engineering", "Chennai, India", "1,001–5,000", "Enterprise", "Passenger vehicle manufacturing and sales."],
    ["Nissan India", "https://www.nissan.in", "https://www.nissan.in/careers.html", "Automotive & Engineering", "Chennai, India", "1,001–5,000", "Enterprise", "Vehicle manufacturing and mobility operations."],
    ["Volkswagen India", "https://www.volkswagen.co.in", "https://www.volkswagen.co.in/en/careers.html", "Automotive & Engineering", "Pune, India", "1,001–5,000", "Enterprise", "Passenger vehicle manufacturing."],
    ["Skoda Auto India", "https://www.skoda-auto.co.in", "https://www.skoda-auto.co.in/careers", "Automotive & Engineering", "Pune, India", "1,001–5,000", "Enterprise", "Passenger vehicle manufacturing and sales."],
    ["Stellantis India", "https://www.stellantis.com", "https://www.stellantis.com/en/careers", "Automotive & Engineering", "Chennai, India", "10,000+", "Enterprise", "Global automaker with engineering and digital operations in India."],
    ["Cummins India", "https://www.cummins.com", "https://www.cummins.com/careers", "Industrial & Energy", "Pune, India", "10,000+", "Enterprise", "Engines, power generation and components."],
    ["Schaeffler India", "https://www.schaeffler.co.in", "https://www.schaeffler.co.in/en/careers", "Industrial & Energy", "Pune, India", "10,000+", "Enterprise", "Precision components and bearings for mobility and industry."],
    ["ZF India", "https://www.zf.com", "https://www.zf.com/careers", "Automotive & Engineering", "Pune, India", "10,000+", "Enterprise", "Driveline, chassis and safety technology supplier."],
    ["Valeo India", "https://www.valeo.com", "https://www.valeo.com/en/careers/", "Automotive & Engineering", "Chennai, India", "10,000+", "Enterprise", "Automotive supplier focused on electrification and ADAS."],
    ["Magna India", "https://www.magna.com", "https://www.magna.com/careers", "Automotive & Engineering", "Pune, India", "10,000+", "Enterprise", "Mobility technology and automotive supplier."],
    ["Motherson", "https://www.motherson.com", "https://www.motherson.com/careers", "Automotive & Engineering", "Noida, India", "10,000+", "Enterprise", "Global automotive components and modules manufacturer."],
    ["Sona Comstar", "https://www.sonacomstar.com", "https://www.sonacomstar.com/careers", "Automotive & Engineering", "Gurugram, India", "5,001–10,000", "Public", "Automotive technology and driveline components."],
    ["Uno Minda", "https://www.unominda.com", "https://www.unominda.com/careers", "Automotive & Engineering", "Gurugram, India", "5,001–10,000", "Public", "Automotive switches, lighting and acoustic components."],
    ["Varroc", "https://www.varroc.com", "https://www.varroc.com/careers", "Automotive & Engineering", "Pune, India", "5,001–10,000", "Public", "Automotive lighting, electronics and polymer components."],
    ["Tata Elxsi", "https://www.tataelxsi.com", "https://www.tataelxsi.com/careers", "Engineering Services", "Bengaluru, India", "5,001–10,000", "Enterprise", "Design and technology services for automotive, media and healthcare."],
    ["KPIT Technologies", "https://www.kpit.com", "https://www.kpit.com/careers/", "Engineering Services", "Pune, India", "5,001–10,000", "Public", "Automotive software and mobility engineering."],
    ["LTTS", "https://www.ltts.com", "https://www.ltts.com/careers", "Engineering Services", "Bengaluru, India", "10,000+", "Enterprise", "Engineering research and development services."],
    ["Tata Technologies", "https://www.tatatechnologies.com", "https://www.tatatechnologies.com/careers/", "Engineering Services", "Pune, India", "5,001–10,000", "Public", "Product engineering and digital services."],
  ].map(([name, website, careersUrl, industry, location, size, stage, description]) => ({
    name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    website, careersUrl, industry, location, size, stage, description,
    verified: false, tags: ["career-page", industry.toLowerCase().split(" ")[0]],
  })),

  // IT services and consulting
  ...[
    ["Infosys", "https://www.infosys.com", "https://www.infosys.com/careers.html", "IT Services", "Bengaluru, India", "10,000+", "Public"],
    ["Tata Consultancy Services", "https://www.tcs.com", "https://www.tcs.com/careers", "IT Services", "Mumbai, India", "10,000+", "Public"],
    ["Wipro", "https://www.wipro.com", "https://careers.wipro.com", "IT Services", "Bengaluru, India", "10,000+", "Public"],
    ["HCLTech", "https://www.hcltech.com", "https://www.hcltech.com/careers", "IT Services", "Noida, India", "10,000+", "Public"],
    ["Accenture India", "https://www.accenture.com/in-en", "https://www.accenture.com/in-en/careers", "Consulting", "Mumbai, India", "10,000+", "Enterprise"],
    ["Cognizant", "https://www.cognizant.com", "https://careers.cognizant.com/global/en", "IT Services", "Chennai, India", "10,000+", "Public"],
    ["Capgemini India", "https://www.capgemini.com/in-en", "https://www.capgemini.com/in-en/careers/", "Consulting", "Mumbai, India", "10,000+", "Enterprise"],
    ["Deloitte India", "https://www2.deloitte.com/in", "https://www2.deloitte.com/in/en/careers.html", "Consulting", "Mumbai, India", "10,000+", "Enterprise"],
    ["EY India", "https://www.ey.com/en_in", "https://www.ey.com/en_in/careers", "Consulting", "Mumbai, India", "10,000+", "Enterprise"],
    ["PwC India", "https://www.pwc.in", "https://www.pwc.in/careers.html", "Consulting", "Mumbai, India", "10,000+", "Enterprise"],
    ["KPMG India", "https://kpmg.com/in", "https://kpmg.com/in/en/home/careers.html", "Consulting", "Mumbai, India", "10,000+", "Enterprise"],
  ].map(([name, website, careersUrl, industry, location, size, stage]) => ({
    name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    website, careersUrl, industry, location, size, stage,
    description: `${industry} organisation hiring across technology, operations and business functions.`,
    verified: false, tags: ["career-page", "enterprise"],
  })),

  // Startup and growth-stage career-page targets
  ...[
    ["Zomato / Eternal", "https://www.eternal.com", "https://www.eternal.com/careers", "Consumer Internet", "Gurugram, India", "5,000+", "Public", "Food delivery, quick commerce and hyperlocal commerce."],
    ["Zepto", "https://www.zeptonow.com", "https://www.zeptonow.com/careers", "Quick Commerce", "Mumbai, India", "5,000+", "Late stage", "10-minute quick commerce platform."],
    ["Porter", "https://porter.in", "https://porter.in/careers", "Logistics", "Bengaluru, India", "1,001–5,000", "Late stage", "On-demand intra-city logistics marketplace."],
    ["Delhivery", "https://www.delhivery.com", "https://www.delhivery.com/careers", "Logistics", "Gurugram, India", "10,000+", "Public", "Integrated logistics and supply-chain services."],
    ["Shiprocket", "https://www.shiprocket.in", "https://www.shiprocket.in/careers/", "Logistics", "Gurugram, India", "1,001–5,000", "Late stage", "E-commerce shipping and fulfilment platform."],
    ["Nykaa", "https://www.nykaa.com", "https://www.nykaa.com/careers", "E-commerce", "Mumbai, India", "5,000+", "Public", "Beauty and fashion commerce platform."],
    ["PhonePe", "https://www.phonepe.com", "https://www.phonepe.com/careers/", "FinTech", "Bengaluru, India", "5,000+", "Late stage", "Payments and financial services platform."],
    ["Razorpay", "https://razorpay.com", "https://razorpay.com/jobs/", "FinTech", "Bengaluru, India", "1,001–5,000", "Late stage", "Payments and business banking platform."],
    ["Jupiter", "https://jupiter.money", "https://jupiter.money/careers/", "FinTech", "Bengaluru, India", "501–1,000", "Series C", "Digital banking and money management app."],
    ["Navi", "https://navi.com", "https://navi.com/careers", "FinTech", "Bengaluru, India", "1,001–5,000", "Late stage", "Lending, insurance and mutual funds platform."],
    ["slice", "https://www.sliceit.com", "https://www.sliceit.com/careers", "FinTech", "Bengaluru, India", "501–1,000", "Late stage", "Consumer payments and credit products."],
    ["Urban Company", "https://www.urbancompany.com", "https://www.urbancompany.com/careers", "Consumer Services", "Gurugram, India", "1,001–5,000", "Late stage", "Home services marketplace."],
    ["Cars24", "https://www.cars24.com", "https://www.cars24.com/careers/", "Auto Commerce", "Gurugram, India", "5,000+", "Late stage", "Used-car marketplace and auto finance."],
    ["Spinny", "https://www.spinny.com", "https://www.spinny.com/careers/", "Auto Commerce", "Gurugram, India", "1,001–5,000", "Late stage", "Used-car retail platform."],
    ["Acko", "https://www.acko.com", "https://www.acko.com/careers/", "InsurTech", "Bengaluru, India", "1,001–5,000", "Late stage", "Digital insurance provider."],
    ["Policybazaar", "https://www.policybazaar.com", "https://www.policybazaar.com/careers/", "InsurTech", "Gurugram, India", "5,000+", "Public", "Insurance comparison and distribution platform."],
    ["Lenskart", "https://www.lenskart.com", "https://www.lenskart.com/careers", "Retail", "Gurugram, India", "5,000+", "Late stage", "Omnichannel eyewear retailer."],
    ["boAt", "https://www.boat-lifestyle.com", "https://www.boat-lifestyle.com/pages/careers", "Consumer Electronics", "Mumbai, India", "501–1,000", "Late stage", "Audio and wearable consumer brand."],
    ["Mamaearth", "https://mamaearth.in", "https://mamaearth.in/careers", "FMCG", "Gurugram, India", "1,001–5,000", "Public", "Personal care and beauty brand."],
    ["Wakefit", "https://www.wakefit.co", "https://www.wakefit.co/careers", "Consumer Products", "Bengaluru, India", "501–1,000", "Late stage", "Sleep and home solutions brand."],
    ["Zetwerk", "https://www.zetwerk.com", "https://www.zetwerk.com/careers", "Manufacturing", "Bengaluru, India", "1,001–5,000", "Late stage", "Contract manufacturing marketplace."],
    ["OfBusiness", "https://www.ofbusiness.com", "https://www.ofbusiness.com/careers", "B2B Commerce", "Gurugram, India", "1,001–5,000", "Late stage", "B2B raw material and credit platform."],
    ["Khatabook", "https://khatabook.com", "https://khatabook.com/careers", "SMB SaaS", "Bengaluru, India", "501–1,000", "Series C", "Digital ledger and fintech for small businesses."],
    ["Postman", "https://www.postman.com", "https://www.postman.com/company/careers/", "Developer Tools", "Bengaluru, India", "1,001–5,000", "Late stage", "API collaboration platform with a large India presence."],
    ["BrowserStack", "https://www.browserstack.com", "https://www.browserstack.com/careers", "Developer Tools", "Mumbai, India", "1,001–5,000", "Late stage", "Cloud testing platform."],
    ["HackerRank", "https://www.hackerrank.com", "https://www.hackerrank.com/careers", "HR Tech", "Bengaluru, India", "501–1,000", "Late stage", "Developer assessment platform."],
  ].map(([name, website, careersUrl, industry, location, size, stage, description]) => ({
    name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    website, careersUrl, industry, location, size, stage, description,
    verified: false, tags: ["career-page", "startup", stage.toLowerCase()],
  })),
];

export function atsEntries(): CompanyRegistryEntry[] {
  return COMPANY_REGISTRY.filter((c) => c.ats);
}

export function findRegistryCompany(nameOrSlug: string): CompanyRegistryEntry | undefined {
  const key = nameOrSlug.toLowerCase();
  return COMPANY_REGISTRY.find((c) => c.slug === key || c.name.toLowerCase() === key || (c.ats && c.ats.identifier.toLowerCase() === key));
}

export const ATS_DOCS: Record<string, string> = {
  greenhouse: "https://developers.greenhouse.io/job-board.html",
  lever: "https://github.com/lever/postings-api",
  ashby: "https://developers.ashbyhq.com/docs/public-job-posting-api",
  smartrecruiters: "https://developers.smartrecruiters.com/docs/partners",
};
