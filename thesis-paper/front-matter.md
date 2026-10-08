# FRONT MATTER

## Title Page

\thesistitlepage{RE:SEARCH: A DESIGN AND COMPARATIVE EVALUATION OF HYBRID CONTENT-BASED RECOMMENDATION PIPELINES INTEGRATING TF-IDF, SBERT, AND METADATA FUSION}{[RESEARCHER LASTNAME, First M.I.] \newline [RESEARCHER LASTNAME, First M.I.] \newline [RESEARCHER LASTNAME, First M.I.]}{[ADVISER LASTNAME, First M.I.]}{[Month Year]}

### ACKNOWLEDGMENT

We, the researchers, would like to express our sincere gratitude to the individuals and institutions who supported us in the completion of this thesis.

First and foremost, we thank the Almighty God for granting us wisdom, strength, and perseverance throughout this journey.

Our deepest appreciation goes to our thesis adviser, [ADVISER NAME], for the guidance and valuable insights shared throughout the development of this study.

We are also grateful to our thesis instructor, [INSTRUCTOR NAME], for the support and guidance throughout the research process.

We thank our panel members, [PANEL MEMBER 1], [PANEL MEMBER 2], and [PANEL MEMBER 3], for their time, comments, and recommendations that helped improve this work.

Sincere thanks are extended to the College of Science of Bulacan State University for the environment and resources that supported this study.

We also thank the student end-users and IT experts who take part in evaluating the developed system's acceptability and software quality.

Lastly, to our families, friends, and loved ones: thank you for the patience, encouragement, and support through every late night and tight deadline that came with finishing this thesis. To everyone who helped us reach this milestone in ways large or small, we are sincerely grateful.

### ABSTRACT

Thesis writing begins with locating related literature, yet keyword search in Google Scholar and library catalogs breaks down under vocabulary mismatch and ignores structured metadata, while single-signal content-based recommenders fail in opposite directions: lexical matching misses paraphrase and semantic matching drifts from topic. To address this gap, Re:Search, a local academic paper repository and hybrid content-based recommendation system for BSMCS thesis writing, was developed. Re:Search imports papers from PDF and BibTeX citations, validates each record for recommendation use, and represents prepared text built from title, abstract, and keywords as TF-IDF vectors and S-BERT embeddings, combined with a metadata signal scored over title, abstract, keywords, and publication year. Three components yield six fixed pipeline configurations plus a user-customizable dial allocation, searched by free-text query or seed paper at a top-K of 5, 10, or 15. The six configurations will be compared through the Arena, an in-system evaluation instrument that reports consensus ranking, pairwise agreement in overlap at K and mean rank gap, an independence-weighted consensus winner, and a win tally over logged runs drawn from the repository's largest subject classes. The developed system's acceptability and software quality will be evaluated by purposively selected student end-users through a Technology Acceptance Model questionnaire and by IT experts through an ISO/IEC 25010 checklist, analyzed descriptively with weighted means, standard deviations, and a five-level verbal interpretation scale. The prototype stores 168 paper records, 145 of them valid for recommendation, at the time of writing. The study contributes a working hybrid recommendation prototype, a documented comparison protocol for its six configurations, and an evaluation design for acceptability and software quality.

*Keywords: academic paper recommendation, content-based filtering, hybrid recommender systems, TF-IDF*

### TABLE OF CONTENTS

\thesistoc
