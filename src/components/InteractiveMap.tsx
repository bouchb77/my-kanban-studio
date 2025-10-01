import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MapComponent from './MapComponent';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  city: string;
  general_department: string;
}

interface InteractiveMapProps {
  startDate?: Date;
  endDate?: Date;
  companies?: Company[];
}

const InteractiveMap = ({ startDate, endDate, companies: externalCompanies }: InteractiveMapProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCompaniesForMap = async () => {
    setLoading(true);
    try {
      let allCompanies: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, city, general_department')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('Error loading companies for map:', error);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          allCompanies = [...allCompanies, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total entreprises chargées pour carte interactive: ${allCompanies.length}`);
      setCompanies(allCompanies);
      setLoading(false);
    } catch (error) {
      console.error('Error loading companies for map:', error);
      setLoading(false);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les données pour la carte.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    // If external companies are provided, use them
    if (externalCompanies) {
      setCompanies(externalCompanies);
      setLoading(false);
      return;
    }

    fetchCompaniesForMap();
  }, [externalCompanies]);

  if (loading) {
    return (
      <div className="w-full h-[400px] rounded-lg border bg-muted/10 flex items-center justify-center">
        <div className="text-center space-y-2">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto animate-pulse" />
          <p className="text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/20">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Aucune entreprise géolocalisée trouvée
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] rounded-lg border">
      <MapComponent companies={companies} />
    </div>
  );
};

export default InteractiveMap;