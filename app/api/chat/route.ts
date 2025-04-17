import { google } from "@ai-sdk/google"
import { streamText } from "ai"
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

    // Declare a variable in the outer scope to store the grounding metadata
    let capturedGroundingMetadata: GoogleGroundingMetadata | undefined = undefined
    let metadataReady = false

    // Create a stream using the Google Gemini model with search grounding
    const result = await streamText({
      model: google("gemini-2.0-flash", {
        useSearchGrounding: true,
      }),
      prompt: lastUserMessage.content,
      temperature: 0.7,
      maxTokens: 1024,
      onFinish: ({ text, providerMetadata }) => {
        // Log the full provider metadata to inspect its structure
        console.log("Stream finished with text:", text.substring(0, 100) + "...")

        // Specifically extract and store the groundingMetadata if it exists
        const metadata = providerMetadata as unknown as GoogleProviderMetadata
        if (metadata?.google?.groundingMetadata) {
          console.log("Found grounding metadata in onFinish, storing it")
          capturedGroundingMetadata = metadata.google.groundingMetadata
          metadataReady = true

          // Log specific parts of interest
          // console.log("webSearchQueries:", capturedGroundingMetadata.webSearchQueries)
          // console.log("groundingChunks count:", capturedGroundingMetadata.groundingChunks?.length || 0)
          // console.log("groundingSupports count:", capturedGroundingMetadata.groundingSupports?.length || 0)
        } else {
          console.log("No grounding metadata found in the response")
        }
      },
    })

    // Create a custom stream that includes both text and sources
    const textEncoder = new TextEncoder()
    const customStream = new TransformStream()
    const writer = customStream.writable.getWriter()

    // Stream the text response
    result.textStream
      .pipeTo(
        new WritableStream({
          async write(chunk) {
            await writer.write(textEncoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`))
          },
          async close() {
            console.log("Text stream complete, metadata ready:", metadataReady)

            // Use the captured metadata from onFinish
            if (metadataReady && capturedGroundingMetadata) {
              console.log("Sending metadata at stream close using captured metadata")
              try {
                await writer.write(
                  textEncoder.encode(
                    `data: ${JSON.stringify({
                      type: "sources",
                      content: capturedGroundingMetadata,
                    })}\n\n`,
                  ),
                )
                console.log("Metadata sent successfully")
              } catch (error) {
                console.error("Error sending metadata:", error)
              }
            } else {
              console.log("No metadata available to send")
            }

            // Add a small delay to ensure all data is processed
            await new Promise((resolve) => setTimeout(resolve, 200))
            console.log("Closing writer")
            await writer.close()
          },
          abort(reason) {
            console.error("Stream aborted:", reason)
            writer.abort(reason)
          },
        }),
      )
      .catch((error) => {
        console.error("Error in pipeTo:", error)
        writer.close().catch((e) => console.error("Failed to close writer after error:", e))
      })

    return new Response(customStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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
