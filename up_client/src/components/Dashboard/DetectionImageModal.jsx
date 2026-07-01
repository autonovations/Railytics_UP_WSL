import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon
} from '@mui/icons-material';
import { getFrameImageUrl } from '../../services/api';

const DetectionImageModal = ({ open, onClose, detection }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);

  if (!detection) return null;

  const handleImageLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: '600px',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            🖼️ Detection Image
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {!loading && !error && (
              <>
                <IconButton onClick={handleZoomOut} disabled={zoom <= 0.25}>
                  <ZoomOutIcon />
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: '60px', textAlign: 'center' }}>
                  {Math.round(zoom * 100)}%
                </Typography>
                <IconButton onClick={handleZoomIn} disabled={zoom >= 3}>
                  <ZoomInIcon />
                </IconButton>
                <IconButton onClick={handleResetZoom}>
                  <ResetIcon />
                </IconButton>
              </>
            )}
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Detection Info */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'black', borderRadius: 1 }}>
          <Typography variant="body2" gutterBottom>
            <strong>Location:</strong> {detection.location}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Timestamp:</strong> {formatDateTime(detection.timestamp)}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Reporting Mark:</strong> {detection.reporting_mark}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Confidence:</strong> {(detection.confidence * 100).toFixed(1)}%
          </Typography>
          <Typography variant="body2">
            <strong>Type:</strong> {detection.detection_type}
          </Typography>
        </Box>

        {/* Image Container */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: 400,
            position: 'relative',
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'grey.100'
          }}
        >
          {loading && (
            <Box display="flex" flexDirection="column" alignItems="center">
              <CircularProgress size={40} />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Loading image...
              </Typography>
            </Box>
          )}

          {error && (
            <Box display="flex" flexDirection="column" alignItems="center">
              <Typography variant="h6" color="error" gutterBottom>
                ❌ Error loading image
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The image file may not be available or there was a connection error.
              </Typography>
            </Box>
          )}

          {detection.filename && (
            <Box
              component="img"
              src={getFrameImageUrl(detection.filename)}
              alt={`Detection frame - ${detection.reporting_mark}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-in-out',
                cursor: zoom > 1 ? 'grab' : 'auto',
                display: loading ? 'none' : 'block'
              }}
            />
          )}

          {!detection.filename && !loading && (
            <Box display="flex" flexDirection="column" alignItems="center">
              <Typography variant="h6" color="warning.main" gutterBottom>
                ⚠️ No image available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This detection doesn't have an associated image file.
              </Typography>
            </Box>
          )}
        </Box>

        {!loading && !error && detection.filename && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            File: {detection.filename}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DetectionImageModal;
