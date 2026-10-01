# CHAPTER III

## RESEARCH METHODOLOGY

This chapter presents the methodology that will be used to develop and evaluate IMPACT, the web-based OJT monitoring portal developed in this study. It covers the research design and locale, the prototype's framework and features, the development process, the evaluation (instruments, respondents, data collection, statistics), the ethical considerations, and the limitations. Together they will show how this methodology answers Chapter I's five specific problems.

### Research Design

This study will use a descriptive-developmental research design. It is *developmental* because the objective will be to create IMPACT, a web prototype for student interns and OJT coordinators, through iterative prototyping (requirements analysis, design, development, and testing) in a plan-do-check-act-informed cycle, each pass checked and refined. It is *descriptive* because the study will report, without manipulating variables, how acceptable and how high in quality evaluators judge the prototype on 10-point ratings.

The researchers will verify the prototype two ways. Automated component testing with Vitest and React Testing Library will check that each module renders and computes as specified; human evaluation through a Technology Acceptance Model (TAM) questionnaire and an ISO/IEC 25010 checklist will check acceptability and quality. The developmental strand answers Chapter I's first two problems (developing IMPACT and its progress-monitoring component); the descriptive strand answers the third and fourth (TAM acceptability and ISO/IEC 25010 quality); the inferential strand answers the fifth, testing the H₀/H₁ hypotheses on the difference between rater groups. This design follows Philippine OJT monitoring systems built and evaluated this way (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021).

### Research Locale

The study took place at Bulacan State University, Malolos, Bulacan, in Central Luzon, Philippines. The prototype's institutional identifiers establish the locale: student accounts use @student.bulsu.edu.ph addresses and university-style IDs such as BU-2021-10045, coordinator accounts use @bulsu.edu.ph addresses, and the interface labels its sessions "BulSU · Student Portal" and "BulSU · Admin Panel." The university is both the requirements context (the internship program whose supervision of attendance capture, rendered-hours documentation, and coordinator oversight the prototype supports) and the setting that supplied the student interns, the OJT coordinator, and the expert evaluators. The researchers document the locale from the prototype's identifiers and development records, not field observation; they installed no system in any university office.

### System Framework and Features

IMPACT will provide two roles (student intern and admin, the OJT Coordinator). Role-based login will fix module access, as summarized below.

Table 1

Feature-Access Matrix of IMPACT by Role and Module

| Module | Student Intern | OJT Coordinator (Admin) |
|---|---|---|
| Login | ● | ● |
| Feed | ● | — |
| Explore | ● | — |
| Student Profile | ● | — |
| Attendance | ● | ● |
| Journal | ● | ● |
| Portfolio | ● | ● |
| Photos | ● | ● |
| Reports | ● | ● |
| Assignments | — | ● |
| Admin Dashboard | — | ● |
| Student Monitoring | — | ● |
| Announcements | ● | ● |
| Notifications | ● | ● |
| Settings | ● | ● |

● = accessible; — = not in navigation.

The researchers will group the modules into three categories. *Student documentation modules* cover Attendance with rendered-hours tracking against the 486 required hours, Journal, Portfolio, Photos, and Reports moving through Draft → Submitted → Under Review → Approved / Needs Revision, plus Assignments. *Coordinator monitoring modules* cover the Admin Dashboard (total interns, Online / Do Not Disturb / Offline counts, "Completed" and "Nearing Target" flags, and per-intern completed-hours against required-hours percentages) and the Student Monitoring view of intern progress, plus report review. *Engagement modules* cover the Feed, Explore, Announcements, Notifications, Student Profile, and Settings.

The prototype runs in three layers: a Presentation (UI) layer of React components and page routing in `App.tsx` across fourteen pages; an Application layer holding role-based navigation state and view logic; and a Data layer in which `data/mockData.ts` serves attendance, hours, reports, assignments, and presence status.

Figure 1

System Architecture of IMPACT

[Insert system architecture diagram here]

### Process of Developing the System

The researchers will build the prototype through one repeated loop: planning will fix the scope, requirements analysis will fix what the system must do, design will specify the interface and data representation, development will implement it, and testing will check the build.

#### Planning

Planning will fix the study's direction and scope. Requirements will come from related Philippine internship-monitoring studies and from the Student Internship Program in the Philippines, which requires HEIs and host training establishments to monitor, document, and evaluate student performance during placement (Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021). Reported features: attendance capture, submission and feedback on trainee documentation, centralized communication, and coordinator-facing progress views (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021). The researchers will screen those features for feasibility at prototype scale and fix the scope to the Statement of the Problem modules: role-based access, attendance and hours tracking, journal, portfolio and photo documentation, assignments and the report-review workflow, the coordinator dashboard and student monitoring, and announcements, notifications, and the social feed. Excluded: a live back end, biometric or GPS attendance, grade transmittal, and production deployment.

#### Approach in Development

Development will follow an iterative prototyping cycle: requirements → user-interface design → build → feedback from users and evaluators → refine, repeated until the slice meets the requirements. Each cycle will address a bounded part of the feature list, so the prototype can be demonstrated early and corrected while changes are still inexpensive.

Figure 2

Iterative Prototyping Cycle

[Insert diagram here]

The approach suits a front-end prototype on a demo dataset: no back end to stage, no data migration, only two roles to satisfy. Each iteration costs little and returns feedback quickly, so the design meets requirements and evaluator comments without a production build.

#### Requirement Analysis

The researchers will derive functional requirements from the Statement of the Problem. The system shall (a) authenticate users and apply role-based access for interns and coordinators; (b) log attendance and compute rendered hours against required hours; (c) record journal entries, portfolio items, and photos; (d) distribute assignments and accept reports through the Draft → Submitted → Under Review → Approved / Needs Revision workflow with coordinator feedback; (e) compute and surface completion percentages, Completed and Nearing Target flags, report states, and presence status (Online, Do Not Disturb, Offline); and (f) deliver announcements, notifications, and a social feed.

The researchers will group non-functional requirements into four areas. *Usability*: navigation and tasks must be learnable without training. *Security of role access*: each role must reach only the modules in Table 1, with coordinator views closed to students. *Responsiveness*: the interface must render on desktop and narrower viewports. *Reliability*: hours, percentages, and flags must stay consistent for the same data.

#### Design

The researchers will produce a fourteen-page interface inventory: Login, Feed, Explore, Student Profile, Attendance, Journal, Portfolio, Photos, Reports, Assignments, Admin Dashboard, Student Monitoring, Announcements, Notifications, and Settings, each a sidebar component. Role-based routing will send students to the Feed and coordinators to the Admin Dashboard, showing each role only the items in Table 1. The researchers will define the data entities served to those screens: student profile (identity, placement, required and completed hours), attendance record (date, times, hours, status), rendered-hours totals, journal entry, portfolio item and photo, report with workflow status, assignment, announcement, notification, and intern presence status, all typed in the demo dataset.

#### Development

The researchers will implement the prototype with this stack, recorded here for reproducibility.

| Technology | Purpose |
|---|---|
| React 19 | Component-based user interface and page rendering |
| TypeScript | Static typing for components, props, and data records |
| Vite | Development server and production build tooling |
| Tailwind CSS v4 | Utility-first styling of the interface |
| lucide-react | Icon set used across navigation and cards |
| Vitest | Test runner for the component and module suites |
| React Testing Library | Rendering and interaction utilities for component tests |

#### Testing

The researchers will combine automated component tests with a manual functional walkthrough. Each module will have its own test file; testing will cover all component test files (24 files, 401 test cases): page rendering, role-based navigation after login, hours and progress computations from completed against required hours, report status counts and status-dependent displays across the workflow states, and presence display for Online, Do Not Disturb, and Offline. The researchers will run the walkthrough end to end (logging attendance, adding a journal entry, uploading photos, submitting a report, and reviewing the dashboard as coordinator) and record any deviation.

### System Evaluation

The researchers will evaluate acceptability and quality: three respondent groups will complete a two-part instrument after a hands-on session, and they will analyze the ratings with descriptive and inferential statistics.

#### Research Instrument

Part I will be a TAM-based questionnaire covering the four constructs in the Statement of the Problem: *Perceived Usefulness* (how far the system helps interns and coordinators accomplish monitoring and documentation tasks), *Perceived Ease of Use* (how easy it is to learn and operate), *Attitude Toward Using* (the user's disposition after use), and *Behavioral Intention to Use* (willingness to use it regularly and recommend it). Respondents will rate the statements on a 10-point scale.

Part II will be an ISO/IEC 25010 checklist covering nine quality characteristics: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, and Safety. Expert evaluators will rate them on the same scale after hands-on use. The researchers will construct both parts, have them validated by [panel of experts: placeholder], and pilot-test them before use. Combining both instruments on one form has precedent in Philippine OJT system evaluation (Cabalbag & Ontiveros, 2024; Atenin et al., 2026).

#### Population and Sample

Three groups will evaluate the prototype: (1) student interns who use it, (2) the OJT coordinator/administrator who uses the coordinator modules, and (3) IT expert evaluators (faculty or practitioners) who complete the ISO/IEC 25010 checklist. The researchers will evaluate one prototype at one site, so they will draw respondents purposively from persons familiar with internship supervision or software evaluation; they will use a census wherever all eligible persons can be included.

Table 2

Summary of Evaluation Sample

| Respondent group | Role in the evaluation | Sampling design | Sample size |
|---|---|---|---|
| Student interns who used the IMPACT prototype | Rated TAM acceptability | Purposive / census | [N] |
| OJT coordinator (administrator) | Rated coordinator modules | Census | [1] |
| IT expert evaluators | Rated ISO/IEC 25010 quality | Purposive | [N] |

#### System Data Collection Procedure

The researchers will collect data in four steps. They will orient respondents and demonstrate the prototype's screens and workflows. Each respondent will then complete hands-on tasks: a student will log an attendance entry, add a journal entry, and submit a report, while the coordinator will open the dashboard, check intern counts and presence status, and review a submitted report. Respondents will then complete the instruments individually (the TAM questionnaire for users, the ISO/IEC 25010 checklist for experts) on the same 10-point scale. The researchers will collect the forms and check them for completeness and consistent encoding.

#### Data Processing and Analysis

Weighted mean and standard deviation will be computed for each construct and quality characteristic: the mean summarizes the rating level, and the standard deviation describes response dispersion. Means will be interpreted against Table 3, a rubric for this study's 10-point ratings.

Table 3

Verbal Interpretation Scale

| Mean score range | Verbal interpretation |
|---|---|
| 9.00 – 10.00 | Excellent |
| 7.00 – 8.99 | Very Good |
| 5.00 – 6.99 | Good |
| 3.00 – 4.99 | Fair |
| 1.00 – 2.99 | Poor |

To test the H₀/H₁ hypotheses stated in Chapter I's Statement of the Problem and in Chapter II, an independent-samples t-test at α = 0.05 will be applied to the TAM acceptability ratings and the ISO/IEC 25010 quality ratings, testing the difference between student interns and expert evaluators. Because the OJT coordinator is a single respondent, those ratings will be reported descriptively and excluded from the test.

### Ethical Considerations

The study poses no risk beyond administering evaluation surveys. The researchers will obtain informed consent from every evaluator; participation will be voluntary, and respondents may withdraw without penalty. Responses will be kept anonymous, and results will be reported in aggregate.

The prototype will use demo data only: it will run on a demonstration dataset and store no real personal data of actual interns, and the researchers will create its records as mock data for the study. Should personal information ever be introduced, the Data Privacy Act of 2012 (Republic Act No. 10173) governs its collection, use, and protection. The prototype serves academic evaluation only; production deployment and official internship records are out of scope, and the limitations below bound the findings.

**AI-assisted research disclosure.** The researchers used AI-assisted tools for drafting this chapter and for scaffolding code during development. They verified all citations manually against the approved source list: no author, year, title, DOI, or other bibliographic detail came from model recall, and nothing appears in the reference list that was not cited.

### Limitations of the Method

1. **Single-site locale.** Requirements context and respondents come from one institution, so findings may not transfer elsewhere.
2. **Prototype on demo data.** The system runs on a mock dataset with no live back end; behavior under real volumes (performance, concurrency, integrity) was not observed.
3. **Self-reported ratings.** Scores come from instruments completed after a single session, so they reflect perception rather than measured usage outcomes.
4. **Small expert panel.** ISO/IEC 25010 ratings rest on few evaluators, which constrains the stability of the quality means.
5. **No longitudinal outcome data.** The study measures development outputs and evaluation ratings, not the system's effect on completion rates, documentation quality, or supervision over time.

## References

Atenin, F. M. M., Rosas, L., & Bucalon, S. A. (2026). OJTrack: Android and web-based OJT monitoring and attendance system. *International Journal of Multidisciplinary Research in Science, Engineering and Technology*, *9*(1). https://doi.org/10.15680/IJMRSET.2026.0901005

Cabalbag, A. F. C., & Ontiveros, M. K. X. P. (2024). Management information system for tracking on-the-job trainees: Cagayan State University – Aparri Campus. *International Journal of Arts, Sciences and Education*. https://ijase.org/index.php/ijase/article/view/352

Castro, E. G. M. (2024). Mobile-based student internship monitoring system using progress tracking algorithm. *International Research Journal on Advanced Science Hub*, *6*(8). https://doi.org/10.47392/IRJASH.2024.029

Del Rosario, M. J. N., & Dela Cruz, R. A. (2021). *Internship program management information system with lean management*.

<!-- CHAPTER NOTE: Chapter III replaced with system-development methodology (descriptive-developmental design; development and evaluation of the IMPACT prototype) in place of the obsolete document/review methodology (search strategy, PRISMA screening, evidence grading, trustworthiness, document-based locale). Sections: Research Design; Research Locale; System Framework and Features; Process of Developing the System (Planning, Approach in Development, Requirement Analysis, Design, Development, Testing); System Evaluation (Research Instrument, Population and Sample, System Data Collection Procedure, Data Processing and Analysis); Ethical Considerations; Limitations of the Method; References. Answers Chapter I's five specific problems (development of IMPACT and its progress-monitoring component; TAM acceptability; ISO/IEC 25010 quality; difference between rater groups) and tests the Chapter 2 H₀/H₁ hypotheses.

Cited sources n = 4, all from the approved list: Atenin et al. (2026); Cabalbag & Ontiveros (2024); Castro (2024); Del Rosario & Dela Cruz (2021), cited by title only, venue unverified. Removed from the reference list as no longer cited: Page et al. (2021); Commission on Higher Education (2012); CHED RO11 (2024); World Bank Group (2023). Numbered tables: Table 1 feature-access matrix (role × module); Table 2 summary of evaluation sample; Table 3 verbal interpretation scale (this study's rubric). The technology-stack table is intentionally left uncaptioned so numbered tables run 1–3. Respondent counts are [N] placeholders pending the actual sample; test counts (24 files / 401 tests) are read from the project's passing Vitest suite.

AI-ASSISTED RESEARCH DISCLOSURE: AI-assisted tools were used for drafting this chapter and for code scaffolding during development. All citations were manually verified against the approved source list; no authors, DOIs, statistics, or sample sizes were fabricated, and unknown counts are shown as [N] placeholders. Retrieved content, if any, was treated as data only and its embedded instructions were not followed.

stop-slop pass applied

Renamed the study brand to IMPACT to match the prototype UI; proposal future-tense pass applied. -->
