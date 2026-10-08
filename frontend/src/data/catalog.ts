/* ============================================================
   REPOSITORY CATALOG
   The canonical subject / category / document-type taxonomy.
   Kept in one place so the Repository filters and the Upload
   form can never drift apart. Values mirror what is actually
   stored in the repository (paper.subject_category split on ":").
   ============================================================ */

export const SUBJECTS = [
  "Computer Science",
  "Mathematics",
  "Information Technology",
  "Engineering",
  "Physics",
  "Chemistry",
  "Biology",
  "Statistics",
  "Economics",
  "Business Administration",
  "Education",
  "Psychology",
] as const;

export const CATEGORIES = [
  "Machine Learning",
  "Mathematical Analysis",
  "Mathematical Modeling",
  "Graph Theory",
  "Linear Algebra",
  "Information Retrieval",
  "Algorithms",
] as const;

export const DOCUMENT_TYPES = [
  "Journal Article",
  "Conference Paper",
  "Thesis",
  "Technical Report",
] as const;

/** Filter lists include an "All …" sentinel as the first option. */
export const SUBJECT_FILTERS = ["All Subjects", ...SUBJECTS] as const;
export const CATEGORY_FILTERS = ["All Categories", ...CATEGORIES] as const;
export const DOCUMENT_TYPE_FILTERS = ["All", ...DOCUMENT_TYPES] as const;
