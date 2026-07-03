from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.concurrency import run_in_threadpool
import queue
import cv2
import numpy as np
import pymongo
from pymongo import MongoClient
from datetime import datetime
import asyncio
import threading
import base64
import yt_dlp
import logging
import io
import os
import time
from PIL import Image
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from ultralytics import YOLO
import torch
from typing import Optional, List, Dict, Set
from contextlib import asynccontextmanager
import re
import uuid
import requests
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import json
import urllib3
import warnings
import imageio

# Suppress SSL warnings for better user experience
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="urllib3")


# Load environment variables from .env
load_dotenv()

# Logging configuration (level via LOG_LEVEL env)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Device configuration for GPU/CPU selection
def get_device_config():
    """Determine the best device configuration for YOLO"""
    device_info = {
        'device': 'cpu',
        'yolo_device': 'cpu',
        'cuda_available': False,
        'cuda_device_count': 0,
        'cuda_device_name': None
    }
    
    try:
        if torch.cuda.is_available():
            device_info['cuda_available'] = True
            device_info['cuda_device_count'] = torch.cuda.device_count()
            device_info['device'] = 'cuda'
            device_info['yolo_device'] = 'cuda'
            
            # Get GPU device name
            if device_info['cuda_device_count'] > 0:
                device_info['cuda_device_name'] = torch.cuda.get_device_name(0)
                
            logger.info(f"🚀 GPU detected: {device_info['cuda_device_name']}")
            logger.info(f"🔥 CUDA devices available: {device_info['cuda_device_count']}")
            logger.info("⚡ Using GPU acceleration for YOLO")
        else:
            logger.info("💻 GPU not available, using CPU")
            logger.info("⚠️  For better performance, install CUDA-compatible PyTorch")
            
    except Exception as e:
        logger.error(f"Error detecting device configuration: {e}")
        logger.info("🔄 Falling back to CPU configuration")
    
    return device_info

# Initialize device configuration
DEVICE_CONFIG = get_device_config()

# ------------------------------
# YOLO model configuration (dynamic)
# ------------------------------
# Environment variables allow runtime configuration without code changes
MODEL_PATH: str = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
ENV_TARGET_LABELS_RAW: str | None = os.getenv("YOLO_TARGET_LABELS")  # e.g. "train,locomotive,carriage"

# Globals kept in sync when model is (re)loaded
MODEL_LABELS: Dict[int, str] = {}
TRAIN_CLASSES: List[int] = []  # Dynamic target class ids used as "train" in detection

# Thread lock for thread-safe model usage
model_lock = threading.Lock()

def _parse_target_labels(raw: str | None) -> List[str]:
    if not raw:
        return []
    return [s.strip() for s in raw.split(",") if s.strip()]

def _resolve_class_ids_from_labels(target_labels: List[str], labels_map: Dict[int, str]) -> List[int]:
    if not target_labels:
        return []
    lower_to_id = {name.lower(): idx for idx, name in labels_map.items()}
    resolved: List[int] = []
    for label in target_labels:
        key = label.lower()
        if key in lower_to_id:
            resolved.append(lower_to_id[key])
    return sorted(set(resolved))

def load_yolo_model(model_path: str) -> None:
    """Load YOLO model dynamically and configure labels and target classes.
    Updates globals: model, MODEL_PATH, MODEL_LABELS, TRAIN_CLASSES.
    """
    global model, MODEL_PATH, MODEL_LABELS, TRAIN_CLASSES
    try:
        logger.info(f"Loading YOLO model from: {model_path}")
        loaded = YOLO(model_path)
        # Move to best device
        if DEVICE_CONFIG['device'] == 'cuda':
            loaded.to(DEVICE_CONFIG['device'])
            # Convert model to half precision (FP16)
            try:
                loaded.half()
                logger.info("⚡ FP16 (half-precision) enabled for YOLO model weights")
            except Exception as e:
                logger.warning(f"Could not convert YOLO model weights to half precision: {e}")
            logger.info(f"YOLO model loaded successfully on {DEVICE_CONFIG['device'].upper()}")
            logger.info(f"🎯 Model device: {DEVICE_CONFIG['cuda_device_name']}")
        else:
            logger.info("YOLO model loaded successfully on CPU")

        # Ultralytics models expose names as a dict {class_id: name}
        local_labels = dict(loaded.names) if hasattr(loaded, 'names') else {}

        # Compute target classes
        env_targets = _parse_target_labels(ENV_TARGET_LABELS_RAW)
        resolved_env_ids = _resolve_class_ids_from_labels(env_targets, local_labels)

        if resolved_env_ids:
            local_train_classes = resolved_env_ids
            logger.info(f"Target classes from env YOLO_TARGET_LABELS: {local_train_classes} -> {[local_labels.get(i, str(i)) for i in local_train_classes]}")
        else:
            # Heuristics:
            # 1) If 'train' exists in labels, use it
            # 2) If only one class exists, use class 0
            # 3) If default coco model, fallback to [6] (train)
            lower_labels = {idx: name.lower() for idx, name in local_labels.items()}
            train_like = [idx for idx, name in lower_labels.items() if name == 'train']
            if train_like:
                local_train_classes = sorted(set(train_like))
            elif len(local_labels) == 1:
                local_train_classes = [0]
            elif os.path.basename(model_path).lower() in {"yolov8n.pt", "yolov8s.pt", "yolov8m.pt", "yolov8l.pt", "yolov8x.pt"}:
                local_train_classes = [6]
            else:
                local_train_classes = []
                logger.warning("No target classes configured. Set YOLO_TARGET_LABELS or update via /model/targets.")

        # Update globals atomically under lock to prevent concurrent inference issues
        with model_lock:
            model = loaded
            MODEL_PATH = model_path
            MODEL_LABELS = local_labels
            TRAIN_CLASSES = local_train_classes

        logger.info(f"Model classes: {len(MODEL_LABELS)} -> {list(MODEL_LABELS.values())[:10]}{' ...' if len(MODEL_LABELS) > 10 else ''}")
        logger.info(f"Active target class ids: {TRAIN_CLASSES} -> {[MODEL_LABELS.get(i, str(i)) for i in TRAIN_CLASSES]}")

    except Exception as e:
        logger.error(f"Error loading YOLO model: {e}")
        # Keep previous model if available
        raise

# Configuración de MongoDB (solo para metadatos)
MONGO_URL = os.getenv("MONGO_URI") or os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("MONGO_DB_NAME", "Railytics")
COLLECTION_NAME = os.getenv("MONGO_FRAMES_COLLECTION", "frames")
STREAMS_COLLECTION_NAME = os.getenv("MONGO_STREAMS_COLLECTION", "streams")
EVENTS_COLLECTION_NAME = os.getenv("MONGO_EVENTS_COLLECTION", "railway_events")

# Configuración de carpeta local para imágenes - SOLO TRENES
TRAINS_FOLDER = os.getenv("TRAINS_FOLDER", "frames_with_trains")
# Carpeta para videos generados por evento
EVENT_VIDEOS_FOLDER = os.getenv("EVENT_VIDEOS_FOLDER", "event_videos")

# Crear carpetas si no existen
os.makedirs(TRAINS_FOLDER, exist_ok=True)
os.makedirs(EVENT_VIDEOS_FOLDER, exist_ok=True)

# Cliente MongoDB
try:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    streams_collection = db[STREAMS_COLLECTION_NAME]
    events_collection = db[EVENTS_COLLECTION_NAME]
    # Test connection
    client.admin.command('ping')
    logger.info("MongoDB connection established successfully")
except Exception as e:
    logger.error(f"MongoDB connection failed: {e}")
    client = None
    collection = None
    streams_collection = None
    events_collection = None

# Multi-stream analysis management
active_analysis_sessions = {}  # Dictionary to store active analysis sessions
session_lock = threading.Lock()  # Thread lock for safe session management

# Railway Events state
active_railway_events = {}  # Per-stream active event state
events_lock = threading.Lock()

# Event configuration
EVENT_INACTIVITY_WINDOW_SECONDS = int(os.getenv("EVENT_INACTIVITY_WINDOW_SECONDS", "12"))  # Close event if no detections for this period

# Capture interval (seconds)
CAPTURE_INTERVAL_SECONDS = int(os.getenv("CAPTURE_INTERVAL_SECONDS", "3"))

class AnalysisSession:
    """Class to manage individual stream analysis session"""
    def __init__(self, stream_id: str, stream_name: str, stream_url: str, duration_minutes: int):
        self.stream_id = stream_id
        self.stream_name = stream_name
        self.stream_url = stream_url
        self.duration_minutes = duration_minutes
        self.thread = None
        self.active = False
        self.start_time = None
        
        # Metrics
        self.frames_processed = 0
        self.trains_detected = 0
        self.frames_discarded = 0
        self.last_frame_time = None
        self.detection_rate = 0.0
        
    def start(self):
        """Start analysis thread"""
        self.active = True
        self.start_time = datetime.now()
        self.thread = threading.Thread(
            target=capture_frames_multi,
            args=(self.stream_id, self.stream_url, self.duration_minutes),
            daemon=True
        )
        self.thread.start()
        
    def stop(self):
        """Stop analysis session"""
        self.active = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
    
    def update_metrics(self, frames_processed=None, trains_detected=None, frames_discarded=None):
        """Update session metrics"""
        if frames_processed is not None:
            self.frames_processed = frames_processed
        if trains_detected is not None:
            self.trains_detected = trains_detected
        if frames_discarded is not None:
            self.frames_discarded = frames_discarded
        
        # Calculate detection rate
        total_frames = self.frames_processed
        if total_frames > 0:
            self.detection_rate = round((self.trains_detected / total_frames) * 100, 2)
        else:
            self.detection_rate = 0.0
        
        self.last_frame_time = datetime.now()
    
    def to_dict(self):
        """Convert session to dictionary for API response"""
        runtime_seconds = 0
        if self.start_time:
            runtime_seconds = int((datetime.now() - self.start_time).total_seconds())
        
        return {
            "stream_id": self.stream_id,
            "stream_name": self.stream_name,
            "active": self.active,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "runtime_seconds": runtime_seconds,
            "frames_processed": self.frames_processed,
            "trains_detected": self.trains_detected,
            "frames_discarded": self.frames_discarded,
            "detection_rate": self.detection_rate,
            "last_frame_time": self.last_frame_time.isoformat() if self.last_frame_time else None
        }

# WebSocket connections for real-time updates
active_connections = []

# Inicializar modelo YOLO (dinámico)
model = None
try:
    load_yolo_model(MODEL_PATH)
except Exception:
    model = None

# Global references for async loop
main_loop = None

# Video generation status dictionary
video_generation_statuses = {}
video_generation_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    global main_loop
    try:
        main_loop = asyncio.get_running_loop()
        
        # Crear carpetas si no existen
        os.makedirs(TRAINS_FOLDER, exist_ok=True)
        
        logger.info(f"Trains folder: {os.path.abspath(TRAINS_FOLDER)}")
        logger.info("⚠️  CONFIGURATION: Only frames WITH trains will be saved")
        logger.info(f"⚠️  CONFIGURATION: Capture every {CAPTURE_INTERVAL_SECONDS} seconds")
        logger.info("⚠️  CONFIGURATION: Frames without trains are discarded automatically")
        
        # Crear índices si MongoDB está disponible
        if collection is not None:
            try:
                collection.create_index("timestamp")
                collection.create_index("filename")
                collection.create_index("has_trains")
                logger.info("MongoDB indexes created")
            except Exception as e:
                logger.error(f"Error creating indexes: {e}")
        
        # Create indexes for railway events
        if 'events_collection' in globals() and events_collection is not None:
            try:
                events_collection.create_index("start_time")
                events_collection.create_index("end_time")
                events_collection.create_index("stream_id")
                logger.info("MongoDB indexes for railway events created")
            except Exception as e:
                logger.error(f"Error creating railway events indexes: {e}")
        
        # Verificar modelo YOLO y mostrar configuración del dispositivo
        if model is not None:
            logger.info("YOLO model ready for train detection")
            logger.info(f"🔧 Performance Configuration:")
            logger.info(f"   - Device: {DEVICE_CONFIG['device'].upper()}")
            logger.info(f"   - YOLO device: {DEVICE_CONFIG['yolo_device'].upper()}")

            if DEVICE_CONFIG['cuda_available']:
                logger.info(f"   - GPU: {DEVICE_CONFIG['cuda_device_name']}")
                logger.info(f"   - CUDA devices: {DEVICE_CONFIG['cuda_device_count']}")
        else:
            logger.warning("YOLO model not available - will work without detection")
        
    except Exception as e:
        logger.error(f"Error in startup configuration: {e}")
    
    yield
    
    # Shutdown

    if client is not None:
        client.close()

app = FastAPI(
    title="YouTube Stream Frame Capture with Train Detection",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration from environment
_CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS", "*")
_ALLOW_ORIGINS_LIST = ["*"] if _CORS_ALLOW_ORIGINS.strip() == "*" else [o.strip() for o in _CORS_ALLOW_ORIGINS.split(",") if o.strip()]
_CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
_CORS_ALLOW_METHODS = os.getenv("CORS_ALLOW_METHODS", "*")
_CORS_ALLOW_HEADERS = os.getenv("CORS_ALLOW_HEADERS", "*")
_ALLOW_METHODS_LIST = ["*"] if _CORS_ALLOW_METHODS.strip() == "*" else [m.strip().upper() for m in _CORS_ALLOW_METHODS.split(",") if m.strip()]
_ALLOW_HEADERS_LIST = ["*"] if _CORS_ALLOW_HEADERS.strip() == "*" else [h.strip() for h in _CORS_ALLOW_HEADERS.split(",") if h.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOW_ORIGINS_LIST,
    allow_credentials=_CORS_ALLOW_CREDENTIALS,
    allow_methods=_ALLOW_METHODS_LIST,
    allow_headers=_ALLOW_HEADERS_LIST,
)

# Clases objetivo se configuran dinámicamente por load_yolo_model

class StreamRequest(BaseModel):
    youtube_url: str
    duration_minutes: int = 1440  # 24 horas por defecto

class StreamCreateRequest(BaseModel):
    name: str
    url: str
    description: str = ""
    custom_thumbnail: Optional[str] = None  # Base64 encoded image

class StreamUpdateRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    custom_thumbnail: Optional[str] = None  # Base64 encoded image

class ModelReloadRequest(BaseModel):
    model_config = {'protected_namespaces': ()}
    model_path: str
    target_labels: Optional[List[str]] = None  # Optional override of labels used as targets

class ModelTargetsRequest(BaseModel):
    target_labels: Optional[List[str]] = None
    target_class_ids: Optional[List[int]] = None

class AnalysisRequest(BaseModel):
    stream_id: str
    duration_minutes: int = 0  # 0 = infinite

class FrameResponse(BaseModel):
    message: str
    total_frames: int = 0
    trains_detected: int = 0
    frames_discarded: int = 0

class DetectionStats(BaseModel):
    total_frames_processed: int
    frames_with_trains_saved: int
    frames_discarded: int
    detection_rate: float
    save_rate: float

# ------------------------------
# Model management endpoints
# ------------------------------
@app.get("/model/info")
async def get_model_info():
    try:
        with model_lock:
            path = MODEL_PATH
            labels_count = len(MODEL_LABELS)
            labels = MODEL_LABELS
            target_class_ids = TRAIN_CLASSES
            target_class_names = [MODEL_LABELS.get(i, str(i)) for i in target_class_ids]
            
        return {
            "status": "success",
            "path": path,
            "labels_count": labels_count,
            "labels": labels,
            "target_class_ids": target_class_ids,
            "target_class_names": target_class_names,
            "device": DEVICE_CONFIG['device']
        }
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        return {"status": "error", "error": str(e)}

@app.post("/model/reload")
async def reload_model(req: ModelReloadRequest):
    try:
        # Optional override targets during reload
        global ENV_TARGET_LABELS_RAW, TRAIN_CLASSES
        if req.target_labels is not None:
            ENV_TARGET_LABELS_RAW = ",".join(req.target_labels)
        load_yolo_model(req.model_path)
        return {
            "status": "reloaded",
            "path": MODEL_PATH,
            "labels_count": len(MODEL_LABELS),
            "target_class_ids": TRAIN_CLASSES,
            "target_class_names": [MODEL_LABELS.get(i, str(i)) for i in TRAIN_CLASSES]
        }
    except Exception as e:
        logger.error(f"Error reloading model: {e}")
        return {"status": "error", "error": str(e)}

@app.post("/model/targets")
async def set_model_targets(req: ModelTargetsRequest):
    try:
        global TRAIN_CLASSES
        with model_lock:
            if model is None:
                raise RuntimeError("YOLO model not loaded")

            new_ids: Set[int] = set()
            if req.target_labels:
                resolved = _resolve_class_ids_from_labels(req.target_labels, MODEL_LABELS)
                new_ids.update(resolved)
            if req.target_class_ids:
                for cid in req.target_class_ids:
                    if cid in MODEL_LABELS:
                        new_ids.add(cid)

            TRAIN_CLASSES = sorted(new_ids)
            target_class_names = [MODEL_LABELS.get(i, str(i)) for i in TRAIN_CLASSES]

        return {
            "status": "updated",
            "target_class_ids": TRAIN_CLASSES,
            "target_class_names": target_class_names
        }
    except Exception as e:
        logger.error(f"Error setting model targets: {e}")
        return {"status": "error", "error": str(e)}

def detect_trains(frame: np.ndarray) -> tuple[bool, list, np.ndarray]:
    """
    Detecta trenes en un frame usando YOLO
    Retorna: (has_trains, detections, annotated_frame)
    """
    try:
        # Wrap inference and configuration checks under lock for thread safety
        with model_lock:
            if model is None:
                return False, [], frame
            
            # Realizar detección - YOLO maneja automáticamente el device correcto
            # Read confidence threshold from environment, default 0.5
            import os as _os
            _CONF_TH = float(_os.getenv('YOLO_CONFIDENCE_THRESHOLD', '0.5'))
            predict_args = {
                'verbose': False,
                'device': DEVICE_CONFIG['device'],
                'conf': _CONF_TH
            }
            if DEVICE_CONFIG['device'] == 'cuda':
                # Avoid deprecation warnings in newer versions of Ultralytics while keeping backward compatibility
                from ultralytics.cfg import get_cfg
                if hasattr(get_cfg(), 'quantize'):
                    predict_args['quantize'] = 16
                else:
                    predict_args['half'] = True
            results = model(frame, **predict_args)
            
            has_trains = False
            detections = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Obtener clase y confianza - move tensors to CPU if needed
                        cls = int(box.cls[0].cpu() if hasattr(box.cls[0], 'cpu') else box.cls[0])
                        conf = float(box.conf[0].cpu() if hasattr(box.conf[0], 'cpu') else box.conf[0])
                        
                        # Verificar si es una clase objetivo y tiene suficiente confianza
                        if (not TRAIN_CLASSES and conf >= _CONF_TH) or (cls in TRAIN_CLASSES and conf >= _CONF_TH):
                            has_trains = True
                            
                            # Obtener coordenadas de la caja - ensure CPU tensors
                            bbox_tensor = box.xyxy[0]
                            if hasattr(bbox_tensor, 'cpu'):
                                x1, y1, x2, y2 = bbox_tensor.cpu().tolist()
                            else:
                                x1, y1, x2, y2 = bbox_tensor.tolist()
                            
                            detections.append({
                                'class': cls,
                                'confidence': conf,
                                'bbox': [x1, y1, x2, y2],
                                'class_name': MODEL_LABELS.get(cls, str(cls))
                            })
            
            # Crear frame anotado si hay detecciones
            annotated_frame = frame.copy()
            if has_trains:
                annotated_frame = results[0].plot()
            
            return has_trains, detections, annotated_frame
        
    except Exception as e:
        logger.error(f"Error in train detection: {e}")
        logger.error(f"Device configuration: {DEVICE_CONFIG['device']}")
        return False, [], frame

def get_youtube_metadata(youtube_url: str) -> dict:
    """Extract metadata including stream URL and thumbnail from a YouTube URL"""
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
        'socket_timeout': 30,
        'retries': 3,
        'ignoreerrors': True,
        'no_check_certificate': True,
        'prefer_insecure': False,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(youtube_url, download=False)
            
            # Extract thumbnail URL (YouTube provides multiple sizes)
            thumbnail_url = None
            if 'thumbnails' in info and info['thumbnails']:
                # Get the best quality thumbnail
                thumbnails = sorted(info['thumbnails'], key=lambda x: x.get('width', 0) * x.get('height', 0), reverse=True)
                thumbnail_url = thumbnails[0]['url'] if thumbnails else None
            
            return {
                'stream_url': info['url'],
                'thumbnail_url': thumbnail_url,
                'title': info.get('title', ''),
                'description': info.get('description', ''),
                'duration': info.get('duration', 0),
                'uploader': info.get('uploader', ''),
                'upload_date': info.get('upload_date', ''),
                'view_count': info.get('view_count', 0),
                'is_live': info.get('is_live', False)
            }
        except Exception as e:
            error_msg = str(e)
            if "tls" in error_msg.lower() or "ssl" in error_msg.lower():
                logger.warning(f"TLS/SSL connection issue with YouTube: {e}")
                logger.info("🔄 Retrying with alternative configuration...")
                # Fallback attempt with more permissive settings
                try:
                    fallback_opts = ydl_opts.copy()
                    fallback_opts.update({
                        'no_check_certificate': True,
                        'socket_timeout': 60,
                        'retries': 5
                    })
                    with yt_dlp.YoutubeDL(fallback_opts) as fallback_ydl:
                        info = fallback_ydl.extract_info(youtube_url, download=False)
                        return {
                            'stream_url': info['url'],
                            'thumbnail_url': thumbnail_url,
                            'title': info.get('title', ''),
                            'description': info.get('description', ''),
                            'duration': info.get('duration', 0),
                            'uploader': info.get('uploader', ''),
                            'upload_date': info.get('upload_date', ''),
                            'view_count': info.get('view_count', 0),
                            'is_live': info.get('is_live', False)
                        }
                except Exception as fallback_error:
                    logger.error(f"Fallback also failed: {fallback_error}")
            
            logger.error(f"Error extracting YouTube metadata: {e}")
            raise HTTPException(status_code=400, detail=f"Error getting YouTube metadata: {str(e)}")

def download_thumbnail(thumbnail_url: str) -> Optional[str]:
    """Download and convert thumbnail to base64"""
    try:
        # Configure session with retries and better error handling
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        response = session.get(
            thumbnail_url, 
            timeout=15, 
            stream=True,
            verify=True,
            allow_redirects=True
        )
        response.raise_for_status()
        
        # Convert to PIL Image and resize if needed
        img = Image.open(io.BytesIO(response.content))
        
        # Resize to reasonable size (max 400x300) to save storage
        max_width, max_height = 400, 300
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Convert to RGB if needed (remove alpha channel)
        if img.mode in ('RGBA', 'LA'):
            img = img.convert('RGB')
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85, optimize=True)
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return img_str
    except Exception as e:
        error_msg = str(e)
        if "tls" in error_msg.lower() or "ssl" in error_msg.lower():
            logger.warning(f"TLS/SSL issue downloading thumbnail: {e}")
            logger.info("🔄 Attempting thumbnail download with alternative settings...")
            # Try with relaxed SSL verification
            try:
                session = requests.Session()
                session.headers.update({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                response = session.get(
                    thumbnail_url, 
                    timeout=30, 
                    verify=False,  # Disable SSL verification as fallback
                    allow_redirects=True
                )
                response.raise_for_status()
                
                img = Image.open(io.BytesIO(response.content))
                max_width, max_height = 400, 300
                img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
                if img.mode in ('RGBA', 'LA'):
                    img = img.convert('RGB')
                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=85, optimize=True)
                img_str = base64.b64encode(buffer.getvalue()).decode()
                logger.info("✅ Thumbnail downloaded successfully with fallback method")
                return img_str
            except Exception as fallback_error:
                logger.warning(f"Fallback thumbnail download also failed: {fallback_error}")
        else:
            logger.warning(f"Failed to download thumbnail: {e}")
        return None

def validate_and_process_custom_thumbnail(base64_image: str) -> str:
    """Validate and process a custom thumbnail image"""
    try:
        # Remove data URL prefix if present
        if base64_image.startswith('data:image'):
            base64_image = base64_image.split(',')[1]
        
        # Decode base64
        img_data = base64.b64decode(base64_image)
        img = Image.open(io.BytesIO(img_data))
        
        # Resize to reasonable size
        max_width, max_height = 400, 300
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Convert to RGB if needed
        if img.mode in ('RGBA', 'LA'):
            img = img.convert('RGB')
        
        # Convert back to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85, optimize=True)
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return img_str
    except Exception as e:
        logger.error(f"Error processing custom thumbnail: {e}")
        raise HTTPException(status_code=400, detail="Invalid image format or corrupted image")

def get_stream_url(youtube_url: str) -> str:
    """Obtiene la URL del stream en vivo de YouTube con configuraciones optimizadas para OpenCV"""
    
    # Para streams EN VIVO de YouTube, solo hay formatos HLS disponibles
    # Priorizamos resoluciones más bajas para mayor estabilidad
    format_priorities = [
        # Prioridad 1: 720p o menos (más estable)
        '93/92/91/95/94',  # HLS formats: 360p, 240p, 144p, 720p, 480p
        # Prioridad 2: Mejor calidad hasta 720p
        'best[height<=720]',
        # Prioridad 3: Cualquier formato disponible
        'best',
    ]
    
    last_error = None
    
    for format_selector in format_priorities:
        ydl_opts = {
            'format': format_selector,
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 60,
            'retries': 5,
            'ignoreerrors': False,
            'no_check_certificate': True,
            'prefer_insecure': False,
            'live_from_start': False,  # No intentar desde el inicio para streams en vivo
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
                
                if not info or 'url' not in info:
                    logger.warning(f"No URL found with format: {format_selector}")
                    continue
                
                stream_url = info['url']
                protocol = info.get('protocol', 'unknown')
                ext = info.get('ext', 'unknown')
                
                # Log stream quality info for debugging
                logger.info(f"✅ Stream obtained successfully:")
                logger.info(f"  - Protocol: {protocol}")
                logger.info(f"  - Extension: {ext}")
                logger.info(f"  - Resolution: {info.get('width', 'unknown')}x{info.get('height', 'unknown')}")
                logger.info(f"  - FPS: {info.get('fps', 'unknown')}")
                logger.info(f"  - Format ID: {info.get('format_id', 'unknown')}")
                logger.info(f"  - Format: {info.get('format', 'unknown')}")
                
                # Info sobre HLS
                if '.m3u8' in stream_url or protocol in ['m3u8', 'm3u8_native']:
                    logger.info("📺 Stream es HLS (.m3u8) - configuración normal para YouTube Live")
                
                return stream_url
                
        except Exception as e:
            last_error = e
            error_str = str(e)
            # Solo loguear si no es el error de formato no disponible (ya que probamos varios)
            if "Requested format is not available" not in error_str:
                logger.warning(f"Format {format_selector} failed: {e}")
            continue
    
    # Si todos los formatos fallaron, intentar listar formatos disponibles para debug
    logger.warning("All format priorities failed, trying to list available formats...")
    
    try:
        list_opts = {
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 30,
            'no_check_certificate': True,
        }
        with yt_dlp.YoutubeDL(list_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            if info:
                formats = info.get('formats', [])
                logger.info(f"📋 Available formats ({len(formats)} total):")
                for f in formats[-10:]:  # Mostrar últimos 10 formatos
                    logger.info(f"  - ID: {f.get('format_id')} | {f.get('format')} | {f.get('ext')} | {f.get('protocol')}")
                
                # Intentar con el primer formato disponible
                if formats:
                    best_format = formats[-1]  # Último suele ser el mejor
                    format_id = best_format.get('format_id')
                    logger.info(f"🔄 Trying with format ID: {format_id}")
                    
                    retry_opts = {
                        'format': format_id,
                        'quiet': True,
                        'no_warnings': True,
                        'socket_timeout': 60,
                        'no_check_certificate': True,
                    }
                    with yt_dlp.YoutubeDL(retry_opts) as retry_ydl:
                        retry_info = retry_ydl.extract_info(youtube_url, download=False)
                        if retry_info and 'url' in retry_info:
                            logger.info(f"✅ Success with format ID: {format_id}")
                            return retry_info['url']
    except Exception as e:
        logger.error(f"Could not list formats: {e}")
    
    error_msg = f"Error extracting stream URL after all attempts: {last_error}"
    logger.error(error_msg)
    raise HTTPException(status_code=400, detail=error_msg)

def save_train_frame(frame: np.ndarray, timestamp: datetime, detections: list, annotated_frame: np.ndarray, stream_id: str = None) -> dict:
    """Guarda SOLO los fotogramas que contienen trenes"""
    try:
        # Crear nombre de archivo con timestamp y stream_id opcional
        if stream_id:
            filename = f"frame_with_trains_{stream_id}_{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        else:
            filename = f"frame_with_trains_{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        filepath = os.path.join(TRAINS_FOLDER, filename)
        
        # Guardar el frame anotado (con las cajas de detección)
        frame_rgb = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        # Guardar imagen
        pil_image.save(filepath, format='JPEG', quality=85)
        
        # Obtener tamaño del archivo
        file_size = os.path.getsize(filepath)
        
        # Guardar metadatos en MongoDB si está disponible
        frame_doc = {
            "filename": filename,
            "filepath": filepath,
            "timestamp": timestamp,
            "size": file_size,
            "has_trains": True,
            "detections": detections,
            "detection_count": len(detections),
            "stream_id": stream_id  # Add stream_id to metadata
        }
        
        if collection is not None:
            try:
                result = collection.insert_one(frame_doc)
                frame_doc["_id"] = str(result.inserted_id)
            except Exception as e:
                logger.error(f"Error saving to MongoDB: {e}")
        
        logger.info(f"Frame with {len(detections)} train(s) saved: {filename}")
        return frame_doc
        
    except Exception as e:
        logger.error(f"Error saving train frame: {e}")
        return None

async def broadcast_update(message: dict):
    """Send updates to all connected WebSocket clients"""
    if active_connections:
        for connection in active_connections.copy():
            try:
                await connection.send_text(json.dumps(message))
            except:
                active_connections.remove(connection)

def create_video_capture_for_stream(stream_url: str) -> cv2.VideoCapture:
    """Crea un VideoCapture optimizado para streams de YouTube/HLS"""
    # Configurar variables de entorno de FFmpeg para mejor manejo de streams HLS
    import os
    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'timeout;60000000|reconnect;1|reconnect_streamed;1|reconnect_delay_max;10'
    
    # Crear VideoCapture con backend FFmpeg explícito
    cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
    
    # Configuraciones optimizadas para streams HLS/YouTube
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 3)  # Buffer pequeño pero suficiente para HLS
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 60000)  # 60 segundos para abrir (HLS necesita más tiempo)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 30000)  # 30 segundos para leer
    
    # Configuraciones adicionales para estabilidad
    try:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    except Exception as e:
        logger.debug(f"Could not set resolution properties: {e}")
    
    return cap

def capture_frames_multi(stream_id: str, stream_url: str, duration_minutes: int):
    """Enhanced frame capture function for multi-stream analysis"""
    global active_analysis_sessions, session_lock
    
    try:
        # Get session
        with session_lock:
            session = active_analysis_sessions.get(stream_id)
            if not session:
                logger.error(f"Session not found for stream {stream_id}")
                return
        
        # Open stream with enhanced configuration for YouTube/HLS streams
        logger.info(f"Opening stream {stream_id} with optimized HLS configuration...")
        cap = create_video_capture_for_stream(stream_url)
        
        if not cap.isOpened():
            logger.error(f"Could not open stream {stream_id}")
            with session_lock:
                if stream_id in active_analysis_sessions:
                    active_analysis_sessions[stream_id].active = False
            return
        
        logger.info(f"Starting frame capture for stream {stream_id} - {session.stream_name}")
        logger.info("ONLY frames with trains will be saved")
        
        local_frames_processed = 0
        local_trains_detected = 0
        local_frames_discarded = 0
        
        consecutive_failures = 0
        max_consecutive_failures = 10  # Después de 10 fallos consecutivos, intentar refrescar URL
        
        while session.active:
            t0 = time.time()
            ret, frame = cap.read()
            if not ret:
                consecutive_failures += 1
                logger.warning(f"Could not read frame from stream {stream_id} (failure {consecutive_failures}) - attempting reconnection")
                
                # Enhanced reconnection logic with exponential backoff
                cap.release()
                
                # Si hay muchos fallos consecutivos, puede que la URL del stream haya expirado
                if consecutive_failures >= max_consecutive_failures:
                    logger.warning(f"Too many consecutive failures ({consecutive_failures}), stream URL may have expired")
                    logger.info(f"Consider refreshing the stream URL for {stream_id}")
                    # Podríamos intentar refrescar la URL aquí, pero es arriesgado en un hilo
                    consecutive_failures = 0  # Reset counter
                
                # Progressive retry delays: 3s, 5s, 10s, 15s, 20s (más tiempo para HLS)
                retry_delays = [3, 5, 10, 15, 20]
                reconnected = False
                
                for attempt, delay in enumerate(retry_delays, 1):
                    logger.info(f"Reconnection attempt {attempt}/{len(retry_delays)} for stream {stream_id} (waiting {delay}s)")
                    time.sleep(delay)
                    
                    # Usar la función optimizada para crear VideoCapture
                    cap = create_video_capture_for_stream(stream_url)
                    
                    # Test if connection works
                    if cap.isOpened():
                        # Dar tiempo al buffer para llenarse con streams HLS
                        time.sleep(1)
                        test_ret, test_frame = cap.read()
                        if test_ret and test_frame is not None:
                            logger.info(f"✅ Successfully reconnected to stream {stream_id}")
                            consecutive_failures = 0  # Reset failure counter on success
                            reconnected = True
                            break
                        else:
                            logger.warning(f"Stream opened but could not read frame (attempt {attempt})")
                            cap.release()
                    else:
                        logger.warning(f"Could not open stream (attempt {attempt})")
                
                if not reconnected:
                    logger.error(f"❌ Failed to reconnect to stream {stream_id} after {len(retry_delays)} attempts")
                    session.active = False
                    return
                
                continue
            
            # Capture exact timestamp
            current_time = datetime.now()
            local_frames_processed += 1
            
            # Detect trains in frame
            has_trains, detections, annotated_frame = detect_trains(frame)
            
            if has_trains:
                # SAVE: Frame contains trains
                frame_doc = save_train_frame(frame, current_time, detections, annotated_frame, stream_id)
                if frame_doc:
                    local_trains_detected += 1
                    logger.info(f"✅ Stream {stream_id} - Frame {local_frames_processed} - SAVED - {len(detections)} train(s) detected.")

                    # Update Railway Events aggregation (initially empty reporting marks)
                    try:
                        update_railway_event(stream_id, session.stream_name, current_time, detections, frame_doc)
                    except Exception as e:
                        logger.error(f"Error updating railway event: {e}")
                    
                    # Update session metrics
                    with session_lock:
                        if stream_id in active_analysis_sessions:
                            active_analysis_sessions[stream_id].update_metrics(
                                frames_processed=local_frames_processed,
                                trains_detected=local_trains_detected,
                                frames_discarded=local_frames_discarded
                            )
                    

                    
                    # Send real-time update via WebSocket
                    update_message = {
                        "type": "frame_detected",
                        "stream_id": stream_id,
                        "stream_name": session.stream_name,
                        "frames_processed": local_frames_processed,
                        "trains_detected": local_trains_detected,
                        "frames_discarded": local_frames_discarded,
                        "detection_count": len(detections),
                        "detection_rate": round((local_trains_detected / local_frames_processed) * 100, 2) if local_frames_processed > 0 else 0,
                        "timestamp": current_time.isoformat()
                    }
                    if main_loop is not None and main_loop.is_running():
                        asyncio.run_coroutine_threadsafe(broadcast_update(update_message), main_loop)
            else:
                # DISCARD: Frame without trains
                local_frames_discarded += 1
                
                # Update session metrics every 10 frames
                if local_frames_processed % 10 == 0:
                    with session_lock:
                        if stream_id in active_analysis_sessions:
                            active_analysis_sessions[stream_id].update_metrics(
                                frames_processed=local_frames_processed,
                                trains_detected=local_trains_detected,
                                frames_discarded=local_frames_discarded
                            )
            
            # Check for event inactivity timeout on frames without detections as well
            try:
                check_and_close_inactive_event(stream_id, current_time)
            except Exception as e:
                logger.error(f"Error checking railway event inactivity: {e}")

            # Check duration limit
            if duration_minutes > 0:
                elapsed_time = (current_time - session.start_time).total_seconds() / 60
                if elapsed_time >= duration_minutes:
                    logger.info(f"Analysis duration reached for stream {stream_id}")
                    break
            
            # Wait for next frame based on configured interval (adjusted for processing time)
            elapsed = time.time() - t0
            sleep_time = max(0.01, CAPTURE_INTERVAL_SECONDS - elapsed)
            logger.info(f"Stream {stream_id} - Frame {local_frames_processed} - Processing took {elapsed:.3f}s. Sleeping for {sleep_time:.3f}s.")
            time.sleep(sleep_time)
        
        cap.release()
        logger.info(f"Frame capture completed for stream {stream_id}")
        
    except Exception as e:
        logger.error(f"Error in frame capture for stream {stream_id}: {e}")
    finally:
        # Mark session as inactive
        with session_lock:
            if stream_id in active_analysis_sessions:
                active_analysis_sessions[stream_id].active = False
        
        # Broadcast stop notification
        if main_loop is not None and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(broadcast_update({
                "type": "analysis_stopped",
                "stream_id": stream_id,
                "stream_name": session.stream_name if session else "Unknown"
            }), main_loop)

# =================== RAILWAY EVENTS AGGREGATION ===================

def _extract_reporting_marks_from_detections(detections: list) -> list:
    """Extract cleaned reporting marks from detections."""
    return []

def update_railway_event(stream_id: str, stream_name: str, timestamp: datetime, detections: list, frame_doc: dict):
    """Create or update a Railway Event for a given stream.

    A Railway Event groups consecutive frames-with-trains until inactivity exceeds
    EVENT_INACTIVITY_WINDOW_SECONDS. Counts and reporting marks are aggregated.
    """
    global active_railway_events, events_collection

    if events_collection is None:
        return  # No DB available

    with events_lock:
        # Get or create active event state for stream
        state = active_railway_events.get(stream_id)
        if state is None or (timestamp - state['last_detection_time']).total_seconds() > EVENT_INACTIVITY_WINDOW_SECONDS:
            # Close previous if exists
            if state is not None:
                try:
                    _finalize_event(state, timestamp)
                except Exception as e:
                    logger.error(f"Error finalizing previous event: {e}")

            # Start new event
            event_id = str(uuid.uuid4())
            reporting_marks = _extract_reporting_marks_from_detections(detections)
            event_doc = {
                "id": event_id,
                "stream_id": stream_id,
                "stream_name": stream_name,
                "start_time": timestamp,
                "end_time": None,
                "duration_seconds": None,
                "frames_count": 1,
                "units_count": len(detections or []),
                # Placeholders for future classification improvements
                "locomotives_count": None,
                "wagons_count": None,
                "reporting_marks": list(sorted(set(reporting_marks))),
                "reporting_marks_count": len(set(reporting_marks)),
                "first_frame": frame_doc.get("filename"),
                "last_frame": frame_doc.get("filename"),
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            }
            events_collection.insert_one(event_doc)
            active_railway_events[stream_id] = {
                "event_id": event_id,
                "last_detection_time": timestamp,
                "frames_count": 1,
                "units_count": len(detections or []),
                "reporting_marks_set": set(event_doc["reporting_marks"]),
                "start_time": timestamp,
            }
            logger.info(f"Started new Railway Event for stream {stream_id}: {event_id}")
            return

        # Update existing event
        state['last_detection_time'] = timestamp
        state['frames_count'] += 1
        state['units_count'] += len(detections or [])
        new_marks = set(_extract_reporting_marks_from_detections(detections))
        state['reporting_marks_set'].update(new_marks)

        update_fields = {
            "frames_count": state['frames_count'],
            "units_count": state['units_count'],
            "last_frame": frame_doc.get("filename"),
            "reporting_marks": list(sorted(state['reporting_marks_set'])),
            "reporting_marks_count": len(state['reporting_marks_set']),
            "updated_at": datetime.now(),
        }
        events_collection.update_one({"id": state['event_id']}, {"$set": update_fields})

def _finalize_event(state: dict, end_time: datetime):
    """Finalize an active event and persist end time and duration."""
    global events_collection
    if events_collection is None:
        return
    duration_seconds = int((end_time - state['start_time']).total_seconds())
    events_collection.update_one(
        {"id": state['event_id']},
        {"$set": {
            "end_time": end_time,
            "duration_seconds": duration_seconds,
            "updated_at": datetime.now(),
        }}
    )

def check_and_close_inactive_event(stream_id: str, now: datetime):
    """Close the active event for stream if inactivity window elapsed."""
    global active_railway_events
    with events_lock:
        state = active_railway_events.get(stream_id)
        if state is None:
            return
        gap = (now - state['last_detection_time']).total_seconds()
        if gap > EVENT_INACTIVITY_WINDOW_SECONDS:
            _finalize_event(state, now)
            del active_railway_events[stream_id]
            logger.info(f"Closed Railway Event {state['event_id']} due to inactivity ({int(gap)}s)")



@app.get("/frames")
def get_frames(limit: int = 12, skip: int = 0, stream_id: Optional[str] = None):
    """Obtiene lista de fotogramas guardados (solo los que contienen trenes)"""
    frames = []
    total_frames = 0
    
    if collection is not None:
        try:
            # Construir query - solo frames con trenes
            query = {"has_trains": True}
            
            # Add stream filter if provided
            if stream_id is not None and stream_id != "":
                query["stream_id"] = stream_id
            
            frames = list(collection.find(
                query,
                {"_id": 0, "filename": 1, "filepath": 1, "timestamp": 1, "size": 1, 
                 "detection_count": 1, "detections": 1, "has_trains": 1, "stream_id": 1}
            ).sort("timestamp", -1).skip(skip).limit(limit))
            

            
            total_frames = collection.count_documents(query)
        except Exception as e:
            logger.error(f"Error querying frames: {e}")
    
    # Calculate totals from active sessions
    total_processed = 0
    total_discarded = 0
    with session_lock:
        for session in active_analysis_sessions.values():
            total_processed += session.frames_processed
            total_discarded += session.frames_discarded

    return {
        "frames": frames,
        "total": total_frames,
        "frames_processed": total_processed,
        "frames_discarded": total_discarded,
        "trains_folder": os.path.abspath(TRAINS_FOLDER),
        "note": "Only frames with detected trains are shown"
    }


@app.get("/frame/{filename}")
def get_frame_image(filename: str):
    """Obtiene una imagen específica por su nombre de archivo"""
    try:
        # Prevent Path Traversal
        safe_base = os.path.abspath(TRAINS_FOLDER)
        filepath = os.path.abspath(os.path.join(safe_base, filename))
        
        if not filepath.startswith(safe_base):
            raise HTTPException(status_code=403, detail="Access denied")
            
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Frame not found")
        
        return FileResponse(
            path=filepath,
            media_type="image/jpeg",
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail="Frame not found")

@app.get("/network/diagnostics")
async def get_network_diagnostics():
    """Run network diagnostics to help troubleshoot TLS/connection issues"""
    try:
        diagnostics = {
            "timestamp": datetime.now().isoformat(),
            "tests": {}
        }
        
        # Test basic internet connectivity
        try:
            response = requests.get("https://www.google.com", timeout=10, verify=True)
            diagnostics["tests"]["internet_connectivity"] = {
                "status": "success" if response.status_code == 200 else "failed",
                "response_time_ms": response.elapsed.total_seconds() * 1000
            }
        except Exception as e:
            diagnostics["tests"]["internet_connectivity"] = {
                "status": "failed",
                "error": str(e)
            }
        
        # Test YouTube connectivity
        try:
            response = requests.get("https://www.youtube.com", timeout=15, verify=True)
            diagnostics["tests"]["youtube_connectivity"] = {
                "status": "success" if response.status_code == 200 else "failed",
                "response_time_ms": response.elapsed.total_seconds() * 1000
            }
        except Exception as e:
            diagnostics["tests"]["youtube_connectivity"] = {
                "status": "failed",
                "error": str(e)
            }
        
        # Test yt-dlp functionality
        try:
            test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Rick Roll - always available
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'socket_timeout': 15,
                'extract_flat': True  # Don't download, just extract info
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(test_url, download=False)
                diagnostics["tests"]["yt_dlp_functionality"] = {
                    "status": "success",
                    "title": info.get('title', 'Unknown')
                }
        except Exception as e:
            diagnostics["tests"]["yt_dlp_functionality"] = {
                "status": "failed",
                "error": str(e)
            }
        
        # SSL/TLS configuration check
        try:
            import ssl
            context = ssl.create_default_context()
            diagnostics["tests"]["ssl_configuration"] = {
                "status": "success",
                "ssl_version": ssl.OPENSSL_VERSION,
                "protocols": list(context.protocol.name for protocol in [ssl.PROTOCOL_TLS])
            }
        except Exception as e:
            diagnostics["tests"]["ssl_configuration"] = {
                "status": "failed",
                "error": str(e)
            }
        
        # System info
        import platform
        diagnostics["system_info"] = {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "architecture": platform.architecture()[0]
        }
        
        return {
            "status": "completed",
            "diagnostics": diagnostics,
            "recommendations": get_network_recommendations(diagnostics)
        }
        
    except Exception as e:
        logger.error(f"Error running network diagnostics: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

def get_network_recommendations(diagnostics):
    """Get recommendations based on diagnostic results"""
    recommendations = []
    
    if diagnostics["tests"].get("internet_connectivity", {}).get("status") != "success":
        recommendations.append("❌ Check your internet connection")
    
    if diagnostics["tests"].get("youtube_connectivity", {}).get("status") != "success":
        recommendations.append("❌ YouTube is not accessible - check firewall/proxy settings")
    
    if diagnostics["tests"].get("yt_dlp_functionality", {}).get("status") != "success":
        error = diagnostics["tests"]["yt_dlp_functionality"].get("error", "")
        if "tls" in error.lower() or "ssl" in error.lower():
            recommendations.append("🔧 TLS/SSL issues detected - consider updating Python/OpenSSL")
            recommendations.append("💡 Try running with administrator privileges")
        else:
            recommendations.append("⚠️ yt-dlp functionality issues - check for updates")
    
    if not recommendations:
        recommendations.append("✅ All network tests passed - system appears healthy")
    
    return recommendations

@app.get("/system/device-info")
async def get_system_device_info():
    """Alias for get_device_info to support admin dashboard query"""
    return await get_device_info()

@app.get("/device/info")
async def get_device_info():
    """Get detailed device and hardware acceleration information"""
    try:
        device_info = DEVICE_CONFIG.copy()
        
        # Add additional system information
        if device_info['cuda_available']:
            try:
                # Get detailed CUDA information
                device_info['cuda_version'] = torch.version.cuda
                device_info['cudnn_version'] = torch.backends.cudnn.version()
                device_info['memory_allocated'] = torch.cuda.memory_allocated(0) / 1024**2  # MB
                device_info['memory_reserved'] = torch.cuda.memory_reserved(0) / 1024**2  # MB
                device_info['max_memory'] = torch.cuda.max_memory_allocated(0) / 1024**2  # MB
                
                # Get capabilities
                capability = torch.cuda.get_device_capability(0)
                device_info['compute_capability'] = f"{capability[0]}.{capability[1]}"
                
            except Exception as e:
                logger.warning(f"Could not get detailed CUDA info: {e}")
        
        # Add PyTorch version
        device_info['pytorch_version'] = torch.__version__
        
        # Model status
        yolo_device = 'unknown'
        try:
            with model_lock:
                if model is not None:
                    yolo_device = str(next(model.model.parameters()).device)
        except Exception:
            yolo_device = DEVICE_CONFIG['device']

        with model_lock:
            model_loaded = model is not None
            model_path = MODEL_PATH
            labels_count = len(MODEL_LABELS)
            target_class_ids = TRAIN_CLASSES
            target_class_names = [MODEL_LABELS.get(i, str(i)) for i in target_class_ids]

        device_info['model_status'] = {
            'yolo_loaded': model_loaded,
            'yolo_device': yolo_device,
            'ocr_loaded': False,
            'ocr_gpu_active': False,
            'model_path': model_path,
            'labels_count': labels_count,
            'target_class_ids': target_class_ids,
            'target_class_names': target_class_names
        }
        
        return {
            "status": "success",
            "device_info": device_info,
            "model": {
                "path": MODEL_PATH,
                "labels": MODEL_LABELS,
                "target_class_ids": TRAIN_CLASSES,
                "target_class_names": [MODEL_LABELS.get(i, str(i)) for i in TRAIN_CLASSES]
            },
            "recommendations": {
                "performance_mode": "GPU" if device_info['cuda_available'] else "CPU",
                "suggested_optimizations": get_performance_recommendations(device_info)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting device info: {e}")
        return {
            "status": "error",
            "error": str(e),
            "device_info": DEVICE_CONFIG
        }

def get_performance_recommendations(device_info):
    """Get performance optimization recommendations based on hardware"""
    recommendations = []
    
    if device_info['cuda_available']:
        recommendations.append("✅ GPU acceleration is active - optimal performance expected")
        if device_info['cuda_device_count'] > 1:
            recommendations.append(f"💡 Multiple GPUs detected ({device_info['cuda_device_count']}) - consider multi-GPU processing")
    else:
        recommendations.append("⚠️ GPU not available - install CUDA-compatible PyTorch for better performance")
        recommendations.append("💡 Consider upgrading to a system with dedicated GPU for real-time processing")
        

        
    return recommendations


@app.get("/detections")
def get_detections(limit: int = 50, skip: int = 0):
    """Get all detections in tabular format with location, timestamp, and reporting_mark"""
    try:
        if collection is None or streams_collection is None:
            return {
                "detections": [],
                "total": 0,
                "message": "Database not available"
            }
        
        # Get all frames with detections
        frames = list(collection.find(
            {"has_trains": True, "detections": {"$exists": True}},
            {"stream_id": 1, "timestamp": 1, "detections": 1, "filename": 1}
        ).sort("timestamp", -1).skip(skip).limit(limit))
        
        # Get stream information for location mapping
        stream_ids = list(set(frame.get('stream_id') for frame in frames if frame.get('stream_id')))
        streams_info = {}
        if stream_ids:
            streams = list(streams_collection.find(
                {"id": {"$in": stream_ids}},
                {"id": 1, "name": 1, "description": 1}
            ))
            streams_info = {stream['id']: stream for stream in streams}
        
        detections_list = []
        
        for frame in frames:
            stream_id = frame.get('stream_id', 'Unknown')
            timestamp = frame.get('timestamp')
            filename = frame.get('filename', '')
            
            # Get location from stream info
            location = "Unknown Location"
            if stream_id in streams_info:
                stream_info = streams_info[stream_id]
                location = stream_info.get('name', 'Unknown Stream')
                if stream_info.get('description'):
                    location += f" ({stream_info.get('description')})"
            elif stream_id == 'Unknown':
                location = "Legacy Stream"
            
            # Process each detection in the frame
            for detection_idx, detection in enumerate(frame.get('detections', [])):
                detections_list.append({
                    "location": location,
                    "timestamp": timestamp.isoformat() if timestamp else None,
                    "reporting_mark": "not registered",
                    "confidence": round(detection.get('confidence', 0), 3),
                    "detection_type": "locomotive/wagon",
                    "stream_id": stream_id,
                    "frame_timestamp": timestamp.isoformat() if timestamp else None,
                    "filename": filename
                })
        
        # Get total count for pagination
        total_frames = collection.count_documents({"has_trains": True, "detections": {"$exists": True}})
        
        # Estimate total detections (this is approximate since we don't know how many detections per frame)
        estimated_total = total_frames * 1.5  # Rough estimation
        
        return {
            "detections": detections_list,
            "total": len(detections_list),
            "estimated_total": int(estimated_total),
            "total_frames": total_frames,
            "page_info": {
                "limit": limit,
                "skip": skip,
                "returned": len(detections_list)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting detections: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting detections: {str(e)}")

@app.get("/railway-events")
def get_railway_events(limit: int = 20, skip: int = 0, stream_id: Optional[str] = None):
    """List Railway Events with pagination and optional stream filter."""
    try:
        if events_collection is None:
            return {"events": [], "total": 0, "message": "Database not available"}

        query = {}
        if stream_id:
            query["stream_id"] = stream_id

        cursor = events_collection.find(query, {"_id": 0}).sort("start_time", -1).skip(skip).limit(limit)
        events = list(cursor)
        total = events_collection.count_documents(query)

        return {
            "events": events,
            "total": total,
            "page_info": {"limit": limit, "skip": skip, "returned": len(events)}
        }
    except Exception as e:
        logger.error(f"Error getting railway events: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting railway events: {str(e)}")

@app.get("/railway-events/{event_id}")
def get_railway_event(event_id: str):
    """Get details for a single Railway Event."""
    try:
        if events_collection is None:
            raise HTTPException(status_code=500, detail="Database not available")
        event = events_collection.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting railway event: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting railway event: {str(e)}")

@app.get("/railway-events/{event_id}/frames")
def get_railway_event_frames(event_id: str, limit: int = 24, skip: int = 0):
    """Return frames-with-trains that belong to a specific Railway Event.

    Frames are resolved by matching the `stream_id` and filtering by the event
    time window [start_time, end_time]. If the event is still active
    (end_time is None), the upper bound will be the current time.
    """
    try:
        if events_collection is None:
            raise HTTPException(status_code=500, detail="Database not available")

        event = events_collection.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Build frames query using event boundaries
        start_time = event.get("start_time")
        end_time = event.get("end_time") or datetime.now()

        query = {
            "has_trains": True,
            "stream_id": event.get("stream_id"),
            "timestamp": {"$gte": start_time, "$lte": end_time},
        }

        frames = []
        total = 0
        if collection is not None:
            cursor = collection.find(
                query,
                {
                    "_id": 0,
                    "filename": 1,
                    "timestamp": 1,
                    "size": 1,
                    "detections": 1,
                    "detection_count": 1,
                    "stream_id": 1,
                },
            ).sort("timestamp", 1).skip(skip).limit(limit)

            frames = list(cursor)

            # Ensure detection_count exists
            for frame in frames:
                detections = frame.get("detections", []) or []
                if "detection_count" not in frame:
                    frame["detection_count"] = len(detections)

            total = collection.count_documents(query)

        return {
            "event": {
                "id": event.get("id"),
                "stream_id": event.get("stream_id"),
                "stream_name": event.get("stream_name"),
                "start_time": event.get("start_time"),
                "end_time": event.get("end_time"),
                "duration_seconds": event.get("duration_seconds"),
                "frames_count": event.get("frames_count"),
            },
            "frames": frames,
            "total": total,
            "page_info": {"limit": limit, "skip": skip, "returned": len(frames)},
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting frames for railway event: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting frames for railway event: {str(e)}")

def compile_video_task(event_id: str, fps: int):
    global video_generation_statuses
    try:
        logger.info(f"Starting background video compilation for event {event_id}")
        if events_collection is None or collection is None:
            raise RuntimeError("Database not available")
            
        event = events_collection.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise RuntimeError("Event not found")

        video_filename = f"event_{event_id}.mp4"
        video_path = os.path.join(EVENT_VIDEOS_FOLDER, video_filename)

        start_time = event.get("start_time")
        end_time = event.get("end_time") or datetime.now()

        cursor = collection.find(
            {
                "has_trains": True,
                "stream_id": event.get("stream_id"),
                "timestamp": {"$gte": start_time, "$lte": end_time},
            },
            {"_id": 0, "filename": 1, "timestamp": 1}
        ).sort("timestamp", 1)

        frames_meta = list(cursor)
        valid_files = []
        first_w, first_h = None, None

        for fm in frames_meta:
            filename = fm.get("filename")
            if not filename:
                continue
            frame_path = os.path.join(TRAINS_FOLDER, filename)
            if not os.path.exists(frame_path):
                continue
            if first_w is None or first_h is None:
                img = cv2.imread(frame_path)
                if img is None:
                    continue
                first_h, first_w = img.shape[:2]
            valid_files.append(frame_path)

        if not valid_files:
            raise RuntimeError("No frames available for this event")

        written = 0
        if len(valid_files) == 1:
            repeat = max(fps * 2, 10)
            try:
                writer = imageio.get_writer(video_path, format='FFMPEG', mode='I', fps=max(fps, 1), codec='libx264', macro_block_size=None)
                img = cv2.imread(valid_files[0])
                if img is None:
                    raise RuntimeError("Failed to read event frame")
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                for _ in range(repeat):
                    writer.append_data(img_rgb)
                writer.close()
                written = repeat
            except Exception as e:
                logger.warning(f"Background video imageio single frame failed, fallback to OpenCV: {e}")
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer = cv2.VideoWriter(video_path, fourcc, max(fps, 1), (first_w, first_h))
                img = cv2.imread(valid_files[0])
                if img is not None:
                    for _ in range(repeat):
                        writer.write(img)
                    written = repeat
                writer.release()
        else:
            try:
                writer = imageio.get_writer(video_path, format='FFMPEG', mode='I', fps=max(fps, 1), codec='libx264', macro_block_size=None)
                for p in valid_files:
                    img = cv2.imread(p)
                    if img is None:
                        continue
                    if img.shape[1] != first_w or img.shape[0] != first_h:
                        img = cv2.resize(img, (first_w, first_h))
                    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    writer.append_data(img_rgb)
                    written += 1
                writer.close()
            except Exception as e:
                logger.warning(f"Background video imageio failed, fallback to OpenCV: {e}")
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer = cv2.VideoWriter(video_path, fourcc, max(fps, 1), (first_w, first_h))
                written = 0
                for p in valid_files:
                    img = cv2.imread(p)
                    if img is None:
                        continue
                    if img.shape[1] != first_w or img.shape[0] != first_h:
                        img = cv2.resize(img, (first_w, first_h))
                    writer.write(img)
                    written += 1
                writer.release()

        if written == 0:
            raise RuntimeError("Failed to compose video from frames")

        if not os.path.exists(video_path) or os.path.getsize(video_path) == 0:
            raise RuntimeError("Generated video file is missing or empty")

        with video_generation_lock:
            video_generation_statuses[event_id] = {
                "status": "completed",
                "video_path": video_path,
                "completed_at": datetime.now().isoformat()
            }
        logger.info(f"Background video compilation completed for event {event_id}")

    except Exception as e:
        logger.error(f"Error compiling video in background for event {event_id}: {e}")
        with video_generation_lock:
            video_generation_statuses[event_id] = {
                "status": "failed",
                "error": str(e),
                "failed_at": datetime.now().isoformat()
            }

@app.get("/railway-events/{event_id}/video")
@app.head("/railway-events/{event_id}/video")
def get_railway_event_video(event_id: str, background_tasks: BackgroundTasks, response: Response, fps: int = 5, regenerate: bool = False):
    """Generate (if needed) and return a video for the specified Railway Event.

    This generates the video in the background to prevent blocking the API.
    """
    global video_generation_statuses
    
    if events_collection is None:
        raise HTTPException(status_code=500, detail="Database not available")

    event = events_collection.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    video_filename = f"event_{event_id}.mp4"
    video_path = os.path.join(EVENT_VIDEOS_FOLDER, video_filename)

    if os.path.exists(video_path) and not regenerate:
        with video_generation_lock:
            status_info = video_generation_statuses.get(event_id)
            if status_info and status_info["status"] == "generating":
                response.status_code = 202
                return {"status": "generating", "message": "Video is currently compiling in the background"}
        
        return FileResponse(
            path=video_path, 
            media_type="video/mp4", 
            filename=video_filename,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Disposition": f"inline; filename={video_filename}",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )

    with video_generation_lock:
        status_info = video_generation_statuses.get(event_id)
        if status_info and status_info["status"] == "generating":
            response.status_code = 202
            return {"status": "generating", "message": "Video is currently compiling in the background"}

        video_generation_statuses[event_id] = {
            "status": "generating",
            "started_at": datetime.now().isoformat()
        }
        background_tasks.add_task(compile_video_task, event_id, fps)
        
    response.status_code = 202
    return {"status": "generating", "message": "Video compilation started in the background"}

@app.get("/railway-events/{event_id}/video/status")
def get_railway_event_video_status(event_id: str):
    """Check the status of a background video compilation task"""
    global video_generation_statuses
    
    if events_collection is None:
        raise HTTPException(status_code=500, detail="Database not available")
        
    event = events_collection.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    video_filename = f"event_{event_id}.mp4"
    video_path = os.path.join(EVENT_VIDEOS_FOLDER, video_filename)
    
    if os.path.exists(video_path):
        with video_generation_lock:
            status_info = video_generation_statuses.get(event_id)
            if not status_info or status_info["status"] != "generating":
                return {"status": "completed", "video_ready": True}
                
    with video_generation_lock:
        status_info = video_generation_statuses.get(event_id)
        if status_info:
            return {
                "status": status_info["status"],
                "video_ready": status_info["status"] == "completed",
                "error": status_info.get("error"),
                "details": status_info
            }
            
    return {"status": "not_started", "video_ready": False}

@app.delete("/frames")
def delete_all_frames():
    """Elimina todos los fotogramas guardados (archivos locales y metadatos)"""
    try:
        deleted_files = 0
        
        # Eliminar archivos de la carpeta de trenes
        if os.path.exists(TRAINS_FOLDER):
            for filename in os.listdir(TRAINS_FOLDER):
                if filename.endswith('.jpg'):
                    filepath = os.path.join(TRAINS_FOLDER, filename)
                    os.remove(filepath)
                    deleted_files += 1
        
        # Eliminar documentos de la colección
        deleted_records = 0
        if collection is not None:
            try:
                result = collection.delete_many({})
                deleted_records = result.deleted_count
            except Exception as e:
                logger.error(f"Error deleting from database: {e}")
        

        
        return {
            "message": f"Deleted {deleted_files} files and {deleted_records} records",
            "deleted_files": deleted_files,
            "deleted_records": deleted_records,
            "note": "Counters reset"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting frames: {str(e)}")

# === STREAM MANAGEMENT ENDPOINTS ===

@app.post("/streams/preview")
def preview_stream(request: dict):
    """Preview YouTube stream metadata before creating"""
    try:
        url = request.get('url', '').strip()
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        metadata = get_youtube_metadata(url)
        
        # Download thumbnail for preview
        thumbnail_base64 = None
        if metadata.get('thumbnail_url'):
            thumbnail_base64 = download_thumbnail(metadata['thumbnail_url'])
        
        return {
            "title": metadata.get('title', ''),
            "description": metadata.get('description', ''),
            "uploader": metadata.get('uploader', ''),
            "view_count": metadata.get('view_count', 0),
            "is_live": metadata.get('is_live', False),
            "thumbnail": thumbnail_base64,
            "duration": metadata.get('duration', 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing stream: {e}")
        raise HTTPException(status_code=400, detail=f"Error previewing stream: {str(e)}")

@app.post("/streams")
def create_stream(request: StreamCreateRequest):
    """Create a new stream for analysis"""
    try:
        if streams_collection is None:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Extract YouTube metadata including thumbnail
        try:
            youtube_metadata = get_youtube_metadata(request.url)
        except:
            raise HTTPException(status_code=400, detail="Invalid stream URL")
        
        # Handle thumbnail - custom takes priority, then YouTube, then none
        thumbnail_base64 = None
        if request.custom_thumbnail:
            # Process custom thumbnail
            thumbnail_base64 = validate_and_process_custom_thumbnail(request.custom_thumbnail)
        elif youtube_metadata.get('thumbnail_url'):
            # Download YouTube thumbnail
            thumbnail_base64 = download_thumbnail(youtube_metadata['thumbnail_url'])
        
        stream_doc = {
            "id": str(uuid.uuid4()),
            "name": request.name,
            "url": request.url,
            "description": request.description,
            "active": True,
            "thumbnail": thumbnail_base64,
            "youtube_metadata": {
                "title": youtube_metadata.get('title', ''),
                "uploader": youtube_metadata.get('uploader', ''),
                "view_count": youtube_metadata.get('view_count', 0),
                "is_live": youtube_metadata.get('is_live', False)
            },
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        streams_collection.insert_one(stream_doc)
        stream_doc["_id"] = str(stream_doc["_id"])
        
        logger.info(f"New stream created: {request.name}")
        return stream_doc
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating stream: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating stream: {str(e)}")

@app.get("/streams")
def get_streams(active_only: bool = True):
    """Get all available streams"""
    try:
        if streams_collection is None:
            return {"streams": [], "message": "Database not available"}
        
        query = {}
        if active_only:
            query["active"] = True
            
        streams = list(streams_collection.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1))
        
        return {"streams": streams}
        
    except Exception as e:
        logger.error(f"Error getting streams: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting streams: {str(e)}")

@app.get("/streams/{stream_id}")
def get_stream(stream_id: str):
    """Get a specific stream by ID"""
    try:
        if streams_collection is None:
            raise HTTPException(status_code=500, detail="Database not available")
        
        stream = streams_collection.find_one({"id": stream_id}, {"_id": 0})
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        return stream
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stream: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting stream: {str(e)}")

@app.put("/streams/{stream_id}")
def update_stream(stream_id: str, request: StreamUpdateRequest):
    """Update a stream"""
    try:
        if streams_collection is None:
            raise HTTPException(status_code=500, detail="Database not available")
        
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No data to update")
        
        # Handle URL updates with metadata refresh
        if "url" in update_data:
            try:
                youtube_metadata = get_youtube_metadata(update_data["url"])
                update_data["youtube_metadata"] = {
                    "title": youtube_metadata.get('title', ''),
                    "uploader": youtube_metadata.get('uploader', ''),
                    "view_count": youtube_metadata.get('view_count', 0),
                    "is_live": youtube_metadata.get('is_live', False)
                }
                # Only update thumbnail if no custom thumbnail is being set
                if "custom_thumbnail" not in update_data and youtube_metadata.get('thumbnail_url'):
                    thumbnail_base64 = download_thumbnail(youtube_metadata['thumbnail_url'])
                    if thumbnail_base64:
                        update_data["thumbnail"] = thumbnail_base64
            except:
                raise HTTPException(status_code=400, detail="Invalid stream URL")
        
        # Handle custom thumbnail update
        if "custom_thumbnail" in update_data and update_data["custom_thumbnail"]:
            update_data["thumbnail"] = validate_and_process_custom_thumbnail(update_data["custom_thumbnail"])
            # Remove the custom_thumbnail field from the update data as we store it as thumbnail
            del update_data["custom_thumbnail"]
        
        update_data["updated_at"] = datetime.now()
        
        result = streams_collection.update_one(
            {"id": stream_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        updated_stream = streams_collection.find_one({"id": stream_id}, {"_id": 0})
        logger.info(f"Stream updated: {stream_id}")
        return updated_stream
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating stream: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating stream: {str(e)}")

@app.delete("/streams/{stream_id}")
def delete_stream(stream_id: str):
    """Delete a stream"""
    try:
        if streams_collection is None:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Check if stream is currently being analyzed
        global active_analysis_sessions, session_lock
        with session_lock:
            if stream_id in active_analysis_sessions and active_analysis_sessions[stream_id].active:
                raise HTTPException(status_code=400, detail="Cannot delete stream while analysis is active")
        
        result = streams_collection.delete_one({"id": stream_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        logger.info(f"Stream deleted: {stream_id}")
        return {"message": "Stream deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting stream: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting stream: {str(e)}")

# === ANALYSIS ENDPOINTS ===

@app.post("/analysis/start")
async def start_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start real-time analysis of a stream (supports multiple concurrent streams)"""
    global active_analysis_sessions, session_lock
    
    with model_lock:
        model_loaded = model is not None
    if not model_loaded:
        raise HTTPException(status_code=500, detail="YOLO model not available")
    
    try:
        # Get stream from database
        if streams_collection is None:
            raise HTTPException(status_code=500, detail="Database not available")
        
        stream = await run_in_threadpool(streams_collection.find_one, {"id": request.stream_id, "active": True})
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found or not active")
        
        # Check if stream is already being analyzed
        with session_lock:
            if request.stream_id in active_analysis_sessions and active_analysis_sessions[request.stream_id].active:
                raise HTTPException(status_code=400, detail=f"Analysis already in progress for stream: {stream['name']}")
        
        # Get stream URL
        stream_url = await run_in_threadpool(get_stream_url, stream["url"])
        logger.info(f"Starting analysis for stream: {stream['name']}")
        
        # Create and start analysis session
        with session_lock:
            session = AnalysisSession(
                stream_id=request.stream_id,
                stream_name=stream["name"],
                stream_url=stream_url,
                duration_minutes=request.duration_minutes
            )
            active_analysis_sessions[request.stream_id] = session
            session.start()
        
        # Broadcast start notification
        await broadcast_update({
            "type": "analysis_started",
            "stream_id": request.stream_id,
            "stream_name": stream["name"]
        })
        
        return {
            "message": f"Analysis started for stream: {stream['name']}",
            "stream_id": request.stream_id,
            "stream_name": stream["name"],
            "duration": f"{'infinite' if request.duration_minutes == 0 else f'{request.duration_minutes} minutes'}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up session if created
        with session_lock:
            if request.stream_id in active_analysis_sessions:
                active_analysis_sessions[request.stream_id].stop()
                del active_analysis_sessions[request.stream_id]
        logger.error(f"Error starting analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting analysis: {str(e)}")

@app.post("/analysis/stop")
async def stop_analysis(stream_id: Optional[str] = None):
    """Stop analysis - specific stream or all if no stream_id provided"""
    global active_analysis_sessions, session_lock
    
    stopped_sessions = []
    sessions_to_stop = []
    
    with session_lock:
        if stream_id:
            # Stop specific stream
            if stream_id not in active_analysis_sessions:
                raise HTTPException(status_code=400, detail=f"No analysis in progress for stream: {stream_id}")
            
            session = active_analysis_sessions[stream_id]
            sessions_to_stop.append(session)
            del active_analysis_sessions[stream_id]
        else:
            # Stop all active analyses
            if not active_analysis_sessions:
                raise HTTPException(status_code=400, detail="No analysis in progress")
            
            sessions_to_stop = list(active_analysis_sessions.values())
            active_analysis_sessions.clear()
            
    # Now stop them outside the lock, using run_in_threadpool
    for session in sessions_to_stop:
        await run_in_threadpool(session.stop)
        stopped_sessions.append(session.to_dict())
    
    # Broadcast stop notifications
    for session_data in stopped_sessions:
        await broadcast_update({
            "type": "analysis_stopped",
            "stream_id": session_data["stream_id"],
            "stream_name": session_data["stream_name"]
        })
    
    return {
        "message": f"Analysis stopped for {len(stopped_sessions)} stream(s)",
        "stopped_streams": stopped_sessions
    }

@app.get("/analysis/status")
async def get_analysis_status():
    """Get current analysis status (returns first active stream)"""
    global active_analysis_sessions, session_lock
    
    with session_lock:
        if active_analysis_sessions:
            # Return data from first active session
            first_session = next(iter(active_analysis_sessions.values()))
            with model_lock:
                model_loaded = model is not None
            return {
                "active": first_session.active,
                "capture_active": first_session.active,
                "yolo_model_loaded": model_loaded,
                "ocr_enabled": False,
                "database_status": "connected" if collection is not None else "disconnected",
                "stream_id": first_session.stream_id,
                "stream_name": first_session.stream_name,
                "frames_processed": first_session.frames_processed,
                "trains_detected": first_session.trains_detected,
                "frames_discarded": first_session.frames_discarded,
                "detection_rate": first_session.detection_rate
            }
    
    with model_lock:
        model_loaded = model is not None
    return {
        "active": False,
        "capture_active": False,
        "yolo_model_loaded": model_loaded,
        "ocr_enabled": False,
        "database_status": "connected" if collection is not None else "disconnected",
        "stream_id": None,
        "stream_name": None,
        "frames_processed": 0,
        "trains_detected": 0,
        "frames_discarded": 0,
        "detection_rate": 0.0
    }

@app.get("/analysis/sessions")
async def get_active_analysis_sessions():
    """Get all active analysis sessions"""
    global active_analysis_sessions, session_lock
    
    with session_lock:
        sessions = [session.to_dict() for session in active_analysis_sessions.values()]
    
    return {
        "active_sessions": sessions,
        "total_sessions": len(sessions)
    }

@app.get("/analysis/sessions/{stream_id}")
async def get_analysis_session(stream_id: str):
    """Get specific analysis session status"""
    global active_analysis_sessions, session_lock
    
    with session_lock:
        if stream_id not in active_analysis_sessions:
            raise HTTPException(status_code=404, detail="Analysis session not found")
        
        session = active_analysis_sessions[stream_id]
        return session.to_dict()

@app.post("/analysis/stop/{stream_id}")
async def stop_analysis_by_stream(stream_id: str):
    """Stop analysis for specific stream"""
    return await stop_analysis(stream_id)

# === WEBSOCKET ENDPOINT ===

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # Keep connection alive and handle client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    server_host = os.getenv("SERVER_HOST", "127.0.0.1")
    server_port = int(os.getenv("SERVER_PORT", "8000"))
    uvicorn.run(app, host=server_host, port=server_port)