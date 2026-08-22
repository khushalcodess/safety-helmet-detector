
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import predict

app = FastAPI(
    title="Helmet Detection API",
    description="YOLOv8n-based safety helmet detection service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/predict", tags=["Prediction"])


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Helmet Detection API is running"}