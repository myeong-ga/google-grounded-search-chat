"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"

export type Message = {
  role: "user" | "assistant"
  content: string
}

export type Source = {
  url: string
  title: string
}

// Updated interface to match Google Gemini API structure
interface GoogleGroundingMetadata {
  searchEntryPoint?: {
    renderedContent: string
  }
  groundingChunks?: Array<{
    web?: {
      uri: string
      title: string
    }
  }>
  groundingSupports?: Array<{
    segment: {
      startIndex?: number
      endIndex: number
      text: string
    }
    groundingChunkIndices: number[]
    confidenceScores: number[]
  }>
  webSearchQueries?: string[]
}

export function useSearchChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()

      if (!input.trim() || isLoading) return

      // Add user message to the chat
      const userMessage: Message = { role: "user", content: input }
      setMessages((prev) => [...prev, userMessage])

      // Clear input and set loading state
      setInput("")
      setIsLoading(true)
      setSources([])

      // Create a placeholder for the assistant's message
      const assistantMessageIndex = messages.length + 1
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      // Create an abort controller for the fetch request
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, userMessage] }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error("Failed to fetch response")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n\n")

          for (const line of lines) {
            if (!line.trim() || !line.startsWith("data: ")) continue

            try {
              const data = JSON.parse(line.substring(6))
              console.log("Received data type:", data.type)
              if (data.type === "text") {
                accumulatedContent += data.content
                setMessages((prev) => {
                  const newMessages = [...prev]
                  newMessages[assistantMessageIndex] = {
                    role: "assistant",
                    content: accumulatedContent,
                  }
                  return newMessages
                })
              } else if (data.type === "sources" && data.content) {
                // Process sources from grounding metadata using the updated structure
                const groundingMetadata = data.content as GoogleGroundingMetadata
                const extractedSources: Source[] = []
                console.log("Grounding Metadata:", groundingMetadata)
                // Extract sources from groundingChunks
                if (groundingMetadata.groundingChunks) {
                  groundingMetadata.groundingChunks.forEach((chunk) => {
                    if (chunk.web && chunk.web.uri) {
                      extractedSources.push({
                        url: chunk.web.uri,
                        title: chunk.web.title || new URL(chunk.web.uri).hostname,
                      })
                    }
                  })
                }

                // Remove duplicate sources based on URL
                const uniqueSources = extractedSources.filter(
                  (source, index, self) => index === self.findIndex((s) => s.url === source.url),
                )

                setSources(extractedSources)
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e)
            }
          }
        }
      } catch (error) {
        // if (error.name !== "AbortError") {
          console.error("Error in chat:", error)
          setMessages((prev) => {
            const newMessages = [...prev]
            newMessages[assistantMessageIndex] = {
              role: "assistant",
              content: "Sorry, there was an error processing your request.",
            }
            return newMessages
          })
       // }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [input, isLoading, messages],
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }, [])

  return {
    messages,
    input,
    isLoading,
    sources,
    handleSubmit,
    handleInputChange,
    stopGenerating,
  }
}
