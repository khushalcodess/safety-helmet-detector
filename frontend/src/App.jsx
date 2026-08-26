import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function App() {
  // ----- Backend health -----
  const [backendOnline, setBackendOnline] = useState(null); // null = checking

  // ----- Mode -----
  const [mode, setMode] = useState("image"); // "image" | "live"

  // ----- Image upload state -----
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // ----- Webcam state -----
  const [webcamActive, setWebcamActive] = useState(false);
  const [liveDetections, setLiveDetections] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/`)
      .then((res) => (res.ok ? setBackendOnline(true) : setBackendOnline(false)))
      .catch(() => setBackendOnline(false));
  }, []);

  useEffect(() => {
    return () => stopWebcam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Image upload logic ----------------
  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResultImage(null);
    setDetections([]);
  }

  function handleImageChange(event) {
    handleFile(event.target.files[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    handleFile(event.dataTransfer.files[0]);
  }

  async function handleDetect() {
    if (!selectedImage) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedImage);

    try {
      const response = await fetch(`${API_BASE}/predict/image`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setResultImage(data.annotated_image);
      setDetections(data.detections);
    } catch (error) {
      console.error("Error calling backend:", error);
      alert("Could not reach the detection service. Is the backend running?");
    }
    setLoading(false);
  }

  function resetImage() {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResultImage(null);
    setDetections([]);
  }

  // ---------------- Webcam logic ----------------
  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setWebcamActive(true);
      intervalRef.current = setInterval(captureAndDetect, 800);
    } catch (error) {
      console.error("Could not access webcam:", error);
      alert("Could not access your webcam. Check browser permissions.");
    }
  }

  function stopWebcam() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
    setLiveDetections([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  async function captureAndDetect() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    captureCanvas.getContext("2d").drawImage(video, 0, 0);

    captureCanvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      try {
        const response = await fetch(`${API_BASE}/predict/frame`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        setLiveDetections(data.detections);
        drawBoxes(data.detections, data.image_width, data.image_height);
      } catch (error) {
        console.error("Error during webcam detection:", error);
      }
    }, "image/jpeg");
  }

  function drawBoxes(dets, originalWidth, originalHeight) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / originalWidth;
    const scaleY = canvas.height / originalHeight;

    dets.forEach((det) => {
      const [x1, y1, x2, y2] = det.box;
      const boxX = x1 * scaleX;
      const boxY = y1 * scaleY;
      const boxWidth = (x2 - x1) * scaleX;
      const boxHeight = (y2 - y1) * scaleY;
      const color = det.class_name === "Helmet" ? "#3bb273" : "#e5484d";

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "600 12px 'IBM Plex Mono', monospace";
      const textWidth = ctx.measureText(label).width;
      const labelY = boxY > 18 ? boxY - 18 : boxY;

      ctx.fillStyle = color;
      ctx.fillRect(boxX, labelY, textWidth + 10, 18);
      ctx.fillStyle = "#0d0f11";
      ctx.fillText(label, boxX + 5, labelY + 13);
    });
  }

  const activeDetections = mode === "image" ? detections : liveDetections;

  return (
    <div className="app">
      <div className="hazard-bar" aria-hidden="true" />

      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <h1>SENTRYSCAN</h1>
            <p className="tagline">Helmet Compliance Vision System</p>
          </div>
        </div>

        <div className={`status-pill ${backendOnline ? "online" : backendOnline === false ? "offline" : "checking"}`}>
          <span className="status-dot" />
          {backendOnline === null && "CONNECTING…"}
          {backendOnline === true && "SYSTEM ONLINE"}
          {backendOnline === false && "BACKEND OFFLINE"}
        </div>
      </header>

      <main className="console">
        <div className="mode-switch" role="tablist" aria-label="Detection mode">
          <button
            role="tab"
            aria-selected={mode === "image"}
            className={mode === "image" ? "active" : ""}
            onClick={() => setMode("image")}
          >
            Image Scan
          </button>
          <button
            role="tab"
            aria-selected={mode === "live"}
            className={mode === "live" ? "active" : ""}
            onClick={() => setMode("live")}
          >
            Live Feed
          </button>
        </div>

        <div className="panel-grid">
          {/* ---------- Viewfinder Panel ---------- */}
          <section className="viewfinder-panel">
            <div className="panel-label">
              <span>{mode === "image" ? "Frame Input" : "Camera Input"}</span>
              {mode === "live" && webcamActive && (
                <span className="rec-indicator">
                  <span className="rec-dot" /> LIVE
                </span>
              )}
            </div>

            <div className="viewfinder">
              <span className="bracket tl" />
              <span className="bracket tr" />
              <span className="bracket bl" />
              <span className="bracket br" />

              {mode === "image" ? (
                <>
                  {!previewUrl && (
                    <label
                      className={`dropzone ${dragActive ? "drag-active" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                    >
                      <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                      <span className="dropzone-icon">＋</span>
                      <span>Drop an image or click to select</span>
                      <span className="dropzone-hint">JPG, PNG — site photos work best</span>
                    </label>
                  )}

                  {previewUrl && !resultImage && (
                    <img src={previewUrl} alt="Selected frame" className="frame-image" />
                  )}

                  {resultImage && (
                    <img src={resultImage} alt="Annotated result" className="frame-image" />
                  )}

                  {loading && (
                    <div className="scan-overlay">
                      <div className="scan-line" />
                      <span className="scan-label">ANALYZING FRAME…</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="frame-video"
                    style={{ display: webcamActive ? "block" : "none" }}
                  />
                  <canvas ref={canvasRef} className="overlay-canvas" />

                  {!webcamActive && (
                    <div className="dropzone" onClick={startWebcam} role="button" tabIndex={0}>
                      <span className="dropzone-icon">▶</span>
                      <span>Start live camera feed</span>
                      <span className="dropzone-hint">Detection runs continuously while active</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="panel-actions">
              {mode === "image" ? (
                <>
                  {previewUrl && (
                    <>
                      <button className="btn btn-ghost" onClick={resetImage}>
                        Clear
                      </button>
                      <button className="btn btn-primary" onClick={handleDetect} disabled={loading || resultImage}>
                        {loading ? "Scanning…" : resultImage ? "Scan Complete" : "Run Scan"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                webcamActive && (
                  <button className="btn btn-danger" onClick={stopWebcam}>
                    Stop Feed
                  </button>
                )
              )}
            </div>
          </section>

          {/* ---------- Manifest Panel ---------- */}
          <section className="manifest-panel">
            <div className="panel-label">
              <span>Detection Manifest</span>
              <span className="manifest-count">{activeDetections.length}</span>
            </div>

            {activeDetections.length === 0 ? (
              <div className="manifest-empty">
                No objects detected yet. {mode === "image" ? "Run a scan to populate results." : "Start the feed to see live results."}
              </div>
            ) : (
              <ul className="manifest-list">
                {activeDetections.map((d, i) => (
                  <li key={i} className="manifest-row">
                    <span className={`chip ${d.class_name === "Helmet" ? "chip-pass" : "chip-fail"}`}>
                      {d.class_name === "Helmet" ? "PASS" : "FLAG"}
                    </span>
                    <span className="manifest-class">{d.class_name}</span>
                    <div className="confidence-track">
                      <div
                        className="confidence-fill"
                        style={{ width: `${d.confidence * 100}%` }}
                      />
                    </div>
                    <span className="manifest-confidence">
                      {(d.confidence * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="hazard-bar" aria-hidden="true" />
        <p>Model: YOLOv8n · Trained on Safety Helmet Detection Dataset · mAP50 91.8%</p>
      </footer>
    </div>
  );
}

export default App;