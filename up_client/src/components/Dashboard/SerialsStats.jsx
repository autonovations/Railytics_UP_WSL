import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Grid, 
  List, 
  ListItem, 
  ListItemText,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { motion } from 'framer-motion';
import { 
  QrCode, 
  Analytics, 
  FormatListNumbered 
} from '@mui/icons-material';
import { getSerialsStats } from '../../services/api';

const SerialsStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getSerialsStats();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh stats every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading serial statistics...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        Error loading serial statistics: {error}
      </Alert>
    );
  }

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <QrCode sx={{ mr: 1 }} />
            📋 Detected Serial Numbers Statistics
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center" p={1} sx={{ 
                backgroundColor: 'primary.main', 
                color: 'white', 
                borderRadius: 2 
              }}>
                <Typography variant="h4">{stats.total_serials_detected}</Typography>
                <Typography variant="body2">Total Serials</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center" p={1} sx={{ 
                backgroundColor: 'success.main', 
                color: 'white', 
                borderRadius: 2 
              }}>
                <Typography variant="h4">{stats.unique_serials_count}</Typography>
                <Typography variant="body2">Unique Serials</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center" p={1} sx={{ 
                backgroundColor: 'info.main', 
                color: 'white', 
                borderRadius: 2 
              }}>
                <Typography variant="h4">{stats.total_frames_with_serials}</Typography>
                <Typography variant="body2">Frames with Serials</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center" p={1} sx={{ 
                backgroundColor: 'warning.main', 
                color: 'white', 
                borderRadius: 2 
              }}>
                <Typography variant="h4">{stats.serial_detection_rate}%</Typography>
                <Typography variant="body2">Detection Rate</Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              📊 Average serials per frame: <strong>{stats.average_serials_per_frame}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              🚂 Frames with trains: <strong>{stats.total_frames_with_trains}</strong>
            </Typography>
          </Box>

          {stats.unique_serials && stats.unique_serials.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <FormatListNumbered sx={{ mr: 1 }} />
                Unique Detected Serials ({stats.unique_serials_count})
              </Typography>
              
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                <Grid container spacing={1}>
                  {stats.unique_serials.map((serial, index) => (
                    <Grid item xs="auto" key={index}>
                      <Chip 
                        label={serial} 
                        size="small" 
                        variant="outlined"
                        sx={{ 
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          backgroundColor: 'rgba(25, 118, 210, 0.1)'
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </>
          )}

          {(!stats.unique_serials || stats.unique_serials.length === 0) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              📝 No serial numbers have been detected yet. Serials will appear here when the system detects text on locomotives and cars.
            </Alert>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SerialsStats;