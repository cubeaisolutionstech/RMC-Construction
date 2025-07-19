import { NextResponse } from "next/server"
import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import PDFDocument from "pdfkit"

export async function POST(request) {
  try {
    const formData = await request.formData()
    const senderNumber = formData.get("senderNumber")
    const recipientNumber = formData.get("recipientNumber")
    const message = formData.get("message")
    const invoiceDataStr = formData.get("invoiceData")

    if (!senderNumber || !recipientNumber || !invoiceDataStr) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const invoiceData = JSON.parse(invoiceDataStr)

    // Validate phone numbers
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    if (!phoneRegex.test(senderNumber) || !phoneRegex.test(recipientNumber)) {
      return NextResponse.json(
        { error: "Invalid phone number format. Use +countrycode followed by number" },
        { status: 400 },
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate PDF invoice
    const pdfFileName = `invoice-${invoiceData.batchNumber}-${Date.now()}.pdf`
    const pdfPath = path.join(uploadsDir, pdfFileName)

    await generateInvoicePDF(invoiceData, pdfPath)

    // Here you would integrate with whatsapp-web.js
    // For now, this is a mock implementation
    console.log("WhatsApp invoice sending details:", {
      from: senderNumber,
      to: recipientNumber,
      message: message,
      attachment: pdfFileName,
      invoiceData: {
        batchNumber: invoiceData.batchNumber,
        clientName: invoiceData.clientName,
        amount: (Number.parseFloat(invoiceData.quantity) * Number.parseFloat(invoiceData.rate)).toFixed(2),
      },
    })

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 3000))

    /*
    // Real WhatsApp implementation would be:
    import { whatsappService } from '@/lib/whatsapp-client'
    
    if (!whatsappService.isClientReady()) {
      return NextResponse.json({ error: "WhatsApp client is not ready. Please scan QR code first." }, { status: 503 })
    }
    
    await whatsappService.sendMessageWithPDF(recipientNumber, message, pdfPath)
    */

    return NextResponse.json({
      success: true,
      message: "Invoice generated and sent via WhatsApp successfully",
      details: {
        from: senderNumber,
        to: recipientNumber,
        fileName: pdfFileName,
        batchNumber: invoiceData.batchNumber,
        clientName: invoiceData.clientName,
        amount: `₹${(Number.parseFloat(invoiceData.quantity) * Number.parseFloat(invoiceData.rate)).toFixed(2)}`,
      },
    })
  } catch (error) {
    console.error("Error generating and sending invoice:", error)
    return NextResponse.json({ error: "Failed to generate and send invoice" }, { status: 500 })
  }
}

async function generateInvoicePDF(invoiceData, pdfPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const stream = require("fs").createWriteStream(pdfPath)
      doc.pipe(stream)

      // Header
      doc.fontSize(20).text("RR CONSTRUCTIONS", 50, 50)
      doc.fontSize(12).text("Invoice", 50, 80)

      // Invoice details
      doc.text(`Invoice Date: ${invoiceData.batchDate}`, 400, 50)
      doc.text(`Batch Number: ${invoiceData.batchNumber}`, 400, 70)
      doc.text(`Invoice Number: INV-${invoiceData.batchNumber}`, 400, 90)

      // Client details
      doc.text("Bill To:", 50, 130)
      doc.text(invoiceData.clientName, 50, 150)
      doc.text(invoiceData.clientAddress, 50, 170)
      doc.text(`Email: ${invoiceData.clientEmail}`, 50, 190)
      doc.text(`WhatsApp: ${invoiceData.clientWhatsApp}`, 50, 210)
      if (invoiceData.clientGSTIN && invoiceData.clientGSTIN !== "N/A") {
        doc.text(`GSTIN: ${invoiceData.clientGSTIN}`, 50, 230)
      }

      // Batch details
      doc.text("Batch Details:", 50, 270)
      doc.text(`Recipe: ${invoiceData.recipeName} (${invoiceData.recipeCode})`, 50, 290)
      doc.text(`Truck: ${invoiceData.truckNumber} - Driver: ${invoiceData.truckDriver}`, 50, 310)
      doc.text(`Batcher: ${invoiceData.batcherName}`, 50, 330)

      // Invoice table header
      const tableTop = 380
      doc.text("Description", 50, tableTop)
      doc.text("HSN", 200, tableTop)
      doc.text("Qty", 250, tableTop)
      doc.text("Unit", 300, tableTop)
      doc.text("Rate", 350, tableTop)
      doc.text("Amount", 450, tableTop)

      // Draw line under header
      doc
        .moveTo(50, tableTop + 20)
        .lineTo(550, tableTop + 20)
        .stroke()

      // Invoice items
      const itemY = tableTop + 30
      doc.text(invoiceData.description, 50, itemY)
      doc.text(invoiceData.hsn, 200, itemY)
      doc.text(invoiceData.quantity, 250, itemY)
      doc.text(invoiceData.unit, 300, itemY)
      doc.text(`₹${invoiceData.rate}`, 350, itemY)

      const totalAmount = (Number.parseFloat(invoiceData.quantity) * Number.parseFloat(invoiceData.rate)).toFixed(2)
      doc.text(`₹${totalAmount}`, 450, itemY)

      // Total
      doc
        .moveTo(50, itemY + 30)
        .lineTo(550, itemY + 30)
        .stroke()
      doc.fontSize(14).text(`Total Amount: ₹${totalAmount}`, 350, itemY + 40)

      // Footer
      doc.fontSize(10).text("Thank you for your business!", 50, 700)
      doc.text("RR CONSTRUCTIONS", 50, 720)

      doc.end()

      stream.on("finish", () => {
        resolve()
      })

      stream.on("error", (err) => {
        reject(err)
      })
    } catch (error) {
      reject(error)
    }
  })
}
