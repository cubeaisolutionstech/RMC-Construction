"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const VehicleEntry = () => {
  const [vehicleEntries, setVehicleEntries] = useState([])
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [detectedVehicle, setDetectedVehicle] = useState(null)
  const [showDetailsForm, setShowDetailsForm] = useState(false)
  const [matchedVehicle, setMatchedVehicle] = useState(null)

  useEffect(() => {
    fetchVehicleEntries()
  }, [])

  const fetchVehicleEntries = async () => {
    try {
      const response = await fetch("http://localhost:5000/vehicles")
      const data = await response.json()
      setVehicleEntries(data)
    } catch (error) {
      console.error("Error fetching vehicle entries:", error)
    }
  }

  const exportToExcel = () => {
    const exportData = vehicleEntries.map((entry, index) => ({
      "S.No": index + 1,
      "Inward Number": entry.inward_no,
      "Vehicle Number": entry.vehicle_number,
      Material: entry.material,
      "Entry Time": new Date(entry.entry_time).toLocaleString(),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicle Entries")
    XLSX.writeFile(workbook, `vehicle_entries_${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle entry?")) {
      try {
        const response = await fetch(`http://localhost:5000/vehicles/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          fetchVehicleEntries()
          alert("Vehicle entry deleted successfully!")
        } else {
          const errorData = await response.json()
          alert(`Error deleting vehicle entry: ${errorData.error || "Unknown error"}`)
        }
      } catch (error) {
        console.error("Error deleting vehicle entry:", error)
        alert("Error deleting vehicle entry")
      }
    }
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setVideoFile(file)
    const videoUrl = URL.createObjectURL(file)
    setVideoPreview(videoUrl)
    // Reset states when new video is uploaded
    setDetectedVehicle(null)
    setMatchedVehicle(null)
    setShowDetailsForm(false)
  }

  const handleVideoProcessing = async () => {
    if (!videoFile) return alert("Please upload a video first.")

    const formData = new FormData()
    formData.append("file", videoFile)
    setLoading(true)

    try {
      const response = await fetch("http://localhost:5000/vehicles/process-video", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setDetectedVehicle(data.vehicle_data)

        if (data.matched) {
          // Vehicle exists in database
          setMatchedVehicle(data.existing_vehicle)
          alert("✅ Vehicle matched! Displaying existing details.")
        } else {
          // New vehicle - show form to fill details
          setShowDetailsForm(true)
          alert("🆕 New vehicle detected! Please fill the remaining details.")
        }
      } else {
        alert(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error("Error during processing:", error)
      alert("Error during vehicle verification.")
    } finally {
      setLoading(false)
    }
  }

  const handleDetailsSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)

    const vehicleData = {
      ...detectedVehicle,
      driver_name: formData.get("driverName"),
      supplier_name: formData.get("supplierName"),
      purpose: formData.get("purpose") || "Material Delivery",
    }

    try {
      const response = await fetch("http://localhost:5000/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vehicleData),
      })

      if (response.ok) {
        fetchVehicleEntries()
        setShowDetailsForm(false)
        setDetectedVehicle(null)
        setVideoFile(null)
        setVideoPreview(null)
        document.getElementById("video-upload").value = ""
        alert("Vehicle entry created successfully!")
      } else {
        const errorData = await response.json()
        alert(`Error creating vehicle entry: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error creating vehicle entry:", error)
      alert("Error creating vehicle entry")
    }
  }

  return (
    <div className="vehicle-entry">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">🚛</div>
          <div>
            <h2>Vehicle Entry Management</h2>
            <p className="section-subtitle">Automated vehicle entry using license plate detection</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
        </div>
      </div>

      <div className="video-processing-section">
        <div className="video-feed-section">
          <h3>🎥 Video Processing Entry</h3>
          <div className="video-feed-container">
            <div className="video-feed-box">
              {videoPreview ? (
                <video className="live-video-feed" controls>
                  <source src={videoPreview} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="video-placeholder">
                  <div className="placeholder-content">
                    <div className="placeholder-icon">📹</div>
                    <p>Upload a video to process</p>
                  </div>
                </div>
              )}
            </div>

            <div className="video-controls">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="video-upload-input"
                id="video-upload"
                style={{ display: "none" }}
              />
              <label htmlFor="video-upload" className="btn btn-upload-video">
                📁 Upload Video
              </label>
              {videoFile && (
                <>
                  <span className="uploaded-file-name">📹 {videoFile.name}</span>
                  <button
                    className="btn btn-process"
                    onClick={handleVideoProcessing}
                    disabled={loading}
                    style={{ marginLeft: "10px" }}
                  >
                    {loading ? "⏳ Processing..." : "▶️ Process Video"}
                  </button>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div className="processing-status">
              <p>⏳ Processing license plate detection and material identification...</p>
              <div className="loading-spinner"></div>
            </div>
          )}

          {/* Matched Vehicle Display */}
          {matchedVehicle && (
            <div className="matched-vehicle-card">
              <div className="card-header">
                <h4>✅ Vehicle Matched!</h4>
              </div>
              <div className="card-content">
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Vehicle Number:</label>
                    <span>{matchedVehicle.vehicle_number}</span>
                  </div>
                  <div className="detail-item">
                    <label>Inward Number:</label>
                    <span>{matchedVehicle.inward_no}</span>
                  </div>
                  <div className="detail-item">
                    <label>Material:</label>
                    <span>{matchedVehicle.material}</span>
                  </div>
                  <div className="detail-item">
                    <label>Entry Time:</label>
                    <span>{new Date(matchedVehicle.entry_time).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Vehicle Details Form */}
          {showDetailsForm && detectedVehicle && (
            <div className="details-form-card">
              <div className="card-header">
                <h4>🆕 New Vehicle Detected</h4>
                <p>
                  Vehicle Number: <strong>{detectedVehicle.vehicle_number}</strong>
                </p>
                <p>
                  Material Detected: <strong>{detectedVehicle.material || "Processing..."}</strong>
                </p>
              </div>
              <form onSubmit={handleDetailsSubmit} className="details-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Driver Name</label>
                    <input type="text" name="driverName" placeholder="Enter driver name" />
                  </div>
                  <div className="form-group">
                    <label>Supplier Name</label>
                    <input type="text" name="supplierName" placeholder="Enter supplier name" />
                  </div>
                  <div className="form-group">
                    <label>Purpose</label>
                    <input type="text" name="purpose" placeholder="Purpose of visit" defaultValue="Material Delivery" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-submit">
                    ✅ Save Vehicle Entry
                  </button>
                  <button type="button" className="btn btn-cancel" onClick={() => setShowDetailsForm(false)}>
                    ❌ Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="entries-table">
        <div className="table-header">
          <h3>Vehicle Entries</h3>
          <div className="table-stats">
            <div className="stat-card">
              <span className="stat-number">{vehicleEntries.length}</span>
              <span className="stat-label">Total Entries</span>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Inward Number</th>
                <th>Vehicle Number</th>
                <th>Material</th>
                <th>Entry Time/Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicleEntries.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="inward-number">{entry.inward_no}</span>
                  </td>
                  <td>
                    <span className="vehicle-number">{entry.vehicle_number}</span>
                  </td>
                  <td>
                    <span className="material">{entry.material || "N/A"}</span>
                  </td>
                  <td>
                    <span className="entry-time">
                      {new Date(entry.entry_time).toLocaleDateString()}
                      <br />
                      <small>{new Date(entry.entry_time).toLocaleTimeString()}</small>
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-delete" onClick={() => handleDelete(entry.id)} title="Delete Entry">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {vehicleEntries.length === 0 && (
            <div className="no-data">
              <div className="no-data-icon">🚛</div>
              <h3>No Vehicle Entries Found</h3>
              <p>Upload and process videos to detect vehicle entries</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .vehicle-entry {
          padding: 20px;
          max-width: 1600px;
          margin: 0 auto;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding: 25px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .section-icon {
          font-size: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          border-radius: 15px;
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .section-title h2 {
          margin: 0;
          color: #333;
          font-size: 32px;
          font-weight: 700;
        }

        .section-subtitle {
          margin: 8px 0 0 0;
          color: #666;
          font-size: 16px;
        }

        .header-actions {
          display: flex;
          gap: 15px;
        }

        .video-processing-section {
          margin-bottom: 30px;
        }

        .video-feed-section {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .video-feed-section h3 {
          margin: 0 0 20px 0;
          color: #333;
          font-size: 20px;
          font-weight: 600;
        }

        .video-feed-container {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .video-feed-box {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
          min-height: 300px;
        }

        .live-video-feed {
          width: 100%;
          height: 300px;
          object-fit: cover;
        }

        .video-placeholder {
          width: 100%;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f9fa;
          border: 2px dashed #dee2e6;
          border-radius: 12px;
        }

        .placeholder-content {
          text-align: center;
          color: #6c757d;
        }

        .placeholder-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }

        .processing-status {
          text-align: center;
          margin-top: 15px;
          padding: 20px;
          background: #e3f2fd;
          border-radius: 8px;
          border-left: 4px solid #2196f3;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 10px auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .video-controls {
          display: flex;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }

        .uploaded-file-name {
          color: #28a745;
          font-size: 14px;
          font-weight: 500;
        }

        .matched-vehicle-card, .details-form-card {
          margin-top: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .card-header {
          padding: 20px;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }

        .details-form-card .card-header {
          background: linear-gradient(135deg, #007bff 0%, #6610f2 100%);
        }

        .card-header h4 {
          margin: 0 0 10px 0;
          font-size: 18px;
        }

        .card-header p {
          margin: 5px 0;
          opacity: 0.9;
        }

        .card-content {
          padding: 20px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .detail-item label {
          font-weight: 600;
          color: #666;
          font-size: 14px;
        }

        .detail-item span {
          font-weight: 500;
          color: #333;
        }

        .details-form {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .form-group input {
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.3s ease;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .entries-table {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 25px 30px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 2px solid #dee2e6;
        }

        .table-header h3 {
          margin: 0;
          color: #333;
          font-size: 24px;
          font-weight: 700;
        }

        .table-stats {
          display: flex;
          gap: 20px;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px 20px;
          border-radius: 10px;
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          min-width: 80px;
        }

        .stat-number {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          font-weight: 600;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        th, td {
          padding: 15px 12px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
          vertical-align: middle;
        }

        th {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
          position: sticky;
          top: 0;
          z-index: 10;
          font-size: 13px;
          text-transform: uppercase;
        }

        tr:hover {
          background: #f8f9fa;
        }

        .inward-number, .vehicle-number {
          font-weight: 600;
          color: #495057;
        }

        .material {
          font-weight: 500;
          color: #495057;
        }

        .entry-time {
          font-size: 13px;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-export {
          background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
          color: white;
        }

        .btn-upload-video {
          background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
          color: white;
        }

        .btn-process {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }

        .btn-submit {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 24px;
        }

        .btn-cancel {
          background: #6c757d;
          color: white;
          padding: 12px 24px;
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
          margin: 0;
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .section-header {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .table-header {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}

export default VehicleEntry
