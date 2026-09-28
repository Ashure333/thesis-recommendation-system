import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import {
  researchChat,
  ResearchChatHistoryItem,
  ResearchChatSource,
} from "../api";
import { Button, EmptyState } from "./ui";

/* ============================================================
   GITINGEST DESIGN LANGUAGE
   Cream canvas #FFFDF8 · ink gray-900 · 3px outlines · 4px radius
   Depth = sibling slab (bg-gray-900, translate 4px/4px), never a blur.
   Orange = the one primary action + hover/active. Pale blue = the main input.
   Red/green sparkles are decoration only. Errors are plain ink text in
   an outlined panel, never a colour. No divider rules: whitespace groups.
   ============================================================ */

interface ResearchAssistantProps {
  onSourcesChange?: (sources: ResearchChatSource[]) => void;
}

type ChatMessage = ResearchChatHistoryItem & {
  id: string;
};

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

/** Four-point sparkle glyph. Ornamental only (aria-hidden). */
function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
    >
      <path d="M12 1C12.8 7.5 16.5 11.2 23 12C16.5 12.8 12.8 16.5 12 23C11.2 16.5 7.5 12.8 1 12C7.5 11.2 11.2 7.5 12 1Z" />
    </svg>
  );
}

function MessageText({ content }: { content: string }) {
  const parts = content.split(/(\[\d+\])/g);

  return (
    <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-900">
      {parts.map((part, index) =>
        /^\[\d+\]$/.test(part) ? (
          // Citation markers are bold ink, not a coloured accent.
          <span key={`${part}-${index}`} className="font-bold">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </div>
  );
}

export default function ResearchAssistant({
  onSourcesChange,
}: ResearchAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTop = element.scrollHeight;
  }, [messages, loading]);

  async function submitQuestion(event?: FormEvent) {
    event?.preventDefault();

    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setError(null);
    setLoading(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const response = await researchChat({
        message: question,
        pipeline: "sbert",
        topK: 6,
        history: nextMessages.slice(-8).map(({ role, content }) => ({
          role,
          content,
        })),
      });

      onSourcesChange?.(response.sources);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Research assistant request failed."
      );
    } finally {
      setLoading(false);
    }
  }

  const hasConversation = messages.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FFFDF8] text-gray-900">
      {/* HEADER: sits on the canvas; whitespace separates it, no rule */}
      <div className="shrink-0 px-6 pb-2 pt-6">
        <p className="text-sm font-bold text-gray-600">Research Assistant</p>
        <h2 className="mt-1 text-2xl font-bold leading-snug">
          Ask your papers
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
          Ask questions about the academic papers in your repository. The
          assistant retrieves relevant papers first, then uses those papers as
          evidence for the answer.
        </p>
      </div>

      {/* CHAT */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6"
      >
        {!hasConversation ? (
          <EmptyResearchState onAsk={setInput} />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[82%]"
                    : "max-w-[90%]"
                }
              >
                <p className="mb-2 text-sm font-bold text-gray-600">
                  {message.role === "user" ? "You" : "Research Assistant"}
                </p>

                {message.role === "user" ? (
                  // Level 2: outline + slab, echoing the input the text came from
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded bg-gray-900"
                    />
                    <div className="relative z-10 rounded border-[3px] border-gray-900 bg-white px-4 py-3">
                      <MessageText content={message.content} />
                    </div>
                  </div>
                ) : (
                  // Level 1 result-panel: outline only
                  <div className="rounded border-[3px] border-gray-900 bg-white p-4">
                    <MessageText content={message.content} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="max-w-[90%]">
                <p className="mb-2 text-sm font-bold text-gray-600">
                  Research Assistant
                </p>
                <div
                  role="status"
                  className="inline-flex items-center gap-2 rounded border-[3px] border-gray-900 bg-white px-4 py-3 text-sm font-medium text-gray-900"
                >
                  <Loader2
                    size={16}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  Searching your papers and preparing an answer...
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mx-auto mt-6 max-w-3xl rounded border-[3px] border-gray-900 bg-white px-4 py-3 text-sm font-medium text-gray-900"
          >
            {error}
          </p>
        )}
      </div>

      {/* INPUT */}
      <div className="shrink-0 px-6 pb-6 pt-4">
        <form onSubmit={submitQuestion} className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {/* url-input construction: field fill + slab */}
            <div className="relative flex-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded bg-gray-900"
              />
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion();
                  }
                }}
                rows={2}
                aria-label="Research question"
                placeholder="Ask a research question..."
                className="relative z-10 block w-full resize-none rounded border-[3px] border-gray-900 bg-[#E8F0FE] px-6 py-3.5 text-lg font-medium leading-normal text-gray-900 placeholder-gray-600 transition-transform duration-100 focus:translate-x-0.5 focus:translate-y-0.5 focus:outline-none motion-reduce:transition-none"
              />
            </div>

            {/* Full-width on small screens, natural width from sm up */}
            <div className="w-full sm:w-auto">
              <Button
                type="submit"
                fullWidth
                disabled={!input.trim() || loading}
                aria-label="Ask research question"
              >
                {loading ? (
                  <Loader2
                    size={18}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Send size={18} aria-hidden="true" />
                )}
                Ask
              </Button>
            </div>
          </div>

          <p className="mt-5 text-sm text-gray-600">
            Answers are grounded in the retrieved papers. If the repository
            does not contain enough evidence, the assistant should say so.
          </p>
        </form>
      </div>
    </div>
  );
}

export function ResearchReferencePanel({
  sources,
}: {
  sources: ResearchChatSource[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FFFDF8] text-gray-900">
      <div className="shrink-0 px-6 pb-2 pt-6">
        <p className="text-sm font-bold text-gray-600">References</p>
        <h2 className="mt-1 text-xl font-bold leading-snug">Sources</h2>
        <p className="mt-1 text-sm text-gray-600">
          Papers retrieved from your repository for the current answer.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {sources.length === 0 ? (
          <EmptyState
            title="No references yet"
            description="Ask a question and the papers used to support the answer will appear here."
          />
        ) : (
          <div className="space-y-6">
            {sources.map((source, index) => {
              const pct = Math.max(0, Math.min(100, source.score * 100));

              return (
                // result-panel: white fill, 3px outline, 4px radius, md padding
                <article
                  key={source.paper_id}
                  className="rounded border-[3px] border-gray-900 bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Small circular indicator: the one place rounded-full is allowed */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-gray-900 text-sm font-bold">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3
                        title={source.title}
                        className="line-clamp-3 text-base font-bold leading-snug"
                      >
                        {source.title}
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        {source.author || "Unknown author"}
                        {source.year ? ` · ${source.year}` : ""}
                      </p>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="text-gray-600">Relevance</span>
                          <span className="font-bold">
                            {formatScore(source.score)}
                          </span>
                        </div>
                        {/* Same construction as WeightBar: outlined track, flat fill */}
                        <div
                          role="meter"
                          aria-label="Relevance"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(pct)}
                          className="h-4 overflow-hidden rounded border-[3px] border-gray-900 bg-white"
                        >
                          <div
                            className={`h-full bg-[#FCA847] ${
                              pct > 0 && pct < 100
                                ? "border-r-[3px] border-gray-900"
                                : ""
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {source.abstract && (
                        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-gray-600">
                          {source.abstract}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyResearchState({
  onAsk,
}: {
  onAsk: (value: string) => void;
}) {
  const examples = [
    "What methods are commonly used in these papers?",
    "What are the main findings across the repository?",
    "What research gaps are discussed in the papers?",
    "How do the approaches in these papers compare?",
  ];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl items-center justify-center py-12">
      <div className="w-full max-w-2xl text-center">
        {/* Hero: bold, tight-tracked headline flanked by the sparkle pair */}
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <Sparkle className="h-6 w-6 text-[#F43F5E] sm:h-8 sm:w-8" />
          <h3 className="text-3xl font-bold leading-none tracking-tighter sm:text-5xl">
            Research Assistant
          </h3>
          <Sparkle className="h-6 w-6 text-[#22C55E] sm:h-8 sm:w-8" />
        </div>

        <p className="mx-auto mt-6 max-w-lg text-lg font-medium leading-relaxed text-gray-600">
          Explore your repository conversationally. Your question is matched
          against the existing paper collection before an answer is generated.
        </p>

        <p className="mt-10 text-sm font-bold">Try asking:</p>

        {/* example-chips: white fill, 3px outline, orange on hover */}
        <div className="mt-4 grid gap-4 text-left sm:grid-cols-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onAsk(example)}
              className={`rounded border-[3px] border-gray-900 bg-white px-3 py-2.5 text-left text-sm font-medium leading-snug text-gray-900 transition-transform duration-100 hover:bg-[#FCA847] active:translate-x-0.5 active:translate-y-0.5 motion-reduce:transition-none ${FOCUS}`}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
