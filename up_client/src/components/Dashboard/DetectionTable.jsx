import { useState, useEffect } from 'react';
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
  TableSortLabel,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Train as TrainIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Badge as BadgeIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { getDetections, getFrameImageUrl } from '../../services/api';
import { motion } from 'framer-motion';
import DetectionImageModal from './DetectionImageModal';

const DetectionTable = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState('timestamp');
  const [order, setOrder] = useState('desc');
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { 
    data: detectionsData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['detections', page + 1, rowsPerPage],
    queryFn: () => getDetections(page + 1, rowsPerPage),
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3,
    retryDelay: 1000,
  });

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleImageClick = (detection) => {
    setSelectedDetection(detection);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedDetection(null);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getReportingMarkChip = (reportingMark, confidence) => {
    const isRegistered = reportingMark !== 'not registered';
    return (
      <Chip
        icon={<BadgeIcon />}
        label={reportingMark}
        color={isRegistered ? 'success' : 'default'}
        variant={isRegistered ? 'filled' : 'outlined'}
        size="small"
        title={confidence ? `Confidence: ${(confidence * 100).toFixed(1)}%` : ''}
      />
    );
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'success.main';
    if (confidence >= 0.6) return 'warning.main';
    return 'error.main';
  };

  // Filter detections based on search term
  const filteredDetections = detectionsData?.detections?.filter(detection =>
    detection.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    detection.reporting_mark.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (error) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Alert severity="error">
          <strong>Error loading detections:</strong> {error.message}
        </Alert>
      </Paper>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Paper sx={{ mt: 3 }}>
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center' }}>
              <TrainIcon sx={{ mr: 1, color: 'primary.main' }} />
              Registros de Detecciones
            </Typography>
            <Tooltip title="Refresh data">
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Search and Info */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <TextField
              placeholder="Buscar por ubicación o número serial..."
              value={searchTerm}
              onChange={handleSearchChange}
              variant="outlined"
              size="small"
              sx={{ width: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            
            {detectionsData && (
              <Typography variant="body2" color="text.secondary">
                Mostrando {filteredDetections.length} de {detectionsData.total} detecciones
                {detectionsData.estimated_total && (
                  <> (estimado: {detectionsData.estimated_total} total)</>
                )}
              </Typography>
            )}
          </Box>

          {/* Summary Cards */}
          {detectionsData && (
            <Box display="flex" gap={2} flexWrap="wrap">
              <Chip
                icon={<LocationIcon />}
                label={`${detectionsData.total_frames || 0} frames procesados`}
                color="info"
                variant="outlined"
              />
              <Chip
                icon={<TrainIcon />}
                label={`${detectionsData.total || 0} detecciones`}
                color="primary"
                variant="outlined"
              />
              <Chip
                icon={<BadgeIcon />}
                label={`${filteredDetections.filter(d => d.reporting_mark !== 'not registered').length} con serial`}
                color="success"
                variant="outlined"
              />
            </Box>
          )}
        </Box>

        {/* Table */}
        <TableContainer>
          {isLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" p={4}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Cargando detecciones...
              </Typography>
            </Box>
          ) : (
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ width: 80 }}>
                    <Box display="flex" alignItems="center" justifyContent="center">
                      <ImageIcon sx={{ mr: 1, fontSize: 18 }} />
                      <strong>Image</strong>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <LocationIcon sx={{ mr: 1, fontSize: 18 }} />
                      <strong>Location</strong>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <ScheduleIcon sx={{ mr: 1, fontSize: 18 }} />
                      <strong>Timestamp</strong>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <BadgeIcon sx={{ mr: 1, fontSize: 18 }} />
                      <strong>Reporting Mark</strong>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <strong>Confidence</strong>
                  </TableCell>
                  <TableCell align="center">
                    <strong>Type</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDetections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {searchTerm ? 'No se encontraron detecciones que coincidan con la búsqueda' : 'No hay detecciones disponibles'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDetections.map((detection, index) => (
                    <TableRow
                      key={`${detection.timestamp}-${index}`}
                      hover
                      sx={{
                        '&:nth-of-type(odd)': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <TableCell align="center">
                        {detection.filename ? (
                          <Tooltip title="Click to view full image">
                            <IconButton 
                              onClick={() => handleImageClick(detection)}
                              sx={{ p: 0.5 }}
                            >
                              <Avatar
                                src={getFrameImageUrl(detection.filename)}
                                alt="Detection frame"
                                sx={{ 
                                  width: 48, 
                                  height: 48,
                                  cursor: 'pointer',
                                  border: '2px solid',
                                  borderColor: 'primary.main',
                                  '&:hover': {
                                    borderColor: 'primary.dark',
                                    transform: 'scale(1.05)'
                                  },
                                  transition: 'all 0.2s ease-in-out'
                                }}
                              >
                                <ImageIcon />
                              </Avatar>
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Avatar sx={{ width: 48, height: 48, bgcolor: 'grey.300' }}>
                            <ImageIcon color="disabled" />
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {detection.location}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {formatTimestamp(detection.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {getReportingMarkChip(detection.reporting_mark, detection.confidence)}
                      </TableCell>
                      <TableCell align="center">
                        {detection.confidence !== undefined && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: getConfidenceColor(detection.confidence),
                              fontWeight: 'bold'
                            }}
                          >
                            {(detection.confidence * 100).toFixed(1)}%
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={detection.detection_type || 'Train'}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {/* Pagination */}
        {detectionsData && !isLoading && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={detectionsData.estimated_total || detectionsData.total || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Filas por página:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
            }
          />
        )}
      </Paper>

      {/* Image Modal */}
      <DetectionImageModal
        open={modalOpen}
        onClose={handleCloseModal}
        detection={selectedDetection}
      />
    </motion.div>
  );
};

export default DetectionTable;
