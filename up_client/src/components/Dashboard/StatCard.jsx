import { Card, Typography, Box } from '@mui/material';
import { motion } from 'framer-motion';

const StatCard = ({ icon, title, value, subtitle }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card sx={{ p: 3, height: '100%' }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {icon}
          <Typography variant="h6" color="text.primary">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" color="primary.main" gutterBottom>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Card>
    </motion.div>
  );
};

export default StatCard;