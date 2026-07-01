import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
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
  OpenInNew as OpenInNewIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';

const ImprovedStreamViewer = ({ open, onClose, stream }) => {
  const [fullscreen, setFullscreen] = useState(false);

  if (!stream) {
    return null;
  }

  const handleOpenInNewTab = () => {
    if (stream?.url) {
      window.open(stream.url, '_blank');
    }
  };

  const handleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  // Try to get the best YouTube URL for embedding
  const getStreamUrl = (url) => {
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
      
      // For live streams, use the nocookie domain and enable autoplay
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0&fs=1&playsinline=1`;
      }
      
      return url;
    } catch (e) {
      return url;
    }
  };

  const embedUrl = getStreamUrl(stream.url);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen={fullscreen}
      sx={{
        '& .MuiDialog-paper': {
          width: fullscreen ? '100vw' : '90vw',
          height: fullscreen ? '100vh' : '90vh',
          maxWidth: fullscreen ? '100vw' : '1200px',
          maxHeight: fullscreen ? '100vh' : '800px',
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        pb: 1,
        backgroundColor: 'background.paper'
      }}>
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
          <Tooltip title="Open in YouTube">
            <IconButton onClick={handleOpenInNewTab} size="small">
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            <IconButton onClick={handleFullscreen} size="small">
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ 
        p: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        backgroundColor: '#000'
      }}>
        {/* Stream Info (only show when not fullscreen) */}
        {!fullscreen && stream.youtube_metadata && (
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
        <Box sx={{ 
          flex: 1, 
          position: 'relative', 
          m: fullscreen ? 0 : 2, 
          mt: fullscreen ? 0 : 1,
          backgroundColor: '#000'
        }}>
          {/* Fallback for when iframe fails */}
          <Alert 
            severity="info" 
            sx={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
              width: '80%'
            }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleOpenInNewTab}
                startIcon={<PlayIcon />}
              >
                Watch on YouTube
              </Button>
            }
          >
            <Typography variant="body2">
              <strong>Stream Preview</strong><br/>
              Click "Watch on YouTube" to view the live stream. Some YouTube streams may not be embeddable due to channel settings.
            </Typography>
          </Alert>

          <iframe
            src={embedUrl}
            title={stream.name}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: fullscreen ? '0' : '8px',
              minHeight: fullscreen ? '100vh' : '400px',
              position: 'relative',
              zIndex: 2,
            }}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            frameBorder="0"
            loading="lazy"
          />
        </Box>
      </DialogContent>

      {!fullscreen && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {stream.description && `${stream.description.substring(0, 100)}${stream.description.length > 100 ? '...' : ''}`}
          </Typography>
          <Button onClick={handleOpenInNewTab} variant="outlined" startIcon={<OpenInNewIcon />}>
            Open in YouTube
          </Button>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ImprovedStreamViewer;