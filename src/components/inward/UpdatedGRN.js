"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const UpdatedGRN = () => {
  const [grnDetails, setGRNDetails] = useState([])
  const [poDetails, setPODetails] = useState([])
  
  const [showForm, setShowForm] = useState(false)
  const [editingGRN, setEditingGRN] = useState(null)
  const [supportingDoc, setSupportingDoc] = useState(null)
  const [formData, setFormData] = useState({
    grnNumber: "",
    linkedPONumber: "",
    supplierName: "",
    project: "",
    receivedQuantity: "",
    receivedDate: "",
    materialCondition: "",
    remarks: "",
  })
  const [errors, setErrors] = useState({})

 
 

  

  const saveGRNDetails = (details) => {
    localStorage.setItem("grnDetails", JSON.stringify(details))
    setGRNDetails(details)
  }

  const generateGRNNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const sequence = String(grnDetails.length + 1).padStart(4, "0")
    return `GRN${year}${month}${sequence}`
  }

  const handleDocumentUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSupportingDoc(file)
    }
  }

  const handlePOSelection = (poNumber) => {
    const selectedPO = poDetails.find((po) => po.poNumber === poNumber)
    if (selectedPO) {
      setFormData((prev) => ({
        ...prev,
        linkedPONumber: poNumber,
        supplierName: selectedPO.supplier,
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.grnNumber.trim()) newErrors.grnNumber = "GRN Number is required"
    if (!formData.linkedPONumber.trim()) newErrors.linkedPONumber = "Linked PO Number is required"
    if (!formData.supplierName.trim()) newErrors.supplierName = "Supplier Name is required"
    if (!formData.project.trim()) newErrors.project = "Project is required"
    if (!formData.receivedQuantity.trim()) newErrors.receivedQuantity = "Received Quantity is required"
    if (!formData.receivedDate) newErrors.receivedDate = "Received Date is required"
    if (!formData.materialCondition.trim()) newErrors.materialCondition = "Material Condition is required"

    if (formData.receivedQuantity && Number.parseFloat(formData.receivedQuantity) <= 0) {
      newErrors.receivedQuantity = "Received quantity must be greater than 0"
    }

    return newErrors
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const formErrors = validateForm()

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    const newGRN = {
      ...formData,
      id: editingGRN ? editingGRN.id : Date.now(),
      supportingDocument: supportingDoc ? supportingDoc.name : null,
      createdAt: editingGRN ? editingGRN.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    let updatedGRNDetails
    if (editingGRN) {
      updatedGRNDetails = grnDetails.map((grn) => (grn.id === editingGRN.id ? newGRN : grn))
    } else {
      updatedGRNDetails = [...grnDetails, newGRN]
    }

    saveGRNDetails(updatedGRNDetails)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      grnNumber: "",
      linkedPONumber: "",
      supplierName: "",
      project: "",
      receivedQuantity: "",
      receivedDate: "",
      materialCondition: "",
      remarks: "",
    })
    setErrors({})
    setSupportingDoc(null)
    setShowForm(false)
    setEditingGRN(null)
  }

  const handleEdit = (grn) => {
    setFormData(grn)
    setEditingGRN(grn)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this GRN?")) {
      const updatedGRNDetails = grnDetails.filter((grn) => grn.id !== id)
      saveGRNDetails(updatedGRNDetails)
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(grnDetails)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "GRN Details")
    XLSX.writeFile(workbook, "grn_details.xlsx")
  }


  

  return (
    <div className="updated-grn">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">📊</div>
          <h2>Updated GRN (Goods Receipt Note)</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button
            className="btn btn-add"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                grnNumber: generateGRNNumber(),
                receivedDate: new Date().toISOString().split("T")[0],
              }))
              setShowForm(true)
            }}
          >
            ➕ Add GRN
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>{editingGRN ? "Edit GRN" : "Add New GRN"}</h3>
              <button className="close-btn" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grn-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>GRN Number *</label>
                  <input
                    type="text"
                    value={formData.grnNumber}
                    onChange={(e) => setFormData({ ...formData, grnNumber: e.target.value })}
                    className={errors.grnNumber ? "error" : ""}
                    placeholder="Auto-generated"
                    readOnly={!editingGRN}
                  />
                  {errors.grnNumber && <span className="error-text">{errors.grnNumber}</span>}
                </div>

                <div className="form-group">
                  <label>Linked PO Number *</label>
                  <select
                    value={formData.linkedPONumber}
                    onChange={(e) => handlePOSelection(e.target.value)}
                    className={errors.linkedPONumber ? "error" : ""}
                  >
                    <option value="">Select PO Number</option>
                    {poDetails
                      .filter((po) => po.status === "Active")
                      .map((po) => (
                        <option key={po.id} value={po.poNumber}>
                          {po.poNumber} - {po.material}
                        </option>
                      ))}
                  </select>
                  {errors.linkedPONumber && <span className="error-text">{errors.linkedPONumber}</span>}
                </div>

                <div className="form-group">
                  <label>Supplier Name *</label>
                  <input
                    type="text"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className={errors.supplierName ? "error" : ""}
                    placeholder="Auto-filled from PO"
                    readOnly
                  />
                  {errors.supplierName && <span className="error-text">{errors.supplierName}</span>}
                </div>

                <div className="form-group">
                  <label>Project *</label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    className={errors.project ? "error" : ""}
                    placeholder="Enter project name"
                  />
                  {errors.project && <span className="error-text">{errors.project}</span>}
                </div>

                <div className="form-group">
                  <label>Received Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.receivedQuantity}
                    onChange={(e) => setFormData({ ...formData, receivedQuantity: e.target.value })}
                    className={errors.receivedQuantity ? "error" : ""}
                    placeholder="Enter received quantity"
                  />
                  {errors.receivedQuantity && <span className="error-text">{errors.receivedQuantity}</span>}
                </div>

                <div className="form-group">
                  <label>Received Date *</label>
                  <input
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                    className={errors.receivedDate ? "error" : ""}
                  />
                  {errors.receivedDate && <span className="error-text">{errors.receivedDate}</span>}
                </div>

                <div className="form-group">
                  <label>Material Condition *</label>
                  <select
                    value={formData.materialCondition}
                    onChange={(e) => setFormData({ ...formData, materialCondition: e.target.value })}
                    className={errors.materialCondition ? "error" : ""}
                  >
                    <option value="">Select Condition</option>
                    <option value="Good">Good</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Partially Damaged">Partially Damaged</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  {errors.materialCondition && <span className="error-text">{errors.materialCondition}</span>}
                </div>

                <div className="form-group">
                  <label>Upload Supporting Document</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleDocumentUpload}
                    className="file-input"
                  />
                  {supportingDoc && <span className="file-name">📄 {supportingDoc.name}</span>}
                </div>

                <div className="form-group full-width">
                  <label>Remarks</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Enter any additional remarks"
                    rows="4"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save">
                  {editingGRN ? "Update" : "Save"} GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grn-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>GRN Number</th>
              <th>Linked PO</th>
              <th>Supplier</th>
              <th>Project</th>
              <th>Received Qty</th>
              <th>Received Date</th>
              <th>Condition</th>
              <th>Document</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grnDetails.map((grn, index) => (
              <tr key={grn.id}>
                <td>{index + 1}</td>
                <td>{grn.grnNumber}</td>
                <td>{grn.linkedPONumber}</td>
                <td>{grn.supplierName}</td>
                <td>{grn.project}</td>
                <td>{grn.receivedQuantity}</td>
                <td>{new Date(grn.receivedDate).toLocaleDateString()}</td>
                <td>
                  <span className={`condition ${grn.materialCondition.toLowerCase().replace(" ", "-")}`}>
                    {grn.materialCondition}
                  </span>
                </td>
                <td>
                  {grn.supportingDocument ? (
                    <span className="document-indicator">📄 {grn.supportingDocument}</span>
                  ) : (
                    <span className="no-document">No Document</span>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-edit" onClick={() => handleEdit(grn)} title="Edit GRN">
                      ✏️
                    </button>
                    <button className="btn btn-delete" onClick={() => handleDelete(grn.id)} title="Delete GRN">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {grnDetails.length === 0 && (
          <div className="no-data">
            <p>No GRN records found</p>
          </div>
        )}
      </div>

    
    </div>
  )
}

export default UpdatedGRN
