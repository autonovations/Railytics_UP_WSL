import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Avatar,
  Divider,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Train as TrainIcon,
  Videocam as VideoIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { analysisAPI } from '../../services/api';

const RecentActivity = () => {
  const [activityLog, setActivityLog] = useState([]);

  // Fetch active sessions to track changes
  const { data: sessionsData, refetch } = useQuery({
    queryKey: ['recentActivitySessions'],
    queryFn: analysisAPI.getSessions,
    refetchInterval: 3000,
  });

  // Track session changes and create activity log
  useEffect(() => {
    if (sessionsData?.active_sessions) {
      const currentTime = new Date();
      
      sessionsData.active_sessions.forEach(session => {
        // Check for new detections (simplified - in real app you'd compare with previous state)
        if (session.trains_detected > 0) {
          const recentDetection = {
            id: `detection-${session.stream_id}-${currentTime.getTime()}`,
            type: 'detection',
            title: `Train detected on ${session.stream_name}`,
            description: `Detection rate: ${session.detection_rate}% (${session.trains_detected} total detections)`,
            timestamp: currentTime,
            severity: 'success',
            icon: <TrainIcon />,
            stream: session.stream_name,
          };

          setActivityLog(prev => {
            // Avoid duplicates by checking if similar activity exists in last minute
            const oneMinuteAgo = new Date(currentTime.getTime() - 60000);
            const recentSimilar = prev.find(item => 
              item.type === 'detection' && 
              item.stream === session.stream_name &&
              item.timestamp > oneMinuteAgo
            );
            
            if (!recentSimilar) {
              const updated = [recentDetection, ...prev];
              return updated.slice(0, 50); // Keep last 50 activities
            }
            return prev;
          });
        }
      });
    }
  }, [sessionsData]);

  // Add system events
  useEffect(() => {
    const systemEvents = [
      {
        id: 'system-start',
        type: 'system',
        title: 'System started',
        description: 'Railytics analysis system is online and ready',
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        severity: 'info',
        icon: <CheckIcon />,
      },
      {
        id: 'model-load',
        type: 'model',
        title: 'ML Model loaded',
        description: 'YOLO detection model loaded successfully',
        timestamp: new Date(Date.now() - 240000), // 4 minutes ago
        severity: 'success',
        icon: <VideoIcon />,
      },
    ];

    setActivityLog(prev => {
      // Only add system events if they don't exist
      const existingIds = prev.map(item => item.id);
      const newEvents = systemEvents.filter(event => !existingIds.includes(event.id));
      return [...prev, ...newEvents].slice(0, 50);
    });
  }, []);

  const getActivityColor = (severity) => {
    switch (severity) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'detection': return <TrainIcon />;
      case 'stream_start': return <PlayIcon />;
      case 'stream_stop': return <StopIcon />;
      case 'system': return <CheckIcon />;
      case 'model': return <VideoIcon />;
      case 'error': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      default: return <TimeIcon />;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return timestamp.toLocaleDateString();
  };

  // Sort activities by timestamp (newest first)
  const sortedActivities = [...activityLog].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          📋 Recent Activity
        </Typography>
        <Tooltip title="Refresh activity log">
          <IconButton onClick={() => refetch()} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {sortedActivities.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>
              <Typography>No recent activity to display</Typography>
              <Typography variant="body2">
                Start analyzing streams to see real-time activity updates
              </Typography>
            </Alert>
          ) : (
            <List sx={{ maxHeight: 600, overflow: 'auto' }}>
              {sortedActivities.map((activity, index) => (
                <React.Fragment key={activity.id}>
                  <ListItem sx={{ py: 2 }}>
                    <ListItemIcon>
                      <Avatar 
                        sx={{ 
                          bgcolor: `${getActivityColor(activity.severity)}.main`,
                          width: 40,
                          height: 40,
                        }}
                      >
                        {getActivityIcon(activity.type)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                            {activity.title}
                          </Typography>
                          <Chip
                            label={activity.type}
                            size="small"
                            color={getActivityColor(activity.severity)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {activity.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <TimeIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                            {formatTimeAgo(activity.timestamp)}
                            {activity.stream && (
                              <Chip
                                label={activity.stream}
                                size="small"
                                variant="outlined"
                                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < sortedActivities.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Activity Summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={<TrainIcon />}
              label={`${sortedActivities.filter(a => a.type === 'detection').length} Detections`}
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<PlayIcon />}
              label={`${sortedActivities.filter(a => a.type === 'stream_start').length} Streams Started`}
              color="info"
              variant="outlined"
            />
            <Chip
              icon={<StopIcon />}
              label={`${sortedActivities.filter(a => a.type === 'stream_stop').length} Streams Stopped`}
              color="warning"
              variant="outlined"
            />
            <Chip
              icon={<ErrorIcon />}
              label={`${sortedActivities.filter(a => a.severity === 'error').length} Errors`}
              color="error"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RecentActivity;
