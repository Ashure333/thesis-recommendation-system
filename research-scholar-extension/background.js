const SCHOLAR_EXPORT_REGEX =
  /^https?:\/\/(?:scholar\.googleusercontent\.com|scholar\.google\.com)\//i;

function isScholarImportUrl(url) {
  if (typeof url !== "string") {
    return false;
  }

  if (!SCHOLAR_EXPORT_REGEX.test(url)) {
    return false;
  }

  return /\/scholar\.(?:bib|enw|ris)(?:\?|$)/i.test(url);
}

function scholarFormat(url) {
  const match = /\/scholar\.(bib|enw|ris)(?:\?|$)/i.exec(url);
  return match ? match[1] : "bib";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "PAPERREC_FETCH_SCHOLAR_BIB") {
    return;
  }

  const url = typeof message.url === "string"
    ? message.url.trim()
    : "";

  if (!isScholarImportUrl(url)) {
    sendResponse({
      ok: false,
      error: "The supplied URL is not a Google Scholar export URL."
    });

    return;
  }

  fetchScholarExport(url)
    .then((exported) => {
      sendResponse({
        ok: true,
        format: exported.format,
        bibtex: exported.text
      });
    })
    .catch((error) => {
      console.error("Re:Search Scholar import failed:", error);

      sendResponse({
        ok: false,
        error: error instanceof Error
          ? error.message
          : "Failed to retrieve the Google Scholar citation."
      });
    });

  // Keep the message channel open for the async fetch.
  return true;
});

async function fetchScholarExport(url) {
  const format = scholarFormat(url);

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

  const text = (await response.text()).trim();

  if (!text) {
    throw new Error(
      "Google Scholar returned an empty export."
    );
  }

  const signature =
    format === "bib"
      ? /@\w+\s*\{/i
      : format === "ris"
        ? /^TY\s*-\s*/im
        : /^%0\s/m;

  if (!signature.test(text)) {
    throw new Error(
      "The response does not appear to be a valid Google Scholar " +
        format.toUpperCase() + " export."
    );
  }

  return { format, text };
}