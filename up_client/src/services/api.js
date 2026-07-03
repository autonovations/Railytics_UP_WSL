import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    if (error.response?.status === 500) {
      throw new Error('Server error. Please check if the server is running.');
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Cannot connect to server. Please check if the server is running on port 8000.');
    }
    throw error;
  }
);



export const getFrames = async (page = 1, limit = 12, streamFilter = '') => {
  try {
    const skip = (page - 1) * limit;
    const params = { limit, skip };
    
    // Solo agregar stream_id si no está vacío
    if (streamFilter !== '' && streamFilter !== null && streamFilter !== undefined) {
      params.stream_id = streamFilter;
    }
    
    const { data } = await api.get('/frames', { params });
    return data;
  } catch (error) {
    console.error('Error getting frames:', error);
    throw error;
  }
};

export const deleteAllFrames = async () => {
  try {
    const { data } = await api.delete('/frames');
    return data;
  } catch (error) {
    console.error('Error deleting frames:', error);
    throw error;
  }
};



export const getFrameImageUrl = (filename) => {
  return `${API_BASE}/frame/${filename}`;
};

export const getFrameThumbnailUrl = (filename) => {
  if (!filename) return null;
  return `${API_BASE}/frame/${filename}`;
};

// Returns a cropped image focused on a detection class (default: Reporting Mark)
export const getFrameCropUrl = (filename, options = {}) => {
  if (!filename) return null;
  const params = new URLSearchParams();
  if (options.class_name) params.set('class_name', options.class_name);
  if (typeof options.index === 'number') params.set('index', `${options.index}`);
  if (typeof options.pad === 'number') params.set('pad', `${options.pad}`);
  if (typeof options.inner === 'number') params.set('inner', `${options.inner}`);
  if (typeof options.scale === 'number') params.set('scale', `${options.scale}`);
  if (typeof options.max_width === 'number') params.set('max_width', `${options.max_width}`);
  if (typeof options.max_height === 'number') params.set('max_height', `${options.max_height}`);
  const query = params.toString();
  return `${API_BASE}/frame/${filename}/crop${query ? `?${query}` : ''}`;
};



export const getRailcarTypes = async () => {
  try {
    const { data } = await api.get('/system/railcar-types');
    return data?.railcar_types || [];
  } catch (error) {
    console.error('Error getting railcar types:', error);
    return [];
  }
};

export const getDetections = async (page = 1, limit = 50) => {
  try {
    const skip = (page - 1) * limit;
    const { data } = await api.get('/detections', { 
      params: { limit, skip } 
    });
    return data;
  } catch (error) {
    console.error('Error getting detections:', error);
    throw error;
  }
};

// === RAILWAY EVENTS API ===

export const getRailwayEvents = async (page = 1, limit = 20, streamFilter = '') => {
  try {
    const skip = (page - 1) * limit;
    const params = { limit, skip };
    if (streamFilter !== '' && streamFilter !== null && streamFilter !== undefined) {
      params.stream_id = streamFilter;
    }
    const { data } = await api.get('/railway-events', { params });
    return data;
  } catch (error) {
    console.error('Error getting railway events:', error);
    throw error;
  }
};

export const getRailwayEvent = async (eventId) => {
  try {
    const { data } = await api.get(`/railway-events/${eventId}`);
    return data;
  } catch (error) {
    console.error('Error getting railway event:', error);
    throw error;
  }
};

// === RAILWAY EVENTS VIDEO ===
export const getRailwayEventVideoUrl = (eventId, options = {}) => {
  const params = new URLSearchParams();
  if (options.fps) params.set('fps', options.fps);
  if (options.regenerate) params.set('regenerate', options.regenerate ? 'true' : 'false');
  const query = params.toString();
  return `${API_BASE}/railway-events/${eventId}/video${query ? `?${query}` : ''}`;
};

export const ensureRailwayEventVideo = async (eventId, options = {}) => {
  try {
    console.log(`Ensuring video for event ${eventId} with options:`, options);
    
    // Call the video endpoint. If it returns 200, it's ready. If it returns 202, it is compiling.
    const response = await api.get(`/railway-events/${eventId}/video`, { 
      params: options,
      timeout: 15000 // 15 seconds to initiate
    });
    
    if (response.status === 200) {
      const url = getRailwayEventVideoUrl(eventId, options);
      console.log(`Video was already cached for event ${eventId}. URL: ${url}`);
      return url;
    }
    
    if (response.status === 202) {
      console.log(`Video compilation started for event ${eventId}. Polling status...`);
      
      // Poll /railway-events/${eventId}/video/status every 2 seconds
      let attempts = 0;
      const maxAttempts = 45; // 90 seconds max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
        try {
          const statusRes = await api.get(`/railway-events/${eventId}/video/status`);
          if (statusRes.data.status === 'completed') {
            const url = getRailwayEventVideoUrl(eventId, options);
            console.log(`Video compiled successfully for event ${eventId}. URL: ${url}`);
            return url;
          } else if (statusRes.data.status === 'failed') {
            throw new Error(`Video compilation failed: ${statusRes.data.error || 'unknown error'}`);
          }
          console.log(`Still compiling... attempt ${attempts}/${maxAttempts}`);
        } catch (pollErr) {
          console.error(`Error polling status:`, pollErr);
        }
      }
      
      throw new Error(`Timeout waiting for video compilation to finish`);
    }
    
    throw new Error(`Failed to generate video. Server responded with status: ${response.status}`);
  } catch (error) {
    console.error('Error ensuring railway event video:', error);
    throw error;
  }
};

export const getRailwayEventFrames = async (eventId, page = 1, limit = 24) => {
  try {
    const skip = (page - 1) * limit;
    const { data } = await api.get(`/railway-events/${eventId}/frames`, {
      params: { limit, skip },
    });
    return data;
  } catch (error) {
    console.error('Error getting railway event frames:', error);
    throw error;
  }
};

// === STREAM MANAGEMENT API ===

export const getStreams = async (activeOnly = true) => {
  try {
    const { data } = await api.get(`/streams?active_only=${activeOnly}`);
    return data;
  } catch (error) {
    console.error('Error getting streams:', error);
    throw error;
  }
};

export const getStream = async (streamId) => {
  try {
    const { data } = await api.get(`/streams/${streamId}`);
    return data;
  } catch (error) {
    console.error('Error getting stream:', error);
    throw error;
  }
};

export const previewStream = async (url) => {
  try {
    const { data } = await api.post('/streams/preview', { url });
    return data;
  } catch (error) {
    console.error('Error previewing stream:', error);
    throw error;
  }
};

export const createStream = async (streamData) => {
  try {
    const { data } = await api.post('/streams', streamData);
    return data;
  } catch (error) {
    console.error('Error creating stream:', error);
    throw error;
  }
};

export const updateStream = async (streamId, streamData) => {
  try {
    const { data } = await api.put(`/streams/${streamId}`, streamData);
    return data;
  } catch (error) {
    console.error('Error updating stream:', error);
    throw error;
  }
};

export const deleteStream = async (streamId) => {
  try {
    const { data } = await api.delete(`/streams/${streamId}`);
    return data;
  } catch (error) {
    console.error('Error deleting stream:', error);
    throw error;
  }
};

// === ANALYSIS API ===

export const startAnalysis = async ({ stream_id, duration_minutes = 0 }) => {
  try {
    const { data } = await api.post('/analysis/start', {
      stream_id,
      duration_minutes,
    });
    return data;
  } catch (error) {
    console.error('Error starting analysis:', error);
    throw error;
  }
};

export const stopAnalysis = async (streamId = null) => {
  try {
    // Backend expects stream_id as query param on POST /analysis/stop
    const config = streamId ? { params: { stream_id: streamId } } : undefined;
    const { data } = await api.post('/analysis/stop', null, config);
    return data;
  } catch (error) {
    console.error('Error stopping analysis:', error);
    throw error;
  }
};

export const getAnalysisStatus = async () => {
  try {
    const { data } = await api.get('/analysis/status');
    return data;
  } catch (error) {
    console.error('Error getting analysis status:', error);
    throw error;
  }
};

// === MULTI-STREAM ANALYSIS API ===

export const getActiveSessions = async () => {
  try {
    const { data } = await api.get('/analysis/sessions');
    return data;
  } catch (error) {
    console.error('Error getting active sessions:', error);
    throw error;
  }
};

export const getAnalysisSession = async (streamId) => {
  try {
    const { data } = await api.get(`/analysis/sessions/${streamId}`);
    return data;
  } catch (error) {
    console.error('Error getting analysis session:', error);
    throw error;
  }
};

export const stopAnalysisStream = async (streamId) => {
  try {
    // Use query param to target specific stream
    const { data } = await api.post('/analysis/stop', null, { params: { stream_id: streamId } });
    return data;
  } catch (error) {
    console.error('Error stopping stream analysis:', error);
    throw error;
  }
};

export const stopAllAnalysis = async () => {
  try {
    const { data } = await api.post('/analysis/stop');
    return data;
  } catch (error) {
    console.error('Error stopping all analysis:', error);
    throw error;
  }
};

// === WEBSOCKET UTILS ===

export const createWebSocketConnection = (onMessage, onError, onClose) => {
  const wsUrl = API_BASE.replace('http', 'ws') + '/ws';
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (onError) onError(error);
  };
  
  ws.onclose = (event) => {
    console.log('WebSocket connection closed:', event);
    if (onClose) onClose(event);
  };
  
  return ws;
};