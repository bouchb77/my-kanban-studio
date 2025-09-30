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
import HeatmapMap from "@/components/HeatmapMap";
import CompaniesMap from "@/components/CompaniesMap";

const ReportingPage = () => {
  const { orderStats, loading: ordersLoading } = useOrders();
  
  // State for date filters
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Calculs des totaux
  const totalOrders = orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0);
  const totalAmount = orderStats.reduce((sum, stat) => sum + stat.totalAmount, 0);

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
                <span className="text-sm text-muted-foreground">Chiffre d'Affaires</span>
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
            <h4 className="font-medium text-sm">Détail par Année</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {orderStats.map((stat) => (
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
              {orderStats.length === 0 && (
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne 1: Carte de chaleur */}
            <div>
              <HeatmapMap />
            </div>

            {/* Colonne 2: Carte interactive avec points */}
            <div>
              <CompaniesMap 
                startDate={startDate}
                endDate={endDate}
                onDateChange={{
                  setStartDate,
                  setEndDate
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default ReportingPage;