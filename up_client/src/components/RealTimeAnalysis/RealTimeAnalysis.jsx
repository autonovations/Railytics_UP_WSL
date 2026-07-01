import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip as MuiChip,
  Select,
  MenuItem,
  TablePagination,
  FormControl,
} from '@mui/material';
import {
  Stop as StopIcon,
  Fullscreen as FullscreenIcon,
  Analytics as AnalyticsIcon,
  Train as TrainIcon,
  Visibility as ViewIcon,
  StopCircle as StopAllIcon,
  TableView as TableIcon,
  ShowChart as ChartIcon,
  Search as SearchIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnalysisStatus, stopAnalysis, getStream, createWebSocketConnection, getActiveSessions, stopAllAnalysis, getRailwayEvents } from '../../services/api';
import MultiStreamTable from './MultiStreamTable';
import ImprovedStreamViewer from '../StreamViewer/ImprovedStreamViewer';
import Calendar from '../Calendar/Calendar';
import StreamMetrics from '../Analytics/StreamMetrics';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, subtitle, color = 'primary', icon }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, color: `${color}.main` }}>
            {value}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {icon && (
          <Box sx={{ color: `${color}.main`, opacity: 0.7 }}>
            {icon}
          </Box>
        )}
      </Box>
    </CardContent>
  </Card>
);

const RealTimeAnalysis = () => {
  const [realtimeData, setRealtimeData] = useState(null);
  const [streamDialogOpen, setStreamDialogOpen] = useState(false);
  const [currentStream, setCurrentStream] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentViewStream, setCurrentViewStream] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const wsRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch analysis status (legacy)
  const { data: analysisStatus } = useQuery({
    queryKey: ['analysisStatus'],
    queryFn: getAnalysisStatus,
    refetchInterval: 3000,
  });

  // Fetch active sessions (new multi-stream)
  const { data: activeSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: getActiveSessions,
    refetchInterval: 3000,
  });

  // Fetch current stream details
  const { data: streamData } = useQuery({
    queryKey: ['currentStream', analysisStatus?.stream_id],
    queryFn: () => getStream(analysisStatus.stream_id),
    enabled: !!analysisStatus?.stream_id,
  });

  // Fetch railway events (recent, optionally filtered by current stream)
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['railwayEvents', 'all-streams'],
    queryFn: () => getRailwayEvents(1, 2000, ''),
    enabled: true,
    refetchInterval: 60000,
  });

  // Stop all analysis mutation
  const stopAllAnalysisMutation = useMutation({
    mutationFn: stopAllAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries(['analysisStatus']);
      queryClient.invalidateQueries(['activeSessions']);
    },
  });

  // Stop analysis mutation (legacy)
  const stopAnalysisMutation = useMutation({
    mutationFn: stopAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries(['analysisStatus']);
      queryClient.invalidateQueries(['activeSessions']);
    },
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const hasActiveAnalysis = analysisStatus?.active || (activeSessions?.active_sessions?.length > 0);

    if (hasActiveAnalysis) {
      wsRef.current = createWebSocketConnection(
        (data) => {
          setRealtimeData(data);
          // Update queries when we receive updates
          if (data.type === 'frame_detected' || data.type === 'analysis_stopped' || data.type === 'analysis_started') {
            queryClient.invalidateQueries(['analysisStatus']);
            queryClient.invalidateQueries(['activeSessions']);
          }
        },
        (error) => {
          console.error('WebSocket error:', error);
        },
        () => {
          console.log('WebSocket connection closed');
        }
      );

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    }
  }, [analysisStatus?.active, activeSessions?.active_sessions?.length, queryClient]);

  const handleStopAnalysis = () => {
    stopAnalysisMutation.mutate();
  };

  const handleStopAllAnalysis = () => {
    stopAllAnalysisMutation.mutate();
  };

  const handleViewStream = () => {
    setCurrentStream(streamData);
    setStreamDialogOpen(true);
  };

  const handleViewStreamFromActions = (stream) => {
    setCurrentViewStream(stream);
    setViewerOpen(true);
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    // Here you could add logic to fetch events for the selected date
    console.log('Selected date:', date);
  };

  // Helpers to format dates locally (YYYY-MM-DD)
  const toLocalDateKey = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const events = eventsData?.events || [];
  const selectedDateKey = toLocalDateKey(selectedDate);

  // Location filter
  const [selectedLocation, setSelectedLocation] = useState('ALL');

  // Get events for the selected day first
  const eventsForSelectedDayAll = useMemo(() => {
    return events.filter((ev) => {
      if (!ev?.start_time) return false;
      return toLocalDateKey(new Date(ev.start_time)) === selectedDateKey;
    });
  }, [events, selectedDateKey]);

  // Count events by location for the selected day only
  const locationCountsForSelectedDay = useMemo(() => {
    const counts = new Map();
    for (const e of eventsForSelectedDayAll) {
      const key = e.stream_name || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [eventsForSelectedDayAll]);

  const locations = useMemo(() => {
    const list = Array.from(locationCountsForSelectedDay.keys()).sort();
    const mapped = list.map((name) => ({ label: name, value: name, count: locationCountsForSelectedDay.get(name) || 0 }));
    const total = eventsForSelectedDayAll.length;
    return [{ label: 'ALL', value: 'ALL', count: total }, ...mapped];
  }, [locationCountsForSelectedDay, eventsForSelectedDayAll.length]);

  const filteredEventsByLocation = useMemo(() => {
    if (selectedLocation === 'ALL') return events;
    return events.filter((e) => e.stream_name === selectedLocation);
  }, [events, selectedLocation]);

  const highlightedDates = useMemo(() => {
    const keys = new Set();
    for (const ev of filteredEventsByLocation) {
      if (!ev?.start_time) continue;
      const key = toLocalDateKey(new Date(ev.start_time));
      keys.add(key);
    }
    return Array.from(keys);
  }, [filteredEventsByLocation]);
  const eventsForSelectedDay = useMemo(() => {
    if (selectedLocation === 'ALL') {
      return eventsForSelectedDayAll;
    }
    return eventsForSelectedDayAll.filter((ev) => ev.stream_name === selectedLocation);
  }, [eventsForSelectedDayAll, selectedLocation]);

  // Pagination for events table
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  useEffect(() => {
    setPage(0);
  }, [selectedDateKey, selectedLocation]);
  const paginatedEvents = useMemo(() => {
    const start = page * rowsPerPage;
    return eventsForSelectedDay.slice(start, start + rowsPerPage);
  }, [eventsForSelectedDay, page, rowsPerPage]);

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (seconds) => {
    if (seconds == null) return 'ongoing';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const hasActiveAnalysis = analysisStatus?.active || (activeSessions?.active_sessions?.length > 0);
  const activeSessionsCount = activeSessions?.active_sessions?.length || 0;

  return (
    <Box>


      {/* Tabs for different views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab
            icon={<TableIcon />}
            label={
              <Badge badgeContent={activeSessionsCount} color="primary">
                Multi-Stream View
              </Badge>
            }
            iconPosition="start"
          />
          <Tab
            icon={<BarChartIcon />}
            label="Analytics"
            iconPosition="start"
          />
          <Tab
            icon={<ChartIcon />}
            label="Historical"
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {currentTab === 0 && (
        <>
          {hasActiveAnalysis ? (
            <MultiStreamTable
              sessions={activeSessions?.active_sessions || []}
              onRefresh={refetchSessions}
              onViewStream={handleViewStreamFromActions}
            />
          ) : (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AnalyticsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
                  No Active Analysis
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Start an analysis from the Stream Selection tab to view real-time data.
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {currentTab === 1 && (
        <StreamMetrics />
      )}

      {currentTab === 2 && (
        <Box sx={{ width: '100%' }}>
          <Grid container spacing={3} justifyContent="center" alignItems="flex-start">
            {/* Calendar Section */}
            <Grid item xs={12} md={5} lg={4} xl={4}>
              <Box sx={{ mx: 'auto' }}>
                <Typography variant="h6" sx={{ mb: 2, color: '#FFC107', fontWeight: 600 }}>
                  📅 Event Calendar
                </Typography>
                {/* Location filter */}
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', minWidth: 72 }}>
                    Location:
                  </Typography>
                  <FormControl fullWidth>
                    <Select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      size="small"
                      sx={{
                        backgroundColor: '#1f1f1f',
                        color: 'white',
                        borderRadius: 1,
                        '& .MuiSelect-icon': { color: '#FFC107' }
                      }}
                    >
                      {locations.map((loc) => (
                        <MenuItem key={loc.value} value={loc.value}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                            <Typography variant="body2">{loc.label}</Typography>
                            <Chip label={loc.count} size="small" />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  highlightedDates={highlightedDates}
                />
              </Box>
            </Grid>

            {/* Event Details Section */}
            <Grid item xs={12} md={7} lg={8} xl={7}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2, color: '#FFC107', fontWeight: 600 }}>
                  📊 Events for {selectedDate.toLocaleDateString()}
                </Typography>
                <Card>
                  <CardContent>
                    {eventsLoading ? (
                      <Box sx={{ py: 4 }}>
                        <LinearProgress />
                      </Box>
                    ) : eventsForSelectedDay.length > 0 ? (
                      <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
                        <Table size="small" sx={{ minWidth: 700 }}>
                          <TableHead>
                            <TableRow sx={{ backgroundColor: '#1f1f1f' }}>
                              <TableCell sx={{ color: '#FFC107', fontWeight: 700 }}>⏱ Timestamp</TableCell>
                              <TableCell sx={{ color: '#FFC107', fontWeight: 700 }}>🚩 Reporting Marks</TableCell>
                              <TableCell sx={{ color: '#FFC107', fontWeight: 700 }}>📍 Location</TableCell>
                              <TableCell sx={{ color: '#FFC107', fontWeight: 700 }}>🚂 Units</TableCell>
                              <TableCell sx={{ color: '#FFC107', fontWeight: 700 }}>⏳ Duration</TableCell>
                              <TableCell align="right" sx={{ color: '#FFC107', fontWeight: 700 }}>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedEvents.map((ev) => (
                              <TableRow
                                key={ev.id}
                                hover
                                sx={{ '&:hover': { backgroundColor: 'rgba(255, 193, 7, 0.06)' } }}
                              >
                                <TableCell sx={{ color: 'white', fontWeight: 500 }}>{formatTime(ev.start_time)}</TableCell>
                                <TableCell sx={{ color: 'white' }}>
                                  {Array.isArray(ev.reporting_marks) && ev.reporting_marks.length > 0 ? (
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Typography variant="body2" sx={{ color: '#FFC107', fontWeight: 600 }}>
                                        {ev.reporting_marks[0]}
                                      </Typography>
                                      {ev.reporting_marks.length > 1 && (
                                        <Chip label={`+${ev.reporting_marks.length - 1}`} size="small" />
                                      )}
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">—</Typography>
                                  )}
                                </TableCell>
                                <TableCell sx={{ color: '#64B5F6', fontWeight: 600 }}>{ev.stream_name || '—'}</TableCell>
                                <TableCell>
                                  <Chip label={`${ev.units_count ?? 0}`} />
                                </TableCell>
                                <TableCell>
                                  <Chip label={formatDuration(ev.duration_seconds)} color="success" />
                                </TableCell>
                                <TableCell align="right">
                                  <Button
                                    variant="contained"
                                    color="warning"
                                    startIcon={<SearchIcon />}
                                    onClick={() => navigate(`/events/${ev.id}`)}
                                    sx={{ color: '#000', fontWeight: 700 }}
                                  >
                                    View Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <TablePagination
                          component="div"
                          count={eventsForSelectedDay.length}
                          page={page}
                          onPageChange={(e, newPage) => setPage(newPage)}
                          rowsPerPage={rowsPerPage}
                          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                          rowsPerPageOptions={[5, 10, 25, 50]}
                          sx={{ color: 'white' }}
                        />
                      </TableContainer>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <TrainIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="body1" color="text.secondary">
                          No train detection events found for this date.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Select a highlighted date to view events.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Stream Viewer Dialog */}
      <Dialog
        open={streamDialogOpen}
        onClose={() => setStreamDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Live Stream: {currentStream?.name}
        </DialogTitle>
        <DialogContent>
          {currentStream && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {currentStream.description}
              </Typography>

              {/* Embed iframe for YouTube live stream */}
              <Box sx={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${currentStream.url.split('v=')[1]?.split('&')[0] || ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  allowFullScreen
                  title="Live Stream"
                />
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  This is the live stream being analyzed. Train detections are happening automatically every 3 seconds.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStreamDialogOpen(false)}>
            Close
          </Button>
          <Button
            variant="outlined"
            startIcon={<FullscreenIcon />}
            onClick={() => window.open(currentStream?.url, '_blank')}
          >
            Open in New Tab
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stream Viewer */}
      <ImprovedStreamViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        stream={currentViewStream}
      />
    </Box>
  );
};

export default RealTimeAnalysis;