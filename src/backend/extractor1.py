from fastapi import FastAPI, UploadFile, File
import tempfile, os
from pdf2image import convert_from_path
from PIL import Image
import pytesseract
import pandas as pd
import google.generativeai as genai
from db_config import get_db_connection  # Your DB config file
import mysql.connector
from datetime import datetime

app = FastAPI()

# Configure Gemini
genai.configure(api_key="AIzaSyDipDrZikIF7UT-AL5KqJwURm540ZynIeo")
model = genai.GenerativeModel("gemini-1.5-flash")


def extract_text(path, content_type):
    if content_type == "application/pdf":
        images = convert_from_path(path)
        return "\n".join([pytesseract.image_to_string(img) for img in images])
    else:
        image = Image.open(path)
        return pytesseract.image_to_string(image)


def clean_markdown_table(markdown_text):
    lines = [line.strip() for line in markdown_text.split('\n') if line.strip() and not line.startswith('|---')]
    if not lines:
        return None
    headers = [h.strip() for h in lines[0].split('|')[1:-1]]
    rows = []
    for line in lines[1:]:
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) == len(headers):
            rows.append(cells)
    return pd.DataFrame(rows, columns=headers) if rows else None


@app.post("/extract-invoice/")
async def extract_invoice(file: UploadFile = File(...), vehicle_number: str = None):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
        tmp_file.write(await file.read())
        tmp_path = tmp_file.name

    try:
        text = extract_text(tmp_path, file.content_type)
        os.unlink(tmp_path)

        prompt = f"""
        Extract invoice bill data into a markdown table with these columns:
        | Vehicle Number | Description | Quantity | Rate | Amount | Supplier Name |

        Rules:
        - One row per item
        - Extract supplier name from header/footer
        - Numeric amounts only (remove currency symbols)
        - Leave blanks if missing
        - Include total row if present
        - Vehicle number: {vehicle_number if vehicle_number else 'extract from document'}

        Invoice text:
        {text}
        """

        response = model.generate_content(prompt)
        markdown_table = response.text
        df = clean_markdown_table(markdown_table)

        if df is not None:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()

                # Create table if it doesn't exist
                cursor.execute("""
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
                """)

                skip_keywords = ["tax", "sgst", "cgst", "round off", "total", "subtotal", "discount"]
                inserted_rows = 0

                for _, row in df.iterrows():
                    vehicle = row.get("Vehicle Number", vehicle_number or "").strip()
                    desc = row.get("Description", "").strip()
                    desc_lower = desc.lower()
                    supplier = row.get("Supplier Name", "").strip()

                    try:
                        qty = float(str(row.get("Quantity", "0")).replace(",", "").replace("₹", ""))
                    except:
                        qty = None
                    try:
                        rate = float(str(row.get("Rate", "0")).replace(",", "").replace("₹", ""))
                    except:
                        rate = None
                    try:
                        amount = float(str(row.get("Amount", "0")).replace(",", "").replace("₹", ""))
                    except:
                        amount = None

                    # Only insert if valid item row
                    if (
                        vehicle and desc and amount and amount > 0 and
                        not any(kw in desc_lower for kw in skip_keywords) and
                        qty and qty > 0 and rate and rate > 0
                    ):
                        # Check if record already exists
                        cursor.execute("""
                            SELECT id FROM invoice_items 
                            WHERE vehicle_number = %s AND description = %s AND amount = %s
                        """, (vehicle, desc, amount))
                        
                        if not cursor.fetchone():
                            cursor.execute("""
                                INSERT INTO invoice_items 
                                (vehicle_number, description, quantity, rate, amount, supplier_name, invoice_date)
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """, (vehicle, desc, qty, rate, amount, supplier, datetime.now().date()))
                            inserted_rows += 1

                conn.commit()
                cursor.close()
                conn.close()

                return {
                    "status": "success",
                    "rows": df.to_dict(orient="records"),
                    "columns": df.columns.tolist(),
                    "inserted_rows": inserted_rows,
                    "message": f"Successfully inserted {inserted_rows} valid item rows into database"
                }
            except Exception as db_error:
                return {"status": "db_error", "error": str(db_error)}

        else:
            return {"status": "fail", "error": "Failed to parse markdown table"}

    except Exception as e:
        return {"status": "error", "error": str(e)}


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Invoice Extractor"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
