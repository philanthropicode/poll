// PollDescription.jsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";


// Extend sanitize schema to ensure lists & links are allowed
const schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "ul",
    "ol",
    "li",
    "input" // for GFM task list checkboxes
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a || []),
      ["target"],
      ["href"],
      ["rel"]
    ],
    ol: [["start"]], // allow numbered lists with a custom start
    input: [["type"], ["checked"], ["disabled"]],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
  },
};

export default function PollDescription({ description = "" }) {
  return (
    // Force spacing on paragraphs; ensure lists display markers/indentation
    <div className="text-sm max-w-none [&_p]:!mb-5 [&_p]:leading-relaxed [&_p:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            />
          ),
          // Paragraph spacing
          p: ({ node, ...props }) => (
            <p {...props} className="!mb-5 leading-relaxed" />
          ),
          // Ensure bullets/numbers are visible even if global CSS resets them
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc list-outside pl-6 my-4" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal list-outside pl-6 my-4" />
          ),
          li: ({ node, ...props }) => <li {...props} className="my-1" />,
        }}
      >
        {description}
      </ReactMarkdown>
    </div>
  );
}
