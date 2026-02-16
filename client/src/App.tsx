import { useState } from 'react';
import { DayListPage } from './components/DayListPage';
import { DayPage } from './components/DayPage';
import { ToastContainer } from './components/Toast';

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <ToastContainer />
      {selectedDate ? (
        <DayPage
          date={selectedDate}
          onBack={() => setSelectedDate(null)}
        />
      ) : (
        <DayListPage onSelectDay={setSelectedDate} />
      )}
    </div>
  );
}
