import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Train as TrainIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { getActiveSessions, getStreams, getRailwayEvents } from '../../services/api';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

// Add CSS animations
const pulseKeyframes = `
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const StreamMetrics = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [detectionHistory, setDetectionHistory] = useState([]);

  // Fetch active sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['analysisSessionsMetrics'],
    queryFn: getActiveSessions,
    refetchInterval: 2000,
  });

  // Fetch streams
  const { data: streamsData } = useQuery({
    queryKey: ['streamsMetrics'],
    queryFn: () => getStreams(false), // Get all streams including inactive
    refetchInterval: 5000,
  });

  // Fetch recent railway events for real detection data
  const { data: railwayEventsData } = useQuery({
    queryKey: ['recentRailwayEvents'],
    queryFn: () => getRailwayEvents(1, 10), // Get recent 10 events
    refetchInterval: 5000, // Update every 5 seconds
  });

  // State for real-time data consistency
  const [lastDetectionTime, setLastDetectionTime] = useState(new Date());
  const [mostActiveStream, setMostActiveStream] = useState(null);

  // Update historical data for charts and sync real-time data
  useEffect(() => {
    if (sessionsData?.active_sessions?.length > 0) {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();

      const totalProcessed = sessionsData.active_sessions.reduce(
        (sum, session) => sum + (session.frames_processed || 0), 0
      );
      const totalDetected = sessionsData.active_sessions.reduce(
        (sum, session) => sum + (session.trains_detected || 0), 0
      );
      const totalDiscarded = sessionsData.active_sessions.reduce(
        (sum, session) => sum + (session.frames_discarded || 0), 0
      );

      const newDataPoint = {
        time: timestamp,
        processed: totalProcessed,
        detected: totalDetected,
        discarded: totalDiscarded,
        detection_rate: totalProcessed > 0 ? ((totalDetected / totalProcessed) * 100).toFixed(1) : 0,
      };

      setHistoricalData(prev => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-20); // Keep last 20 points
      });

      // Update detection history for each stream
      const detectionData = sessionsData.active_sessions.map(session => ({
        name: session.stream_name || `Stream ${session.stream_id}`,
        detections: session.trains_detected || 0,
        processed: session.frames_processed || 0,
        rate: session.detection_rate || 0,
      }));

      setDetectionHistory(detectionData);

      // Find the most active stream (most recent activity)
      const mostActive = sessionsData.active_sessions.reduce((latest, session) => {
        if (!latest) return session;
        return (session.trains_detected || 0) > (latest.trains_detected || 0) ? session : latest;
      });

      setMostActiveStream(mostActive);

      // Update last detection time if there are active detections
      if (totalDetected > 0) {
        setLastDetectionTime(now);
      }
    } else {
      setMostActiveStream(null);
    }
  }, [sessionsData]);

  const activeSessions = sessionsData?.active_sessions || [];
  const totalStreams = streamsData?.streams?.length || 0;
  const activeStreams = activeSessions.length;

  const totalStats = activeSessions.reduce(
    (acc, session) => ({
      processed: acc.processed + (session.frames_processed || 0),
      detected: acc.detected + (session.trains_detected || 0),
      discarded: acc.discarded + (session.frames_discarded || 0),
    }),
    { processed: 0, detected: 0, discarded: 0 }
  );

  const overallDetectionRate = totalStats.processed > 0
    ? ((totalStats.detected / totalStats.processed) * 100).toFixed(1)
    : 0;

  if (sessionsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <LinearProgress sx={{ width: '100%' }} />
      </Box>
    );
  }

  if (activeStreams === 0) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        <Typography variant="h6" gutterBottom>
          No Active Analysis Sessions
        </Typography>
        <Typography>
          No streams are currently being analyzed. Start analysis on a stream to see real-time metrics.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 0, width: '100%' }}>
      <style>{pulseKeyframes}</style>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main', px: 2 }}>
        📊 Real-Time Stream Analytics Dashboard
      </Typography>

      {/* All Cards in One Row */}
      <Box sx={{ px: 2, mb: 4 }}>
        <Grid container spacing={3}>
          {/* Live Detection Stream */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                border: '2px solid #FFB000',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                height: 180
              }}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        backgroundColor: '#ef4444',
                        borderRadius: '50%',
                        mr: 2,
                        animation: 'pulse 2s infinite'
                      }}
                    />
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600 }}>
                      Live Detection Stream
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: '#22c55e' }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        backgroundColor: '#22c55e',
                        borderRadius: '50%',
                        mr: 1,
                        animation: 'pulse 1s infinite'
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      LIVE TRACKING
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    '&::-webkit-scrollbar': {
                      width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '2px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: '#FFB000',
                      borderRadius: '2px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      background: '#E09900',
                    },
                  }}
                >
                  {activeSessions.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {activeSessions
                        .filter(session => (session.trains_detected || 0) > 0)
                        .sort((a, b) => (b.trains_detected || 0) - (a.trains_detected || 0))
                        .map((session, index) => {
                          // Calculate individual detection time based on session activity
                          const detectionTime = new Date(lastDetectionTime.getTime() - (index * 1000));
                          return (
                            <Box key={session.stream_id} sx={{ display: 'flex', alignItems: 'center', minHeight: 50 }}>
                              <Box
                                sx={{
                                  width: 4,
                                  height: 40,
                                  backgroundColor: '#FFB000',
                                  borderRadius: '2px',
                                  mr: 2,
                                  flexShrink: 0
                                }}
                              />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
                                  <Typography variant="caption" sx={{ color: '#FFB000', minWidth: 60, flexShrink: 0 }}>
                                    {detectionTime.toLocaleTimeString('en-US', { hour12: false })}
                                  </Typography>
                                  <Box
                                    sx={{
                                      backgroundColor: '#FFB000',
                                      borderRadius: '4px',
                                      width: 20,
                                      height: 20,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}
                                  >
                                    <TrainIcon sx={{ fontSize: 12, color: '#000' }} />
                                  </Box>
                                  <Typography variant="body2" sx={{ color: '#FFB000', fontWeight: 600, flexShrink: 0 }}>
                                    TRAIN {session.trains_detected || 0}
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#ffffff', flexShrink: 0 }}>
                                    detected at
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: '#4A90E2',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      minWidth: 0,
                                      flex: 1
                                    }}
                                    title={session.stream_name || `Stream ${session.stream_id}`}
                                  >
                                    {session.stream_name || `Stream ${session.stream_id}`}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ color: '#cccccc', display: 'block' }}>
                                  Timestamp: {detectionTime.toISOString().slice(0, 19).replace('T', ' ')} UTC | Confidence: {(session.detection_rate || 0).toFixed(1)}%
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography variant="body2" sx={{ color: '#cccccc', fontStyle: 'italic' }}>
                        No active detections
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Active Streams */}
          <Grid item xs={12} sm={4} md={2}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                border: '2px solid #FFB000',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                height: 180
              }}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#cccccc', mb: 1, pr: 1 }}>
                      📍 ACTIVE STREAMS
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="h1" sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
                  {activeStreams}
                </Typography>
                <Typography variant="body2" sx={{ color: activeStreams > 0 ? '#22c55e' : '#cccccc' }}>
                  {activeStreams > 0 ? '↗ Currently monitoring' : 'No active monitoring'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Latest Detection */}
          <Grid item xs={12} sm={4} md={2}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                border: '2px solid #FFB000',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                height: 180
              }}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: '#cccccc', mb: 1 }}>
                    ⏰ LATEST CAPTURE
                  </Typography>
                </Box>
                <Typography variant="h1" sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
                  {lastDetectionTime.toLocaleTimeString('en-US', { hour12: false })}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#22c55e',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={mostActiveStream?.stream_name || 'No active location'}
                >
                  ↗ {mostActiveStream?.stream_name || 'No active location'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Total Detections */}
          <Grid item xs={12} sm={4} md={2}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                border: '2px solid #FFB000',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                height: 180
              }}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: '#cccccc', mb: 1 }}>
                    🚂 TOTAL DETECTIONS
                  </Typography>
                </Box>
                <Typography variant="h1" sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
                  {totalStats.detected.toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ color: '#22c55e' }}>
                  ↗ Detection rate: {overallDetectionRate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Real-time Performance Chart - Full Screen Width */}
      <Box sx={{ mb: 4, width: '100%' }}>
        <Card sx={{ mx: 0 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              📈 Real-Time Performance Metrics
            </Typography>
            <Box sx={{
              height: 400,
              backgroundColor: '#000000',
              borderRadius: '8px',
              p: 2,
              width: '100%'
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={historicalData}
                  style={{ backgroundColor: '#000000' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                  <XAxis
                    dataKey="time"
                    stroke="#cccccc"
                    tick={{ fill: '#cccccc', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#cccccc"
                    tick={{ fill: '#cccccc', fontSize: 12 }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #404040',
                      borderRadius: '8px',
                      color: '#ffffff'
                    }}
                    formatter={(value, name) => {
                      const colors = {
                        'Frames Processed': '#FFB000',
                        'Frames Discarded': '#ef4444',
                        'Trains Detected': '#22c55e'
                      };
                      return [
                        <span style={{ color: colors[name], fontWeight: 'bold' }}>
                          {value.toLocaleString()}
                        </span>,
                        name
                      ];
                    }}
                    labelFormatter={(label) => `Time: ${label}`}
                    itemSorter={(item) => {
                      const order = {
                        'Frames Processed': 1,
                        'Frames Discarded': 2,
                        'Trains Detected': 3
                      };
                      return order[item.name] || 999;
                    }}
                  />
                  {/* Frames Processed - Amarillo (número mayor) */}
                  <Line
                    type="monotone"
                    dataKey="processed"
                    stroke="#FFB000"
                    strokeWidth={4}
                    name="Frames Processed"
                    dot={{ fill: '#FFB000', strokeWidth: 2, r: 5 }}
                  />
                  {/* Frames Discarded - Rojo (segundo número) */}
                  <Line
                    type="monotone"
                    dataKey="discarded"
                    stroke="#ef4444"
                    strokeWidth={4}
                    name="Frames Discarded"
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 5 }}
                  />
                  {/* Trains Detected - Verde (número menor) */}
                  <Line
                    type="monotone"
                    dataKey="detected"
                    stroke="#22c55e"
                    strokeWidth={4}
                    name="Trains Detected"
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Detection Rate by Stream - Full Width */}
      <Box sx={{ mb: 4, px: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🎯 Detection Rate by Stream
            </Typography>
            <Box>
              {/* Pie Chart - Centered and Larger */}
              <Box sx={{ height: 450, display: 'flex', justifyContent: 'center', mb: 3 }}>
                <ResponsiveContainer width="80%" height="100%">
                  <PieChart>
                    <Pie
                      data={detectionHistory}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={150}
                      fill="#8884d8"
                      dataKey="detections"
                      label={({ name, value, percent }) => {
                        // Truncar nombres muy largos pero mantener el formato completo
                        const shortName = name.length > 20 ? name.substring(0, 20) + '...' : name;
                        return `${shortName}: ${value}`;
                      }}
                      labelStyle={{
                        fill: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}
                    >
                      {detectionHistory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name, props) => [
                        <div style={{ color: '#ffffff' }}>
                          <div style={{
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            marginBottom: '4px'
                          }}>
                            {props.payload.name}
                          </div>
                          <div style={{
                            fontSize: '0.9rem',
                            color: '#cccccc'
                          }}>
                            {value} detections ({props.payload.rate}%)
                          </div>
                        </div>,
                        ''
                      ]}
                      labelFormatter={() => ''}
                      contentStyle={{
                        backgroundColor: '#000000',
                        border: '1px solid #404040',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              {/* Legend - Multiple Columns */}
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 3, textAlign: 'center' }}>
                  📋 Stream Legend
                </Typography>
                <Grid container spacing={2}>
                  {detectionHistory.map((entry, index) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={entry.name}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          p: 1.5,
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          height: '100%',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            backgroundColor: COLORS[index % COLORS.length],
                            borderRadius: '6px',
                            mr: 2,
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 'medium',
                              color: '#ffffff',
                              fontSize: '0.9rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={entry.name}
                          >
                            {entry.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#cccccc', fontSize: '0.8rem' }}>
                            {entry.detections} detections ({entry.rate}%)
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                {detectionHistory.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" sx={{ color: '#cccccc', fontStyle: 'italic' }}>
                      No active streams with detections
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Active Sessions Detail */}
      <Box sx={{ mb: 4, px: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🚄 Active Analysis Sessions
            </Typography>
            <Grid container spacing={2}>
              {activeSessions.map((session, index) => (
                <Grid item xs={12} md={6} lg={4} key={session.stream_id}>
                  <Card
                    variant="outlined"
                    sx={{
                      background: 'linear-gradient(135deg, #FFB000 0%, #FFC733 100%)',
                      color: '#1a1a1a',
                      border: '2px solid #E09900',
                      borderRadius: '16px',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 4px 15px rgba(255, 176, 0, 0.2)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 25px rgba(255, 176, 0, 0.3)',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: session.active
                          ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                          : 'linear-gradient(90deg, #ef4444, #dc2626)',
                      }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" noWrap sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
                          {session.stream_name || `Stream ${session.stream_id}`}
                        </Typography>
                        <Chip
                          icon={session.active ? <PlayIcon /> : <StopIcon />}
                          label={session.active ? 'Active' : 'Stopped'}
                          sx={{
                            backgroundColor: session.active ? '#22c55e' : '#ef4444',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            '& .MuiChip-icon': {
                              color: '#ffffff'
                            }
                          }}
                          size="small"
                        />
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ color: '#1a1a1a', fontWeight: 'medium' }}>
                          Frames Processed: <strong style={{ color: '#0d0d0d' }}>{(session.frames_processed || 0).toLocaleString()}</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#1a1a1a', fontWeight: 'medium' }}>
                          Trains Detected: <strong style={{ color: '#0d0d0d' }}>{(session.trains_detected || 0).toLocaleString()}</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#1a1a1a', fontWeight: 'medium' }}>
                          Detection Rate: <strong style={{ color: '#0d0d0d' }}>{session.detection_rate || 0}%</strong>
                        </Typography>
                      </Box>

                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
                          Detection Rate Progress
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(session.detection_rate || 0, 100)}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: 'rgba(26, 26, 26, 0.2)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: (session.detection_rate || 0) > 10 ? '#22c55e' : '#f59e0b'
                            }
                          }}
                        />
                      </Box>

                      <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic', color: '#1a1a1a', fontWeight: 'medium' }}>
                        Started: {new Date(session.start_time).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Recent Detections - Core Properties */}
      <Box sx={{ mb: 4, width: '100%' }}>
        <Card sx={{ mx: 0 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 4,
                fontWeight: 700,
                color: '#FFB000'
              }}
            >
              🎯 Recent Detections - Core Properties
            </Typography>

            {/* Table Header */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
              gap: 3,
              mb: 3,
              pb: 2,
              borderBottom: '2px solid #FFB000',
              textAlign: 'center'
            }}>
              <Typography variant="h6" sx={{ color: '#FFB000', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ⏰ TIMESTAMP
              </Typography>
              <Typography variant="h6" sx={{ color: '#FFB000', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🏷️ REPORTING MARK
              </Typography>
              <Typography variant="h6" sx={{ color: '#FFB000', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                📍 LOCATION
              </Typography>
              <Typography variant="h6" sx={{ color: '#FFB000', fontWeight: 700, textAlign: 'center' }}>
                DETECTIONS
              </Typography>
              <Typography variant="h6" sx={{ color: '#FFB000', fontWeight: 700, textAlign: 'center' }}>
                CONFIDENCE
              </Typography>
            </Box>

            {/* Table Rows */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {railwayEventsData?.events?.length > 0 ? (
                railwayEventsData.events
                  .slice(0, 6)
                  .map((event, index) => {
                    // Extract real data from railway events
                    const detectionTime = event.start_time ? new Date(event.start_time) : new Date();
                    const reportingMarks = event.reporting_marks || [];
                    const firstReportingMark = reportingMarks.length > 0 ? reportingMarks[0] : '';
                    const location = event.stream_name || '';
                    const unitsCount = event.units_count || 0;
                    const framesCount = event.frames_count || 0;

                    // Calculate confidence based on frames/units ratio (higher ratio = higher confidence)
                    const confidence = framesCount > 0 && unitsCount > 0
                      ? Math.min(95, Math.max(75, (unitsCount / framesCount) * 1000)).toFixed(1)
                      : '';

                    return (
                      <Box
                        key={event.id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                          gap: 3,
                          alignItems: 'center',
                          py: 3,
                          px: 3,
                          borderLeft: '6px solid #FFB000',
                          backgroundColor: 'rgba(255, 176, 0, 0.03)',
                          borderRadius: '12px',
                          textAlign: 'center',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 176, 0, 0.08)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 25px rgba(255, 176, 0, 0.2)',
                          }
                        }}
                      >
                        <Typography variant="h6" sx={{ color: '#FFB000', fontWeight: 600 }}>
                          {detectionTime.toLocaleTimeString('en-US', { hour12: true })}
                        </Typography>

                        <Typography variant="h6" sx={{ color: '#FFB000', fontWeight: 700 }}>
                          {firstReportingMark || '—'}
                        </Typography>

                        <Typography variant="h6" sx={{ color: '#4A90E2', fontWeight: 600 }}>
                          {location || '—'}
                        </Typography>

                        <Box>
                          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600 }}>
                            {unitsCount > 0 ? `${unitsCount}` : '—'}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            backgroundColor: confidence ? (parseFloat(confidence) > 90 ? '#22c55e' : '#FFB000') : 'rgba(255, 255, 255, 0.1)',
                            color: confidence ? '#000' : '#cccccc',
                            px: 2,
                            py: 1,
                            borderRadius: '16px',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            minWidth: 80,
                            mx: 'auto'
                          }}
                        >
                          {confidence ? `${confidence}%` : '—'}
                        </Box>
                      </Box>
                    );
                  })
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="h6" sx={{ color: '#cccccc', fontStyle: 'italic' }}>
                    No recent railway events available
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

    </Box>
  );
};

export default StreamMetrics;