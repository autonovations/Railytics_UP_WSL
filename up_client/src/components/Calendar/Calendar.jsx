import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Grid,
  Button
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Event as EventIcon
} from '@mui/icons-material';

const Calendar = ({ onDateSelect, selectedDate, highlightedDates = [] }) => {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const handlePreviousMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const handleDateClick = (day) => {
    if (!day) return;
    const date = new Date(currentYear, currentMonth, day);
    onDateSelect && onDateSelect(date);
  };

  const isDateHighlighted = (day) => {
    if (!day || !highlightedDates.length) return false;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return highlightedDates.includes(dateStr);
  };

  const isDateSelected = (day) => {
    if (!day || !selectedDate) return false;
    const checkDate = new Date(currentYear, currentMonth, day);
    return checkDate.toDateString() === new Date(selectedDate).toDateString();
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    const checkDate = new Date(currentYear, currentMonth, day);
    return checkDate.toDateString() === today.toDateString();
  };

  return (
    <Paper
      elevation={3}
      sx={{
        backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255, 173, 1, 0.2)',
        borderRadius: 3,
        p: 3,
        width: '100%',
        maxWidth: 520,
        mx: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: '1.5rem' }}>
          {months[currentMonth]} {currentYear}
        </Typography>

        <Box display="flex" gap={1}>
          <IconButton
            onClick={handlePreviousMonth}
            size="small"
            sx={{
              color: '#FFC107',
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              borderRadius: 2,
              width: 36,
              height: 36,
              '&:hover': { 
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            onClick={handleNextMonth}
            size="small"
            sx={{
              color: '#FFC107',
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              borderRadius: 2,
              width: 36,
              height: 36,
              '&:hover': { 
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={0} sx={{ mb: 2 }}>
        {weekDays.map((day, index) => (
          <Grid item xs={12/7} key={index}>
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{
                height: 48,
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.875rem',
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}
            >
              {day}
            </Box>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={0.5}>
        {calendarDays.map((day, index) => (
          <Grid item xs={12/7} key={index}>
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{ height: 56, p: 0.5 }}
            >
              {day && (
                <Button
                  onClick={() => handleDateClick(day)}
                  sx={{
                    minWidth: 44,
                    height: 44,
                    borderRadius: 2,
                    color: isDateSelected(day) ? '#000' :
                           isToday(day) ? '#000' : 
                           isDateHighlighted(day) ? '#FFC107' : 
                           'rgba(255, 255, 255, 0.8)',
                    backgroundColor: isDateSelected(day) ? '#4CAF50' :
                                   isToday(day) ? '#FFC107' :
                                   isDateHighlighted(day) ? 'rgba(100, 181, 246, 0.8)' :
                                   'transparent',
                    fontSize: '0.95rem',
                    fontWeight: isDateSelected(day) || isToday(day) ? 700 : 
                               isDateHighlighted(day) ? 600 : 500,
                    border: isDateHighlighted(day) && !isDateSelected(day) && !isToday(day) ? 
                           '1px solid rgba(100, 181, 246, 0.5)' : 'none',
                    '&:hover': {
                      backgroundColor: isDateSelected(day) ? '#66BB6A' :
                                     isToday(day) ? '#FFD54F' :
                                     isDateHighlighted(day) ? 'rgba(100, 181, 246, 0.9)' :
                                     'rgba(255, 255, 255, 0.1)',
                      color: isDateSelected(day) || isToday(day) ? '#000' : 
                            isDateHighlighted(day) ? '#000' : '#FFC107',
                      transform: 'scale(1.05)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {day}
                </Button>
              )}
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box mt={4} pt={3} borderTop="1px solid rgba(255, 255, 255, 0.08)">
        <Box display="flex" justifyContent="center" gap={4}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: 1,
                backgroundColor: '#FFC107'
              }}
            />
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
              Today
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: 1,
                backgroundColor: '#4CAF50'
              }}
            />
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
              Selected
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: 1,
                backgroundColor: 'rgba(100, 181, 246, 0.8)',
                border: '1px solid rgba(100, 181, 246, 0.5)'
              }}
            />
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
              Events
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default Calendar;