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
import { analysisAPI, streamAPI } from '../../services/api';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

const StreamMetrics = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [detectionHistory, setDetectionHistory] = useState([]);

  // Fetch active sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['analysisSessionsMetrics'],
    queryFn: analysisAPI.getSessions,
    refetchInterval: 2000,
  });

  // Fetch streams
  const { data: streamsData } = useQuery({
    queryKey: ['streamsMetrics'],
    queryFn: () => streamAPI.getAllStreams(true),
    refetchInterval: 5000,
  });

  // Update historical data for charts
  useEffect(() => {
    if (sessionsData?.active_sessions?.length > 0) {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      
      const totalProcessed = sessionsData.active_sessions.reduce(
        (sum, session) => sum + session.frames_processed, 0
      );
      const totalDetected = sessionsData.active_sessions.reduce(
        (sum, session) => sum + session.trains_detected, 0
      );
      const totalDiscarded = sessionsData.active_sessions.reduce(
        (sum, session) => sum + session.frames_discarded, 0
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
        name: session.stream_name,
        detections: session.trains_detected,
        processed: session.frames_processed,
        rate: session.detection_rate,
      }));

      setDetectionHistory(detectionData);
    }
  }, [sessionsData]);

  const activeSessions = sessionsData?.active_sessions || [];
  const totalStreams = streamsData?.streams?.length || 0;
  const activeStreams = activeSessions.length;

  const totalStats = activeSessions.reduce(
    (acc, session) => ({
      processed: acc.processed + session.frames_processed,
      detected: acc.detected + session.trains_detected,
      discarded: acc.discarded + session.frames_discarded,
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
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
        📊 Real-Time Stream Analytics Dashboard
      </Typography>


       {/* Real-time Performance Chart - Full Width */}
       <Grid container spacing={3} sx={{ mb: 4 }}>
         <Grid item xs={12}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 📈 Real-Time Performance Metrics
               </Typography>
               <Box sx={{ 
                 height: 300,
                 backgroundColor: '#000000',
                 borderRadius: '8px',
                 p: 1
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
        </Grid>
      </Grid>

      {/* Detection Rate by Stream - Full Width */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
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
        </Grid>
      </Grid>

      {/* Active Sessions Detail */}
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
                        {session.stream_name}
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
                        Frames Processed: <strong style={{ color: '#0d0d0d' }}>{session.frames_processed.toLocaleString()}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1a1a1a', fontWeight: 'medium' }}>
                        Trains Detected: <strong style={{ color: '#0d0d0d' }}>{session.trains_detected.toLocaleString()}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1a1a1a', fontWeight: 'medium' }}>
                        Detection Rate: <strong style={{ color: '#0d0d0d' }}>{session.detection_rate}%</strong>
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
                        Detection Rate Progress
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(session.detection_rate, 100)} 
                        sx={{ 
                          height: 8, 
                          borderRadius: 4,
                          backgroundColor: 'rgba(26, 26, 26, 0.2)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: session.detection_rate > 10 ? '#22c55e' : '#f59e0b'
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

      {/* Performance Bar Chart */}
      {historicalData.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Processing Volume Trends
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData.slice(-10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area 
                    type="monotone" 
                    dataKey="processed" 
                    stackId="1"
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6}
                    name="Processed"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="detected" 
                    stackId="2"
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                    fillOpacity={0.6}
                    name="Detected"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default StreamMetrics;
