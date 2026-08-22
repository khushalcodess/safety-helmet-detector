import os
from ultralytics import YOLO

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "best.pt")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Model weights not found at {MODEL_PATH}. "
        "Copy your trained best.pt into app/models/best.pt before starting the server."
    )

model = YOLO(MODEL_PATH)

CLASS_NAMES = {0: "Helmet", 1: "No Helmet"}


def run_inference(image, conf: float = 0.4):

    results = model.predict(image, conf=conf, verbose=False)
    detections = []

    for box in results[0].boxes:
        cls_id = int(box.cls[0])
        confidence = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()

        detections.append(
            {
                "class_id": cls_id,
                "class_name": CLASS_NAMES.get(cls_id, "Unknown"),
                "confidence": round(confidence, 4),
                "box": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            }
        )

    return detections, results[0]