import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, Calendar, Euro, Filter, X, MessageSquare, Send } from 'lucide-react';
import { useEncryptedCompanies } from '@/hooks/useEncryptedCompanies';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

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

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

const SalonPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const { companies } = useEncryptedCompanies();
  const { user } = useAuth();

  // Extraire les départements et villes uniques des résultats
  const uniqueDepartments = useMemo(() => {
    const depts = new Set(
      searchResults
        .map((c) => c.generalDepartment)
        .filter((d) => d && d !== '')
    );
    return Array.from(depts).sort();
  }, [searchResults]);

  const uniqueCities = useMemo(() => {
    const cities = new Set(
      searchResults
        .filter((c) => selectedDepartment === 'all' || c.generalDepartment === selectedDepartment)
        .map((c) => c.city)
        .filter((c) => c && c !== '')
    );
    return Array.from(cities).sort();
  }, [searchResults, selectedDepartment]);

  // Filtrer les résultats
  const filteredResults = useMemo(() => {
    return searchResults.filter((company) => {
      const matchDept = selectedDepartment === 'all' || company.generalDepartment === selectedDepartment;
      const matchCity = selectedCity === 'all' || company.city === selectedCity;
      return matchDept && matchCity;
    });
  }, [searchResults, selectedDepartment, selectedCity]);

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSelectedDepartment('all');
      setSelectedCity('all');
      return;
    }

    const results = companies.filter(
      (c) =>
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.sipiNumber?.includes(searchTerm)
    );

    setSearchResults(results);
    setSelectedCompany(null);
    setSelectedDepartment('all');
    setSelectedCity('all');
    setOrders([]);
    setOrderDetails([]);
  };

  const handleSelectCompany = (company: any) => {
    setSelectedCompany(company);
    loadOrders(company.sipiNumber);
    loadComments(company.id);
  };

  const loadComments = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_comments')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedCompany || !user) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('company_comments')
        .insert({
          company_id: selectedCompany.id,
          user_id: user.id,
          comment: newComment.trim(),
        });

      if (error) throw error;

      toast({
        title: 'Commentaire ajouté',
        description: 'Votre commentaire a été enregistré avec succès.',
      });

      setNewComment('');
      loadComments(selectedCompany.id);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter le commentaire.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
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

      {/* Liste des résultats */}
      {searchResults.length > 0 && !selectedCompany && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de recherche</CardTitle>
            <CardDescription>
              {filteredResults.length} entreprise(s) sur {searchResults.length} résultat(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filtres */}
            {searchResults.length > 1 && (
              <div className="mb-4 pb-4 border-b space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtrer les résultats</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Département</label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Tous les départements" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="all">Tous les départements</SelectItem>
                        {uniqueDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Commune</label>
                    <Select value={selectedCity} onValueChange={setSelectedCity}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Toutes les communes" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-60">
                        <SelectItem value="all">Toutes les communes</SelectItem>
                        {uniqueCities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(selectedDepartment !== 'all' || selectedCity !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedDepartment('all');
                      setSelectedCity('all');
                    }}
                    className="mt-2"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {filteredResults.map((company) => (
                <Button
                  key={company.id}
                  variant="outline"
                  className="w-full justify-between h-auto py-4"
                  onClick={() => handleSelectCompany(company)}
                >
                  <div className="text-left">
                    <p className="font-semibold">{company.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      SIPI: {company.sipiNumber} • {company.city || 'Ville inconnue'}
                    </p>
                  </div>
                  <Badge variant={company.quality === 'CLIENT' ? 'default' : 'secondary'}>
                    {company.quality || 'N/A'}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Détails de l'entreprise sélectionnée */}
      {selectedCompany && (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedCompany(null);
              setOrders([]);
              setOrderDetails([]);
            }}
            className="mb-4"
          >
            ← Retour aux résultats
          </Button>
        </>
      )}

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

              {/* Commentaires */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <CardTitle>Commentaires</CardTitle>
                  </div>
                  <CardDescription>
                    Ajoutez des notes sur cette entreprise
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Formulaire d'ajout de commentaire */}
                  <div className="space-y-4 mb-6">
                    <Textarea
                      placeholder="Ajouter un commentaire..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="w-full md:w-auto"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {submittingComment ? 'Envoi...' : 'Ajouter un commentaire'}
                    </Button>
                  </div>

                  {/* Liste des commentaires */}
                  <div className="space-y-4">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="p-4 border rounded-lg bg-muted/30"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary">
                                  {comment.profiles.full_name?.[0] || comment.profiles.email[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {comment.profiles.full_name || comment.profiles.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(comment.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        Aucun commentaire pour le moment
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {searchTerm && searchResults.length === 0 && !selectedCompany && (
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
