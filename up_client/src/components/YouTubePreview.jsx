import React, { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Fade, CircularProgress, Typography } from '@mui/material';
import { PlayArrow as PlayIcon, Pause as PauseIcon, VolumeOff as MuteIcon } from '@mui/icons-material';

const YouTubePreview = ({ videoUrl, thumbnail, alt, height = 140, autoPlay = true, isLive = false, sx = {}, eager = false }) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  // Extract video ID from YouTube URL
  const getVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;

    // Handle different YouTube URL formats
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getVideoId(videoUrl);

  useEffect(() => {
    if (!videoId) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Reset states when videoId changes
    setIsLoading(true);
    setHasError(false);
    setIsPlaying(autoPlay);
    setShouldLoad(eager);
  }, [videoId, autoPlay, eager]);

  useEffect(() => {
    // Lazy-load iframe when near viewport if not eager
    if (eager || shouldLoad) return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { root: null, rootMargin: '600px 0px', threshold: 0.01 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, shouldLoad]);

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (!videoId || hasError) return;

    if (!shouldLoad) setShouldLoad(true);
    setIsPlaying(!isPlaying);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // If no valid video ID, show thumbnail
  if (!videoId || hasError) {
    return thumbnail ? (
      <Box
        sx={{
          position: 'relative',
          height,
          overflow: 'hidden',
          cursor: 'pointer',
          '&:hover .play-overlay': {
            opacity: 1,
          },
          ...sx,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={`data:image/jpeg;base64,${thumbnail}`}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box
          className="play-overlay"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <IconButton
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 1)',
              },
            }}
            onClick={() => window.open(videoUrl, '_blank')}
          >
            <PlayIcon sx={{ fontSize: 30 }} />
          </IconButton>
        </Box>
      </Box>
    ) : (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.200',
          color: 'grey.500',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'grey.300',
          },
          ...sx,
        }}
        onClick={() => videoUrl && window.open(videoUrl, '_blank')}
      >
        <Box sx={{ textAlign: 'center' }}>
          <PlayIcon sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="caption" display="block">
            Click to open stream
          </Typography>
        </Box>
      </Box>
    );
  }

  const embedSrc = (shouldLoad && videoId)
    ? `https://www.youtube-nocookie.com/embed/${videoId}?${new URLSearchParams({
        autoplay: (isPlaying && autoPlay) ? '1' : '0',
        mute: '1',
        controls: '0',
        showinfo: '0',
        rel: '0',
        iv_load_policy: '3',
        modestbranding: '1',
        playsinline: '1',
        start: '0',
      }).toString()}`
    : undefined;

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        overflow: 'hidden',
        cursor: 'pointer',
        '&:hover .video-controls': {
          opacity: 1,
        },
        ...sx,
      }}
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Loading indicator */}
      {shouldLoad && isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.100',
            zIndex: 2,
          }}
        >
          <CircularProgress size={30} />
        </Box>
      )}

      {/* Thumbnail overlay when not playing */}
      {(!shouldLoad || !isPlaying) && thumbnail && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            cursor: 'pointer',
          }}
          onClick={handlePlayPause}
        >
          <img
            src={`data:image/jpeg;base64,${thumbnail}`}
            alt={alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconButton
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 1)',
                },
              }}
            >
              <PlayIcon sx={{ fontSize: 30 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* YouTube iframe */}
      {shouldLoad && (
        <iframe
          ref={iframeRef}
          width="100%"
          height="100%"
          src={embedSrc}
          title={alt || 'YouTube preview'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            display: isPlaying ? 'block' : 'none',
          }}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      )}

      {/* Video controls overlay */}
      <Fade in={isHovered && isPlaying}>
        <Box
          className="video-controls"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 1,
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <IconButton
            size="small"
            onClick={handlePlayPause}
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
              },
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton
            size="small"
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
              },
            }}
          >
            <MuteIcon />
          </IconButton>
        </Box>
      </Fade>

      {/* Live indicator */}
      {isLive && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'error.main',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}
        >
          LIVE
        </Box>
      )}
    </Box>
  );
};

const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.videoUrl === nextProps.videoUrl &&
    prevProps.thumbnail === nextProps.thumbnail &&
    prevProps.alt === nextProps.alt &&
    prevProps.height === nextProps.height &&
    prevProps.autoPlay === nextProps.autoPlay &&
    prevProps.isLive === nextProps.isLive &&
    prevProps.eager === nextProps.eager &&
    JSON.stringify(prevProps.sx) === JSON.stringify(nextProps.sx)
  );
};

export default React.memo(YouTubePreview, areEqual);