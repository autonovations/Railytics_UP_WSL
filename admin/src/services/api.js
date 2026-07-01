import axios from 'axios';

const API_URL = 'http://localhost:8000';

// System API
export const getSystemInfo = async () => {
  const response = await axios.get(`${API_URL}/system/device-info`);
  return response.data;
};

export const getModelInfo = async () => {
  const response = await axios.get(`${API_URL}/model/info`);
  return response.data;
};

export const getSerialsStats = async () => {
  const response = await axios.get(`${API_URL}/serials/stats`);
  return response.data;
};

// Stream API functions
export const streamAPI = {
  getAllStreams: async (includeInactive = false) => {
    const response = await axios.get(`${API_URL}/streams`, {
      params: { active_only: !includeInactive }
    });
    return response.data;
  },

  createStream: async (streamData) => {
    const response = await axios.post(`${API_URL}/streams`, streamData);
    return response.data;
  },

  updateStream: async (id, streamData) => {
    const response = await axios.put(`${API_URL}/streams/${id}`, streamData);
    return response.data;
  },

  deleteStream: async (id) => {
    const response = await axios.delete(`${API_URL}/streams/${id}`);
    return response.data;
  },

  previewStream: async (url) => {
    const response = await axios.post(`${API_URL}/streams/preview`, { url });
    return response.data;
  }
};

// Analysis API functions
export const analysisAPI = {
  getStatus: async () => {
    const response = await axios.get(`${API_URL}/analysis/status`);
    return response.data;
  },

  // Get all active analysis sessions (supports multiple concurrent streams)
  getSessions: async () => {
    const response = await axios.get(`${API_URL}/analysis/sessions`);
    return response.data;
  },

  startAnalysis: async (streamId) => {
    const response = await axios.post(`${API_URL}/analysis/start/${streamId}`);
    return response.data;
  },

  stopAnalysis: async (sessionId) => {
    const response = await axios.post(`${API_URL}/analysis/stop/${sessionId}`);
    return response.data;
  }
};