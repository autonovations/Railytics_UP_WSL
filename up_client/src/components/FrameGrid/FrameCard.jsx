import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  Box,
  Skeleton,
} from '@mui/material';
import { Train, Block, Error, QrCode } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { getFrameImageUrl } from '../../services/api';

const FrameCard = ({ frame, onImageClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const date = new Date(frame.timestamp);
  const formattedDate = date.toLocaleString();
  const size = (frame.size / 1024).toFixed(1);
  const hasTrains = frame.has_trains || frame.detection_count > 0;

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const handleImageClick = () => {
    if (!imageError) {
      onImageClick(frame);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card sx={{ height: '100%', cursor: imageError ? 'default' : 'pointer' }}>
        <Box sx={{ position: 'relative', height: 200 }}>
          {!imageLoaded && (
            <Skeleton
              variant="rectangular"
              height={200}
              sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}
            />
          )}

          {imageError ? (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              height={200}
              bgcolor="grey.100"
              color="text.secondary"
            >
              <Error fontSize="large" />
              <Typography variant="body2" ml={1}>
                Error loading image
              </Typography>
            </Box>
          ) : (
            <CardMedia
              component="img"
              height="200"
              image={getFrameImageUrl(frame.filename)}
              alt={`Frame ${frame.filename}`}
              onClick={handleImageClick}
              onLoad={handleImageLoad}
              onError={handleImageError}
              sx={{
                objectFit: 'cover',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out'
              }}
            />
          )}
        </Box>

        <CardContent>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            gutterBottom
            sx={{ fontSize: '0.75rem' }}
          >
            {formattedDate}
          </Typography>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            📁 {size} KB
          </Typography>

          <Box mt={1}>
            <Chip
              icon={hasTrains ? <Train /> : <Block />}
              label={
                hasTrains
                  ? `${frame.detection_count || 1} Railcar`
                  : 'No Railcars'
              }
              color={hasTrains ? 'success' : 'error'}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>

          {/* Serials information */}
          {hasTrains && frame.total_serials !== undefined && (
            <Box mt={1}>
              <Chip
                icon={<QrCode />}
                label={`${frame.total_serials || 0} Reporting Marks`}
                color={frame.total_serials > 0 ? 'primary' : 'default'}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            </Box>
          )}

          {/* Additional info for frames with trains */}
          {hasTrains && frame.detections && frame.detections.length > 0 && (
            <Box mt={1}>
              <Typography variant="caption" color="text.secondary">
                🎯 Average confidence:: {
                  (frame.detections.reduce((sum, det) => sum + det.confidence, 0) / frame.detections.length * 100).toFixed(1)
                }%
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default FrameCard;