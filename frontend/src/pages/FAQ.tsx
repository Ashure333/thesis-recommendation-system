import { useState } from "react";

const faqs = [
  {
    question: "What is PaperRec?",
    answer:
      "PaperRec is an academic paper repository and recommendation system designed to help BulSU BSMCS students search, discover, and organize research papers.",
  },
  {
    question: "How do I search for papers?",
    answer:
      "Go to the Search page and enter keywords, a research topic, or a paper title. You can then browse the available results and open papers that match your research needs.",
  },
  {
    question: "How do I browse all available papers?",
    answer:
      "Open the Repository page from the navigation bar. The repository contains the academic papers currently available in the system.",
  },
  {
    question: "How do recommendations work?",
    answer:
      "PaperRec uses the configured recommendation pipeline to identify papers that are related to your research interests and the papers you interact with.",
  },
  {
    question: "How do I save a paper?",
    answer:
      "When a paper is useful to you, you can save it to My Library. Saved papers can then be accessed again from the My Library page.",
  },
  {
    question: "How do I upload a paper?",
    answer:
      "Open the Upload page from the navigation bar and follow the provided fields to submit a paper to the repository.",
  },
  {
    question: "What happens when I log out?",
    answer:
      "Logging out ends your current PaperRec session and returns you to the sign-in page. Your repository papers are not deleted when you log out.",
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
        <p className="text-[10px] uppercase tracking-[0.16em] text-gold">
          Help Center
        </p>

        <h1 className="mt-2 font-serif text-3xl text-ink">
          Frequently Asked Questions
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Find answers to common questions about using the PaperRec academic
          repository and recommendation system.
        </p>
      </div>

      {/* FAQ List */}
      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;

          return (
            <div
              key={faq.question}
              className="overflow-hidden rounded-lg border border-line bg-panel"
            >
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-panelAlt"
              >
                <span className="text-sm font-medium text-ink">
                  {faq.question}
                </span>

                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-sm text-muted transition-transform ${
                    isOpen ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-line px-5 py-4">
                  <p className="text-sm leading-6 text-muted">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <div className="mt-8 rounded-lg border border-gold/20 bg-gold/5 p-5">
        <p className="text-sm font-medium text-ink">Need more help?</p>

        <p className="mt-1 text-sm leading-5 text-muted">
          Use the System Tutorial from the account menu for a quick walkthrough
          of the main PaperRec features.
        </p>
      </div>
    </div>
  );
}
