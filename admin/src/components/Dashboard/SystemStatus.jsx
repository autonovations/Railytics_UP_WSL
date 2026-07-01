import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  CloudQueue as CloudIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { getSystemInfo, getModelInfo, getSerialsStats, analysisAPI } from '../../services/api';

const SystemStatus = () => {
  // Fetch system device info
  const { data: systemInfo, isLoading: systemLoading, error: systemError } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: getSystemInfo,
    refetchInterval: 30000, // Less frequent updates for system info
  });

  // Fetch model info
  const { data: modelInfo, isLoading: modelLoading } = useQuery({
    queryKey: ['modelInfo'],
    queryFn: getModelInfo,
    refetchInterval: 30000,
  });

  // Fetch analysis status for database connectivity
  const { data: analysisStatus } = useQuery({
    queryKey: ['analysisStatusSystem'],
    queryFn: analysisAPI.getStatus,
    refetchInterval: 5000,
  });

  // Fetch serials stats
  const { data: serialsStats } = useQuery({
    queryKey: ['serialsStats'],
    queryFn: getSerialsStats,
    refetchInterval: 10000,
  });

  const isLoading = systemLoading || modelLoading;
  const error = systemError;

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">System Status</Typography>
          <Typography>Loading system information...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            <Typography variant="h6">System Status Unavailable</Typography>
            <Typography>Unable to fetch system status: {error.message}</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status) => {
    if (status === 'success' || status === 'connected' || status === true) return 'success';
    if (status === 'error' || status === 'failed' || status === false) return 'error';
    if (status === 'warning' || status === 'degraded') return 'warning';
    return 'success'; // Default to success for loaded models, etc.
  };

  const getStatusIcon = (status) => {
    if (status === 'success' || status === 'connected' || status === true) return <CheckIcon />;
    if (status === 'error' || status === 'failed' || status === false) return <ErrorIcon />;
    if (status === 'warning' || status === 'degraded') return <WarningIcon />;
    return <CheckIcon />; // Default to success
  };

  // Determine database status based on analysis endpoint response
  const databaseStatus = analysisStatus !== undefined ? 'connected' : 'error';
  const modelStatus = modelInfo?.status || 'unknown';

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
        🖥️ System Status
      </Typography>

      <Grid container spacing={3}>
        {/* Overall System Health */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Health Overview
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <ComputerIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Server Status"
                    secondary={
                      <Chip
                        icon={<CheckIcon />}
                        label="Running"
                        color="success"
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <Divider />
                
                <ListItem>
                  <ListItemIcon>
                    <StorageIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Database"
                    secondary={
                      <Chip
                        icon={getStatusIcon(databaseStatus)}
                        label={databaseStatus === 'connected' ? 'Connected' : 'Disconnected'}
                        color={getStatusColor(databaseStatus)}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <Divider />

                <ListItem>
                  <ListItemIcon>
                    <CloudIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="ML Model"
                    secondary={
                      <Chip
                        icon={getStatusIcon(modelStatus)}
                        label={modelStatus === 'success' ? 'Loaded' : 'Error'}
                        color={getStatusColor(modelStatus)}
                        size="small"
                      />
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CloudIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Device"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {systemInfo?.device_info?.device || 'CPU'}
                        </Typography>
                        <Chip
                          label="Active"
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
                <Divider />

                <ListItem>
                  <ListItemIcon>
                    <SpeedIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Model Labels"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {modelInfo?.labels_count || 0} classes
                        </Typography>
                        <Chip
                          label="Loaded"
                          color="info"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
                <Divider />

                <ListItem>
                  <ListItemIcon>
                    <StorageIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Total Processed"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {serialsStats?.total_frames_with_trains || 0} frames
                        </Typography>
                        <Chip
                          label="Tracked"
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Model Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                🤖 Model Information
                <Chip 
                  label={modelInfo?.path ? modelInfo.path.split('/').pop() || modelInfo.path.split('\\').pop() : 'Unknown'} 
                  color="primary" 
                  size="small" 
                  variant="outlined" 
                />
              </Typography>
              
              <Grid container spacing={3} sx={{ mt: 1 }}>
                {/* Model Path and Basic Info */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        📁 Model Details
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText
                            primary="Model Path"
                            secondary={
                              <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                {modelInfo?.path || 'Not available'}
                              </Typography>
                            }
                          />
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText
                            primary="Processing Device"
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                  {systemInfo?.device_info?.device || modelInfo?.device || 'CPU'}
                                </Typography>
                                <Chip
                                  label={systemInfo?.device_info?.device === 'cuda' ? 'GPU' : 'CPU'}
                                  color={systemInfo?.device_info?.device === 'cuda' ? 'success' : 'info'}
                                  size="small"
                                />
                              </Box>
                            }
                          />
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText
                            primary="Total Classes"
                            secondary={
                              <Typography variant="h6" color="primary">
                                {modelInfo?.labels_count || 0} classes
                              </Typography>
                            }
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Target Classes */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        🎯 Target Classes (Detection Focus)
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Classes currently being detected:
                        </Typography>
                      </Box>
                      {modelInfo?.target_class_names?.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {modelInfo.target_class_names.map((className, index) => (
                            <Chip
                              key={index}
                              label={`${modelInfo.target_class_ids[index]}: ${className}`}
                              color="success"
                              variant="filled"
                              size="small"
                              sx={{ fontFamily: 'monospace' }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          No target classes configured
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* All Available Classes */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        📋 All Available Classes
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Complete list of classes this model can detect:
                      </Typography>
                      {modelInfo?.labels && Object.keys(modelInfo.labels).length > 0 ? (
                        <Box sx={{ 
                          maxHeight: 200, 
                          overflow: 'auto', 
                          border: '1px solid', 
                          borderColor: 'divider', 
                          borderRadius: 1, 
                          p: 1,
                          backgroundColor: '#f8f9fa'
                        }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.entries(modelInfo.labels).map(([id, label]) => {
                              const isTarget = modelInfo?.target_class_ids?.includes(parseInt(id));
                              return (
                                <Chip
                                  key={id}
                                  label={`${id}: ${label}`}
                                  color={isTarget ? 'success' : 'default'}
                                  variant={isTarget ? 'filled' : 'outlined'}
                                  size="small"
                                  sx={{ 
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                    backgroundColor: isTarget ? undefined : '#ffffff',
                                    color: isTarget ? '#ffffff' : '#1a1a1a',
                                    borderColor: '#e0e0e0',
                                    '&:hover': {
                                      backgroundColor: isTarget ? undefined : '#f5f5f5',
                                    },
                                    ...(isTarget && { 
                                      fontWeight: 'bold',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                                    })
                                  }}
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      ) : (
                        <Alert severity="info">
                          Model labels not available
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* System Statistics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 System Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {modelInfo?.target_class_names?.length || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Target Classes
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {systemInfo?.device_info?.device || 'CPU'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Processing Device
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {serialsStats?.unique_serials?.length || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Unique Serials
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {serialsStats?.total_frames_with_trains || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Frames with Trains
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SystemStatus;
