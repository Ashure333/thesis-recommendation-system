import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import {
  researchChat,
  ResearchChatHistoryItem,
  ResearchChatSource,
} from "../api";

interface ResearchAssistantProps {
  onSourcesChange?: (sources: ResearchChatSource[]) => void;
}

type ChatMessage = ResearchChatHistoryItem & {
  id: string;
};

function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function MessageText({ content }: { content: string }) {
  const parts = content.split(/(\[\d+\])/g);

  return (
    <div className="whitespace-pre-wrap text-[13px] leading-6 text-[#514b44]">
      {parts.map((part, index) =>
        /^\[\d+\]$/.test(part) ? (
          <span
            key={`${part}-${index}`}
            className="font-medium text-[#668b72]"
          >
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
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* HEADER */}
      <div className="shrink-0 border-b border-[#dedbd5] bg-[#faf9f7] px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#8a8177]">
          Research Assistant
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="font-serif text-[22px] leading-tight text-[#17202a]">
            Ask your papers
          </h2>
          <Sparkles size={15} className="text-[#668b72]" />
        </div>
        <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#8b857d]">
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
          <div className="mx-auto w-full max-w-3xl space-y-7">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[82%]"
                    : "max-w-[90%]"
                }
              >
                <p className="mb-2 text-[9px] uppercase tracking-[0.16em] text-[#8a8177]">
                  {message.role === "user" ? "You" : "Research Assistant"}
                </p>

                <div
                  className={
                    message.role === "user"
                      ? "rounded-lg border border-[#ddd8d0] bg-[#f3f1ed] px-4 py-3"
                      : "rounded-lg border border-[#e3dfd8] bg-white px-4 py-4"
                  }
                >
                  <MessageText content={message.content} />
                </div>
              </div>
            ))}

            {loading && (
              <div className="max-w-[90%]">
                <p className="mb-2 text-[9px] uppercase tracking-[0.16em] text-[#8a8177]">
                  Research Assistant
                </p>
                <div className="inline-flex items-center gap-2 rounded-lg border border-[#e3dfd8] bg-white px-4 py-3 text-[12px] text-[#777169]">
                  <Loader2 size={14} className="animate-spin" />
                  Searching your papers and preparing an answer...
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mx-auto mt-5 max-w-3xl rounded-md border border-[#e2cfc7] bg-[#fbf4f1] px-4 py-3 text-[11px] leading-5 text-[#8a5f52]">
            {error}
          </div>
        )}
      </div>

      {/* INPUT */}
      <div className="shrink-0 border-t border-[#dedbd5] bg-[#faf9f7] px-5 py-4">
        <form onSubmit={submitQuestion} className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-md border border-[#d9d5ce] bg-white p-2 shadow-sm focus-within:border-[#aaa49b]">
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
              placeholder="Ask a research question..."
              className="min-h-[42px] flex-1 resize-none bg-transparent px-2 py-1 text-[13px] leading-5 text-[#2f2b27] outline-none placeholder:text-[#aaa39a]"
            />

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#3e3933] text-white transition hover:bg-[#292520] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Ask research question"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </div>
          <p className="mt-2 px-1 text-[9px] text-[#aaa39a]">
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
    <div className="flex min-h-0 flex-1 flex-col bg-[#faf9f7]">
      <div className="shrink-0 border-b border-[#dedbd5] px-5 py-4">
        <p className="text-[9px] uppercase tracking-[0.16em] text-[#8a8177]">
          References
        </p>
        <h2 className="mt-1 font-serif text-[20px] text-[#24211d]">
          Sources
        </h2>
        <p className="mt-1 text-[10px] leading-5 text-[#8b857d]">
          Papers retrieved from your repository for the current answer.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {sources.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center px-4 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf2ed] text-[#668b72]">
                <Sparkles size={15} />
              </div>
              <p className="font-serif text-[16px] text-[#514b44]">
                No references yet
              </p>
              <p className="mt-1 text-[10px] leading-5 text-[#99938a]">
                Ask a question and the papers used to support the answer will
                appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source, index) => (
              <article
                key={source.paper_id}
                className="rounded-md border border-[#ded9d1] bg-white px-3 py-3"
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#d5d0c8] text-[9px] text-[#777169]">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3
                      title={source.title}
                      className="line-clamp-3 text-[11px] font-medium leading-4 text-[#2f2b27]"
                    >
                      {source.title}
                    </h3>

                    <p className="mt-1 text-[9px] text-[#8b857d]">
                      {source.author || "Unknown author"}
                      {source.year ? ` · ${source.year}` : ""}
                    </p>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[8px] uppercase tracking-[0.08em] text-[#99938a]">
                        <span>Relevance</span>
                        <span>{formatScore(source.score)}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[#e8e4de]">
                        <div
                          className="h-full rounded-full bg-[#668b72]"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, source.score * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {source.abstract && (
                      <p className="mt-3 line-clamp-4 text-[9px] leading-4 text-[#777169]">
                        {source.abstract}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
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
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf2ed] text-[#668b72]">
          <Sparkles size={18} />
        </div>

        <h3 className="font-serif text-[25px] text-[#24211d]">
          Research Assistant
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-[12px] leading-6 text-[#777169]">
          Explore your repository conversationally. Your question is matched
          against the existing paper collection before an answer is generated.
        </p>

        <div className="mt-7 grid gap-2 text-left sm:grid-cols-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onAsk(example)}
              className="rounded-md border border-[#dfdad3] bg-white px-3 py-3 text-left text-[10px] leading-4 text-[#5f5952] transition hover:border-[#c8c2b9] hover:bg-[#faf9f7]"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
