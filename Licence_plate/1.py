# License Plate Detection System for Indian Vehicles
# Works with both videos and images
# Outputs results to Excel with sample images

import os
import re
import pandas as pd
from datetime import datetime
from PIL import Image as PILImage
from IPython.display import display, Image
from landingai.pipeline.image_source import VideoFile, ImageFolder
from landingai.predict import Predictor, OcrPredictor
from landingai import visualize
from landingai.postprocess import crop

# =============================================
# Configuration
# =============================================

# API Configuration (replace with your keys)
CONFIG = {
    "detector_endpoint": "e001c156-5de0-43f3-9991-f19699b31202",
    "detector_api_key": "land_sk_aMemWbpd41yXnQ0tXvZMh59ISgRuKNRKjJEIUHnkiH32NBJAwf",
    "ocr_api_key": "land_sk_WVYwP00xA3iXely2vuar6YUDZ3MJT9yLX6oW5noUkwICzYLiDV",
    "output_folder": "output",
    "image_output": "detection_images"
}

# =============================================
# Indian License Plate Validation Functions
# =============================================

def clean_plate_text(text):
    """Remove all non-alphanumeric characters"""
    return re.sub(r'[^a-zA-Z0-9]', '', str(text)).upper()

def is_valid_indian_plate(text):
    """
    Validates all Indian license plate formats:
    - TN 33 BB 3974 (Standard Private)
    - TN 33 C AB 3974 (Commercial)
    - TN33BB3974 (HSRP)
    - TN.33.BB.3974 (Dot separated)
    """
    cleaned = clean_plate_text(text)
    
    # Standard private vehicle pattern (TN33BB3974)
    private_pattern = r'^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{4}$'
    
    # Commercial vehicle pattern (TN33CAB3974)
    commercial_pattern = r'^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$'
    
    return (re.match(private_pattern, cleaned) or 
            re.match(commercial_pattern, cleaned))

def format_indian_plate(text):
    """
    Standardizes plate format to: TN 33 BB 3974
    Handles all input variations
    """
    cleaned = clean_plate_text(text)
    
    # Extract components
    state = cleaned[:2]
    district = cleaned[2:4] if cleaned[2].isdigit() else cleaned[2]
    remaining = cleaned[len(state+district):]
    
    # Handle commercial vehicles (CAB instead of BB)
    if any(x in remaining for x in ['T', 'C', 'P']):
        letters = remaining[:3]  # For Taxi (T), Commercial (C), Police (P)
        numbers = remaining[3:7]
    else:
        letters = remaining[:2]
        numbers = remaining[2:6]
    
    return f"{state} {district} {letters} {numbers}"

# =============================================
# Processing Functions
# =============================================

def initialize_predictors():
    """Initialize the detection and OCR predictors"""
    detector = Predictor(
        CONFIG["detector_endpoint"],
        api_key=CONFIG["detector_api_key"]
    )
    ocr = OcrPredictor(api_key=CONFIG["ocr_api_key"])
    return detector, ocr

def process_frame(frame, source_name="unknown"):
    """Process a single frame/image for license plates"""
    detector, ocr = initialize_predictors()
    frame_results = []
    
    # License Plate Detection
    predictions = detector.predict(frame)
    
    if not predictions:
        return frame_results
    
    # Crop and process each detected plate
    for plate_img in crop(predictions, frame):
        # OCR Processing
        ocr_results = ocr.predict(plate_img)
        
        if not ocr_results:
            continue
            
        # Combine OCR texts
        raw_text = ' '.join([r.text for r in ocr_results])
        confidence = sum(r.score for r in ocr_results)/len(ocr_results)
        
        # Validate and format
        if is_valid_indian_plate(raw_text):
            formatted_plate = format_indian_plate(raw_text)
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Create output directory if it doesn't exist
            os.makedirs(CONFIG["image_output"], exist_ok=True)
            
            # Save the detected plate image
            img_filename = f"{CONFIG['image_output']}/{formatted_plate.replace(' ', '_')}_{timestamp.replace(':', '-')}.jpg"
            visualize.overlay_predictions(ocr_results, plate_img).save(img_filename)
            
            frame_results.append({
                'Detection Time': timestamp,
                'License Plate': formatted_plate,
                'Confidence Score': confidence,
                'Source': source_name,
                'Image Path': img_filename
            })
    
    return frame_results

def process_video(video_path):
    """Process video file for license plates"""
    if not os.path.exists(video_path):
        print(f"Video file not found: {video_path}")
        return []
    
    # Frame Extraction (1 frame per second)
    video_source = VideoFile(video_path, samples_per_second=1)
    frames = [f.image for f in video_source]
    print(f"\nProcessing {len(frames)} frames from video...")
    
    video_results = []
    source_name = os.path.basename(video_path)
    
    for idx, frame in enumerate(frames):
        frame_results = process_frame(frame, source_name=f"{source_name}_frame_{idx}")
        video_results.extend(frame_results)
    
    return video_results

def process_images(image_folder):
    """Process folder of images for license plates"""
    if not os.path.exists(image_folder):
        print(f"Image folder not found: {image_folder}")
        return []
    
    image_source = ImageFolder(image_folder)
    images = [f.image for f in image_source]
    print(f"\nProcessing {len(images)} images...")
    
    image_results = []
    
    for img_path, img in zip(image_source.files, images):
        frame_results = process_frame(img, source_name=os.path.basename(img_path))
        image_results.extend(frame_results)
    
    return image_results

# =============================================
# Main Processing Function
# =============================================

def process_inputs(video_path=None, image_folder=None, output_excel="detected_plates.xlsx"):
    """Main processing function that handles both video and images"""
    # Create output directory if it doesn't exist
    os.makedirs(CONFIG["output_folder"], exist_ok=True)
    output_path = os.path.join(CONFIG["output_folder"], output_excel)
    
    all_results = []
    
    if video_path:
        video_results = process_video(video_path)
        if video_results:
            all_results.extend(video_results)
            print(f"Detected {len(video_results)} plates in video")
    
    if image_folder:
        image_results = process_images(image_folder)
        if image_results:
            all_results.extend(image_results)
            print(f"Detected {len(image_results)} plates in images")
    
    if not all_results:
        print("No license plates detected in the input")
        return pd.DataFrame()
    
    # Convert to DataFrame
    df = pd.DataFrame(all_results)
    
    # Drop duplicate plates keeping the highest confidence detection
    df = df.sort_values('Confidence Score', ascending=False)
    df = df.drop_duplicates('License Plate', keep='first')
    
    # Save to Excel
    df.to_excel(output_path, index=False)
    
    # Display sample results
    print(f"\n✅ Processing complete! Saved {len(df)} plates to {output_path}")
    print("\nTop 5 detections:")
    print(df.head().to_string())
    
    # Show sample images
    for i, row in df.head(3).iterrows():
        try:
            display(Image(filename=row['Image Path']))
            print(f"Plate: {row['License Plate']} (Confidence: {row['Confidence Score']:.2f})")
        except Exception as e:
            print(f"Couldn't display image: {e}")
    
    return df

# =============================================
# Main Execution
# =============================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("❌ Please provide a video file path.")
        sys.exit(1)

    video_path = sys.argv[1]

    if not os.path.exists(video_path):
        print(f"❌ Video file not found: {video_path}")
        sys.exit(1)

    final_results = process_inputs(
        video_path=video_path,
        image_folder=None,
        output_excel="detected_plates.xlsx"
    )

    if not final_results.empty:
        # Print plate info in a parsable way for the backend
        for plate in final_results["License Plate"].tolist():
            print(f"License Plate: {plate}")


