"use client";

import { useState } from "react";
import { useConsole } from "../../lib/console";
import { FALLBACK_HELP, HELP } from "../../lib/help";
import { CloseIcon, ExternalIcon, ThumbsDownIcon, ThumbsUpIcon } from "../common/icons";
import { Button, IconButton } from "../common/ui";

export function HelpPanel({ topic, onClose }: { topic: string; onClose: () => void }) {
  const { notify } = useConsole();
  const content = HELP[topic] ?? FALLBACK_HELP;
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);
  return (
    <>
      <div className="tools-header">
        <h2>{content.title}</h2>
        <IconButton label="Close help panel" onClick={onClose}>
          <CloseIcon size={18} />
        </IconButton>
      </div>
      <div className="tools-body help-body">
        {content.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {content.important && (
          <>
            <h3>Important</h3>
            {content.important.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </>
        )}
        <h3>Was this content helpful?</h3>
        <div className="help-vote">
          {(["yes", "no"] as const).map((vote) => (
            <Button
              key={vote}
              onClick={() => {
                setVoted(vote);
                notify({ type: "success", header: "Thanks for your feedback." });
              }}
              aria-pressed={voted === vote}
            >
              {vote === "yes" ? <ThumbsUpIcon size={14} /> : <ThumbsDownIcon size={14} />} {vote === "yes" ? "Yes" : "No"}
            </Button>
          ))}
        </div>
        {content.learnMore && (
          <>
            <hr />
            <h3>
              Learn more <ExternalIcon size={13} />
            </h3>
            <a href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/" target="_blank" rel="noreferrer">
              {content.learnMore}
            </a>
          </>
        )}
      </div>
    </>
  );
}
