import { SYSTEM_PROMPT } from "@/lib/system-prompt"
import { google } from "@ai-sdk/google"
import { streamText } from "ai"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: "No prompt provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    let metadata: any = null
    let groundingMetadata: any = null

    // Use streamText with onFinish to capture the metadata
    const result = streamText({
      model: google("gemini-2.5-flash-preview-04-17", {
        useSearchGrounding: true,
      }),
      system: SYSTEM_PROMPT,
      prompt,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 3000,
          },
        },
      },
      temperature: 0.7,
      maxTokens: 10000,
      onChunk: ({ chunk }) => {
        // Stream text chunks in real-time to the client
        if (chunk.type === "reasoning") {
          console.log("reasoning chunk:",chunk.textDelta)
          //dataStream.writeData({ type: "text-delta", text: chunk.textDelta })
        }
      },
      onFinish: ({ providerMetadata }) => {
        metadata = providerMetadata
        // Try to extract the groundingMetadata
        if (providerMetadata && typeof providerMetadata === "object") {
          const googleMetadata = providerMetadata as any
          if (googleMetadata.google && googleMetadata.google.groundingMetadata) {
            groundingMetadata = googleMetadata.google.groundingMetadata
          }
        }
      },
    })

    // Consume the stream to ensure onFinish is called
    let fullText = ""
    for await (const chunk of result.textStream) {
      fullText += chunk
    }

    // Return the metadata and text
    return new Response(
      JSON.stringify({
        text: fullText,
        fullMetadata: metadata,
        groundingMetadata,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("Error in debug API:", error)
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
