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
import { getFrameImageUrl } from '../../services/api';

const FrameDetailsModal = ({ open, onClose, frame }) => {
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
            </Box>
          </Grid>
        </Grid>
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