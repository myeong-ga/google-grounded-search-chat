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

    let groundingMetadata: GoogleGroundingMetadata ;

    // Create a stream using the Google Gemini model with search grounding
    const result = await streamText({
      model: google("gemini-2.5-pro-exp-03-25", {
        useSearchGrounding: true,
      }),
      prompt: lastUserMessage.content,
      temperature: 0.7,
      maxTokens: 1024,
      onFinish: ({ text, providerMetadata }) => {
        // Log the full provider metadata to inspect its structure
        console.log("Stream finished with text:", text.substring(0, 100) + "...")
        console.log("Provider metadata:", JSON.stringify(providerMetadata, null, 2))

        // Specifically log the groundingMetadata if it exists
        const metadata = providerMetadata as unknown as GoogleProviderMetadata
        if (metadata?.google?.groundingMetadata) {
          // Extract sources from the provider metadata 
          groundingMetadata = metadata.google.groundingMetadata;
          console.log("Grounding metadata structure:", JSON.stringify(metadata.google.groundingMetadata, null, 2))

          // Log specific parts of interest
          console.log("webSearchQueries:", metadata.google.groundingMetadata.webSearchQueries)
          console.log("groundingChunks count:", metadata.google.groundingMetadata.groundingChunks?.length || 0)
          console.log("groundingSupports count:", metadata.google.groundingMetadata.groundingSupports?.length || 0)
        } else {
          console.log("No grounding metadata found in the response")
        }
      },
    })

    // Replace the streaming implementation with this improved version that ensures sources are sent

    // Create a custom stream that includes both text and sources
    const textEncoder = new TextEncoder()
    const customStream = new TransformStream()
    const writer = customStream.writable.getWriter()

    // First, ensure we have the metadata before starting to stream
    let metadataSent = false
    let textComplete = false
    let bufferedText = ""

    // Stream the text response
    result.textStream
      .pipeTo(
        new WritableStream({
          async write(chunk) {
            bufferedText += chunk
            await writer.write(textEncoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`))

            // Check if we can send metadata early (once we have some content)
            if (!metadataSent && groundingMetadata && bufferedText.length > 100) {
              console.log("Sending metadata early during streaming")
              metadataSent = true
              await writer.write(
                textEncoder.encode(
                  `data: ${JSON.stringify({
                    type: "sources",
                    content: groundingMetadata,
                  })}\n\n`,
                ),
              )
            }
          },
          async close() {
            textComplete = true
            console.log("Text stream complete, metadata sent:", metadataSent)

            // If we haven't sent metadata yet, do it now
            if (!metadataSent && groundingMetadata) {
              console.log("Sending metadata at stream close")
              try {
                await writer.write(
                  textEncoder.encode(
                    `data: ${JSON.stringify({
                      type: "sources",
                      content: groundingMetadata,
                    })}\n\n`,
                  ),
                )
                console.log("Metadata sent successfully")
              } catch (error) {
                console.error("Error sending metadata:", error)
              }
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
        if (!metadataSent && groundingMetadata && !writer.closed) {
          console.log("Attempting to send metadata after pipeTo error")
          writer
            .write(
              textEncoder.encode(
                `data: ${JSON.stringify({
                  type: "sources",
                  content: groundingMetadata,
                })}\n\n`,
              ),
            )
            .catch((e) => console.error("Failed to write metadata after error:", e))
        }
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
