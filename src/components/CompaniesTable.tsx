import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CompaniesMap from './CompaniesMap';

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
    <Card>
      <CardHeader>
        <CardTitle>Tableau des Entreprises et Filtres</CardTitle>
        <CardDescription>
          Analyse détaillée des données clients avec filtres avancés
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CompaniesMap 
          startDate={startDate}
          endDate={endDate}
          onDateChange={onDateChange}
        />
      </CardContent>
    </Card>
  );
};

export default CompaniesTable;