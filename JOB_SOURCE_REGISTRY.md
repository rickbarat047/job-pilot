# Job Source Registry

## Working adapters

- Greenhouse public job-board API
- Lever postings API
- Ashby posting API
- SmartRecruiters postings API
- Remotive, Himalayas and Jobicy remote-job APIs
- Manual job import

Verified ATS boards are defined in `src/lib/companies/registry.ts`.

## Documented unavailable sources

Indian portals such as Naukri, Indeed India, LinkedIn Jobs, Foundit, TimesJobs, Internshala, Freshersworld, Apna, Cutshort, Wellfound, Hirist, Instahyre, iimjobs, Shine, WorkIndia, National Career Service and Apprenticeship India do not provide unauthenticated public search APIs. They are registered as unavailable with official fallback search links and clear reasons.

## Adding a source

Implement `JobSourceAdapter`, normalize jobs with `buildNormalizedJob`, add it to `SOURCE_ADAPTERS`, and update the registry documentation.
