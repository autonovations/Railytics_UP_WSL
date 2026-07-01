import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Button,
  Chip,
  IconButton,
  Dialog,
  Switch,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  FormHelperText,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Visibility as ViewIcon,
  CloudUpload as UploadIcon,
  Image as ImageIcon,
  Preview as PreviewIcon,
  LiveTv as LiveTvIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { streamAPI, analysisAPI } from '../services/api';
import ImprovedStreamViewer from './ImprovedStreamViewer';
import YouTubePreview from './YouTubePreview';

const StreamManager = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStream, setEditingStream] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    custom_thumbnail: null,
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentViewStream, setCurrentViewStream] = useState(null);
  const [globalAutoPlay, setGlobalAutoPlay] = useState(false);
  const fileInputRef = useRef(null);

  const queryClient = useQueryClient();

  // Fetch streams
  const { data: streamsData, isLoading: streamsLoading } = useQuery({
    queryKey: ['streams'],
    queryFn: () => streamAPI.getAllStreams(true),
    refetchInterval: 5000,
  });

  // Fetch analysis status (legacy single) and sessions (multiple)
  const { data: analysisStatus } = useQuery({
    queryKey: ['analysisStatus'],
    queryFn: () => analysisAPI.getStatus(),
    refetchInterval: 2000,
  });

  const { data: analysisSessions } = useQuery({
    queryKey: ['analysisSessions'],
    queryFn: () => analysisAPI.getSessions(),
    refetchInterval: 2000,
  });

  // Create stream mutation
  const createStreamMutation = useMutation({
    mutationFn: streamAPI.createStream,
    onSuccess: () => {
      queryClient.invalidateQueries(['streams']);
      setOpenDialog(false);
      resetForm();
      showSnackbar('Stream created successfully!', 'success');
    },
    onError: (error) => {
      showSnackbar(`Error creating stream: ${error.response?.data?.detail || error.message}`, 'error');
    },
  });

  // Update stream mutation
  const updateStreamMutation = useMutation({
    mutationFn: ({ id, data }) => streamAPI.updateStream(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['streams']);
      setOpenDialog(false);
      resetForm();
      showSnackbar('Stream updated successfully!', 'success');
    },
    onError: (error) => {
      showSnackbar(`Error updating stream: ${error.response?.data?.detail || error.message}`, 'error');
    },
  });

  // Delete stream mutation
  const deleteStreamMutation = useMutation({
    mutationFn: streamAPI.deleteStream,
    onSuccess: () => {
      queryClient.invalidateQueries(['streams']);
      showSnackbar('Stream deleted successfully!', 'success');
    },
    onError: (error) => {
      showSnackbar(`Error deleting stream: ${error.response?.data?.detail || error.message}`, 'error');
    },
  });

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const resetForm = () => {
    setFormData({ name: '', url: '', description: '', custom_thumbnail: null });
    setEditingStream(null);
    setPreviewData(null);
    setThumbnailPreview(null);
  };

  const handleOpenDialog = (stream = null) => {
    if (stream) {
      setEditingStream(stream);
      setFormData({
        name: stream.name || '',
        url: stream.url || '',
        description: stream.description || '',
        custom_thumbnail: null,
      });
      // Set existing thumbnail as preview if available
      if (stream.thumbnail) {
        setThumbnailPreview(`data:image/jpeg;base64,${stream.thumbnail}`);
      }
    } else {
      resetForm();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handlePreviewStream = async () => {
    if (!formData.url.trim()) {
      showSnackbar('Please enter a URL first', 'error');
      return;
    }

    setPreviewLoading(true);
    try {
      const data = await streamAPI.previewStream(formData.url);
      setPreviewData(data);

      // Auto-fill form with metadata
      if (!formData.name && data.title) {
        setFormData(prev => ({ ...prev, name: data.title }));
      }
      if (!formData.description && data.description) {
        setFormData(prev => ({ ...prev, description: data.description.substring(0, 200) }));
      }

      // Set YouTube thumbnail as preview if no custom thumbnail
      if (data.thumbnail && !formData.custom_thumbnail) {
        setThumbnailPreview(`data:image/jpeg;base64,${data.thumbnail}`);
      }

      showSnackbar('Stream metadata loaded successfully!', 'success');
    } catch (error) {
      showSnackbar(`Error previewing stream: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showSnackbar('Please select a valid image file', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showSnackbar('Image file must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setFormData(prev => ({ ...prev, custom_thumbnail: base64 }));
      setThumbnailPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveThumbnail = () => {
    setFormData(prev => ({ ...prev, custom_thumbnail: null }));
    setThumbnailPreview(previewData?.thumbnail ? `data:image/jpeg;base64,${previewData.thumbnail}` : null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      showSnackbar('Name and URL are required!', 'error');
      return;
    }

    if (editingStream) {
      updateStreamMutation.mutate({ id: editingStream.id, data: formData });
    } else {
      createStreamMutation.mutate(formData);
    }
  };

  const handleDelete = (streamId) => {
    if (window.confirm('Are you sure you want to delete this stream?')) {
      deleteStreamMutation.mutate(streamId);
    }
  };

  const handleToggleActive = (stream) => {
    updateStreamMutation.mutate({
      id: stream.id,
      data: { active: !stream.active }
    });
  };

  const handleViewStream = (stream) => {
    setCurrentViewStream(stream);
    setViewerOpen(true);
  };

  const handleToggleGlobalAutoPlay = () => {
    setGlobalAutoPlay(!globalAutoPlay);
    showSnackbar(
      globalAutoPlay ? 'All streams paused' : 'All streams playing',
      'info'
    );
  };

  const isStreamBeingAnalyzed = (streamId) => {
    // Prefer sessions list (supports multiple). Fallback to legacy single status
    const activeIds = new Set(
      (analysisSessions?.active_sessions || []).map((s) => s.stream_id)
    );
    if (activeIds.size > 0) {
      return activeIds.has(streamId);
    }
    return analysisStatus?.active && analysisStatus?.stream_id === streamId;
  };

  const streams = streamsData?.streams || [];
  const sortedStreams = [...streams].sort((a, b) => Number(b.active) - Number(a.active));

  // Separate active and inactive streams
  const activeStreams = sortedStreams.filter(stream => stream.active);
  const inactiveStreams = sortedStreams.filter(stream => !stream.active);

  if (streamsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h4" component="h1">
            Stream Management
          </Typography>
          <Button
            onClick={handleToggleGlobalAutoPlay}
            size="large"
            disableElevation
            startIcon={globalAutoPlay ? <StopIcon /> : <PlayIcon />}
            sx={{
              backgroundColor: globalAutoPlay ? '#ff3d3d' : '#2ecc71',
              color: 'white',
              '&:hover': {
                backgroundColor: globalAutoPlay ? '#ff1a1a' : '#d00542ff',
              },
              minWidth: '120px',
              fontWeight: 'bold',
              textTransform: 'none',
              '&:active': {
                transform: 'scale(0.98)',
              },
              '&.MuiButton-root': {
                backgroundColor: globalAutoPlay ? '#ff3d3d' : '#2ecc71',
                '&:hover': {
                  backgroundColor: globalAutoPlay ? '#ff1a1a' : '#27ae60',
                }
              }
            }}
          >
            {globalAutoPlay ? 'Stop All' : 'Play All'}
          </Button>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          size="large"
        >
          Add New Stream
        </Button>
      </Box>

      {/* Analysis Status Alert */}
      {((analysisSessions?.total_sessions || 0) > 0 || analysisStatus?.active) && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          icon={<PlayIcon />}
        >
          {(analysisSessions?.total_sessions || 0) > 0 ? (
            <>
              <strong>{analysisSessions.total_sessions}</strong> stream(s) currently analyzing.
            </>
          ) : (
            <>Analysis is currently running on stream: <strong>{analysisStatus.stream_name}</strong>{' '}(Frames processed: {analysisStatus.frames_processed}, Trains detected: {analysisStatus.trains_detected})</>
          )}
        </Alert>
      )}

      {/* Active Streams */}
      <Grid container spacing={3}>
        {activeStreams.map((stream, index) => (
          <Grid item xs={12} md={6} lg={3} key={stream.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {/* Stream Preview */}
              <YouTubePreview
                videoUrl={stream.url}
                thumbnail={stream.thumbnail}
                alt={stream.name}
                autoPlay={globalAutoPlay}
                isLive={stream.youtube_metadata?.is_live || false}
                priority={index < 4}
                sx={{
                  width: '100%',
                  aspectRatio: '16/9',
                  height: 'auto'
                }}
              />

              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                    {stream.name}
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Chip
                      label={stream.active ? 'Active' : 'Inactive'}
                      color={stream.active ? 'success' : 'default'}
                      size="small"
                    />
                    {stream.youtube_metadata?.is_live && (
                      <Chip
                        label="LIVE"
                        color="error"
                        size="small"
                        icon={<LiveTvIcon />}
                      />
                    )}
                    {isStreamBeingAnalyzed(stream.id) && (
                      <Chip
                        label="Analyzing"
                        color="primary"
                        size="small"
                        icon={<PlayIcon />}
                      />
                    )}
                  </Box>
                </Box>

                {/* YouTube metadata if available */}
                {stream.youtube_metadata && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                      {stream.youtube_metadata.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stream.youtube_metadata.uploader && `Channel: ${stream.youtube_metadata.uploader}`}
                      {stream.youtube_metadata.view_count > 0 && ` • ${stream.youtube_metadata.view_count.toLocaleString()} views`}
                    </Typography>
                  </Box>
                )}

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {stream.description || 'No description provided'}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Created: {new Date(stream.created_at).toLocaleDateString()}
                </Typography>
              </CardContent>

              <Box sx={{ p: 2, pt: 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                  <Box display="flex" gap={0.5}>
                    <Tooltip title="View Stream">
                      <IconButton
                        size="small"
                        onClick={() => handleViewStream(stream)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Open in YouTube">
                      <IconButton
                        size="small"
                        onClick={() => window.open(stream.url, '_blank')}
                      >
                        <OpenInNewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Stream">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(stream)}
                        disabled={isStreamBeingAnalyzed(stream.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Stream">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(stream.id)}
                        disabled={isStreamBeingAnalyzed(stream.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Button
                    onClick={() => handleToggleActive(stream)}
                    disabled={isStreamBeingAnalyzed(stream.id)}
                    sx={{
                      minWidth: '85px',
                      height: '32px',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: '16px',
                      border: '2px solid',
                      borderColor: stream.active ? '#2ecc71' : '#e74c3c',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      backgroundColor: stream.active ? '#2ecc71' : '#e74c3c',
                      color: 'white',
                      cursor: 'pointer',
                      transform: 'scale(1)',
                      boxShadow: stream.active
                        ? '0 4px 12px rgba(46, 204, 113, 0.3)'
                        : '0 4px 12px rgba(231, 76, 60, 0.3)',
                      '&:hover': {
                        backgroundColor: stream.active ? '#27ae60' : '#c0392b',
                        borderColor: stream.active ? '#27ae60' : '#c0392b',
                        transform: 'scale(1.05)',
                        boxShadow: stream.active
                          ? '0 6px 16px rgba(46, 204, 113, 0.4)'
                          : '0 6px 16px rgba(231, 76, 60, 0.4)',
                      },
                      '&:active': {
                        transform: 'scale(0.95)',
                        transition: 'all 0.1s ease',
                      },
                      '&:disabled': {
                        opacity: 0.6,
                        cursor: 'not-allowed',
                        transform: 'scale(1)',
                        '&:hover': {
                          transform: 'scale(1)',
                        }
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        left: stream.active ? '4px' : 'calc(100% - 26px)',
                        top: '3px',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                        zIndex: 1,
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        right: '0',
                        bottom: '0',
                        background: stream.active
                          ? 'linear-gradient(45deg, #2ecc71, #27ae60)'
                          : 'linear-gradient(45deg, #e74c3c, #c0392b)',
                        borderRadius: '14px',
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        zIndex: 0,
                      },
                      '&:hover::after': {
                        opacity: 1,
                      }
                    }}
                  >
                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      letterSpacing: '1px',
                      position: 'relative',
                      zIndex: 2,
                      transition: 'all 0.3s ease',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                    }}>
                      {stream.active ? 'ON' : 'OFF'}
                    </Box>
                  </Button>
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}

        {streams.length === 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                  No streams available
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first stream to get started with train analysis.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add First Stream
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Inactive Streams Section */}
      {inactiveStreams.length > 0 && (
        <>
          <Box
            sx={{
              mt: 6,
              mb: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            <Divider sx={{ flex: 1 }} />
            <Typography
              variant="h6"
              component="div"
              sx={{
                color: 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <StopIcon fontSize="small" />
              Inactive Streams
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Box>

          <Grid container spacing={3}>
            {inactiveStreams.map((stream, index) => (
              <Grid item xs={12} md={6} lg={3} key={stream.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                  }}
                >
                  <YouTubePreview
                    videoUrl={stream.url}
                    thumbnail={stream.thumbnail}
                    alt={stream.name}
                    autoPlay={globalAutoPlay}
                    isLive={stream.youtube_metadata?.is_live || false}
                    priority={index < 2}
                    sx={{
                      width: '100%',
                      aspectRatio: '16/9',
                      height: 'auto'
                    }}
                  />

                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                        {stream.name}
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Chip
                          label={stream.active ? 'Active' : 'Inactive'}
                          color={stream.active ? 'success' : 'default'}
                          size="small"
                        />
                        {stream.youtube_metadata?.is_live && (
                          <Chip
                            label="LIVE"
                            color="error"
                            size="small"
                            icon={<LiveTvIcon />}
                          />
                        )}
                      </Box>
                    </Box>

                    {stream.youtube_metadata && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                          {stream.youtube_metadata.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stream.youtube_metadata.uploader && `Channel: ${stream.youtube_metadata.uploader}`}
                          {stream.youtube_metadata.view_count > 0 && ` • ${stream.youtube_metadata.view_count.toLocaleString()} views`}
                        </Typography>
                      </Box>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {stream.description || 'No description provided'}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Created: {new Date(stream.created_at).toLocaleDateString()}
                    </Typography>
                  </CardContent>

                  <Box sx={{ p: 2, pt: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title="View Stream">
                          <IconButton
                            size="small"
                            onClick={() => handleViewStream(stream)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open in YouTube">
                          <IconButton
                            size="small"
                            onClick={() => window.open(stream.url, '_blank')}
                          >
                            <OpenInNewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Stream">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(stream)}
                            disabled={isStreamBeingAnalyzed(stream.id)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Stream">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(stream.id)}
                            disabled={isStreamBeingAnalyzed(stream.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Button
                        onClick={() => handleToggleActive(stream)}
                        disabled={isStreamBeingAnalyzed(stream.id)}
                        sx={{
                          minWidth: '85px',
                          height: '32px',
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: '16px',
                          border: '2px solid',
                          borderColor: stream.active ? '#2ecc71' : '#e74c3c',
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          backgroundColor: stream.active ? '#2ecc71' : '#e74c3c',
                          color: 'white',
                          cursor: 'pointer',
                          transform: 'scale(1)',
                          boxShadow: stream.active
                            ? '0 4px 12px rgba(46, 204, 113, 0.3)'
                            : '0 4px 12px rgba(231, 76, 60, 0.3)',
                          '&:hover': {
                            backgroundColor: stream.active ? '#27ae60' : '#c0392b',
                            borderColor: stream.active ? '#27ae60' : '#c0392b',
                            transform: 'scale(1.05)',
                            boxShadow: stream.active
                              ? '0 6px 16px rgba(46, 204, 113, 0.4)'
                              : '0 6px 16px rgba(231, 76, 60, 0.4)',
                          },
                          '&:active': {
                            transform: 'scale(0.95)',
                            transition: 'all 0.1s ease',
                          },
                          '&:disabled': {
                            opacity: 1,
                            cursor: 'not-allowed',
                            transform: 'scale(1)',
                            backgroundColor: '#f1c40f',
                            borderColor: '#f39c12',
                            boxShadow: '0 4px 12px rgba(243, 156, 18, 0.3)',
                            '&:hover': {
                              transform: 'scale(1)',
                              backgroundColor: '#f1c40f',
                              borderColor: '#f39c12',
                            },
                            '&::before': {
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
                            },
                            '&::after': {
                              background: 'linear-gradient(45deg, #f1c40f, #f39c12)',
                              opacity: 0.8,
                            }
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            left: stream.active ? '4px' : 'calc(100% - 26px)',
                            top: '3px',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                            zIndex: 1,
                          },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: '0',
                            left: '0',
                            right: '0',
                            bottom: '0',
                            background: stream.active
                              ? 'linear-gradient(45deg, #2ecc71, #27ae60)'
                              : 'linear-gradient(45deg, #e74c3c, #c0392b)',
                            borderRadius: '14px',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            zIndex: 0,
                          },
                          '&:hover::after': {
                            opacity: 1,
                          }
                        }}
                      >
                        <Box sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          letterSpacing: '1px',
                          position: 'relative',
                          zIndex: 2,
                          transition: 'all 0.3s ease',
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        }}>
                          {stream.active ? 'ON' : 'OFF'}
                        </Box>
                      </Button>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingStream ? 'Edit Stream' : 'Create New Stream'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Stream Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
            required
          />

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              margin="dense"
              label="YouTube URL"
              fullWidth
              variant="outlined"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
              helperText="Enter a valid YouTube live stream URL"
            />
            <Button
              variant="outlined"
              startIcon={<PreviewIcon />}
              onClick={handlePreviewStream}
              disabled={previewLoading || !formData.url.trim()}
              sx={{ minWidth: 'auto', alignSelf: 'flex-start', mt: 1 }}
            >
              {previewLoading ? <CircularProgress size={20} /> : 'Preview'}
            </Button>
          </Box>

          {/* Preview Data Display */}
          {previewData && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Title:</strong> {previewData.title}<br />
                <strong>Channel:</strong> {previewData.uploader}<br />
                <strong>Live:</strong> {previewData.is_live ? 'Yes' : 'No'}<br />
                {previewData.view_count > 0 && (
                  <><strong>Views:</strong> {previewData.view_count.toLocaleString()}</>
                )}
              </Typography>
            </Alert>
          )}

          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            helperText="Optional description for this stream"
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />

          {/* Thumbnail Section */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Stream Thumbnail
          </Typography>

          {/* Thumbnail Preview */}
          {thumbnailPreview && (
            <Box sx={{ mb: 2 }}>
              <Card sx={{ maxWidth: 300 }}>
                <CardMedia
                  component="img"
                  height="200"
                  image={thumbnailPreview}
                  alt="Thumbnail preview"
                  sx={{ objectFit: 'cover' }}
                />
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleRemoveThumbnail}
                  >
                    Remove Thumbnail
                  </Button>
                </Box>
              </Card>
            </Box>
          )}

          {/* Upload Controls */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Upload Custom Thumbnail
            </Button>
            <FormHelperText>
              Upload a custom image or use the YouTube thumbnail automatically.
              Supported formats: JPG, PNG, WebP. Max size: 5MB.
            </FormHelperText>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createStreamMutation.isPending || updateStreamMutation.isPending}
          >
            {editingStream ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Stream Viewer */}
      <ImprovedStreamViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        stream={currentViewStream}
      />
    </Box>
  );
};

export default StreamManager;