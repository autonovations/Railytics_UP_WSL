import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  IconButton,
  Button,
  Tooltip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import {
  Stop as StopIcon,
  Visibility as ViewIcon,
  PlayArrow as PlayIcon,
  Analytics as AnalyticsIcon,
  Train as TrainIcon,
  AccessTime as TimeIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stopAnalysisStream, getStream } from '../../services/api';
import ImprovedStreamViewer from '../StreamViewer/ImprovedStreamViewer';

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const StatusChip = ({ active }) => (
  <Chip
    label={active ? "Running" : "Stopped"}
    color={active ? "success" : "error"}
    size="small"
    icon={active ? <PlayIcon /> : <StopIcon />}
  />
);

const MetricCard = ({ title, value, icon, color = 'primary' }) => (
  <Box display="flex" alignItems="center" gap={1}>
    <Box sx={{ color: `${color}.main` }}>
      {icon}
    </Box>
    <Box>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  </Box>
);

const MultiStreamTable = ({ sessions = [], onRefresh, onViewStream }) => {
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentViewStream, setCurrentViewStream] = useState(null);
  const queryClient = useQueryClient();

  // Stop analysis mutation
  const stopAnalysisMutation = useMutation({
    mutationFn: stopAnalysisStream,
    onSuccess: () => {
      queryClient.invalidateQueries(['activeSessions']);
      queryClient.invalidateQueries(['analysisStatus']);
      setStopDialogOpen(false);
      setSelectedSession(null);
      if (onRefresh) onRefresh();
    },
  });

  const handleStopClick = (session) => {
    setSelectedSession(session);
    setStopDialogOpen(true);
  };

  const handleConfirmStop = () => {
    if (selectedSession) {
      stopAnalysisMutation.mutate(selectedSession.stream_id);
    }
  };

  const handleViewStream = async (session) => {
    try {
      const streamData = await getStream(session.stream_id);
      if (onViewStream) {
        // Use the parent's view stream handler
        onViewStream(streamData);
      } else {
        // Fallback to internal modal
        setCurrentViewStream(streamData);
        setViewerOpen(true);
      }
    } catch (error) {
      console.error('Error loading stream:', error);
    }
  };

  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <AnalyticsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            No Active Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start analysis from the Stream Selection tab to see real-time data here.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          📊 Active Stream Analysis ({sessions.length})
        </Typography>
        <Button
          variant="outlined"
          onClick={onRefresh}
          size="small"
        >
          Refresh
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={1}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#FFAD01' }}>
              <TableCell sx={{ fontWeight: 700, color: 'black', fontSize: 16  }}>Stream</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'black', fontSize: 16  }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'black', fontSize: 16  }}>Runtime</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'black', fontSize: 16  }}>Metrics</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'black', fontSize: 16  }}>Detection Rate</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'black', fontSize: 16  }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((session) => (
              <TableRow 
                key={session.stream_id}
                hover
                sx={{ 
                  '&:hover': { backgroundColor: 'grey.50' },
                  opacity: session.active ? 1 : 0.7 
                }}
              >
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {session.stream_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {session.stream_id.substring(0, 8)}...
                    </Typography>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <StatusChip active={session.active} />
                </TableCell>
                
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {formatDuration(session.runtime_seconds || 0)}
                    </Typography>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <MetricCard
                      title="Frames"
                      value={session.frames_processed?.toLocaleString() || 0}
                      icon={<AnalyticsIcon sx={{ fontSize: 16 }} />}
                      color="primary"
                    />
                    <MetricCard
                      title="Trains"
                      value={session.trains_detected?.toLocaleString() || 0}
                      icon={<TrainIcon sx={{ fontSize: 16 }} />}
                      color="success"
                    />
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <SpeedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {session.detection_rate || 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(session.detection_rate || 0, 100)}
                      color={
                        (session.detection_rate || 0) > 20 ? 'success' : 
                        (session.detection_rate || 0) > 10 ? 'warning' : 'error'
                      }
                      sx={{ width: 80, height: 6, borderRadius: 3 }}
                    />
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Box display="flex" gap={1}>
                    <Tooltip title="View Stream">
                      <IconButton
                        size="small"
                        onClick={() => handleViewStream(session)}
                        color="primary"
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Stop Analysis">
                      <IconButton
                        size="small"
                        onClick={() => handleStopClick(session)}
                        color="error"
                        disabled={!session.active || stopAnalysisMutation.isPending}
                      >
                        <StopIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Stop Confirmation Dialog */}
      <Dialog
        open={stopDialogOpen}
        onClose={() => setStopDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Stop Analysis
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Are you sure you want to stop the analysis for "{selectedSession?.stream_name}"?
            </Typography>
          </Alert>
          {selectedSession && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Current metrics:</strong>
              </Typography>
              <Typography variant="body2">
                • Frames processed: {selectedSession.frames_processed?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2">
                • Trains detected: {selectedSession.trains_detected?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2">
                • Detection rate: {selectedSession.detection_rate || 0}%
              </Typography>
              <Typography variant="body2">
                • Runtime: {formatDuration(selectedSession.runtime_seconds || 0)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setStopDialogOpen(false)}
            disabled={stopAnalysisMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmStop}
            color="error"
            variant="contained"
            disabled={stopAnalysisMutation.isPending}
          >
            Stop Analysis
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stream Viewer Dialog */}
      {currentViewStream && (
        <Dialog
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            {currentViewStream.name}
          </DialogTitle>
          <DialogContent>
            <ImprovedStreamViewer
              stream={currentViewStream}
              onClose={() => setViewerOpen(false)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewerOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default MultiStreamTable;
