import { useState } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Container,
  Box,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider
} from '@mui/material';
import {
  Menu as MenuIcon,
  VideoCall as VideoCallIcon,
  Analytics as AnalyticsIcon,
  Dashboard as DashboardIcon,
  PhotoLibrary as PhotoLibraryIcon
} from '@mui/icons-material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { darkTheme } from './theme';
import Dashboard from './components/Dashboard/Dashboard';
import EventFramesPage from './components/RailwayEvents/EventFramesPage';

// Import logos
import fdLogoWhite from './assets/fd_logo.png';
import railyticsLogo from './assets/railytics_logo.png';
import locomotive from './assets/locomotive.jpeg';
import usa_flag from './assets/usa_flag.jpg';
import up_logo from './assets/up_logo.jpg';

import FrameGrid from './components/FrameGrid/FrameGrid';
import StreamSelection from './components/StreamSelection/StreamSelection';
import RealTimeAnalysis from './components/RealTimeAnalysis/RealTimeAnalysis';

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
      id={`client-tabpanel-${index}`}
      aria-labelledby={`client-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 1 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const handlePageChange = (pageIndex) => {
    setCurrentPage(pageIndex);
    setDrawerOpen(false); // Close drawer when selecting a page
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const menuItems = [
    { label: 'STREAM SELECTION', icon: <VideoCallIcon />, index: 0 },
    { label: 'REAL-TIME ANALYSIS', icon: <AnalyticsIcon />, index: 1 },
    { label: 'DASHBOARD', icon: <DashboardIcon />, index: 2 },
    { label: 'FRAME GALLERY', icon: <PhotoLibraryIcon />, index: 3 }
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #000000 0%, #1a1a00 100%)',
            py: 2,
          }}
        >
          <Container maxWidth={false} sx={{ px: 2 }}>
            {/* Header with three logos and hamburger menu */}
            <Box
              display="flex"
              alignItems="center"
              mb={2}
              sx={{
                px: 2.5,
                py: 1.5,
                background: '#FFAD01',
                backdropFilter: 'blur(10px)',
                minHeight: '100px',
                position: 'fixed', // Change from 'relative' to 'fixed'
                top: 0,           // Pin to top
                left: 0,          // Pin to left
                right: 0,         // Pin to right
                zIndex: 1200,     // Ensure it stays above other content
              }}
            >
              {/* Hamburger Menu Button - Top Left */}
              {/* Hamburger Menu Button */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 80px', // Fixed width for menu area
                height: '100%'
              }}>
                <IconButton
                  onClick={toggleDrawer}
                  sx={{
                    color: '#000000',
                    padding: 2.5,
                    borderRadius: 2,
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.1)',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <MenuIcon sx={{ fontSize: '2.5rem' }} />
                </IconButton>
              </Box>

              {/* Left Logo - Fleet Defender */}
              <Box sx={{
                flex: '0 0 auto',
                maxWidth: '180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                ml: 2 // Reduced margin since menu now has its own space
              }}>
                <img
                  src={up_logo}
                  alt="UP logo"
                  style={{
                    height: '80px',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </Box>

              {/* Center Space - Empty */}
              <Box sx={{ flex: '1' }} />

              {/* Right Logo - Union Pacific */}
              <Box sx={{
                flex: '0 0 auto',
                maxWidth: '180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end'
              }}>
               
               {
                /*
                  <img
                  src={up_logo}
                  alt="Union Pacific Logo"
                  style={{
                    height: '80px',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
                */
               } 
               
              </Box>
            </Box>

            {/* Add a spacer div to prevent content from going under the fixed header */}
            <Box sx={{ height: '96px' }} /> {/* Height should match header height + margins */}

            {/* Side Panel Drawer */}
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              sx={{
                '& .MuiDrawer-paper': {
                  width: 280,
                  backgroundColor: '#1a1a1a',
                  color: 'white',
                  borderRight: '1px solid rgba(255, 193, 7, 0.3)'
                }
              }}
            >
              <Box sx={{
                borderBottom: '1px solid rgba(255, 193, 7, 0.3)',
                width: '100%'
              }}>
{
  
<img
                  src={usa_flag}
                  alt="USA Flag"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                />
  
}
                

              </Box>

              <List>
                {menuItems.map((item) => (
                  <ListItem key={item.index} disablePadding>
                    <ListItemButton
                      onClick={() => handlePageChange(item.index)}
                      sx={{
                        py: 1.5,
                        '&:hover': {
                          backgroundColor: 'rgba(255, 193, 7, 0.1)'
                        },
                        backgroundColor: currentPage === item.index ? 'rgba(255, 193, 7, 0.2)' : 'transparent'
                      }}
                    >
                      <ListItemIcon sx={{ color: '#FFC107', minWidth: 40 }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        sx={{
                          '& .MuiTypography-root': {
                            fontWeight: currentPage === item.index ? 600 : 400,
                            color: currentPage === item.index ? '#FFC107' : 'white'
                          }
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Drawer>


            {/* Content Panels with routes */}
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <TabPanel value={currentPage} index={0}>
                      <StreamSelection />
                    </TabPanel>

                    <TabPanel value={currentPage} index={1}>
                      <RealTimeAnalysis />
                    </TabPanel>

                    <TabPanel value={currentPage} index={2}>
                      <Dashboard />
                    </TabPanel>

                    <TabPanel value={currentPage} index={3}>
                      <FrameGrid />
                    </TabPanel>
                  </>
                }
              />
              <Route path="/events/:eventId" element={<EventFramesPage />} />
            </Routes>
          </Container>
        </Box>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;