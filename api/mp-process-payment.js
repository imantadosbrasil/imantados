const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));

  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  
  const digitsOnly = (s) => (s || '').toString().replace(/\D/g, '');
  
  try {
    console.log('🔵 Requisição recebida em mp-process-payment');
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { 
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); 
    }
    
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const formData = body.formData || body || {};
    const order = body.order || {};
    console.log(formData);
    
    // Capturar device session ID do formData
    const deviceSessionId = formData.device_session_id || null;
    console.log('🔷 Device Session ID:', deviceSessionId ? deviceSessionId.substring(0, 20) + '...' : 'não informado');
    
    // ========== VALIDAÇÕES RIGOROSAS ==========
    
    // Validar customer
    const customer = order.customer;
    if (!customer) {
      return res.status(400).json({ error: 'Dados do cliente não informados' });
    }
    
    // Validar campos obrigatórios do customer
    const requiredFields = ['name', 'email', 'phone', 'cep', 'address', 'number', 'bairro', 'city', 'state'];
    for (const field of requiredFields) {
      if (!customer[field]) {
        return res.status(400).json({ error: `Campo obrigatório ausente: customer.${field}` });
      }
    }
    
    // Validar e separar nome completo
    const nameParts = customer.name.trim().split(' ').filter(Boolean);
    if (nameParts.length < 2) {
      return res.status(400).json({ error: 'Nome completo (nome e sobrenome) obrigatório' });
    }
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    // Validar email
    if (!customer.email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    
    // Validar CPF do formData (enviado pelo frontend na identificação)
    const cpfFromPayer = formData.payer?.identification?.number;
    if (!cpfFromPayer) {
      return res.status(400).json({ error: 'CPF não informado' });
    }
    const cpf = digitsOnly(cpfFromPayer);
    if (cpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido (deve ter 11 dígitos)' });
    }
    
    // Validar telefone
    const phone = digitsOnly(customer.phone);
    if (phone.length < 10 || phone.length > 11) {
      return res.status(400).json({ error: 'Telefone inválido (deve ter 10 ou 11 dígitos)' });
    }
    const areaCode = parseInt(phone.substring(0, 2));
    const phoneNumber = parseInt(phone.substring(2));
    
    // Validar CEP
    const zipCode = digitsOnly(customer.cep);
    if (zipCode.length !== 8) {
      return res.status(400).json({ error: 'CEP inválido (deve ter 8 dígitos)' });
    }
    
    // Validar token do cartão
    if (!formData.token) {
      return res.status(400).json({ error: 'Token do cartão não informado' });
    }
    
    // Validar payment_method_id e issuer_id
    if (!formData.payment_method_id) {
      return res.status(400).json({ error: 'Método de pagamento não detectado' });
    }
    
    // Validar valor
    const rawAmount = Number(order.total || formData.transaction_amount || 0);
    if (!(rawAmount > 0)) {
      return res.status(400).json({ error: 'Valor inválido' });
    }
    
    // Mercado Pago exige valor com no máximo 2 casas decimais
    const amount = Math.round(rawAmount * 100) / 100;
    
    console.log('✅ Validações passaram, valor:', amount);
    
    // ========== MONTAR PAYLOAD COMPLETO ==========
    
    const client = new MercadoPagoConfig({ accessToken });
    
    // Montar items para additional_info
    const items = (order.items || []).map((item, idx) => {
      const rawPrice = Number(item.unitPrice || item.price || 0);
      const unitPrice = Math.round(rawPrice * 100) / 100; // Máximo 2 casas decimais
      return {
        id: item.id || `ITEM_${idx + 1}`,
        title: item.title || item.name || 'Produto',
        description: item.description || item.title || item.name || 'Imantado',
        quantity: item.quantity || 1,
        unit_price: unitPrice
      };
    });
    
    const paymentPayload = {
      transaction_amount: amount,
      token: formData.token,
      description: items[0]?.title || 'Imantados',
      installments: Number(formData.installments) || 1,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id || undefined,
      
      payer: {
        email: customer.email,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: formData.payer?.identification?.type || 'CPF',
          number: cpf
        },
        address: {
          zip_code: zipCode,
          street_name: customer.address,
          street_number: customer.number.toString(),
          neighborhood: customer.bairro,
          city: customer.city,
          federal_unit: customer.state.toUpperCase()
        }
      },
      
      additional_info: {
        items: items,
        shipments: {
          receiver_address: {
            zip_code: zipCode,
            street_name: customer.address,
            city_name: customer.city,
            state_name: customer.state.toUpperCase(),
            street_number: customer.number.toString()
          }
        },
        payer: {
          first_name: firstName,
          last_name: lastName,
          phone: {
            area_code: areaCode,
            number: phoneNumber
          },
          address: {
            zip_code: zipCode,
            street_name: customer.address,
            street_number: customer.number.toString()
          }
        }
      }
    };
    
    
    console.log('🟢 Payload resumido:', {
      transaction_amount: paymentPayload.transaction_amount,
      installments: paymentPayload.installments,
      payment_method_id: paymentPayload.payment_method_id,
      issuer_id: paymentPayload.issuer_id,
      payer_email: paymentPayload.payer.email,
      items_count: paymentPayload.additional_info.items.length,
      has_device_session: !!deviceSessionId
    });
    
    const pay = new Payment(client);
    
    // Adicionar header X-meli-session-id se device_session_id disponível
    const requestOptions = { body: paymentPayload, requestOptions: {
      integratorId: 'dev_aa2d89add88111ebb2fb0242ac130004',
      idempotencyKey: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    } };
    if (deviceSessionId) {
      requestOptions.requestOptions.meliSessionId = deviceSessionId;
      console.log('📤 Enviando header X-meli-session-id para Mercado Pago');
    }
    
    const response = await pay.create(requestOptions);
    const payment = response.body || response;
    
    console.log('✅ Pagamento processado:', { id: payment?.id, status: payment?.status, status_detail: payment?.status_detail });
    
    res.status(200).json(payment);
  } catch (err) {
    console.error('❌ Erro ao processar pagamento:', err);
    const status = (err && (err.status || err.statusCode)) || 500;
    const details = (err && (err.cause || err.error || err.errors)) || null;
    const msg = (err && err.message) || String(err);
    res.status(status).json({ error: msg, details });
  }
};
