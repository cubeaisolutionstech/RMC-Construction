"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, FileText, CheckCircle, AlertCircle } from "lucide-react"

export default function WhatsAppSender() {
  const [senderNumber, setSenderNumber] = useState("")
  const [recipientNumber, setRecipientNumber] = useState("")
  const [pdfFile, setPdfFile] = useState(null)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState({ type: null, message: "" })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setPdfFile(file)
      setStatus({ type: null, message: "" })
    } else {
      setStatus({ type: "error", message: "Please select a valid PDF file" })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!senderNumber || !recipientNumber || !pdfFile) {
      setStatus({ type: "error", message: "Please fill all fields and select a PDF file" })
      return
    }

    setIsLoading(true)
    setStatus({ type: "info", message: "Sending WhatsApp message..." })

    try {
      const formData = new FormData()
      formData.append("senderNumber", senderNumber)
      formData.append("recipientNumber", recipientNumber)
      formData.append("message", message || "Please find the attached PDF document.")
      formData.append("pdfFile", pdfFile)

      const response = await fetch("/api/send-whatsapp", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setStatus({ type: "success", message: "WhatsApp message sent successfully!" })
        // Reset form
        setSenderNumber("")
        setRecipientNumber("")
        setPdfFile(null)
        setMessage("")
        // Reset file input
        const fileInput = document.getElementById("pdf-file")
        if (fileInput) fileInput.value = ""
      } else {
        setStatus({ type: "error", message: result.error || "Failed to send message" })
      }
    } catch (error) {
      setStatus({ type: "error", message: "Network error. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="mx-auto max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">WhatsApp PDF Sender</CardTitle>
            <CardDescription>Send PDF documents via WhatsApp automatically</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sender-number">Sender WhatsApp Number</Label>
                <Input
                  id="sender-number"
                  type="tel"
                  placeholder="+1234567890"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient-number">Recipient WhatsApp Number</Label>
                <Input
                  id="recipient-number"
                  type="tel"
                  placeholder="+1234567890"
                  value={recipientNumber}
                  onChange={(e) => setRecipientNumber(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <Input
                  id="message"
                  placeholder="Enter your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-file">PDF File</Label>
                <div className="relative">
                  <Input
                    id="pdf-file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    required
                  />
                  {pdfFile && (
                    <div className="mt-2 flex items-center text-sm text-green-600">
                      <FileText className="mr-2 h-4 w-4" />
                      {pdfFile.name}
                    </div>
                  )}
                </div>
              </div>

              {status.type && (
                <Alert
                  className={`${
                    status.type === "success"
                      ? "border-green-200 bg-green-50"
                      : status.type === "error"
                        ? "border-red-200 bg-red-50"
                        : "border-blue-200 bg-blue-50"
                  }`}
                >
                  {status.type === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {status.type === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
                  {status.type === "info" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  <AlertDescription
                    className={`${
                      status.type === "success"
                        ? "text-green-800"
                        : status.type === "error"
                          ? "text-red-800"
                          : "text-blue-800"
                    }`}
                  >
                    {status.message}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send WhatsApp Message
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-lg bg-yellow-50 p-4">
              <h3 className="font-semibold text-yellow-800">Setup Instructions:</h3>
              <ol className="mt-2 list-decimal list-inside text-sm text-yellow-700 space-y-1">
                <li>Install required packages: npm install whatsapp-web.js qrcode-terminal</li>
                <li>Run the application and scan QR code with WhatsApp</li>
                <li>Keep the browser tab open for WhatsApp Web connection</li>
                <li>Numbers should include country code (e.g., +1234567890)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
