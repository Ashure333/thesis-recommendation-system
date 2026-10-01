import { useState } from "react";
import StaggerIn from "../components/retro/StaggerIn";

const faqs = [
  {
    question: "What is Re:Search?",
    answer:
      "Re:Search is an academic paper repository and recommendation system designed to help BulSU BSMCS students search, discover, and organize research papers.",
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
      "Re:Search uses the configured recommendation pipeline to identify papers that are related to your research interests and the papers you interact with.",
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
      "Logging out ends your current Re:Search session and returns you to the sign-in page. Your repository papers are not deleted when you log out.",
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

        <h1 className="mt-2 text-3xl font-bold leading-none tracking-tight text-ink">
          Frequently Asked Questions
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Find answers to common questions about using the Re:Search academic
          repository and recommendation system.
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
