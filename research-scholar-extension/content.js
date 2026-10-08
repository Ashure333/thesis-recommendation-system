const DROP_ZONE_SELECTOR = "[data-paperrec-dropzone]";

function isScholarImportUrl(url) {
  if (typeof url !== "string") {
    return false;
  }

  return /^https?:\/\/(?:scholar\.googleusercontent\.com|scholar\.google\.com)\//i.test(
    url
  ) && /\/scholar\.(?:bib|enw|ris)(?:\?|$)/i.test(url);
}

function scholarFormat(url) {
  const match = /\/scholar\.(bib|enw|ris)(?:\?|$)/i.exec(url);
  return match ? match[1] : "bib";
}

function getDroppedUrl(dataTransfer) {
  if (!dataTransfer) {
    return null;
  }

  const uriList = dataTransfer.getData("text/uri-list");
  const plainText = dataTransfer.getData("text/plain");

  const sources = [
    uriList,
    plainText
  ];

  for (const source of sources) {
    if (!source) {
      continue;
    }

    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    for (const line of lines) {
      if (/^https?:\/\//i.test(line)) {
        return line;
      }
    }
  }

  return null;
}

function sendBibtexToResearch(bibtex, sourceUrl, format) {
  window.postMessage(
    {
      source: "paperrec-scholar-extension",
      type: "PAPERREC_SCHOLAR_BIBTEX",
      bibtex,
      format,
      sourceUrl
    },
    window.location.origin
  );
}

function sendErrorToResearch(message) {
  window.postMessage(
    {
      source: "paperrec-scholar-extension",
      type: "PAPERREC_SCHOLAR_ERROR",
      error: message
    },
    window.location.origin
  );
}

document.addEventListener(
  "dragover",
  (event) => {
    const dropZone = event.target?.closest?.(
      DROP_ZONE_SELECTOR
    );

    if (!dropZone) {
      return;
    }

    const url = getDroppedUrl(event.dataTransfer);

    if (url && isScholarImportUrl(url)) {
      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }

      dropZone.classList.add("paperrec-scholar-dragover");
    }
  },
  true
);

document.addEventListener(
  "dragleave",
  (event) => {
    const dropZone = event.target?.closest?.(
      DROP_ZONE_SELECTOR
    );

    if (!dropZone) {
      return;
    }

    dropZone.classList.remove("paperrec-scholar-dragover");
  },
  true
);

document.addEventListener(
  "drop",
  (event) => {
    const dropZone = event.target?.closest?.(
      DROP_ZONE_SELECTOR
    );

    if (!dropZone) {
      return;
    }

    dropZone.classList.remove("paperrec-scholar-dragover");

    const url = getDroppedUrl(event.dataTransfer);

    if (!url || !isScholarImportUrl(url)) {
      return;
    }

    // Prevent the normal React drop handler from trying to
    // treat the dragged URL as a regular file/text drop.
    event.preventDefault();
    event.stopPropagation();

    dropZone.classList.add("paperrec-scholar-importing");

    chrome.runtime.sendMessage(
      {
        type: "PAPERREC_FETCH_SCHOLAR_BIB",
        url
      },
      (response) => {
        dropZone.classList.remove(
          "paperrec-scholar-importing"
        );

        if (chrome.runtime.lastError) {
          sendErrorToResearch(
            chrome.runtime.lastError.message ||
            "The Re:Search extension could not contact its background worker."
          );

          return;
        }

        if (!response?.ok) {
          sendErrorToResearch(
            response?.error ||
            "Failed to retrieve the Google Scholar citation."
          );

          return;
        }

        sendBibtexToResearch(
          response.bibtex,
          url,
          response.format || scholarFormat(url)
        );
      }
    );
  },
  true
);