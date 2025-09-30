import React from 'react';
import CompaniesTableOnly from './CompaniesTableOnly';

interface CompaniesTableProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange?: {
    setStartDate: (date: Date | undefined) => void;
    setEndDate: (date: Date | undefined) => void;
  };
}

const CompaniesTable = ({ startDate, endDate, onDateChange }: CompaniesTableProps) => {
  return (
    <CompaniesTableOnly 
      startDate={startDate}
      endDate={endDate}
      onDateChange={onDateChange}
    />
  );
};

export default CompaniesTable;