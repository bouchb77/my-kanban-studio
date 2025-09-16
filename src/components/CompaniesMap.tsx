import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building2 } from "lucide-react";

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
}

const CompaniesMap = () => {
  console.log('CompaniesMap component rendering...');
  
  return (
    <div className="bg-red-500 p-8 text-white font-bold text-center text-xl border-4 border-black">
      🚨 TEST COMPOSANT CARTE VISIBLE 🚨
    </div>
  );
};

export default CompaniesMap;