

import base64
import io

import cv2
import numpy as np
from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image

from app.model import run_inference

router = APIRouter()


def _read_image_from_upload(file_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


@router.post("/image")
async def predict_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    file_bytes = await file.read()

    try:
        img = _read_image_from_upload(file_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image file.")

    detections, result = run_inference(img)

    annotated_bgr = result.plot()
    success, buffer = cv2.imencode(".png", annotated_bgr)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image.")

    annotated_base64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "detections": detections,
        "count": len(detections),
        "annotated_image": f"data:image/png;base64,{annotated_base64}",
    }


@router.post("/frame")
async def predict_frame(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    file_bytes = await file.read()

    try:
        img = _read_image_from_upload(file_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image frame.")

    height, width = img.shape[:2]
    detections, _ = run_inference(img)

    return {
        "detections": detections,
        "count": len(detections),
        "image_width": width,
        "image_height": height,
    }