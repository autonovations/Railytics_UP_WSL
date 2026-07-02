import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  IconButton,
  Breadcrumbs,
  Link as MLink,
  CircularProgress,
  Pagination,
  Dialog,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import { ArrowBack, Train, Refresh } from '@mui/icons-material';
import { getRailwayEventFrames, getFrameImageUrl, getFrameCropUrl, getRailcarTypes } from '../../services/api';

const EventFramesPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [preview, setPreview] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['eventFrames', eventId, page, limit],
    queryFn: () => getRailwayEventFrames(eventId, page, limit),
  });

  const event = data?.event;
  const total = data?.total || 0;

  // Railcar types loaded from server env (RAILCAR_TYPES)
  const [railcarTypes, setRailcarTypes] = useState([]);
  const railcarTypesLower = railcarTypes.map(t => t.toLowerCase());

  // Load railcar types once
  useQuery({
    queryKey: ['railcarTypes'],
    queryFn: getRailcarTypes,
    onSuccess: (types) => setRailcarTypes(types)
  });

  

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate(-1)} color="primary"><ArrowBack /></IconButton>
          <Breadcrumbs aria-label="breadcrumb">
            <MLink underline="hover" color="inherit" onClick={() => navigate('/')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Train fontSize="small" sx={{ mr: 0.5 }} /> Reports
            </MLink>
            <Typography color="text.primary">Event {eventId?.slice(0, 8)}</Typography>
          </Breadcrumbs>
        </Box>
        <IconButton onClick={() => refetch()} color="primary"><Refresh /></IconButton>
      </Box>

      <Typography variant="h5" gutterBottom>
        Frames for Railway Event
      </Typography>
      {event && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Stream: {event.stream_name || event.stream_id} • Frames: {event.frames_count} •
          Start: {new Date(event.start_time).toLocaleString()} • End: {event.end_time ? new Date(event.end_time).toLocaleString() : 'Active'}
        </Typography>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
      ) : data?.frames?.length ? (
        <>
          <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Date & Time</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="center">Image</TableCell>
                  <TableCell align="center">Railcars</TableCell>
                  <TableCell>Railcar Type</TableCell>
                  <TableCell align="center">Reporting Mark section</TableCell>
                  <TableCell>Railcar Condition</TableCell>
                  <TableCell>Quality image</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.frames.map((frame, idx) => {
                  const timestamp = frame.timestamp ? new Date(frame.timestamp).toLocaleString() : '—';
                  const detections = frame.detections || [];
                  const railcars = detections.filter(d => String(d.class_name || '').toLowerCase() === 'railcar').length;
                  const hasReportingMark = detections.some(d => String(d.class_name || '').toLowerCase() === 'reporting mark');
                  // Extract first serial text if available
                  let firstText = '';
                  let bestSerialConfidence = 0;
                  for (const det of detections) {
                    if (det.serials && det.serials.length) {
                      const s = det.serials[0];
                      firstText = s.cleaned_text || s.text || '';
                      bestSerialConfidence = Math.max(bestSerialConfidence, Number(s.confidence || 0));
                      if (firstText) break;
                    }
                  }
                  // Determine railcar types present based on env list
                  const typeSet = new Set();
                  if (railcarTypes.length > 0) {
                    for (const det of detections) {
                      const cls = String(det.class_name || '').toLowerCase();
                      const idxMatch = railcarTypesLower.indexOf(cls);
                      if (idxMatch !== -1) {
                        typeSet.add(railcarTypes[idxMatch]);
                      }
                    }
                  }
                  const railcarTypesDisplay = Array.from(typeSet).join(', ');

                  // Railcar condition from average confidence of railcar detections
                  const railcarDetections = detections.filter(d => String(d.class_name || '').toLowerCase() === 'railcar');
                  const avgConf = railcarDetections.length ? (railcarDetections.reduce((a, d) => a + Number(d.confidence || 0), 0) / railcarDetections.length) : 0;
                  let railcarCondition = 'Poor';
                  if (avgConf >= 0.8) railcarCondition = 'Good';
                  else if (avgConf >= 0.6) railcarCondition = 'Fair';

                  // Image quality based on average railcar detection confidence
                  let qualityLabel = 'N/A';
                  if (avgConf > 0) {
                    if (avgConf >= 0.8) qualityLabel = 'High';
                    else if (avgConf >= 0.6) qualityLabel = 'Medium';
                    else qualityLabel = 'Low';
                  }
                  return (
                    <TableRow key={frame.filename || idx} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{timestamp}</TableCell>
                      <TableCell>{event?.stream_name || event?.stream_id || 'Unknown'}</TableCell>
                      <TableCell align="center">
                        <Box component="img" src={getFrameImageUrl(frame.filename)} alt={frame.filename} sx={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 1, cursor: 'pointer', border: '1px solid', borderColor: 'divider' }} onClick={() => setPreview({ type: 'frame', filename: frame.filename })} />
                      </TableCell>
                      <TableCell align="center">{railcars}</TableCell>
                      <TableCell>{railcarTypesDisplay || '—'}</TableCell>
                      <TableCell align="center">
                        {hasReportingMark ? (
                          <Box component="img" src={getFrameCropUrl(frame.filename, { class_name: 'Reporting Mark', index: -1, pad: 0, inner: 8, scale: 2 })} alt="Reporting Mark crop" sx={{ width: 120, height: 80, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider', backgroundColor: '#1f1f1f', cursor: 'pointer' }} onClick={() => setPreview({ type: 'crop', src: getFrameCropUrl(frame.filename, { class_name: 'Reporting Mark', index: -1, pad: 0, inner: 8, scale: 2, max_width: 1400, max_height: 900 }) })} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>{railcarCondition}</TableCell>
                      <TableCell>{qualityLabel}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {total > limit && (
            <Box sx={{ position: 'fixed', bottom: 12, right: 12, zIndex: 1200, bgcolor: 'background.default', border: '1px solid', borderColor: 'warning.main', borderRadius: 1, px: 1.5, py: 0.5, boxShadow: 2, display: 'inline-flex' }}>
              <Pagination
                count={Math.ceil(total / limit)}
                page={page}
                onChange={(_, v) => setPage(v)}
                boundaryCount={1}
                siblingCount={1}
                shape="rounded"
                variant="text"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600,
                    minWidth: 36,
                    height: 36,
                  },
                  '& .MuiPaginationItem-root.Mui-selected': {
                    bgcolor: 'warning.main',
                    color: 'common.black',
                    boxShadow: '0 0 0 4px rgba(255,193,7,0.2)',
                  },
                  '& .MuiPaginationItem-ellipsis': {
                    color: 'rgba(255,255,255,0.6)'
                  },
                }}
              />
            </Box>
          )}
        </>
      ) : (
        <Box textAlign="center" mt={8}><Typography>No frames for this event.</Typography></Box>
      )}

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth={false} PaperProps={{ sx: { width: '75vw', maxWidth: '75vw', height: '75vh' } }}>
        <DialogContent sx={{ p: 0, bgcolor: '#2b2b2b' }}>
          {preview && (
            preview.type === 'crop' ? (
              <img src={preview.src} alt="Reporting Mark crop" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', backgroundColor: '#2b2b2b', imageRendering: 'crisp-edges' }} />
            ) : (
              <img src={getFrameImageUrl(preview.filename)} alt={preview.filename} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', backgroundColor: '#000' }} />
            )
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default EventFramesPage;


