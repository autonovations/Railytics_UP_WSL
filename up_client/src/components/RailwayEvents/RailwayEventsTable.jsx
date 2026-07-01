import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Stack,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Event as EventIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Train as TrainIcon,
  Badge as BadgeIcon,
  AccessTime as DurationIcon,
  PlayArrow as PlayIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { getRailwayEvents, getFrameThumbnailUrl } from '../../services/api';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import EventVideoModal from './EventVideoModal';

const formatDate = (ts) => {
  if (!ts) return 'N/A';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch (e) { return 'Invalid Date'; }
};

const formatDuration = (seconds) => {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const calculateVideoDuration = (framesCount, fps = 5) => {
  if (!framesCount || framesCount <= 0) return 0;

  // If only one frame, server duplicates it for ~2 seconds
  if (framesCount === 1) {
    return Math.max(fps * 2, 10) / fps; // Convert frames back to seconds
  }

  // For multiple frames, duration = frames / fps
  return framesCount / fps;
};

const RailwayEventsTable = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [videoOpen, setVideoOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['railwayEvents', page + 1, rowsPerPage],
    queryFn: () => getRailwayEvents(page + 1, rowsPerPage),
    refetchInterval: 30000,
  });

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRowClick = (evt) => {
    navigate(`/events/${evt.id}`);
  };

  const handleOpenVideo = (evt, eventItem) => {
    evt.stopPropagation();
    setSelectedEvent(eventItem);
    setVideoOpen(true);
  };

  const handleCloseVideo = () => {
    setVideoOpen(false);
    setSelectedEvent(null);
  };

  const handleOpenImage = (evt, imageData) => {
    evt.stopPropagation();
    setSelectedImage(imageData);
    setImageModalOpen(true);
  };

  const handleCloseImage = () => {
    setImageModalOpen(false);
    setSelectedImage(null);
  };

  if (error) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Alert severity="error">
          <strong>Error loading railway events:</strong> {error.message}
        </Alert>
      </Paper>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Paper
        sx={{
          mt: 3,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'primary.main',
          background: 'linear-gradient(180deg, rgba(10,10,10,0.98), rgba(10,10,10,0.92))',
          '&:before': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '6px',
            backgroundColor: 'primary.main',
          },
        }}
      >
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center' }}>
              <EventIcon sx={{ mr: 1, color: 'secondary.main' }} />
              Railway Events
            </Typography>
            <Tooltip title="Refresh data">
              <IconButton onClick={refetch} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {data && (
            <Stack direction="row" spacing={1}>
              <Chip icon={<TrainIcon />} label={`${data.total || 0} events`} color="secondary" variant="outlined" />
            </Stack>
          )}
        </Box>

        <TableContainer>
          {isLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" p={4}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Loading Railway Events...
              </Typography>
            </Box>
          ) : (
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    <Box display="flex" alignItems="center">
                      <ScheduleIcon sx={{ mr: 1, fontSize: 18 }} />
                      Start
                    </Box>
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    <Box display="flex" alignItems="center">
                      <ScheduleIcon sx={{ mr: 1, fontSize: 18 }} />
                      End
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    <Box display="flex" alignItems="center" justifyContent="center">
                      <DurationIcon sx={{ mr: 1, fontSize: 18 }} />
                      Duration
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    <Box display="flex" alignItems="center" justifyContent="center">
                      <TrainIcon sx={{ mr: 1, fontSize: 18 }} />
                      Frames
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    Units
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    <Box display="flex" alignItems="center">
                      <BadgeIcon sx={{ mr: 1, fontSize: 18 }} />
                      Reporting Marks
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    <Box display="flex" alignItems="center" justifyContent="center">
                      <ImageIcon sx={{ mr: 1, fontSize: 18 }} />
                      Last Detection
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    Video
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'common.black', fontWeight: 700 }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.events || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        There are no Railway Events available
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.events.map((evt) => (
                    <TableRow
                      key={evt.id}
                      hover
                      onClick={() => handleRowClick(evt)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease, transform 0.05s ease',
                        '&:nth-of-type(odd)': { backgroundColor: 'rgba(255,255,255,0.02)' },
                        '&:hover': { backgroundColor: 'rgba(255,193,7,0.08)' },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(evt.start_time)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {evt.end_time ? formatDate(evt.end_time) : '— (active)'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="bold">
                          {formatDuration(evt.duration_seconds)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{evt.frames_count || 0}</TableCell>
                      <TableCell align="center">{evt.units_count || 0}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {(evt.reporting_marks || []).slice(0, 6).map((rm, idx) => (
                            <Chip key={idx} label={rm} size="small" variant="outlined" />
                          ))}
                          {(evt.reporting_marks || []).length > 6 && (
                            <Chip label={`+${(evt.reporting_marks || []).length - 6}`} size="small" />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        {evt.last_frame ? (
                          <Box
                            component="img"
                            src={getFrameThumbnailUrl(evt.last_frame)}
                            alt="Last frame"
                            sx={{
                              width: 80,
                              height: 60,
                              objectFit: 'cover',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              boxShadow: '0 0 0 2px rgba(255,193,7,0.15) inset',
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8,
                                transform: 'scale(1.05)',
                              },
                              transition: 'all 0.2s ease-in-out',
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                            onClick={(e) => handleOpenImage(e, {
                              filename: evt.last_frame,
                              eventId: evt.id,
                              eventName: `Event ${evt.id}`,
                              timestamp: evt.start_time
                            })}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No image
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                          <Tooltip title="View event video">
                            <IconButton color="primary" onClick={(e) => handleOpenVideo(e, evt)}>
                              <PlayIcon />
                            </IconButton>
                          </Tooltip>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            {formatDuration(calculateVideoDuration(evt.frames_count))}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<SearchIcon />}
                          onClick={(e) => { e.stopPropagation(); handleRowClick(evt); }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {data && !isLoading && (
          <Box sx={{ position: 'fixed', right: 12, bottom: 8, zIndex: 1200 }}>
            <TablePagination
              rowsPerPageOptions={[5, 10, 20, 50]}
              component="div"
              count={data.total || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Rows per page:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count !== -1 ? count : `more of ${to}`}`}
              sx={{
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'warning.main',
                borderRadius: 1,
                px: 2,
                boxShadow: 2,
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Image Modal */}
      <Dialog
        open={imageModalOpen}
        onClose={handleCloseImage}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}>
          <Box>
            <Typography variant="h6" component="span">
              Last Frame - {selectedImage?.eventName}
            </Typography>
            {selectedImage?.timestamp && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {formatDate(selectedImage.timestamp)}
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleCloseImage} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, textAlign: 'center' }}>
          {selectedImage?.filename && (
            <Box
              component="img"
              src={getFrameThumbnailUrl(selectedImage.filename)}
              alt="Full frame view"
              sx={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 1,
                boxShadow: 2,
              }}
              onError={(e) => {
                e.target.src = '';
                e.target.alt = 'Image failed to load';
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseImage} variant="outlined">
            Close
          </Button>
          {selectedImage?.filename && (
            <Button
              variant="contained"
              onClick={() => {
                const link = document.createElement('a');
                link.href = getFrameThumbnailUrl(selectedImage.filename);
                link.download = selectedImage.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <EventVideoModal open={videoOpen} onClose={handleCloseVideo} eventItem={selectedEvent} />
    </motion.div>
  );
};

export default RailwayEventsTable;


