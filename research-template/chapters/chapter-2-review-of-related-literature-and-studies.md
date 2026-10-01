# CHAPTER II

## REVIEW OF RELATED LITERATURE AND STUDIES

IMPACT, the web-based OJT monitoring portal developed in this study, draws on three bodies of work for its design, development, and evaluation: the documentation and continuous-improvement duties that internal quality assurance imposes on Philippine HEIs, the attendance, journal, report, and coordination features already present in Philippine OJT systems, and the evaluation instruments used in comparable deployments, namely the Technology Acceptance Model (TAM) and ISO/IEC 25010. The chapter reviews theories, literature, and studies under five themes, then offers a synthesis, a gap analysis restated as design requirements, a conceptual framework, and hypotheses.

### Related Theories

The theoretical backbone of IMPACT's design is the continuous quality improvement cycle. Rodriguez et al.'s (2018) total quality management (TQM) paradigm for higher education in the Philippines remains the seminal local articulation of continuous improvement, customer orientation, and fact-based decision-making for Philippine HEIs (Rodriguez et al., 2018). The Commission on Higher Education's *Handbook on Typology, Outcomes-Based Education, and Institutional Sustainability Assessment* (Commission on Higher Education [CHED], 2012) translates that paradigm into an institutional instrument, a *plan–implement–assess–transform* quality assurance cycle that defines QA maturity along four observable dimensions: institutionalization, documentation, extent of implementation, and quality outcomes (CHED, 2012). Monitoring works as a plan–do–check–act loop whose observable unit is documented evidence of corrective action, so IMPACT records attendance and hours, journal entries, portfolio artifacts, and report states on one dashboard.

Supervision rests on a separate frame. Opiniano's (2024) study of pandemic-induced online internships in a journalism school theorizes them as situated, bounded, and inclusive learning through situated learning theory, boundary theories, and inclusive education (Opiniano, 2024). Situated and boundary learning treats internship competence as acquired in a community of practice spanning the boundary between the HEI and its partner agency. IMPACT must render that boundary visible and verifiable. Because the internship happens off-campus, IMPACT sustains engagement and documentation through announcements, notifications, and a social feed, alongside journal and photo records.

A third theory supplies the evaluative lens. Cabalbag and Ontiveros (2024) evaluate a management information system for tracking OJT trainees through four technology acceptance constructs (perceived usefulness, perceived ease of use, attitude toward using, and behavioral intention to use), applied alongside ISO standards (Cabalbag & Ontiveros, 2024). The same constructs structure IMPACT's acceptability evaluation, third research question, and first hypothesis pair.

### Related Literature

IMPACT's documentary requirements come from three sources: CHED policy architecture, national information infrastructure, and the quality-management frameworks that give monitoring its procedural form.

#### Policy and Infrastructure Foundations of Internal Monitoring in Philippine HEIs

The conceptual anchor is the Commission on Higher Education's *Handbook on Typology, Outcomes-Based Education, and Institutional Sustainability Assessment* (Commission on Higher Education [CHED], 2012), companion to CMO No. 46, s. 2012. The handbook fuses outcomes-based education with typology-based quality assurance and prescribes a *plan–implement–assess–transform* cycle. It specifies the Institutional Sustainability Assessment (ISA) along five key result areas and defines internal QA maturity along four dimensions: institutionalization, documentation, extent of implementation, and quality outcomes (CHED, 2012). An abstract obligation turns into observable states, and IMPACT exploits those states.

Two dimensions explain why Philippine monitoring converged on records and data systems: documentation and implementation extent. The World Bank's *Digital Transformation of Philippine Higher Education* (World Bank Group, 2023) places that convergence inside the country's external quality assurance (EQA) architecture: CHED-recognized accrediting bodies (NNQAA, AACCUP, ALCUCOA), FAAP agencies (PAASCU, PACUCOA, ACSCU-ACI), and the ISA's self-evaluation. Identifying ICT use as a core quality indicator, the report presents a digital maturity survey showing uneven sector capacity (World Bank Group, 2023).

At the regulator's level, monitoring runs through CHED's Office of Institutional Quality Assurance and Governance (OIQAG), which maintains a QA database linked to CHED's Management Information System (Commission on Higher Education, n.d.-a). Data collection runs through the Higher Education Management Information System (HEMIS); CMO 45, s. 2016 mandates its annual collection for SY 2024–2025, and institutions discharge that collection through institutional forms (CHED RO11, 2024); the Enrollment Data Collection System (EDCS) handles real-time validated enrollment submissions (Commission on Higher Education, n.d.-b); and the Higher Education Institution Data Analytics (HEIDA) portal adds analytics capacity (Commission on Higher Education, 2024). IMPACT mirrors this at intern level.

CHED has also built policy capacity. In July 2026, CHED and ASEAN partners convened more than 200 state university and college (SUC) leaders, 231 in all, for the first workshop on universities' IQA implementation utilizing the AUN-QA IQA Management Toolkit v1.3 (Marikina Polytechnic College, 2026). The same account frames the scale of the task: 2,364 HEIs serving approximately 5.5 million students (Marikina Polytechnic College, 2026). ASEAN benchmarking has regionalized QA monitoring alongside CHED's national compliance regime.

#### Quality-Management Frameworks, Standards, and the Seminal TQM Paradigm

Management paradigms give monitoring its internal logic. Rodriguez et al.'s (2018) TQM paradigm remains the local reference point for continuous improvement, customer orientation, and fact-based decision-making in Philippine HEIs. Later ISO- and audit-centered studies inherit its vocabulary: measurement, feedback loops, improvement (Rodriguez et al., 2018). Two operative frameworks set the standard for internal monitoring: ISO 9001:2015's plan–do–check–act (PDCA) architecture and CHED's AQAF-based self-assessment. CHED's outcomes-based, typology-based, data-driven QA regime governs monitoring from outside (CHED, 2012; World Bank Group, 2023); standards requiring documented corrective action govern it from within.

### Related Studies

#### Local Studies

All studies reviewed here are Philippine-based.

##### Policy and Infrastructure Foundations: Documented Implementation

Implementation evidence takes the form of operational records: the HEMIS annual data collection cycle for SY 2024–2025 with its institutional forms and regional orientations (CHED RO11, 2024); the HEIDA portal's second release, adding historical, API-accessible analytics and offline/mobile collection (Commission on Higher Education, 2024); and EDCS's real-time validated enrollment tracking (Commission on Higher Education, n.d.-b). The July 2026 AUN-QA toolkit workshop enrolled 231 SUC leaders in a structured IQA exercise on eight building blocks (Marikina Polytechnic College, 2026). The infrastructure runs in real time with validation, yet no source reports outcome data on HEI-level behavior.

##### Internal Quality Assurance, ISO 9001:2015, and Internal Audit Practice

The densest strand covers internal QA and audit. Calairo (2025) used a mixed-method multi-case design across two Lasallian private universities. The study reports AQAF's ten principles at advanced levels, applies SWOT analysis and monitoring tools as IQA instruments, and proposes a synthesized model. Roque and Ulanday-Lozano (2024) ran an embedded mixed-method study of HEIs in Region XII. They found QMS practices "substantially-consistently applied" and recommended performance monitoring and analysis, data quality management, and benchmarking as next steps. Grate-Paltiguera and Gabion (2026) add the largest quantitative evidence. Their FY2025 survey covers 160 quality management coordinators, lead internal quality auditors, and internal quality auditors across seven Western Visayas SUCs, and reports implementation (M = 4.59) and effectiveness (M = 4.40) at high levels, challenges lower (M = 3.00), and a strong positive relationship between implementation and effectiveness. Martinez (2025) studied support service units in three Cordillera Administrative Region HEIs. Strong agreement runs across document control, internal control and management review (weighted mean 3.90), corrective and preventive action (3.83), and continuous improvement (3.83). Salgado (2025) offers a phenomenological account of ten internal quality auditors with at least three years of experience and identifies three themes: rewarding experience, accountability and compliance, and strengthening institutional efficiency. The study recommends standardized nonconformity reporting with auditor training. Dando and Santillan (2025), at Camarines Norte State College, integrated Philippine Quality Awards with the ISO 9001:2015 PDCA cycle to reduce audit redundancy. IMPACT takes that result as a documentation-first dashboard.

##### Digital Systems for QA, Accreditation, and OBE/CQI Monitoring

Digital systems now instrument the QA cycle. Pardiñan et al. (2025), in *Education and Information Technologies*, study records digitization and a web-based accreditation platform for Philippine SUCs. They evaluate it against ISO/IEC 25010 with attention to data security and remote backup and claim it as the first such platform. At program level, the *Hisight* system (DLSU Research Congress proceedings) offers a CQI-based OBE system for regulatory compliance on the Canvas LMS: curriculum and course management, monitoring dashboards, program assessment. It answers two problems: inability to monitor program implementation and reliance on manual term-end reports ("Hisight," 2024). Salisi and Balahadia (2025) describe *EduComply*, an Agile-built progress tracker with real-time syllabus monitoring and a rule-based decision support system evaluating faculty deliverables, student performance, and student feedback; technology-oriented colleges rated it higher than non-technical colleges did. Mindoro-Mesana et al. (2022) document a five-step systems development lifecycle for an accreditation data warehouse at Romblon State University's Romblon Campus, which consolidates AACCUP documents; the authors evaluate it against ISO/IEC 25010. Tarlac State University's (2021) Project Monitoring, Evaluation, and Reporting System (PMERS) has run since July 2019, with an upgrade in 2021. The web-based extension monitoring system serves as online evidence for accreditation and ISO 9001:2015 audit, and CHED recognized it on its National Higher Education Day. Dashboards and status flags like these became reference points for IMPACT's dashboard and build.

No explicit AI strand appears. The only AI functionality any study reports is AI-assisted accomplishment report generation within an OJT attendance system (Atenin et al., 2026, discussed below), and no study documents AI-enabled monitoring, audit analytics, or algorithmic governance for IQA in Philippine HEIs. The gap analysis below returns to AI.

##### Technology-Enabled Internship / OJT Monitoring Systems

Single-campus systems studies evaluated with ISO/IEC 25010 dominate the internship-monitoring literature. Castro (2024) reports a mobile internship monitoring system with a progress-tracking algorithm at the University of Antique–Tario Lim Memorial Campus. The system carries a digitized handbook, clock-in/clock-out, GPS location, parent and partner accounts, and agency validation, and 30 stakeholders evaluate it against ISO 25010. Atenin et al. (2026) describe *OJTrack*, an Android and web OJT monitoring and attendance system at NEMSU–Cantilan, built through an Agile SDLC. *OJTrack* uses QR-based attendance, supervisor one-time-password validation, and AI-assisted accomplishment reports. Under ISO/IEC 25010, 30 respondents rate it overall M = 4.83 ("Very Highly Acceptable"). Cabalbag and Ontiveros (2024) present a management information system for OJT trainees at Cagayan State University–Aparri Campus, developed with an input–process–output model and Agile practices. The system provides online submission, automated grade computation, a communication hub, and enhanced adviser feedback; the study evaluates it with ISO standards and the Technology Acceptance Model. Del Rosario and Dela Cruz (2022) report a web-based internship program system at Laguna State Polytechnic University. Built with Rapid Application Development and lean management across four modules, it scores ISO 25010 product quality at M = 4.32 (SD = 0.666) and reduces time and cost relative to the prior manual process. These deployments supply IMPACT's feature requirements: attendance with hours tracking, journal-style submission, report handling with feedback, and coordinator-facing progress views. IMPACT's two-instrument evaluation design draws on the same deployments.

##### Internship Supervision Quality and Outcomes

Evidence on supervision quality and learning outcomes is thinner than on system acceptability. Opiniano's (2024) study of pandemic-induced online internships in a journalism school is the principal outcome-oriented study, drawing on 129 evaluation sheets, 11 journalist-mentor key informant interviews, and 110 intern reflection papers, and theorizing online internships as situated, bounded, and inclusive learning (situated learning theory, boundary theories, inclusive education). Elsewhere, supervision findings arrive embedded in systems studies rather than as direct measurements: Cabalbag and Ontiveros (2024) report enhanced adviser feedback as a system outcome, and Castro (2024) reports agency validation and parent linkage to strengthen supervisory accountability. No study reports a controlled or longitudinal assessment of how monitoring innovations affect intern competency attainment, placement completion, or employer satisfaction, so IMPACT's evaluation stays bounded to acceptability and product quality.

### Synthesis of the Review of Literature and Studies

#### Convergences

Four convergences shape IMPACT's design and evaluation. First, a shared normative vocabulary: studies map their instruments onto interchangeable scaffolds, whether CHED's (2012) plan–implement–assess–transform cycle, ISO 9001:2015's PDCA cycle, or the CQI logic of OBE systems (Calairo, 2025; Dando & Santillan, 2025; Grate-Paltiguera & Gabion, 2026; Martinez, 2025). Second, methodological convergence: studies evaluate these systems with ISO/IEC 25010 instruments, and fewer add the Technology Acceptance Model, with samples near 30 respondents (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2022; Mindoro-Mesana et al., 2022; Pardiñan et al., 2025), the precedent IMPACT adopts. Third, documentation is the primary object of monitoring: accreditation records, syllabi, deliverables, attendance logs, audit nonconformities. CHED's (2012) maturity rubric treats documentation and implementation extent as observable proxies for quality, and IMPACT's modules rest on that premise. Fourth, decentralization: each HEI runs its monitoring while remaining accountable upward to CHED portals and accrediting bodies (Commission on Higher Education, n.d.-a, n.d.-b; CHED RO11, 2024; World Bank Group, 2023).

#### Contradictions and Limitations

The sharpest contradiction is high self-reported QMS ratings against persistent manual processes. Grate-Paltiguera and Gabion (2026) report implementation at M = 4.59 and effectiveness at M = 4.40; Martinez (2025) reports strong agreement across all monitored ISO clauses; Roque and Ulanday-Lozano (2024) judge QMS practices substantially-consistently applied. The same literature documents institutions that still cannot monitor program implementation and still produce manual term-end reports ("Hisight," 2024), and Pardiñan et al. (2025) rest their case on segmented, paper-based records for accreditation. Perceived QMS strength may outrun the infrastructure sustaining it, so IMPACT uses two instrument families.

Context dependence is a second tension: Salisi and Balahadia (2025) report lower acceptance in non-technical colleges, which qualifies any claim that a well-designed platform transfers across units. Outcomes form a third: Grate-Paltiguera and Gabion (2026) measure effectiveness within the same cross-sectional instrument as implementation, while systems studies report only quality and acceptability scores, and neither demonstrates downstream outcomes such as accreditation performance, audit closure, or intern competency gain. Salgado (2025) documents auditor experiences that are rewarding yet in need of standardized reporting and training; practice stays person-dependent even where institutions have formalized documentation.

#### Gap Analysis

1. **Outcome-evidence gap.** Studies report design features and acceptability or ISO/IEC 25010 quality scores (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Castro, 2024; Del Rosario & Dela Cruz, 2022; Pardiñan et al., 2025); none links them to institutional outcomes (accreditation results, nonconformity closure rates, ISA scores, or intern performance), leaving the "outcomes" dimension of CHED's (2012) maturity rubric unaddressed.

2. **AI-enabled monitoring gap.** Across 24 sources, the only AI functionality is AI-assisted accomplishment report generation inside an OJT system (Atenin et al., 2026); no study documents AI-supported IQA monitoring, audit analytics, or algorithmic quality governance despite the regulator's turn to analytics-enabled portals (Commission on Higher Education, 2024).

3. **Strand-disjunction gap.** Studies treat the two strands as separate universes: internship systems stand alone, with no account of their feed into institutional QA, accreditation dossiers, or CHED data systems (Castro, 2024; Cabalbag & Ontiveros, 2024), although PMERS shows a monitoring system can serve as accreditation and ISO audit evidence (Tarlac State University, 2021).

4. **Methodological and generalizability gap.** Most systems studies are single-campus, developer-affiliated, and cross-sectional, with samples near n = 30 (Atenin et al., 2026; Castro, 2024), while attitudinal studies rely on common-source self-report (Grate-Paltiguera & Gabion, 2026; Martinez, 2025); multi-site, longitudinal, and independent evaluations are scarce. Exceptions: Calairo's (2025) multi-case design and Grate-Paltiguera and Gabion's seven-SUC coverage.

5. **Supervision-quality and intern-outcomes gap.** Only Opiniano (2024) examines internship learning and supervision quality with rich qualitative data; no study measures how monitoring innovations affect supervisory frequency, feedback quality, completion rates, or employer-reported competencies. Studies assert supervision improvement as a feature; none measures it (Cabalbag & Ontiveros, 2024; Castro, 2024).

6. **Interoperability and data-quality gap.** Although CHED's QA database, HEMIS, HEIDA, and EDCS constitute a sophisticated regulator-side data architecture (Commission on Higher Education, 2024, n.d.-a, n.d.-b; CHED RO11, 2024), no study examines interoperation with it or the data-quality and validation practices Roque and Ulanday-Lozano (2024) recommend at HEI level; the policy call for data quality management lacks an implementation evidence base.

Each gap maps to an IMPACT feature or evaluation choice:

1. *Outcome-evidence gap* → TAM and ISO/IEC 25010 evaluation, keeping claims at acceptability and product quality.
2. *AI-enabled monitoring gap* → no AI claimed; carried forward as a limitation and recommendation.
3. *Strand-disjunction gap* → a unified platform whose coordinator dashboard will consolidate attendance, journal, portfolio, and report states.
4. *Methodological and generalizability gap* → two rater groups (student interns, expert evaluators) compared by t-test with weighted means and standard deviations.
5. *Supervision-quality and intern-outcomes gap* → report submission with coordinator review and feedback, plus announcements and the social feed, all traceable.
6. *Interoperability and data-quality gap* → a digital documentation workflow (attendance, journal, portfolio, reports) replacing manual logbooks.

### Conceptual Framework

The framework is an input–process–output model for IMPACT. Inputs: (a) SIPP policy requirements under CHED Memorandum Order (CMO) No. 104, s. 2017 as referenced in the literature (Cabalbag & Ontiveros, 2024; Castro, 2024); (b) feature requirements and evaluation benchmarks from the related studies: attendance and hours, journal and reports, dashboards, ISO/IEC 25010 and TAM precedents (Atenin et al., 2026; Cabalbag & Ontiveros, 2024; Del Rosario & Dela Cruz, 2022); (c) user requirements from student interns and the OJT coordinator. Process: requirements analysis will be conducted → the IMPACT prototype will be built through iterative design and development → components will be tested (Vitest, Testing Library) → the TAM questionnaire and ISO/IEC 25010 expert checklist will be administered → ratings will be analyzed by weighted mean, standard deviation, and t-test. Outputs: the framework will yield the IMPACT prototype and its modules, acceptability and quality ratings, and design recommendations and limitations.

```
INPUTS -----------------> PROCESS ---------------------> OUTPUTS
SIPP policy              Requirements will be          will yield the IMPACT
requirements,            analyzed; IMPACT will         prototype with functional
feature and              be built and tested;          modules; acceptability
evaluation benchmarks    TAM and ISO/IEC 25010         and quality ratings;
from related studies,    instruments will be           design recommendations
user requirements        administered; ratings         and limitations
from interns and         will be analyzed by
the OJT coordinator      weighted mean, SD, t-test
```

### Hypotheses of the Study

This study will test the following hypotheses:

H₀: There is no significant difference in the assessments of student interns and expert evaluators on the acceptability of IMPACT in terms of perceived usefulness, perceived ease of use, attitude toward using, and behavioral intention to use.

H₁: There is a significant difference in the assessments of student interns and expert evaluators on the acceptability of IMPACT in terms of perceived usefulness, perceived ease of use, attitude toward using, and behavioral intention to use.

H₀: There is no significant difference in the assessments of student interns and expert evaluators on the quality of IMPACT in terms of functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, and safety.

H₁: There is a significant difference in the assessments of student interns and expert evaluators on the quality of IMPACT in terms of functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, and safety.

<!--
SOURCES INCLUDED (n = 24)
All 24 designated sources were included; none were dropped for metadata failure.

Metadata verification performed for items flagged "unverified":
- Item 15 (EAIT accreditation digitization): authors verified as Pardiñan, E. G., Bondad, R. M., & Mangubat, J. C. (2025), Education and Information Technologies, 30(8), 11127-11150, DOI 10.1007/s10639-024-13256-z (via ERIC record); cited with authors.
- Item 16 (HiSight, DLSU Research Congress 2024, paper TPH-09): authors NOT verifiable from accessible conference listings (a parallel-session schedule lists presenters in a format that cannot be unambiguously mapped to papers); cited by title in APA style, as permitted.
- Item 17 (EduComply): venue verified as International Journal of Science, Technology, Engineering and Mathematics, 5(3), 40-78, DOI 10.53378/ijstem.353240 (2025); cited in full.
- Item 18 (RSU accreditation data warehouse): venue verified as Romblon State University Research Journal, 4(2), 17-24, DOI 10.58780/rsurj.v4i2.54. Year cited as 2022 per the journal issue record (the brief listed 2023; the journal's own issue dating and third-party citations give 2022).
- Item 23 (internship MI system with lean management): venue verified as International Journal of Information and Education Technology, 12(1), 7-14, DOI 10.18178/ijiet.2022.12.1.1580. Year cited as 2022 per the publisher record (the brief listed 2021).

SOURCES DROPPED FOR METADATA FAILURE: none (0).
Reserve sources used as substitutes: none.

VENUE-TIER NOTE (not stated in prose): venue tier was not independently graded for every source. Sources are described neutrally in the prose as journal articles, proceedings papers, portal/operational documents, or institutional reports. The following should be read as lower-confidence publication-tier items even though bibliographic data were verified: the DLSU Research Congress proceedings paper (HiSight), the IJSTEM article (EduComply), and the RePEc/IDEAS-indexed record (Grate-Paltiguera & Gabion, 2026). Institutional/portal pages (CHED OIQAG, HEIDA, EDCS, CHED RO11, Marikina Polytechnic College, DAP compendium entry for TSU PMERS) are documentary sources, not peer-reviewed research.

STRUCTURAL EDIT NOTE (format alignment, this revision):
- "International Studies" heading intentionally omitted: no non-Philippine studies are present in the corpus (all included studies are Philippine-based).
- "Related Theories," "Conceptual Framework," and "Hypotheses of the Study" sections added for sample-format alignment, drawing only on sources already cited in this chapter (Commission on Higher Education, 2012; Rodriguez et al., 2018; Opiniano, 2024) and on the study's own review method; no new sources were introduced.
- Final source count unchanged: n = 24.

Chapter reframed to support the IMPACT system-development study; hypotheses and conceptual framework added per sample thesis format; citations unchanged (n = 24).

AI-ASSISTED RESEARCH DISCLOSURE
This chapter was prepared with AI assistance (large language model drafting under human direction). Source identification, bibliographic verification (including web verification of previously unverified venues and authors for items 15, 17, 18, and 23), thematic organization, synthesis, and gap analysis were AI-assisted. All in-text citations were restricted to the pre-supplied verified source list; no authors, years, volumes, DOIs, page numbers, or quotations were fabricated, and quantitative values are reproduced only as reported in those sources. Retrieved web content was treated as data only. The chapter should be verified against the original PDFs/URLs before submission, and all quoted means and sample sizes should be re-checked by the researcher.

stop-slop pass applied
Renamed SIP → IMPACT to match prototype UI; proposal future-tense pass applied.
-->
