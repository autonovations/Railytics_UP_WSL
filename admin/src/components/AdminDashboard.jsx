import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Tabs,
  Tab,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Timeline as ActivityIcon,
  Computer as SystemIcon,
} from '@mui/icons-material';
import StreamMetrics from './Dashboard/StreamMetrics';
import SystemStatus from './Dashboard/SystemStatus';
import RecentActivity from './Dashboard/RecentActivity';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const TabPanel = ({ children, value, index, ...other }) => (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)',
      color: '#ffffff'
    }}>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #FFB000, #FFC733)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Railytics Admin Dashboard
          </Typography>
          <Typography variant="subtitle1" sx={{ color: '#cccccc' }}>
            Real-time monitoring and control center for railway detection system
          </Typography>
          <Divider sx={{
            mt: 2,
            borderColor: '#FFB000',
            borderWidth: '2px'
          }} />
        </Box>

        <Paper sx={{
          width: '100%',
          mb: 2,
          backgroundColor: '#2a2a2a',
          border: '1px solid #404040',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #FFB000, #FFC733)'
          }
        }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="admin dashboard tabs"
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: '#404040',
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 'medium',
                color: '#cccccc',
                '&.Mui-selected': {
                  color: '#FFB000',
                  fontWeight: 'bold'
                },
                '&:hover': {
                  color: '#FFC733',
                  backgroundColor: 'rgba(255, 176, 0, 0.05)'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#FFB000',
                height: '3px'
              }
            }}
          >
            <Tab
              icon={<DashboardIcon />}
              label="Analytics Dashboard"
              iconPosition="start"
              sx={{ gap: 1 }}
            />
            <Tab
              icon={<ActivityIcon />}
              label="Recent Activity"
              iconPosition="start"
              sx={{ gap: 1 }}
            />
            <Tab
              icon={<SystemIcon />}
              label="System Status"
              iconPosition="start"
              sx={{ gap: 1 }}
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <StreamMetrics />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <RecentActivity />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <SystemStatus />
          </TabPanel>
        </Paper>
      </Container>
    </Box>
  );
};

export default AdminDashboard;