import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFC107', // Amber/Yellow primary
      light: '#FFD54F', // Light yellow
      dark: '#FF8F00', // Dark amber
    },
    secondary: {
      main: '#FFEB3B', // Bright yellow secondary
      light: '#FFFF8D',
      dark: '#FBC02D',
    },
    background: {
      default: '#000000', // Pure black
      paper: '#0a0a0a', // Very dark background for cards
    },
    error: {
      main: '#f56565',
    },
    success: {
      main: '#4CAF50',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      marginBottom: '1rem',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '15px',
          border: '1px solid rgba(255, 193, 7, 0.2)', // Yellow border
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});