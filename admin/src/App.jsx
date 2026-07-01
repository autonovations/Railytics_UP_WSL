import { useState } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { darkTheme } from './theme';
import AdminDashboard from './components/AdminDashboard';
import StreamManager from './components/StreamManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 1, height: '100%' }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            height: '100vh',
            width: '100vw',
            background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* App Bar */}
          <AppBar position="static" elevation={0} sx={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }}>
            <Toolbar>
              <Typography
                variant="h5"
                component="div"
                sx={{
                  flexGrow: 1,
                  background: 'linear-gradient(45deg, #FFC107 30%, #FF8F00 90%)',
                  WebkitBackgroundClip: 'text',
                  fontWeight: 600,
                }}
              >
                🚉⚙️ Railytics Admin
              </Typography>
            </Toolbar>
          </AppBar>

          <Box sx={{ px: 2, py: 2, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Welcome Message */}
            <Box textAlign="center" mb={2}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  background: 'linear-gradient(45deg, #FFC107 30%, #FF8F00 90%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1,
                  fontWeight: 600,
                }}
              >
                Stream Administration Panel
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Manage YouTube streams for real-time train detection and analysis
              </Typography>
            </Box>

            {/* Navigation Tabs */}
            <Paper sx={{ mb: 2 }}>
              <Tabs
                value={currentTab}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    fontSize: '1rem',
                  },
                }}
              >
                <Tab label="Dashboard" />
                <Tab label="Stream Management" />
              </Tabs>
            </Paper>

            {/* Tab Panels */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <TabPanel value={currentTab} index={0}>
                <AdminDashboard />
              </TabPanel>

              <TabPanel value={currentTab} index={1}>
                <StreamManager />
              </TabPanel>
            </Box>
          </Box>
        </Box>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
