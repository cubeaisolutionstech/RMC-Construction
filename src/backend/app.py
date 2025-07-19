from flask import Flask, request, jsonify
from flask_cors import CORS
from db_config import get_db_connection
import mysql.connector
from datetime import datetime
import json
import os
import requests
from werkzeug.utils import secure_filename
import tempfile
from license_plate_service import process_vehicle_video, create_new_vehicles_table
app = Flask(__name__)
CORS(app)

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 16MB max file size

# Extractor service URL
EXTRACTOR_SERVICE_URL = "http://localhost:8001"

# License plate processing service URL
LICENSE_PLATE_SERVICE_URL = "http://127.0.0.1:8000"

# Function to log system activities
def log_system_activity(branch_name, module_name, action_performed, action_by, action_on, ip_address="127.0.0.1"):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO system_logs (branch_name, module_name, action_performed, action_by, action_on, ip_address, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        '''
        values = (branch_name, module_name, action_performed, action_by, action_on, ip_address, datetime.now())
        
        cursor.execute(query, values)
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error logging system activity: {str(e)}")

# Initialize database tables
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create employees table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            date_of_birth DATE,
            gender ENUM('Male', 'Female', 'Other'),
            phone_number VARCHAR(15),
            email_id VARCHAR(255) UNIQUE,
            address TEXT,
            aadhar_number VARCHAR(12),
            pan_number VARCHAR(10),
            joining_date DATE,
            designation VARCHAR(100),
            department VARCHAR(100),
            emergency_contact VARCHAR(15),
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create branches table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS branches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_name VARCHAR(255) NOT NULL,
            address TEXT,
            contact_number VARCHAR(15),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create roles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            role_name VARCHAR(100) NOT NULL,
            permissions JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create employee_login table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employee_login (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT,
            branch_id INT,
            login_id VARCHAR(50) UNIQUE,
            password VARCHAR(255),
            role_id INT,
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (branch_id) REFERENCES branches(id),
            FOREIGN KEY (role_id) REFERENCES roles(id)
        )
    ''')
    
    # Create login table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS login (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            branch_id INT,
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            last_login DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_name VARCHAR(255) NOT NULL,
            address TEXT,
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            status ENUM('Active', 'Inactive', 'Completed') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create po_details table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS po_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            poNumber VARCHAR(50) NOT NULL,
            material VARCHAR(100) NOT NULL,
            supplier VARCHAR(100) NOT NULL,
            quantity DECIMAL(10,2) NOT NULL,
            rate DECIMAL(10,2) NOT NULL,
            totalAmount DECIMAL(15,2) NOT NULL,
            poType VARCHAR(50) NOT NULL,
            deliveryDate DATE NOT NULL,
            narration TEXT,
            status VARCHAR(20) DEFAULT 'Active',
            createdAt DATETIME NOT NULL,
            updatedAt DATETIME NOT NULL
        )
    ''')
    
    # Create invoice_items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoice_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            vehicle_number VARCHAR(255),
            description TEXT,
            quantity DECIMAL(10,2),
            rate DECIMAL(10,2),
            amount DECIMAL(10,2),
            supplier_name VARCHAR(255),
            invoice_date DATE,
            invoice_number VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create weighbridge_data table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weighbridge_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            vehicle_number VARCHAR(50),
            ticket_number VARCHAR(50),
            gross_weight DECIMAL(10,2),
            tare_weight DECIMAL(10,2),
            net_weight DECIMAL(10,2),
            material VARCHAR(255),
            supplier_name VARCHAR(255),
            date_time DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create supplier table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS supplier (
            id INT AUTO_INCREMENT PRIMARY KEY,
            poNumber VARCHAR(50) NOT NULL,
            poBalanceQty DECIMAL(10,2) NOT NULL,
            inwardNo VARCHAR(50) NOT NULL,
            vehicleNo VARCHAR(50) NOT NULL,
            dateTime DATETIME NOT NULL,
            supplierName VARCHAR(255) NOT NULL,
            material VARCHAR(255) NOT NULL,
            uom VARCHAR(50) DEFAULT 'tons',
            receivedQty DECIMAL(10,2),
            receivedBy VARCHAR(255),
            supplierBillQty DECIMAL(10,2),
            poRate DECIMAL(10,2) NOT NULL,
            supplierBillRate DECIMAL(10,2),
            supplierBillFile VARCHAR(255),
            difference DECIMAL(10,2),
            status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    
    
    # Create system_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sno INT,
            branch_name VARCHAR(255),
            module_name VARCHAR(255),
            action_performed VARCHAR(100),
            action_by VARCHAR(255),
            action_on VARCHAR(255),
            timestamp DATETIME,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(sno)
        )
    ''')
    
    # Create batch_slips table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS batch_slips (
            id INT AUTO_INCREMENT PRIMARY KEY,
            plant_serial_number VARCHAR(50),
            batch_date DATE,
            batch_start_time TIME,
            batch_end_time TIME,
            batch_number VARCHAR(50) UNIQUE,
            customer VARCHAR(255),
            site VARCHAR(255),
            recipe_code VARCHAR(50),
            recipe_name VARCHAR(255),
            truck_number VARCHAR(50),
            truck_driver VARCHAR(255),
            order_number VARCHAR(50),
            batcher_name VARCHAR(255),
            ordered_quantity DECIMAL(10, 2),
            production_quantity DECIMAL(10, 2),
            adj_manual_quantity DECIMAL(10, 2),
            with_this_load DECIMAL(10, 2),
            mixer_capacity DECIMAL(10, 2),
            batch_size DECIMAL(10, 2),
            client_name VARCHAR(255),
            client_address TEXT,
            client_email VARCHAR(255),
            client_gstin VARCHAR(50),
            description VARCHAR(255),
            hsn_code VARCHAR(20),
            quantity DECIMAL(10, 2),
            rate DECIMAL(10, 2),
            unit VARCHAR(20),
            status ENUM('Active', 'Completed', 'Cancelled') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create invoices table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_number VARCHAR(50) UNIQUE,
            batch_slip_id INT,
            client_name VARCHAR(255),
            client_address TEXT,
            client_email VARCHAR(255),
            client_gstin VARCHAR(50),
            description VARCHAR(255),
            hsn_code VARCHAR(20),
            quantity DECIMAL(10, 2),
            rate DECIMAL(10, 2),
            unit VARCHAR(20),
            total_amount DECIMAL(12, 2),
            cgst DECIMAL(12, 2),
            sgst DECIMAL(12, 2),
            grand_total DECIMAL(12, 2),
            amount_in_words TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_slip_id) REFERENCES batch_slips(id)
        )
    ''')
    
    # Create grn table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS grn (
            id INT AUTO_INCREMENT PRIMARY KEY,
            grn_number VARCHAR(50) UNIQUE,
            linked_po_number VARCHAR(50),
            supplier_name VARCHAR(255),
            project VARCHAR(255),
            received_quantity DECIMAL(10, 2),
            received_date DATE,
            material_condition ENUM('Good', 'Damaged', 'Partially Damaged', 'Rejected'),
            supporting_document VARCHAR(255),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create po_payments table for tracking PO payments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS po_payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            po_id INT,
            po_number VARCHAR(50),
            payment_amount DECIMAL(15, 2),
            payment_date DATE,
            payment_method VARCHAR(50),
            reference_number VARCHAR(100),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (po_id) REFERENCES po_details(id)
        )
    ''')

    # Create invoice_payments table for tracking invoice payments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoice_payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT,
            invoice_number VARCHAR(50),
            payment_amount DECIMAL(15, 2),
            payment_date DATE,
            payment_method VARCHAR(50),
            reference_number VARCHAR(100),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()

# Function to automatically create supplier details when vehicle is added
def auto_create_supplier_detail(vehicle_data):
    print("Creating supplier detail...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get PO data based on supplier and material
        cursor.execute('''
            SELECT poNumber, supplier, material, quantity, rate, 
                   (quantity - COALESCE((SELECT SUM(supplierBillQty) FROM supplier 
                                       WHERE poNumber = po_details.poNumber AND supplierBillQty IS NOT NULL), 0)) as balance_qty
            FROM po_details 
            WHERE supplier = %s AND material = %s AND status = 'Active'
            ORDER BY createdAt DESC LIMIT 1
        ''', (vehicle_data['supplier_name'], vehicle_data['material']))
        po_data = cursor.fetchone()
        
        if not po_data:
            print(f"No PO found for supplier: {vehicle_data['supplier_name']}, material: {vehicle_data['material']}")
            cursor.close()
            conn.close()
            return
        
        # Get weighbridge data for received quantity
        cursor.execute('''
            SELECT net_weight FROM weighbridge_data 
            WHERE vehicle_number = %s 
            ORDER BY date_time DESC LIMIT 1
        ''', (vehicle_data['vehicle_number'],))
        weighbridge_data = cursor.fetchone()
        
        # Get current user from login (for demo, using a default user)
        received_by = "System Auto"  # In real scenario, get from current session
        
        # Check if supplier detail already exists for this vehicle
        cursor.execute('''
            SELECT id FROM supplier WHERE vehicleNo = %s AND inwardNo = %s
        ''', (vehicle_data['vehicle_number'], vehicle_data['inward_no']))
        existing = cursor.fetchone()
        
        if existing:
            print(f"Supplier detail already exists for vehicle: {vehicle_data['vehicle_number']}")
            cursor.close()
            conn.close()
            return
        
        # Create supplier detail
        supplier_detail = {
            'poNumber': po_data['poNumber'],
            'poBalanceQty': float(po_data['balance_qty']) if po_data['balance_qty'] else float(po_data['quantity']),
            'inwardNo': vehicle_data['inward_no'],
            'vehicleNo': vehicle_data['vehicle_number'],
            'dateTime': vehicle_data['entry_time'],
            'supplierName': vehicle_data['supplier_name'],
            'material': vehicle_data['material'],
            'uom': 'tons',
            'receivedQty': float(weighbridge_data['net_weight']) if weighbridge_data else 0,
            'receivedBy': received_by,
            'poRate': float(po_data['rate']) if po_data['rate'] else 0,
            'status': 'Pending'
        }
        
        query = '''
            INSERT INTO supplier (poNumber, poBalanceQty, inwardNo, vehicleNo, dateTime,
            supplierName, material, uom, receivedQty, receivedBy, poRate, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        values = (
            supplier_detail['poNumber'], supplier_detail['poBalanceQty'], 
            supplier_detail['inwardNo'], supplier_detail['vehicleNo'],
            supplier_detail['dateTime'], supplier_detail['supplierName'], 
            supplier_detail['material'], supplier_detail['uom'],
            supplier_detail['receivedQty'], supplier_detail['receivedBy'], 
            supplier_detail['poRate'], supplier_detail['status']
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        print(f"Auto-created supplier detail for vehicle: {vehicle_data['vehicle_number']}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error auto-creating supplier detail: {str(e)}")

@app.route('/batch-slips', methods=['POST'])
def create_batch_slip():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()

        query = '''
            INSERT INTO batch_slips (
                plant_serial_number, batch_date, batch_start_time, batch_end_time,
                batch_number, customer, site, recipe_code, recipe_name, truck_number,
                truck_driver, order_number, batcher_name, ordered_quantity, production_quantity,
                adj_manual_quantity, with_this_load, mixer_capacity, batch_size, client_name,
                client_address, client_email, client_gstin, description, hsn_code,
                quantity, rate, unit
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s
            )
        '''

        values = (
            data['plantSerialNumber'], data['batchDate'], data['batchStartTime'], data['batchEndTime'],
            data['batchNumber'], data['customer'], data['site'], data['recipeCode'], data['recipeName'], data['truckNumber'],
            data['truckDriver'], data['orderNumber'], data['batcherName'], data['orderedQuantity'], data['productionQuantity'],
            data['adjManualQuantity'], data['withThisLoad'], data['mixerCapacity'], data['batchSize'], data['clientName'],
            data['clientAddress'], data['clientEmail'], data['clientGSTIN'], data['description'], data['hsn'],
            data['quantity'], data['rate'], data['unit']
        )

        cursor.execute(query, values)
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Batch slip created successfully!"}), 201

    except Exception as e:
        print(f"Error creating batch slip: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Login Authentication Route
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    query = '''
        SELECT l.*, e.full_name, b.branch_name 
        FROM login l
        LEFT JOIN employees e ON l.employee_id = e.id
        LEFT JOIN branches b ON l.branch_id = b.id
        WHERE l.username = %s AND l.password = %s AND l.status = 'Active'
    '''
    
    cursor.execute(query, (username, password))
    user = cursor.fetchone()
    
    if user:
        # Update last login
        cursor.execute('UPDATE login SET last_login = %s WHERE id = %s', 
                      (datetime.now(), user['id']))
        conn.commit()
        
        # Log login activity
        log_system_activity(
            user.get('branch_name', 'Main Branch'),
            'System',
            'Login',
            username,
            'System Login',
            request.remote_addr
        )
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
                'full_name': user['full_name'],
                'branch_name': user['branch_name']
            }
        })
    else:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/vehicles/process-video', methods=['POST'])
def process_video():
    """
    Updated video processing route that integrates with license plate detection
    and material detection Python scripts
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        file.save(temp_path)
        
        try:
            # Process the video using the integrated Python scripts
            result = process_vehicle_video(temp_path)
            
            # Clean up temporary file
            os.remove(temp_path)
            
            if result['success']:
                if result['matched']:
                    # Vehicle exists in database
                    return jsonify({
                        'success': True,
                        'matched': True,
                        'vehicle_number': result['vehicle_number'],
                        'existing_vehicle': result['existing_vehicle'],
                        'message': 'Vehicle matched in database'
                    })
                else:
                    # New vehicle detected
                    return jsonify({
                        'success': True,
                        'matched': False,
                        'vehicle_number': result['vehicle_number'],
                        'vehicle_data': result['vehicle_data'],
                        'message': 'New vehicle detected, please fill remaining details'
                    })
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 400
                
        except Exception as e:
            # Clean up temporary file in case of error
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({
                'success': False,
                'error': f'Processing error: {str(e)}'
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vehicles', methods=['POST'])
def create_vehicle():
    """
    Updated vehicle creation route for the new table structure
    """
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Generate serial number
        cursor.execute('SELECT MAX(sno) FROM vehicles')
        max_sno = cursor.fetchone()['MAX(sno)']
        new_sno = (max_sno + 1) if max_sno else 1

        # Check if vehicle already exists
        cursor.execute('SELECT * FROM vehicles WHERE vehicle_number = %s', (data['vehicle_number'],))
        existing_vehicle = cursor.fetchone()

        if existing_vehicle:
            # Update existing vehicle entry
            query = '''
                UPDATE vehicles 
                SET material = COALESCE(%s, material),
                    entry_time = %s
                WHERE vehicle_number = %s
            '''
            values = (
                data.get('material'),
                data.get('entry_time', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                data['vehicle_number']
            )
            cursor.execute(query, values)
            message = "Vehicle entry updated successfully"
        else:
            # Create new vehicle entry
            query = '''
                INSERT INTO vehicles (sno, inward_no, vehicle_number, material, entry_time)
                VALUES (%s, %s, %s, %s, %s)
            '''
            values = (
                new_sno,
                data.get('inward_no'),
                data['vehicle_number'],
                data.get('material'),
                data.get('entry_time', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            )
            cursor.execute(query, values)
            message = "Vehicle entry created successfully"

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": message}), 201

    except Exception as e:
        print(f"Error in create_vehicle: {str(e)}")
        return jsonify({"error": str(e)}), 500
@app.route('/vehicles', methods=['GET'])
def get_vehicles():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM vehicles ORDER BY entry_time DESC")
        vehicles = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(vehicles)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/vehicles/init-table', methods=['POST'])
def initialize_vehicles_table():
    """
    Route to initialize/recreate the vehicles table with new structure
    """
    try:
        success = create_new_vehicles_table()
        if success:
            return jsonify({"message": "Vehicles table initialized successfully"}), 200
        else:
            return jsonify({"error": "Failed to initialize vehicles table"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# System Logs Routes
@app.route('/system-logs', methods=['GET'])
def get_system_logs():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get query parameters for filtering
        date_from = request.args.get('dateFrom')
        date_to = request.args.get('dateTo')
        branch = request.args.get('branch')
        module = request.args.get('module')
        action = request.args.get('action')
        user = request.args.get('user')
        
        # Build query with filters
        query = 'SELECT * FROM system_logs WHERE 1=1'
        params = []
        
        if date_from:
            query += ' AND DATE(timestamp) >= %s'
            params.append(date_from)
        
        if date_to:
            query += ' AND DATE(timestamp) <= %s'
            params.append(date_to)
        
        if branch and branch != 'All':
            query += ' AND branch_name = %s'
            params.append(branch)
        
        if module and module != 'All':
            query += ' AND module_name = %s'
            params.append(module)
        
        if action and action != 'All':
            query += ' AND action_performed = %s'
            params.append(action)
        
        if user:
            query += ' AND action_by LIKE %s'
            params.append(f'%{user}%')
        
        query += ' ORDER BY timestamp DESC'
        
        cursor.execute(query, params)
        logs = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return jsonify(logs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/system-logs', methods=['POST'])
def create_system_log():
    try:
        data = request.json
        log_system_activity(
            data.get('branch_name', 'Main Branch'),
            data.get('module_name'),
            data.get('action_performed'),
            data.get('action_by'),
            data.get('action_on'),
            data.get('ip_address', request.remote_addr)
        )
        return jsonify({'message': 'Log created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Upload and extract bill data
@app.route('/supplier/upload-bill', methods=['POST'])
def upload_bill():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        vehicle_number = request.form.get('vehicle_number')
        supplier_id = request.form.get('supplier_id')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not vehicle_number:
            return jsonify({'error': 'Vehicle number required'}), 400
        
        # Save uploaded file
        filename = secure_filename(f"{vehicle_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Send file to extractor service
        try:
            with open(file_path, 'rb') as f:
                files = {'file': (filename, f, file.content_type)}
                data = {'vehicle_number': vehicle_number}
                
                response = requests.post(
                    f"{EXTRACTOR_SERVICE_URL}/extract-invoice/",
                    files=files,
                    data=data,
                    timeout=60
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result['status'] == 'success':
                        # Update supplier record with bill file name
                        if supplier_id:
                            conn = get_db_connection()
                            cursor = conn.cursor()
                            cursor.execute('''
                                UPDATE supplier SET supplierBillFile = %s WHERE id = %s
                            ''', (filename, supplier_id))
                            conn.commit()
                            cursor.close()
                            conn.close()
                        
                        return jsonify({
                            'success': True,
                            'filename': filename,
                            'extracted_data': result,
                            'message': 'Bill uploaded and processed successfully'
                        })
                    else:
                        return jsonify({
                            'success': False,
                            'error': result.get('error', 'Extraction failed'),
                            'message': 'Failed to extract bill data'
                        }), 500
                else:
                    return jsonify({
                        'success': False,
                        'error': 'Extractor service error',
                        'message': 'Failed to process bill'
                    }), 500
                    
        except requests.exceptions.RequestException as e:
            return jsonify({
                'success': False,
                'error': f'Extractor service unavailable: {str(e)}',
                'message': 'Please ensure extractor service is running on port 8001'
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get extracted bill data for vehicle
@app.route('/supplier/bill-data/<vehicle_no>', methods=['GET'])
def get_bill_data(vehicle_no):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT quantity, rate FROM invoice_items 
            WHERE vehicle_number = %s 
            ORDER BY created_at DESC LIMIT 1
        ''', (vehicle_no,))
        
        bill_data = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if bill_data:
            return jsonify({
                'supplierBillQty': float(bill_data['quantity']),
                'supplierBillRate': float(bill_data['rate'])
            })
        else:
            return jsonify({'error': 'No bill data found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Update supplier with bill data
@app.route('/supplier/<int:supplier_id>/update-bill', methods=['PUT'])
def update_supplier_bill_data(supplier_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Calculate difference
        po_rate_query = 'SELECT poRate FROM supplier WHERE id = %s'
        cursor.execute(po_rate_query, (supplier_id,))
        po_rate_result = cursor.fetchone()
        
        if po_rate_result:
            po_rate = float(po_rate_result[0])
            supplier_bill_rate = float(data.get('supplierBillRate', 0))
            difference = po_rate - supplier_bill_rate
            
            query = '''
                UPDATE supplier 
                SET supplierBillQty = %s, supplierBillRate = %s, difference = %s
                WHERE id = %s
            '''
            values = (
                data.get('supplierBillQty'), 
                data.get('supplierBillRate'), 
                difference,
                supplier_id
            )
            
            cursor.execute(query, values)
            conn.commit()
            
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Supplier bill data updated successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Employee Management Routes
@app.route('/employees', methods=['GET'])
def get_employees():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM employees ORDER BY created_at DESC')
    employees = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(employees)

@app.route('/employees', methods=['POST'])
def create_employee():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        INSERT INTO employees (full_name, date_of_birth, gender, phone_number, email_id, 
        address, aadhar_number, pan_number, joining_date, designation, department, 
        emergency_contact, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    '''
    
    values = (
        data['fullName'], data['dateOfBirth'], data['gender'], data['phoneNumber'],
        data['emailId'], data['address'], data['aadharNumber'], data['panNumber'],
        data['joiningDate'], data['designation'], data['department'],
        data['emergencyContact'], data.get('status', 'Active')
    )
    
    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        'Main Branch',
        'Employee Management',
        'Add',
        'System',
        f"Employee {data['fullName']}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Employee created successfully'}), 201

@app.route('/employees/<int:employee_id>', methods=['PUT'])
def update_employee(employee_id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        UPDATE employees SET full_name=%s, date_of_birth=%s, gender=%s, phone_number=%s,
        email_id=%s, address=%s, aadhar_number=%s, pan_number=%s, joining_date=%s,
        designation=%s, department=%s, emergency_contact=%s, status=%s
        WHERE id=%s
    '''
    
    values = (
        data['fullName'], data['dateOfBirth'], data['gender'], data['phoneNumber'],
        data['emailId'], data['address'], data['aadharNumber'], data['panNumber'],
        data['joiningDate'], data['designation'], data['department'],
        data['emergencyContact'], data.get('status', 'Active'), employee_id
    )
    
    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        'Main Branch',
        'Employee Management',
        'Update',
        'System',
        f"Employee ID {employee_id}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Employee updated successfully'})

@app.route('/employees/<int:employee_id>', methods=['DELETE'])
def delete_employee(employee_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Get employee name for logging
    cursor.execute('SELECT full_name FROM employees WHERE id = %s', (employee_id,))
    employee = cursor.fetchone()
    
    cursor.execute('DELETE FROM employees WHERE id = %s', (employee_id,))
    conn.commit()
    
    # Log the activity
    if employee:
        log_system_activity(
            'Main Branch',
            'Employee Management',
            'Delete',
            'System',
            f"Employee {employee['full_name']}",
            request.remote_addr
        )
    
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Employee deleted successfully'})

# Branch Management Routes
@app.route('/branches', methods=['GET'])
def get_branches():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM branches ORDER BY created_at DESC')
    branches = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(branches)

@app.route('/branches', methods=['POST'])
def create_branch():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = 'INSERT INTO branches (branch_name, address, contact_number) VALUES (%s, %s, %s)'
    values = (data['branchName'], data['address'], data['contactNumber'])
    
    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        data['branchName'],
        'Branch Management',
        'Add',
        'System',
        f"Branch {data['branchName']}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Branch created successfully'}), 201

@app.route('/branches/<int:branch_id>', methods=['PUT'])
def update_branch(branch_id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = 'UPDATE branches SET branch_name=%s, address=%s, contact_number=%s WHERE id=%s'
    values = (data['branchName'], data['address'], data['contactNumber'], branch_id)
    
    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        data['branchName'],
        'Branch Management',
        'Update',
        'System',
        f"Branch {data['branchName']}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Branch updated successfully'})

@app.route('/branches/<int:branch_id>', methods=['DELETE'])
def delete_branch(branch_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Get branch name for logging
    cursor.execute('SELECT branch_name FROM branches WHERE id = %s', (branch_id,))
    branch = cursor.fetchone()
    
    cursor.execute('DELETE FROM branches WHERE id = %s', (branch_id,))
    conn.commit()
    
    # Log the activity
    if branch:
        log_system_activity(
            branch['branch_name'],
            'Branch Management',
            'Delete',
            'System',
            f"Branch {branch['branch_name']}",
            request.remote_addr
        )
    
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Branch deleted successfully'})

@app.route('/roles', methods=['GET'])
def get_roles():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM roles ORDER BY created_at DESC')
    roles = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(roles)

@app.route('/roles', methods=['POST'])
def create_role():
    data = request.get_json()
    role_name = data.get('role_name')
    permissions = data.get('permissions')

    if not role_name or permissions is None:
        return jsonify({'error': 'Missing role_name or permissions'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    query = 'INSERT INTO roles (role_name, permissions, created_at) VALUES (%s, %s, %s)'
    values = (role_name, json.dumps(permissions), datetime.now())

    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        'Main Branch',
        'Role Management',
        'Add',
        'System',
        f"Role {role_name}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()

    return jsonify({'message': 'Role created successfully'}), 201

@app.route('/roles/<int:role_id>', methods=['PUT'])
def update_role(role_id):
    data = request.get_json()
    role_name = data.get('role_name')
    permissions = data.get('permissions')

    if not role_name or permissions is None:
        return jsonify({'error': 'Missing role_name or permissions'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    query = 'UPDATE roles SET role_name=%s, permissions=%s WHERE id=%s'
    values = (role_name, json.dumps(permissions), role_id)

    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        'Main Branch',
        'Role Management',
        'Update',
        'System',
        f"Role {role_name}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()

    return jsonify({'message': 'Role updated successfully'})

@app.route('/roles/<int:role_id>', methods=['DELETE'])
def delete_role(role_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Get role name for logging
    cursor.execute('SELECT role_name FROM roles WHERE id = %s', (role_id,))
    role = cursor.fetchone()
    
    cursor.execute('DELETE FROM roles WHERE id = %s', (role_id,))
    conn.commit()
    
    # Log the activity
    if role:
        log_system_activity(
            'Main Branch',
            'Role Management',
            'Delete',
            'System',
            f"Role {role['role_name']}",
            request.remote_addr
        )
    
    cursor.close()
    conn.close()

    return jsonify({'message': 'Role deleted successfully'})

# Employee Login Routes
@app.route('/employee-login', methods=['GET'])
def get_employee_logins():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    query = '''
        SELECT el.*, e.full_name as employee_name, b.branch_name, r.role_name
        FROM employee_login el
        LEFT JOIN employees e ON el.employee_id = e.id
        LEFT JOIN branches b ON el.branch_id = b.id
        LEFT JOIN roles r ON el.role_id = r.id
        ORDER BY el.created_at DESC
    '''
    cursor.execute(query)
    logins = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(logins)

@app.route('/employee-login', methods=['POST'])
def create_employee_login():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        INSERT INTO employee_login (employee_id, branch_id, login_id, password, role_id, status)
        VALUES (%s, %s, %s, %s, %s, %s)
    '''
    values = (
        data['employeeId'], data['branchId'], data['loginId'],
        data['password'], data['roleId'], data.get('status', 'Active')
    )
    
    cursor.execute(query, values)
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Employee login created successfully'}), 201

@app.route('/employee-login/<int:login_id>', methods=['DELETE'])
def delete_employee_login(login_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM employee_login WHERE id = %s', (login_id,))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Employee login deleted successfully'})

# GET all projects
@app.route('/projects', methods=['GET'])
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM projects ORDER BY created_at DESC')
    projects = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(projects)

# CREATE new project
@app.route('/projects', methods=['POST'])
def create_project():
    data = request.get_json(force=True)
    project_name = data.get('project_name')
    address = data.get('address')
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if not project_name or not address or latitude is None or longitude is None:
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    query = '''
        INSERT INTO projects (project_name, address, latitude, longitude, created_at)
        VALUES (%s, %s, %s, %s, %s)
    '''
    values = (project_name, address, latitude, longitude, datetime.now())

    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        'Main Branch',
        'Project Management',
        'Add',
        'System',
        f"Project {project_name}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()

    return jsonify({'message': 'Project created successfully'}), 201

# UPDATE project
@app.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    data = request.get_json(force=True)
    project_name = data.get('project_name')
    address = data.get('address')
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if not project_name or not address or latitude is None or longitude is None:
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    query = '''
        UPDATE projects
        SET project_name = %s, address = %s, latitude = %s, longitude = %s
        WHERE id = %s
    '''
    values = (project_name, address, latitude, longitude, project_id)

    cursor.execute(query, values)
    conn.commit()
    
    # Log the activity
    log_system_activity(
        'Main Branch',
        'Project Management',
        'Update',
        'System',
        f"Project {project_name}",
        request.remote_addr
    )
    
    cursor.close()
    conn.close()

    return jsonify({'message': 'Project updated successfully'})

# DELETE project
@app.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Get project name for logging
    cursor.execute('SELECT project_name FROM projects WHERE id = %s', (project_id,))
    project = cursor.fetchone()
    
    cursor.execute('DELETE FROM projects WHERE id = %s', (project_id,))
    conn.commit()
    
    # Log the activity
    if project:
        log_system_activity(
            'Main Branch',
            'Project Management',
            'Delete',
            'System',
            f"Project {project['project_name']}",
            request.remote_addr
        )
    
    cursor.close()
    conn.close()

    return jsonify({'message': 'Project deleted successfully'})

# PO Management Routes
@app.route("/po", methods=["GET"])
def get_all_po():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM po_details ORDER BY id DESC")
        result = cursor.fetchall()
        return jsonify(result)
    finally:
        conn.close()

@app.route("/po", methods=["POST"])
def add_po():
    try:
        data = request.json

        required_fields = ["poNumber", "material", "supplier", "quantity", "rate", "totalAmount", "poType", "deliveryDate", "status"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

        # Convert deliveryDate to MySQL-friendly format
        try:
            delivery_date = datetime.strptime(data["deliveryDate"], "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%d")
        except ValueError:
            try:
                delivery_date = datetime.strptime(data["deliveryDate"], "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Invalid date format for deliveryDate"}), 400

        narration = data.get("narration", "")

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        INSERT INTO po_details 
        (poNumber, material, supplier, quantity, rate, totalAmount, poType, deliveryDate, narration, status, createdAt, updatedAt)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            data["poNumber"],
            data["material"],
            data["supplier"],
            float(data["quantity"]),
            float(data["rate"]),
            float(data["totalAmount"]),
            data["poType"],
            delivery_date,
            narration,
            data["status"],
            datetime.now(),
            datetime.now()
        )

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'PO Details',
            'Add',
            'System',
            f"PO {data['poNumber']}",
            request.remote_addr
        )
        
        return jsonify({"message": "PO added successfully!"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()

@app.route("/po/<int:id>", methods=["DELETE"])
def delete_po(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get PO number for logging
        cursor.execute("SELECT poNumber FROM po_details WHERE id = %s", (id,))
        po = cursor.fetchone()
        
        cursor.execute("DELETE FROM po_details WHERE id = %s", (id,))
        conn.commit()
        
        # Log the activity
        if po:
            log_system_activity(
                'Main Branch',
                'PO Details',
                'Delete',
                'System',
                f"PO {po['poNumber']}",
                request.remote_addr
            )
        
        return jsonify({"message": "PO deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/po/<int:id>", methods=["PUT"])
def update_po(id):
    try:
        data = request.json

        required_fields = ["poNumber", "material", "supplier", "quantity", "rate", "totalAmount", "poType", "deliveryDate", "status"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

        try:
            delivery_date = datetime.strptime(data["deliveryDate"], "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%d")
        except ValueError:
            try:
                delivery_date = datetime.strptime(data["deliveryDate"], "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Invalid date format for deliveryDate"}), 400

        narration = data.get("narration", "")

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        UPDATE po_details SET
            poNumber = %s,
            material = %s,
            supplier = %s,
            quantity = %s,
            rate = %s,
            totalAmount = %s,
            poType = %s,
            deliveryDate = %s,
            narration = %s,
            status = %s,
            updatedAt = %s
        WHERE id = %s
        """
        values = (
            data["poNumber"],
            data["material"],
            data["supplier"],
            float(data["quantity"]),
            float(data["rate"]),
            float(data["totalAmount"]),
            data["poType"],
            delivery_date,
            narration,
            data["status"],
            datetime.now(),
            id
        )

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'PO Details',
            'Update',
            'System',
            f"PO {data['poNumber']}",
            request.remote_addr
        )
        
        return jsonify({"message": "PO updated successfully!"})

    except Exception as e:
        print(f"Update PO error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

# Supplier Routes - UPDATED
@app.route("/supplier", methods=["GET"])
def get_all_suppliers():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM supplier ORDER BY id DESC")
        result = cursor.fetchall()
        return jsonify(result)
    finally:
        conn.close()

@app.route("/supplier", methods=["POST"])
def add_supplier():
    try:
        data = request.json
        required_fields = [
            "poNumber", "poBalanceQty", "inwardNo", "vehicleNo", "dateTime",
            "supplierName", "material", "poRate"
        ]
        missing = [f for f in required_fields if not str(data.get(f, '')).strip()]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        # Calculate difference
        po_rate = float(data.get('poRate', 0))
        supplier_bill_rate = float(data.get('supplierBillRate', 0))
        difference = po_rate - supplier_bill_rate

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        INSERT INTO supplier
        (poNumber, poBalanceQty, inwardNo, vehicleNo, dateTime, supplierName,
         material, uom, receivedQty, receivedBy, supplierBillQty, poRate, 
         supplierBillRate, supplierBillFile, difference, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            data["poNumber"], data["poBalanceQty"], data["inwardNo"], data["vehicleNo"],
            data["dateTime"], data["supplierName"], data["material"], 
            data.get("uom", "tons"), data.get("receivedQty"), data.get("receivedBy"),
            data.get("supplierBillQty"), data["poRate"], data.get("supplierBillRate"),
            data.get("supplierBillFile"), difference, data.get("status", "Pending")
        )

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Supplier Details',
            'Add',
            'System',
            f"Supplier {data['supplierName']} - Vehicle {data['vehicleNo']}",
            request.remote_addr
        )
        
        return jsonify({"message": "Supplier detail added successfully!"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()

@app.route("/supplier/<int:id>", methods=["PUT"])
def update_supplier(id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "UPDATE supplier SET status = %s WHERE id = %s"
        cursor.execute(query, (data.get('status'), id))
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Supplier Details',
            'Update',
            'System',
            f"Supplier ID {id}",
            request.remote_addr
        )
        
        return jsonify({"message": "Supplier updated successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/supplier/<int:id>", methods=["DELETE"])
def delete_supplier(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get supplier details for logging
        cursor.execute("SELECT supplierName, vehicleNo FROM supplier WHERE id = %s", (id,))
        supplier = cursor.fetchone()
        
        cursor.execute("DELETE FROM supplier WHERE id = %s", (id,))
        conn.commit()
        
        # Log the activity
        if supplier:
            log_system_activity(
                'Main Branch',
                'Supplier Details',
                'Delete',
                'System',
                f"Supplier {supplier['supplierName']} - Vehicle {supplier['vehicleNo']}",
                request.remote_addr
            )
        
        return jsonify({"message": "Supplier detail deleted!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# Dashboard Statistics Routes
@app.route('/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total employees
    cursor.execute('SELECT COUNT(*) FROM employees WHERE status = "Active"')
    total_employees = cursor.fetchone()[0]
    
    # Active projects
    cursor.execute('SELECT COUNT(*) FROM projects WHERE status = "Active"')
    active_projects = cursor.fetchone()[0]
    
    # Vehicle entries (today)
    cursor.execute('SELECT COUNT(*) FROM vehicles WHERE DATE(created_at) = CURDATE()')
    vehicle_entries = cursor.fetchone()[0]
    
    # Purchase orders
    cursor.execute('SELECT COUNT(*) FROM po_details WHERE status = "Active"')
    purchase_orders = cursor.fetchone()[0]
    
    cursor.close()
    conn.close()
    
    return jsonify({
        'totalEmployees': total_employees,
        'activeProjects': active_projects,
        'vehicleEntries': vehicle_entries,
        'purchaseOrders': purchase_orders
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=False, use_reloader=False,port=5000)
