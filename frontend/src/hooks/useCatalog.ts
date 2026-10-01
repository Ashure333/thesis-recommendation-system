import { useEffect, useState } from "react";
import { getCatalog, type Catalog } from "../api";
import {
  SUBJECTS,
  CATEGORIES,
  DOCUMENT_TYPES,
} from "../data/catalog";

/* ============================================================
   USE CATALOG
   Loads the backend-owned taxonomy once and caches it for the
   session. While loading (or on failure) the static seed lists
   are used, so the UI never blocks on the fetch.
   ============================================================ */

let cached: Catalog | null = null;
let inflight: Promise<Catalog> | null = null;

export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(cached);

  useEffect(() => {
    if (cached) {
      setCatalog(cached);
      return;
    }

    if (!inflight) {
      inflight = getCatalog()
        .then((data) => {
          cached = data;
          return data;
        })
        .finally(() => {
          inflight = null;
        });
    }

    let active = true;

    inflight.then((data) => {
      if (active) {
        setCatalog(data);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return catalog;
}

/** Seed fallbacks used until the backend catalog arrives. */
export function catalogSeed(): Catalog {
  const subjectCategories = Object.fromEntries(
    SUBJECTS.map((subject) => [subject, [...CATEGORIES]]),
  );

  return {
    subjects: [...SUBJECTS],
    categories: [...CATEGORIES],
    document_types: [...DOCUMENT_TYPES],
    subject_categories: subjectCategories,
  };
}