"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const SupplierDetail = () => {
  const [supplierDetails, setSupplierDetails] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingBills, setUploadingBills] = useState({})

  useEffect(() => {
    fetchSupplierDetails()
    // Set up polling to check for new vehicle entries every 10 seconds
    const interval = setInterval(fetchSupplierDetails, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchSupplierDetails = async () => {
    try {
      const response = await fetch("http://localhost:5000/supplier")
      const data = await response.json()
      setSupplierDetails(data)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching supplier details:", error)
      setLoading(false)
    }
  }

  const handleFileUpload = async (supplierId, vehicleNo, file) => {
    if (!file) return

    setUploadingBills((prev) => ({ ...prev, [supplierId]: true }))

    const uploadFormData = new FormData()
    uploadFormData.append("file", file)
    uploadFormData.append("vehicle_number", vehicleNo)
    uploadFormData.append("supplier_id", supplierId)

    try {
      const response = await fetch("http://localhost:5000/supplier/upload-bill", {
        method: "POST",
        body: uploadFormData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Update the supplier detail with extracted data
        await updateSupplierWithBillData(supplierId, vehicleNo)
        alert("Bill uploaded and processed successfully!")
        fetchSupplierDetails()
      } else {
        alert(`Upload failed: ${result.message || result.error}`)
      }
    } catch (error) {
      console.error("Error uploading bill:", error)
      alert("Error uploading bill. Please ensure the extractor service is running.")
    } finally {
      setUploadingBills((prev) => ({ ...prev, [supplierId]: false }))
    }
  }

  const updateSupplierWithBillData = async (supplierId, vehicleNo) => {
    try {
      // Get extracted bill data
      const billResponse = await fetch(`http://localhost:5000/supplier/bill-data/${vehicleNo}`)
      if (billResponse.ok) {
        const billData = await billResponse.json()

        // Update supplier record with bill data
        const updateResponse = await fetch(`http://localhost:5000/supplier/${supplierId}/update-bill`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplierBillQty: billData.supplierBillQty,
            supplierBillRate: billData.supplierBillRate,
          }),
        })

        if (!updateResponse.ok) {
          console.error("Failed to update supplier with bill data")
        }
      }
    } catch (error) {
      console.error("Error updating supplier with bill data:", error)
    }
  }

  const handleApproval = async (id, action) => {
    try {
      const response = await fetch(`http://localhost:5000/supplier/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: action }),
      })

      if (response.ok) {
        fetchSupplierDetails()
        alert(`Supplier detail ${action.toLowerCase()} successfully!`)
      }
    } catch (error) {
      console.error("Error updating status:", error)
      alert("Error updating status")
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this supplier detail?")) {
      try {
        const response = await fetch(`http://localhost:5000/supplier/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          fetchSupplierDetails()
          alert("Supplier detail deleted successfully!")
        }
      } catch (error) {
        console.error("Error deleting supplier detail:", error)
        alert("Error deleting supplier detail")
      }
    }
  }

  const exportToExcel = () => {
    const exportData = supplierDetails.map((detail, index) => ({
      "S.No": index + 1,
      "PO Number": detail.poNumber,
      "PO Balance Qty": `${detail.poBalanceQty} ${detail.uom}`,
      "Inward No": detail.inwardNo,
      "Vehicle No": detail.vehicleNo,
      "Date & Time": new Date(detail.dateTime).toLocaleString(),
      "Supplier Name": detail.supplierName,
      Material: detail.material,
      UOM: detail.uom,
      "Received Qty": `${detail.receivedQty} ${detail.uom}`,
      "Received By": detail.receivedBy,
      "Supplier Bill Qty": detail.supplierBillQty ? `${detail.supplierBillQty} ${detail.uom}` : "Not uploaded",
      "PO Rate": `₹${detail.poRate}`,
      "Supplier Bill Rate": detail.supplierBillRate ? `₹${detail.supplierBillRate}` : "Not uploaded",
      Difference: detail.difference ? `₹${detail.difference}` : "N/A",
      Status: detail.status,
      "Created At": new Date(detail.created_at).toLocaleString(),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Details")
    XLSX.writeFile(workbook, `supplier_details_${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  const refreshData = () => {
    setLoading(true)
    fetchSupplierDetails()
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading supplier details...</p>
      </div>
    )
  }

  return (
    <div className="supplier-detail">
      {/* Simple Header with Export and Refresh */}
      <div className="table-header">
        <div className="table-title">
          <h2>Supplier Details</h2>
         
        </div>
        <div className="header-actions">
          <button className="btn btn-refresh" onClick={refreshData}>
            🔄 Refresh
          </button>
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Only Table - No other UI components */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>PO Number</th>
              <th>PO Balance Qty</th>
              <th>Inward No</th>
              <th>Vehicle No</th>
              <th>Date & Time</th>
              <th>Supplier</th>
              <th>Material</th>
              <th>Received Qty</th>
              <th>Received By</th>
              <th>Bill Upload</th>
              <th>Supplier Bill Qty</th>
              <th>PO Rate</th>
              <th>Supplier Bill Rate</th>
              <th>Difference</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {supplierDetails.map((detail, index) => (
              <tr key={detail.id} className={detail.status.toLowerCase()}>
                <td>{index + 1}</td>
                <td>
                  <span className="po-number">{detail.poNumber}</span>
                </td>
                <td>
                  <span className="quantity">
                    {detail.poBalanceQty} <small>{detail.uom}</small>
                  </span>
                </td>
                <td>
                  <span className="inward-no">{detail.inwardNo}</span>
                </td>
                <td>
                  <span className="vehicle-no">{detail.vehicleNo}</span>
                </td>
                <td>
                  <span className="datetime">
                    {new Date(detail.dateTime).toLocaleDateString()}
                    <br />
                    <small>{new Date(detail.dateTime).toLocaleTimeString()}</small>
                  </span>
                </td>
                <td>
                  <span className="supplier-name">{detail.supplierName}</span>
                </td>
                <td>
                  <span className="material">{detail.material}</span>
                </td>
                <td>
                  <span className="quantity received">
                    {detail.receivedQty || 0} <small>{detail.uom}</small>
                  </span>
                </td>
                <td>
                  <span className="received-by">{detail.receivedBy}</span>
                </td>
                <td>
                  <div className="bill-upload-cell">
                    {!detail.supplierBillFile ? (
                      <div className="upload-container">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                              handleFileUpload(detail.id, detail.vehicleNo, file)
                            }
                          }}
                          className="file-input"
                          id={`file-${detail.id}`}
                          disabled={uploadingBills[detail.id]}
                        />
                        <label htmlFor={`file-${detail.id}`} className="upload-label">
                          {uploadingBills[detail.id] ? (
                            <>
                              <span className="upload-spinner"></span>
                              Processing...
                            </>
                          ) : (
                            <>📄 Upload Bill</>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="uploaded-file">
                        <span className="file-icon">📄</span>
                        <span className="file-status">Uploaded</span>
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="bill-qty-cell">
                    {detail.supplierBillQty ? (
                      <span
                        className={`quantity ${
                          Math.abs((detail.receivedQty || 0) - detail.supplierBillQty) > 0.1
                            ? "quantity-mismatch"
                            : "quantity-match"
                        }`}
                      >
                        {detail.supplierBillQty} <small>{detail.uom}</small>
                        {Math.abs((detail.receivedQty || 0) - detail.supplierBillQty) > 0.1 && (
                          <span className="mismatch-warning" title="Quantity mismatch detected!">
                            ⚠️
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="not-available">Upload bill first</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="rate po-rate">₹{detail.poRate}</span>
                </td>
                <td>
                  {detail.supplierBillRate ? (
                    <span className="rate supplier-rate">₹{detail.supplierBillRate}</span>
                  ) : (
                    <span className="not-available">Upload bill first</span>
                  )}
                </td>
                <td>
                  {detail.difference !== null && detail.difference !== undefined ? (
                    <span
                      className={`difference ${Number.parseFloat(detail.difference) >= 0 ? "positive" : "negative"}`}
                    >
                      ₹{detail.difference}
                      {Number.parseFloat(detail.difference) >= 0 ? " ↗️" : " ↘️"}
                    </span>
                  ) : (
                    <span className="not-available">N/A</span>
                  )}
                </td>
                <td>
                  <span className={`status-badge ${detail.status.toLowerCase()}`}>{detail.status}</span>
                </td>
                <td>
                  <div className="action-buttons">
                    {detail.status === "Pending" && detail.supplierBillFile && (
                      <>
                        <button
                          className="btn btn-approve"
                          onClick={() => handleApproval(detail.id, "Approved")}
                          title="Approve"
                        >
                          ✅
                        </button>
                        <button
                          className="btn btn-reject"
                          onClick={() => handleApproval(detail.id, "Rejected")}
                          title="Reject"
                        >
                          ❌
                        </button>
                      </>
                    )}
                    {detail.supplierBillFile && (
                      <button
                        className="btn btn-view"
                        onClick={() => window.open(`http://localhost:5000/uploads/${detail.supplierBillFile}`, "_blank")}
                        title="View Bill"
                      >
                        👁️
                      </button>
                    )}
                    <button className="btn btn-delete" onClick={() => handleDelete(detail.id)} title="Delete">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {supplierDetails.length === 0 && (
          <div className="no-data">
            
            <h3>No Supplier Details Found</h3>
          
          
          </div>
        )}
      </div>

      <style jsx>{`
        .supplier-detail {
          padding: 20px;
          max-width: 1600px;
          margin: 0 auto;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          gap: 20px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e3e3e3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .table-title h2 {
          margin: 0;
          color: #333;
          font-size: 28px;
          font-weight: 700;
        }

        .table-title p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 16px;
        }

        .header-actions {
          display: flex;
          gap: 15px;
        }

        .table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th, td {
          padding: 12px 10px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
          vertical-align: middle;
        }

        th {
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-weight: 600;
          color:rgb(229, 236, 244);
          position: sticky;
          top: 0;
          z-index: 10;
          font-size: 12px;
          text-transform: uppercase;
        }

        tr:hover {
          background: #f8f9fa;
        }

        tr.pending {
          border-left: 3px solid #ffc107;
        }

        tr.approved {
          border-left: 3px solid #28a745;
        }

        tr.rejected {
          border-left: 3px solid #dc3545;
        }

        .po-number, .inward-no, .vehicle-no {
          font-weight: 600;
          color: #495057;
        }

        .quantity {
          font-weight: 600;
        }

        .quantity.received {
          color: #17a2b8;
        }

        .quantity-match {
          color: #28a745;
        }

        .quantity-mismatch {
          background-color: #fff3cd;
          color: #856404;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 600;
        }

        .mismatch-warning {
          margin-left: 8px;
          color: #dc3545;
          font-size: 16px;
        }

        .datetime {
          font-size: 12px;
        }

        .supplier-name, .material {
          font-weight: 500;
          color: #495057;
        }

        .received-by {
          color: #6c757d;
          font-style: italic;
        }

        .bill-upload-cell {
          min-width: 120px;
        }

        .upload-container {
          position: relative;
        }

        .file-input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }

        .upload-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .upload-label:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .upload-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .uploaded-file {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #d4edda;
          color: #155724;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        .file-icon {
          font-size: 14px;
        }

        .rate {
          font-weight: 600;
        }

        .po-rate {
          color: #17a2b8;
        }

        .supplier-rate {
          color: #6f42c1;
        }

        .difference {
          font-weight: 700;
          font-size: 14px;
        }

        .difference.positive {
          color: #28a745;
        }

        .difference.negative {
          color: #dc3545;
        }

        .not-available {
          color: #6c757d;
          font-style: italic;
          font-size: 12px;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge.pending {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.approved {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.rejected {
          background: #f8d7da;
          color: #721c24;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .btn {
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn:hover {
          transform: translateY(-2px);
        }

        .btn-refresh {
          background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
          color: white;
        }

        .btn-export {
          background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
          color: white;
        }

        .btn-approve {
          background: #28a745;
          color: white;
          padding: 6px 10px;
        }

        .btn-reject {
          background: #dc3545;
          color: white;
          padding: 6px 10px;
        }

        .btn-view {
          background: #17a2b8;
          color: white;
          padding: 6px 10px;
        }

        .btn-delete {
          background: #6c757d;
          color: white;
          padding: 6px 10px;
        }

        .no-data {
          text-align: center;
          padding: 80px 20px;
          color: #6c757d;
        }

        .no-data-icon {
          font-size: 64px;
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .no-data h3 {
          margin: 0 0 15px 0;
          color: #495057;
          font-size: 24px;
        }

        .no-data p {
          margin: 0 0 30px 0;
          font-size: 16px;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .no-data-actions {
          display: flex;
          justify-content: center;
        }

        @media (max-width: 1200px) {
          th, td {
            padding: 10px 8px;
            font-size: 12px;
          }
        }

        @media (max-width: 768px) {
          .table-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }

          .header-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}

export default SupplierDetail
