import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  ShoppingCart,
  Euro,
  Calendar as CalendarIcon,
  TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrders } from "@/hooks/useOrders";
import SimpleHeatmapMap from "@/components/SimpleHeatmapMap";
import InteractiveMap from "@/components/InteractiveMap";
import CompaniesTable from "@/components/CompaniesTable";

const ReportingPage = () => {
  const { orderStats, loading: ordersLoading } = useOrders();
  
  // State for date filters
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  
  // State for filtered companies from table
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);

  // Filtrer pour n'afficher que les 3 dernières années (année en cours, N-1, N-2)
  const filteredOrderStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return orderStats
      .filter(stat => stat.year >= currentYear - 2 && stat.year <= currentYear)
      .sort((a, b) => b.year - a.year);
  }, [orderStats]);

  // Calculs des totaux GÉNÉRAUX (toutes les commandes)
  const totalOrders = orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0);
  const totalAmount = orderStats.reduce((sum, stat) => sum + stat.totalAmount, 0);

  // Calculs des totaux du TABLEAU (uniquement entreprises géolocalisées affichées)
  const tableStats = useMemo(() => {
    const stats2023 = filteredCompanies.reduce((sum, c) => sum + (c.amount_2023 || 0), 0);
    const stats2024 = filteredCompanies.reduce((sum, c) => sum + (c.amount_2024 || 0), 0);
    const stats2025 = filteredCompanies.reduce((sum, c) => sum + (c.amount_2025 || 0), 0);
    const totalTable = stats2023 + stats2024 + stats2025;
    
    return {
      amount_2023: stats2023,
      amount_2024: stats2024,
      amount_2025: stats2025,
      total: totalTable,
      companies: filteredCompanies.length
    };
  }, [filteredCompanies]);

  if (ordersLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reporting</h1>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Statistiques des commandes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Statistiques des Commandes
          </CardTitle>
          <CardDescription>
            Toutes les commandes de la base de données (incluant entreprises non géolocalisées)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Commandes</span>
              </div>
              <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Chiffre d'Affaires Total</span>
              </div>
              <div className="text-2xl font-bold">{totalAmount.toLocaleString()} €</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Années Actives</span>
              </div>
              <div className="text-2xl font-bold">{orderStats.length}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Moyenne/An</span>
              </div>
              <div className="text-2xl font-bold">
                {orderStats.length > 0 ? Math.round(totalOrders / orderStats.length).toLocaleString() : 0}
              </div>
            </div>
          </div>


          {/* Détail par année - version compacte */}
          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-sm">Détail par Année (3 dernières années)</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredOrderStats.map((stat) => (
                <div key={stat.year} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="text-xs">{stat.year}</Badge>
                    <div>
                      <p className="font-medium text-sm">{stat.totalOrders} commandes</p>
                      <p className="text-xs text-muted-foreground">
                        {stat.totalAmount.toLocaleString()} €
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">
                      {stat.totalOrders > 0 ? Math.round(stat.totalAmount / stat.totalOrders).toLocaleString() : 0} €
                    </p>
                    <p className="text-xs text-muted-foreground">Moy.</p>
                  </div>
                </div>
              ))}
              {filteredOrderStats.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carte interactive et carte de chaleur dans le même encart */}
      <Card>
        <CardHeader>
          <CardTitle>Analyse Géographique des Clients</CardTitle>
          <CardDescription>Visualisation interactive et carte de chaleur des entreprises</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Colonne 1: Carte de chaleur */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Carte de Chaleur</h3>
              <SimpleHeatmapMap companies={filteredCompanies} />
            </div>

            {/* Colonne 2: Carte interactive avec points */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Carte Interactive</h3>
              <InteractiveMap 
                startDate={startDate}
                endDate={endDate}
                companies={filteredCompanies}
              />
            </div>
          </div>
          
          {/* Tableau des entreprises avec filtres */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Tableau des Entreprises et Filtres</h3>
            <CompaniesTable 
              startDate={startDate}
              endDate={endDate}
              onDateChange={{
                setStartDate,
                setEndDate
              }}
              onFilteredDataChange={setFilteredCompanies}
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default ReportingPage;