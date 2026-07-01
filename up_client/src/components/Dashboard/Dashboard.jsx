import RailwayEventsTable from '../RailwayEvents/RailwayEventsTable';
import { motion } from 'framer-motion';

const Dashboard = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Railway Events Table */}
      <RailwayEventsTable />
    </motion.div>
  );
};

export default Dashboard;