import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, Calendar, Euro } from 'lucide-react';
import { useEncryptedCompanies } from '@/hooks/useEncryptedCompanies';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Order {
  order_number: string;
  order_date: string;
  amount: number;
  status: string;
}

interface OrderDetail {
  article_code: string;
  quantity: number;
}

const SalonPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { companies } = useEncryptedCompanies();

  const handleSearch = () => {
    if (!searchTerm.trim()) return;

    const found = companies.find(
      (c) =>
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.sipiNumber?.includes(searchTerm)
    );

    setSelectedCompany(found || null);
    if (found) {
      loadOrders(found.sipiNumber);
    } else {
      setOrders([]);
      setOrderDetails([]);
    }
  };

  const loadOrders = async (sipiNumber: string) => {
    setLoading(true);
    try {
      // Charger les commandes
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('sipi_number', sipiNumber)
        .order('order_date', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Charger les détails des commandes
      if (ordersData && ordersData.length > 0) {
        const orderNumbers = ordersData.map((o) => o.order_number);
        const { data: detailsData, error: detailsError } = await supabase
          .from('order_details')
          .select('*')
          .in('order_number', orderNumbers);

        if (detailsError) throw detailsError;

        // Grouper les articles par code
        const articlesMap = new Map<string, number>();
        detailsData?.forEach((detail) => {
          const current = articlesMap.get(detail.article_code) || 0;
          articlesMap.set(detail.article_code, current + detail.quantity);
        });

        const groupedDetails = Array.from(articlesMap.entries()).map(([article_code, quantity]) => ({
          article_code,
          quantity,
        }));

        setOrderDetails(groupedDetails);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.amount), 0);
  const lastOrderDate = orders.length > 0 ? orders[0].order_date : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Recherche Salon</h1>
        <p className="text-muted-foreground">
          Recherchez rapidement les informations clients et leurs commandes
        </p>
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Rechercher une entreprise</CardTitle>
          <CardDescription>
            Entrez le nom de l'entreprise ou le numéro SIPI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nom de l'entreprise ou numéro SIPI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Rechercher
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Résultats */}
      {selectedCompany && (
        <>
          {/* Informations entreprise */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedCompany.companyName}</CardTitle>
                  <CardDescription>SIPI: {selectedCompany.sipiNumber}</CardDescription>
                </div>
                <Badge variant={selectedCompany.quality === 'CLIENT' ? 'default' : 'secondary'}>
                  {selectedCompany.quality || 'N/A'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dernière commande</p>
                    <p className="font-semibold">
                      {lastOrderDate ? format(new Date(lastOrderDate), 'dd/MM/yyyy', { locale: fr }) : 'Aucune'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Euro className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Montant total</p>
                    <p className="font-semibold">{totalAmount.toLocaleString('fr-FR')} €</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre de commandes</p>
                    <p className="font-semibold">{orders.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Produits commandés */}
              <Card>
                <CardHeader>
                  <CardTitle>Produits commandés</CardTitle>
                  <CardDescription>
                    Liste des articles commandés avec quantités totales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {orderDetails.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {orderDetails.map((detail) => (
                        <div
                          key={detail.article_code}
                          className="p-4 border rounded-lg bg-card"
                        >
                          <p className="font-semibold text-lg">{detail.article_code}</p>
                          <p className="text-sm text-muted-foreground">
                            Quantité: {detail.quantity}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Aucun produit commandé
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Historique des commandes */}
              <Card>
                <CardHeader>
                  <CardTitle>Historique des commandes</CardTitle>
                  <CardDescription>
                    Détail de toutes les commandes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {orders.length > 0 ? (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>N° Commande</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                            <TableHead>Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((order) => (
                            <TableRow key={order.order_number}>
                              <TableCell className="font-mono">
                                {order.order_number}
                              </TableCell>
                              <TableCell>
                                {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: fr })}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {Number(order.amount).toLocaleString('fr-FR')} €
                              </TableCell>
                              <TableCell>
                                <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                                  {order.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Aucune commande trouvée
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {searchTerm && !selectedCompany && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Aucune entreprise trouvée pour "{searchTerm}"
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SalonPage;
