import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Error as ErrorIcon 
} from '@mui/icons-material';
import { ensureRailwayEventVideo, getRailwayEventVideoUrl } from '../../services/api';

const EventVideoModal = ({ open, onClose, eventItem }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const videoRef = useRef(null);

  const videoUrl = useMemo(() => {
    if (!eventItem) return '';
    // Add a cache buster with version so the <video> reloads
    const baseUrl = getRailwayEventVideoUrl(eventItem.id);
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}v=${version}&t=${Date.now()}`;
  }, [eventItem, version]);

  // Video event handlers
  const handleVideoLoadStart = () => {
    setVideoLoading(true);
    setVideoError(null);
  };

  const handleVideoLoadedMetadata = () => {
    setVideoLoading(false);
    console.log('Video metadata loaded successfully');
  };

  const handleVideoError = (e) => {
    console.error('Video error:', e);
    console.error('Video error details:', {
      error: e.target.error,
      networkState: e.target.networkState,
      readyState: e.target.readyState,
      currentSrc: e.target.currentSrc
    });
    setVideoLoading(false);
    
    // More specific error messages based on error type
    let errorMessage = 'Failed to load video.';
    if (e.target.error) {
      switch (e.target.error.code) {
        case e.target.error.MEDIA_ERR_ABORTED:
          errorMessage = 'Video loading was aborted.';
          break;
        case e.target.error.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading video.';
          break;
        case e.target.error.MEDIA_ERR_DECODE:
          errorMessage = 'Video format not supported or corrupted.';
          break;
        case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format not supported by browser.';
          break;
        default:
          errorMessage = 'Unknown video error occurred.';
      }
    }
    
    setVideoError(`${errorMessage} The video might be corrupted or still generating.`);
  };

  const handleVideoCanPlay = () => {
    setVideoLoading(false);
    console.log('Video can play');
  };

  const testVideoConnectivity = async () => {
    if (!eventItem) return;
    
    setLoading(true);
    setError(null);
    setVideoError(null);
    
    try {
      console.log(`Testing connectivity for event ${eventItem.id}`);
      
      // Test the video URL directly
      const testUrl = getRailwayEventVideoUrl(eventItem.id, { test: true });
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        console.log('Direct connectivity test passed');
        setVersion(v => v + 1); // Force video refresh
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (e) {
      console.error('Connectivity test failed:', e);
      setError(`Connectivity test failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!open || !eventItem) return;
      setLoading(true);
      setError(null);
      setVideoError(null);
      try {
        console.log(`Ensuring video for event ${eventItem.id}`);
        await ensureRailwayEventVideo(eventItem.id);
        console.log('Video ensured successfully');
      } catch (e) {
        console.error('Failed to prepare video:', e);
        const errorMessage = e.response?.data?.detail || e.message || 'Failed to generate or load the event video.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [open, eventItem]);

  const handleRegenerate = async () => {
    if (!eventItem) return;
    setLoading(true);
    setError(null);
    setVideoError(null);
    try {
      console.log(`Regenerating video for event ${eventItem.id}`);
      await ensureRailwayEventVideo(eventItem.id, { regenerate: true });
      setVersion((v) => v + 1);
      console.log('Video regenerated successfully');
    } catch (e) {
      console.error('Failed to regenerate video:', e);
      const errorMessage = e.response?.data?.detail || e.message || 'Failed to regenerate the event video.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Event Video</Typography>
        <Box>
          <Tooltip title="Regenerate video">
            <span>
              <IconButton onClick={handleRegenerate} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Loading state */}
        {loading && (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={4}>
            <CircularProgress size={40} />
            <Typography sx={{ mt: 2, color: 'text.secondary' }}>
              Preparing video for event {eventItem?.id}...
            </Typography>
            <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
              This may take a few moments for large events
            </Typography>
          </Box>
        )}

        {/* API Error state */}
        {!loading && error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}

        {/* Video section */}
        {!loading && !error && eventItem && (
          <Box sx={{ width: '100%', position: 'relative' }}>
            {/* Video loading overlay */}
            {videoLoading && (
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  zIndex: 2,
                  borderRadius: 1
                }}
              >
                <Box display="flex" flexDirection="column" alignItems="center">
                  <CircularProgress color="primary" />
                  <Typography sx={{ mt: 1, color: 'white' }}>Loading video...</Typography>
                </Box>
              </Box>
            )}

            {/* Video error */}
            {videoError && (
              <Alert severity="warning" sx={{ mb: 2 }} icon={<ErrorIcon />}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {videoError}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      size="small" 
                      onClick={testVideoConnectivity} 
                      variant="outlined"
                      disabled={loading}
                    >
                      Test Connection
                    </Button>
                    <Button 
                      size="small" 
                      onClick={handleRegenerate} 
                      startIcon={<RefreshIcon />}
                      disabled={loading}
                    >
                      Regenerate
                    </Button>
                    {videoUrl && (
                      <Button 
                        size="small" 
                        onClick={() => window.open(videoUrl, '_blank')}
                        variant="text"
                      >
                        Open Direct
                      </Button>
                    )}
                  </Box>
                </Box>
              </Alert>
            )}

            {/* Video player */}
            <Box sx={{ 
              width: '100%', 
              backgroundColor: '#000', 
              borderRadius: 1, 
              overflow: 'hidden',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    backgroundColor: '#000',
                    maxHeight: '60vh'
                  }}
                  controls
                  preload="metadata"
                  crossOrigin="anonymous"
                  playsInline
                  muted={false}
                  onLoadStart={handleVideoLoadStart}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onError={handleVideoError}
                  onCanPlay={handleVideoCanPlay}
                  onLoadedData={() => console.log('Video data loaded')}
                  onProgress={() => console.log('Video progress')}
                >
                  Your browser does not support the video tag.
                  <source src={videoUrl} type="video/mp4" />
                </video>
              ) : (
                <Box sx={{ color: 'text.secondary', p: 4, textAlign: 'center' }}>
                  <PlayIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                  <Typography>No video available</Typography>
                </Box>
              )}
            </Box>

            {/* Video info */}
            {eventItem && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Event ID:</strong> {eventItem.id}
                </Typography>
                {eventItem.start_time && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Start:</strong> {new Date(eventItem.start_time).toLocaleString()}
                  </Typography>
                )}
                {eventItem.end_time && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>End:</strong> {new Date(eventItem.end_time).toLocaleString()}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Video URL: {videoUrl}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Box sx={{ display: 'flex', gap: 1, width: '100%', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {eventItem && `Event: ${eventItem.id}`}
          </Typography>
          
          {videoUrl && (
            <Button 
              size="small" 
              onClick={() => window.open(videoUrl, '_blank')}
              variant="text"
            >
              Open in New Tab
            </Button>
          )}
          
          <Button 
            onClick={handleRegenerate} 
            disabled={loading}
            startIcon={<RefreshIcon />}
            variant="outlined"
            size="small"
          >
            Regenerate
          </Button>
          
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default EventVideoModal;
