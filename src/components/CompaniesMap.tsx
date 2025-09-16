import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

const CompaniesMap = () => {
  console.log('🗺️ CompaniesMap rendering...');
  
  return (
    <div className="w-full bg-red-500 p-8 text-white text-center">
      <h2 className="text-2xl font-bold mb-4">🚨 COMPOSANT CARTE VISIBLE 🚨</h2>
      <p>Si vous voyez ceci, le composant fonctionne !</p>
      <Card className="mt-4 bg-white text-black">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises - TEST
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-blue-100 flex items-center justify-center">
            <p>Zone de la future carte</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompaniesMap;