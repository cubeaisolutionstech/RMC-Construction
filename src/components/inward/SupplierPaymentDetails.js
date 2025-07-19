"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const SupplierPaymentDetails = () => {
  const [paymentDetails, setPaymentDetails] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPaymentDetails()
  }, [])

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch("http://localhost:5000/supplier-payment-details")
      const data = await response.json()
      setPaymentDetails(data)
    } catch (error) {
      console.error("Error fetching supplier payment details:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(paymentDetails)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Payment Details")
    XLSX.writeFile(workbook, "supplier_payment_details.xlsx")
  }

  const getTotalAmount = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.total_amount || 0), 0).toFixed(2)
  }

  const getTotalPaid = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.paid_amount || 0), 0).toFixed(2)
  }

  const getTotalPending = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.pending_amount || 0), 0).toFixed(2)
  }

  if (loading) {
    return (
      <div className="supplier-payment-details">
        <div className="loading">Loading payment details...</div>
      </div>
    )
  }

  return (
    <div className="supplier-payment-details">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">💰</div>
          <h2>Supplier Payment Details</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-refresh" onClick={fetchPaymentDetails}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="payment-summary">
        <div className="summary-cards">
          <div className="summary-card total">
            <h4>Total PO Amount</h4>
            <span className="summary-number">₹{getTotalAmount()}</span>
          </div>
          <div className="summary-card paid">
            <h4>Paid Amount</h4>
            <span className="summary-number">₹{getTotalPaid()}</span>
          </div>
          <div className="summary-card pending">
            <h4>Pending Amount</h4>
            <span className="summary-number">₹{getTotalPending()}</span>
          </div>
        </div>
      </div>

      <div className="payment-details-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Material</th>
              <th>Quantity Ordered</th>
              <th>Total PO Amount (₹)</th>
              <th>Paid Amount (₹)</th>
              <th>Pending Amount (₹)</th>
              <th>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {paymentDetails.map((detail, index) => (
              <tr key={detail.id}>
                <td>{index + 1}</td>
                <td>{detail.po_number}</td>
                <td>{detail.supplier_name}</td>
                <td>{detail.material}</td>
                <td>{detail.quantity_ordered}</td>
                <td>₹{Number.parseFloat(detail.total_amount || 0).toFixed(2)}</td>
                <td>₹{Number.parseFloat(detail.paid_amount || 0).toFixed(2)}</td>
                <td>₹{Number.parseFloat(detail.pending_amount || 0).toFixed(2)}</td>
                <td>
                  <span
                    className={`status ${Number.parseFloat(detail.pending_amount || 0) === 0 ? "paid" : "pending"}`}
                  >
                    {Number.parseFloat(detail.pending_amount || 0) === 0 ? "Fully Paid" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paymentDetails.length === 0 && (
          <div className="no-data">
            <p>No supplier payment details found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SupplierPaymentDetails
