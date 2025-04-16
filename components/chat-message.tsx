import { cn } from "@/lib/utils"
import type { Message } from "@/hooks/use-search-chat"
import { User, Bot } from "lucide-react"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={cn("flex gap-3 p-4", message.role === "user" ? "bg-muted/50" : "bg-background")}>
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
        {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="prose prose-neutral dark:prose-invert">
          {message.content || <div className="h-5 w-20 animate-pulse rounded bg-muted"></div>}
        </div>
      </div>
    </div>
  )
}
