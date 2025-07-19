"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const BatchSlipDetails = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    batchNumber: "",
    batchDate: new Date().toISOString().split("T")[0],
    customer: "",
    recipeCode: "",
    quantity: "",
    clientMail: "",
    clientAddress: "",
  })

  const [batchSlips, setBatchSlips] = useState([])
  const [errors, setErrors] = useState({})
  const [searchTerm, setSearchTerm] = useState("")

  const recipeOptions = [
    { code: "M25", name: "M25 Grade Concrete" },
    { code: "M30", name: "M30 Grade Concrete" },
    { code: "M35", name: "M35 Grade Concrete" },
    { code: "M40", name: "M40 Grade Concrete" },
    { code: "M45", name: "M45 Grade Concrete" },
  ]

  // Load data from CreateBatchSlip if available
  useEffect(() => {
    const pendingBatchSlip = localStorage.getItem("pendingBatchSlip")
    if (pendingBatchSlip) {
      const data = JSON.parse(pendingBatchSlip)
      setFormData({
        batchNumber: data.batchNumber || "",
        batchDate: data.batchDate || new Date().toISOString().split("T")[0],
        customer: data.customer || "",
        recipeCode: data.recipeCode || "",
        quantity: data.quantity || "",
        clientMail: "",
        clientAddress: "",
      })
      // Clear the pending data
      localStorage.removeItem("pendingBatchSlip")
    }

    // Load existing batch slips
    const savedBatchSlips = localStorage.getItem("batchSlipDetails")
    if (savedBatchSlips) {
      setBatchSlips(JSON.parse(savedBatchSlips))
    }
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    const requiredFields = ["batchNumber", "batchDate", "customer", "recipeCode", "quantity"]

    requiredFields.forEach((field) => {
      if (!formData[field] || formData[field].toString().trim() === "") {
        newErrors[field] = "This field is required"
      }
    })

    // Validate email format
    if (formData.clientMail && !/\S+@\S+\.\S+/.test(formData.clientMail)) {
      newErrors.clientMail = "Please enter a valid email address"
    }

    // Validate quantity
    if (formData.quantity && isNaN(Number.parseFloat(formData.quantity))) {
      newErrors.quantity = "Please enter a valid number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (validateForm()) {
      const newBatchSlip = {
        id: Date.now(),
        ...formData,
        createdAt: new Date().toISOString(),
        status: "Active",
      }

      const updatedBatchSlips = [...batchSlips, newBatchSlip]
      setBatchSlips(updatedBatchSlips)
      localStorage.setItem("batchSlipDetails", JSON.stringify(updatedBatchSlips))

      // Reset form
      setFormData({
        batchNumber: "",
        batchDate: new Date().toISOString().split("T")[0],
        customer: "",
        recipeCode: "",
        quantity: "",
        clientMail: "",
        clientAddress: "",
      })

      alert("Batch slip details saved successfully!")
    }
  }

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this batch slip?")) {
      const updatedBatchSlips = batchSlips.filter((slip) => slip.id !== id)
      setBatchSlips(updatedBatchSlips)
      localStorage.setItem("batchSlipDetails", JSON.stringify(updatedBatchSlips))
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(batchSlips)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Slip Details")
    XLSX.writeFile(workbook, "batch_slip_details.xlsx")
  }

const filteredBatchSlips = batchSlips.filter((slip) =>
  (slip.batchNumber || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
  (slip.customer || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
  (slip.recipeCode || '').toLowerCase().includes((searchTerm || '').toLowerCase())
);

  return (
    <div className="batch-slip-details">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">📋</div>
          <h2>Batch Slip Details</h2>
        </div>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search batch slips..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          
        </div>
      </div>

      {/* Enhanced Batch Slip Details Form */}
      <div className="enhanced-form-container">
        <div className="form-card">
          <div className="form-card-header">
            <h3>Complete Batch Slip Details</h3>
            <p>Add additional information to finalize the batch slip</p>
          </div>

          <form onSubmit={handleSave} className="enhanced-form">
            <div className="enhanced-form-grid">
              {/* Left Column */}
              <div className="form-column">
                <div className="form-group">
                  <label>Batch Number *</label>
                  <input
                    type="text"
                    name="batchNumber"
                    value={formData.batchNumber}
                    onChange={handleInputChange}
                    className={errors.batchNumber ? "error" : ""}
                    placeholder="Enter batch number"
                  />
                  {errors.batchNumber && <span className="error-text">{errors.batchNumber}</span>}
                </div>

                <div className="form-group">
                  <label>Batch Date *</label>
                  <input
                    type="date"
                    name="batchDate"
                    value={formData.batchDate}
                    onChange={handleInputChange}
                    className={errors.batchDate ? "error" : ""}
                  />
                  {errors.batchDate && <span className="error-text">{errors.batchDate}</span>}
                </div>

                <div className="form-group">
                  <label>Customer *</label>
                  <input
                    type="text"
                    name="customer"
                    value={formData.customer}
                    onChange={handleInputChange}
                    className={errors.customer ? "error" : ""}
                    placeholder="Enter customer name"
                  />
                  {errors.customer && <span className="error-text">{errors.customer}</span>}
                </div>

                <div className="form-group">
                  <label>Recipe Code *</label>
                  <select
                    name="recipeCode"
                    value={formData.recipeCode}
                    onChange={handleInputChange}
                    className={errors.recipeCode ? "error" : ""}
                  >
                    <option value="">Select Recipe</option>
                    {recipeOptions.map((recipe) => (
                      <option key={recipe.code} value={recipe.code}>
                        {recipe.code} - {recipe.name}
                      </option>
                    ))}
                  </select>
                  {errors.recipeCode && <span className="error-text">{errors.recipeCode}</span>}
                </div>
              </div>

              {/* Right Column */}
              <div className="form-column">
                <div className="form-group">
                  <label>Quantity (M³) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    className={errors.quantity ? "error" : ""}
                    placeholder="0.00"
                  />
                  {errors.quantity && <span className="error-text">{errors.quantity}</span>}
                </div>

                <div className="form-group">
                  <label>Client Mail</label>
                  <input
                    type="email"
                    name="clientMail"
                    value={formData.clientMail}
                    onChange={handleInputChange}
                    className={errors.clientMail ? "error" : ""}
                    placeholder="client@example.com"
                  />
                  {errors.clientMail && <span className="error-text">{errors.clientMail}</span>}
                </div>

                <div className="form-group full-width">
                  <label>Client Address</label>
                  <textarea
                    name="clientAddress"
                    value={formData.clientAddress}
                    onChange={handleInputChange}
                    placeholder="Enter complete client address"
                    rows="4"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-save">
                Save Batch Slip Details
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Enhanced Batch Slip Details Table */}
      <div className="enhanced-table-container">
        <div className="table-card">
          <div className="table-card-header">
            <div className="table-title">
              <h3>Saved Batch Slip Records</h3>
              <div className="table-stats">
                <span className="stat-badge">
                  Total: <strong>{batchSlips.length}</strong>
                </span>
                <span className="stat-badge">
                  Showing: <strong>{filteredBatchSlips.length}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="enhanced-table">
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
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatchSlips.map((slip, index) => (
                  <tr key={slip.id}>
                    <td>{index + 1}</td>
                    <td>
                      <span className="batch-number">{slip.batchNumber}</span>
                    </td>
                    <td>{new Date(slip.batchDate).toLocaleDateString()}</td>
                    <td>
                      <span className="customer-name">{slip.customer}</span>
                    </td>
                    <td>
                      <span className="recipe-code">{slip.recipeCode}</span>
                    </td>
                    <td>
                      <span className="quantity-value">{slip.quantity}</span>
                    </td>
                    <td>
                      <span className="email-text">{slip.clientMail || "-"}</span>
                    </td>
                    <td>
                      <span className="address-text" title={slip.clientAddress}>
                        {slip.clientAddress
                          ? slip.clientAddress.length > 30
                            ? slip.clientAddress.substring(0, 30) + "..."
                            : slip.clientAddress
                          : "-"}
                      </span>
                    </td>
                    <td>
                      <span className={`status ${slip.status.toLowerCase()}`}>{slip.status}</span>
                    </td>
                    <td>
                      <div className="action-buttons-horizontal">
                        <button className="btn-view-text" title="View Details">
                          View
                        </button>
                        <button className="btn-approve-text" title="Edit">
                          Edit
                        </button>
                        <button className="btn-reject-text" title="Delete" onClick={() => handleDelete(slip.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredBatchSlips.length === 0 && (
              <div className="no-data-enhanced">
                <div className="no-data-icon">📋</div>
                <h4>No Batch Slip Details Found</h4>
                
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BatchSlipDetails