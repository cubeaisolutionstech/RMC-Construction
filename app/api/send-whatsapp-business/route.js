// Alternative 2: WhatsApp Business API (Official but requires business verification)
import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const formData = await request.formData()
    const recipientNumber = formData.get("recipientNumber")
    const message = formData.get("message")
    const pdfFile = formData.get("pdfFile")

    // WhatsApp Business API implementation
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    // First upload the PDF
    const mediaResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData, // Contains the PDF file
    })

    const mediaData = await mediaResponse.json()

    // Then send the message with media
    const messageResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientNumber.replace("+", ""),
        type: "document",
        document: {
          id: mediaData.id,
          caption: message,
        },
      }),
    })

    const result = await messageResponse.json()

    return NextResponse.json({
      success: true,
      messageId: result.messages[0].id,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
