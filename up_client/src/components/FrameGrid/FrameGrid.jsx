import { useState } from 'react';
import {
  Grid,
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Card,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material';
import { Close, Refresh, Delete, Info } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { getFrames, deleteAllFrames, getStreams } from '../../services/api';
import FrameCard from './FrameCard';
import FrameDetailsModal from './FrameDetailsModal';
import { motion, AnimatePresence } from 'framer-motion';

const FRAMES_PER_PAGE = 12;

// Removed state flag rendering per request

const FrameGrid = () => {
  const [page, setPage] = useState(1);
  const [streamFilter, setStreamFilter] = useState('');
  const [selectedFrame, setSelectedFrame] = useState(null);
  const queryClient = useQueryClient();

  // Query for streams to populate the dropdown
  const { data: streamsData } = useQuery({
    queryKey: ['streams'],
    queryFn: () => getStreams(false), // Get all streams, not just active ones
    retry: 1,
  });

  // Build per-stream frame counts with lightweight requests (limit=1 to obtain metadata total)
  const streamsList = streamsData?.streams || [];
  const countQueries = useQueries({
    queries: streamsList.map((s) => ({
      queryKey: ['frames-count', s.id],
      queryFn: async () => {
        const res = await getFrames(1, 1, s.id);
        return res?.total || 0;
      },
      enabled: streamsList.length > 0,
      staleTime: 30_000,
    })),
  });

  const streamIdToCount = streamsList.reduce((acc, s, idx) => {
    acc[s.id] = countQueries[idx]?.data ?? 0;
    return acc;
  }, {});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['frames', page, streamFilter],
    queryFn: () => getFrames(page, FRAMES_PER_PAGE, streamFilter),
    placeholderData: (previousData) => previousData,
    retry: 2,
    retryDelay: 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAllFrames,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frames'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      setPage(1); // Reset to first page
    },
    onError: (error) => {
      console.error('Error deleting frames:', error);
    }
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete all frames? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  const handleStreamFilterChange = (event) => {
    setStreamFilter(event.target.value);
    setPage(1);
  };

  if (error) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert severity="error">
          <strong>Error loading frames:</strong> {error.message}
          <Box mt={2}>
            <IconButton onClick={() => refetch()} color="primary">
              <Refresh />
            </IconButton>
          </Box>
        </Alert>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">🖼️ Captured Frames</Typography>
            {data && (
              <Chip
                icon={<Info />}
                label={`${data.total || 0} saved frames`}
                color="primary"
                variant="outlined"
                size="small"
              />
            )}
          </Box>

          <Box display="flex" gap={2} flexWrap="wrap">
            <FormControl variant="outlined" size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Filter by Location</InputLabel>
              <Select
                value={streamFilter}
                onChange={handleStreamFilterChange}
                label="Filter by Location"
                disabled={!streamsData?.streams}
              >
                <MenuItem value="">All locations</MenuItem>
                {streamsData?.streams?.map((stream) => {
                  const count = streamIdToCount[stream.id] ?? 0;
                  return (
                    <MenuItem key={stream.id} value={stream.id}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                        <span>
                          {stream.name}
                          {stream.description && ` (${stream.description})`}
                        </span>
                        <Chip label={count} size="small" />
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            <IconButton
              onClick={() => refetch()}
              color="primary"
              disabled={isLoading}
            >
              <Refresh />
            </IconButton>
            <IconButton
              onClick={handleDelete}
              color="error"
              disabled={deleteMutation.isLoading || isLoading}
            >
              <Delete />
            </IconButton>
          </Box>
        </Box>

        {/* Statistics row */}
        {data && (
          <Box display="flex" gap={3} mb={3} flexWrap="wrap">
            <Typography variant="body2" color="text.secondary">
              📊 Processed: {data.frames_processed || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ✅ Saved: {data.total || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ❌ Discarded: {data.frames_discarded || 0}
            </Typography>
            {data.frames_processed > 0 && (
              <Typography variant="body2" color="text.secondary">
                📈 Tasa de guardado: {((data.total / data.frames_processed) * 100).toFixed(1)}%
              </Typography>
            )}
          </Box>
        )}

        <AnimatePresence mode="wait">
          {isLoading ? (
            <Grid container spacing={3}>
              {[...Array(FRAMES_PER_PAGE)].map((_, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                  <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          ) : data?.frames?.length ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Grid container spacing={3}>
                {data.frames.map((frame) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={frame.filename}>
                    <FrameCard
                      frame={frame}
                      onImageClick={setSelectedFrame}
                    />
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          ) : (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                📷 No frames available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {streamFilter ? 'Try changing the location filter or' : ''}  start a capture to see frames here
              </Typography>
              {streamFilter && (
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary">
                    Active filter: {streamsData?.streams?.find(s => s.id === streamFilter)?.name || 'Desconocida'}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </AnimatePresence>

        {data?.total > FRAMES_PER_PAGE && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={Math.ceil(data.total / FRAMES_PER_PAGE)}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              size="large"
            />
          </Box>
        )}
      </Card>

      {/* Frame Details Modal */}
      <FrameDetailsModal
        open={!!selectedFrame}
        onClose={() => setSelectedFrame(null)}
        frame={selectedFrame}
      />
    </>
  );
};

export default FrameGrid;