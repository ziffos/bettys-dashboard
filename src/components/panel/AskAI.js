"use client";

import { MessageCircle } from "lucide-react";

/**
 * The shape of a chat, and nothing else.
 *
 * There is no model behind this, no request, no reply. The composer is inert on
 * purpose: a facade that answered would be worse than one that plainly does
 * not, because you would trust it. When it is wired up, this is where it goes.
 */
export default function AskAI() {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-2 px-6 text-center">
        <MessageCircle size={18} strokeWidth={1.75} className="text-faint" />
        <p className="text-[13.5px] font-semibold tracking-[-0.01em]">Ask about the numbers</p>
        <p className="text-[12px] text-subtle text-pretty leading-[1.5]">
          This is the shape of it. Nothing is connected yet, so nothing will answer.
        </p>
      </div>
      <div className="border-t border-line p-3 shrink-0">
        <div className="h-8 px-2.5 border border-line rounded-lg flex items-center text-[12.5px] text-faint">
          Not connected yet
        </div>
      </div>
    </>
  );
}
