import { useEffect } from 'react';
import { Typography, Box, Alert, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { analysisAPI } from '../../services/api';
import { PlayCircleOutline, CheckCircle } from '@mui/icons-material';

const ControlPanel = () => {
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ['controlPanelStatus'],
    queryFn: analysisAPI.getStatus,
    refetchInterval: 2000, // Refresh every 2 seconds
    retry: 3,
    retryDelay: 1000,
  });

  // Auto-refresh the status
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 2000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <strong>Server connection error:</strong> {error.message}
        <br />
        Make sure the server is running on port 8000.
      </Alert>
    );
  }

  if (isLoading || !status) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Connecting to server...
        </Typography>
      </Box>
    );
  }

  const getStatusColor = () => {
    if (status.capture_active) return 'success.main';
    return 'text.secondary';
  };

  const getStatusText = () => {
    if (status.capture_active) return 'Active Capture';
    return 'Inactive';
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        📊 Control Panel
      </Typography>

      {/* Status Alert */}
      <Alert 
        severity={status.capture_active ? "success" : "info"} 
        sx={{ mb: 3 }}
        icon={status.capture_active ? <PlayCircleOutline /> : <CheckCircle />}
      >
        <strong>Status: {getStatusText()}</strong>
        {status.capture_active && " - Capturing frames every 3 seconds"}
        {!status.capture_active && " - Ready to start capture"}
        <br />
        <Typography variant="body2" color={getStatusColor()}>
          YOLO Model: {status.yolo_model_loaded ? '✅ Loaded' : '❌ Not Available'} |
          OCR: {status.ocr_enabled ? '✅ Enabled' : '❌ Not Available'} |
          Database: {status.database_status === 'connected' ? '✅ Connected' : '❌ Disconnected'}
        </Typography>
      </Alert>
    </Box>
  );
};

export default ControlPanel;
