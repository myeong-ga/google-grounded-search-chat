import type React from "react"
import { cn } from "@/lib/utils"
import type { Message } from "ai"
import { User, Bot } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism"
import remarkGfm from "remark-gfm"

interface ChatMessageProps {
  message: Message
}

// Define a type for the code component props
interface CodeComponentProps {
  node?: any
  inline?: boolean
  className?: string
  children?: React.ReactNode
  [key: string]: any
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={cn("flex gap-3 p-4", message.role === "user" ? "bg-muted/50" : "bg-background")}>
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
        {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2">
        {message.role === "assistant" ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none font-mono">
            {message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ node, inline, className, children, ...props }: CodeComponentProps) => {
                    const match = /language-(\w+)/.exec(className || "")
                    return !inline && match ? (
                      <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                  // Ensure links open in new tab
                  a: ({ node, ...props }: any) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                  // Add custom styling for tables
                  table: ({ node, ...props }: any) => (
                    <div className="overflow-x-auto">
                      <table className="border-collapse border border-border" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }: any) => (
                    <th className="border border-border bg-muted px-4 py-2 text-left" {...props} />
                  ),
                  td: ({ node, ...props }: any) => <td className="border border-border px-4 py-2" {...props} />,
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="h-5 w-20 animate-pulse rounded bg-muted"></div>
            )}
          </div>
        ) : (
          <div className="prose prose-neutral dark:prose-invert font-mono">
            {message.content || <div className="h-5 w-20 animate-pulse rounded bg-muted"></div>}
          </div>
        )}
      </div>
    </div>
  )
}
