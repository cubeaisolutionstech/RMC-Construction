import streamlit as st
from pdf2image import convert_from_path
import pytesseract
import google.generativeai as genai
import pandas as pd
import tempfile
import os
from datetime import datetime
from PIL import Image

# --- Configuration ---
try:
    pytesseract.get_tesseract_version()
except pytesseract.TesseractNotFoundError:
    st.error("Tesseract OCR not found. Please install it and set the correct path.")
    st.stop()

try:
    genai.configure(api_key=st.secrets["google_api_key"])
except (KeyError, AttributeError):
    st.error("Google Gemini API key not found. Please set it in secrets.toml.")
    st.stop()

model = genai.GenerativeModel('gemini-1.5-flash')

st.set_page_config(page_title="invoice Bill Processor", page_icon="🏥")
st.title(":invoice: Invoice Bill to Excel Converter")
st.markdown("""
Upload multiple invoice bills (PDF, PNG, JPG). 
Then click the **Process Files** button.

The app will:
- Extract text using OCR
- Use Gemini to extract structured bill data
- Create an Excel file:
    - One sheet per bill
    - A Summary sheet with file names and totals
""")

# Updated to include 'jpg' and 'jpeg'
uploaded_files = st.file_uploader("Choose invoice bill files", type=["pdf", "png", "jpg", "jpeg"], accept_multiple_files=True)
process_btn = st.button("🔄 Process Files")

def extract_text(file_path, file_type):
    try:
        if file_type == "application/pdf":
            images = convert_from_path(file_path)
            return "\n".join([pytesseract.image_to_string(img) for img in images])
        elif file_type in ["image/png", "image/jpeg", "image/jpg"]:
            # Open image using PIL
            image = Image.open(file_path)
            return pytesseract.image_to_string(image)
        else:
            st.error(f"Unsupported file type: {file_type}")
            return None
    except Exception as e:
        st.error(f"OCR extraction failed: {str(e)}")
        return None

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

if process_btn and uploaded_files:
    summary_rows = []
    sheet_data = {}
    used_names = set()

    for uploaded_file in uploaded_files:
        st.subheader(f"Processing: {uploaded_file.name}")
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(uploaded_file.name)[1]) as tmp_file:
            tmp_file.write(uploaded_file.read())
            tmp_path = tmp_file.name

        raw_text = extract_text(tmp_path, uploaded_file.type)
        os.unlink(tmp_path)

        if not raw_text:
            st.warning(f"No text extracted from {uploaded_file.name}")
            continue

        with st.expander("🔍 OCR Output"):
            st.text_area("Extracted Text", raw_text, height=200)

        prompt = f"""Extract invoice bill data into a markdown table with these columns:
| Vehicle Number | Description | Quantity | Rate | Amount |

Rules:
1. Extract all itemized entries as separate rows.
2. Use the supplier name from the top of the invoice (if available) in each row.
3. Convert all amounts to plain numbers (no currency symbols).
4. Use empty cells for missing information.
5. Include a total row at the bottom if available.

Raw invoice text:
{raw_text}"""

        try:
            response = model.generate_content(
                prompt,
                generation_config={"temperature": 0.1, "max_output_tokens": 2000}
            )
            output = response.text

            with st.expander("🧐 Gemini Output", expanded=False):
                st.code(output, language="markdown")

            df = clean_markdown_table(output)
            if df is not None:
                st.success("✅ Table parsed successfully.")
                st.dataframe(df)

                # Safe sheet name
                base_name = os.path.splitext(uploaded_file.name)[0][:25]
                sheet_name = base_name
                counter = 1
                while sheet_name in used_names:
                    sheet_name = f"{base_name}_{counter}"
                    counter += 1
                used_names.add(sheet_name)

                sheet_data[sheet_name] = df

                if "Amount" in df.columns:

                    try:
                        df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce")
                        total_due = df["Amount"].sum(skipna=True)
                    except:
                        total_due = "N/A"
                else:

                    total_due = "N/A"



                summary_rows.append({"File Name": uploaded_file.name, "Sheet": sheet_name, "Total Amount Due": total_due})

            else:
                st.error("❌ Could not parse Gemini response into a table.")

        except Exception as e:
            st.error(f"Gemini processing failed: {str(e)}")

    # Save final Excel
    if sheet_data:
        summary_df = pd.DataFrame(summary_rows)
        file_name = f"invoice_bills_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

        with pd.ExcelWriter(file_name, engine="xlsxwriter") as writer:
            summary_df.to_excel(writer, sheet_name="Summary", index=False)
            for sheet_name, df in sheet_data.items():
                df.to_excel(writer, sheet_name=sheet_name, index=False)

        with open(file_name, "rb") as f:
            st.download_button(
                "📄 Download Final Excel File",
                f,
                file_name=file_name,
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

        st.success(":white_check_mark: Final Excel file ready.")
    else:
        st.warning("No valid dataframes to save.")