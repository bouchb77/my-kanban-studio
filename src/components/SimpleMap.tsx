import React from 'react';
import { CompanyOrderPeriod } from '@/hooks/useCompanyOrderStats';

interface SimpleMapProps {
  companies: CompanyOrderPeriod[];
  centerLocation: { lat: number; lng: number } | null;
  isochronePolygon: { lat: number; lng: number}[];
  maxThreshold: number;
}

const SimpleMap: React.FC<SimpleMapProps> = ({ 
  companies, 
  centerLocation, 
  isochronePolygon, 
  maxThreshold 
}) => {
  return (
    <div className="w-full h-[600px] relative">
      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border flex flex-col">
        {/* Header */}
        <div className="p-4 bg-white/80 backdrop-blur-sm rounded-t-lg border-b">
          <h3 className="font-semibold text-lg">Visualisation des données</h3>
          <p className="text-sm text-muted-foreground">
            {companies.length} entreprises • Seuil: {maxThreshold.toLocaleString()}€
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-4">
          {centerLocation && (
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                Centre de recherche
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Latitude: {centerLocation.lat.toFixed(6)}, Longitude: {centerLocation.lng.toFixed(6)}
              </p>
            </div>
          )}

          {isochronePolygon.length > 0 && (
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Zone isochrone
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {isochronePolygon.length} points définissent la zone accessible
              </p>
            </div>
          )}

          {companies.length > 0 && (
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Entreprises trouvées
              </h4>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {companies.slice(0, 5).map((company, index) => (
                  <div key={company.sipi_number} className="text-sm">
                    <span className="font-medium">{company.company_name}</span>
                    <span className="text-muted-foreground ml-2">
                      ({company.city}) - {company.maxAmount.toLocaleString()}€
                    </span>
                  </div>
                ))}
                {companies.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ... et {companies.length - 5} autres entreprises
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 bg-white/80 backdrop-blur-sm rounded-b-lg border-t">
          <h4 className="font-medium mb-2 text-sm">Légende</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Point de départ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Zone isochrone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Entreprises trouvées</span>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
        Carte interactive temporairement désactivée
      </div>
    </div>
  );
};

export default SimpleMap;