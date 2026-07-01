import React, { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Fade, CircularProgress, Typography } from '@mui/material';
import { PlayArrow as PlayIcon, Pause as PauseIcon, VolumeOff as MuteIcon } from '@mui/icons-material';

const YouTubePreview = ({ videoUrl, thumbnail, alt, height = 140, autoPlay = true, isLive = false, sx = {}, priority = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const iframeRef = useRef(null);
  const rootRef = useRef(null);

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
      return;
    }

    // Reset states when videoId changes
    setIsLoading(false);
    setHasError(false);
    setIsPlaying(false);
  }, [videoId]);

  // Listen for autoPlay prop changes to control global playback
  useEffect(() => {
    if (videoId && !hasError) {
      setIsPlaying(autoPlay);
      if (autoPlay) {
        setIsLoading(true);
      }
    }
  }, [autoPlay, videoId, hasError]);

  // IntersectionObserver to lazy-load thumbnails/iframes only when visible
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }
    const node = rootRef.current;
    if (!node || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [priority]);

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (!videoId || hasError) return;

    const next = !isPlaying;
    setIsPlaying(next);
    if (next) {
      setIsLoading(true);
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // If no valid video ID, show thumbnail (lazy-loaded)
  if (!videoId || hasError) {
    return (
      <Box
        ref={rootRef}
        sx={{
          position: 'relative',
          height,
          overflow: 'hidden',
          cursor: 'pointer',
          contentVisibility: 'auto',
          containIntrinsicSize: '256px 144px',
          '&:hover .play-overlay': {
            opacity: 1,
          },
          ...sx,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => videoUrl && window.open(videoUrl, '_blank')}
      >
        {thumbnail && isInView ? (
          <img
            src={`data:image/jpeg;base64,${thumbnail}`}
            alt={alt || 'Video thumbnail'}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={priority ? 'high' : 'auto'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <Box sx={{ width: '100%', height: '100%', backgroundColor: 'grey.200' }} />
        )}
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
          >
            <PlayIcon sx={{ fontSize: 30 }} />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={rootRef}
      sx={{
        position: 'relative',
        height,
        overflow: 'hidden',
        cursor: 'pointer',
        contentVisibility: 'auto',
        containIntrinsicSize: '256px 144px',
        '&:hover .video-controls': {
          opacity: 1,
        },
        ...sx,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Loading indicator for iframe only */}
      {isPlaying && isLoading && (
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
      {!isPlaying && (
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
          {thumbnail && isInView ? (
            <img
              src={`data:image/jpeg;base64,${thumbnail}`}
              alt={alt || 'Video thumbnail'}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchpriority={priority ? 'high' : 'auto'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <Box sx={{ width: '100%', height: '100%', backgroundColor: 'grey.200' }} />
          )}
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

      {/* YouTube iframe - mount only when playing */}
      {isPlaying && (
        <iframe
          ref={iframeRef}
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}?${new URLSearchParams({
            autoplay: autoPlay ? '1' : '0',
            mute: '1',
            controls: '0',
            showinfo: '0',
            rel: '0',
            iv_load_policy: '3',
            modestbranding: '1',
            playsinline: '1',
            start: '0',
          }).toString()}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
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

export default YouTubePreview;