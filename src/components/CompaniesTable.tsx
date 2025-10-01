import React from 'react';
import CompaniesTableOnly from './CompaniesTableOnly';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

interface CompaniesTableProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange?: {
    setStartDate: (date: Date | undefined) => void;
    setEndDate: (date: Date | undefined) => void;
  };
  onFilteredDataChange?: (companies: Company[]) => void;
}

const CompaniesTable = ({ startDate, endDate, onDateChange, onFilteredDataChange }: CompaniesTableProps) => {
  return (
    <CompaniesTableOnly 
      startDate={startDate}
      endDate={endDate}
      onDateChange={onDateChange}
      onFilteredDataChange={onFilteredDataChange}
    />
  );
};

export default CompaniesTable;