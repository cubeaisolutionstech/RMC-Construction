import pandas as pd
import os
from datetime import datetime
from download_from_s3 import download_from_s3

class WeighbridgeValidator:
    def __init__(self):
        self.weighbridge_file_path = r'E:\construction-app\src\backend\downloaded_tickets_data.csv'
        
    def download_latest_data(self):
        """Download latest weighbridge data from S3"""
        try:
            download_from_s3()
            return True
        except Exception as e:
            print(f"Error downloading weighbridge data: {e}")
            return False
    
    def find_weighbridge_record(self, vehicle_no=None, inward_no=None):
        """Find weighbridge record by vehicle number or inward number"""
        try:
            # Check if file exists
            if not os.path.exists(self.weighbridge_file_path):
                print("Weighbridge data file not found. Attempting to download...")
                if not self.download_latest_data():
                    return None
            
            # Read the CSV file
            df = pd.read_csv(self.weighbridge_file_path, delimiter='\t')

            
            # Standardize column names (handle different possible column names)
            df.columns = df.columns.str.lower().str.strip()
            
            # Try to find the record
            record = None
            
            if vehicle_no:
                # Look for vehicle number in various possible column names
                vehicle_columns = ['vehicle_no', 'vehicleno', 'vehicle_number', 'truck_number', 'truck_no']
                for col in vehicle_columns:
                    if col in df.columns:
                        record = df[df[col].astype(str).str.upper() == vehicle_no.upper()]
                        if not record.empty:
                            break
            
            if inward_no and (record is None or record.empty):
                # Look for inward number in various possible column names
                inward_columns = ['inward_no', 'inwardno', 'inward_number', 'ticket_no', 'ticket_number']
                for col in inward_columns:
                    if col in df.columns:
                        record = df[df[col].astype(str) == str(inward_no)]
                        if not record.empty:
                            break
            
            if record is not None and not record.empty:
                # Extract relevant data
                record_dict = record.iloc[0].to_dict()
                
                # Try to find quantity/weight columns
                weight_columns = ['net_weight', 'netweight', 'quantity', 'weight', 'received_qty', 'actual_qty']
                actual_quantity = None
                
                for col in weight_columns:
                    if col in record_dict and pd.notna(record_dict[col]):
                        actual_quantity = float(record_dict[col])
                        break
                
                return {
                    'found': True,
                    'actual_quantity': actual_quantity,
                    'weighbridge_data': record_dict,
                    'validation_time': datetime.now().isoformat()
                }
            
            return {
                'found': False,
                'actual_quantity': None,
                'weighbridge_data': None,
                'validation_time': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error processing weighbridge data: {e}")
            return {
                'found': False,
                'actual_quantity': None,
                'weighbridge_data': None,
                'error': str(e),
                'validation_time': datetime.now().isoformat()
            }
    
    def validate_supplier_quantity(self, supplier_bill_qty, vehicle_no=None, inward_no=None):
        """Validate supplier bill quantity against weighbridge data"""
        weighbridge_result = self.find_weighbridge_record(vehicle_no, inward_no)
        
        if not weighbridge_result['found']:
            return {
                'validation_status': 'no_weighbridge_data',
                'supplier_bill_qty': float(supplier_bill_qty),
                'weighbridge_qty': None,
                'difference': None,
                'percentage_difference': None,
                'validation_message': 'No matching weighbridge record found',
                'weighbridge_result': weighbridge_result
            }
        
        if weighbridge_result['actual_quantity'] is None:
            return {
                'validation_status': 'no_quantity_data',
                'supplier_bill_qty': float(supplier_bill_qty),
                'weighbridge_qty': None,
                'difference': None,
                'percentage_difference': None,
                'validation_message': 'Weighbridge record found but no quantity data available',
                'weighbridge_result': weighbridge_result
            }
        
        supplier_qty = float(supplier_bill_qty)
        weighbridge_qty = float(weighbridge_result['actual_quantity'])
        difference = supplier_qty - weighbridge_qty
        percentage_diff = (difference / weighbridge_qty) * 100 if weighbridge_qty != 0 else 0
        
        # Determine validation status based on difference
        if abs(percentage_diff) <= 2:  # Within 2% tolerance
            validation_status = 'validated'
            validation_message = 'Quantities match within acceptable tolerance'
        elif abs(percentage_diff) <= 5:  # Within 5% tolerance
            validation_status = 'minor_discrepancy'
            validation_message = 'Minor discrepancy detected'
        else:
            validation_status = 'major_discrepancy'
            validation_message = 'Major discrepancy detected - requires attention'
        
        return {
            'validation_status': validation_status,
            'supplier_bill_qty': supplier_qty,
            'weighbridge_qty': weighbridge_qty,
            'difference': round(difference, 2),
            'percentage_difference': round(percentage_diff, 2),
            'validation_message': validation_message,
            'weighbridge_result': weighbridge_result
        }
validator = WeighbridgeValidator()
result = validator.validate_supplier_quantity(
        supplier_bill_qty=59.0,
        vehicle_no="TN52J9597",
        inward_no="1"
    )
print("Validation Result:")
print(result)