import cv2
import sys
import os
from ultralytics import YOLO

# === Get video path from command-line ===
if len(sys.argv) < 2:
    print("❌ Please provide a video file path.")
    sys.exit(1)

video_path = sys.argv[1]
if not os.path.exists(video_path):
    print(f"❌ Video file not found: {video_path}")
    sys.exit(1)

# === Config ===
output_folder = "E:\\construction-app\\Material_detect\\output"
os.makedirs(output_folder, exist_ok=True)

output_video_path = os.path.join(output_folder, "output_video.avi")
text_output_path = os.path.join(output_folder, "detection_labels.txt")

model_path = "E:\\construction-app\\Material_detect\\SandMetal 7.pt"
conf_threshold = 0.3

# === Load Model ===
model = YOLO(model_path)

# === Load Video ===
cap = cv2.VideoCapture(video_path)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS) or 24  # fallback default fps
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))

# === Open File to Write Labels ===
label_file = open(text_output_path, "w")

frame_num = 0
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    frame_num += 1

    results = model.predict(source=frame, conf=conf_threshold, verbose=False)[0]

    label_file.write(f"Frame {frame_num}:\n")
    for box in (results.boxes or []):
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf[0])
        cls = int(box.cls[0])
        label = model.names.get(cls, "MSand")  # fallback to "MSand"

        # Draw on frame
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, f"{label} {conf:.2f}", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # Save label to text file
        label_file.write(f"  - {label} ({conf:.2f}) at [{x1}, {y1}, {x2}, {y2}]\n")

    label_file.write("\n")
    out.write(frame)
    print(f"Processed frame {frame_num}", end="\r")

cap.release()
out.release()
label_file.close()
print(f"\n✅ Video saved to: {output_video_path}")
print(f"📄 Labels saved to: {text_output_path}")
