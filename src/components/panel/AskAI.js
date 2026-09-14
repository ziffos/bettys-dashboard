"use client";

import { useState } from "react";
import { MessageCircle, SendHorizontal } from "lucide-react";

/**
 * The shape of a chat, and deliberately nothing more.
 *
 * There is no model behind this: no request is made, no answer is generated,
 * nothing is stored. What you type appears, because otherwise the shape cannot
 * be judged, and underneath it sits a plain statement that it went nowhere.
 *
 * That line is **not a reply**. It is the panel saying what happened, in the
 * place a reply will one day sit. A facade that answered would be worse than
 * one that plainly does not, because you would start to trust it — and an
 * invented figure on a screen full of real ones is the most expensive kind of
 * wrong this dashboard could be.
 *
 * Messages live in component state, so they are gone on reload. That is the
 * point: nothing here is real yet.
 *
 * When it is wired up, this is the file.
 */
export default function AskAI() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  const send = (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setMessages((m) => [...m, body]);
  };

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-7 text-center">
            <MessageCircle size={18} strokeWidth={1.75} className="text-faint" />
            <p className="text-[13.5px] font-semibold tracking-[-0.01em]">
              Ask about the numbers
            </p>
            <p className="text-[12px] text-subtle text-pretty leading-[1.5]">
              This is where questions about the dashboard will be answered. It is the
              shape of it only — nothing is connected behind it yet.
            </p>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2.5">
            {messages.map((body, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                <div className="self-end max-w-[86%] px-2.5 py-2 rounded-xl rounded-br-[4px] bg-ink-strong text-surface text-[12.5px] leading-[1.45] text-pretty">
                  {body}
                </div>
                <div className="self-start max-w-[86%] px-2.5 py-2 rounded-xl rounded-bl-[4px] bg-wash-light border border-line text-[12.5px] leading-[1.45] text-subtle italic text-pretty">
                  Not connected yet, so this went nowhere. An answer will appear here once
                  it is.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={send} className="border-t border-line p-3 shrink-0">
        <div className="h-8 pl-2.5 pr-1 border border-line rounded-lg flex items-center gap-1.5 focus-within:border-ink-strong">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1 min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim()}
            className="w-6 h-6 shrink-0 rounded flex items-center justify-center text-faint disabled:opacity-40 enabled:hover:text-ink enabled:hover:bg-wash"
          >
            <SendHorizontal size={13} strokeWidth={2} />
          </button>
        </div>
      </form>
    </>
  );
}
