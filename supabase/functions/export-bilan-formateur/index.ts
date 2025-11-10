import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formateur, year, type } = await req.json();
    
    console.log('Export request:', { formateur, year, type });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load training data
    let trainingData: any[] = [];
    
    if (formateur === '_tous_') {
      // Load all sectors
      const { data: sectors } = await supabase
        .from('department_management')
        .select('formateur')
        .order('formateur');
      
      const allFormateurs = [...new Set(
        sectors?.map(s => s.formateur)
          .filter(f => f && f.trim() !== '' && f !== '-') || []
      )];

      for (const formateurName of allFormateurs) {
        const { data } = await supabase.rpc('get_fo_training_data', {
          _formateur: formateurName,
          _year: year
        });
        if (data) {
          trainingData.push(...data);
        }
      }
    } else {
      const { data } = await supabase.rpc('get_fo_training_data', {
        _formateur: formateur,
        _year: year
      });
      trainingData = data || [];
    }

    // Create CSV content based on type
    let csvContent = '';
    let filename = '';

    if (type === 'paid') {
      filename = `formations_payantes_${formateur}_${year}.csv`;
      csvContent = 'SIPI;Entreprise;Date Formation;Nb Commandes;CA Total\n';
      const paidData = trainingData.filter(row => Number(row.paid_orders_count || 0) > 0);
      paidData.forEach(row => {
        csvContent += `${row.sipi_number};${row.company_name};${row.report_creation_date};${row.paid_orders_count};${row.paid_orders_amount}\n`;
      });
    } else if (type === 'free') {
      filename = `formations_gratuites_${formateur}_${year}.csv`;
      csvContent = 'SIPI;Entreprise;Date Formation;Commandes Année;CA Année\n';
      const paidSipiNumbers = new Set(
        trainingData.filter(row => Number(row.paid_orders_count || 0) > 0).map(row => row.sipi_number)
      );
      const freeData = trainingData.filter(row => !paidSipiNumbers.has(row.sipi_number));
      freeData.forEach(row => {
        csvContent += `${row.sipi_number};${row.company_name};${row.report_creation_date};${row.all_orders_count_year};${row.all_orders_amount_year}\n`;
      });
    } else if (type === 'all') {
      filename = `toutes_formations_${formateur}_${year}.csv`;
      csvContent = 'SIPI;Entreprise;Date Formation;Commandes Payantes;CA Payant;Commandes Année;CA Année\n';
      trainingData.forEach(row => {
        csvContent += `${row.sipi_number};${row.company_name};${row.report_creation_date};${row.paid_orders_count};${row.paid_orders_amount};${row.all_orders_count_year};${row.all_orders_amount_year}\n`;
      });
    } else if (type === 'development') {
      filename = `developpement_${formateur}_${year}.csv`;
      csvContent = 'SIPI;Entreprise;Année Formation;-2 ans;Croissance;Taux Renouvellement;Actifs;Expirés;Proche Expiration;Prochaine Expiration\n';
      
      // Calculate development metrics with expiration data
      for (const row of trainingData) {
        const trainingYear = year;
        const yearMinus2 = year - 2;

        // Get quantities for training year with expiration info
        const { data: trainingYearOrders } = await supabase
          .from('orders')
          .select('order_number')
          .eq('sipi_number', row.sipi_number)
          .gte('order_date', `${trainingYear}-01-01`)
          .lte('order_date', `${trainingYear}-12-31`);

        const trainingOrderNumbers = trainingYearOrders?.map(o => o.order_number) || [];
        
        const { data: trainingYearDetails } = await supabase
          .from('order_details')
          .select('article_code, quantity, expiration_date')
          .in('order_number', trainingOrderNumbers);

        const trainingYearQuantity = trainingYearDetails?.reduce((sum, d) => sum + d.quantity, 0) || 0;

        // Calculate expiration metrics
        const today = new Date();
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(today.getMonth() + 3);
        
        let activeQty = 0;
        let expiredQty = 0;
        let expiringSoonQty = 0;
        let nextExpiration: string | null = null;
        
        trainingYearDetails?.forEach(d => {
          if (d.expiration_date) {
            const expDate = new Date(d.expiration_date);
            
            if (expDate < today) {
              expiredQty += d.quantity;
            } else {
              activeQty += d.quantity;
              
              if (expDate <= threeMonthsFromNow) {
                expiringSoonQty += d.quantity;
              }
              
              if (!nextExpiration || expDate < new Date(nextExpiration)) {
                nextExpiration = d.expiration_date;
              }
            }
          } else {
            activeQty += d.quantity;
          }
        });

        // Get quantities for year -2
        const { data: yearMinus2Orders } = await supabase
          .from('orders')
          .select('order_number')
          .eq('sipi_number', row.sipi_number)
          .gte('order_date', `${yearMinus2}-01-01`)
          .lte('order_date', `${yearMinus2}-12-31`);

        const yearMinus2OrderNumbers = yearMinus2Orders?.map(o => o.order_number) || [];
        
        const { data: yearMinus2Details } = await supabase
          .from('order_details')
          .select('article_code, quantity')
          .in('order_number', yearMinus2OrderNumbers);

        const yearMinus2Quantity = yearMinus2Details?.reduce((sum, d) => sum + d.quantity, 0) || 0;

        // Calculate growth
        const growth = yearMinus2Quantity > 0 
          ? ((trainingYearQuantity - yearMinus2Quantity) / yearMinus2Quantity * 100).toFixed(1)
          : trainingYearQuantity > 0 ? '100.0' : '0.0';

        // Calculate renewal rate
        const yearMinus2Articles = new Set(yearMinus2Details?.map(d => d.article_code) || []);
        const trainingYearArticles = new Set(trainingYearDetails?.map(d => d.article_code) || []);
        
        const renewedArticles = [...yearMinus2Articles].filter(article => trainingYearArticles.has(article));
        const renewalRate = yearMinus2Articles.size > 0
          ? ((renewedArticles.length / yearMinus2Articles.size) * 100).toFixed(1)
          : '0.0';

        csvContent += `${row.sipi_number};${row.company_name};${trainingYearQuantity};${yearMinus2Quantity};${growth}%;${renewalRate}%;${activeQty};${expiredQty};${expiringSoonQty};${nextExpiration || '-'}\n`;
      }
    }

    // Return CSV file
    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
