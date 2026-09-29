const SCHOLAR_BIB_REGEX =
  /^https?:\/\/(?:scholar\.googleusercontent\.com|scholar\.google\.com)\//i;

function isScholarBibUrl(url) {
  if (typeof url !== "string") {
    return false;
  }

  if (!SCHOLAR_BIB_REGEX.test(url)) {
    return false;
  }

  return /\/scholar\.bib(?:\?|$)/i.test(url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "PAPERREC_FETCH_SCHOLAR_BIB") {
    return;
  }

  const url = typeof message.url === "string"
    ? message.url.trim()
    : "";

  if (!isScholarBibUrl(url)) {
    sendResponse({
      ok: false,
      error: "The supplied URL is not a Google Scholar BibTeX URL."
    });

    return;
  }

  fetchScholarBibtex(url)
    .then((bibtex) => {
      sendResponse({
        ok: true,
        bibtex
      });
    })
    .catch((error) => {
      console.error("PaperRec Scholar import failed:", error);

      sendResponse({
        ok: false,
        error: error instanceof Error
          ? error.message
          : "Failed to retrieve the Google Scholar BibTeX citation."
      });
    });

  // Keep the message channel open for the async fetch.
  return true;
});

async function fetchScholarBibtex(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    credentials: "include",
    headers: {
      "Accept": "text/plain, application/x-bibtex, */*"
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Google Scholar temporarily rejected the request (HTTP 429). " +
        "Please wait a moment and try again."
      );
    }

    throw new Error(
      `Google Scholar returned HTTP ${response.status}.`
    );
  }

  const text = await response.text();

  const bibtex = text.trim();

  if (!bibtex) {
    throw new Error(
      "Google Scholar returned an empty BibTeX response."
    );
  }

  if (!/@\w+\s*\{/i.test(bibtex)) {
    throw new Error(
      "The response does not appear to contain valid BibTeX."
    );
  }

  return bibtex;
}