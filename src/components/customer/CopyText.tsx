"use client";

import { useState } from "react";

/** Manual-copy fallback for the WhatsApp order message. */
export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the textarea below allows manual selection
    }
  }

  return (
    <details className="rounded-xl border border-stone-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-stone-700">
        WhatsApp didn&apos;t open? Copy the order message
      </summary>
      <textarea
        readOnly
        value={text}
        rows={8}
        className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 p-2 font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <button
        onClick={copy}
        className="mt-2 rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white"
      >
        {copied ? "Copied ✓" : "Copy message"}
      </button>
    </details>
  );
}
