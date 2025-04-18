import { SYSTEM_PROMPT } from "@/lib/system-prompt"
import { google } from "@ai-sdk/google"
import { createDataStreamResponse, streamText } from "ai"
import type { NextRequest } from "next/server"

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

interface GoogleProviderMetadata {
  google?: {
    groundingMetadata?: GoogleGroundingMetadata
    safetyRatings?: any
  }
}

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    // Get the last user message
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop()

    if (!lastUserMessage) {
      return new Response("No user message found", { status: 400 })
    }

    // Use createDataStreamResponse which is designed for this exact use case
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Log that we're starting
        console.log("Starting stream execution")

        // Create a stream using the Google Gemini model with search grounding
        const result = streamText({
          model: google("gemini-2.5-flash-preview-04-17", {
            useSearchGrounding: true,
          }),
          system: SYSTEM_PROMPT,
          messages,
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 3000,
              },
            },
          },
          temperature: 0.7,
          maxTokens: 10000,
          // 1. Text streaming in onChunk handler
          onChunk: ({ chunk }) => {
            // Stream text chunks in real-time to the client
            if (chunk.type === "text-delta") {
              console.log("Streaming text chunk:", chunk.textDelta.length, "chars")
              dataStream.writeData({ type: "text-delta", text: chunk.textDelta })
            }
          },
          // 2. Sources processing in onFinish handler
          onFinish: ({ text, providerMetadata }) => {
            console.log("onFinish called, text length:", text.length)

            // Extract and send sources
            try {
              const metadata = providerMetadata as unknown as GoogleProviderMetadata
              if (metadata?.google?.groundingMetadata) {
                console.log("Found grounding metadata in onFinish, sending to client")

                // Extract sources from groundingChunks
                const sources: { url: string; title: string }[] = []
                if (metadata.google.groundingMetadata.groundingChunks) {
                  metadata.google.groundingMetadata.groundingChunks.forEach((chunk) => {
                    if (chunk.web && chunk.web.uri) {
                      sources.push({
                        url: chunk.web.uri,
                        title: chunk.web.title || new URL(chunk.web.uri).hostname,
                      })
                    }
                  })
                }

                // Send the processed sources directly
                if (sources.length > 0) {
                  console.log(`Sending ${sources.length} sources to client`)
                  dataStream.writeData({ type: "sources", sources })
                } else {
                  console.log("No sources found in metadata")
                }
              } else {
                console.log("No grounding metadata found in onFinish")
              }
            } catch (error) {
              console.error("Error processing metadata in onFinish:", error)
            }
          },
        })

        // Merge the text stream into our data stream
        result.mergeIntoDataStream(dataStream)
      },
      onError: (error) => {
        console.error("Error in stream:", error)
        return error instanceof Error ? error.message : String(error)
      },
    })
  } catch (error) {
    console.error("Error in chat API:", error)
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
