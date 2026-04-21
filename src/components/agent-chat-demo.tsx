"use client";

import { ArrowUp, Check } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";

const MESSAGES = [
  {
    prompt: "I'd like to issue a refund for order #4281",
    confirmation: "Refund of $42.00 sent to customer",
  },
  {
    prompt: "Process this invoice from Figma",
    confirmation: "Paid $15.00 to Figma — Design subscription",
  },
  {
    prompt: "Pay $200 to the designer for last week's mockups",
    confirmation: "Paid $200.00 to Alice Chen — Design contractor",
  },
  {
    prompt: "Subscribe to OpenAI credits — $100/month",
    confirmation: "Paid $100.00 to OpenAI — API credits",
  },
];

type Phase = "typing" | "sent" | "confirming" | "confirmed" | "idle";

export function AgentChatDemo() {
  const [index, setIndex] = React.useState(0);
  const [input, setInput] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("typing");
  const [visibleSent, setVisibleSent] = React.useState<string>("");
  const [visibleConfirmation, setVisibleConfirmation] = React.useState<
    string | null
  >(null);

  const current = MESSAGES[index % MESSAGES.length];

  React.useEffect(() => {
    if (phase !== "typing") return;
    if (input.length >= current.prompt.length) {
      const t = setTimeout(() => setPhase("sent"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setInput(current.prompt.slice(0, input.length + 1)),
      28 + Math.random() * 30,
    );
    return () => clearTimeout(t);
  }, [phase, input, current.prompt]);

  React.useEffect(() => {
    if (phase !== "sent") return;
    setVisibleSent(current.prompt);
    setInput("");
    const t = setTimeout(() => setPhase("confirming"), 350);
    return () => clearTimeout(t);
  }, [phase, current.prompt]);

  React.useEffect(() => {
    if (phase !== "confirming") return;
    const t1 = setTimeout(() => {
      setVisibleConfirmation(current.confirmation);
      setPhase("confirmed");
    }, 900);
    return () => clearTimeout(t1);
  }, [phase, current.confirmation]);

  React.useEffect(() => {
    if (phase !== "confirmed") return;
    const t = setTimeout(() => {
      setVisibleSent("");
      setVisibleConfirmation(null);
      setIndex((i) => (i + 1) % MESSAGES.length);
      setPhase("typing");
    }, 2600);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="w-full max-w-[420px] space-y-3">
      <div
        className={`flex justify-end transition-all duration-300 ${
          visibleSent
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <div className="rounded-2xl rounded-br-sm bg-neutral-800 text-white px-4 py-2 text-sm max-w-[85%]">
          {visibleSent || "\u00A0"}
        </div>
      </div>

      <div
        className={`flex justify-start transition-all duration-300 ${
          visibleConfirmation
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="flex items-start gap-2 rounded-2xl rounded-bl-sm bg-white border border-emerald-200 px-4 py-2 text-sm max-w-[90%] shadow-sm">
          <Check className="h-4 w-4 text-emerald-600 flex-none mt-0.5" />
          <span className="text-neutral-700">
            {visibleConfirmation || "\u00A0"}
          </span>
        </div>
      </div>

      <PromptInput
        value={input}
        onValueChange={() => {}}
        className="bg-white"
      >
        <PromptInputTextarea
          placeholder="Ask the agent…"
          disableAutosize
          readOnly
        />
        <PromptInputActions className="justify-end pt-1">
          <PromptInputAction tooltip="Send">
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 rounded-full"
              tabIndex={-1}
              aria-label="send"
            >
              <ArrowUp className="size-4" />
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>

      <div className="flex items-center gap-2 text-xs text-neutral-500 px-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Live demo · payments enforced in real time
      </div>
    </div>
  );
}
