import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Close,
  Train,
  QrCode,
  ExpandMore,
  Visibility,
  Analytics
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { getFrameSerials, getFrameImageUrl } from '../../services/api';

const FrameDetailsModal = ({ open, onClose, frame }) => {
  const [serialsData, setSerialsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSerials = async () => {
      if (!open || !frame) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getFrameSerials(frame.filename);
        setSerialsData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSerials();
  }, [open, frame]);

  if (!frame) return null;

  const formatDateTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="between">
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            📋 Detection Details
          </Typography>
          <Button
            onClick={onClose}
            size="small"
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <Close />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Image Section */}
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                🖼️ Captured Image
              </Typography>
              <Box
                component="img"
                src={getFrameImageUrl(frame.filename)}
                alt={`Frame ${frame.filename}`}
                sx={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              />
            </Box>
          </Grid>

          {/* Details Section */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              📊 General Information
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>File:</strong> {frame.filename}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Date:</strong> {formatDateTime(frame.timestamp)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Size:</strong> {(frame.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Chip
                icon={<Train />}
                label={`${frame.detection_count || 0} Railcars detected`}
                color="success"
                variant="outlined"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                icon={<QrCode />}
                label={`${frame.total_serials || 0} Reporting Marks detected`}
                color="primary"
                variant="outlined"
                sx={{ mb: 1 }}
              />
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Serials Details Section */}
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <QrCode sx={{ mr: 1 }} />
          Detected Reporting Marks
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={3}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading serial numbers information...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error loading serials: {error}
          </Alert>
        )}

        {serialsData && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {serialsData.trains_with_serials && serialsData.trains_with_serials.length > 0 ? (
              serialsData.trains_with_serials.map((trainData, index) => (
                <Accordion key={index} sx={{ mb: 1 }}>
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    aria-controls={`train-${index}-content`}
                    id={`train-${index}-header`}
                  >
                    <Box display="flex" alignItems="center" width="100%">
                      <Train sx={{ mr: 1, color: 'success.main' }} />
                      <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                        Railcar #{trainData.train_index}
                        <Chip
                          label={`${trainData.serial_count} Reporting marks`}
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Confidence: {(trainData.train_confidence * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails>
                    {trainData.serials && trainData.serials.length > 0 ? (
                      <Grid container spacing={1}>
                        {trainData.serials.map((serial, serialIndex) => (
                          <Grid item xs={12} sm={6} key={serialIndex}>
                            <Box
                              p={2}
                              border={1}
                              borderColor="divider"
                              borderRadius={2}
                              sx={{ backgroundColor: 'grey.50' }}
                            >
                              <Typography variant="body1" sx={{
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                color: 'primary.main'
                              }}>
                                {serial.text}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Cleaned: {serial.cleaned_text}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Confidence: {(serial.confidence * 100).toFixed(1)}%
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No reporting marks detected on this train.
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))
            ) : (
              <Alert severity="info">
                📝 No reporting marks detected in this frame. This may be due to:
                <ul>
                  <li>Reporting marks are not clearly visible</li>
                  <li>Image resolution is insufficient</li>
                  <li>Serial numbers are partially hidden</li>
                </ul>
              </Alert>
            )}

            <Box mt={2} p={2} sx={{ backgroundColor: 'info.light', borderRadius: 2 }}>
              <Typography variant="body2" color="info.contrastText">
                <Analytics sx={{ mr: 1, fontSize: 16 }} />
                <strong>Summary:</strong> {serialsData.total_trains} Railcars detected,
                {serialsData.total_serials} Reporting marks found in total.
              </Typography>
            </Box>
          </motion.div>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FrameDetailsModal;