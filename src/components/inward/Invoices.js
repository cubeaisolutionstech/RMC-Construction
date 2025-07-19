"use client"

import { useState, useEffect } from "react"

const Invoices = () => {
  const [batchSlips, setBatchSlips] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalContent, setModalContent] = useState(null)
  const [modalType, setModalType] = useState("") // 'invoice' or 'batchslip'
  const [isLoading, setIsLoading] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("+91")

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await fetch("http://localhost:5000/invoices")
      const data = await response.json()
      setBatchSlips(data) // Using same state for invoices
    } catch (error) {
      console.error("Error fetching invoices:", error)
    }
  }

  // Dynamic import for PDF libraries to avoid SSR issues
  const loadPDFLibraries = async () => {
    try {
      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default
      return { jsPDF, autoTable }
    } catch (error) {
      console.error("Failed to load PDF libraries:", error)
      throw new Error("PDF libraries not available")
    }
  }

  const generateInvoicePDF = async (invoice) => {
    try {
      const { jsPDF, autoTable } = await loadPDFLibraries()
      const doc = new jsPDF()

      // Header
      doc.setFontSize(16)
      doc.setFont(undefined, "bold")
      doc.text("RR CONSTRUCTIONS", 20, 20)
      doc.text("Tax Invoice", 150, 20)

      doc.setFontSize(10)
      doc.setFont(undefined, "normal")
      doc.text("GSTIN: 33AAGFT4474P1Z1", 20, 30)
      doc.text(`Invoice No: ${invoice.invoiceNumber}`, 150, 30)
      doc.text("Excel College Campus, NH 91, Mathura", 20, 35)
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 150, 35)
      doc.text("Road, Haryana - 121102", 20, 40)
      doc.text(`Batch Number: ${invoice.batchNumber}`, 150, 40)
      doc.text("GST/NSN: 33AAGFT4474P1Z1", 20, 45)
      doc.text("Terms of Delivery: As per Order &", 150, 45)
      doc.text("Biller: INFRA LP", 20, 50)
      doc.text("Cheque", 150, 50)
      doc.text("State Name: Tamil Nadu, India", 20, 55)

      // Bill To section
      doc.setFont(undefined, "bold")
      doc.text("Bill To:", 20, 70)
      doc.text("Dispatch Site:", 150, 70)
      doc.setFont(undefined, "normal")
      doc.text(invoice.clientName, 20, 80)
      doc.text("N/A", 150, 80)
      doc.text(invoice.clientAddress, 20, 85)
      doc.text("Bill of Lading/Ref No: N/A", 150, 85)
      doc.text(`GSTIN: ${invoice.clientGSTIN || "N/A"}`, 20, 90)

      // Table using autoTable
      const tableData = [
        [invoice.description, invoice.hsn, invoice.quantity, `₹${invoice.rate}`, invoice.unit, `₹${invoice.total}`],
      ]

      autoTable(doc, {
        startY: 100,
        head: [["Description", "HSN", "Quantity", "Rate", "Per", "Amount"]],
        body: tableData,
        theme: "grid",
      })

      // Totals
      const finalY = doc.lastAutoTable.finalY + 10
      doc.text(`Total: ₹${invoice.total}`, 150, finalY)
      doc.text(`Output-CGST @ 9%: ₹${invoice.cgst}`, 150, finalY + 10)
      doc.text(`Output-SGST @ 9%: ₹${invoice.sgst}`, 150, finalY + 20)
      doc.setFont(undefined, "bold")
      doc.text(`Grand Total: ₹${invoice.grandTotal}`, 150, finalY + 30)

      // Amount in words
      doc.setFont(undefined, "normal")
      doc.text(`Amount Chargeable (in words): ${invoice.amountInWords}`, 20, finalY + 50)

      // Footer
      doc.text("Subject to the Tirupati Jurisdiction", 20, finalY + 70)
      doc.text("This is a Computer Generated Invoice", 150, finalY + 70)
      doc.text("Authorised Signatory", 20, finalY + 80)

      return doc
    } catch (error) {
      console.error("Error generating invoice PDF:", error)
      throw error
    }
  }

  const generateBatchSlipPDF = async (batchSlip) => {
    try {
      const { jsPDF } = await loadPDFLibraries()
      const doc = new jsPDF()

      // Header - Company Name (centered)
      doc.setFontSize(14)
      doc.setFont(undefined, "bold")
      doc.text("RR CONSTRUCTIONS", 105, 20, { align: "center" })

      doc.setFontSize(9)
      doc.setFont(undefined, "normal")
      doc.text("MCI 70 Control System Ver 3.1", 105, 27, { align: "center" })
      doc.text("SCHWING Stetter", 105, 32, { align: "center" })

      // Title Section with border
      doc.setFontSize(10)
      doc.setFont(undefined, "bold")

      // Draw title box
      doc.rect(20, 40, 120, 8)
      doc.rect(140, 40, 50, 8)
      doc.text("Docket / Batch Report / Autographic Record", 25, 46)
      doc.text("Plant Serial", 145, 44)
      doc.text(`Number: ${batchSlip.plantSerialNumber || "3494"}`, 145, 47)

      // Details Section - Two columns with borders
      let yPos = 55

      // Left column details
      const leftDetails = [
        ["Batch Date", batchSlip.batchDate || "2025-05-06"],
        ["Batch Start Time", batchSlip.batchStartTime || "08:00"],
        ["Batch End Time", batchSlip.batchEndTime || "08:30"],
        ["Batch Number / Docket Number", batchSlip.batchNumber || "1234"],
        ["Customer", batchSlip.customer || "Client A"],
        ["Site", batchSlip.site || "Client A"],
        ["Recipe Code", batchSlip.recipeCode || "M10"],
        ["Recipe Name", batchSlip.recipeName || "Default Recipe"],
        ["Truck Number", batchSlip.truckNumber || "tm123564"],
        ["Truck Driver", batchSlip.truckDriver || "murugesan"],
        ["Order Number", batchSlip.orderNumber || "1"],
        ["Batcher Name", batchSlip.batcherName || "ss"],
      ]

      // Right column details
      const rightDetails = [
        ["Ordered Quantity", `${batchSlip.orderedQuantity || "10.00"} M³`],
        ["Production Quantity", `${batchSlip.productionQuantity || "10.00"} M³`],
        ["Adj/Manual Quantity", `${batchSlip.adjManualQuantity || "0.00"} M³`],
        ["With This Load", `${batchSlip.withThisLoad || "0.00"} M³`],
        ["Mixer Capacity", `${batchSlip.mixerCapacity || "0.50"} M³`],
        ["Batch Size", `${batchSlip.batchSize || "0.50"} M³`],
      ]

      doc.setFontSize(8)
      doc.setFont(undefined, "normal")

      // Draw left column
      for (let i = 0; i < leftDetails.length; i++) {
        const detail = leftDetails[i]
        const y = yPos + i * 6
        doc.rect(20, y, 60, 6)
        doc.rect(80, y, 60, 6)
        doc.text(detail[0] + " :", 22, y + 4)
        doc.text(detail[1], 82, y + 4)
      }

      // Draw right column
      for (let i = 0; i < rightDetails.length; i++) {
        const detail = rightDetails[i]
        const y = yPos + i * 6
        doc.rect(140, y, 35, 6)
        doc.rect(175, y, 15, 6)
        doc.text(detail[0] + " :", 142, y + 4)
        doc.text(detail[1], 177, y + 4)
      }

      // Material Table
      yPos = 130

      // Table headers
      const headers = ["Batch Size in M³", "SAND", "40 MM", "0", "CEM-1", "CEM-2", "CEM-3", "WATER", "0 ADMIX1"]
      const colWidths = [25, 18, 18, 12, 18, 18, 18, 18, 23]

      doc.setFontSize(7)
      doc.setFont(undefined, "bold")

      // Draw header row
      let currentX = 20
      for (let i = 0; i < headers.length; i++) {
        doc.rect(currentX, yPos, colWidths[i], 8)
        doc.text(headers[i], currentX + 1, yPos + 5)
        currentX += colWidths[i]
      }

      // Data rows (20 rows as shown in image)
      doc.setFont(undefined, "normal")
      const rowData = ["145.00", "75.00", "150.00", "0.00", "25.00", "25.00", "25.00", "45.00", "0.38"]

      for (let row = 0; row < 20; row++) {
        yPos += 8
        currentX = 20

        for (let col = 0; col < rowData.length; col++) {
          doc.rect(currentX, yPos, colWidths[col], 8)
          doc.text(rowData[col], currentX + 2, yPos + 5)
          currentX += colWidths[col]
        }
      }

      // Total Set Weight row
      yPos += 8
      currentX = 20
      doc.setFont(undefined, "bold")

      const totalSetData = [
        "Total Set Weight",
        "1500.00",
        "3000.00",
        "0.00",
        "500.00",
        "500.00",
        "500.00",
        "900.00",
        "7.50",
      ]

      for (let i = 0; i < totalSetData.length; i++) {
        doc.rect(currentX, yPos, colWidths[i], 8)
        doc.text(totalSetData[i], currentX + 1, yPos + 5)
        currentX += colWidths[i]
      }

      // Add some spacing
      yPos += 15

      // Total Actual row
      currentX = 20
      const totalActualData = [
        "Total Actual",
        "1500.00",
        "3000.00",
        "0.00",
        "500.00",
        "500.00",
        "500.00",
        "900.00",
        "7.50",
      ]

      for (let i = 0; i < totalActualData.length; i++) {
        doc.rect(currentX, yPos, colWidths[i], 8)
        doc.text(totalActualData[i], currentX + 1, yPos + 5)
        currentX += colWidths[i]
      }

      // Footer - Batcher Name
      doc.setFont(undefined, "normal")
      doc.setFontSize(9)
      doc.text(`Batcher Name :`, 20, yPos + 20)
      doc.text(batchSlip.batcherName || "ss", 20, yPos + 25)

      return doc
    } catch (error) {
      console.error("Error generating batch slip PDF:", error)
      throw error
    }
  }

  // Generate text fallback for when PDF fails
  const generateInvoiceText = (invoice) => {
    return `🧾 INVOICE DETAILS

Company: RR CONSTRUCTIONS
GSTIN: 33AAGFT4474P1Z1
Address: Excel College Campus, NH 91, Mathura Road, Haryana - 121102

Invoice No: ${invoice.invoiceNumber}
Date: ${new Date(invoice.createdAt).toLocaleDateString()}
Batch Number: ${invoice.batchNumber}

Bill To:
${invoice.clientName}
${invoice.clientAddress}
GSTIN: ${invoice.clientGSTIN || "N/A"}

Item Details:
Description: ${invoice.description}
HSN: ${invoice.hsn}
Quantity: ${invoice.quantity}
Rate: ₹${invoice.rate}
Unit: ${invoice.unit}
Amount: ₹${invoice.total}

Tax Calculation:
Subtotal: ₹${invoice.total}
CGST @ 9%: ₹${invoice.cgst}
SGST @ 9%: ₹${invoice.sgst}
Grand Total: ₹${invoice.grandTotal}

Amount in Words: ${invoice.amountInWords}

Subject to Tirupati Jurisdiction
This is a Computer Generated Invoice`
  }

  const generateBatchSlipText = (batchSlip) => {
    return `📋 BATCH SLIP DETAILS

Company: RR CONSTRUCTIONS
MCI 70 Control System Ver 3.1
SCHWING Stetter

Batch Information:
Batch Number: ${batchSlip.batchNumber}
Batch Date: ${batchSlip.batchDate || "2025-05-06"}
Customer: ${batchSlip.customer}
Recipe Code: ${batchSlip.recipeCode}

Production Details:
Ordered Quantity: ${batchSlip.orderedQuantity || "10.00"} M³
Production Quantity: ${batchSlip.productionQuantity || "10.00"} M³
Batch Size: ${batchSlip.batchSize || "0.50"} M³

Truck Information:
Truck Number: ${batchSlip.truckNumber}
Truck Driver: ${batchSlip.truckDriver}
Batcher Name: ${batchSlip.batcherName}

Plant Serial Number: ${batchSlip.plantSerialNumber || "3494"}
Order Number: ${batchSlip.orderNumber || "1"}`
  }

  // WhatsApp sending function using Twilio
  const sendToWhatsApp = async (type, data) => {
    setIsLoading(true)
    try {
      console.log("Starting WhatsApp send process...")

      if (!phoneNumber || phoneNumber.length < 10) {
        throw new Error("Please enter a valid phone number with country code (e.g., +919876543210)")
      }

      let pdfBase64 = null
      let messageContent = null

      // Try to generate PDF first
      try {
        console.log("Attempting to generate PDF...")
        const doc = type === "invoice" ? await generateInvoicePDF(data) : await generateBatchSlipPDF(data)
        const pdfBlob = doc.output("blob")
        console.log("PDF generated successfully, size:", pdfBlob.size)

        // Convert to base64
        const reader = new FileReader()
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result.split(",")[1])
          reader.onerror = reject
        })
        reader.readAsDataURL(pdfBlob)
        pdfBase64 = await base64Promise
        console.log("PDF converted to base64, length:", pdfBase64.length)
      } catch (pdfError) {
        console.warn("PDF generation failed, falling back to text:", pdfError.message)
        // Generate text fallback
        messageContent = type === "invoice" ? generateInvoiceText(data) : generateBatchSlipText(data)
      }

      // Send to backend API
      console.log("Sending request to API...")
      const response = await fetch("http://localhost:8000/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: type,
          data: data,
          pdfBase64: pdfBase64,
          messageContent: messageContent,
          phoneNumber: phoneNumber,
        }),
      })

      console.log("API response status:", response.status)

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text()
        console.error("Non-JSON response:", textResponse.substring(0, 500))
        throw new Error("Server returned HTML instead of JSON. Check your API route.")
      }

      const result = await response.json()
      console.log("API response:", result)

      if (response.ok && result.success) {
        alert(
          `${type === "invoice" ? "Invoice" : "Batch slip"} sent to WhatsApp successfully!\nMessage ID: ${result.messageSid}`,
        )
      } else {
        throw new Error(result.error || "Failed to send message")
      }
    } catch (error) {
      console.error("Error sending to WhatsApp:", error)
      alert(`Failed to send to WhatsApp: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Invoice Actions
  const viewInvoice = (invoice) => {
    setModalContent(invoice)
    setModalType("invoice")
    setShowModal(true)
  }

  const downloadInvoice = async (invoice) => {
    try {
      const doc = await generateInvoicePDF(invoice)
      doc.save(`Invoice_${invoice.invoiceNumber}.pdf`)
    } catch (error) {
      console.error("PDF download failed:", error)
      // Fallback to text download
      const content = generateInvoiceText(invoice)
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Invoice_${invoice.invoiceNumber}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const sendInvoice = (invoice) => {
    if (isLoading) return
    sendToWhatsApp("invoice", invoice)
  }

  // Batch Slip Actions
  const viewBatchSlip = (batchSlip) => {
    setModalContent(batchSlip)
    setModalType("batchslip")
    setShowModal(true)
  }

  const downloadBatchSlip = async (batchSlip) => {
    try {
      const doc = await generateBatchSlipPDF(batchSlip)
      doc.save(`BatchSlip_${batchSlip.batchNumber}.pdf`)
    } catch (error) {
      console.error("PDF download failed:", error)
      // Fallback to text download
      const content = generateBatchSlipText(batchSlip)
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `BatchSlip_${batchSlip.batchNumber}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const sendBatchSlip = (batchSlip) => {
    if (isLoading) return
    sendToWhatsApp("batchslip", batchSlip)
  }

  return (
    <div className="invoices-container">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">🧾</div>
          <h2>Invoices & Batch Slips</h2>
        </div>
      </div>

      {/* Phone Number Input Section */}
      <div
        className="phone-input-section"
        style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}
      >
        <label htmlFor="phoneNumber" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          WhatsApp Phone Number:
        </label>
        <input
          id="phoneNumber"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+91XXXXXXXXXX"
          style={{
            width: "300px",
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "14px",
          }}
        />
        <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
          Include country code (e.g., +91 for India, +1 for US)
        </p>
      </div>

      {isLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div>Sending to WhatsApp...</div>
            <div style={{ marginTop: "10px" }}>Please wait...</div>
          </div>
        </div>
      )}

      {/* Invoice Details Table */}
      <div className="invoice-details-section">
        <h3>Invoice Details</h3>
        <div className="invoice-details-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Invoice Number</th>
                <th>Date</th>
                <th>Client Name</th>
                <th>Description</th>
                <th>Grand Total (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batchSlips.map((invoice, index) => (
                <tr key={invoice.id}>
                  <td>{index + 1}</td>
                  <td>{invoice.invoice_number}</td>
                  <td>{new Date(invoice.created_at).toLocaleDateString()}</td>
                  <td>{invoice.client_name}</td>
                  <td>{invoice.description}</td>
                  <td>₹{invoice.grand_total}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-view" onClick={() => viewInvoice(invoice)}>
                        View
                      </button>
                      <button className="btn btn-download" onClick={() => downloadInvoice(invoice)}>
                        Download
                      </button>
                      <button className="btn btn-send" onClick={() => sendInvoice(invoice)} disabled={isLoading}>
                        {isLoading ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {batchSlips.length === 0 && (
            <div className="no-data">
              <p>No invoices found. Create a batch slip to generate invoices.</p>
            </div>
          )}
        </div>
      </div>

      {/* Batch Slip Details Table */}
      <div className="batch-slips-section">
        <h3>Batch Slip Details</h3>
        <div className="batch-slips-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Batch Number</th>
                <th>Batch Date</th>
                <th>Customer</th>
                <th>Recipe Code</th>
                <th>Quantity (M³)</th>
                <th>Client Mail</th>
                <th>Client Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batchSlips.map((batchSlip, index) => (
                <tr key={batchSlip.id}>
                  <td>{index + 1}</td>
                  <td>{batchSlip.batchNumber}</td>
                  <td>{batchSlip.batchDate}</td>
                  <td>{batchSlip.customer}</td>
                  <td>{batchSlip.recipeCode}</td>
                  <td>{batchSlip.quantity}</td>
                  <td>{batchSlip.clientEmail}</td>
                  <td>{batchSlip.clientAddress}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-view" onClick={() => viewBatchSlip(batchSlip)}>
                        View
                      </button>
                      <button className="btn btn-download" onClick={() => downloadBatchSlip(batchSlip)}>
                        Download
                      </button>
                      <button className="btn btn-send" onClick={() => sendBatchSlip(batchSlip)} disabled={isLoading}>
                        {isLoading ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {batchSlips.length === 0 && (
            <div className="no-data">
              <p>No batch slips found. Create a batch slip to see details here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Invoice/Batch Slip View */}
      {showModal && modalContent && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalType === "invoice" ? "Invoice Preview" : "Batch Slip Preview"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              {modalType === "invoice" ? (
                <div className="invoice-preview-content">
                  <div className="invoice-layout">
                    {/* Company Header */}
                    <div className="invoice-company-header">
                      <div className="company-info">
                        <h2>RR CONSTRUCTIONS</h2>
                        <p>GSTIN: 33AAGFT4474P1Z1</p>
                        <p>Excel College Campus, NH 91, Mathura Road, Haryana - 121102</p>
                        <p>GST/NSN: 33AAGFT4474P1Z1</p>
                        <p>Biller: INFRA LP</p>
                        <p>State Name: Tamil Nadu, India</p>
                      </div>
                      <div className="invoice-info">
                        <h2>Tax Invoice</h2>
                        <p>Invoice No: {modalContent.invoiceNumber}</p>
                        <p>Date: {new Date(modalContent.createdAt).toLocaleDateString()}</p>
                        <p>Batch Number: {modalContent.batchNumber}</p>
                        <p>Terms of Delivery: As per Order & Cheque</p>
                      </div>
                    </div>

                    {/* Bill To Section */}
                    <div className="invoice-bill-section">
                      <div className="bill-to">
                        <h4>Bill To:</h4>
                        <p>{modalContent.clientName}</p>
                        <p>{modalContent.clientAddress}</p>
                        <p>GSTIN: {modalContent.clientGSTIN || "N/A"}</p>
                      </div>
                      <div className="dispatch-site">
                        <h4>Dispatch Site:</h4>
                        <p>N/A</p>
                        <p>Bill of Lading/Ref No: N/A</p>
                      </div>
                    </div>

                    {/* Invoice Table */}
                    <div className="invoice-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>HSN</th>
                            <th>Quantity</th>
                            <th>Rate</th>
                            <th>Per</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{modalContent.description}</td>
                            <td>{modalContent.hsn}</td>
                            <td>{modalContent.quantity}</td>
                            <td>₹{modalContent.rate}</td>
                            <td>{modalContent.unit}</td>
                            <td>₹{modalContent.total}</td>
                          </tr>
                          <tr>
                            <td colSpan="5">
                              <strong>Total</strong>
                            </td>
                            <td>
                              <strong>₹{modalContent.total}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan="5">Output-CGST @ 9%</td>
                            <td>₹{modalContent.cgst}</td>
                          </tr>
                          <tr>
                            <td colSpan="5">Output-SGST @ 9%</td>
                            <td>₹{modalContent.sgst}</td>
                          </tr>
                          <tr>
                            <td colSpan="5">
                              <strong>Grand Total</strong>
                            </td>
                            <td>
                              <strong>₹{modalContent.grandTotal}</strong>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div className="invoice-footer">
                      <p>
                        <strong>Amount Chargeable (in words):</strong> {modalContent.amountInWords}
                      </p>
                      <div className="footer-info">
                        <p>Subject to the Tirupati Jurisdiction</p>
                        <p>This is a Computer Generated Invoice</p>
                      </div>
                      <p>Authorised Signatory</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="batch-slip-preview-content">
                  <div className="batch-slip-layout">
                    {/* Header */}
                    <div className="batch-slip-header" style={{ textAlign: "center", marginBottom: "20px" }}>
                      <h2 style={{ margin: "0", fontSize: "18px", fontWeight: "bold" }}>RR CONSTRUCTIONS</h2>
                      <p style={{ margin: "5px 0", fontSize: "12px" }}>MCI 70 Control System Ver 3.1</p>
                      <p style={{ margin: "5px 0", fontSize: "12px" }}>SCHWING Stetter</p>
                    </div>

                    {/* Title Section */}
                    <div style={{ display: "flex", marginBottom: "20px", border: "1px solid #000" }}>
                      <div style={{ flex: "3", padding: "8px", borderRight: "1px solid #000", fontWeight: "bold" }}>
                        Docket / Batch Report / Autographic Record
                      </div>
                      <div style={{ flex: "1", padding: "8px" }}>
                        <div style={{ fontWeight: "bold" }}>Plant Serial</div>
                        <div>Number: {modalContent.plantSerialNumber || "3494"}</div>
                      </div>
                    </div>

                    {/* Details Section */}
                    <div style={{ display: "flex", marginBottom: "20px" }}>
                      {/* Left Column */}
                      <div style={{ flex: "1", marginRight: "10px" }}>
                        <div className="batch-details-grid" style={{ fontSize: "12px" }}>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>Batch Date :</div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.batchDate || "2025-05-06"}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Batch Start Time :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.batchStartTime || "08:00"}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Batch End Time :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.batchEndTime || "08:30"}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Batch Number / Docket Number :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.batchNumber}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>Customer :</div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.customer}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>Site :</div>
                            <div style={{ flex: "1", padding: "4px" }}>
                              {modalContent.site || modalContent.customer}
                            </div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Recipe Code :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.recipeCode}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Recipe Name :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>
                              {modalContent.recipeName || "Default Recipe"}
                            </div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Truck Number :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.truckNumber}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Truck Driver :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.truckDriver}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Order Number :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.orderNumber || "1"}</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000" }}>
                            <div style={{ flex: "1", padding: "4px", borderRight: "1px solid #000" }}>
                              Batcher Name :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.batcherName}</div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div style={{ flex: "0.6" }}>
                        <div style={{ fontSize: "12px" }}>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "2", padding: "4px", borderRight: "1px solid #000" }}>
                              Ordered Quantity :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>
                              {modalContent.orderedQuantity || "10.00"} M³
                            </div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "2", padding: "4px", borderRight: "1px solid #000" }}>
                              Production Quantity :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>
                              {modalContent.productionQuantity || "10.00"} M³
                            </div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "2", padding: "4px", borderRight: "1px solid #000" }}>
                              Adj/Manual Quantity :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>
                              {modalContent.adjManualQuantity || "0.00"} M³
                            </div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "2", padding: "4px", borderRight: "1px solid #000" }}>
                              With This Load :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.withThisLoad || "0.00"} M³</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000", borderBottom: "none" }}>
                            <div style={{ flex: "2", padding: "4px", borderRight: "1px solid #000" }}>
                              Mixer Capacity :
                            </div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.mixerCapacity || "0.50"} M³</div>
                          </div>
                          <div style={{ display: "flex", border: "1px solid #000" }}>
                            <div style={{ flex: "2", padding: "4px", borderRight: "1px solid #000" }}>Batch Size :</div>
                            <div style={{ flex: "1", padding: "4px" }}>{modalContent.batchSize || "0.50"} M³</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Material Table */}
                    <div style={{ marginBottom: "20px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f0f0f0" }}>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>Batch Size in M³</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>SAND</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>40 MM</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>0</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>CEM-1</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>CEM-2</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>CEM-3</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>WATER</th>
                            <th style={{ border: "1px solid #000", padding: "4px" }}>0 ADMIX1</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 20 }, (_, i) => (
                            <tr key={i}>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>145.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>75.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>150.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>0.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>25.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>25.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>25.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>45.00</td>
                              <td style={{ border: "1px solid #000", padding: "2px", textAlign: "center" }}>0.38</td>
                            </tr>
                          ))}
                          <tr style={{ backgroundColor: "#f0f0f0", fontWeight: "bold" }}>
                            <td style={{ border: "1px solid #000", padding: "4px" }}>Total Set Weight</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>1500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>3000.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>0.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>900.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>7.50</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Total Actual Section */}
                    <div style={{ marginBottom: "20px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                        <tbody>
                          <tr style={{ backgroundColor: "#f0f0f0", fontWeight: "bold" }}>
                            <td style={{ border: "1px solid #000", padding: "4px" }}>Total Actual</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>1500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>3000.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>0.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>500.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>900.00</td>
                            <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>7.50</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div style={{ fontSize: "12px" }}>
                      <p>
                        <strong>Batcher Name :</strong>
                      </p>
                      <p>{modalContent.batcherName}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Invoices
