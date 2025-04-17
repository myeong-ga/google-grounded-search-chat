"use client"

import type React from "react"

import { useRef, useEffect } from "react"
import { useSearchChat } from "@/hooks/use-search-chat"
import { ChatMessage } from "@/components/chat-message"
import { SourcesList } from "@/components/sources-list"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, StopCircle } from "lucide-react"

export function Chat() {
  const { messages, input, isLoading, sources, handleSubmit, handleInputChange, stopGenerating } = useSearchChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Handle Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      formRef.current?.requestSubmit()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3 max-w-md px-4">
              <h2 className="text-2xl font-bold">Google Search-Grounded Chatbot</h2>
              <p className="text-muted-foreground">
                Ask me anything and I'll use Google search to provide up-to-date information.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}
            {sources.length > 0 && (
              <div className="p-4">
                <SourcesList sources={sources} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="min-h-24 resize-none pr-20"
              disabled={isLoading}
            />
            <div className="absolute right-2 bottom-2">
              {isLoading ? (
                <Button type="button" size="icon" variant="ghost" onClick={stopGenerating} className="h-8 w-8">
                  <StopCircle className="h-4 w-4" />
                  <span className="sr-only">Stop generating</span>
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} className="h-8 w-8">
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send message</span>
                </Button>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            Press <kbd className="rounded border px-1 py-0.5 bg-muted">Ctrl</kbd> +{" "}
            <kbd className="rounded border px-1 py-0.5 bg-muted">Enter</kbd> to send
          </div>
        </form>
      </div>
    </div>
  )
}
