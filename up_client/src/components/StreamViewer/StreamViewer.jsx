import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';

const StreamViewer = ({ open, onClose, stream }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (open && stream) {
      setIsLoading(true);
      setError(null);
    }
  }, [open, stream]);

  const handleVideoLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setError('Failed to load stream. The stream might be offline or the URL is invalid.');
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    const element = dialogRef.current;
    if (!isFullscreen) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  const handleOpenInNewTab = () => {
    if (stream?.url) {
      window.open(stream.url, '_blank');
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  if (!stream) {
    return null;
  }

  // Try to convert YouTube URL to embeddable format
  const getEmbedUrl = (url) => {
    try {
      // Handle various YouTube URL formats
      let videoId = null;
      
      if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search);
        videoId = urlParams.get('v');
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('youtube.com/embed/')[1].split('?')[0];
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1`;
      }
      
      return url;
    } catch (e) {
      return url;
    }
  };

  const embedUrl = getEmbedUrl(stream.url);
  const isYouTubeEmbed = embedUrl.includes('youtube.com/embed');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      ref={dialogRef}
      sx={{
        '& .MuiDialog-paper': {
          height: isFullscreen ? '100vh' : '80vh',
          maxHeight: isFullscreen ? '100vh' : '80vh',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span">
            {stream.name}
          </Typography>
          {stream.youtube_metadata?.is_live && (
            <Chip 
              label="LIVE" 
              color="error" 
              size="small" 
              sx={{ ml: 2 }}
            />
          )}
        </Box>
        <Box>
          <Tooltip title="Open in New Tab">
            <IconButton onClick={handleOpenInNewTab} size="small">
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            <IconButton onClick={handleFullscreen} size="small">
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Stream Info */}
        {stream.youtube_metadata && (
          <Card sx={{ m: 2, mb: 1 }}>
            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
              <Box display="flex" alignItems="center" gap={2}>
                {stream.thumbnail && (
                  <Box
                    component="img"
                    src={`data:image/jpeg;base64,${stream.thumbnail}`}
                    alt="Stream thumbnail"
                    sx={{ 
                      width: 60, 
                      height: 45, 
                      borderRadius: 1,
                      objectFit: 'cover'
                    }}
                  />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {stream.youtube_metadata.title || stream.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stream.youtube_metadata.uploader && `Channel: ${stream.youtube_metadata.uploader}`}
                    {stream.youtube_metadata.view_count > 0 && ` • ${stream.youtube_metadata.view_count.toLocaleString()} views`}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Video Player */}
        <Box sx={{ flex: 1, position: 'relative', m: 2, mt: 1 }}>
          {isLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
              }}
            >
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
                Loading stream...
              </Typography>
            </Box>
          )}

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
                width: '80%'
              }}
              action={
                <Button color="inherit" size="small" onClick={handleOpenInNewTab}>
                  Open in YouTube
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {isYouTubeEmbed ? (
            <iframe
              ref={videoRef}
              src={embedUrl}
              title={stream.name}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '8px',
                minHeight: '400px',
              }}
              allowFullScreen
              onLoad={handleVideoLoad}
              onError={handleVideoError}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          ) : (
            <video
              ref={videoRef}
              src={embedUrl}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '8px',
                minHeight: '400px',
                backgroundColor: '#000',
              }}
              controls
              autoPlay
              muted={isMuted}
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {stream.description && `${stream.description.substring(0, 100)}${stream.description.length > 100 ? '...' : ''}`}
        </Typography>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StreamViewer;