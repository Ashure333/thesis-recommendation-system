import { useState } from "react";
import StaggerIn from "../components/retro/StaggerIn";

const faqs = [
  {
    question: "What is Re:Search?",
    answer:
      "Re:Search is a paper repository and recommendation system for BulSU BSMCS students. It helps you search, discover, and organize research papers.",
  },
  {
    question: "How do I search for papers?",
    answer:
      "Open the Search page. Enter keywords, a research topic, or a paper title. The page ranks the papers that match your query. Open a result to read its record.",
  },
  {
    question: "How do I browse all available papers?",
    answer:
      "Open the Repository page. The page lists every paper in the system. Use the filters to limit the list.",
  },
  {
    question: "How do recommendations work?",
    answer:
      "Re:Search ranks papers with a recommendation pipeline. Select the pipeline on the Search page. The default pipeline combines three signals: TF-IDF, S-BERT, and metadata.",
  },
  {
    question: "How do I save a paper?",
    answer:
      "Select Save to library on a paper. The paper moves to My Library. Open My Library to read your saved papers again.",
  },
  {
    question: "How do I upload a paper?",
    answer:
      "Open the Upload page. Fill in the form, then select Upload. Re:Search stores the file and adds the paper to the repository.",
  },
  {
    question: "What happens when I sign out?",
    answer:
      "The sign-out ends your session and returns you to the sign-in page. Signing out does not delete the repository or your saved papers.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggleFAQ(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm font-bold text-muted">
          Help Center
        </p>

        <h1 className="font-pixelify mt-2 text-3xl font-bold leading-none text-ink">
          Frequently Asked Questions
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Answers to common questions about the Re:Search repository
          and recommendation system.
        </p>
      </div>

      {/* FAQ List */}
      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;

          return (
            <StaggerIn key={faq.question} index={index} className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition pixel-ease hover:bg-accentSoft"
              >
                <span className="text-sm font-bold text-ink">
                  {faq.question}
                </span>

                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] border-gray-900 bg-white text-sm font-bold text-ink transition-transform pixel-ease ${
                    isOpen ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-200 px-5 py-4">
                  <p className="text-sm leading-6 text-muted">{faq.answer}</p>
                </div>
              )}
            </StaggerIn>
          );
        })}
      </div>

      {/* Bottom note */}
      <div className="mt-8 rounded border-[3px] border-dashed border-gray-900 bg-canvas p-5">
        <p className="text-sm font-medium text-ink">Need more help?</p>

        <p className="mt-1 text-sm leading-5 text-muted">
          Use the System Tutorial from the account menu for a quick walkthrough
          of the main Re:Search features.
        </p>
      </div>
    </div>
  );
}
