from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import json
import shutil
import uuid
import os

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define folders and filenames
OUTPUT_DIR = "converted"
os.makedirs(OUTPUT_DIR, exist_ok=True)

CSV_PATHS = {
    "GRN": os.path.join(OUTPUT_DIR, "grn.csv"),
    "PURCHASE ORDER": os.path.join(OUTPUT_DIR, "po.csv"),
    "INDENT": os.path.join(OUTPUT_DIR, "indent.csv")
}

@app.get("/")
def home():
    return {"message": "Upload JSON. Vouchers will be saved in grn.csv, po.csv, or indent.csv based on type."}

@app.get("/get-csv-data/{csv_type}")
async def get_csv_data(csv_type: str):
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "grn": CSV_PATHS["GRN"],
            "indent": CSV_PATHS["INDENT"]
        }

        if csv_type not in csv_file_map:
            raise HTTPException(status_code=400, detail="Invalid CSV type")

        csv_path = csv_file_map[csv_type]

        if not os.path.exists(csv_path):
            return {"status": "success", "headers": [], "data": []}

        df = pd.read_csv(csv_path)

        if df.empty:
            return {"status": "success", "headers": [], "data": []}

        # Replace NaN, inf, -inf with safe values
        df = df.replace({float('inf'): None, float('-inf'): None}).fillna("")

        headers = df.columns.tolist()
        data = df.values.tolist()

        return {
            "status": "success",
            "headers": headers,
            "data": data,
            "total_rows": len(data)
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Error reading CSV: {str(e)}"})


@app.get("/download/{csv_type}")
async def download_csv(csv_type: str):
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "grn": CSV_PATHS["GRN"],
            "indent": CSV_PATHS["INDENT"]
        }
        
        if csv_type not in csv_file_map:
            raise HTTPException(status_code=400, detail="Invalid CSV type")
        
        csv_path = csv_file_map[csv_type]
        
        if not os.path.exists(csv_path):
            raise HTTPException(status_code=404, detail="CSV file not found")
        
        return FileResponse(
            path=csv_path,
            filename=f"{csv_type}_data.csv",
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading CSV: {str(e)}")

@app.delete("/clear-csv/{csv_type}")
async def clear_csv(csv_type: str):
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "grn": CSV_PATHS["GRN"],
            "indent": CSV_PATHS["INDENT"]
        }
        
        if csv_type not in csv_file_map:
            raise HTTPException(status_code=400, detail="Invalid CSV type")
        
        csv_path = csv_file_map[csv_type]
        
        if os.path.exists(csv_path):
            os.remove(csv_path)
        
        return {"status": "success", "message": f"{csv_type.upper()} CSV cleared successfully"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Error clearing CSV: {str(e)}"})

@app.post("/upload-json/")
async def upload_json(file: UploadFile = File(...)):
    try:
        # Save uploaded file temporarily
        temp_file_path = f"temp_{uuid.uuid4().hex}.json"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Load JSON
        with open(temp_file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="❌ Invalid JSON format.")

        os.remove(temp_file_path)

        if "Voucher" not in data:
            raise HTTPException(status_code=400, detail="❌ 'Voucher' key missing in JSON.")

        # Group data by type
        grouped_data = {
            "GRN": [],
            "PURCHASE ORDER": [],
            "INDENT": []
        }

        for voucher in data["Voucher"]:
            vtype = voucher.get("VoucherTypeName", "").strip().upper()
            
            # Normalize type to known keys
            if "GRN" in vtype:
                key = "GRN"
            elif "PURCHASE ORDER" in vtype or "PO" in vtype:
                key = "PURCHASE ORDER"
            elif "INDENT" in vtype:
                key = "INDENT"
            else:
                continue  # Skip unknown types

            base_info = {k: v for k, v in voucher.items() if k != "Inventory Entries"}
            
            if "Inventory Entries" in voucher and voucher["Inventory Entries"]:
                for inventory in voucher.get("Inventory Entries", []):
                    inv_info = {k: v for k, v in inventory.items() if k != "BatchAllocations"}
                    
                    if "BatchAllocations" in inventory and inventory["BatchAllocations"]:
                        for batch in inventory.get("BatchAllocations", []):
                            batch_info = batch.copy()
                            combined_row = {**base_info, **inv_info, **batch_info}
                            grouped_data[key].append(combined_row)
                    else:
                        # No batch allocations, just combine base and inventory info
                        combined_row = {**base_info, **inv_info}
                        grouped_data[key].append(combined_row)
            else:
                # No inventory entries, just use base info
                grouped_data[key].append(base_info)

        # Store messages for final response
        result = []
        for vtype_key, records in grouped_data.items():
            if not records:
                continue

            df_new = pd.DataFrame(records)
            csv_path = CSV_PATHS[vtype_key]

            if os.path.exists(csv_path):
                df_existing = pd.read_csv(csv_path)
                # Align columns
                all_columns = list(set(df_existing.columns.tolist() + df_new.columns.tolist()))
                df_existing = df_existing.reindex(columns=all_columns, fill_value="")
                df_new = df_new.reindex(columns=all_columns, fill_value="")
                combined_df = pd.concat([df_existing, df_new], ignore_index=True)
            else:
                combined_df = df_new

            combined_df.to_csv(csv_path, index=False)
            result.append({
                "voucher_type": vtype_key,
                "file": csv_path,
                "rows_added": len(df_new),
                "total_rows": combined_df.shape[0]
            })

        if not result:
            raise HTTPException(status_code=400, detail="❌ No valid VoucherType found (GRN, Purchase Order, Indent).")

        return {
            "status": "success",
            "message": "✅ File processed and data saved to appropriate CSVs.",
            "details": result
        }

    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"❌ Unexpected error: {str(e)}"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
