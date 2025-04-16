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
    const result = await streamText({
      model: google("gemini-2.0-flash-exp", {
        useSearchGrounding: true,
      }),
      prompt,
      temperature: 0.7,
      maxTokens: 1024,
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
