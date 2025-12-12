const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
    const order = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const rawAmount = Number(order.total || 0);
    if (!(rawAmount > 0)) { res.status(400).json({ error: 'Valor inválido para Boleto' }); return; }
    // Mercado Pago exige valor com no máximo 2 casas decimais
    const amount = Math.round(rawAmount * 100) / 100;

    const client = new MercadoPagoConfig({ accessToken });
    const fallbackEmail = (order.customer && order.customer.email) || order.email || 'no-reply@imantados.com.br';
    const fallbackName = (order.customer && order.customer.name) || order.name || 'Cliente';
    const nameParts = fallbackName.trim().split(' ').filter(Boolean);
    const fallbackFirstName = nameParts[0] || 'Cliente';
    const fallbackLastName = nameParts.slice(1).join(' ') || 'Imantados';
    
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = host ? `${proto}://${host}` : (process.env.SUCCESS_URL || 'https://www.imantados.com.br');
    
    // Data de vencimento: 3 dias a partir de hoje
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    
    // Extrair CPF do cliente se disponível, senão usar CPF de teste válido
    const cpfFromOrder = (order.customer && order.customer.cpf) || 
                         (order.customer && order.customer.document) ||
                         (order.customer && order.customer.identification && order.customer.identification.number) ||
                         '19119119100'; // CPF de teste válido para sandbox
    const cpfClean = cpfFromOrder.toString().replace(/\D/g, '');
    
    // Extrair endereço do cliente
    const customer = order.customer || {};
    const addressZipCode = (customer.cep || '01310100').toString().replace(/\D/g, '');
    const addressStreet = customer.address || customer.rua || 'Avenida Paulista';
    const addressNumber = customer.number || customer.numero || '1000';
    const addressNeighborhood = customer.bairro || customer.neighborhood || 'Bela Vista';
    const addressCity = customer.city || customer.cidade || 'São Paulo';
    const addressState = (customer.state || customer.estado || 'SP').toString().toUpperCase();
    
    const paymentPayload = {
      transaction_amount: amount,
      description: (order.items && order.items[0] && (order.items[0].name || order.items[0].title)) || 'Imantados',
      payment_method_id: 'bolbradesco',
      external_reference: order.id || order.external_reference,
      date_of_expiration: dueDate.toISOString(),
      payer: { 
        email: fallbackEmail,
        first_name: fallbackFirstName,
        last_name: fallbackLastName,
        identification: {
          type: 'CPF',
          number: cpfClean
        },
        address: {
          zip_code: addressZipCode,
          street_name: addressStreet,
          street_number: addressNumber,
          neighborhood: addressNeighborhood,
          city: addressCity,
          federal_unit: addressState
        }
      },
    };
    
    const pay = new Payment(client);
    const response = await pay.create({ body: paymentPayload });
    const payment = response.body || response;
    
    // Extrair dados do boleto
    const pdfUrl = payment?.transaction_details?.external_resource_url || '';
    const barcode = payment?.barcode?.content || '';
    
    res.status(200).json({ 
      id: payment?.id, 
      status: payment?.status, 
      barcode: barcode,
      pdf_url: pdfUrl,
      due_date: payment?.date_of_expiration || dueDate.toISOString(),
      amount 
    });
  } catch (err) {
    const status = (err && (err.status || err.statusCode)) || 500;
    const details = (err && (err.cause || err.error || err.errors)) || null;
    const msg = (err && err.message) || (Array.isArray(details) && details[0] && (details[0].description || details[0].message)) || String(err);
    res.status(status).json({ error: msg, details });
  }
};

