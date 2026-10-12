"use client";

import { useState } from "react";
import { MdAdd } from "react-icons/md";

import { Eyebrow, cx } from "@/components/ui";
import { FAQS, FAQ_TOPICS, type FaqTopic } from "@/lib/faqs";

export function Faq() {
  const [topic, setTopic] = useState<FaqTopic>("guests");

  return (
    <section id="faq" className="bg-linen">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-5 sm:py-20 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-16">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-3 text-[2.25rem] sm:text-h1">Before you ask.</h2>
          <div
            role="tablist"
            aria-label="Question topics"
            className="mt-6 inline-flex rounded-[0.875rem] bg-blush p-1 inset-shadow-well"
          >
            {FAQ_TOPICS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`faq-tab-${key}`}
                aria-selected={topic === key}
                aria-controls={`faq-panel-${key}`}
                onClick={() => setTopic(key)}
                className={cx(
                  "rounded-[0.625rem] px-3.5 py-2 text-small font-semibold transition-colors",
                  topic === key ? "bg-paper text-ink shadow-sm" : "text-ash",
                )}
              >
                {label}{" "}
                <span className="opacity-60">
                  {FAQS.filter((f) => f.topic === key).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Every panel is rendered, so all answers stay in the HTML for the FAQ schema. */}
        {FAQ_TOPICS.map(([key]) => (
          <div
            key={key}
            role="tabpanel"
            id={`faq-panel-${key}`}
            aria-labelledby={`faq-tab-${key}`}
            hidden={topic !== key}
            className="border-t border-edge md:col-start-2 md:row-start-1"
          >
            {FAQS.filter((f) => f.topic === key).map((f, i) => (
              <details
                key={f.question}
                name={`faq-${key}`}
                open={i === 0}
                className="group border-b border-edge"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4.5 font-display text-[1.2rem] font-extrabold leading-tight tracking-[-0.03em] [font-stretch:86%] [word-spacing:0.1em] marker:hidden sm:text-[1.3rem] [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <span
                    aria-hidden
                    className="grid size-7.5 shrink-0 place-items-center rounded-full bg-blush text-[1.1rem] text-claret transition-transform group-open:rotate-45"
                  >
                    <MdAdd />
                  </span>
                </summary>
                <p className="max-w-[60ch] pb-4.5 pr-11 text-[0.9375rem] leading-relaxed text-ash">
                  <b className="font-semibold text-ink">{f.short}</b> {f.answer}
                </p>
              </details>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
