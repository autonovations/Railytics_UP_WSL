import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Visibility as ViewIcon,
  Schedule as TimeIcon,
  LiveTv as LiveTvIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStreams, startAnalysis, stopAnalysis, stopAnalysisStream, stopAllAnalysis, getAnalysisStatus, getActiveSessions } from '../../services/api';
import ImprovedStreamViewer from '../StreamViewer/ImprovedStreamViewer';
import YouTubePreview from '../YouTubePreview';

const StreamSelection = () => {
  const [selectedStream, setSelectedStream] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [duration, setDuration] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentViewStream, setCurrentViewStream] = useState(null);
  const [loadingModalOpen, setLoadingModalOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [bulkAction, setBulkAction] = useState(null); // 'start' | 'stop' | null
  const [bulkTargetIds, setBulkTargetIds] = useState([]);
  const queryClient = useQueryClient();

  // Fetch available streams
  const { data: streamsData, isLoading: streamsLoading } = useQuery({
    queryKey: ['streams'],
    queryFn: () => getStreams(true), // Only active streams
    refetchInterval: 10000,
  });

  // Fetch analysis status
  const { data: analysisStatus } = useQuery({
    queryKey: ['analysisStatus'],
    queryFn: getAnalysisStatus,
    refetchInterval: loadingModalOpen ? 500 : 3000,
  });

  // Fetch active sessions for multi-stream support
  const { data: activeSessions } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: getActiveSessions,
    refetchInterval: loadingModalOpen ? 500 : 3000,
  });

  // Start analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: startAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries(['analysisStatus']);
      queryClient.invalidateQueries(['activeSessions']);
      setOpenDialog(false);
      setSelectedStream(null);
    },
  });

  // Stop individual stream analysis mutation
  const stopStreamAnalysisMutation = useMutation({
    mutationFn: stopAnalysisStream,
    onSuccess: () => {
      queryClient.invalidateQueries(['analysisStatus']);
      queryClient.invalidateQueries(['activeSessions']);
    },
  });

  // Stop all analysis mutation
  const stopAllAnalysisMutation = useMutation({
    mutationFn: stopAllAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries(['analysisStatus']);
      queryClient.invalidateQueries(['activeSessions']);
    },
    onError: () => {
      setLoadingModalOpen(false);
      setLoadingMessage('');
    },
  });

  // Start all analysis mutation (batch)
  const startAllAnalysisBatchMutation = useMutation({
    mutationFn: async ({ streamIds, duration }) => {
      await Promise.all(
        streamIds.map((id) =>
          startAnalysis({ stream_id: id, duration_minutes: duration })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['analysisStatus']);
      queryClient.invalidateQueries(['activeSessions']);
    },
    onError: () => {
      setLoadingModalOpen(false);
      setLoadingMessage('');
    },
  });

  const handleStartAnalysis = (stream) => {
    setSelectedStream(stream);
    setOpenDialog(true);
  };

  const handleConfirmStart = () => {
    if (!selectedStream) return;

    startAnalysisMutation.mutate({
      stream_id: selectedStream.id,
      duration_minutes: duration,
    });
  };

  const handleStopAnalysis = (streamId) => {
    stopStreamAnalysisMutation.mutate(streamId);
  };


  const handleViewStream = (stream) => {
    setCurrentViewStream(stream);
    setViewerOpen(true);
  };

  const streams = streamsData?.streams || [];
  const activeSessionsMap = {};

  // Create a map of active sessions for quick lookup
  if (activeSessions?.active_sessions) {
    activeSessions.active_sessions.forEach(session => {
      activeSessionsMap[session.stream_id] = session;
    });
  }

  // Helper function to check if stream is being analyzed
  const isStreamBeingAnalyzed = (streamId) => {
    return activeSessionsMap[streamId]?.active || (analysisStatus?.active && analysisStatus?.stream_id === streamId);
  };

  // Any analyzing state across all sessions
  const anyAnalyzing = (activeSessions?.active_sessions?.length || 0) > 0 || !!analysisStatus?.active;

  // Start all inactive streams
  const handleStartAllAnalysis = () => {
    const targetStreamIds = streams
      .filter((s) => !isStreamBeingAnalyzed(s.id))
      .map((s) => s.id);
    if (targetStreamIds.length === 0) {
      return;
    }
    setBulkTargetIds(targetStreamIds);
    setBulkAction('start');
    setLoadingMessage(`Starting analysis for ${targetStreamIds.length} streams...`);
    setLoadingModalOpen(true);
    startAllAnalysisBatchMutation.mutate({ streamIds: targetStreamIds, duration: 0 });
  };

  // Stop all active streams
  const handleStopAllAnalysis = () => {
    const idsToStop = (activeSessions?.active_sessions || []).map((s) => s.stream_id);
    if (idsToStop.length === 0) {
      return;
    }
    setBulkTargetIds(idsToStop);
    setBulkAction('stop');
    setLoadingMessage('Stopping all analysis sessions...');
    setLoadingModalOpen(true);
    stopAllAnalysisMutation.mutate();
  };

  // Keep loading modal open until confirmation via activeSessions
  useEffect(() => {
    if (!loadingModalOpen) return;
    if (!bulkAction) return;

    const totalTargets = bulkTargetIds.length;
    const sessionsById = {};
    (activeSessions?.active_sessions || []).forEach((s) => {
      sessionsById[s.stream_id] = s;
    });

    if (bulkAction === 'start') {
      const startedCount = bulkTargetIds.filter((id) => sessionsById[id]?.active).length;
      // Update progress message
      if (totalTargets > 0) {
        setLoadingMessage(`Starting analysis ${startedCount}/${totalTargets} streams...`);
      }
      if (totalTargets > 0 && startedCount === totalTargets) {
        // All targeted streams are active
        setLoadingModalOpen(false);
        setLoadingMessage('');
        setBulkAction(null);
        setBulkTargetIds([]);
        // Force an immediate refresh so UI reflects analyzing state right away
        queryClient.invalidateQueries(['activeSessions']);
        queryClient.invalidateQueries(['streams']);
        queryClient.invalidateQueries(['analysisStatus']);
      }
    }

    if (bulkAction === 'stop') {
      // When stopping, close when no targets remain active
      const remainingActive = bulkTargetIds.filter((id) => sessionsById[id]?.active).length;
      setLoadingMessage(
        remainingActive > 0
          ? `Stopping analysis, remaining ${remainingActive} stream(s)...`
          : 'All analysis sessions stopped'
      );
      if (remainingActive === 0) {
        setLoadingModalOpen(false);
        setLoadingMessage('');
        setBulkAction(null);
        setBulkTargetIds([]);
        // Force refresh to reflect stopped state immediately
        queryClient.invalidateQueries(['activeSessions']);
        queryClient.invalidateQueries(['streams']);
        queryClient.invalidateQueries(['analysisStatus']);
      }
    }
  }, [loadingModalOpen, bulkAction, bulkTargetIds, activeSessions, queryClient]);

  if (streamsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  // Choose how many to eager-load (first row)
  const eagerCount = 3; // matches md: 3 columns

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>

        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayIcon />}
            onClick={handleStartAllAnalysis}
            disabled={
              loadingModalOpen ||
              startAllAnalysisBatchMutation.isPending ||
              streams.filter((s) => !isStreamBeingAnalyzed(s.id)).length === 0
            }
            size="small"
          >
            Start All
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
            onClick={handleStopAllAnalysis}
            disabled={
              loadingModalOpen ||
              stopAllAnalysisMutation.isPending ||
              (activeSessions?.active_sessions?.length || 0) === 0
            }
            size="small"
          >
            Stop All
          </Button>
        </Box>
      </Box>

      {/* Current Analysis Status */}
      {activeSessions?.active_sessions?.length > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            🔄 {activeSessions.active_sessions.length} Analysis Session(s) in Progress
          </Typography>
          <Typography variant="body2">
            {activeSessions.active_sessions.map((session, index) => (
              <span key={session.stream_id}>
                <strong>{session.stream_name}:</strong> {session.frames_processed} frames, {session.trains_detected} trains ({session.detection_rate}%)
                {index < activeSessions.active_sessions.length - 1 ? ' | ' : ''}
              </span>
            ))}
          </Typography>
        </Alert>
      )}

      {/* Available Streams */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        {streams.map((stream, index) => (
          <Box key={stream.id} sx={{ display: 'flex' }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                // Keep all cards visually active regardless of analysis state
                opacity: 1,
                width: '100%',
              }}
            >
              {/* Stream Preview */}
              <YouTubePreview
                videoUrl={stream.url}
                thumbnail={stream.thumbnail}
                alt={stream.name}
                autoPlay={true}
                isLive={stream.youtube_metadata?.is_live || false}
                sx={{
                  width: '100%',
                  aspectRatio: '16/9',
                  height: 'auto'
                }}
                eager={index < eagerCount}
              />

              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                    {stream.name}
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Chip
                      label="Active"
                      color="success"
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
                        color="warning"
                        size="small"
                        icon={<PlayIcon />}
                      />
                    )}
                  </Box>
                </Box>

                {/* YouTube metadata if available */}
                {stream.youtube_metadata && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
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
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => handleViewStream(stream)}
                  >
                    Watch Stream
                  </Button>

                  {isStreamBeingAnalyzed(stream.id) ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<StopIcon />}
                      onClick={() => handleStopAnalysis(stream.id)}
                      disabled={stopStreamAnalysisMutation.isPending}
                      color="error"
                      fullWidth
                    >
                      Stop Analysis
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlayIcon />}
                      onClick={() => handleStartAnalysis(stream)}
                      disabled={startAnalysisMutation.isPending}
                      fullWidth
                    >
                      Start Analysis
                    </Button>
                  )}
                </Box>
              </Box>
            </Card>
          </Box>
        ))}

        {streams.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                  No streams available
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  No active streams found. Contact the administrator to add streams for analysis.
                </Typography>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Note:</strong> Streams must be created and activated by administrators before they can be used for analysis.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>

      {/* Start Analysis Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Start Analysis - {selectedStream?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure the analysis parameters for this stream. Multiple streams can be analyzed simultaneously.
          </Typography>

          {activeSessions?.active_sessions?.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Note:</strong> You currently have {activeSessions.active_sessions.length} stream(s) being analyzed.
                This will start an additional analysis session.
              </Typography>
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Duration</InputLabel>
            <Select
              value={duration}
              label="Duration"
              onChange={(e) => setDuration(e.target.value)}
            >
              <MenuItem value={0}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TimeIcon fontSize="small" />
                  Continuous (until stopped manually)
                </Box>
              </MenuItem>
              <MenuItem value={30}>30 minutes</MenuItem>
              <MenuItem value={60}>1 hour</MenuItem>
              <MenuItem value={180}>3 hours</MenuItem>
              <MenuItem value={360}>6 hours</MenuItem>
              <MenuItem value={720}>12 hours</MenuItem>
              <MenuItem value={1440}>24 hours</MenuItem>
            </Select>
          </FormControl>

          <Alert severity="info">
            <Typography variant="body2">
              <strong>Analysis Configuration:</strong><br />
              • Captures frames every 3 seconds<br />
              • Only frames with detected trains are saved<br />
              • Serial numbers are automatically extracted<br />
              • Real-time updates will be available during analysis
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmStart}
            variant="contained"
            startIcon={<PlayIcon />}
            disabled={startAnalysisMutation.isPending}
          >
            {startAnalysisMutation.isPending ? 'Starting...' : 'Start Analysis'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stream Viewer */}
      <ImprovedStreamViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        stream={currentViewStream}
      />

      {/* Loading Modal for Batch Operations */}
      <Dialog
        open={loadingModalOpen}
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 300,
          },
        }}
      >
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            Processing...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {loadingMessage}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Please wait, this may take a few moments
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default StreamSelection;