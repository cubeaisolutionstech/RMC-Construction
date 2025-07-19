"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import * as XLSX from "xlsx"

const PODetails = () => {
  const [poDetails, setPODetails] = useState([])

  // CSV Data for three tables
  const [poData, setPOData] = useState([])
  const [poHeaders, setPOHeaders] = useState([])
  const [grnData, setGRNData] = useState([])
  const [grnHeaders, setGRNHeaders] = useState([])
  const [indentData, setIndentData] = useState([])
  const [indentHeaders, setIndentHeaders] = useState([])

  const [showForm, setShowForm] = useState(false)
  const [editingPO, setEditingPO] = useState(null)
  const [uploadStatus, setUploadStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("")

  // Track which CSV files have data
  const [availableTabs, setAvailableTabs] = useState({
    po: false,
    grn: false,
    indent: false,
  })

  const [formData, setFormData] = useState({
    poNumber: "",
    supplier: "",
    material: "",
    quantity: "",
    rate: "",
    deliveryDate: "",
    narration: "",
    status: "Active",
    poType: "",
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchPODetails()
    checkAndLoadAvailableCSVs()
  }, [])

  const fetchPODetails = async () => {
    try {
      const res = await axios.get("http://localhost:5000/po")
      setPODetails(res.data)
    } catch (error) {
      console.error("Error fetching PO details:", error)
    }
  }

  const checkAndLoadAvailableCSVs = async () => {
    const csvTypes = ["po", "grn", "indent"]
    const availabilityResults = {}

    // Check each CSV type and load data if available
    for (const csvType of csvTypes) {
      const hasData = await loadCSVData(csvType)
      availabilityResults[csvType] = hasData
    }

    setAvailableTabs(availabilityResults)

    // Set active tab to first available tab with data
    const firstAvailableTab = Object.keys(availabilityResults).find((tab) => availabilityResults[tab])
    if (firstAvailableTab) {
      setActiveTab(firstAvailableTab)
    }
  }

  const loadCSVData = async (csvType) => {
    try {
      const response = await fetch(`http://localhost:8001/get-csv-data/${csvType}`)
      const result = await response.json()

      if (result.status === "success" && result.data && result.data.length > 0) {
        // Set data based on CSV type
        switch (csvType) {
          case "po":
            setPOHeaders(result.headers || [])
            setPOData(result.data || [])
            break
          case "grn":
            setGRNHeaders(result.headers || [])
            setGRNData(result.data || [])
            break
          case "indent":
            setIndentHeaders(result.headers || [])
            setIndentData(result.data || [])
            break
        }
        return true // Has data
      } else {
        // Clear data if no data found
        switch (csvType) {
          case "po":
            setPOHeaders([])
            setPOData([])
            break
          case "grn":
            setGRNHeaders([])
            setGRNData([])
            break
          case "indent":
            setIndentHeaders([])
            setIndentData([])
            break
        }
        return false // No data
      }
    } catch (error) {
      console.log(`No ${csvType} data available`)
      // Clear data on error
      switch (csvType) {
        case "po":
          setPOHeaders([])
          setPOData([])
          break
        case "grn":
          setGRNHeaders([])
          setGRNData([])
          break
        case "indent":
          setIndentHeaders([])
          setIndentData([])
          break
      }
      return false
    }
  }

  const handleJsonUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.endsWith(".json")) {
      alert("Please select a JSON file")
      return
    }

    setIsUploading(true)
    setUploadStatus("Uploading and processing JSON file...")

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("http://localhost:8001/upload-json/", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.status === "success") {
        setUploadStatus("✅ JSON processed successfully!")

        // Show processing details
        if (result.details && result.details.length > 0) {
          const details = result.details
            .map((d) => `${d.voucher_type}: ${d.rows_added} rows added (Total: ${d.total_rows})`)
            .join(", ")
          setUploadStatus(`✅ JSON processed: ${details}`)
        }

        // Reload all CSV data
        await checkAndLoadAvailableCSVs()

        setTimeout(() => setUploadStatus(""), 5000)
      } else {
        setUploadStatus(`❌ Error: ${result.error}`)
        setTimeout(() => setUploadStatus(""), 5000)
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus("❌ Upload failed. Please check if the JSON converter server is running on port 8001.")
      setTimeout(() => setUploadStatus(""), 5000)
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  const clearCSVData = async (csvType) => {
    try {
      const response = await fetch(`http://localhost:8001/clear-csv/${csvType}`, {
        method: "DELETE",
      })
      const result = await response.json()

      if (result.status === "success") {
        setUploadStatus(`✅ ${csvType.toUpperCase()} data cleared`)

        // Clear the specific data and update available tabs
        const updatedTabs = { ...availableTabs, [csvType]: false }
        setAvailableTabs(updatedTabs)

        // Clear data from state
        switch (csvType) {
          case "po":
            setPOData([])
            setPOHeaders([])
            break
          case "grn":
            setGRNData([])
            setGRNHeaders([])
            break
          case "indent":
            setIndentData([])
            setIndentHeaders([])
            break
        }

        // Switch to first available tab if current tab was cleared
        if (activeTab === csvType) {
          const firstAvailableTab = Object.keys(updatedTabs).find((tab) => updatedTabs[tab])
          setActiveTab(firstAvailableTab || "")
        }

        setTimeout(() => setUploadStatus(""), 2000)
      }
    } catch (error) {
      console.error("Error clearing data:", error)
      setUploadStatus("❌ Error clearing data")
      setTimeout(() => setUploadStatus(""), 3000)
    }
  }

  const downloadCSV = (csvType) => {
    window.open(`http://localhost:8001/download/${csvType}`, "_blank")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validateForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    const payload = {
      ...formData,
      quantity: Number.parseFloat(formData.quantity),
      rate: Number.parseFloat(formData.rate),
      totalAmount: Number.parseFloat(formData.quantity) * Number.parseFloat(formData.rate),
    }

    try {
      if (editingPO) {
        await axios.put(`http://localhost:5000/po/${editingPO.id}`, payload)
      } else {
        await axios.post("http://localhost:5000/po", payload)
      }

      fetchPODetails()
      resetForm()
    } catch (error) {
      console.error("Error saving PO:", error)
      alert("Error saving PO. Please try again.")
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm("Delete this PO?")) {
      try {
        await axios.delete(`http://localhost:5000/po/${id}`)
        fetchPODetails()
      } catch (error) {
        console.error("Error deleting PO:", error)
        alert("Error deleting PO. Please try again.")
      }
    }
  }

  const handleEdit = (po) => {
    setFormData(po)
    setEditingPO(po)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      poNumber: "",
      supplier: "",
      material: "",
      quantity: "",
      rate: "",
      deliveryDate: "",
      narration: "",
      status: "Active",
      poType: "",
    })
    setErrors({})
    setEditingPO(null)
    setShowForm(false)
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.poNumber) newErrors.poNumber = "Required"
    if (!formData.supplier) newErrors.supplier = "Required"
    if (!formData.material) newErrors.material = "Required"
    if (!formData.quantity || formData.quantity <= 0) newErrors.quantity = "Invalid"
    if (!formData.rate || formData.rate <= 0) newErrors.rate = "Invalid"
    if (!formData.deliveryDate) newErrors.deliveryDate = "Required"
    if (!formData.poType) newErrors.poType = "Required"
    return newErrors
  }

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(poDetails)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "PO")
    XLSX.writeFile(wb, "po_details.xlsx")
  }

  const renderCSVTable = (data, headers, type) => {
    if (data.length === 0) {
      return (
        <div className="no-data">
          <p>📊 No {type.toUpperCase()} data available.</p>
          <p>Upload a JSON file containing {type} vouchers to see data here.</p>
        </div>
      )
    }

    return (
      <div style={{ maxHeight: "400px", overflowY: "auto", overflowX: "auto" }}>
        <table className="po-table">
          <thead>
            <tr>
              <th>S.No</th>
              {headers.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td>{rowIndex + 1}</td>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell || ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Check if any CSV data is available
  const hasAnyCSVData = Object.values(availableTabs).some((hasData) => hasData)

  return (
    <div className="po-wrapper">
      <div className="po-header">
        <h2>Purchase Order Management</h2>
        <div>
          <button className="btn export" onClick={exportToExcel}>
            Export Excel
          </button>
          <button className="btn add" onClick={() => setShowForm(true)}>
            Add PO
          </button>
        </div>
      </div>

      {/* Original PO Details Table */}
      <table className="po-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>PO Number</th>
            <th>Supplier</th>
            <th>Material</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
            <th>Delivery</th>
            <th>Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {poDetails.map((po, i) => (
            <tr key={po.id}>
              <td>{i + 1}</td>
              <td>{po.poNumber}</td>
              <td>{po.supplier}</td>
              <td>{po.material}</td>
              <td>{po.quantity}</td>
              <td>₹{po.rate}</td>
              <td>₹{po.totalAmount}</td>
              <td>{new Date(po.deliveryDate).toLocaleDateString()}</td>
              <td>{po.poType}</td>
              <td>{po.status}</td>
              <td>
                <button className="btn edit" onClick={() => handleEdit(po)}>
                  ✏
                </button>
                <button className="btn delete" onClick={() => handleDelete(po.id)}>
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* JSON to CSV Conversion Section */}
      <div className="csv-section">
        <div className="po-header">
          <h3>JSON Voucher Processor</h3>
          <div>
            <input
              type="file"
              accept=".json"
              onChange={handleJsonUpload}
              style={{ display: "none" }}
              id="json-upload"
              disabled={isUploading}
            />
            <label htmlFor="json-upload" className={`btn add ${isUploading ? "disabled" : ""}`}>
              {isUploading ? "Processing..." : "📁 Upload JSON"}
            </label>
          </div>
        </div>

        {uploadStatus && (
          <div className={`upload-status ${uploadStatus.includes("❌") ? "error" : "success"}`}>{uploadStatus}</div>
        )}

        {/* Show tabs only if there's CSV data available */}
        {hasAnyCSVData && (
          <>
            {/* Tab Navigation - Only show tabs that have data */}
            <div className="tab-navigation">
              {availableTabs.po && (
                <button className={`tab-btn ${activeTab === "po" ? "active" : ""}`} onClick={() => setActiveTab("po")}>
                  Purchase Orders ({poData.length})
                </button>
              )}
              {availableTabs.grn && (
                <button
                  className={`tab-btn ${activeTab === "grn" ? "active" : ""}`}
                  onClick={() => setActiveTab("grn")}
                >
                  GRN ({grnData.length})
                </button>
              )}
              {availableTabs.indent && (
                <button
                  className={`tab-btn ${activeTab === "indent" ? "active" : ""}`}
                  onClick={() => setActiveTab("indent")}
                >
                  Indent ({indentData.length})
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === "po" && availableTabs.po && (
                <div className="table-section">
                  <div className="table-header">
                    <h4>Purchase Order Details from CSV</h4>
                    <div>
                      <button className="btn export" onClick={() => downloadCSV("po")}>
                        📥 Download CSV
                      </button>
                      <button className="btn delete" onClick={() => clearCSVData("po")}>
                        Clear Data
                      </button>
                    </div>
                  </div>
                  {renderCSVTable(poData, poHeaders, "purchase order")}
                </div>
              )}

              {activeTab === "grn" && availableTabs.grn && (
                <div className="table-section">
                  <div className="table-header">
                    <h4>GRN Details from CSV</h4>
                    <div>
                      <button className="btn export" onClick={() => downloadCSV("grn")}>
                        📥 Download CSV
                      </button>
                      <button className="btn delete" onClick={() => clearCSVData("grn")}>
                        Clear Data
                      </button>
                    </div>
                  </div>
                  {renderCSVTable(grnData, grnHeaders, "grn")}
                </div>
              )}

              {activeTab === "indent" && availableTabs.indent && (
                <div className="table-section">
                  <div className="table-header">
                    <h4>Indent Details from CSV</h4>
                    <div>
                      <button className="btn export" onClick={() => downloadCSV("indent")}>
                        📥 Download CSV
                      </button>
                      <button className="btn delete" onClick={() => clearCSVData("indent")}>
                        Clear Data
                      </button>
                    </div>
                  </div>
                  {renderCSVTable(indentData, indentHeaders, "indent")}
                </div>
              )}
            </div>
          </>
        )}

        {/* Show message when no CSV data is available */}
        {!hasAnyCSVData && !isUploading && (
          <div className="no-csv-data">
            <div className="no-data">
              <p>📊 No CSV data available in convert folder.</p>
              <p>Upload a JSON file containing vouchers to see data organized in tables.</p>
              <p>
                <strong>Supported voucher types:</strong> Purchase Order, GRN, Indent
              </p>
              
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingPO ? "Edit PO" : "Add PO"}</h3>
            <form onSubmit={handleSubmit} className="po-form">
              <input
                placeholder="PO Number"
                value={formData.poNumber}
                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
              />
              <input
                placeholder="Supplier"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              />
              <input
                placeholder="Material"
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              />
              <input
                type="number"
                placeholder="Quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
              <input
                type="number"
                placeholder="Rate"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              />
              <input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
              />
              <textarea
                placeholder="Narration"
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
              />

              <select value={formData.poType} onChange={(e) => setFormData({ ...formData, poType: e.target.value })}>
                <option value="">Select PO Type</option>
                <option value="Local">Local</option>
                <option value="Import">Import</option>
              </select>

              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Pending">Pending</option>
              </select>

              <div className="form-buttons">
                <button type="button" className="btn cancel" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn save">
                  Save PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .csv-section {
          border-top: 2px solid #eee;
          padding-top: 20px;
          margin-top: 40px;
        }
        
        .upload-status {
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          font-weight: 500;
        }
        
        .upload-status.success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        
        .upload-status.error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        
        .btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .tab-navigation {
          display: flex;
          border-bottom: 2px solid #eee;
          margin: 20px 0;
          flex-wrap: wrap;
        }
        
        .tab-btn {
          padding: 10px 20px;
          border: none;
          background: #f8f9fa;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          margin-right: 5px;
          margin-bottom: 5px;
          font-weight: 500;
          border-radius: 4px 4px 0 0;
          transition: all 0.3s ease;
        }
        
        .tab-btn.active {
          background: white;
          border-bottom-color: #007bff;
          color: #007bff;
          box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
        }
        
        .tab-btn:hover {
          background: #e9ecef;
        }
        
        .table-section {
          margin-top: 20px;
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .table-header h4 {
          margin: 0;
          color: #333;
          font-size: 18px;
        }
        
        .table-header div {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        .no-data {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 2px dashed #dee2e6;
          color: #666;
        }
        
        .no-data p {
          margin: 10px 0;
        }
        
        .no-data code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
        
        .no-csv-data {
          margin-top: 20px;
        }
        
        .po-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .po-table th,
        .po-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
        }
        
        .po-table th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #495057;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .po-table tr:hover {
          background-color: #f8f9fa;
        }
        
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          text-decoration: none;
          display: inline-block;
          transition: all 0.3s ease;
        }
        
        .btn.add {
          background-color: #28a745;
          color: white;
        }
        
        .btn.add:hover {
          background-color: #218838;
        }
        
        .btn.export {
          background-color: #17a2b8;
          color: white;
        }
        
        .btn.export:hover {
          background-color: #138496;
        }
        
        .btn.delete {
          background-color: #dc3545;
          color: white;
        }
        
        .btn.delete:hover {
          background-color: #c82333;
        }
        
        .btn.edit {
          background-color: #ffc107;
          color: #212529;
        }
        
        .btn.edit:hover {
          background-color: #e0a800;
        }
        
        @media (max-width: 768px) {
          .table-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .tab-navigation {
            flex-direction: column;
          }
          
          .tab-btn {
            margin-right: 0;
            margin-bottom: 5px;
          }
          
          .po-table {
            font-size: 14px;
          }
          
          .po-table th,
          .po-table td {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  )
}

export default PODetails
