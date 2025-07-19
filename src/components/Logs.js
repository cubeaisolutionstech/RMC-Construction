"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const Logs = () => {
  const [logs, setLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [branches, setBranches] = useState([])
  const [materialData, setMaterialData] = useState([])
  const [filteredMaterialData, setFilteredMaterialData] = useState([])
  const [isLoadingMaterial, setIsLoadingMaterial] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    branch: "All",
    user: "",
    module: "All",
    action: "All",
  })

  const [materialFilters, setMaterialFilters] = useState({
    dateFrom: "",
    dateTo: "",
    partyName: "",
    grade: "All",
    pb: "All",
  })

  const modules = [
    "Employee Management",
    "Branch Management",
    "Project Management",
    "Role Management",
    "Vehicle Entry",
    "Supplier Details",
    "PO Details",
    "GRN Management",
    "System",
  ]

  const actions = ["Add", "Update", "Delete", "Inaction", "Login", "Logout", "View", "Export"]

  useEffect(() => {
    fetchSystemLogs()
    fetchBranches()
    loadMaterialDataFromStorage()
  }, [])

  const fetchSystemLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const queryParams = new URLSearchParams()
      if (filters.dateFrom) queryParams.append("dateFrom", filters.dateFrom)
      if (filters.dateTo) queryParams.append("dateTo", filters.dateTo)
      if (filters.branch !== "All") queryParams.append("branch", filters.branch)
      if (filters.module !== "All") queryParams.append("module", filters.module)
      if (filters.action !== "All") queryParams.append("action", filters.action)
      if (filters.user) queryParams.append("user", filters.user)

      const response = await fetch(`http://localhost:5000/system-logs?${queryParams}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data)
        setFilteredLogs(data)
      } else {
        console.error("Failed to fetch system logs")
        // Fallback to empty array
        setLogs([])
        setFilteredLogs([])
      }
    } catch (error) {
      console.error("Error fetching system logs:", error)
      // Fallback to empty array
      setLogs([])
      setFilteredLogs([])
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const response = await fetch("http://localhost:5000/branches")
      if (response.ok) {
        const data = await response.json()
        setBranches(data)
      }
    } catch (error) {
      console.error("Error fetching branches:", error)
    }
  }

  const loadMaterialDataFromStorage = () => {
    const savedData = localStorage.getItem("concreteDeliveryData")
    if (savedData) {
      const data = JSON.parse(savedData)
      setMaterialData(data)
      setFilteredMaterialData(data)
    }
  }

  const formatExcelDate = (excelDate) => {
    if (typeof excelDate === "number") {
      // Excel date serial number
      const date = new Date((excelDate - 25569) * 86400 * 1000)
      return date.toISOString().split("T")[0]
    } else if (typeof excelDate === "string") {
      // Try to parse as date string
      const date = new Date(excelDate)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0]
      }
    }
    return ""
  }

  // Load Material Data from Excel
  const loadMaterialDataFromExcel = async () => {
    setIsLoadingMaterial(true)
    try {
      // Try to fetch from public folder first
      const response = await fetch("/full_concrete_delivery_log.xlsx")
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        // Skip header row and transform data
        const headers = jsonData[0]
        const dataRows = jsonData.slice(1)

        const transformedData = dataRows
          .map((row, index) => {
            const rowData = {}
            headers.forEach((header, colIndex) => {
              rowData[header] = row[colIndex] || ""
            })

            return {
              id: index + 1,
              sno: index + 1,
              date: rowData["Date"] ? formatExcelDate(rowData["Date"]) : "",
              partyName: rowData["Party Name"] || "",
              pb: rowData["P/B"] || "",
              grade: rowData["Grade"] || "",
              qty: Number.parseFloat(rowData["Qty"]) || 0,
              rate: Number.parseFloat(rowData["Rate"]) || 0,
              billNo: rowData["Bill No"] || "",
              billDate: rowData["Bill Date"] ? formatExcelDate(rowData["Bill Date"]) : "",
              cement: Number.parseFloat(rowData["Cement"]) || 0,
              silo2: Number.parseFloat(rowData["Silo 2"]) || 0,
              mm20: Number.parseFloat(rowData["20MM"]) || 0,
              mm12: Number.parseFloat(rowData["12MM"]) || 0,
              mSand: Number.parseFloat(rowData["M.Sand"]) || 0,
              admixTrue: Number.parseFloat(rowData["Admix True"]) || 0,
              flyAshUsage: Number.parseFloat(rowData["Fly Ash Usage"]) || 0,
              remark: rowData["Remark"] || "",
            }
          })
          .filter((item) => item.partyName) // Filter out empty rows

        setMaterialData(transformedData)
        setFilteredMaterialData(transformedData)
        localStorage.setItem("concreteDeliveryData", JSON.stringify(transformedData))
        alert(`Successfully loaded ${transformedData.length} records from full_concrete_delivery_log.xlsx`)
      } else {
        throw new Error("File not found in public folder")
      }
    } catch (error) {
      console.error("Auto-load failed, opening file picker:", error)
      // Fallback to file picker
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".xlsx,.xls"
      input.onchange = handleMaterialFileSelect
      input.click()
    } finally {
      setIsLoadingMaterial(false)
    }
  }

  const handleMaterialFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          // Skip header row and transform data
          const headers = jsonData[0]
          const dataRows = jsonData.slice(1)

          const transformedData = dataRows
            .map((row, index) => {
              const rowData = {}
              headers.forEach((header, colIndex) => {
                rowData[header] = row[colIndex] || ""
              })

              return {
                id: index + 1,
                sno: index + 1,
                date: rowData["Date"] ? formatExcelDate(rowData["Date"]) : "",
                partyName: rowData["Party Name"] || "",
                pb: rowData["P/B"] || "",
                grade: rowData["Grade"] || "",
                qty: Number.parseFloat(rowData["Qty"]) || 0,
                rate: Number.parseFloat(rowData["Rate"]) || 0,
                billNo: rowData["Bill No"] || "",
                billDate: rowData["Bill Date"] ? formatExcelDate(rowData["Bill Date"]) : "",
                cement: Number.parseFloat(rowData["Cement"]) || 0,
                silo2: Number.parseFloat(rowData["Silo 2"]) || 0,
                mm20: Number.parseFloat(rowData["20MM"]) || 0,
                mm12: Number.parseFloat(rowData["12MM"]) || 0,
                mSand: Number.parseFloat(rowData["M.Sand"]) || 0,
                admixTrue: Number.parseFloat(rowData["Admix True"]) || 0,
                flyAshUsage: Number.parseFloat(rowData["Fly Ash Usage"]) || 0,
                remark: rowData["Remark"] || "",
              }
            })
            .filter((item) => item.partyName) // Filter out empty rows

          setMaterialData(transformedData)
          setFilteredMaterialData(transformedData)
          localStorage.setItem("concreteDeliveryData", JSON.stringify(transformedData))
          alert(`Successfully loaded ${transformedData.length} records from ${file.name}`)
        } catch (error) {
          console.error("Error parsing Excel file:", error)
          alert(
            "Error reading Excel file. Please ensure it's a valid Excel file (.xlsx or .xls) with the correct column headers.",
          )
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  useEffect(() => {
    fetchSystemLogs()
  }, [filters])

  useEffect(() => {
    let filtered = materialData

    // Filter by date range
    if (materialFilters.dateFrom) {
      filtered = filtered.filter((item) => new Date(item.date) >= new Date(materialFilters.dateFrom))
    }

    if (materialFilters.dateTo) {
      filtered = filtered.filter((item) => new Date(item.date) <= new Date(materialFilters.dateTo))
    }

    // Filter by party name
    if (materialFilters.partyName) {
      filtered = filtered.filter((item) =>
        item.partyName.toLowerCase().includes(materialFilters.partyName.toLowerCase()),
      )
    }

    // Filter by grade
    if (materialFilters.grade !== "All") {
      filtered = filtered.filter((item) => item.grade === materialFilters.grade)
    }

    // Filter by P/B
    if (materialFilters.pb !== "All") {
      filtered = filtered.filter((item) => item.pb === materialFilters.pb)
    }

    setFilteredMaterialData(filtered)
  }, [materialData, materialFilters])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      branch: "All",
      user: "",
      module: "All",
      action: "All",
    })
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredLogs)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "System Logs")
    XLSX.writeFile(workbook, "system_logs.xlsx")
  }

  const exportMaterialToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredMaterialData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Concrete Delivery Data")
    XLSX.writeFile(workbook, "concrete_delivery_data.xlsx")
  }

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank")
    const tableHTML = document.querySelector(".logs-table").outerHTML

    printWindow.document.write(`
      <html>
        <head>
          <title>System Logs Report</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; }
            .action-add { color: green; }
            .action-update { color: blue; }
            .action-delete { color: red; }
            .action-login { color: purple; }
          </style>
        </head>
        <body>
          <h1>System Logs Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Total Records: ${filteredLogs.length}</p>
          ${tableHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.print()
  }

  const getActionClass = (action) => {
    switch (action.toLowerCase()) {
      case "add":
        return "action-add"
      case "update":
        return "action-update"
      case "delete":
        return "action-delete"
      case "login":
        return "action-login"
      case "logout":
        return "action-logout"
      default:
        return "action-default"
    }
  }

  return (
    <div className="logs">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">📝</div>
          <h2>System Logs</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-export" onClick={exportToPDF}>
            📄 Export PDF
          </button>
        </div>
      </div>

      <div className="filters-section">
        <div className="advanced-filters">
          <div className="filter-row">
            <div className="date-range-container">
              <div className="date-input-wrapper">
                <label className="date-label">📅 From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                  className="enhanced-date-input"
                />
              </div>
              <div className="date-separator">→</div>
              <div className="date-input-wrapper">
                <label className="date-label">📅 To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                  className="enhanced-date-input"
                />
              </div>
            </div>
          </div>

          <div className="filter-row">
            <div className="custom-select-wrapper">
              <label className="select-label">🏢 Branch</label>
              <div className="custom-select">
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.branch_name}>
                      🏢 {branch.branch_name}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            <div className="custom-select-wrapper">
              <label className="select-label">📋 Module</label>
              <div className="custom-select">
                <select
                  value={filters.module}
                  onChange={(e) => handleFilterChange("module", e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Modules</option>
                  {modules.map((module) => (
                    <option key={module} value={module}>
                      📋 {module}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            <div className="custom-select-wrapper">
              <label className="select-label">⚡ Action</label>
              <div className="custom-select">
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Actions</option>
                  {actions.map((action) => (
                    <option key={action} value={action}>
                      {action === "Add" && "➕"}
                      {action === "Update" && "✏️"}
                      {action === "Delete" && "🗑️"}
                      {action === "Login" && "🔐"}
                      {action === "Logout" && "🚪"}
                      {action === "View" && "👁️"}
                      {action === "Export" && "📊"}
                      {action === "Inaction" && "⏸️"}
                      {action}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            <div className="search-input-wrapper">
              <label className="search-label">👤 User</label>
              <input
                type="text"
                placeholder="Search by user..."
                value={filters.user}
                onChange={(e) => handleFilterChange("user", e.target.value)}
                className="enhanced-search-input"
              />
            </div>
          </div>

          <div className="filter-actions-row">
            <button className="btn btn-clear-all" onClick={clearFilters}>
              🗑️ Clear All Filters
            </button>
            <div className="filter-summary">
              <span className="results-badge">
                📊 {filteredLogs.length} of {logs.length} records
              </span>
              <div className="active-filters">
                {Object.entries(filters).filter(([key, value]) => value && value !== "All" && value !== "").length >
                  0 && (
                  <span className="active-filters-count">
                    🔍{" "}
                    {Object.entries(filters).filter(([key, value]) => value && value !== "All" && value !== "").length}{" "}
                    filters active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoadingLogs ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading system logs...</p>
        </div>
      ) : (
        <div className="logs-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Branch Name</th>
                <th>Module Name</th>
                <th>Action Performed</th>
                <th>Action By</th>
                <th>Action On</th>
                <th>Timestamp</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr key={log.id}>
                  <td>{index + 1}</td>
                  <td>{log.branch_name}</td>
                  <td>{log.module_name}</td>
                  <td>
                    <span className={`action-badge ${getActionClass(log.action_performed)}`}>
                      {log.action_performed}
                    </span>
                  </td>
                  <td>{log.action_by}</td>
                  <td>{log.action_on}</td>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLogs.length === 0 && (
            <div className="no-data">
              <p>No logs found matching the selected criteria</p>
            </div>
          )}
        </div>
      )}

      <div className="logs-summary">
        <div className="summary-cards">
          <div className="summary-card">
            <h4>Total Logs</h4>
            <span className="summary-number">{logs.length}</span>
          </div>
          <div className="summary-card">
            <h4>Filtered Results</h4>
            <span className="summary-number">{filteredLogs.length}</span>
          </div>
          <div className="summary-card">
            <h4>Today's Logs</h4>
            <span className="summary-number">
              {logs.filter((log) => new Date(log.timestamp).toDateString() === new Date().toDateString()).length}
            </span>
          </div>
          <div className="summary-card">
            <h4>Active Users</h4>
            <span className="summary-number">{[...new Set(logs.map((log) => log.action_by))].length}</span>
          </div>
        </div>
      </div>
      <br />
      {/* Concrete Delivery Data Section */}
      <div className="concrete-delivery-section">
        <div className="section-header">
          <div className="section-title">
            <div className="section-icon">🚛</div>
            <h2>Concrete Delivery Log</h2>
          </div>
          <div className="header-actions">
            <button
              className={`btn btn-load-material ${isLoadingMaterial ? "loading" : ""}`}
              onClick={loadMaterialDataFromExcel}
              disabled={isLoadingMaterial}
            >
              {isLoadingMaterial ? "⏳ Loading..." : "📋 Load Delivery Data"}
            </button>
            <button className="btn btn-export" onClick={exportMaterialToExcel}>
              📊 Export Delivery Data
            </button>
          </div>
        </div>

        <div className="concrete-delivery-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Party Name</th>
                <th>P/B</th>
                <th>Grade</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Bill No</th>
                <th>Bill Date</th>
                <th>Cement</th>
                <th>Silo 2</th>
                <th>20MM</th>
                <th>12MM</th>
                <th>M.Sand</th>
                <th>Admix True</th>
                <th>Fly Ash Usage</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterialData.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{new Date(item.date).toLocaleDateString()}</td>
                  <td>{item.partyName}</td>
                  <td>
                    <span className={`pb-badge ${item.pb === "P" ? "pb-purchase" : "pb-billing"}`}>{item.pb}</span>
                  </td>
                  <td>
                    <span className="grade-badge">{item.grade}</span>
                  </td>
                  <td className="qty-cell">{item.qty}</td>
                  <td className="rate-cell">₹{item.rate.toLocaleString()}</td>
                  <td>{item.billNo}</td>
                  <td>{new Date(item.billDate).toLocaleDateString()}</td>
                  <td className="material-qty">{item.cement}</td>
                  <td className="material-qty">{item.silo2}</td>
                  <td className="material-qty">{item.mm20}</td>
                  <td className="material-qty">{item.mm12}</td>
                  <td className="material-qty">{item.mSand}</td>
                  <td className="material-qty">{item.admixTrue}</td>
                  <td className="material-qty">{item.flyAshUsage}</td>
                  <td className="remark-cell">{item.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMaterialData.length === 0 && (
            <div className="no-data">
              <p>No concrete delivery data found. Click "Load Delivery Data" to import from Excel file.</p>
            </div>
          )}
        </div>

        <div className="concrete-delivery-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <h4>Total Records</h4>
              <span className="summary-number">{materialData.length}</span>
            </div>
            <div className="summary-card">
              <h4>Total Quantity</h4>
              <span className="summary-number">{filteredMaterialData.reduce((sum, item) => sum + item.qty, 0)}</span>
            </div>
            <div className="summary-card">
              <h4>Total Value</h4>
              <span className="summary-number">
                ₹{filteredMaterialData.reduce((sum, item) => sum + item.qty * item.rate, 0).toLocaleString()}
              </span>
            </div>
            <div className="summary-card">
              <h4>Unique Parties</h4>
              <span className="summary-number">
                {[...new Set(filteredMaterialData.map((item) => item.partyName))].length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .logs {
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

        .header-actions {
          display: flex;
          gap: 15px;
        }

        .filters-section {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          margin-bottom: 30px;
        }

        .advanced-filters {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .filter-row {
          display: flex;
          gap: 20px;
          align-items: end;
          flex-wrap: wrap;
        }

        .date-range-container {
          display: flex;
          align-items: end;
          gap: 15px;
        }

        .date-input-wrapper, .custom-select-wrapper, .search-input-wrapper {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 150px;
        }

        .date-label, .select-label, .search-label {
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .enhanced-date-input, .enhanced-select, .enhanced-search-input {
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.3s ease;
        }

        .enhanced-date-input:focus, .enhanced-select:focus, .enhanced-search-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .date-separator {
          font-size: 18px;
          color: #667eea;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .custom-select {
          position: relative;
        }

        .select-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #666;
        }

        .filter-actions-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }

        .filter-summary {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .results-badge {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .active-filters-count {
          background: #28a745;
          color: white;
          padding: 6px 12px;
          border-radius: 15px;
          font-size: 12px;
          font-weight: 600;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .logs-table, .concrete-delivery-table {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          margin-bottom: 30px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        th, td {
          padding: 12px;
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

        .action-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .action-add {
          background: #d4edda;
          color: #155724;
        }

        .action-update {
          background: #cce7ff;
          color: #004085;
        }

        .action-delete {
          background: #f8d7da;
          color: #721c24;
        }

        .action-login {
          background: #e2e3e5;
          color: #383d41;
        }

        .action-logout {
          background: #fff3cd;
          color: #856404;
        }

        .action-default {
          background: #e9ecef;
          color: #495057;
        }

        .pb-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .pb-purchase {
          background: #d4edda;
          color: #155724;
        }

        .pb-billing {
          background: #cce7ff;
          color: #004085;
        }

        .grade-badge {
          background: #fff3cd;
          color: #856404;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .qty-cell, .rate-cell, .material-qty {
          font-weight: 600;
          text-align: right;
        }

        .remark-cell {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .no-data {
          text-align: center;
          padding: 60px 20px;
          color: #6c757d;
        }

        .logs-summary, .concrete-delivery-summary {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .summary-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          border: 1px solid #dee2e6;
        }

        .summary-card h4 {
          margin: 0 0 10px 0;
          color: #495057;
          font-size: 14px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .summary-number {
          font-size: 28px;
          font-weight: bold;
          color: #333;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
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

        .btn-clear-all {
          background: #6c757d;
          color: white;
        }

        .btn-load-material {
          background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
          color: white;
        }

        .btn-load-material.loading {
          background: #6c757d;
        }

        .concrete-delivery-section {
          margin-top: 40px;
        }

        @media (max-width: 768px) {
          .section-header {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .filter-row {
            flex-direction: column;
            align-items: stretch;
          }

          .date-range-container {
            flex-direction: column;
          }

          .filter-actions-row {
            flex-direction: column;
            gap: 15px;
          }

          .summary-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

export default Logs
