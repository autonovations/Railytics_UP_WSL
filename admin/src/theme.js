import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFB000', // Primary yellow from report_1.html
      light: '#FFC733', // Secondary yellow from report_1.html
      dark: '#E09900',
      contrastText: '#1a1a1a',
    },
    secondary: {
      main: '#3b82f6', // Accent blue from report_1.html
      light: '#60a5fa',
      dark: '#2563eb',
      contrastText: '#ffffff',
    },
    background: {
      default: '#1a1a1a', // Dark background from report_1.html
      paper: '#2a2a2a', // Card background from report_1.html
    },
    text: {
      primary: '#ffffff', // Text primary from report_1.html
      secondary: '#cccccc', // Text secondary from report_1.html
    },
    divider: '#404040', // Border color from report_1.html
    error: {
      main: '#ef4444', // Danger red from report_1.html
      light: '#f87171',
      dark: '#dc2626',
    },
    success: {
      main: '#22c55e', // Success green from report_1.html
      light: '#4ade80',
      dark: '#16a34a',
    },
    warning: {
      main: '#f59e0b', // Warning orange from report_1.html
      light: '#fbbf24',
      dark: '#d97706',
    },
    info: {
      main: '#3b82f6', // Using accent blue for info
      light: '#60a5fa',
      dark: '#2563eb',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)',
          minHeight: '100vh',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          border: '1px solid #404040',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #FFB000, #FFC733)',
          },
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 30px rgba(255, 176, 0, 0.15)',
            borderColor: '#FFB000',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
          transition: 'all 0.3s ease',
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #FFB000, #FFC733)',
          color: '#1a1a1a',
          '&:hover': {
            background: 'linear-gradient(45deg, #FFC733, #FFD966)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(255, 176, 0, 0.3)',
          },
        },
        containedSecondary: {
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#2563eb',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: '20px',
        },
        colorPrimary: {
          backgroundColor: '#FFB000',
          color: '#1a1a1a',
          fontWeight: 'bold',
        },
        colorSecondary: {
          backgroundColor: '#3b82f6',
          color: '#ffffff',
        },
        colorSuccess: {
          backgroundColor: '#22c55e',
          color: '#ffffff',
        },
        colorWarning: {
          backgroundColor: '#f59e0b',
          color: '#1a1a1a',
        },
        colorError: {
          backgroundColor: '#ef4444',
          color: '#ffffff',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          border: '1px solid #404040',
          borderRadius: '16px',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: '#FFB000',
          height: '3px',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: '#cccccc',
          '&.Mui-selected': {
            color: '#FFB000',
            fontWeight: 'bold',
          },
          '&:hover': {
            color: '#FFC733',
            backgroundColor: 'rgba(255, 176, 0, 0.05)',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 176, 0, 0.1)',
          borderRadius: '4px',
          '& .MuiLinearProgress-bar': {
            backgroundColor: '#FFB000',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          border: '1px solid',
        },
        standardInfo: {
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: '#3b82f6',
          color: '#ffffff',
        },
        standardWarning: {
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: '#f59e0b',
          color: '#ffffff',
        },
        standardError: {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: '#ef4444',
          color: '#ffffff',
        },
        standardSuccess: {
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderColor: '#22c55e',
          color: '#ffffff',
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        h3: {
          fontWeight: 700,
        },
        h4: {
          fontWeight: 600,
        },
        h5: {
          fontWeight: 600,
        },
        h6: {
          fontWeight: 600,
        },
      },
    },
  },
});