// CompaniesMap.tsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, Globe } from "lucide-react";
import MapComponent from './MapComponent';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  // ... autres propriétés
}

interface CompaniesMapProps {
  companies: Company[];
  totalCompanies: number;
  heatmapMode?: boolean;
  geocoding: boolean;
  onGeocodeCompanies: () => void;
}

const CompaniesMap = ({ companies, totalCompanies, heatmapMode = false, geocoding, onGeocodeCompanies }: CompaniesMapProps) => {
  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {heatmapMode ? "Concentration de Clients" : "Localisation des Entreprises"}
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span>{heatmapMode ? "Carte de chaleur basée sur la densité des commandes" : "Répartition géographique des entreprises clientes"}</span>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" />
            <span>{companies.length} / {totalCompanies} entreprise{companies.length > 1 ? 's' : ''}</span>
          </div>
          {totalCompanies > companies.length && (
            <Button
              size="sm"
              variant="outline"
              onClick={onGeocodeCompanies}
              disabled={geocoding}
              className="ml-auto"
            >
              <Globe className="w-4 h-4 mr-2" />
              {geocoding ? "Démarrage..." : "Lancer la géolocalisation"}
            </Button>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {companies.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center bg-muted/30 rounded-lg">
            <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
            <div className="text-muted-foreground text-center">
              <p className="font-medium">Aucune entreprise géolocalisée</p>
              <p className="text-sm mt-1">Les entreprises seront affichées ici une fois géolocalisées</p>
            </div>
          </div>
        ) : (
          <MapComponent companies={companies} heatmapMode={heatmapMode} />
        )}
      </CardContent>
    </Card>
  );
};

export default CompaniesMap;