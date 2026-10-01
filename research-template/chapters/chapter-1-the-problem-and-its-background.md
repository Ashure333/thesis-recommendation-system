# CHAPTER I

## THE PROBLEM AND ITS BACKGROUND

Chapter I sets out the background of the problem, the statement of the problem, the significance of the study, the scope and delimitation, and the definition of key terms for IMPACT. It provides the policy and practice context behind the system and states the study's objective and questions.

### Introduction

Philippine higher education runs quality assurance at two levels. At the external level, accrediting agencies and networks evaluate institutions against sector standards: the National Network of Quality Assurance Agencies (NNQAA), Federation of Accrediting Agencies of the Philippines (FAAP), AACCUP, PAASCU, and PACUCOA. At the internal level, the Commission on Higher Education (CHED) positions internal quality assurance (IQA) as the starting point for quality within outcomes-based education, program typology, and the Institutional Sustainability Assessment (ISA), the national self-evaluation instrument covering five key result areas and an ICT indicator (Commission on Higher Education, 2012; World Bank Group, 2023). Monitoring connects the two levels: CHED's Office of Institutional Quality Assurance and Governance (OIQAG) monitors quality management in higher education institutions (HEIs), maintains a quality assurance database linked to its Management Information System (MIS), and reviews quality monitoring reports (CHED, n.d.-a).

Internal monitoring is the daily layer beneath policy: the routines institutions use to collect evidence, check conformity, and drive improvement. Philippine studies document QMS practices, internal audit, and monitoring-and-evaluation tools inside that layer (Calairo, 2025; Grate-Paltiguera & Gabion, 2026; Roque & Ulanday-Lozano, 2024). Coordinators work inside a documentation culture that expects auditable records.

The second strand is the supervision of student internships. Under the Student Internship Program in the Philippines (SIPP) framework of CHED Memorandum Order (CMO) No. 104, s. 2017, HEIs and hosts must monitor, document, and evaluate student performance during placement (Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021). Internship monitoring runs throughout placement, follows individual students, and spans external hosts, so developers have built systems in response. Documented responses include a lean-management-based internship MIS (Del Rosario & Dela Cruz, 2021); a web-based MIS with online submission, grade computation, and feedback at Cagayan State University-Aparri Campus (Cabalbag & Ontiveros, 2024); a mobile system with global positioning system (GPS) clock-in/clock-out (Castro, 2024); and an Android-and-web OJT system using quick response (QR) code attendance, one-time password (OTP) validation, and artificial intelligence (AI)-assisted reports (Atenin et al., 2026). The pandemic reshaped supervision: a Philippine mixed-methods study treated online internships as situated, bounded, and inclusive learning across 129 evaluations, 11 key informant interviews, and 110 reflection papers (Opiniano, 2024). This internship and OJT strand is the problem the present study addresses.

Research on both strands has moved from policy handbooks to prototypes evaluated with ISO/IEC 25010 and technology acceptance models (Cabalbag & Ontiveros, 2024; Castro, 2024; *Key informants' perception on records digitization*, 2025). Supervision runs on manual logbooks and paper-based Daily Time Records that researchers call time-consuming and inconsistent (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021). Documented systems cover parts of the workflow: attendance verification, report submission, grade computation, feedback loops, traceable documentation. Supervision stays dispersed across those parts. This study will develop and evaluate a web-based prototype that consolidates them.

National mandates form a sequence that starts in 2012, when CHED's companion handbook to CMO No. 46, s. 2012 codified outcomes-based education and program typology, introduced the ISA framework, and declared internal quality assurance the starting point for quality in every HEI (Commission on Higher Education, 2012). Infrastructure mandates followed: HEMIS under CMO No. 45, s. 2016 (CHED RO11, 2024), the Enrollment Data Collection System (EDCS) (CHED, n.d.-b), and Higher Education Institution Data Analytics (HEIDA), version 2 (CHED, 2024). Together they form a national monitoring stack.

Published evaluations set IMPACT's benchmark. Del Rosario and Dela Cruz (2021) reported an overall ISO/IEC 25010 mean of 4.32 for a lean-management internship MIS at Laguna State Polytechnic University; Cabalbag and Ontiveros (2024) evaluated their web-based MIS-OJT with ISO standards and the Technology Acceptance Model; Castro (2024) combined GPS location, clock in/out, and parent-agency linkage and evaluated the system with ISO/IEC 25010 (n = 30); and Atenin et al. (2026) reported the cluster's highest mean (M = 4.83, overall ISO/IEC 25010) for QR attendance, OTP validation, and AI-assisted report generation.

The quality assurance strand shows the same progression. Rodriguez et al. (2018) established the TQM paradigm for Philippine higher education; Roque and Ulanday-Lozano (2024), in an embedded mixed-method design, documented Region XII QMS practices; Calairo (2025), in a mixed-method multi-case design, developed an IQA model for two private universities, mapping SWOT findings onto the ten AQAF IQA principles and naming monitoring-and-evaluation tools the key instrument; Dando and Santillan (2025) integrated PQA criteria with ISO 9001:2015 PDCA at Camarines Norte State College for audit efficiency; Grate-Paltiguera and Gabion (2026) surveyed 160 QM coordinators and internal quality auditors across seven Western Visayas SUCs, reporting ISO 9001:2015 implementation (M = 4.59) and effectiveness (M = 4.40); and SUC stakeholders assessed the first web-based digitized-records accreditation platform using ISO/IEC 25010 and thematic analysis (*Key informants' perception on records digitization*, 2025).

A 2023 World Bank assessment characterized the QA landscape, the ISA self-evaluation structure, and Philippine HEIs' digital maturity (World Bank Group, 2023). In July 2026, CHED and ASEAN partners convened more than 200 SUC leaders at Marikina Polytechnic College for the first workshop on universities' IQA implementation using the AUN-QA IQA Management Toolkit v1.3; the country counts 2,364 HEIs serving approximately 5.5 million students (Marikina Polytechnic College, 2026). National data systems, accreditation platforms, IQA toolkits, and internship tracking applications advance in parallel while internship supervision rests on manual, dispersed records. The mismatch sets the context for a consolidated monitoring platform.

That platform is IMPACT, the web-based on-the-job training monitoring portal developed in this study for student interns and their OJT coordinators, subtitled *IMPACT: A Web-Based Monitoring Platform for Student Internship Programs*. IMPACT is a website built with React 19, TypeScript, Vite, and Tailwind CSS v4 and tested with Vitest and React Testing Library. Role-based login separates student and admin (OJT Coordinator) accounts using Bulacan State University identifiers: BU-2021-10045 and @student.bulsu.edu.ph (students), admin@bulsu.edu.ph (coordinators).

IMPACT consolidates the records that internship supervision used to scatter: a social feed, explore page, and student profile; attendance against 486 required hours with a progress bar; a daily journal, portfolio, and photos; assignments; reports moving through Draft → Submitted → Under Review → Approved / Needs Revision; and notifications, announcements, and settings. Coordinators get an admin dashboard showing total interns, online / do not disturb / offline counts, "Completed" and "Nearing Target" flags, and per-intern completed-hours percentages, plus a student monitoring view with progress percentages. The prototype runs on mock records: Maria Santos, BS Information Technology 4th year, Junior Web Developer Intern at TechVentures Philippines Inc., June 5 to August 30, 2025 (312 of 486 hours completed). The study will develop and evaluate IMPACT on two measures: acceptability under the Technology Acceptance Model (perceived usefulness, perceived ease of use, attitude toward using, behavioral intention to use) and quality under the nine ISO/IEC 25010 characteristics.

### Statement of the Problem

Student internships remain a required component of Philippine higher education programs. Supervision of those placements continues to run on manual logbooks, paper-based Daily Time Records, and signed accomplishment arrangements, which researchers describe as time-consuming, prone to data inconsistency, and difficult to coordinate across interns, coordinators, and host training establishments (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021). Under the Student Internship Program in the Philippines (SIPP) framework of CHED Memorandum Order (CMO) No. 104, s. 2017, HEIs and their host training establishments must monitor, document, and evaluate student performance during placement (as referenced in Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021). Philippine systems in the literature answer with online submission and grade computation, GPS clock-in and clock-out, and QR-code attendance with one-time password (OTP) validation (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024). Intern supervision continues to spread across off-campus hosts, and the documented systems leave attendance, documentation, and coordinator oversight in separate places.

This study therefore will develop and evaluate IMPACT to serve as a usable, reliable monitoring and documentation platform for student interns, addressing the following specific questions:

1. How can IMPACT be developed as a web-based monitoring website that incorporates core functionalities to support the supervision and documentation of student interns, specifically through:

   1.1 role-based access for student interns and OJT coordinators,

   1.2 attendance logging with rendered-hours tracking against required internship hours,

   1.3 daily journal entries, photo documentation, and portfolio records,

   1.4 assignment distribution and report submission with coordinator review and feedback,

   1.5 a coordinator-facing dashboard for monitoring intern progress and presence status, and

   1.6 in-platform announcements, notifications, and a social feed that sustain intern engagement during deployment?

2. How can a progress-monitoring component for IMPACT be developed to support internship supervision by computing and surfacing the following indicators:

   2.1 rendered-hours completion relative to required internship hours,

   2.2 per-intern progress percentages with completion status flags (completed, nearing target),

   2.3 report-submission workflow states (draft, submitted, under review, approved, needs revision), and

   2.4 intern presence status (online, do not disturb, offline)?

3. How acceptable is IMPACT under the Technology Acceptance Model (TAM), considering:

   3.1 Perceived Usefulness,

   3.2 Perceived Ease of Use,

   3.3 Attitude Toward Using, and

   3.4 Behavioral Intention to Use?

4. How well does IMPACT meet ISO/IEC 25010 quality requirements, considering:

   4.1 Functional Suitability,

   4.2 Performance Efficiency,

   4.3 Compatibility,

   4.4 Interaction Capability,

   4.5 Reliability,

   4.6 Security,

   4.7 Maintainability,

   4.8 Flexibility, and

   4.9 Safety?

5. Is there a significant difference between the assessments of student interns and expert evaluators on:

   5.1 the acceptability of IMPACT in terms of perceived usefulness, perceived ease of use, attitude toward using, and behavioral intention to use, and

   5.2 the quality of IMPACT in terms of functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, and safety?

To answer the fifth question, this study tests the following hypotheses:

H₀: There is no significant difference in the assessments of student interns and expert evaluators on the acceptability of IMPACT in terms of perceived usefulness, perceived ease of use, attitude toward using, and behavioral intention to use.

H₁: There is a significant difference in the assessments of student interns and expert evaluators on the acceptability of IMPACT in terms of perceived usefulness, perceived ease of use, attitude toward using, and behavioral intention to use.

H₀: There is no significant difference in the assessments of student interns and expert evaluators on the quality of IMPACT in terms of functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, and safety.

H₁: There is a significant difference in the assessments of student interns and expert evaluators on the quality of IMPACT in terms of functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, and safety.

### Significance of the Study

This study will benefit the following parties:

**Student interns.** IMPACT gives interns one platform to log attendance, document rendered hours, keep a daily journal, build a portfolio with photos, and submit reports through a review workflow, replacing dispersed logbooks and paper-based Daily Time Records (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2021).

**OJT coordinators and faculty supervisors.** The dashboard and student monitoring view let supervisors track presence status, per-intern rendered-hours percentages, and completed or nearing-target flags, and review reports for revision. The scope grounds functional requirements against documented deployments: GPS clock-in, QR-plus-OTP validation, grade computation (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024).

**College administrators and quality-assurance personnel.** IMPACT consolidates attendance, hours, journals, portfolios, and reports into auditable documentation aligned with SIPP expectations and IQA reporting routines; documented IQA instruments and monitoring-and-evaluation tools inform evidence-based selection of monitoring arrangements (Calairo, 2025; Dando & Santillan, 2025). Quality-assurance personnel, CHED, OIQAG, and accrediting agencies gain a consolidated picture of internship documentation readiness alongside ISA self-evaluation, HEMIS-linked data flows, and accreditation record digitization (CHED, n.d.-a; CHED RO11, 2024; *Key informants' perception on records digitization*, 2025).

**State universities and colleges and other HEIs.** The prototype offers a reference implementation institutions can adapt for local use, alongside reported ISO 9001:2015 results across Western Visayas SUCs and toolkit-oriented IQA adoption among more than 200 SUC leaders (Grate-Paltiguera & Gabion, 2026; Marikina Polytechnic College, 2026).

**Faculty researchers, graduate students, and future researchers.** The study will contribute a reference prototype and evaluation instrument (TAM acceptability items and ISO/IEC 25010 quality items), with methodological patterns that reduce duplication and clarify thin outcome evidence (Roque & Ulanday-Lozano, 2024; World Bank Group, 2023).

### Scope and Delimitation

This development study sets the following parameters.

**Scope.** The study will cover the design, development, and evaluation of IMPACT, a web-based monitoring platform for student interns and OJT coordinators. Functional scope: (a) role-based access for student interns and OJT coordinators; (b) attendance logging and rendered-hours tracking against required internship hours; (c) daily journal entries, photo documentation, and portfolio records; (d) assignment distribution and report submission with coordinator review and feedback; (e) a coordinator-facing dashboard and student monitoring view for intern progress and presence status; and (f) in-platform announcements, notifications, and a social feed. Evaluation will cover acceptability under the Technology Acceptance Model (perceived usefulness, perceived ease of use, attitude toward using, behavioral intention to use) and quality under the nine ISO/IEC 25010 characteristics: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, and Safety. The locale is Bulacan State University, Malolos, Bulacan, with evaluation respondents specified in Chapter III. National policy documents and CHED information systems (HEMIS, EDCS, HEIDA, OIQAG mandates) supply governance context and fall outside the evaluation.

**Delimitations.** The prototype runs on a demonstration dataset of mock records, with no live back end and no real student personal data. The study will exclude production deployment; integration with third-party host-company systems; biometric, GPS, or QR-code hardware attendance; grade transmittal to the registrar; and payroll or human-resource functions. The related-studies background covers the literature gathered for this study, and the findings will apply to the evaluated prototype and its respondents. This study will not judge CHED policy nor re-assess the documented systems cited here, and it will reproduce reported means without recomputing them.

### Definition of Terms

The study defines key terms operationally as follows.

**CMO (CHED Memorandum Order).** Refers to the formal issuance through which CHED sets policy for HEIs; the CMOs governing this study are No. 46, s. 2012 (typology, outcomes-based education, ISA), No. 45, s. 2016 (HEMIS data collection), and No. 104, s. 2017 (SIPP) (Commission on Higher Education, 2012; CHED RO11, 2024).

**Continuous Quality Improvement (CQI).** Refers to the improvement loop in which monitoring and audit findings turn into corrective and preventive action through the PDCA cycle and, in one case, integration with PQA criteria (Dando & Santillan, 2025).

**External Quality Assurance (EQA).** Refers to the out-of-institution evaluation that agencies and networks such as NNQAA, FAAP, AACCUP, PAASCU, and PACUCOA perform, consuming the evidence internal monitoring produces (World Bank Group, 2023).

**HEMIS, EDCS, and HEIDA.** Refers to CHED's national information infrastructure: HEMIS is the centralized mandate requiring annual institutional data reporting under CMO No. 45, s. 2016, as documented for SY 2024-2025 (CHED RO11, 2024); EDCS centralizes real-time enrollment reporting (CHED, n.d.-b); HEIDA is the version 2 analytics portal with offline and mobile data collection (CHED, 2024).

**IMPACT.** Refers to the web-based prototype to be developed in this study, which consolidates attendance and rendered-hours tracking, journaling, portfolio and photo documentation, report submission and review, assignment tracking, and coordinator-facing progress monitoring for student interns.

**Institutional Sustainability Assessment (ISA).** Refers to CHED's national self-evaluation instrument in which HEIs assess five key result areas with an embedded ICT indicator (World Bank Group, 2023; Commission on Higher Education, 2012).

**Internal monitoring.** Refers to the recurring, institution-run process of collecting evidence on defined indicators, checking conformity with internal standards, and feeding results into reporting cycles (Calairo, 2025; Roque & Ulanday-Lozano, 2024). It spans IQA routines (performance monitoring, data quality management, internal audit) and intern/OJT routines (attendance, documentation, trainee evaluation). IMPACT supports both sets of routines.

**Internal Quality Assurance (IQA).** Refers to the institution-level system of planning, implementing, evaluating, and improving quality, which CHED's framework treats as the starting point for quality and structures around outcomes-based education, typology, and self-evaluation (Commission on Higher Education, 2012). IQA is the documentation context for IMPACT's coordinator-facing records.

**ISO 9001:2015 and ISO/IEC 25010.** Refers to two standards: Philippine HEIs and their internal quality auditors apply the former to manage quality (Dando & Santillan, 2025; Grate-Paltiguera & Gabion, 2026); this study will use the latter, the software product quality standard, to evaluate IMPACT, and researchers report it for most of the systems cited here (Atenin et al., 2026; Castro, 2024; Del Rosario & Dela Cruz, 2021).

**On-the-Job Training (OJT) and internship.** Refers to the off-campus, work-immersion component of Philippine higher education programs in which a host training establishment places students under the SIPP framework of CMO No. 104, s. 2017, which, as referenced in the literature, requires HEIs and hosts to monitor, document, and evaluate student performance (Cabalbag & Ontiveros, 2024; Castro, 2024). Both labels describe IMPACT's primary problem domain: person-level supervision of these placements.

**Quality Management System (QMS) and internal quality audit.** Refers to the documented organizational framework an HEI uses to manage quality processes; QM coordinators and internal quality auditors carry out its verification component, the internal quality audit, under ISO 9001:2015 (Grate-Paltiguera & Gabion, 2026; Roque & Ulanday-Lozano, 2024). Note: "IQA" may mean *internal quality audit*; this document uses it for internal quality assurance.

<!-- AI-Assisted Research Disclosure: AI-assisted literature retrieval and chapter drafting were used in the preparation of this document. All citations are restricted to the approved source corpus supplied for this study; no sources were fabricated.
Renamed SIP → IMPACT to match prototype UI; proposal future-tense pass applied. -->

<!-- Source notes: (1) The 2025 "Key informants' perception on records digitization..." study is cited by title because authors could not be verified; no authors were invented. (2) Del Rosario and Dela Cruz (2021) is cited without a journal name because venue metadata is unconfirmed. (3) CMO No. 104, s. 2017 (SIPP) content is attributed to the SIPP framework as referenced in the approved internship studies, not quoted directly. (4) No approved corpus source was dropped; all 18 corpus entries are cited. (5) Chapter reframed to system-development format (IMPACT prototype); all corpus citations retained.
Renamed SIP → IMPACT to match prototype UI; proposal future-tense pass applied. -->

<!-- stop-slop pass applied -->
