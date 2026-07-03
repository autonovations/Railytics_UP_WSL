import sys
import os
import numpy as np

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    print("Importing main...")
    import main
    
    print("Model instance:", main.model)
    print("DEVICE_CONFIG:", main.DEVICE_CONFIG)
    
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    print("Running detect_trains...")
    has_trains, detections, annotated = main.detect_trains(frame)
    
    print("SUCCESS!")
    print(f"has_trains: {has_trains}")
    print(f"detections: {detections}")
    print(f"annotated shape: {annotated.shape}")
    
except Exception as e:
    print("FAILED during execution:")
    import traceback
    traceback.print_exc()
