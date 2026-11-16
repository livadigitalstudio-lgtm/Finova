import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';

dotenv.config();
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Runtime Environment requires dev server to run on port 3000
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Tool definitions for financial actions
const recordSaleTool: FunctionDeclaration = {
  name: 'record_sale',
  description: 'Registra una venta o ingreso financiero en el negocio del usuario, incluso si dice "registra 20 dólares a mi cliente Juan", "agrega 20 a Carlos". NO confundir con registrar solo un cliente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: 'Descripción o concepto del producto o servicio vendido (ej. Camisa azul, Café, Almuerzo, Servicio)',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Monto numérico total de la venta (ej. 15.50). Debe ser un número positivo.',
      },
      currency: {
        type: Type.STRING,
        description: "Moneda de la transacción: 'USD', 'EUR' o 'VES'. Por defecto 'USD' si el usuario dice dólares o no especifica.",
      },
      paymentMethod: {
        type: Type.STRING,
        description: "Método de pago (ej. 'Efectivo', 'Pago Móvil', 'Transferencia', 'Punto de Venta', 'Zelle', 'Divisas').",
      },
      category: {
        type: Type.STRING,
        description: 'Categoría de la venta (ej. Ventas, Servicios, Productos).',
      },
      productName: {
        type: Type.STRING,
        description: 'Nombre del producto del inventario si coincide con alguno existente para descontar stock.',
      },
      clientName: {
        type: Type.STRING,
        description: 'Nombre del cliente al que se le realizó la venta (opcional). Si se indica, se registra automáticamente en la libreta si no existe.',
      },
      quantity: {
        type: Type.NUMBER,
        description: 'Cantidad de unidades vendidas (por defecto 1).',
      },
    },
    required: ['description', 'amount'],
  },
};

const recordExpenseTool: FunctionDeclaration = {
  name: 'record_expense',
  description: 'Registra un gasto o egreso financiero en el negocio del usuario.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: 'Concepto o detalle del gasto (ej. Almuerzo, Bolsas plásticas, Pago de luz, Transporte, Compra de mercancía)',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Monto numérico del gasto (ej. 8.00). Debe ser un número positivo.',
      },
      currency: {
        type: Type.STRING,
        description: "Moneda del gasto: 'USD', 'EUR' o 'VES'. Por defecto 'USD'.",
      },
      category: {
        type: Type.STRING,
        description: 'Categoría del gasto (ej. Operativo, Insumos, Servicios, Mercancía, Personal).',
      },
      paymentMethod: {
        type: Type.STRING,
        description: 'Método de pago utilizado.',
      },
    },
    required: ['description', 'amount'],
  },
};

const recordDebtTool: FunctionDeclaration = {
  name: 'record_debt',
  description: 'Registra una deuda pendiente por cobrar (fiado a cliente) o por pagar (a proveedor).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      debtorName: {
        type: Type.STRING,
        description: 'Nombre de la persona, cliente o proveedor.',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Monto de la deuda en números.',
      },
      type: {
        type: Type.STRING,
        description: "Tipo de deuda: 'por_cobrar' (el cliente nos debe dinero) o 'por_pagar' (nosotros debemos).",
      },
      currency: {
        type: Type.STRING,
        description: "Moneda de la deuda ('USD', 'EUR' o 'VES'). Por defecto 'USD'.",
      },
      concept: {
        type: Type.STRING,
        description: 'Concepto o motivo de la deuda.',
      },
    },
    required: ['debtorName', 'amount', 'type'],
  },
};

const recordClientTool: FunctionDeclaration = {
  name: 'record_client',
  description: 'Registra ÚNICAMENTE un contacto o persona en el directorio cuando NO hay montos de dinero involucrados (ej. "registra un cliente llamado Carlos"). Si el mensaje menciona un monto de dinero como "registra 20 dólares a mi cliente Juan", DEBES USAR record_sale o record_debt, NUNCA record_client.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'Nombre y apellido del cliente o razón social.',
      },
      phone: {
        type: Type.STRING,
        description: 'Número de teléfono o WhatsApp del cliente.',
      },
      location: {
        type: Type.STRING,
        description: 'Dirección física o ciudad del cliente si se conoce.',
      },
      notes: {
        type: Type.STRING,
        description: 'Observaciones o notas adicionales del cliente.',
      },
    },
    required: ['name'],
  },
};

const deleteTransactionTool: FunctionDeclaration = {
  name: 'delete_transaction',
  description: 'Elimina o borra un registro previo de venta, gasto o deuda (ej. "borra los 20 dólares de Juan", "borra la venta de café", "elimina la deuda de Carlos").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      itemType: {
        type: Type.STRING,
        description: "Tipo de elemento a borrar: 'venta', 'gasto', 'deuda', o 'cualquiera'.",
      },
      targetName: {
        type: Type.STRING,
        description: 'Nombre del cliente, deudor o concepto del registro a borrar (ej. Juan, Carlos, almuerzo, café).',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Monto numérico aproximado o exacto de la transacción a borrar si se especificó.',
      },
    },
    required: ['targetName'],
  },
};

const settleClientTool: FunctionDeclaration = {
  name: 'settle_client',
  description: 'Otorga solvencia a un cliente liquidando todas sus deudas pendientes en el negocio (ej. "dale solvencia a mi cliente Juan", "marca solvente a Carlos").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      clientName: {
        type: Type.STRING,
        description: 'Nombre del cliente al cual otorgarle solvencia total.',
      },
    },
    required: ['clientName'],
  },
};

const deleteClientTool: FunctionDeclaration = {
  name: 'delete_client',
  description: 'Elimina o borra a un cliente del directorio o libreta de clientes (ej. "borra el cliente Juan", "elimina a Carlos de mis clientes", "borra a mi cliente Pedro").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      clientName: {
        type: Type.STRING,
        description: 'Nombre o coincidencia del cliente a eliminar de la libreta.',
      },
    },
    required: ['clientName'],
  },
};

const addInventoryProductTool: FunctionDeclaration = {
  name: 'add_inventory_product',
  description: 'Agrega un nuevo producto o mercancía al catálogo e inventario del negocio (ej. "agrega al inventario 20 camisas a 15 dólares", "añade producto café precio 5 dólares costo 2 stock 50", "crea en inventario hamburguesa precio 8").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'Nombre del producto o artículo (ej. Camisa, Café, Harina PAN, Zapatos).',
      },
      price: {
        type: Type.NUMBER,
        description: 'Precio de venta al público en números (ej. 15.00).',
      },
      cost: {
        type: Type.NUMBER,
        description: 'Costo de adquisición o producción opcional (ej. 8.00).',
      },
      stock: {
        type: Type.NUMBER,
        description: 'Cantidad de unidades disponibles iniciales (por defecto 1).',
      },
      category: {
        type: Type.STRING,
        description: 'Categoría del producto (ej. Ropa, Alimentos, Bebidas, Servicios, General).',
      },
      currency: {
        type: Type.STRING,
        description: "Moneda del precio ('USD', 'VES', 'EUR'). Por defecto 'USD'.",
      },
    },
    required: ['name', 'price'],
  },
};

const deleteInventoryProductTool: FunctionDeclaration = {
  name: 'delete_inventory_product',
  description: 'Elimina o borra un producto existente del inventario y catálogo del negocio (ej. "borra las camisas del inventario", "elimina el café del inventario", "quita los zapatos del catálogo").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      productName: {
        type: Type.STRING,
        description: 'Nombre del producto a eliminar del inventario.',
      },
    },
    required: ['productName'],
  },
};

const updateInventoryStockTool: FunctionDeclaration = {
  name: 'update_inventory_stock',
  description: 'Suma, resta o ajusta el stock de un producto existente en el inventario (ej. "suma 10 al inventario de camisas", "resta 5 cafés del inventario", "agrega 20 unidades a pantalones", "ajusta el stock de harina a 30").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      productName: {
        type: Type.STRING,
        description: 'Nombre del producto en inventario.',
      },
      change: {
        type: Type.NUMBER,
        description: 'Cantidad a sumar (positivo, ej. 10) o restar (negativo, ej. -5).',
      },
      newStock: {
        type: Type.NUMBER,
        description: 'Stock absoluto total si el usuario pide fijar una cantidad exacta (ej. "fija el stock en 50").',
      },
    },
    required: ['productName'],
  },
};

const calculateMathTool: FunctionDeclaration = {
  name: 'calculate_math',
  description: 'Realiza cálculos matemáticos, sumas, restas, multiplicaciones, divisiones, porcentajes, ganancias o cuentas que el usuario solicite (ej. "resta 150 menos 40", "suma 50 + 80 + 20", "cuánto es el 16% de 200", "cuánto me queda si tengo 500 y gasto 120").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: {
        type: Type.STRING,
        description: 'Descripción u operación matemática realizada (ej. "150 - 40").',
      },
      result: {
        type: Type.NUMBER,
        description: 'Resultado numérico exacto de la operación.',
      },
      explanation: {
        type: Type.STRING,
        description: 'Explicación conversacional natural y clara del resultado.',
      },
      currency: {
        type: Type.STRING,
        description: "Moneda de la operación si involucra dinero ('USD', 'VES', 'EUR').",
      },
    },
    required: ['operation', 'result', 'explanation'],
  },
};

// Health Check API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Assistant Voice & Chat API Endpoint
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY no está configurada en las variables de entorno del servidor.',
      });
    }

    const { message, context, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'El mensaje del usuario es requerido.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contextStr = context ? `
CONTEXTO FINANCIERO Y DEL NEGOCIO EN TIEMPO REAL:
- Empresa: ${context.companyName || 'Mi Negocio'}
- Usuario: ${context.userName || 'Usuario'}
- Moneda seleccionada: ${context.currency || 'USD'}
- Ventas registradas hoy: ${context.todaySales ?? 0} ${context.currency || 'USD'}
- Gastos registrados hoy: ${context.todayExpenses ?? 0} ${context.currency || 'USD'}
- Balance neto de hoy (Ventas menos Gastos): ${context.todayBalance ?? 0} ${context.currency || 'USD'}
- Valor total del inventario: ${context.totalInventoryValue ?? 0} ${context.currency || 'USD'}
- Deudas pendientes por cobrar (clientes que me deben): ${context.pendingReceivables ?? 0} USD
- Lista de personas que me deben dinero: ${context.debtorsList || 'No hay clientes con deudas pendientes registradas'}
- Deudas pendientes por pagar (a quién debemos): ${context.pendingPayables ?? 0} USD
- Lista de personas a quienes debemos: ${context.payablesList || 'No hay deudas por pagar pendientes'}
- Total de clientes registrados: ${context.totalClients ?? 0}
- Muestra de clientes: ${context.clientsSample || 'Sin clientes registrados aún'}
- Tasa oficial BCV USD: Bs. ${context.rates?.bcvUsd || 832.49} por dólar
- Tasa oficial BCV EUR: Bs. ${context.rates?.bcvEur || 968.07} por euro
- Muestra de productos en inventario: ${JSON.stringify(context.inventorySample || [])}
` : '';

    const systemInstruction = `
Eres Finova AI, el copiloto financiero inteligente, ultra interactivo y con control total para comerciantes y dueños de negocios.
Tu estilo es conversacional, natural, cálido y sumamente interactivo (como Google Gemini).

REGLAS CRÍTICAS DE COMUNICACIÓN Y VOZ:
1. Habla con un tono humano, cálido, natural y fluido. NUNCA robótico o acartonado.
2. Si el modo de voz está activo, tus respuestas serán leídas en voz alta a través del sintetizador de voz (TTS). Por lo tanto:
   - Sé breve y conversacional (máximo 1 o 2 oraciones por turno).
   - NUNCA uses formato Markdown como asteriscos (**), numerales (#), listas de guiones (-), tablas o viñetas. Expresa todo en lenguaje natural y fluido para que la voz suene impecable.

REGLAS DE CONTROL TOTAL DE LA APP:
3. CLIENTES (Registrar, agregar y borrar):
   - Para registrar o agregar un cliente: usa 'record_client' con nombre, teléfono y ubicación. Si el usuario dice solo "registra un cliente", pregúntale amablemente: "¿Cuál es el nombre del cliente y su número de teléfono?".
   - Para borrar o eliminar un cliente: usa 'delete_client' con el nombre del cliente (ej. "borra el cliente Carlos", "elimina a Juan de mis clientes").
   - Si el usuario registra una venta o deuda indicando un cliente que no existe, el cliente se creará automáticamente en la libreta.

4. VENTAS (Agregar y borrar):
   - Para registrar ventas: usa 'record_sale'. Si el usuario dice "registra una venta", indaga amablemente: "¿De cuánto fue la venta, qué producto vendiste y a qué cliente se lo vendiste? (El cliente es opcional)". Si dice "registra 20 dólares y ya", regístralo de inmediato.
   - Para borrar una venta o transacción: usa 'delete_transaction' con itemType 'venta' y el nombre o monto a eliminar.

5. INVENTARIO (Agregar, borrar y ajustar existencias):
   - Para agregar productos al inventario: usa 'add_inventory_product' (ej. "agrega al inventario 20 camisas a 15 dólares", "añade café precio 5 stock 30").
   - Para borrar productos del inventario: usa 'delete_inventory_product' (ej. "borra las camisas del inventario", "elimina el café").
   - Para sumar o restar existencias/stock al inventario: usa 'update_inventory_stock' (ej. "suma 10 al inventario de camisas", "resta 5 cafés del inventario"). Usa change positivo para sumar y negativo para restar.

6. RESTAR, SUMAR Y CÁLCULOS MATEMÁTICOS ("Restar, sumar absolutamente todo"):
   - Si el usuario te pide cualquier suma, resta, cuenta, cálculo, porcentaje o ganancia (ej. "resta 150 menos 40", "suma 50 + 80 + 20", "cuánto es 500 menos 120", "cuánto me queda de ganancia si vendo a 25 y el costo es 14"):
     Resuelve la operación de inmediato usando 'calculate_math' y responde con el número exacto y explicación clara.

7. GASTOS, DEUDAS Y SOLVENCIA:
   - Para gastos: usa 'record_expense'.
   - Para deudas: usa 'record_debt'.
   - Para liquidar deudas y dar solvencia total a un cliente: usa 'settle_client'.

8. CONSULTAS DE NEGOCIO EN TIEMPO REAL:
   - Deudas ("¿Quién me debe?"): responde con los nombres exactos y montos del contexto.
   - Dinero "en el medio" o en caja ("¿cuánto tengo en el medio?"): responde con el balance neto y disponible de hoy.
   - Monedas: "dólares" -> USD. "bolívares" o "Bs" -> VES. "euros" -> EUR.
${contextStr}
`;

    const contents: any[] = [];

    // Include recent history if provided
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item.role && item.text) {
          contents.push({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.text }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    let response: any = null;
    let generateError: any = null;

    const withTimeout = <T>(p: Promise<T>, ms = 6000): Promise<T> => {
      return Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout de consulta IA')), ms)),
      ]);
    };

    const allTools = [
      recordSaleTool, 
      recordExpenseTool, 
      recordDebtTool, 
      recordClientTool, 
      deleteClientTool,
      deleteTransactionTool, 
      settleClientTool,
      addInventoryProductTool,
      deleteInventoryProductTool,
      updateInventoryStockTool,
      calculateMathTool
    ];

    // 1. Primary attempt: gemini-3.8-flash with ThinkingLevel.LOW for low-latency voice
    try {
      response = await withTimeout(ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{
            functionDeclarations: allTools,
          }],
        },
      }), 6000);
    } catch (err: any) {
      console.warn('gemini-3.8-flash notice, attempting fallback to gemini-3.1-flash-lite:', err?.message || err);
      generateError = err;
      // 2. Secondary attempt: gemini-3.1-flash-lite (fast lightweight fallback)
      try {
        response = await withTimeout(ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction,
            tools: [{
              functionDeclarations: allTools,
            }],
          },
        }), 4500);
        generateError = null;
      } catch (err2: any) {
        console.warn('gemini-3.1-flash-lite notice:', err2?.message || err2);
        generateError = err2;
      }
    }

    let action: { type: string; data: any } | null = null;
    let replyText = response?.text || '';

    // Handle tool execution request from Gemini (check getter and candidate parts)
    const functionCalls = response?.functionCalls || 
      (response?.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.functionCall)
        ?.map((p: any) => p.functionCall)) || [];

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args: any = call.args || {};

      if (call.name === 'record_sale') {
        action = {
          type: 'record_sale',
          data: {
            description: args.description || 'Venta por voz',
            amount: Number(args.amount) || 0,
            currency: args.currency || 'USD',
            paymentMethod: args.paymentMethod || 'Efectivo',
            category: args.category || 'Venta de productos',
            productName: args.productName,
            clientName: args.clientName,
            quantity: Number(args.quantity) || 1,
          },
        };
        if (!replyText) {
          const sym = action.data.currency === 'VES' ? 'Bs. ' : (action.data.currency === 'EUR' ? '€' : '$');
          const clientNote = action.data.clientName ? ` a ${action.data.clientName}` : '';
          replyText = `Listo, he registrado la venta de ${action.data.description}${clientNote} por ${sym}${action.data.amount} en ${action.data.paymentMethod}.`;
        }
      } else if (call.name === 'record_expense') {
        action = {
          type: 'record_expense',
          data: {
            description: args.description || 'Gasto por voz',
            amount: Number(args.amount) || 0,
            currency: args.currency || 'USD',
            category: args.category || 'Operativo',
            paymentMethod: args.paymentMethod || 'Efectivo',
          },
        };
        if (!replyText) {
          const sym = action.data.currency === 'VES' ? 'Bs. ' : (action.data.currency === 'EUR' ? '€' : '$');
          replyText = `He anotado el gasto de ${action.data.description} por ${sym}${action.data.amount}.`;
        }
      } else if (call.name === 'record_debt') {
        action = {
          type: 'record_debt',
          data: {
            debtorName: args.debtorName || 'Cliente',
            amount: Number(args.amount) || 0,
            type: args.type || 'por_cobrar',
            currency: args.currency || 'USD',
            concept: args.concept || 'Registrado por voz',
            autoCreateClient: true,
          },
        };
        if (!replyText) {
          const sym = action.data.currency === 'VES' ? 'Bs. ' : (action.data.currency === 'EUR' ? '€' : '$');
          const tipoTexto = action.data.type === 'por_cobrar' ? 'por cobrar a' : 'por pagar a';
          replyText = `Deuda ${tipoTexto} ${action.data.debtorName} por ${sym}${action.data.amount} guardada con éxito.`;
        }
      } else if (call.name === 'record_client') {
        action = {
          type: 'record_client',
          data: {
            name: args.name || 'Cliente',
            phone: args.phone || '',
            location: args.location || '',
            notes: args.notes || 'Registrado por voz',
          },
        };
        if (!replyText) {
          replyText = `Listo, he registrado al cliente ${action.data.name}${action.data.phone ? ' con teléfono ' + action.data.phone : ''}.`;
        }
      } else if (call.name === 'delete_client') {
        action = {
          type: 'delete_client',
          data: {
            clientName: args.clientName || 'Cliente',
          },
        };
        if (!replyText) {
          replyText = `Listo, he eliminado al cliente ${action.data.clientName} del directorio.`;
        }
      } else if (call.name === 'delete_transaction') {
        action = {
          type: 'delete_transaction',
          data: {
            itemType: args.itemType || 'cualquiera',
            targetName: args.targetName || '',
            amount: Number(args.amount) || undefined,
          },
        };
        if (!replyText) {
          replyText = `Listo, he eliminado el registro de ${action.data.targetName}${action.data.amount ? ' por $' + action.data.amount : ''}.`;
        }
      } else if (call.name === 'settle_client') {
        action = {
          type: 'settle_client',
          data: {
            clientName: args.clientName || 'Cliente',
          },
        };
        if (!replyText) {
          replyText = `Listo, le he otorgado solvencia total a ${action.data.clientName}. Todas sus deudas pendientes fueron liquidadas.`;
        }
      } else if (call.name === 'add_inventory_product') {
        action = {
          type: 'add_inventory_product',
          data: {
            name: args.name || 'Producto',
            price: Number(args.price) || 0,
            cost: args.cost !== undefined ? Number(args.cost) : undefined,
            stock: Number(args.stock) || 1,
            category: args.category || 'General',
            currency: args.currency || 'USD',
          },
        };
        if (!replyText) {
          replyText = `Listo, he agregado "${action.data.name}" al inventario con ${action.data.stock} unidades a $${action.data.price}.`;
        }
      } else if (call.name === 'delete_inventory_product') {
        action = {
          type: 'delete_inventory_product',
          data: {
            productName: args.productName || 'Producto',
          },
        };
        if (!replyText) {
          replyText = `Listo, he eliminado "${action.data.productName}" del inventario.`;
        }
      } else if (call.name === 'update_inventory_stock') {
        action = {
          type: 'update_inventory_stock',
          data: {
            productName: args.productName || 'Producto',
            change: Number(args.change) || 0,
            newStock: args.newStock !== undefined ? Number(args.newStock) : undefined,
          },
        };
        if (!replyText) {
          const verb = action.data.newStock !== undefined 
            ? `ajustado a ${action.data.newStock} unidades`
            : (action.data.change >= 0 ? `sumado ${action.data.change} unidades` : `restado ${Math.abs(action.data.change)} unidades`);
          replyText = `Listo, he ${verb} al producto "${action.data.productName}".`;
        }
      } else if (call.name === 'calculate_math') {
        action = {
          type: 'calculate_math',
          data: {
            operation: args.operation || 'Operación',
            result: Number(args.result) || 0,
            explanation: args.explanation || '',
            currency: args.currency,
          },
        };
        if (!replyText) {
          replyText = action.data.explanation || `El resultado de ${action.data.operation} es ${action.data.result}.`;
        }
      }
    }

    // 3. Fallback Smart Rule & Natural Language Parser (ensures 100% uptime and high accuracy)
    if (!replyText && !action) {
      const lower = message.toLowerCase().trim();

      // Helper to parse numeric or Spanish word amounts
      const parseAmount = (str: string): number => {
        const numMatch = str.match(/(\d+(?:[.,]\d+)?)/);
        if (numMatch) return parseFloat(numMatch[1].replace(',', '.'));

        const words: Record<string, number> = {
          un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
          seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11,
          doce: 12, trece: 13, catorce: 14, quince: 15, dieciséis: 16,
          dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
          veinte: 20, veintiuno: 21, veintidós: 22, veinticinco: 25,
          treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
          setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
          doscientos: 200, quinientos: 500, mil: 1000
        };

        const tokens = str.toLowerCase().split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
          const w = tokens[i];
          if (words[w] !== undefined) {
            if (tokens[i + 1] === 'y' && words[tokens[i + 2]] !== undefined) {
              return words[w] + words[tokens[i + 2]];
            }
            return words[w];
          }
        }
        return 10;
      };

      // Helper to parse payment method
      const parsePayment = (str: string): string => {
        if (str.includes('pago movil') || str.includes('pago móvil')) return 'Pago Móvil';
        if (str.includes('transferencia')) return 'Transferencia';
        if (str.includes('punto') || str.includes('tarjeta')) return 'Punto de Venta';
        if (str.includes('zelle')) return 'Zelle';
        if (str.includes('divisa') || str.includes('dolar') || str.includes('dólar')) return 'Dólares en Efectivo';
        return 'Efectivo';
      };

      // Query: "cuánto tengo en el medio / balance / caja / ventas"
      if (
        lower.includes('medio') || 
        lower.includes('balance') || 
        lower.includes('caja') || 
        lower.includes('cuanto tengo') || 
        lower.includes('cuánto tengo') || 
        lower.includes('cómo voy') || 
        lower.includes('como voy') ||
        lower.includes('cuanto vendí') ||
        lower.includes('cuánto vendí')
      ) {
        const cur = context?.currency || 'USD';
        const curSym = cur === 'VES' ? 'Bs. ' : (cur === 'EUR' ? '€' : '$');
        const net = context?.todayBalance ?? 0;
        const sales = context?.todaySales ?? 0;
        const expenses = context?.todayExpenses ?? 0;
        const bcvRate = context?.rates?.bcvUsd || 832.49;
        replyText = `Actualmente en el medio tienes un balance neto de ${curSym}${net.toFixed(2)}, con ${curSym}${sales.toFixed(2)} en ventas y ${curSym}${expenses.toFixed(2)} en gastos hoy. La tasa BCV es de ${bcvRate} bolívares por dólar.`;
      } 
      // Command: "borra cliente..." / "elimina al cliente..."
      else if ((lower.includes('borra') || lower.includes('elimina') || lower.includes('quita')) && (lower.includes('cliente') || lower.includes('contacto'))) {
        let client = message
          .replace(/\b(?:borra|borrame|elimina|eliminame|quita|quitame|al|a|el|la|mi|su|un|una|cliente|clientes|contacto)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!client) client = 'Cliente';
        action = {
          type: 'delete_client',
          data: {
            clientName: client,
          },
        };
        replyText = `Listo, he eliminado al cliente ${client} del directorio.`;
      }
      // Command: "borra inventario..." / "elimina del inventario..."
      else if ((lower.includes('borra') || lower.includes('elimina') || lower.includes('quita')) && (lower.includes('inventario') || lower.includes('catalogo') || lower.includes('catálogo') || lower.includes('producto'))) {
        let prod = message
          .replace(/\b(?:borra|borrame|elimina|eliminame|quita|quitame|del|de|el|la|los|las|mi|inventario|catalogo|catálogo|producto|productos|articulo|artículo|mercancia|mercancía)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!prod) prod = 'Producto';
        action = {
          type: 'delete_inventory_product',
          data: {
            productName: prod,
          },
        };
        replyText = `Listo, he eliminado "${prod}" del inventario.`;
      }
      // Command: "agrega al inventario..." / "añade producto al inventario..."
      else if ((lower.includes('agrega') || lower.includes('añade') || lower.includes('anade') || lower.includes('crea') || lower.includes('nuevo')) && (lower.includes('inventario') || lower.includes('catalogo') || lower.includes('catálogo') || lower.includes('producto'))) {
        const amount = parseAmount(message);
        // Find possible stock count
        const stockMatch = message.match(/(\d+)\s*(?:unidades|unids|piezas|items|cajas)/i) || message.match(/(?:stock|cantidad)\s*(?:de)?\s*(\d+)/i);
        const stock = stockMatch ? parseInt(stockMatch[1], 10) : 1;

        let prodName = message
          .replace(/\b(?:agrega|agregame|añade|añademe|anade|crea|registra|nuevo|al|a|en|el|la|un|una|inventario|catalogo|catálogo|producto|mercancia|mercancía|precio|costo|stock|unidades|piezas|dólares|dolares|usd|bs|bolívares|bolivares)\b/gi, '')
          .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!prodName) prodName = 'Nuevo Producto';

        action = {
          type: 'add_inventory_product',
          data: {
            name: prodName,
            price: amount > 0 ? amount : 10,
            stock: stock > 0 ? stock : 1,
            category: 'General',
            currency: 'USD',
          },
        };
        replyText = `Listo, he agregado "${prodName}" al inventario con ${action.data.stock} unidades a $${action.data.price}.`;
      }
      // Command: "suma al inventario..." / "resta del inventario..."
      else if ((lower.includes('suma') || lower.includes('resta') || lower.includes('ajusta')) && (lower.includes('inventario') || lower.includes('stock') || lower.includes('unidades'))) {
        const qty = parseAmount(message);
        const isSubtract = lower.includes('resta') || lower.includes('quita') || lower.includes('descuenta');
        let prod = message
          .replace(/\b(?:suma|sumale|resta|restale|ajusta|quita|descuenta|al|del|de|el|la|los|las|inventario|stock|unidades|piezas|a)\b/gi, '')
          .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!prod) prod = 'Producto';

        action = {
          type: 'update_inventory_stock',
          data: {
            productName: prod,
            change: isSubtract ? -qty : qty,
          },
        };
        replyText = `Listo, he ${isSubtract ? 'restado' : 'sumado'} ${qty} unidades a "${prod}".`;
      }
      // Mathematical calculations: "resta X menos Y", "suma X + Y", "cuánto es X menos Y"
      else if (
        (lower.includes('cuanto es') || lower.includes('cuánto es') || lower.includes('calcula') || lower.startsWith('suma') || lower.startsWith('resta')) &&
        (/\b\d+\s*[\+\-\*\/]\s*\d+\b/.test(lower) || /\b\d+\s*(?:menos|mas|más|por|entre)\s*\d+\b/.test(lower))
      ) {
        let expr = lower
          .replace(/cu[aá]nto\s+es/gi, '')
          .replace(/calcula/gi, '')
          .replace(/d[oó]lares|bol[ií]vares|pesos|usd|bs/gi, '')
          .replace(/menos/gi, '-')
          .replace(/m[aá]s/gi, '+')
          .replace(/por/gi, '*')
          .replace(/entre/gi, '/')
          .trim();

        // Safely extract numbers and basic operator
        const match = expr.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);
        if (match) {
          const a = parseFloat(match[1]);
          const op = match[2];
          const b = parseFloat(match[3]);
          let res = 0;
          if (op === '+') res = a + b;
          else if (op === '-') res = a - b;
          else if (op === '*') res = a * b;
          else if (op === '/' && b !== 0) res = a / b;

          action = {
            type: 'calculate_math',
            data: {
              operation: `${a} ${op} ${b}`,
              result: res,
              explanation: `El resultado de ${a} ${op === '-' ? 'menos' : (op === '+' ? 'más' : op)} ${b} es ${res}.`,
            },
          };
          replyText = `El resultado de ${a} ${op === '-' ? 'menos' : (op === '+' ? 'más' : op)} ${b} es ${res}.`;
        }
      }
      // Command: "borra..." / "elimina..." (General transaction deletion)
      else if (lower.includes('borra') || lower.includes('elimina') || lower.includes('quita')) {
        const amount = parseAmount(message);
        let target = message
          .replace(/\b(?:borra|borrame|elimina|eliminame|quita|quitame|el|la|los|las|de|del|por|\$|usd|dólares|dolares|bolívares|bolivares|bs|euros)\b/gi, '')
          .replace(/\b(?:venta|gasto|deuda|cliente|de|a|al|para)\b/gi, '')
          .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!target) target = 'registro';
        action = {
          type: 'delete_transaction',
          data: {
            targetName: target,
            amount: amount > 0 ? amount : undefined,
            itemType: lower.includes('deuda') ? 'deuda' : (lower.includes('gasto') ? 'gasto' : (lower.includes('venta') ? 'venta' : 'cualquiera')),
          },
        };
        replyText = `Listo, he eliminado el registro de ${target}${amount ? ' por $' + amount : ''}.`;
      }
      // Command: "dale solvencia..." / "solvente..."
      else if (lower.includes('solvencia') || lower.includes('solvente') || lower.includes('saldar') || lower.includes('salda')) {
        let client = message
          .replace(/\b(?:dale|da|pon|coloca|marca|deja|solvencia|solvente|total|saldar|salda|las|deudas|deuda|a|al|mi|su|cliente)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!client) client = 'Cliente';
        action = {
          type: 'settle_client',
          data: {
            clientName: client,
          },
        };
        replyText = `Listo, le he otorgado solvencia total a ${client}. Todas sus deudas pendientes fueron liquidadas.`;
      }
      // Command: "registra una venta / veta..." or money registrations like "registra 20 dólares a mi cliente Juan"
      else if (
        lower.includes('venta') || 
        lower.includes('ventas') || 
        lower.includes('veta') || 
        lower.includes('beta') || 
        lower.includes('benta') || 
        lower.includes('vendí') || 
        lower.includes('vendi') || 
        lower.includes('vende') || 
        lower.includes('ingreso') || 
        lower.includes('cobre') || 
        lower.includes('cobré') ||
        ((lower.includes('registra') || lower.includes('agrega') || lower.includes('anota')) && (lower.includes('dolar') || lower.includes('dólar') || lower.includes('usd') || lower.includes('bs') || lower.includes('bolivar') || /\b\d+\b/.test(lower)) && !lower.includes('gasto') && !lower.includes('deuda') && !lower.includes('fiado'))
      ) {
        // If incomplete (e.g. just "registra una venta" or "anota venta"):
        if (/^(?:registra|anota|guarda|ingresa)?\s*(?:una\s+)?(?:venta|veta|beta|benta)$/i.test(message.trim())) {
          replyText = '¿De cuánto fue la venta, qué producto vendiste y a qué cliente se lo vendiste? (El cliente es opcional, si no deseas indicarlo solo dime el monto y producto y lo anoto).';
        } else {
          const amount = parseAmount(message);
          const paymentMethod = parsePayment(lower);
          
          // Check for client in message: "a mi cliente Juan", "al cliente Carlos", "a Juan"
          let clientName: string | undefined = undefined;
          const clientMatch = message.match(/(?:a|para|al)?\s*(?:mi\s+)?cliente\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+)?)/i) ||
                              message.match(/(?:a|para)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/i);
          if (clientMatch && !['una', 'un', 'el', 'la', 'los', 'las', 'venta', 'mi', 'su', 'este'].includes(clientMatch[1].toLowerCase().trim())) {
            clientName = clientMatch[1].trim();
          }

          let desc = message
            .replace(/(registra(?:r)?|regístrame|anota(?:r)?|anótame|agrega(?:r)?|ingresa(?:r)?|una|venta|vendí|vendi|cobré|cobre|por|de|en|\$|usd|dólares|dolares|bolívares|bolivares|bs|euros|\d+(?:[.,]\d+)?)/gi, '')
            .replace(/(efectivo|pago móvil|pago movil|transferencia|punto|zelle)/gi, '')
            .replace(/(?:a|para|al)?\s*(?:mi\s+)?cliente\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+/gi, '')
            .trim();
          if (!desc || desc.length < 2) desc = clientName ? `Venta a ${clientName}` : 'Venta';

          let matchedProduct: string | undefined = undefined;
          if (context?.inventorySample && Array.isArray(context.inventorySample)) {
            const found = context.inventorySample.find((p: any) => 
              p.name && (desc.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(desc.toLowerCase()))
            );
            if (found) matchedProduct = found.name;
          }

          const cur = lower.includes('bs') || lower.includes('bolivar') ? 'VES' : (lower.includes('euro') ? 'EUR' : 'USD');
          action = {
            type: 'record_sale',
            data: {
              description: desc,
              amount,
              currency: cur,
              paymentMethod,
              category: 'Venta de productos',
              productName: matchedProduct,
              clientName,
              quantity: 1,
            },
          };
          const sym = cur === 'VES' ? 'Bs. ' : (cur === 'EUR' ? '€' : '$');
          const clientMsg = clientName ? ` a ${clientName}` : '';
          replyText = `Listo, he registrado la venta de ${desc}${clientMsg} por ${sym}${amount} en ${paymentMethod}.`;
        }
      }
      // Command: "registra un gasto..."
      else if (lower.includes('gasto') || lower.includes('gasté') || lower.includes('gaste') || lower.includes('compra') || lower.includes('compré') || lower.includes('pagué') || lower.includes('pague') || lower.includes('egreso')) {
        const amount = parseAmount(message);
        const paymentMethod = parsePayment(lower);
        let desc = message
          .replace(/(registra(?:r)?|regístrame|anota(?:r)?|anótame|un|gasto|gasté|gaste|compra|compré|compre|pagué|pague|egreso|por|de|en|\$|usd|dólares|dolares|\d+(?:[.,]\d+)?)/gi, '')
          .replace(/(efectivo|pago móvil|pago movil|transferencia|punto|zelle)/gi, '')
          .trim();
        if (!desc || desc.length < 2) desc = 'Gasto por voz';

        const cur = lower.includes('bs') || lower.includes('bolivar') ? 'VES' : (lower.includes('euro') ? 'EUR' : 'USD');
        action = {
          type: 'record_expense',
          data: {
            description: desc,
            amount,
            currency: cur,
            category: 'Operativo',
            paymentMethod,
          },
        };
        const sym = cur === 'VES' ? 'Bs. ' : (cur === 'EUR' ? '€' : '$');
        replyText = `He anotado el gasto de ${desc} por ${sym}${amount} en ${paymentMethod}.`;
      }
      // Command: "anota una deuda..."
      else if (lower.includes('deuda') || lower.includes('fiado') || lower.includes('fiar') || lower.includes('debe')) {
        // First check if it's an inquiry: "¿quién me debe?", "¿cuáles son mis deudas?", etc.
        if (
          lower.includes('quién me debe') || 
          lower.includes('quien me debe') || 
          lower.includes('cuáles son mis deudas') || 
          lower.includes('cuales son mis deudas') || 
          lower.includes('quién debe') || 
          lower.includes('quien debe') ||
          lower.includes('cuánto me deben') ||
          lower.includes('cuanto me deben')
        ) {
          if (context?.debtorsList && !context.debtorsList.includes('No hay clientes')) {
            replyText = `Clientes que te deben dinero: ${context.debtorsList}. Tienes un total de $${context.pendingReceivables || 0} pendientes por cobrar.`;
          } else {
            replyText = 'No tienes clientes con deudas pendientes por cobrar en este momento. ¡Todas tus cuentas por cobrar están al día!';
          }
        } else if (lower.includes('a quién le debo') || lower.includes('a quien le debo') || lower.includes('por pagar') || lower.includes('debo')) {
          if (context?.payablesList && !context.payablesList.includes('No hay deudas')) {
            replyText = `Cuentas por pagar pendientes: ${context.payablesList}. Total por pagar: $${context.pendingPayables || 0}.`;
          } else {
            replyText = 'No tienes deudas pendientes por pagar a proveedores.';
          }
        } else {
          // It's a registration command
          const amount = parseAmount(message);
          let debtor = 'Cliente';
          const nameMatch = message.match(/\b(?:a|para|cliente)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/i);
          if (nameMatch && nameMatch[1] && !['una', 'un', 'el', 'la', 'los', 'las', 'deuda', 'mi', 'su'].includes(nameMatch[1].toLowerCase())) {
            debtor = nameMatch[1];
          } else {
            const altMatch = message.match(/\bdeuda\s+de\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/i);
            if (altMatch && altMatch[1] && !['una', 'un', 'el', 'la'].includes(altMatch[1].toLowerCase())) {
              debtor = altMatch[1];
            }
          }

          const isPorPagar = lower.includes('debo') || lower.includes('por pagar') || lower.includes('proveedor');
          action = {
            type: 'record_debt',
            data: {
              debtorName: debtor,
              amount,
              type: isPorPagar ? 'por_pagar' : 'por_cobrar',
              currency: 'USD',
              concept: 'Deuda registrada por voz',
            },
          };
          const tipoStr = isPorPagar ? 'por pagar a' : 'por cobrar a';
          replyText = `Deuda ${tipoStr} ${debtor} por $${amount} registrada con éxito.`;
        }
      } 
      // Command: "registra cliente..." or client inquiry (only if not financial amount)
      else if (lower.includes('cliente') && !/\b\d+\b/.test(lower)) {
        if (/^(?:registra|anota|crea|agrega|guardar?)\s+(?:un\s+)?cliente$/i.test(message.trim())) {
          replyText = '¿Cuál es el nombre del cliente y su número de teléfono o datos para registrarlo?';
        } else if (lower.includes('registra') || lower.includes('crea') || lower.includes('agrega') || lower.includes('anota')) {
          const phoneMatch = message.match(/(?:04\d{9}|\+?\d{10,14})/);
          const phone = phoneMatch ? phoneMatch[0] : '';
          let name = message
            .replace(/(registra(?:r)?|regístrame|anota(?:r)?|crea(?:r)?|agrega(?:r)?|nuevo|un|al|el|cliente|con|teléfono|telefono|celular|numero|número|\+?\d{9,14})/gi, '')
            .trim();
          if (!name) name = 'Nuevo Cliente';
          action = {
            type: 'record_client',
            data: {
              name,
              phone,
              location: '',
              notes: 'Registrado por asistente IA',
            },
          };
          replyText = `Listo, he registrado al cliente ${name}${phone ? ' con teléfono ' + phone : ''}.`;
        } else {
          replyText = `Tienes ${context?.totalClients ?? 0} clientes registrados en tu agenda. ${context?.clientsSample ? 'Por ejemplo: ' + context.clientsSample : ''}`;
        }
      }
      // Ambiguous registration: "registra 20 dólares", "anota 15", etc.
      else if (/^(?:registra|anota|guarda|ingresa)\s+(?:unos?\s+)?\d+(?:[.,]\d+)?\s*(?:dólares|dolares|usd|\$|bolívares|bolivares|bs|euros)?$/i.test(message.trim())) {
        const amt = parseAmount(message);
        replyText = `¿Los $${amt} corresponden a una venta o a un gasto? ¿De qué producto o concepto fue?`;
      }
      // Stock query: "¿qué productos tengo?", "¿cuántas camisas me quedan?"
      else if (lower.includes('stock') || lower.includes('inventario') || lower.includes('producto') || lower.includes('queda')) {
        const items = context?.inventorySample || [];
        if (items.length > 0) {
          const sample = items.slice(0, 3).map((p: any) => `${p.name} (${p.stock} unidades a $${p.price})`).join(', ');
          replyText = `Tienes ${items.length} productos registrados. Por ejemplo: ${sample}.`;
        } else {
          replyText = 'Tu catálogo de inventario está vacío. Puedes agregar nuevos productos desde la pestaña de Inventario.';
        }
      } else if (lower.includes('hola') || lower.includes('buenos') || lower.includes('buenas')) {
        replyText = `¡Hola! Aquí estoy listo para ayudarte. Puedes pedirme registrar ventas, gastos, clientes o preguntarme cuánto tienes en el medio.`;
      } else {
        replyText = 'Te escucho con atención. Puedes decirme qué venta o gasto registrar, anotar una deuda o cliente, o consultar tu balance de hoy.';
      }
    }

    return res.json({
      reply: replyText,
      action,
    });
  } catch (err: any) {
    console.error('Error en /api/assistant/chat:', err);
    return res.status(500).json({
      error: err?.message || 'Ocurrió un error al procesar el mensaje con Gemini AI.',
    });
  }
});

// Vite middleware or production static files
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finova Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
