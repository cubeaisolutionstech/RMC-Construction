# License Plate Detection Service
# This script integrates with the existing 1.py license plate detection
# and M-Sand7.py material detection scripts

import os
import sys
import subprocess
import json
import pandas as pd
from datetime import datetime
import mysql.connector
from db_config import get_db_connection

def run_license_plate_detection(video_path):
    """
    Run the license plate detection script (1.py) on the uploaded video
    """
    try:
        # Path to your License_plate folder
        license_plate_script = "E:\construction-app\Licence_plate\\1.py"
        
        # Modify the 1.py script to accept video path as argument
        # and return results as JSON instead of Excel
        result = subprocess.run([
            sys.executable, license_plate_script, video_path
        ], capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            # Parse the output to get detected license plates
            # This assumes 1.py has been modified to output JSON
            output_lines = result.stdout.strip().split('\n')
            detected_plates = []
            
            for line in output_lines:
                if 'License Plate:' in line:
                    plate_number = line.split('License Plate:')[1].strip()
                    detected_plates.append(plate_number)
            
            return detected_plates[0] if detected_plates else None
        else:
            print(f"License plate detection error: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"Error running license plate detection: {str(e)}")
        return None

def run_material_detection(video_path):
    try:
        material_script = "E:\\construction-app\\Material_detect\\M-Sand7.py"
        detection_labels_file = "E:\\construction-app\\Material_detect\\output\\detection_labels.txt"

        result = subprocess.run([
            sys.executable, material_script, video_path
        ], capture_output=True, text=True, timeout=900)

        print("=== Material Detection STDOUT ===")
        print(result.stdout)
        print("=== Material Detection STDERR ===")
        print(result.stderr)

        # Check if file was created
        if os.path.exists(detection_labels_file):
            with open(detection_labels_file, 'r') as f:
                lines = f.readlines()

            # Loop through lines in reverse to find the last detected label
            for line in reversed(lines):
                line = line.strip()
                if line.startswith("-") or line.startswith("–") or line.startswith("  -"):
                    # Example: '  - metal jalli (0.94) at [...]'
                    try:
                        label = line.split("(")[0].split("-")[1].strip()
                        print(f"[INFO] Detected material: {label}")
                        return label
                    except Exception as e:
                        print(f"[WARN] Could not parse line: {line} — {str(e)}")
                        continue

            print("[INFO] No material label found in output file.")
            return "Unknown"

        else:
            print("[ERROR] detection_labels.txt not found")
            return "Unknown"

    except subprocess.TimeoutExpired:
        print("[ERROR] Material detection timed out")
        return "Unknown"

    except Exception as e:
        print(f"[ERROR] Material detection failed: {str(e)}")
        return "Unknown"



def check_vehicle_in_database(vehicle_number):
    """
    Check if vehicle number already exists in the vehicles database
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT * FROM vehicles 
            WHERE vehicle_number = %s 
            ORDER BY entry_time DESC 
            LIMIT 1
        ''', (vehicle_number,))
        
        existing_vehicle = cursor.fetchone()
        cursor.close()
        conn.close()
        
        return existing_vehicle
        
    except Exception as e:
        print(f"Database error: {str(e)}")
        return None

def create_new_vehicles_table():
    """
    Create new vehicles table with the specified structure
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Drop existing vehicles table if it exists
        cursor.execute('DROP TABLE IF EXISTS vehicles')
        
        # Create new vehicles table with specified structure
        cursor.execute('''
            CREATE TABLE vehicles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sno INT,
                inward_no VARCHAR(50) UNIQUE NOT NULL,
                vehicle_number VARCHAR(15) NOT NULL,
                material VARCHAR(255),
                entry_time DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(sno),
                INDEX(vehicle_number)
            )
        ''')
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("New vehicles table created successfully")
        return True
        
    except Exception as e:
        print(f"Error creating vehicles table: {str(e)}")
        return False

def generate_inward_number():
    """
    Generate unique inward number
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM vehicles')
        count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return f"INB{(count + 1):03d}"
        
    except Exception as e:
        print(f"Error generating inward number: {str(e)}")
        return f"INB{datetime.now().strftime('%H%M%S')}"

def process_vehicle_video(video_path):
    try:
        print("Running license plate detection...")
        detected_plate = run_license_plate_detection(video_path)

        print("Running material detection...")
        detected_material = run_material_detection(video_path)


        if not detected_plate:
            return {
                'success': False,
                'error': 'No license plate detected',
                'material': detected_material  # ✅ still return detected material
            }

        existing_vehicle = check_vehicle_in_database(detected_plate)

        if existing_vehicle:
            return {
                'success': True,
                'matched': True,
                'vehicle_number': detected_plate,
                'existing_vehicle': existing_vehicle,
                'material': detected_material,
                'message': 'Vehicle matched in database'
            }
        else:
            inward_number = generate_inward_number()

            vehicle_data = {
                'vehicle_number': detected_plate,
                'material': detected_material,
                'inward_no': inward_number,
                'entry_time': datetime.now().isoformat(),
                'sno': None
            }

            return {
                'success': True,
                'matched': False,
                'vehicle_number': detected_plate,
                'vehicle_data': vehicle_data,
                'message': 'New vehicle detected, please fill remaining details'
            }

    except Exception as e:
        return {
            'success': False,
            'error': f'Processing error: {str(e)}'
        }


if __name__ == "__main__":
    # Test the functions
    create_new_vehicles_table()
    
    # Example usage
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        result = process_vehicle_video(video_path)
        print(json.dumps(result, indent=2))
