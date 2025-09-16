import React from 'react';
import CompaniesMap from "@/components/CompaniesMap";

const ReportingPageSimple = () => {
  console.log('ReportingPageSimple rendering...');
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Test Carte</h1>
      <CompaniesMap clientTypeFilter="all" />
    </div>
  );
};

export default ReportingPageSimple;