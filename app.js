/**
 * FinFlow - Painel de Controle Financeiro Pessoal
 * Arquitetura Vanilla JS Modular ES6+
 * Recursos: PWA Offline, Recorrência Inteligente, Edição In-Place, Máscara Monetária, Exportação CSV
 */

(() => {
  'use strict';

  // ==========================================================================
  // 1. CONFIGURAÇÕES & CONSTANTES
  // ==========================================================================
  const STORAGE_KEY = '@finance:state_v1';

  const CATEGORY_COLORS = {
    'Alimentação': '#f97316', // Laranja
    'Transporte': '#3b82f6',  // Azul
    'Moradia': '#8b5cf6',     // Roxo
    'Lazer': '#ec4899',       // Rosa
    'Saúde': '#10b981',       // Verde Esmeralda
    'Educação': '#06b6d4',    // Ciano
    'Compras': '#f59e0b',     // Âmbar
    'Serviços': '#eab308',    // Amarelo
    'Assinaturas': '#a855f7', // Púrpura
    'Outros': '#64748b'       // Slate
  };

  const CATEGORY_ICONS = {
    'Alimentação': 'fa-utensils',
    'Transporte': 'fa-car-side',
    'Moradia': 'fa-house',
    'Lazer': 'fa-gamepad',
    'Saúde': 'fa-heart-pulse',
    'Educação': 'fa-graduation-cap',
    'Compras': 'fa-bag-shopping',
    'Serviços': 'fa-bolt',
    'Assinaturas': 'fa-film',
    'Outros': 'fa-tags'
  };

  const METHOD_ICONS = {
    'Pix': 'fa-bolt text-teal-400',
    'Cartão de Crédito': 'fa-credit-card text-indigo-400',
    'Cartão de Débito': 'fa-wallet text-sky-400',
    'Dinheiro': 'fa-money-bill-wave text-emerald-400'
  };

  const INCOME_TYPE_META = {
    'Salário': { icon: 'fa-briefcase', color: '#10b981' },
    'Freelance / Extra': { icon: 'fa-laptop-code', color: '#6366f1' },
    'Benefícios / Auxílio': { icon: 'fa-gift', color: '#06b6d4' },
    'Investimentos / Dividendos': { icon: 'fa-chart-line', color: '#f59e0b' },
    'Bônus / 13º': { icon: 'fa-award', color: '#a855f7' },
    'Vendas / Reembolso': { icon: 'fa-hand-holding-dollar', color: '#3b82f6' },
    'Aluguel / Renda Passiva': { icon: 'fa-house-chimney', color: '#ec4899' },
    'Outros': { icon: 'fa-coins', color: '#64748b' }
  };

  // ==========================================================================
  // 2. FUNÇÕES UTILITÁRIAS & DEFENSIVIDADE
  // ==========================================================================
  const Utils = {
    /**
     * Formatação monetária oficial para Real Brasileiro (R$)
     */
    formatCurrency(value) {
      const num = Number(value);
      const safeNum = isNaN(num) ? 0 : num;
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(safeNum);
    },

    /**
     * Converte de forma segura inputs do usuário para float
     */
    parseCurrency(input) {
      if (typeof input === 'number') {
        return isNaN(input) ? 0 : input;
      }
      if (!input || typeof input !== 'string') {
        return 0;
      }

      let sanitized = input.trim().replace(/[R$\s]/g, '');

      // Trata padrões como "1.234,56" convertendo para "1234.56"
      if (sanitized.includes(',') && sanitized.includes('.')) {
        sanitized = sanitized.replace(/\./g, '').replace(',', '.');
      } else if (sanitized.includes(',')) {
        sanitized = sanitized.replace(',', '.');
      }

      const parsed = parseFloat(sanitized);
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    },

    /**
     * Formata número puro para exibição em input (ex: 1850.50 -> "1.850,50")
     */
    formatNumberToInput(val) {
      const num = Number(val);
      if (isNaN(num) || num === 0) return '0,00';
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    /**
     * Máscara inteligente de digitação estilo caixa eletrônico (deslocamento de centavos)
     */
    attachCurrencyMask(inputElement) {
      if (!inputElement) return;

      const formatValue = (rawDigits) => {
        const digitsOnly = String(rawDigits).replace(/\D/g, '');
        if (!digitsOnly) return '0,00';
        const num = parseInt(digitsOnly, 10) / 100;
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      inputElement.addEventListener('input', (e) => {
        const formatted = formatValue(e.target.value);
        e.target.value = formatted;
      });

      inputElement.addEventListener('focus', (e) => {
        if (!e.target.value || e.target.value === '0,00') {
          e.target.select();
        }
      });
    },

    /**
     * Formata data ISO (YYYY-MM-DD) para padrão brasileiro DD/MM/AAAA
     */
    formatDate(isoDateStr) {
      if (!isoDateStr || typeof isoDateStr !== 'string') return '--/--/----';
      const parts = isoDateStr.split('-');
      if (parts.length !== 3) return isoDateStr;
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    },

    /**
     * Retorna a data de hoje em formato YYYY-MM-DD
     */
    getTodayISO() {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    /**
     * Retorna o período do mês corrente em formato YYYY-MM
     */
    getCurrentPeriodISO() {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    },

    /**
     * Formata string de período (ex: '2026-11') para 'Novembro de 2026'
     */
    formatPeriod(periodStr) {
      if (!periodStr) return '';
      const [yearStr, monthStr] = periodStr.split('-');
      const year = parseInt(yearStr, 10);
      const monthIndex = parseInt(monthStr, 10) - 1;
      const date = new Date(year, monthIndex, 1);
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    },

    /**
     * Navega meses (+1 ou -1) mantendo formato YYYY-MM
     */
    shiftPeriod(periodStr, delta) {
      const [yearStr, monthStr] = periodStr.split('-');
      let year = parseInt(yearStr, 10);
      let month = parseInt(monthStr, 10) + delta;

      if (month < 1) {
        month = 12;
        year -= 1;
      } else if (month > 12) {
        month = 1;
        year += 1;
      }

      return `${year}-${String(month).padStart(2, '0')}`;
    },

    /**
     * Ajusta uma data ISO (YYYY-MM-DD) para outro mês (YYYY-MM) preservando o dia válido
     */
    shiftDateToPeriod(dateISO, targetPeriod) {
      if (!dateISO || typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
        return null;
      }
      const [targetYear, targetMonth] = targetPeriod.split('-').map(Number);
      const originalDay = parseInt(dateISO.split('-')[2], 10) || 1;
      const daysInTarget = new Date(targetYear, targetMonth, 0).getDate();
      const clampedDay = Math.min(originalDay, daysInTarget);
      return `${targetPeriod}-${String(clampedDay).padStart(2, '0')}`;
    },

    /**
     * Retorna o período YYYY-MM de uma entrada de renda
     */
    getIncomePeriod(entry) {
      if (!entry || typeof entry !== 'object') return '';
      if (typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        return entry.date.slice(0, 7);
      }
      return typeof entry.period === 'string' ? entry.period : '';
    },

    /**
     * Sanitização estrita contra injeção de HTML / XSS
     */
    escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Geração segura de UUID compatível com browsers modernos
     */
    generateUUID() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    },

    /**
     * Calcula o status da conta a pagar
     */
    calculateBillStatus(dueDateISO, isPaid, soonDays = 3) {
      if (isPaid) {
        return {
          label: 'Pago',
          cssClass: 'status-pill-paid',
          dotColor: 'bg-emerald-400',
          key: 'paid',
          diffDays: 0
        };
      }

      if (!dueDateISO || typeof dueDateISO !== 'string' || !dueDateISO.includes('-')) {
        return {
          label: 'Pendente',
          cssClass: 'status-pill-pending',
          dotColor: 'bg-slate-400',
          key: 'pending',
          diffDays: 999
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [year, month, day] = dueDateISO.split('-').map(Number);
      const due = new Date(year, month - 1, day);
      due.setHours(0, 0, 0, 0);

      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const parsedDays = Number(soonDays);
      const threshold = (Number.isFinite(parsedDays) && parsedDays >= 0) ? parsedDays : 3;

      if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        return {
          label: overdueDays === 1 ? 'Atrasado (1d)' : `Atrasado (${overdueDays}d)`,
          cssClass: 'status-pill-overdue',
          dotColor: 'bg-rose-500',
          key: 'overdue',
          diffDays
        };
      } else if (diffDays <= threshold) {
        const soonLabel = diffDays === 0
          ? 'Vence Hoje'
          : (diffDays === 1 ? 'Vence amanhã' : `Vence em ${diffDays}d`);
        return {
          label: soonLabel,
          cssClass: 'status-pill-soon',
          dotColor: 'bg-amber-400',
          key: 'soon',
          diffDays
        };
      } else {
        return {
          label: 'Pendente',
          cssClass: 'status-pill-pending',
          dotColor: 'bg-slate-400',
          key: 'pending',
          diffDays
        };
      }
    },

    normalizeAlertSettings(raw) {
      const source = (raw && typeof raw === 'object') ? raw : {};
      const allowedDays = [0, 1, 3, 5, 7];
      const parsedDays = Number(source.daysBefore);
      const daysBefore = allowedDays.includes(parsedDays) ? parsedDays : 3;

      return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
        daysBefore,
        browserNotify: typeof source.browserNotify === 'boolean' ? source.browserNotify : false,
        lastNotifiedDate: typeof source.lastNotifiedDate === 'string' ? source.lastNotifiedDate : null,
        dismissedDate: typeof source.dismissedDate === 'string' ? source.dismissedDate : null
      };
    }
  };

  // ==========================================================================
  // 3. SISTEMA DE TOASTS FLUTUANTES (SEM ALERTS NATIVOS)
  // ==========================================================================
  const Toast = {
    container: document.getElementById('toastContainer'),

    show(message, type = 'info', duration = 3200) {
      if (!this.container) return;

      const toast = document.createElement('div');
      toast.className = 'toast-item pointer-events-auto flex items-center gap-3 px-4 py-3 bg-slate-800/95 border rounded-xl shadow-2xl backdrop-blur-md text-xs sm:text-sm text-slate-100';

      let borderClass = 'border-slate-700';
      let icon = '<i class="fa-solid fa-circle-info text-indigo-400 text-base"></i>';

      if (type === 'success') {
        borderClass = 'border-emerald-500/40';
        icon = '<i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>';
      } else if (type === 'error') {
        borderClass = 'border-rose-500/40';
        icon = '<i class="fa-solid fa-circle-exclamation text-rose-400 text-base"></i>';
      } else if (type === 'warning') {
        borderClass = 'border-amber-500/40';
        icon = '<i class="fa-solid fa-triangle-exclamation text-amber-400 text-base"></i>';
      }

      toast.classList.add(borderClass);
      toast.innerHTML = `
        <div class="flex-shrink-0">${icon}</div>
        <div class="flex-1 font-medium leading-tight">${Utils.escapeHTML(message)}</div>
        <button class="toast-close text-slate-400 hover:text-white p-1 ml-1" aria-label="Fechar">
          <i class="fa-solid fa-xmark text-xs"></i>
        </button>
      `;

      const removeToast = () => {
        toast.classList.add('removing');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 220);
      };

      toast.querySelector('.toast-close').addEventListener('click', removeToast);
      this.container.appendChild(toast);

      setTimeout(removeToast, duration);
    }
  };

  // ==========================================================================
  // 4. MODAL DE CONFIRMAÇÃO ASSÍNCRONO
  // ==========================================================================
  const ConfirmDialog = {
    modal: document.getElementById('confirmModal'),
    titleEl: document.getElementById('confirmModalTitle'),
    messageEl: document.getElementById('confirmModalMessage'),
    okBtn: document.getElementById('okConfirmBtn'),
    cancelBtn: document.getElementById('cancelConfirmBtn'),
    resolveCallback: null,

    init() {
      if (!this.modal) return;
      this.cancelBtn.addEventListener('click', () => this.close(false));
      this.okBtn.addEventListener('click', () => this.close(true));
      this.modal.querySelector('.modal-backdrop')?.addEventListener('click', () => this.close(false));
    },

    open({ title = 'Confirmar Exclusão', message = 'Tem certeza que deseja continuar?' }) {
      return new Promise((resolve) => {
        this.resolveCallback = resolve;
        this.titleEl.textContent = title;
        this.messageEl.textContent = message;
        this.modal.classList.remove('hidden');
      });
    },

    close(result) {
      this.modal.classList.add('hidden');
      if (this.resolveCallback) {
        this.resolveCallback(result);
        this.resolveCallback = null;
      }
    }
  };

  // ==========================================================================
  // 5. GERENCIAMENTO DE ARMAZENAMENTO (LOCALSTORAGE)
  // ==========================================================================
  const Storage = {
    getDefaultState() {
      const currentPeriod = Utils.getCurrentPeriodISO();
      const todayISO = Utils.getTodayISO();

      return {
        version: 2,
        currentPeriod: currentPeriod,
        incomeEntries: [
          {
            id: Utils.generateUUID(),
            title: 'Salário Principal',
            type: 'Salário',
            amount: 6500.00,
            date: `${currentPeriod}-05`,
            period: currentPeriod,
            createdAt: new Date().toISOString()
          }
        ],
        budgets: {
          'Alimentação': 1200.00,
          'Transporte': 350.00,
          'Lazer': 250.00
        },
        plans: [],
        alertSettings: Utils.normalizeAlertSettings(),
        bills: [
          {
            id: Utils.generateUUID(),
            title: 'Aluguel & Condomínio',
            amount: 1850.00,
            dueDate: `${currentPeriod}-10`,
            category: 'Moradia',
            paid: true,
            createdAt: new Date().toISOString()
          },
          {
            id: Utils.generateUUID(),
            title: 'Energia Elétrica (Enel)',
            amount: 195.40,
            dueDate: `${currentPeriod}-15`,
            category: 'Serviços',
            paid: false,
            createdAt: new Date().toISOString()
          },
          {
            id: Utils.generateUUID(),
            title: 'Internet Fibra 600MB',
            amount: 129.90,
            dueDate: `${currentPeriod}-20`,
            category: 'Serviços',
            paid: false,
            createdAt: new Date().toISOString()
          },
          {
            id: Utils.generateUUID(),
            title: 'Plano de Saúde',
            amount: 420.00,
            dueDate: `${currentPeriod}-25`,
            category: 'Saúde',
            paid: false,
            createdAt: new Date().toISOString()
          }
        ],
        expenses: [
          {
            id: Utils.generateUUID(),
            description: 'Supermercado Mensal',
            amount: 540.35,
            category: 'Alimentação',
            method: 'Cartão de Crédito',
            date: todayISO,
            createdAt: new Date().toISOString()
          },
          {
            id: Utils.generateUUID(),
            description: 'Combustível Posto Ipiranga',
            amount: 180.00,
            category: 'Transporte',
            method: 'Pix',
            date: todayISO,
            createdAt: new Date().toISOString()
          },
          {
            id: Utils.generateUUID(),
            description: 'Cinema + Lanche',
            amount: 85.50,
            category: 'Lazer',
            method: 'Cartão de Débito',
            date: todayISO,
            createdAt: new Date().toISOString()
          }
        ]
      };
    },

    normalizeIncomeEntry(raw, fallbackPeriod) {
      if (!raw || typeof raw !== 'object') return null;

      const title = (typeof raw.title === 'string' && raw.title.trim())
        ? raw.title.trim()
        : 'Renda';
      const type = INCOME_TYPE_META[raw.type] ? raw.type : 'Outros';
      const parsedAmount = Number(raw.amount);
      const amount = (Number.isFinite(parsedAmount) && parsedAmount >= 0)
        ? Math.round(parsedAmount * 100) / 100
        : 0;

      const isValidDate = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date);
      const date = isValidDate ? raw.date : null;
      const isValidPeriod = typeof raw.period === 'string' && /^\d{4}-\d{2}$/.test(raw.period);
      const period = date ? date.slice(0, 7) : (isValidPeriod ? raw.period : fallbackPeriod);

      return {
        id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id : Utils.generateUUID(),
        title,
        type,
        amount,
        date,
        period,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {})
      };
    },

    normalizeIncomeEntries(parsed) {
      const fallbackPeriod = (typeof parsed.currentPeriod === 'string' && /^\d{4}-\d{2}$/.test(parsed.currentPeriod))
        ? parsed.currentPeriod
        : Utils.getCurrentPeriodISO();

      if (Array.isArray(parsed.incomeEntries)) {
        return parsed.incomeEntries
          .map(entry => this.normalizeIncomeEntry(entry, fallbackPeriod))
          .filter(Boolean);
      }

      // Migração transparente do formato legado (monthlyIncome / incomes[YYYY-MM])
      const migrated = [];
      const legacyIncomes = (parsed.incomes && typeof parsed.incomes === 'object') ? parsed.incomes : {};
      const periodsSeen = new Set();

      Object.entries(legacyIncomes).forEach(([period, val]) => {
        if (!/^\d{4}-\d{2}$/.test(period)) return;
        periodsSeen.add(period);
        const amount = Number(val);
        if (Number.isFinite(amount) && amount > 0) {
          migrated.push(this.normalizeIncomeEntry({
            title: 'Renda Mensal',
            type: 'Salário',
            amount,
            date: null,
            period
          }, fallbackPeriod));
        }
      });

      const legacyMonthly = Number(parsed.monthlyIncome);
      if (!periodsSeen.has(fallbackPeriod) && Number.isFinite(legacyMonthly) && legacyMonthly > 0) {
        migrated.push(this.normalizeIncomeEntry({
          title: 'Renda Mensal',
          type: 'Salário',
          amount: legacyMonthly,
          date: null,
          period: fallbackPeriod
        }, fallbackPeriod));
      }

      return migrated.filter(Boolean);
    },

    normalizePlan(raw) {
      if (!raw || typeof raw !== 'object') return null;

      const title = (typeof raw.title === 'string' && raw.title.trim())
        ? raw.title.trim()
        : 'Planejamento';
      const parsedTarget = Number(raw.targetAmount);
      const targetAmount = (Number.isFinite(parsedTarget) && parsedTarget >= 0)
        ? Math.round(parsedTarget * 100) / 100
        : 0;
      const parsedSaved = Number(raw.savedAmount);
      const savedAmount = (Number.isFinite(parsedSaved) && parsedSaved >= 0)
        ? Math.round(parsedSaved * 100) / 100
        : 0;
      const category = CATEGORY_COLORS[raw.category] ? raw.category : 'Compras';
      const mode = raw.mode === 'save' ? 'save' : 'installment';
      const parsedInst = parseInt(raw.installments, 10);
      const installments = (Number.isFinite(parsedInst) && parsedInst >= 1)
        ? Math.min(36, parsedInst)
        : 10;
      const parsedMonthly = Number(raw.monthlyContribution);
      const monthlyContribution = (Number.isFinite(parsedMonthly) && parsedMonthly >= 0)
        ? Math.round(parsedMonthly * 100) / 100
        : 0;
      const paymentMethod = METHOD_ICONS[raw.paymentMethod] ? raw.paymentMethod : 'Cartão de Crédito';
      const status = raw.status === 'completed' ? 'completed' : 'active';

      return {
        id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id : Utils.generateUUID(),
        title,
        targetAmount,
        savedAmount,
        category,
        mode,
        installments,
        monthlyContribution,
        paymentMethod,
        status,
        completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {})
      };
    },

    normalizePlans(rawPlans) {
      if (!Array.isArray(rawPlans)) return [];
      return rawPlans.map(p => this.normalizePlan(p)).filter(Boolean);
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const defaultState = this.getDefaultState();
          this.save(defaultState);
          return defaultState;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Estado inválido');
        }

        const wasLegacyIncome = !Array.isArray(parsed.incomeEntries);

        if (!Array.isArray(parsed.bills)) parsed.bills = [];
        if (!Array.isArray(parsed.expenses)) parsed.expenses = [];
        if (!parsed.currentPeriod || !/^\d{4}-\d{2}$/.test(parsed.currentPeriod)) {
          parsed.currentPeriod = Utils.getCurrentPeriodISO();
        }
        if (!parsed.budgets || typeof parsed.budgets !== 'object') {
          parsed.budgets = {};
        }

        parsed.incomeEntries = this.normalizeIncomeEntries(parsed);
        parsed.plans = this.normalizePlans(parsed.plans);
        delete parsed.monthlyIncome;
        delete parsed.incomes;
        parsed.version = 2;
        parsed.alertSettings = Utils.normalizeAlertSettings(parsed.alertSettings);

        if (wasLegacyIncome) {
          this.save(parsed);
        }

        return parsed;
      } catch (err) {
        console.error('Erro ao ler localStorage:', err);
        Toast.show('Erro ao carregar dados salvos. Usando dados padrão.', 'warning');
        return this.getDefaultState();
      }
    },

    save(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (err) {
        console.error('Erro ao salvar no localStorage:', err);
        Toast.show('Falha ao persistir alterações no armazenamento local.', 'error');
        return false;
      }
    }
  };

  // ==========================================================================
  // 6. GERENCIADOR DO GRÁFICO (CHART.JS)
  // ==========================================================================
  const ChartManager = {
    chartInstance: null,

    render(categoriesData) {
      const canvas = document.getElementById('categoryDistributionChart');
      const emptyState = document.getElementById('chartEmptyState');
      if (!canvas) return;

      const labels = Object.keys(categoriesData);
      const dataValues = Object.values(categoriesData);
      const hasData = dataValues.some(val => val > 0);

      if (!hasData) {
        if (this.chartInstance) {
          this.chartInstance.destroy();
          this.chartInstance = null;
        }
        canvas.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }

      canvas.classList.remove('hidden');
      if (emptyState) emptyState.classList.add('hidden');

      const backgroundColors = labels.map(cat => CATEGORY_COLORS[cat] || '#64748b');

      if (this.chartInstance) {
        this.chartInstance.data.labels = labels;
        this.chartInstance.data.datasets[0].data = dataValues;
        this.chartInstance.data.datasets[0].backgroundColor = backgroundColors;
        this.chartInstance.update();
        return;
      }

      const ctx = canvas.getContext('2d');
      this.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: dataValues,
            backgroundColor: backgroundColors,
            borderColor: '#1e293b',
            borderWidth: 3,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#f8fafc',
              bodyColor: '#94a3b8',
              borderColor: '#334155',
              borderWidth: 1,
              padding: 10,
              boxPadding: 4,
              usePointStyle: true,
              callbacks: {
                label: function (context) {
                  const val = context.raw || 0;
                  return ` ${context.label}: ${Utils.formatCurrency(val)}`;
                }
              }
            }
          }
        }
      });
    }
  };

  // ==========================================================================
  // 7. CONTROLADOR PRINCIPAL DA APLICAÇÃO (APP)
  // ==========================================================================
  const App = {
    state: null,
    billFilter: 'all',
    expenseSearchQuery: '',
    expenseCategoryFilter: 'all',

    init() {
      ConfirmDialog.init();
      this.state = Storage.load();

      this.cacheDOMElements();
      this.bindEvents();
      this.initCurrencyMasks();
      this.registerServiceWorker();
      this.render();

      console.log('FinFlow iniciado com sucesso.');
    },

    registerServiceWorker() {
      if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('[SW] Registrado com sucesso para modo offline.'))
            .catch(err => console.warn('[SW] Falha no registro:', err));
        });
      }
    },

    initCurrencyMasks() {
      Utils.attachCurrencyMask(this.incomeInput);
      Utils.attachCurrencyMask(this.billAmountInput);
      Utils.attachCurrencyMask(this.expenseAmountInput);
      Utils.attachCurrencyMask(this.planTargetAmountInput);
      Utils.attachCurrencyMask(this.planSavedAmountInput);
      Utils.attachCurrencyMask(this.planMonthlyContributionInput);
    },

    cacheDOMElements() {
      // Header & Período
      this.currentPeriodDisplay = document.getElementById('currentPeriodDisplay');
      this.prevMonthBtn = document.getElementById('prevMonthBtn');
      this.nextMonthBtn = document.getElementById('nextMonthBtn');

      // KPIs
      this.kpiIncome = document.getElementById('kpiIncome');
      this.kpiIncomeSubtitle = document.getElementById('kpiIncomeSubtitle');
      this.kpiBillsTotal = document.getElementById('kpiBillsTotal');
      this.kpiBillsStatusSubtitle = document.getElementById('kpiBillsStatusSubtitle');
      this.kpiBillsProgressPercent = document.getElementById('kpiBillsProgressPercent');
      this.kpiBillsProgressBar = document.getElementById('kpiBillsProgressBar');
      this.kpiExpensesTotal = document.getElementById('kpiExpensesTotal');
      this.kpiExpensesSubtitle = document.getElementById('kpiExpensesSubtitle');
      this.kpiBalanceCard = document.getElementById('kpiBalanceCard');
      this.kpiBalance = document.getElementById('kpiBalance');
      this.kpiBalanceSubtitle = document.getElementById('kpiBalanceSubtitle');
      this.kpiBalanceIcon = document.getElementById('kpiBalanceIcon');

      // Burn-Rate (Ritmo de Queima)
      this.burnRateWidget = document.getElementById('burnRateWidget');
      this.burnRateStatusIcon = document.getElementById('burnRateStatusIcon');
      this.burnRateStatusBadge = document.getElementById('burnRateStatusBadge');
      this.burnRateMessage = document.getElementById('burnRateMessage');
      this.burnRateDailyAllowance = document.getElementById('burnRateDailyAllowance');
      this.burnRateDaysLeft = document.getElementById('burnRateDaysLeft');
      this.burnRateActualPace = document.getElementById('burnRateActualPace');
      this.burnRateProjectedEnd = document.getElementById('burnRateProjectedEnd');

      // Contas & Recorrência
      this.billsListContainer = document.getElementById('billsListContainer');
      this.billsCountBadge = document.getElementById('billsCountBadge');
      this.billFilterBtns = document.querySelectorAll('.bill-filter-btn');
      this.recurrentBillsBanner = document.getElementById('recurrentBillsBanner');
      this.recurrentBillsBannerText = document.getElementById('recurrentBillsBannerText');
      this.confirmReplicateBillsBtn = document.getElementById('confirmReplicateBillsBtn');
      this.replicateBillsHeaderBtn = document.getElementById('replicateBillsHeaderBtn');

      // Gastos
      this.expensesListContainer = document.getElementById('expensesListContainer');
      this.expensesCountBadge = document.getElementById('expensesCountBadge');
      this.expenseSearchInput = document.getElementById('expenseSearchInput');
      this.expenseCategoryFilterSelect = document.getElementById('expenseCategoryFilter');
      this.expenseMethodFilterSelect = document.getElementById('expenseMethodFilter');

      // Insights, Orçamentos & Planejamento
      this.categoryBreakdownList = document.getElementById('categoryBreakdownList');
      this.methodsBreakdownContainer = document.getElementById('methodsBreakdownContainer');
      this.budgetBreakdownList = document.getElementById('budgetBreakdownList');
      this.planningBreakdownList = document.getElementById('planningBreakdownList');

      // Modais & Edição
      this.incomeModal = document.getElementById('incomeModal');
      this.incomeModalSubtitle = document.getElementById('incomeModalSubtitle');
      this.incomeModalBody = document.getElementById('incomeModalBody');
      this.incomeModalTotal = document.getElementById('incomeModalTotal');
      this.incomeModalCountBadge = document.getElementById('incomeModalCountBadge');
      this.replicateIncomesBtn = document.getElementById('replicateIncomesBtn');
      this.incomeForm = document.getElementById('incomeForm');
      this.incomeFormTitle = document.getElementById('incomeFormTitle');
      this.incomeEditId = document.getElementById('incomeEditId');
      this.incomeTitleInput = document.getElementById('incomeTitleInput');
      this.incomeTypeSelect = document.getElementById('incomeTypeSelect');
      this.incomeInput = document.getElementById('incomeInput');
      this.incomeDateInput = document.getElementById('incomeDateInput');
      this.cancelIncomeEditBtn = document.getElementById('cancelIncomeEditBtn');
      this.incomeSubmitBtn = document.getElementById('incomeSubmitBtn');
      this.incomesListContainer = document.getElementById('incomesListContainer');

      this.budgetModal = document.getElementById('budgetModal');
      this.budgetForm = document.getElementById('budgetForm');
      this.budgetInputsContainer = document.getElementById('budgetInputsContainer');

      this.billModal = document.getElementById('billModal');
      this.billForm = document.getElementById('billForm');
      this.billModalTitle = document.getElementById('billModalTitle');
      this.billSubmitBtn = document.getElementById('billSubmitBtn');
      this.billEditId = document.getElementById('billEditId');
      this.billTitleInput = document.getElementById('billTitleInput');
      this.billAmountInput = document.getElementById('billAmountInput');
      this.billDueDateInput = document.getElementById('billDueDateInput');
      this.billCategorySelect = document.getElementById('billCategorySelect');

      this.expenseModal = document.getElementById('expenseModal');
      this.expenseForm = document.getElementById('expenseForm');
      this.expenseModalTitle = document.getElementById('expenseModalTitle');
      this.expenseSubmitBtn = document.getElementById('expenseSubmitBtn');
      this.expenseEditId = document.getElementById('expenseEditId');
      this.expenseDescriptionInput = document.getElementById('expenseDescriptionInput');
      this.expenseAmountInput = document.getElementById('expenseAmountInput');
      this.expenseDateInput = document.getElementById('expenseDateInput');
      this.expenseCategorySelect = document.getElementById('expenseCategorySelect');
      this.expenseMethodSelect = document.getElementById('expenseMethodSelect');

      // Parcelamento
      this.expenseInstallmentContainer = document.getElementById('expenseInstallmentContainer');
      this.expenseIsInstallmentCheckbox = document.getElementById('expenseIsInstallmentCheckbox');
      this.expenseInstallmentFields = document.getElementById('expenseInstallmentFields');
      this.expenseInstallmentCount = document.getElementById('expenseInstallmentCount');

      // Backup & CSV
      this.exportCsvBtn = document.getElementById('exportCsvBtn');
      this.exportDataBtn = document.getElementById('exportDataBtn');
      this.importDataBtn = document.getElementById('importDataBtn');
      this.importFileInput = document.getElementById('importFileInput');

      // Alertas de Vencimento
      this.openAlertModalBtn = document.getElementById('openAlertModalBtn');
      this.headerAlertBadge = document.getElementById('headerAlertBadge');
      this.mobileAlertBtn = document.getElementById('mobileAlertBtn');
      this.mobileAlertBadge = document.getElementById('mobileAlertBadge');
      this.openAlertBillsBtn = document.getElementById('openAlertBillsBtn');

      this.dueAlertsBanner = document.getElementById('dueAlertsBanner');
      this.alertsBannerIconWrap = document.getElementById('alertsBannerIconWrap');
      this.alertsBannerIcon = document.getElementById('alertsBannerIcon');
      this.alertsBannerTitle = document.getElementById('alertsBannerTitle');
      this.alertsBannerBadges = document.getElementById('alertsBannerBadges');
      this.alertsBannerSubtitle = document.getElementById('alertsBannerSubtitle');
      this.alertsBannerList = document.getElementById('alertsBannerList');
      this.openAlertsFromBannerBtn = document.getElementById('openAlertsFromBannerBtn');
      this.dismissAlertsBannerBtn = document.getElementById('dismissAlertsBannerBtn');

      this.alertModal = document.getElementById('alertModal');
      this.alertForm = document.getElementById('alertForm');
      this.alertEnabledToggle = document.getElementById('alertEnabledToggle');
      this.alertOptionsGroup = document.getElementById('alertOptionsGroup');
      this.alertDaysBeforeSelect = document.getElementById('alertDaysBeforeSelect');
      this.alertBrowserNotifyToggle = document.getElementById('alertBrowserNotifyToggle');
      this.alertModalSummaryBox = document.getElementById('alertModalSummaryBox');

      // Planejamento de Compras
      this.planningModal = document.getElementById('planningModal');
      this.planningModalBody = document.getElementById('planningModalBody');
      this.planningForm = document.getElementById('planningForm');
      this.planningFormTitle = document.getElementById('planningFormTitle');
      this.planEditId = document.getElementById('planEditId');
      this.planModeInput = document.getElementById('planModeInput');
      this.planModeBtns = document.querySelectorAll('.plan-mode-btn');
      this.cancelPlanningEditBtn = document.getElementById('cancelPlanningEditBtn');
      this.planTitleInput = document.getElementById('planTitleInput');
      this.planCategorySelect = document.getElementById('planCategorySelect');
      this.planTargetAmountInput = document.getElementById('planTargetAmountInput');
      this.planSavedAmountInput = document.getElementById('planSavedAmountInput');
      this.planInstallmentFields = document.getElementById('planInstallmentFields');
      this.planInstallmentsSelect = document.getElementById('planInstallmentsSelect');
      this.planPaymentMethodSelect = document.getElementById('planPaymentMethodSelect');
      this.planSaveFields = document.getElementById('planSaveFields');
      this.planMonthlyContributionInput = document.getElementById('planMonthlyContributionInput');
      this.planPresetMonthBtns = document.querySelectorAll('[data-plan-preset-months]');
      this.planUseFreeBalanceBtn = document.getElementById('planUseFreeBalanceBtn');
      this.planSimulationPreview = document.getElementById('planSimulationPreview');
      this.planningSubmitBtn = document.getElementById('planningSubmitBtn');
      this.plansCountBadge = document.getElementById('plansCountBadge');
      this.plansListContainer = document.getElementById('plansListContainer');
    },

    bindEvents() {
      // 1. Navegação de Mês
      this.prevMonthBtn?.addEventListener('click', () => this.changePeriod(-1));
      this.nextMonthBtn?.addEventListener('click', () => this.changePeriod(1));

      // 2. Modais - Abertura
      const openIncome = () => this.openIncomeModal();

      document.getElementById('openIncomeModalBtn')?.addEventListener('click', openIncome);
      document.getElementById('quickEditIncomeBtn')?.addEventListener('click', openIncome);
      document.getElementById('mobileIncomeBtn')?.addEventListener('click', openIncome);

      const openBillModal = () => {
        this.billForm.reset();
        this.billEditId.value = '';
        this.billModalTitle.textContent = 'Nova Conta Fixa';
        this.billSubmitBtn.textContent = 'Cadastrar Conta';
        this.billAmountInput.value = '0,00';
        this.billDueDateInput.value = `${this.state.currentPeriod}-10`;
        this.openModal(this.billModal);
        this.billTitleInput.focus();
      };
      document.getElementById('openNewBillModalBtn')?.addEventListener('click', openBillModal);
      document.getElementById('mobileNewBillBtn')?.addEventListener('click', openBillModal);

      const openExpenseModal = () => {
        this.expenseForm.reset();
        this.expenseEditId.value = '';
        this.expenseModalTitle.textContent = 'Novo Lançamento Diário';
        this.expenseSubmitBtn.textContent = 'Registrar Gasto';
        this.expenseAmountInput.value = '0,00';
        this.expenseDateInput.value = Utils.getTodayISO();
        if (this.expenseIsInstallmentCheckbox) this.expenseIsInstallmentCheckbox.checked = false;
        if (this.expenseInstallmentFields) this.expenseInstallmentFields.classList.add('hidden');
        if (this.expenseInstallmentContainer) this.expenseInstallmentContainer.classList.remove('hidden');
        this.openModal(this.expenseModal);
        this.expenseDescriptionInput.focus();
      };
      document.getElementById('openNewExpenseModalBtn')?.addEventListener('click', openExpenseModal);
      document.getElementById('mobileNewExpenseBtn')?.addEventListener('click', openExpenseModal);

      // Alternância de Parcelamento
      this.expenseIsInstallmentCheckbox?.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.expenseInstallmentFields?.classList.remove('hidden');
        } else {
          this.expenseInstallmentFields?.classList.add('hidden');
        }
      });

      // Metas / Budgeting Modal
      const openBudget = () => this.openBudgetModal();
      document.getElementById('openBudgetModalBtn')?.addEventListener('click', openBudget);
      document.getElementById('openBudgetHeaderBtn')?.addEventListener('click', openBudget);
      document.getElementById('mobileBudgetBtn')?.addEventListener('click', openBudget);

      // Planejamento de Compras Modal
      const openPlanning = () => this.openPlanningModal();
      document.getElementById('openPlanningHeaderBtn')?.addEventListener('click', openPlanning);
      document.getElementById('openPlanningModalBtn')?.addEventListener('click', openPlanning);

      // Alertas de Vencimento Modal
      const openAlerts = () => this.openAlertModal();
      this.openAlertModalBtn?.addEventListener('click', openAlerts);
      this.mobileAlertBtn?.addEventListener('click', openAlerts);
      this.openAlertBillsBtn?.addEventListener('click', openAlerts);
      this.openAlertsFromBannerBtn?.addEventListener('click', openAlerts);

      // 3. Modais - Fechamento
      document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-close-modal');
          const targetModal = document.getElementById(targetId);
          if (targetModal) this.closeModal(targetModal);
        });
      });

      document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
          const modal = e.target.closest('.fixed.inset-0');
          if (modal && modal.id !== 'confirmModal') this.closeModal(modal);
        });
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (ConfirmDialog.modal && !ConfirmDialog.modal.classList.contains('hidden')) {
            ConfirmDialog.close(false);
            return;
          }
          [this.incomeModal, this.billModal, this.expenseModal, this.budgetModal, this.alertModal, this.planningModal].forEach(m => {
            if (m && !m.classList.contains('hidden')) this.closeModal(m);
          });
        }
      });

      // 4. Submissão de Formulários
      this.incomeForm?.addEventListener('submit', (e) => this.handleIncomeSubmit(e));
      this.cancelIncomeEditBtn?.addEventListener('click', () => this.resetIncomeForm());
      this.replicateIncomesBtn?.addEventListener('click', () => this.replicateIncomesFromPreviousMonth());
      this.billForm?.addEventListener('submit', (e) => this.handleBillSubmit(e));
      this.expenseForm?.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
      this.budgetForm?.addEventListener('submit', (e) => this.handleBudgetSubmit(e));
      this.alertForm?.addEventListener('submit', (e) => this.handleAlertSubmit(e));
      this.planningForm?.addEventListener('submit', (e) => this.handlePlanningSubmit(e));
      this.cancelPlanningEditBtn?.addEventListener('click', () => {
        this.resetPlanningForm();
        this.updatePlanSimulationPreview();
      });

      // Controles dinâmicos do Simulador de Planejamento
      this.planModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setPlanMode(btn.getAttribute('data-plan-mode') || 'installment');
        });
      });

      [
        this.planTitleInput,
        this.planCategorySelect,
        this.planTargetAmountInput,
        this.planSavedAmountInput,
        this.planInstallmentsSelect,
        this.planPaymentMethodSelect,
        this.planMonthlyContributionInput
      ].forEach(el => {
        el?.addEventListener('input', () => this.updatePlanSimulationPreview());
        el?.addEventListener('change', () => this.updatePlanSimulationPreview());
      });

      this.planPresetMonthBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const months = parseInt(btn.getAttribute('data-plan-preset-months'), 10);
          this.applyPlanMonthsPreset(months);
        });
      });

      this.planUseFreeBalanceBtn?.addEventListener('click', () => this.applyFreeBalanceToPlan());

      // Controles dinâmicos de Alertas de Vencimento
      this.alertEnabledToggle?.addEventListener('change', () => this.updateAlertModalControlsState());
      this.alertDaysBeforeSelect?.addEventListener('change', () => this.updateAlertModalPreview());
      this.dismissAlertsBannerBtn?.addEventListener('click', () => this.dismissAlertsForToday());

      // 5. Filtros de Contas
      this.billFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.billFilter = btn.getAttribute('data-bill-filter') || 'all';
          this.billFilterBtns.forEach(b => {
            b.classList.remove('bg-slate-800', 'text-slate-300', 'text-white', 'shadow-sm');
            b.classList.add('text-slate-400');
          });
          btn.classList.add('bg-slate-800', 'text-slate-200', 'shadow-sm');
          btn.classList.remove('text-slate-400');
          this.renderBills();
        });
      });

      // 6. Recorrência de Contas
      const triggerReplication = () => this.replicateBillsFromPreviousMonth();
      this.confirmReplicateBillsBtn?.addEventListener('click', triggerReplication);
      this.replicateBillsHeaderBtn?.addEventListener('click', triggerReplication);

      // 7. Busca e Filtro de Gastos
      this.expenseSearchInput?.addEventListener('input', (e) => {
        this.expenseSearchQuery = e.target.value.toLowerCase().trim();
        this.renderExpenses();
      });

      this.expenseCategoryFilterSelect?.addEventListener('change', (e) => {
        this.expenseCategoryFilter = e.target.value;
        this.renderExpenses();
      });

      this.expenseMethodFilterSelect?.addEventListener('change', (e) => {
        this.expenseMethodFilter = e.target.value;
        this.renderExpenses();
      });

      // 8. Exportação CSV e Backups
      this.exportCsvBtn?.addEventListener('click', () => this.exportMonthlyCSV());
      this.exportDataBtn?.addEventListener('click', () => this.exportData());
      this.importDataBtn?.addEventListener('click', () => this.importFileInput?.click());
      this.importFileInput?.addEventListener('change', (e) => this.importData(e));
    },

    openModal(modal) {
      if (!modal) return;
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    },

    closeModal(modal) {
      if (!modal) return;
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    },

    changePeriod(delta) {
      this.state.currentPeriod = Utils.shiftPeriod(this.state.currentPeriod, delta);
      Storage.save(this.state);
      this.render();
      Toast.show(`Visualizando ${Utils.formatPeriod(this.state.currentPeriod)}`, 'info', 2000);
    },

    // ========================================================================
    // RECORRÊNCIA AUTOMÁTICA DE CONTAS
    // ========================================================================
    checkPreviousMonthBills() {
      const currentPeriod = this.state.currentPeriod;
      const currentBills = this.state.bills.filter(b => b.dueDate.startsWith(currentPeriod));

      const prevPeriod = Utils.shiftPeriod(currentPeriod, -1);
      const prevBills = this.state.bills.filter(b => b.dueDate.startsWith(prevPeriod));

      // Se o mês atual não tem contas e o mês anterior tem contas cadastradas
      if (currentBills.length === 0 && prevBills.length > 0) {
        if (this.recurrentBillsBanner) {
          const prevMonthName = Utils.formatPeriod(prevPeriod);
          this.recurrentBillsBannerText.textContent = `Você tem ${prevBills.length} contas em ${prevMonthName}. Deseja copiá-las com status pendente?`;
          this.recurrentBillsBanner.classList.remove('hidden');
        }
        if (this.replicateBillsHeaderBtn) {
          this.replicateBillsHeaderBtn.classList.remove('hidden');
          this.replicateBillsHeaderBtn.classList.add('inline-flex');
        }
      } else {
        if (this.recurrentBillsBanner) {
          this.recurrentBillsBanner.classList.add('hidden');
        }
        if (this.replicateBillsHeaderBtn) {
          // Exibe botão no cabeçalho se houver contas no mês anterior
          if (prevBills.length > 0) {
            this.replicateBillsHeaderBtn.classList.remove('hidden');
            this.replicateBillsHeaderBtn.classList.add('inline-flex');
          } else {
            this.replicateBillsHeaderBtn.classList.add('hidden');
            this.replicateBillsHeaderBtn.classList.remove('inline-flex');
          }
        }
      }
    },

    async replicateBillsFromPreviousMonth() {
      const currentPeriod = this.state.currentPeriod;
      const prevPeriod = Utils.shiftPeriod(currentPeriod, -1);
      const prevBills = this.state.bills.filter(b => b.dueDate.startsWith(prevPeriod));

      if (prevBills.length === 0) {
        Toast.show('Nenhuma conta encontrada no mês anterior.', 'warning');
        return;
      }

      const confirmed = await ConfirmDialog.open({
        title: 'Replicar Contas Fixas',
        message: `Deseja copiar ${prevBills.length} contas de ${Utils.formatPeriod(prevPeriod)} para ${Utils.formatPeriod(currentPeriod)}? Elas serão criadas como Pendentes.`
      });

      if (!confirmed) return;

      const newBills = prevBills.map(bill => {
        // Mantém o dia original de vencimento ajustando para o novo período
        const dayPart = bill.dueDate.split('-')[2] || '10';
        return {
          id: Utils.generateUUID(),
          title: bill.title,
          amount: bill.amount,
          dueDate: `${currentPeriod}-${dayPart}`,
          category: bill.category,
          paid: false,
          createdAt: new Date().toISOString()
        };
      });

      this.state.bills.push(...newBills);
      Storage.save(this.state);
      this.render();
      Toast.show(`${newBills.length} contas replicadas com sucesso para este mês!`, 'success');
    },

    // ========================================================================
    // EDIÇÃO IN-PLACE (CONTAS E GASTOS)
    // ========================================================================
    openEditBillModal(billId) {
      const bill = this.state.bills.find(b => b.id === billId);
      if (!bill) return;

      this.billEditId.value = bill.id;
      this.billModalTitle.textContent = 'Editar Conta Fixa';
      this.billSubmitBtn.textContent = 'Salvar Alterações';

      this.billTitleInput.value = bill.title;
      this.billAmountInput.value = Utils.formatNumberToInput(bill.amount);
      this.billDueDateInput.value = bill.dueDate;
      this.billCategorySelect.value = bill.category || 'Moradia';

      const statusRadio = this.billForm.querySelector(`input[name="billStatus"][value="${bill.paid ? 'paid' : 'pending'}"]`);
      if (statusRadio) statusRadio.checked = true;

      this.openModal(this.billModal);
      this.billTitleInput.focus();
    },

    openEditExpenseModal(expenseId) {
      const expense = this.state.expenses.find(e => e.id === expenseId);
      if (!expense) return;

      this.expenseEditId.value = expense.id;
      this.expenseModalTitle.textContent = 'Editar Lançamento';
      this.expenseSubmitBtn.textContent = 'Salvar Alterações';

      this.expenseDescriptionInput.value = expense.description;
      this.expenseAmountInput.value = Utils.formatNumberToInput(expense.amount);
      this.expenseDateInput.value = expense.date;
      this.expenseCategorySelect.value = expense.category || 'Alimentação';
      this.expenseMethodSelect.value = expense.method || 'Pix';

      if (this.expenseInstallmentContainer) {
        this.expenseInstallmentContainer.classList.add('hidden');
      }

      this.openModal(this.expenseModal);
      this.expenseDescriptionInput.focus();
    },

    // ========================================================================
    // GERENCIAMENTO DE MÚLTIPLAS FONTES DE RENDA
    // ========================================================================
    getPeriodIncomes(period = this.state.currentPeriod) {
      const entries = Array.isArray(this.state.incomeEntries) ? this.state.incomeEntries : [];
      return entries
        .filter(entry => Utils.getIncomePeriod(entry) === period)
        .slice()
        .sort((a, b) => {
          if (a.date && b.date) return a.date.localeCompare(b.date);
          if (a.date) return -1;
          if (b.date) return 1;
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        });
    },

    getCurrentIncome(period = this.state.currentPeriod) {
      return this.getPeriodIncomes(period).reduce((sum, entry) => sum + (entry.amount || 0), 0);
    },

    openIncomeModal() {
      this.resetIncomeForm();
      this.renderIncomeModal();
      this.openModal(this.incomeModal);
      this.incomeTitleInput?.focus();
    },

    resetIncomeForm() {
      this.incomeForm?.reset();
      if (this.incomeEditId) this.incomeEditId.value = '';
      if (this.incomeTypeSelect) this.incomeTypeSelect.value = 'Salário';
      if (this.incomeInput) this.incomeInput.value = '0,00';
      if (this.incomeDateInput) this.incomeDateInput.value = '';
      if (this.incomeFormTitle) this.incomeFormTitle.textContent = 'Adicionar Fonte de Renda';
      if (this.cancelIncomeEditBtn) this.cancelIncomeEditBtn.classList.add('hidden');
      if (this.incomeSubmitBtn) {
        this.incomeSubmitBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span>Adicionar Renda</span>';
      }
    },

    openEditIncomeModal(incomeId) {
      const entry = (this.state.incomeEntries || []).find(item => item.id === incomeId);
      if (!entry) return;

      if (this.incomeEditId) this.incomeEditId.value = entry.id;
      if (this.incomeTitleInput) this.incomeTitleInput.value = entry.title;
      if (this.incomeTypeSelect) this.incomeTypeSelect.value = INCOME_TYPE_META[entry.type] ? entry.type : 'Outros';
      if (this.incomeInput) this.incomeInput.value = Utils.formatNumberToInput(entry.amount);
      if (this.incomeDateInput) this.incomeDateInput.value = entry.date || '';

      if (this.incomeFormTitle) this.incomeFormTitle.textContent = 'Editar Fonte de Renda';
      if (this.cancelIncomeEditBtn) this.cancelIncomeEditBtn.classList.remove('hidden');
      if (this.incomeSubmitBtn) {
        this.incomeSubmitBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Salvar Alterações</span>';
      }

      if (this.incomeModalBody) this.incomeModalBody.scrollTop = 0;
      this.incomeTitleInput?.focus();
    },

    renderIncomeModal() {
      const period = this.state.currentPeriod;
      const periodIncomes = this.getPeriodIncomes(period);
      const total = periodIncomes.reduce((sum, item) => sum + (item.amount || 0), 0);

      const prevPeriod = Utils.shiftPeriod(period, -1);
      const prevIncomes = this.getPeriodIncomes(prevPeriod);

      if (this.incomeModalSubtitle) {
        this.incomeModalSubtitle.textContent = `Mês de referência: ${Utils.formatPeriod(period)}`;
      }
      if (this.incomeModalTotal) {
        this.incomeModalTotal.textContent = Utils.formatCurrency(total);
      }
      if (this.incomeModalCountBadge) {
        const count = periodIncomes.length;
        this.incomeModalCountBadge.textContent = `${count} ${count === 1 ? 'renda' : 'rendas'}`;
      }

      if (this.replicateIncomesBtn) {
        if (prevIncomes.length > 0) {
          this.replicateIncomesBtn.classList.remove('hidden');
          this.replicateIncomesBtn.classList.add('inline-flex');
        } else {
          this.replicateIncomesBtn.classList.add('hidden');
          this.replicateIncomesBtn.classList.remove('inline-flex');
        }
      }

      if (!this.incomesListContainer) return;

      if (periodIncomes.length === 0) {
        this.incomesListContainer.innerHTML = `
          <div class="p-5 rounded-xl bg-slate-900/50 border border-dashed border-slate-700 text-center space-y-2">
            <div class="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
              <i class="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <p class="text-xs font-semibold text-slate-300">Nenhuma renda cadastrada em ${Utils.formatPeriod(period)}</p>
            <p class="text-[11px] text-slate-400">Adicione suas fontes de renda acima${prevIncomes.length > 0 ? ' ou copie do mês anterior.' : '.'}</p>
          </div>
        `;
        return;
      }

      let html = '';
      periodIncomes.forEach(entry => {
        const meta = INCOME_TYPE_META[entry.type] || INCOME_TYPE_META['Outros'];
        const dateText = entry.date ? `Recebida em ${Utils.formatDate(entry.date)}` : 'Vinculada ao mês';

        html += `
          <div class="flex items-center justify-between gap-3 p-3 bg-slate-900/70 hover:bg-slate-900 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-smooth">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style="background-color: ${meta.color}20; color: ${meta.color};">
                <i class="fa-solid ${meta.icon}"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-xs sm:text-sm font-semibold text-slate-100 truncate">${Utils.escapeHTML(entry.title)}</p>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">${Utils.escapeHTML(entry.type)}</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <i class="fa-regular fa-calendar text-[10px]"></i>
                  <span>${dateText}</span>
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs sm:text-sm font-bold text-emerald-400 whitespace-nowrap">
                ${Utils.formatCurrency(entry.amount)}
              </span>
              <div class="flex items-center gap-0.5">
                <button type="button" data-edit-income-id="${entry.id}" class="action-icon-btn text-slate-400 hover:text-indigo-400 hover:bg-slate-800" title="Editar renda">
                  <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button type="button" data-delete-income-id="${entry.id}" class="action-icon-btn text-slate-500 hover:text-rose-400 hover:bg-slate-800" title="Excluir renda">
                  <i class="fa-regular fa-trash-can text-sm"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      });

      this.incomesListContainer.innerHTML = html;

      this.incomesListContainer.querySelectorAll('[data-edit-income-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-edit-income-id');
          this.openEditIncomeModal(id);
        });
      });

      this.incomesListContainer.querySelectorAll('[data-delete-income-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-delete-income-id');
          this.deleteIncome(id);
        });
      });
    },

    handleIncomeSubmit(e) {
      e.preventDefault();
      const editId = this.incomeEditId?.value || '';
      const title = this.incomeTitleInput?.value.trim() || '';
      const rawType = this.incomeTypeSelect?.value || 'Outros';
      const type = INCOME_TYPE_META[rawType] ? rawType : 'Outros';
      const amount = Utils.parseCurrency(this.incomeInput?.value);
      const rawDate = this.incomeDateInput?.value.trim() || '';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

      if (!title) {
        Toast.show('Informe a descrição da fonte de renda.', 'warning');
        return;
      }
      if (amount <= 0) {
        Toast.show('O valor da renda deve ser maior que zero.', 'warning');
        return;
      }

      if (!Array.isArray(this.state.incomeEntries)) {
        this.state.incomeEntries = [];
      }

      let targetPeriod = this.state.currentPeriod;

      if (editId) {
        const idx = this.state.incomeEntries.findIndex(item => item.id === editId);
        if (idx !== -1) {
          const existing = this.state.incomeEntries[idx];
          targetPeriod = date ? date.slice(0, 7) : (existing.period || this.state.currentPeriod);
          this.state.incomeEntries[idx] = {
            ...existing,
            title,
            type,
            amount,
            date,
            period: targetPeriod,
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        targetPeriod = date ? date.slice(0, 7) : this.state.currentPeriod;
        this.state.incomeEntries.push({
          id: Utils.generateUUID(),
          title,
          type,
          amount,
          date,
          period: targetPeriod,
          createdAt: new Date().toISOString()
        });
      }

      Storage.save(this.state);
      this.resetIncomeForm();
      this.render();
      this.renderIncomeModal();

      if (targetPeriod !== this.state.currentPeriod) {
        Toast.show(`Renda "${title}" salva em ${Utils.formatPeriod(targetPeriod)}!`, 'success');
      } else {
        Toast.show(`Renda "${title}" ${editId ? 'atualizada' : 'adicionada'} com sucesso!`, 'success');
      }
    },

    async deleteIncome(incomeId) {
      const entry = (this.state.incomeEntries || []).find(item => item.id === incomeId);
      if (!entry) return;

      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Fonte de Renda',
        message: `Deseja remover "${entry.title}" (${Utils.formatCurrency(entry.amount)})?`
      });

      if (!confirmed) return;

      this.state.incomeEntries = this.state.incomeEntries.filter(item => item.id !== incomeId);
      if (this.incomeEditId && this.incomeEditId.value === incomeId) {
        this.resetIncomeForm();
      }

      Storage.save(this.state);
      this.render();
      this.renderIncomeModal();
      Toast.show(`Renda "${entry.title}" excluída.`, 'info');
    },

    async replicateIncomesFromPreviousMonth() {
      const currentPeriod = this.state.currentPeriod;
      const prevPeriod = Utils.shiftPeriod(currentPeriod, -1);
      const prevIncomes = this.getPeriodIncomes(prevPeriod);

      if (prevIncomes.length === 0) {
        Toast.show('Nenhuma renda encontrada no mês anterior.', 'warning');
        return;
      }

      const confirmed = await ConfirmDialog.open({
        title: 'Copiar Rendas do Mês Anterior',
        message: `Deseja copiar ${prevIncomes.length} fonte(s) de renda de ${Utils.formatPeriod(prevPeriod)} para ${Utils.formatPeriod(currentPeriod)}?`
      });

      if (!confirmed) return;

      const copied = prevIncomes.map(entry => ({
        id: Utils.generateUUID(),
        title: entry.title,
        type: entry.type,
        amount: entry.amount,
        date: entry.date ? Utils.shiftDateToPeriod(entry.date, currentPeriod) : null,
        period: currentPeriod,
        createdAt: new Date().toISOString()
      }));

      if (!Array.isArray(this.state.incomeEntries)) {
        this.state.incomeEntries = [];
      }
      this.state.incomeEntries.push(...copied);

      Storage.save(this.state);
      this.render();
      this.renderIncomeModal();
      Toast.show(`${copied.length} fonte(s) de renda copiada(s) para este mês!`, 'success');
    },

    handleBillSubmit(e) {
      e.preventDefault();
      const editId = this.billEditId.value;
      const title = this.billTitleInput.value.trim();
      const amount = Utils.parseCurrency(this.billAmountInput.value);
      const dueDate = this.billDueDateInput.value;
      const category = this.billCategorySelect.value;
      const isPaid = this.billForm.querySelector('input[name="billStatus"]:checked')?.value === 'paid';

      if (!title) {
        Toast.show('Informe a descrição da conta.', 'warning');
        return;
      }
      if (amount <= 0) {
        Toast.show('O valor da conta deve ser maior que zero.', 'warning');
        return;
      }
      if (!dueDate) {
        Toast.show('Selecione uma data de vencimento válida.', 'warning');
        return;
      }

      if (editId) {
        // Modo Edição
        const billIndex = this.state.bills.findIndex(b => b.id === editId);
        if (billIndex !== -1) {
          this.state.bills[billIndex] = {
            ...this.state.bills[billIndex],
            title,
            amount,
            dueDate,
            category,
            paid: isPaid,
            updatedAt: new Date().toISOString()
          };
          Toast.show(`Conta "${title}" atualizada com sucesso!`, 'success');
        }
      } else {
        // Modo Criação
        const newBill = {
          id: Utils.generateUUID(),
          title,
          amount,
          dueDate,
          category,
          paid: isPaid,
          createdAt: new Date().toISOString()
        };
        this.state.bills.push(newBill);
        Toast.show(`Conta "${title}" cadastrada com sucesso!`, 'success');
      }

      Storage.save(this.state);
      this.closeModal(this.billModal);
      this.render();
    },

    buildInstallmentExpenses({ description, amount, amountType = 'total', count, startDateISO, category, method }) {
      const safeCount = Math.max(1, parseInt(count, 10) || 1);
      const baseAmount = Math.round((Number(amount) || 0) * 100) / 100;

      let amountPerInstallment = baseAmount;
      let diff = 0;

      if (amountType === 'total') {
        amountPerInstallment = Math.floor((baseAmount / safeCount) * 100) / 100;
        diff = Math.round((baseAmount - (amountPerInstallment * safeCount)) * 100) / 100;
      }

      const groupId = Utils.generateUUID();
      const [startYear, startMonth, startDay] = startDateISO.split('-').map(Number);
      const installments = [];

      for (let i = 0; i < safeCount; i++) {
        const monthIndex = startMonth - 1 + i;
        const targetYear = startYear + Math.floor(monthIndex / 12);
        const targetMonth = (monthIndex % 12) + 1;
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const targetDay = Math.min(startDay, daysInMonth);
        const targetDateISO = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

        const instAmount = (i === 0 && amountType === 'total')
          ? Math.round((amountPerInstallment + diff) * 100) / 100
          : amountPerInstallment;

        installments.push({
          id: Utils.generateUUID(),
          description: safeCount > 1 ? `${description} (${i + 1}/${safeCount})` : description,
          amount: instAmount,
          date: targetDateISO,
          category,
          method,
          ...(safeCount > 1 ? {
            installmentGroupId: groupId,
            installmentNumber: i + 1,
            totalInstallments: safeCount
          } : {}),
          createdAt: new Date().toISOString()
        });
      }

      return { installments, amountPerInstallment };
    },

    handleExpenseSubmit(e) {
      e.preventDefault();
      const editId = this.expenseEditId.value;
      const description = this.expenseDescriptionInput.value.trim();
      const amount = Utils.parseCurrency(this.expenseAmountInput.value);
      const date = this.expenseDateInput.value;
      const category = this.expenseCategorySelect.value;
      const method = this.expenseMethodSelect.value;

      if (!description) {
        Toast.show('Informe a descrição do gasto.', 'warning');
        return;
      }
      if (amount <= 0) {
        Toast.show('O valor do lançamento deve ser maior que zero.', 'warning');
        return;
      }
      if (!date) {
        Toast.show('Selecione a data do gasto.', 'warning');
        return;
      }

      if (editId) {
        // Modo Edição
        const expenseIndex = this.state.expenses.findIndex(e => e.id === editId);
        if (expenseIndex !== -1) {
          this.state.expenses[expenseIndex] = {
            ...this.state.expenses[expenseIndex],
            description,
            amount,
            date,
            category,
            method,
            updatedAt: new Date().toISOString()
          };
          Toast.show(`Lançamento "${description}" atualizado!`, 'success');
        }
      } else if (this.expenseIsInstallmentCheckbox?.checked) {
        // Modo Criação Parcelada
        const count = parseInt(this.expenseInstallmentCount?.value || '2', 10);
        const installmentType = this.expenseForm.querySelector('input[name="installmentAmountType"]:checked')?.value || 'per_installment';

        const { installments: newInstallments, amountPerInstallment } = this.buildInstallmentExpenses({
          description,
          amount,
          amountType: installmentType,
          count,
          startDateISO: date,
          category,
          method
        });

        this.state.expenses.unshift(...newInstallments);
        Toast.show(`Compra parcelada em ${count}x de ${Utils.formatCurrency(amountPerInstallment)} cadastrada!`, 'success');
      } else {
        // Modo Criação Simples
        const newExpense = {
          id: Utils.generateUUID(),
          description,
          amount,
          date,
          category,
          method,
          createdAt: new Date().toISOString()
        };
        this.state.expenses.unshift(newExpense);
        Toast.show(`Gasto de ${Utils.formatCurrency(amount)} adicionado!`, 'success');
      }

      Storage.save(this.state);
      this.closeModal(this.expenseModal);
      this.render();
    },

    // ========================================================================
    // ALTERNÂNCIA DE STATUS & EXCLUSÕES
    // ========================================================================
    toggleBillStatus(billId) {
      const bill = this.state.bills.find(b => b.id === billId);
      if (!bill) return;

      bill.paid = !bill.paid;
      Storage.save(this.state);
      this.render();

      const statusMsg = bill.paid ? 'marcada como PAGA' : 'marcada como PENDENTE';
      Toast.show(`Conta "${bill.title}" ${statusMsg}.`, 'info', 2200);
    },

    async deleteBill(billId) {
      const bill = this.state.bills.find(b => b.id === billId);
      if (!bill) return;

      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Conta',
        message: `Deseja realmente remover a conta "${bill.title}" no valor de ${Utils.formatCurrency(bill.amount)}?`
      });

      if (!confirmed) return;

      this.state.bills = this.state.bills.filter(b => b.id !== billId);
      Storage.save(this.state);
      this.render();
      Toast.show(`Conta "${bill.title}" excluída.`, 'info');
    },

    async deleteExpense(expenseId) {
      const expense = this.state.expenses.find(e => e.id === expenseId);
      if (!expense) return;

      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Lançamento',
        message: `Deseja remover "${expense.description}" (${Utils.formatCurrency(expense.amount)})?`
      });

      if (!confirmed) return;

      this.state.expenses = this.state.expenses.filter(e => e.id !== expenseId);
      Storage.save(this.state);
      this.render();
      Toast.show('Lançamento excluído com sucesso.', 'info');
    },

    // ========================================================================
    // EXPORTAÇÃO CSV DE FECHAMENTO MENSAL (\uFEFF UTF-8)
    // ========================================================================
    exportMonthlyCSV() {
      try {
        const period = this.state.currentPeriod;
        const periodIncomes = this.getPeriodIncomes(period);
        const periodBills = this.state.bills.filter(b => b.dueDate.startsWith(period));
        const periodExpenses = this.state.expenses.filter(e => e.date.startsWith(period));

        const income = this.getCurrentIncome();
        const billsTotal = periodBills.reduce((acc, b) => acc + (b.amount || 0), 0);
        const expensesTotal = periodExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
        const balance = income - billsTotal - expensesTotal;

        // Inicia com BOM UTF-8 para garantir abertura perfeita no Microsoft Excel
        let csv = '\uFEFF';

        // Cabeçalho e Metadados
        csv += 'RELATÓRIO DE FECHAMENTO MENSAL - FINFLOW\r\n';
        csv += `Mês de Referência;${Utils.formatPeriod(period)}\r\n`;
        csv += `Data de Emissão;${new Date().toLocaleString('pt-BR')}\r\n\r\n`;

        // Resumo Executivo
        csv += 'RESUMO FINANCEIRO\r\n';
        csv += `Renda Líquida Mensal;${Utils.formatCurrency(income)}\r\n`;
        csv += `Total Contas Fixas;${Utils.formatCurrency(billsTotal)}\r\n`;
        csv += `Total Gastos Diários;${Utils.formatCurrency(expensesTotal)}\r\n`;
        csv += `Saldo Líquido Restante;${Utils.formatCurrency(balance)}\r\n\r\n`;

        // Tabela de Fontes de Renda
        csv += 'FONTES DE RENDA DO MÊS\r\n';
        csv += 'Descrição;Tipo;Data;Valor (R$)\r\n';
        if (periodIncomes.length === 0) {
          csv += 'Nenhuma renda registrada neste mês;;;\r\n';
        } else {
          periodIncomes.forEach(inc => {
            const valor = (inc.amount || 0).toFixed(2).replace('.', ',');
            const dateLabel = inc.date ? Utils.formatDate(inc.date) : 'Mês de referência';
            csv += `"${inc.title.replace(/"/g, '""')}";"${inc.type}";"${dateLabel}";${valor}\r\n`;
          });
        }
        csv += '\r\n';

        // Tabela de Contas Fixas
        csv += 'CONTAS DO MÊS (DESPESAS FIXAS)\r\n';
        csv += 'Título;Categoria;Vencimento;Valor (R$);Status\r\n';
        if (periodBills.length === 0) {
          csv += 'Nenhuma conta registrada neste mês;;;;\r\n';
        } else {
          periodBills.forEach(b => {
            const statusLabel = b.paid ? 'Pago' : 'Pendente';
            const valor = (b.amount || 0).toFixed(2).replace('.', ',');
            csv += `"${b.title.replace(/"/g, '""')}";"${b.category}";"${Utils.formatDate(b.dueDate)}";${valor};"${statusLabel}"\r\n`;
          });
        }
        csv += '\r\n';

        // Tabela de Gastos Diários
        csv += 'GASTOS DIÁRIOS (DESPESAS VARIÁVEIS)\r\n';
        csv += 'Descrição;Categoria;Método de Pagamento;Data;Valor (R$)\r\n';
        if (periodExpenses.length === 0) {
          csv += 'Nenhum gasto diário registrado neste mês;;;;\r\n';
        } else {
          periodExpenses.forEach(e => {
            const valor = (e.amount || 0).toFixed(2).replace('.', ',');
            csv += `"${e.description.replace(/"/g, '""')}";"${e.category}";"${e.method}";"${Utils.formatDate(e.date)}";${valor}\r\n`;
          });
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finflow-fechamento-${period}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Toast.show(`Fechamento CSV de ${Utils.formatPeriod(period)} exportado!`, 'success');
      } catch (err) {
        console.error('Falha ao exportar CSV:', err);
        Toast.show('Erro ao exportar fechamento em CSV.', 'error');
      }
    },

    // ========================================================================
    // EXPORTAÇÃO E IMPORTAÇÃO DE BACKUP JSON
    // ========================================================================
    exportData() {
      try {
        const payload = JSON.stringify(this.state, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `finflow-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Toast.show('Backup JSON exportado com sucesso!', 'success');
      } catch (err) {
        console.error('Falha ao exportar:', err);
        Toast.show('Erro ao exportar backup.', 'error');
      }
    },

    importData(e) {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result);
          if (!parsed || typeof parsed !== 'object') {
            throw new Error('Formato de arquivo inválido.');
          }

          const confirmed = await ConfirmDialog.open({
            title: 'Substituir Dados Atuais?',
            message: 'A importação deste arquivo substituirá todos os lançamentos e configurações atuais. Deseja prosseguir?'
          });

          if (!confirmed) {
            this.importFileInput.value = '';
            return;
          }

          const importedPeriod = (typeof parsed.currentPeriod === 'string' && /^\d{4}-\d{2}$/.test(parsed.currentPeriod))
            ? parsed.currentPeriod
            : Utils.getCurrentPeriodISO();

          this.state = {
            version: 2,
            currentPeriod: importedPeriod,
            incomeEntries: Storage.normalizeIncomeEntries({ ...parsed, currentPeriod: importedPeriod }),
            budgets: (parsed.budgets && typeof parsed.budgets === 'object') ? parsed.budgets : {},
            alertSettings: Utils.normalizeAlertSettings(parsed.alertSettings),
            bills: Array.isArray(parsed.bills) ? parsed.bills : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
            plans: Storage.normalizePlans(parsed.plans)
          };

          Storage.save(this.state);
          this.render();
          Toast.show('Dados importados com sucesso!', 'success');
        } catch (err) {
          console.error('Falha na importação:', err);
          Toast.show('Arquivo inválido ou corrompido. Importação cancelada.', 'error');
        } finally {
          this.importFileInput.value = '';
        }
      };

      reader.readAsText(file);
    },

    // ========================================================================
    // RENDERIZAÇÃO GERAL
    // ========================================================================
    render() {
      this.renderPeriod();
      this.renderDueAlerts();
      this.renderKPIs();
      this.renderBurnRate();
      this.checkPreviousMonthBills();
      this.renderBills();
      this.renderExpenses();
      this.renderChartsAndInsights();
      this.renderBudgets();
      this.renderPlanning();
    },

    renderPeriod() {
      if (this.currentPeriodDisplay) {
        this.currentPeriodDisplay.textContent = Utils.formatPeriod(this.state.currentPeriod);
      }
    },

    // ========================================================================
    // RENDERIZAÇÃO DOS CARDS DE KPI
    // ========================================================================
    renderKPIs() {
      const period = this.state.currentPeriod;

      const periodIncomes = this.getPeriodIncomes(period);
      const periodBills = this.state.bills.filter(b => b.dueDate.startsWith(period));
      const periodExpenses = this.state.expenses.filter(e => e.date.startsWith(period));

      const income = this.getCurrentIncome();
      const billsTotal = periodBills.reduce((acc, b) => acc + (b.amount || 0), 0);
      const billsPaid = periodBills.filter(b => b.paid).length;
      const billsPending = periodBills.length - billsPaid;
      const expensesTotal = periodExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

      const balance = income - billsTotal - expensesTotal;

      // 1. Renda
      if (this.kpiIncome) {
        this.kpiIncome.textContent = Utils.formatCurrency(income);
      }
      if (this.kpiIncomeSubtitle) {
        if (periodIncomes.length === 0) {
          this.kpiIncomeSubtitle.textContent = 'Nenhuma renda cadastrada no mês';
        } else if (periodIncomes.length === 1) {
          this.kpiIncomeSubtitle.textContent = `1 fonte (${periodIncomes[0].type})`;
        } else {
          this.kpiIncomeSubtitle.textContent = `${periodIncomes.length} fontes de renda no mês`;
        }
      }

      // 2. Contas Fixas
      if (this.kpiBillsTotal) {
        this.kpiBillsTotal.textContent = Utils.formatCurrency(billsTotal);
      }
      if (this.kpiBillsStatusSubtitle) {
        this.kpiBillsStatusSubtitle.textContent = `${billsPaid} pagas / ${billsPending} pendentes`;
      }
      const progressPercent = periodBills.length > 0 ? Math.round((billsPaid / periodBills.length) * 100) : 0;
      if (this.kpiBillsProgressPercent) {
        this.kpiBillsProgressPercent.textContent = `${progressPercent}%`;
      }
      if (this.kpiBillsProgressBar) {
        this.kpiBillsProgressBar.style.width = `${progressPercent}%`;
      }

      // 3. Gastos Diários
      if (this.kpiExpensesTotal) {
        this.kpiExpensesTotal.textContent = Utils.formatCurrency(expensesTotal);
      }
      if (this.kpiExpensesSubtitle) {
        const count = periodExpenses.length;
        this.kpiExpensesSubtitle.textContent = `${count} ${count === 1 ? 'lançamento' : 'lançamentos'} no mês`;
      }

      // 4. Saldo Disponível
      if (this.kpiBalance) {
        this.kpiBalance.textContent = Utils.formatCurrency(balance);
        if (balance >= 0) {
          this.kpiBalance.className = 'text-2xl font-bold text-emerald-400 tracking-tight';
          if (this.kpiBalanceIcon) {
            this.kpiBalanceIcon.className = 'w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs';
          }
          if (this.kpiBalanceSubtitle) {
            this.kpiBalanceSubtitle.textContent = 'Orçamento sob controle';
          }
        } else {
          this.kpiBalance.className = 'text-2xl font-bold text-rose-400 tracking-tight';
          if (this.kpiBalanceIcon) {
            this.kpiBalanceIcon.className = 'w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs';
          }
          if (this.kpiBalanceSubtitle) {
            this.kpiBalanceSubtitle.textContent = 'Atenção: Despesas superam a renda';
          }
        }
      }
    },

    // ========================================================================
    // RENDERIZAÇÃO DO RITMO DE QUEIMA ORÇAMENTÁRIA (BURN-RATE)
    // ========================================================================
    renderBurnRate() {
      if (!this.burnRateWidget) return;

      const period = this.state.currentPeriod;
      const currentRealPeriod = Utils.getCurrentPeriodISO();

      const periodBills = this.state.bills.filter(b => b.dueDate.startsWith(period));
      const periodExpenses = this.state.expenses.filter(e => e.date.startsWith(period));

      const income = this.getCurrentIncome();
      const billsTotal = periodBills.reduce((acc, b) => acc + (b.amount || 0), 0);
      const expensesTotal = periodExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      const balance = income - billsTotal - expensesTotal;

      const [year, month] = period.split('-').map(Number);
      const totalDaysInMonth = new Date(year, month, 0).getDate();

      let daysRemaining = 0;
      let daysElapsed = totalDaysInMonth;
      const isCurrentMonth = (period === currentRealPeriod);
      const isFutureMonth = (period > currentRealPeriod);
      const isPastMonth = (period < currentRealPeriod);

      if (isCurrentMonth) {
        const currentDay = new Date().getDate();
        daysElapsed = Math.max(1, currentDay);
        daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);
      } else if (isFutureMonth) {
        daysElapsed = 1;
        daysRemaining = totalDaysInMonth;
      } else {
        daysElapsed = totalDaysInMonth;
        daysRemaining = 0;
      }

      // 1. Teto diário seguro
      const dailyAllowance = daysRemaining > 0 && balance > 0 ? (balance / daysRemaining) : 0;

      // 2. Ritmo real diário médio atual
      const actualDailyPace = daysElapsed > 0 ? (expensesTotal / daysElapsed) : 0;

      // 3. Projeção de saldo ao final do mês
      const projectedTotalExpenses = isCurrentMonth ? (actualDailyPace * totalDaysInMonth) : expensesTotal;
      const projectedBalance = income - billsTotal - projectedTotalExpenses;

      // Atualiza DOM
      if (this.burnRateDailyAllowance) {
        this.burnRateDailyAllowance.textContent = `${Utils.formatCurrency(dailyAllowance)} / dia`;
      }
      if (this.burnRateDaysLeft) {
        this.burnRateDaysLeft.textContent = isPastMonth ? 'Mês encerrado' : `${daysRemaining} dias restantes`;
      }
      if (this.burnRateActualPace) {
        this.burnRateActualPace.textContent = `${Utils.formatCurrency(actualDailyPace)} / dia`;
      }
      if (this.burnRateProjectedEnd) {
        const sign = projectedBalance >= 0 ? '+' : '';
        this.burnRateProjectedEnd.textContent = `Projeção: ${sign}${Utils.formatCurrency(projectedBalance)}`;
        this.burnRateProjectedEnd.className = `text-[11px] block ${projectedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400 font-semibold'}`;
      }

      // Estados e Badges
      if (this.burnRateStatusBadge && this.burnRateStatusIcon && this.burnRateMessage) {
        if (balance < 0) {
          this.burnRateStatusBadge.className = 'status-pill status-pill-overdue text-[10px]';
          this.burnRateStatusBadge.textContent = 'Orçamento Esgotado';
          this.burnRateStatusIcon.className = 'w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center text-base flex-shrink-0';
          this.burnRateMessage.textContent = 'Atenção: seus gastos e contas já ultrapassaram a renda do mês.';
        } else if (isCurrentMonth && projectedBalance < 0) {
          this.burnRateStatusBadge.className = 'status-pill status-pill-soon text-[10px]';
          this.burnRateStatusBadge.textContent = 'Ritmo Acelerado';
          this.burnRateStatusIcon.className = 'w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-base flex-shrink-0';
          this.burnRateMessage.textContent = `No ritmo atual (${Utils.formatCurrency(actualDailyPace)}/dia), você terminará o mês com déficit estimado de ${Utils.formatCurrency(Math.abs(projectedBalance))}.`;
        } else if (isPastMonth) {
          const wasPositive = balance >= 0;
          this.burnRateStatusBadge.className = `status-pill ${wasPositive ? 'status-pill-paid' : 'status-pill-overdue'} text-[10px]`;
          this.burnRateStatusBadge.textContent = wasPositive ? 'Mês Fechado Positivo' : 'Mês Fechado no Vermelho';
          this.burnRateStatusIcon.className = `w-10 h-10 rounded-xl ${wasPositive ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'} flex items-center justify-center text-base flex-shrink-0`;
          this.burnRateMessage.textContent = `Média de despesas diárias realizada neste mês: ${Utils.formatCurrency(actualDailyPace)}/dia.`;
        } else {
          this.burnRateStatusBadge.className = 'status-pill status-pill-paid text-[10px]';
          this.burnRateStatusBadge.textContent = 'Ritmo Saudável';
          this.burnRateStatusIcon.className = 'w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-base flex-shrink-0';
          this.burnRateMessage.textContent = `Você pode gastar até ${Utils.formatCurrency(dailyAllowance)}/dia para manter as finanças sob controle até o fim do mês.`;
        }
      }
    },

    // ========================================================================
    // RENDERIZAÇÃO DOS TETOS DE GASTOS (BUDGETING)
    // ========================================================================
    renderBudgets() {
      if (!this.budgetBreakdownList) return;

      const period = this.state.currentPeriod;
      const periodExpenses = this.state.expenses.filter(e => e.date.startsWith(period));
      const budgets = this.state.budgets || {};

      const categoriesWithBudget = Object.keys(budgets).filter(cat => budgets[cat] > 0);

      if (categoriesWithBudget.length === 0) {
        this.budgetBreakdownList.innerHTML = `
          <div class="text-center py-4 text-slate-500 text-xs">
            <i class="fa-solid fa-bullseye text-2xl mb-1.5 opacity-40"></i>
            <p>Nenhum teto configurado.</p>
            <button id="quickOpenBudgetBtn" class="mt-2.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 rounded-lg text-xs font-semibold transition-colors">
              Definir Tetos por Categoria
            </button>
          </div>
        `;
        document.getElementById('quickOpenBudgetBtn')?.addEventListener('click', () => this.openBudgetModal());
        return;
      }

      const spentByCategory = {};
      const periodBills = this.state.bills.filter(b => b.dueDate.startsWith(period));
      [...periodExpenses, ...periodBills].forEach(item => {
        const cat = item.category || 'Outros';
        spentByCategory[cat] = (spentByCategory[cat] || 0) + (item.amount || 0);
      });

      let html = '';
      categoriesWithBudget.forEach(cat => {
        const limit = budgets[cat];
        const spent = spentByCategory[cat] || 0;
        const percent = Math.round((spent / limit) * 100);
        const icon = CATEGORY_ICONS[cat] || 'fa-tags';
        const color = CATEGORY_COLORS[cat] || '#64748b';

        let statusClass = 'status-pill-paid';
        let statusText = `${percent}%`;
        let barColor = color;

        if (percent >= 100) {
          statusClass = 'status-pill-overdue';
          statusText = `Estourado (+${Utils.formatCurrency(spent - limit)})`;
          barColor = '#f43f5e';
        } else if (percent >= 80) {
          statusClass = 'status-pill-soon';
          statusText = `Atenção (${percent}%)`;
          barColor = '#f59e0b';
        }

        const barWidth = Math.min(100, percent);

        html += `
          <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-700/50 space-y-2">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px]" style="background-color: ${color}20; color: ${color};">
                  <i class="fa-solid ${icon}"></i>
                </div>
                <span class="font-semibold text-slate-200">${Utils.escapeHTML(cat)}</span>
              </div>
              <span class="status-pill ${statusClass} text-[10px]">${statusText}</span>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-400">
              <span>Gasto: <strong class="text-slate-200">${Utils.formatCurrency(spent)}</strong></span>
              <span>Teto: ${Utils.formatCurrency(limit)}</span>
            </div>

            <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" style="width: ${barWidth}%; background-color: ${barColor};"></div>
            </div>
          </div>
        `;
      });

      this.budgetBreakdownList.innerHTML = html;
    },

    openBudgetModal() {
      if (!this.budgetInputsContainer) return;

      const categories = [
        'Alimentação', 'Transporte', 'Moradia', 'Lazer',
        'Saúde', 'Educação', 'Compras', 'Serviços', 'Assinaturas', 'Outros'
      ];
      const budgets = this.state.budgets || {};

      let html = '';
      categories.forEach(cat => {
        const icon = CATEGORY_ICONS[cat] || 'fa-tags';
        const color = CATEGORY_COLORS[cat] || '#64748b';
        const val = budgets[cat] || 0;
        const formatted = val > 0 ? Utils.formatNumberToInput(val) : '0,00';

        html += `
          <div class="flex items-center justify-between gap-3 p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-xl">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0" style="background-color: ${color}20; color: ${color};">
                <i class="fa-solid ${icon}"></i>
              </div>
              <label for="budget_${cat}" class="text-xs font-semibold text-slate-200 truncate cursor-pointer">${Utils.escapeHTML(cat)}</label>
            </div>
            <div class="relative w-36">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">R$</span>
              <input type="text" id="budget_${cat}" data-category-budget="${cat}" inputmode="numeric" value="${formatted}" class="budget-input money-input w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs font-semibold text-right focus:border-amber-500 transition-colors" />
            </div>
          </div>
        `;
      });

      this.budgetInputsContainer.innerHTML = html;

      this.budgetInputsContainer.querySelectorAll('.budget-input').forEach(input => {
        Utils.attachCurrencyMask(input);
      });

      this.openModal(this.budgetModal);
    },

    handleBudgetSubmit(e) {
      e.preventDefault();
      const inputs = this.budgetInputsContainer.querySelectorAll('[data-category-budget]');
      const updatedBudgets = {};

      inputs.forEach(input => {
        const cat = input.getAttribute('data-category-budget');
        const amount = Utils.parseCurrency(input.value);
        if (amount > 0) {
          updatedBudgets[cat] = amount;
        }
      });

      this.state.budgets = updatedBudgets;
      Storage.save(this.state);
      this.closeModal(this.budgetModal);
      this.render();
      Toast.show('Tetos orçamentários atualizados com sucesso!', 'success');
    },

    // ========================================================================
    // PLANEJAMENTO E SIMULAÇÃO DE COMPRAS
    // ========================================================================
    getPlanStatusMeta(status) {
      const STATUS_META = {
        fits: {
          label: 'Cabe no orçamento',
          shortLabel: 'Cabe',
          pillClass: 'status-pill-paid',
          borderClass: 'border-emerald-500/30',
          boxBgClass: 'bg-emerald-500/5',
          textClass: 'text-emerald-300',
          barColor: '#10b981',
          icon: 'fa-circle-check'
        },
        tight: {
          label: 'No limite / Atenção',
          shortLabel: 'Apertado',
          pillClass: 'status-pill-soon',
          borderClass: 'border-amber-500/30',
          boxBgClass: 'bg-amber-500/5',
          textClass: 'text-amber-300',
          barColor: '#f59e0b',
          icon: 'fa-triangle-exclamation'
        },
        over: {
          label: 'Extrapolaria o orçamento',
          shortLabel: 'Extrapolaria',
          pillClass: 'status-pill-overdue',
          borderClass: 'border-rose-500/30',
          boxBgClass: 'bg-rose-500/5',
          textClass: 'text-rose-300',
          barColor: '#f43f5e',
          icon: 'fa-circle-xmark'
        },
        completed: {
          label: 'Efetivado',
          shortLabel: 'Efetivado',
          pillClass: 'status-pill-paid',
          borderClass: 'border-slate-700/60',
          boxBgClass: 'bg-slate-900/40',
          textClass: 'text-emerald-400',
          barColor: '#10b981',
          icon: 'fa-check-double'
        }
      };
      return STATUS_META[status] || STATUS_META.tight;
    },

    formatCompactPeriod(periodStr) {
      if (!periodStr) return '';
      const [yearStr, monthStr] = periodStr.split('-');
      const monthsShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthName = monthsShort[monthIdx] || monthStr;
      return `${monthName}/${yearStr.slice(-2)}`;
    },

    getMonthBaseline(period) {
      const basePeriod = this.state.currentPeriod;
      const isFuture = period !== basePeriod;

      const periodIncomes = this.getPeriodIncomes(period);
      const usesRecurringIncome = isFuture && periodIncomes.length === 0;
      const income = usesRecurringIncome
        ? this.getCurrentIncome(basePeriod)
        : periodIncomes.reduce((sum, entry) => sum + (entry.amount || 0), 0);

      const periodBillsList = this.state.bills.filter(b => (b.dueDate || '').startsWith(period));
      const usesRecurringBills = isFuture && periodBillsList.length === 0;
      const refBillsList = usesRecurringBills
        ? this.state.bills.filter(b => (b.dueDate || '').startsWith(basePeriod))
        : periodBillsList;
      const bills = refBillsList.reduce((sum, b) => sum + (b.amount || 0), 0);

      const expenses = this.state.expenses
        .filter(e => (e.date || '').startsWith(period))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const totalCommitted = Math.round((bills + expenses) * 100) / 100;
      const balanceBefore = Math.round((income - totalCommitted) * 100) / 100;

      return {
        period,
        income: Math.round(income * 100) / 100,
        bills: Math.round(bills * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        totalCommitted,
        balanceBefore,
        usesRecurringBase: isFuture && (usesRecurringIncome || usesRecurringBills)
      };
    },

    getPlanCategoryUsage(category, period) {
      const budgetLimit = Number((this.state.budgets || {})[category]) || 0;
      const currentSpent = [
        ...this.state.expenses.filter(e => (e.date || '').startsWith(period) && (e.category || 'Outros') === category),
        ...this.state.bills.filter(b => (b.dueDate || '').startsWith(period) && (b.category || 'Outros') === category)
      ].reduce((sum, item) => sum + (item.amount || 0), 0);

      return {
        budgetLimit,
        currentSpent: Math.round(currentSpent * 100) / 100
      };
    },

    computeInstallmentBreakdown(total, count) {
      const safeCount = Math.max(1, parseInt(count, 10) || 1);
      const safeTotal = Math.max(0, Math.round((Number(total) || 0) * 100) / 100);
      const baseAmount = Math.floor((safeTotal / safeCount) * 100) / 100;
      const diff = Math.round((safeTotal - (baseAmount * safeCount)) * 100) / 100;
      const firstAmount = Math.round((baseAmount + diff) * 100) / 100;
      return { safeCount, baseAmount, firstAmount };
    },

    evaluateInstallmentPlan(plan, metrics) {
      const { startPeriod, currentBase, targetAmount, remainingAmount, progressPercent } = metrics;
      const installments = Math.max(1, Math.min(36, parseInt(plan.installments, 10) || 1));
      const { budgetLimit, currentSpent } = this.getPlanCategoryUsage(plan.category, startPeriod);

      if (targetAmount > 0 && remainingAmount === 0) {
        const currentMonth = { ...currentBase, impact: 0, balanceAfter: currentBase.balanceBefore };
        return {
          mode: 'installment',
          status: 'fits',
          statusMeta: this.getPlanStatusMeta('fits'),
          targetAmount,
          savedAmount: metrics.savedAmount,
          remainingAmount: 0,
          progressPercent: 100,
          installments,
          monthlyImpact: 0,
          firstInstallmentImpact: 0,
          incomeSharePercent: 0,
          monthsNeeded: 0,
          targetCompletionPeriod: startPeriod,
          currentMonth,
          worstMonth: currentMonth,
          deficitMonths: [],
          timeline: [currentMonth],
          usesRecurringHorizon: false,
          categoryBudget: budgetLimit,
          categorySpentCurrent: currentSpent,
          categoryExceedsBudget: false,
          categoryOverflowAmount: 0,
          recommendation: 'Você já possui 100% do valor separado! Pode efetivar a compra sem comprometer seu orçamento mensal.'
        };
      }

      const { baseAmount, firstAmount } = this.computeInstallmentBreakdown(remainingAmount, installments);
      const timeline = [];
      for (let i = 0; i < installments; i++) {
        const period = Utils.shiftPeriod(startPeriod, i);
        const base = this.getMonthBaseline(period);
        const impact = i === 0 ? firstAmount : baseAmount;
        const balanceAfter = Math.round((base.balanceBefore - impact) * 100) / 100;
        timeline.push({ ...base, impact, balanceAfter });
      }

      const currentMonth = timeline[0];
      const worstMonth = timeline.reduce((worst, m) => (m.balanceAfter < worst.balanceAfter ? m : worst), timeline[0]);
      const deficitMonths = timeline.filter(m => m.balanceAfter < 0);
      const monthlyImpact = installments === 1 ? firstAmount : baseAmount;
      const incomeSharePercent = currentBase.income > 0
        ? Math.round((monthlyImpact / currentBase.income) * 100)
        : (monthlyImpact > 0 ? 100 : 0);

      const projectedCategoryTotal = Math.round((currentSpent + firstAmount) * 100) / 100;
      const categoryExceedsBudget = budgetLimit > 0 && projectedCategoryTotal > budgetLimit;
      const categoryOverflowAmount = categoryExceedsBudget
        ? Math.round((projectedCategoryTotal - budgetLimit) * 100) / 100
        : 0;

      let status = 'fits';
      if (currentBase.income <= 0 || deficitMonths.length > 0) {
        status = 'over';
      } else if (worstMonth.balanceAfter < (currentBase.income * 0.1) || incomeSharePercent > 25 || categoryExceedsBudget) {
        status = 'tight';
      }

      let recommendation = '';
      if (status === 'over') {
        const altOptions = [2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24, 36].filter(n => n > installments);
        let foundAlt = null;

        for (const k of altOptions) {
          const { baseAmount: altBase, firstAmount: altFirst } = this.computeInstallmentBreakdown(remainingAmount, k);
          let allNonNegative = true;
          for (let j = 0; j < k; j++) {
            const p = Utils.shiftPeriod(startPeriod, j);
            const b = this.getMonthBaseline(p);
            const imp = j === 0 ? altFirst : altBase;
            if ((b.balanceBefore - imp) < 0) {
              allNonNegative = false;
              break;
            }
          }
          if (allNonNegative && currentBase.income > 0) {
            foundAlt = { count: k, perMonth: altBase };
            break;
          }
        }

        if (foundAlt) {
          recommendation = `Em ${installments}x, o orçamento fecha negativo em ${Utils.formatPeriod(worstMonth.period)}. Parcelando em ${foundAlt.count}x (${Utils.formatCurrency(foundAlt.perMonth)}/mês), todos os meses permanecem no azul.`;
        } else if (currentBase.balanceBefore > 0) {
          const halfSlack = Math.max(1, Math.round((currentBase.balanceBefore * 0.5) * 100) / 100);
          const saveMonths = Math.ceil(remainingAmount / halfSlack);
          recommendation = `Mesmo aumentando o parcelamento, ${Utils.formatPeriod(worstMonth.period)} ficaria negativo. Alternativa: no modo "Juntar por mês", guardando ${Utils.formatCurrency(halfSlack)}/mês (50% da folga atual), você junta em ${saveMonths} ${saveMonths === 1 ? 'mês' : 'meses'}.`;
        } else {
          recommendation = 'Seu orçamento atual já fecha sem folga antes dessa compra. Reduza gastos ou reforce a renda antes de assumir novas parcelas.';
        }
      } else if (status === 'tight') {
        if (categoryExceedsBudget) {
          recommendation = `As parcelas cabem no saldo geral, mas a primeira parcela ultrapassa em ${Utils.formatCurrency(categoryOverflowAmount)} o teto mensal da categoria ${plan.category}.`;
        } else {
          recommendation = `Cabe no orçamento, mas a sobra em ${Utils.formatPeriod(worstMonth.period)} ficará apertada (${Utils.formatCurrency(worstMonth.balanceAfter)}). Considere aumentar a entrada ou parcelar em mais vezes.`;
        }
      } else {
        recommendation = `Compra saudável! Mesmo no mês de maior comprometimento (${Utils.formatPeriod(worstMonth.period)}), restará ${Utils.formatCurrency(worstMonth.balanceAfter)} livre.`;
      }

      return {
        mode: 'installment',
        status,
        statusMeta: this.getPlanStatusMeta(status),
        targetAmount,
        savedAmount: metrics.savedAmount,
        remainingAmount,
        progressPercent,
        installments,
        monthlyImpact,
        firstInstallmentImpact: firstAmount,
        incomeSharePercent,
        monthsNeeded: installments,
        targetCompletionPeriod: Utils.shiftPeriod(startPeriod, installments - 1),
        currentMonth,
        worstMonth,
        deficitMonths,
        timeline,
        usesRecurringHorizon: timeline.some(m => m.usesRecurringBase),
        categoryBudget: budgetLimit,
        categorySpentCurrent: currentSpent,
        categoryExceedsBudget,
        categoryOverflowAmount,
        recommendation
      };
    },

    evaluateSavePlan(plan, metrics) {
      const { startPeriod, currentBase, targetAmount, savedAmount, remainingAmount, progressPercent } = metrics;
      const monthlyContribution = Math.max(0, Math.round((Number(plan.monthlyContribution) || 0) * 100) / 100);
      const { budgetLimit, currentSpent } = this.getPlanCategoryUsage(plan.category, startPeriod);

      if (targetAmount > 0 && remainingAmount === 0) {
        const currentMonth = { ...currentBase, impact: 0, balanceAfter: currentBase.balanceBefore };
        return {
          mode: 'save',
          status: 'fits',
          statusMeta: this.getPlanStatusMeta('fits'),
          targetAmount,
          savedAmount,
          remainingAmount: 0,
          progressPercent: 100,
          installments: 1,
          monthlyImpact: 0,
          firstInstallmentImpact: 0,
          incomeSharePercent: 0,
          monthsNeeded: 0,
          targetCompletionPeriod: startPeriod,
          currentMonth,
          worstMonth: currentMonth,
          deficitMonths: [],
          timeline: [currentMonth],
          usesRecurringHorizon: false,
          categoryBudget: budgetLimit,
          categorySpentCurrent: currentSpent,
          categoryExceedsBudget: false,
          categoryOverflowAmount: 0,
          recommendation: 'Você já guardou todo o valor necessário para realizar esta compra à vista!'
        };
      }

      if (monthlyContribution <= 0) {
        const status = currentBase.balanceBefore > 0 ? 'tight' : 'over';
        const currentMonth = { ...currentBase, impact: 0, balanceAfter: currentBase.balanceBefore };
        return {
          mode: 'save',
          status,
          statusMeta: this.getPlanStatusMeta(status),
          targetAmount,
          savedAmount,
          remainingAmount,
          progressPercent,
          installments: 1,
          monthlyImpact: 0,
          firstInstallmentImpact: 0,
          incomeSharePercent: 0,
          monthsNeeded: null,
          targetCompletionPeriod: null,
          currentMonth,
          worstMonth: currentMonth,
          deficitMonths: [],
          timeline: [currentMonth],
          usesRecurringHorizon: false,
          categoryBudget: budgetLimit,
          categorySpentCurrent: currentSpent,
          categoryExceedsBudget: false,
          categoryOverflowAmount: 0,
          recommendation: 'Defina quanto pretende guardar por mês (ou clique em um dos atalhos acima) para calcular o prazo.'
        };
      }

      const monthsNeeded = Math.ceil(remainingAmount / monthlyContribution);
      const targetCompletionPeriod = Utils.shiftPeriod(startPeriod, Math.max(0, monthsNeeded - 1));
      const horizon = Math.min(monthsNeeded, 12);
      const timeline = [];

      for (let i = 0; i < horizon; i++) {
        const period = Utils.shiftPeriod(startPeriod, i);
        const base = this.getMonthBaseline(period);
        const alreadySavedInPlan = monthlyContribution * i;
        const impact = (i === monthsNeeded - 1)
          ? Math.max(0, Math.round((remainingAmount - alreadySavedInPlan) * 100) / 100)
          : monthlyContribution;
        const balanceAfter = Math.round((base.balanceBefore - impact) * 100) / 100;
        timeline.push({ ...base, impact, balanceAfter });
      }

      const currentMonth = timeline[0];
      const worstMonth = timeline.reduce((worst, m) => (m.balanceAfter < worst.balanceAfter ? m : worst), timeline[0]);
      const deficitMonths = timeline.filter(m => m.balanceAfter < 0);
      const incomeSharePercent = currentBase.income > 0
        ? Math.round((monthlyContribution / currentBase.income) * 100)
        : 100;

      let status = 'fits';
      if (currentBase.income <= 0 || deficitMonths.length > 0) {
        status = 'over';
      } else if (worstMonth.balanceAfter < (currentBase.income * 0.1) || incomeSharePercent > 30) {
        status = 'tight';
      }

      let recommendation = '';
      if (status === 'over') {
        if (currentBase.balanceBefore > 0) {
          const safePace = Math.max(1, Math.round((currentBase.balanceBefore * 0.6) * 100) / 100);
          const safeMonths = Math.ceil(remainingAmount / safePace);
          recommendation = `Guardar ${Utils.formatCurrency(monthlyContribution)}/mês deixaria ${Utils.formatPeriod(worstMonth.period)} no vermelho. Ajustando para ${Utils.formatCurrency(safePace)}/mês, você mantém folga e conclui em ${safeMonths} ${safeMonths === 1 ? 'mês' : 'meses'}.`;
        } else {
          recommendation = 'Sua folga no período já está comprometida. Ajuste seus gastos ou fontes de renda antes de definir aportes mensais.';
        }
      } else if (status === 'tight') {
        recommendation = `Meta viável em ${monthsNeeded} ${monthsNeeded === 1 ? 'mês' : 'meses'} (previsão: ${Utils.formatPeriod(targetCompletionPeriod)}), mas compromete boa parte da folga mensal (menor saldo previsto: ${Utils.formatCurrency(worstMonth.balanceAfter)}).`;
      } else {
        recommendation = `Ritmo excelente! Guardando ${Utils.formatCurrency(monthlyContribution)}/mês, você atinge ${Utils.formatCurrency(targetAmount)} em ${monthsNeeded} ${monthsNeeded === 1 ? 'mês' : 'meses'} (${Utils.formatPeriod(targetCompletionPeriod)}) sem apertar o mês.`;
      }

      return {
        mode: 'save',
        status,
        statusMeta: this.getPlanStatusMeta(status),
        targetAmount,
        savedAmount,
        remainingAmount,
        progressPercent,
        installments: monthsNeeded,
        monthlyImpact: monthlyContribution,
        firstInstallmentImpact: currentMonth.impact,
        incomeSharePercent,
        monthsNeeded,
        targetCompletionPeriod,
        currentMonth,
        worstMonth,
        deficitMonths,
        timeline,
        usesRecurringHorizon: timeline.some(m => m.usesRecurringBase),
        categoryBudget: budgetLimit,
        categorySpentCurrent: currentSpent,
        categoryExceedsBudget: false,
        categoryOverflowAmount: 0,
        recommendation
      };
    },

    evaluatePlan(plan) {
      const startPeriod = this.state.currentPeriod;
      const currentBase = this.getMonthBaseline(startPeriod);
      const targetAmount = Math.max(0, Math.round((Number(plan.targetAmount) || 0) * 100) / 100);
      const savedAmount = Math.max(0, Math.round((Number(plan.savedAmount) || 0) * 100) / 100);
      const remainingAmount = Math.max(0, Math.round((targetAmount - savedAmount) * 100) / 100);
      const progressPercent = targetAmount > 0
        ? Math.min(100, Math.round((savedAmount / targetAmount) * 100))
        : 0;

      const metrics = {
        startPeriod,
        currentBase,
        targetAmount,
        savedAmount,
        remainingAmount,
        progressPercent
      };

      return plan.mode === 'save'
        ? this.evaluateSavePlan(plan, metrics)
        : this.evaluateInstallmentPlan(plan, metrics);
    },

    renderPlanning() {
      if (!this.planningBreakdownList) return;

      const plans = [...(this.state.plans || [])].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return 0;
      });

      if (plans.length === 0) {
        this.planningBreakdownList.innerHTML = `
          <div class="text-center py-4 text-slate-500 text-xs">
            <i class="fa-solid fa-compass text-2xl mb-1.5 opacity-40"></i>
            <p>Nenhuma compra planejada ainda.</p>
            <button id="quickOpenPlanningBtn" class="mt-2.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-indigo-400/30 rounded-lg text-xs font-semibold transition-colors">
              Simular Primeira Compra
            </button>
          </div>
        `;
        document.getElementById('quickOpenPlanningBtn')?.addEventListener('click', () => this.openPlanningModal());
      } else {
        const visiblePlans = plans.slice(0, 3);
        let html = '';

        visiblePlans.forEach(plan => {
          const catColor = CATEGORY_COLORS[plan.category] || '#6366f1';
          const catIcon = CATEGORY_ICONS[plan.category] || 'fa-tags';
          const isCompleted = plan.status === 'completed';
          const evaluation = isCompleted ? null : this.evaluatePlan(plan);
          const statusMeta = isCompleted ? this.getPlanStatusMeta('completed') : evaluation.statusMeta;

          let subline = '';
          let progressHtml = '';

          if (isCompleted) {
            subline = `Valor planejado: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong>`;
          } else if (plan.mode === 'save') {
            const monthsLabel = evaluation.monthsNeeded === null
              ? 'Defina aporte'
              : (evaluation.monthsNeeded === 0 ? 'Meta atingida' : `${evaluation.monthsNeeded} ${evaluation.monthsNeeded === 1 ? 'mês' : 'meses'}`);
            subline = `<span>Aporte: <strong class="text-slate-200">${Utils.formatCurrency(plan.monthlyContribution)}/mês</strong></span><span>${monthsLabel}</span>`;
            progressHtml = `
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Guardado: ${Utils.formatCurrency(plan.savedAmount)}</span>
                  <span>${evaluation.progressPercent}%</span>
                </div>
                <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500" style="width: ${evaluation.progressPercent}%; background-color: ${statusMeta.barColor};"></div>
                </div>
              </div>
            `;
          } else {
            const condLabel = evaluation.remainingAmount === 0
              ? 'Coberto pela reserva'
              : (plan.installments > 1 ? `${plan.installments}x de ${Utils.formatCurrency(evaluation.monthlyImpact)}` : `À vista: ${Utils.formatCurrency(evaluation.monthlyImpact)}`);
            subline = `<span>Alvo: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong></span><span class="font-medium text-slate-300">${condLabel}</span>`;
          }

          html += `
            <div data-plan-open-id="${plan.id}" class="p-3 bg-slate-900/60 hover:bg-slate-900/90 rounded-xl border border-slate-700/50 hover:border-indigo-500/40 space-y-2 cursor-pointer transition-colors">
              <div class="flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px]" style="background-color: ${catColor}20; color: ${catColor};">
                    <i class="fa-solid ${catIcon}"></i>
                  </div>
                  <span class="font-semibold text-slate-200 truncate">${Utils.escapeHTML(plan.title)}</span>
                </div>
                <span class="status-pill ${statusMeta.pillClass} text-[10px] flex-shrink-0">${statusMeta.shortLabel}</span>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-400">
                ${subline}
              </div>
              ${progressHtml}
            </div>
          `;
        });

        if (plans.length > 3) {
          html += `
            <button type="button" id="viewAllPlansBtn" class="w-full py-1.5 text-[11px] font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 rounded-lg transition-colors">
              Ver todos os ${plans.length} planejamentos
            </button>
          `;
        }

        this.planningBreakdownList.innerHTML = html;

        this.planningBreakdownList.querySelectorAll('[data-plan-open-id]').forEach(card => {
          card.addEventListener('click', () => {
            this.openPlanningModal(card.getAttribute('data-plan-open-id'));
          });
        });

        document.getElementById('viewAllPlansBtn')?.addEventListener('click', () => this.openPlanningModal());
      }

      if (this.planningModal && !this.planningModal.classList.contains('hidden')) {
        this.renderPlanningModalList();
        this.updatePlanSimulationPreview();
      }
    },

    openPlanningModal(editPlanId = null) {
      if (editPlanId) {
        this.openEditPlan(editPlanId);
      } else {
        this.resetPlanningForm();
      }
      this.renderPlanningModalList();
      this.updatePlanSimulationPreview();
      this.openModal(this.planningModal);
      this.planTitleInput?.focus();
    },

    resetPlanningForm() {
      this.planningForm?.reset();
      if (this.planEditId) this.planEditId.value = '';
      if (this.planningFormTitle) this.planningFormTitle.textContent = 'Simular Nova Compra';
      this.cancelPlanningEditBtn?.classList.add('hidden');
      if (this.planningSubmitBtn) {
        this.planningSubmitBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i><span>Salvar Planejamento</span>';
      }
      if (this.planCategorySelect) this.planCategorySelect.value = 'Compras';
      if (this.planTargetAmountInput) this.planTargetAmountInput.value = '0,00';
      if (this.planSavedAmountInput) this.planSavedAmountInput.value = '0,00';
      if (this.planInstallmentsSelect) this.planInstallmentsSelect.value = '10';
      if (this.planPaymentMethodSelect) this.planPaymentMethodSelect.value = 'Cartão de Crédito';
      if (this.planMonthlyContributionInput) this.planMonthlyContributionInput.value = '0,00';
      this.setPlanMode('installment', false);
    },

    openEditPlan(planId) {
      const plan = (this.state.plans || []).find(p => p.id === planId);
      if (!plan) return;

      if (this.planEditId) this.planEditId.value = plan.id;
      if (this.planningFormTitle) this.planningFormTitle.textContent = 'Editar Planejamento';
      this.cancelPlanningEditBtn?.classList.remove('hidden');
      if (this.planningSubmitBtn) {
        this.planningSubmitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Salvar Alterações</span>';
      }

      if (this.planTitleInput) this.planTitleInput.value = plan.title;
      if (this.planCategorySelect) this.planCategorySelect.value = CATEGORY_COLORS[plan.category] ? plan.category : 'Compras';
      if (this.planTargetAmountInput) this.planTargetAmountInput.value = Utils.formatNumberToInput(plan.targetAmount);
      if (this.planSavedAmountInput) this.planSavedAmountInput.value = Utils.formatNumberToInput(plan.savedAmount);

      if (this.planInstallmentsSelect) {
        const instStr = String(plan.installments || 10);
        const hasOption = Array.from(this.planInstallmentsSelect.options).some(opt => opt.value === instStr);
        if (!hasOption) {
          const opt = document.createElement('option');
          opt.value = instStr;
          opt.textContent = instStr === '1' ? '1x (À vista)' : `${instStr}x sem juros`;
          this.planInstallmentsSelect.appendChild(opt);
        }
        this.planInstallmentsSelect.value = instStr;
      }

      if (this.planPaymentMethodSelect) {
        this.planPaymentMethodSelect.value = METHOD_ICONS[plan.paymentMethod] ? plan.paymentMethod : 'Cartão de Crédito';
      }
      if (this.planMonthlyContributionInput) {
        this.planMonthlyContributionInput.value = Utils.formatNumberToInput(plan.monthlyContribution || 0);
      }

      this.setPlanMode(plan.mode, false);
      this.updatePlanSimulationPreview();
      if (this.planningModalBody) this.planningModalBody.scrollTop = 0;
    },

    setPlanMode(mode, updatePreview = true) {
      const normalizedMode = mode === 'save' ? 'save' : 'installment';
      if (this.planModeInput) this.planModeInput.value = normalizedMode;

      this.planModeBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-plan-mode') === normalizedMode;
        if (isActive) {
          btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
          btn.classList.remove('text-slate-400', 'hover:text-white');
        } else {
          btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
          btn.classList.add('text-slate-400', 'hover:text-white');
        }
      });

      if (normalizedMode === 'save') {
        this.planInstallmentFields?.classList.add('hidden');
        this.planSaveFields?.classList.remove('hidden');
      } else {
        this.planInstallmentFields?.classList.remove('hidden');
        this.planSaveFields?.classList.add('hidden');
      }

      if (updatePreview) {
        this.updatePlanSimulationPreview();
      }
    },

    getPlanFormDraft() {
      return {
        id: this.planEditId?.value || '',
        title: (this.planTitleInput?.value || '').trim(),
        category: this.planCategorySelect?.value || 'Compras',
        mode: (this.planModeInput?.value === 'save') ? 'save' : 'installment',
        targetAmount: Utils.parseCurrency(this.planTargetAmountInput?.value || '0'),
        savedAmount: Utils.parseCurrency(this.planSavedAmountInput?.value || '0'),
        installments: parseInt(this.planInstallmentsSelect?.value || '10', 10) || 10,
        paymentMethod: this.planPaymentMethodSelect?.value || 'Cartão de Crédito',
        monthlyContribution: Utils.parseCurrency(this.planMonthlyContributionInput?.value || '0')
      };
    },

    applyPlanMonthsPreset(months) {
      const safeMonths = Math.max(1, parseInt(months, 10) || 6);
      const targetAmount = Utils.parseCurrency(this.planTargetAmountInput?.value || '0');
      const savedAmount = Utils.parseCurrency(this.planSavedAmountInput?.value || '0');

      if (targetAmount <= 0) {
        Toast.show('Informe o valor total estimado primeiro para calcular o aporte.', 'warning');
        this.planTargetAmountInput?.focus();
        return;
      }

      const remaining = Math.max(0, Math.round((targetAmount - savedAmount) * 100) / 100);
      const perMonth = remaining > 0 ? Math.ceil((remaining / safeMonths) * 100) / 100 : 0;

      if (this.planMonthlyContributionInput) {
        this.planMonthlyContributionInput.value = Utils.formatNumberToInput(perMonth);
      }
      this.updatePlanSimulationPreview();
    },

    applyFreeBalanceToPlan() {
      const base = this.getMonthBaseline(this.state.currentPeriod);
      if (base.balanceBefore <= 0) {
        Toast.show('O mês atual não possui folga positiva para sugerir aporte.', 'warning');
        return;
      }
      const suggested = Math.round((base.balanceBefore * 0.5) * 100) / 100;
      if (this.planMonthlyContributionInput) {
        this.planMonthlyContributionInput.value = Utils.formatNumberToInput(suggested);
      }
      this.updatePlanSimulationPreview();
    },

    updatePlanSimulationPreview() {
      if (!this.planSimulationPreview) return;

      const draft = this.getPlanFormDraft();
      const currentBase = this.getMonthBaseline(this.state.currentPeriod);
      const currentBalanceClass = currentBase.balanceBefore >= 0 ? 'text-emerald-300' : 'text-rose-300';

      if (draft.targetAmount <= 0) {
        this.planSimulationPreview.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-slate-400">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-calculator text-indigo-400"></i>
              <span>Informe o valor total estimado acima para simular o impacto no orçamento.</span>
            </div>
            <div class="text-[11px] flex-shrink-0">
              Folga atual: <strong class="${currentBalanceClass}">${Utils.formatCurrency(currentBase.balanceBefore)}</strong>
            </div>
          </div>
        `;
        return;
      }

      const ev = this.evaluatePlan(draft);
      const meta = ev.statusMeta;
      const balanceAfterCurrent = ev.currentMonth.balanceAfter;
      const afterClass = balanceAfterCurrent >= 0 ? 'text-emerald-300' : 'text-rose-300';
      const worstClass = ev.worstMonth.balanceAfter >= 0 ? 'text-slate-100' : 'text-rose-300';

      const headlineValue = ev.mode === 'save'
        ? (ev.remainingAmount === 0
          ? 'Valor já acumulado!'
          : (ev.monthsNeeded ? `${ev.monthsNeeded} ${ev.monthsNeeded === 1 ? 'mês' : 'meses'} guardando ${Utils.formatCurrency(ev.monthlyImpact)}/mês` : 'Aporte mensal não definido'))
        : (ev.remainingAmount === 0
          ? '100% coberto pela entrada'
          : (ev.installments > 1 ? `${ev.installments}x de ${Utils.formatCurrency(ev.monthlyImpact)}` : `À vista: ${Utils.formatCurrency(ev.monthlyImpact)}`));

      const thirdMetricLabel = ev.mode === 'save'
        ? 'Previsão de compra'
        : `Pior mês (${this.formatCompactPeriod(ev.worstMonth.period)})`;
      const thirdMetricValue = ev.mode === 'save'
        ? (ev.targetCompletionPeriod ? `${this.formatCompactPeriod(ev.targetCompletionPeriod)}` : '—')
        : Utils.formatCurrency(ev.worstMonth.balanceAfter);
      const thirdMetricClass = ev.mode === 'save' ? 'text-indigo-300' : worstClass;

      const progressBarHtml = (ev.mode === 'save' || ev.savedAmount > 0) ? `
        <div class="space-y-1 pt-0.5">
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Reserva: <strong class="text-slate-200">${Utils.formatCurrency(ev.savedAmount)}</strong> de ${Utils.formatCurrency(ev.targetAmount)}</span>
            <span>Falta: <strong class="text-slate-200">${Utils.formatCurrency(ev.remainingAmount)}</strong> (${ev.progressPercent}%)</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${ev.progressPercent}%; background-color: ${meta.barColor};"></div>
          </div>
        </div>
      ` : '';

      const categoryWarningHtml = ev.categoryExceedsBudget ? `
        <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] flex items-start gap-2">
          <i class="fa-solid fa-bullseye mt-0.5 flex-shrink-0 text-amber-400"></i>
          <span>Teto da categoria <strong>${Utils.escapeHTML(draft.category)}</strong> (${Utils.formatCurrency(ev.categoryBudget)}): seria ultrapassado em <strong>${Utils.formatCurrency(ev.categoryOverflowAmount)}</strong> neste mês.</span>
        </div>
      ` : '';

      const timelineSlice = ev.timeline.slice(0, 6);
      const timelineChipsHtml = timelineSlice.length > 1 ? `
        <div class="pt-1 space-y-1">
          <div class="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            <span>Projeção de saldo pós-compromisso${ev.timeline.length > 6 ? ` (primeiros 6 de ${ev.timeline.length} meses)` : ''}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${timelineSlice.map(m => {
              const chipColor = m.balanceAfter >= 0
                ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-200';
              return `<span class="px-2 py-0.5 rounded-md border text-[10px] font-medium ${chipColor}">${this.formatCompactPeriod(m.period)}: <strong>${Utils.formatCurrency(m.balanceAfter)}</strong></span>`;
            }).join('')}
          </div>
        </div>
      ` : '';

      const baselineFootnoteHtml = ev.usesRecurringHorizon ? `
        <p class="text-[10px] text-slate-500">
          <i class="fa-solid fa-circle-info mr-1"></i>Meses futuros sem lançamentos próprios usam a renda e contas fixas atuais como base + parcelas já cadastradas.
        </p>
      ` : '';

      this.planSimulationPreview.innerHTML = `
        <div class="space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div class="flex items-center gap-2">
              <i class="fa-solid ${meta.icon} ${meta.textClass}"></i>
              <span class="font-bold text-slate-100">${headlineValue}</span>
            </div>
            <span class="status-pill ${meta.pillClass} text-[10px]">${meta.label}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span class="block text-[10px] text-slate-400">Peso mensal</span>
              <span class="font-bold text-slate-100">${Utils.formatCurrency(ev.monthlyImpact)}</span>
              <span class="text-[10px] text-slate-400 ml-1">(${ev.incomeSharePercent}% renda)</span>
            </div>
            <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span class="block text-[10px] text-slate-400">Saldo do mês após</span>
              <span class="font-bold ${afterClass}">${Utils.formatCurrency(balanceAfterCurrent)}</span>
              <span class="block text-[10px] text-slate-500">Antes: ${Utils.formatCurrency(currentBase.balanceBefore)}</span>
            </div>
            <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span class="block text-[10px] text-slate-400">${thirdMetricLabel}</span>
              <span class="font-bold ${thirdMetricClass}">${thirdMetricValue}</span>
            </div>
          </div>

          ${progressBarHtml}
          ${categoryWarningHtml}

          <div class="p-2.5 rounded-lg ${meta.boxBgClass} border ${meta.borderClass} text-slate-200 text-[11px] leading-relaxed">
            <strong class="${meta.textClass}">Diagnóstico:</strong> ${Utils.escapeHTML(ev.recommendation)}
          </div>

          ${timelineChipsHtml}
          ${baselineFootnoteHtml}
        </div>
      `;
    },

    renderPlanningModalList() {
      if (!this.plansListContainer) return;

      const plans = [...(this.state.plans || [])].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return 0;
      });

      if (this.plansCountBadge) {
        this.plansCountBadge.textContent = `${plans.length} ${plans.length === 1 ? 'plano' : 'planos'}`;
      }

      if (plans.length === 0) {
        this.plansListContainer.innerHTML = `
          <div class="text-center py-6 px-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-1.5">
            <i class="fa-solid fa-compass text-2xl text-slate-600"></i>
            <p class="text-xs font-semibold text-slate-300">Nenhum planejamento salvo ainda</p>
            <p class="text-[11px] text-slate-500">Use o simulador acima para testar uma compra e salvar para acompanhar ou efetivar depois.</p>
          </div>
        `;
        return;
      }

      let html = '';
      plans.forEach(plan => {
        const catColor = CATEGORY_COLORS[plan.category] || '#6366f1';
        const catIcon = CATEGORY_ICONS[plan.category] || 'fa-tags';
        const isCompleted = plan.status === 'completed';
        const ev = isCompleted ? null : this.evaluatePlan(plan);
        const statusMeta = isCompleted ? this.getPlanStatusMeta('completed') : ev.statusMeta;
        const modeBadge = plan.mode === 'save' ? 'Juntar/mês' : (plan.installments > 1 ? `Parcelado (${plan.installments}x)` : 'À vista (1x)');

        let detailLine = '';
        let progressLine = '';

        if (isCompleted) {
          const completedDate = plan.completedAt ? Utils.formatDate(plan.completedAt.slice(0, 10)) : '';
          detailLine = `Alvo: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong>${completedDate ? ` • Efetivado em ${completedDate}` : ''}`;
        } else if (plan.mode === 'save') {
          const eta = ev.targetCompletionPeriod ? `Previsão: ${this.formatCompactPeriod(ev.targetCompletionPeriod)} (${ev.monthsNeeded}m)` : 'Sem aporte mensal';
          detailLine = `Aporte: <strong class="text-slate-200">${Utils.formatCurrency(plan.monthlyContribution)}/mês</strong> • ${eta}`;
          progressLine = `
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px] text-slate-400">
                <span>Guardado: <strong class="text-slate-200">${Utils.formatCurrency(plan.savedAmount)}</strong> de ${Utils.formatCurrency(plan.targetAmount)}</span>
                <span>${ev.progressPercent}%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width: ${ev.progressPercent}%; background-color: ${statusMeta.barColor};"></div>
              </div>
            </div>
          `;
        } else {
          const financedText = ev.remainingAmount === 0
            ? '100% coberto pela entrada'
            : (plan.installments > 1 ? `${plan.installments}x de ${Utils.formatCurrency(ev.monthlyImpact)}` : Utils.formatCurrency(ev.monthlyImpact));
          detailLine = `Alvo: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong> • Impacto: <strong class="text-slate-200">${financedText}</strong> • Pior mês: <span class="${ev.worstMonth.balanceAfter >= 0 ? 'text-slate-200' : 'text-rose-300'} font-semibold">${Utils.formatCurrency(ev.worstMonth.balanceAfter)}</span>`;
        }

        const actionsHtml = isCompleted
          ? `
            <button type="button" data-plan-reopen="${plan.id}" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-rotate-left text-[10px]"></i>
              <span>Reabrir</span>
            </button>
            <button type="button" data-plan-delete="${plan.id}" class="action-icon-btn text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" title="Excluir planejamento">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          `
          : `
            <button type="button" data-plan-complete="${plan.id}" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-check text-[10px]"></i>
              <span>Efetivar Compra</span>
            </button>
            <button type="button" data-plan-edit="${plan.id}" class="action-icon-btn text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10" title="Editar planejamento">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button type="button" data-plan-delete="${plan.id}" class="action-icon-btn text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" title="Excluir planejamento">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          `;

        html += `
          <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2.5">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs" style="background-color: ${catColor}20; color: ${catColor};">
                  <i class="fa-solid ${catIcon}"></i>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-slate-100 text-xs truncate">${Utils.escapeHTML(plan.title)}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">${modeBadge}</span>
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    ${Utils.escapeHTML(plan.category)} • ${Utils.escapeHTML(plan.paymentMethod)}
                  </div>
                </div>
              </div>
              <span class="status-pill ${statusMeta.pillClass} text-[10px] flex-shrink-0">${statusMeta.label}</span>
            </div>

            <div class="text-[11px] text-slate-400">
              ${detailLine}
            </div>

            ${progressLine}

            <div class="pt-1 flex items-center justify-end gap-1.5 border-t border-slate-800/80">
              ${actionsHtml}
            </div>
          </div>
        `;
      });

      this.plansListContainer.innerHTML = html;

      this.plansListContainer.querySelectorAll('[data-plan-complete]').forEach(btn => {
        btn.addEventListener('click', () => this.completePlan(btn.getAttribute('data-plan-complete')));
      });
      this.plansListContainer.querySelectorAll('[data-plan-edit]').forEach(btn => {
        btn.addEventListener('click', () => this.openEditPlan(btn.getAttribute('data-plan-edit')));
      });
      this.plansListContainer.querySelectorAll('[data-plan-reopen]').forEach(btn => {
        btn.addEventListener('click', () => this.reopenPlan(btn.getAttribute('data-plan-reopen')));
      });
      this.plansListContainer.querySelectorAll('[data-plan-delete]').forEach(btn => {
        btn.addEventListener('click', () => this.deletePlan(btn.getAttribute('data-plan-delete')));
      });
    },

    handlePlanningSubmit(e) {
      e.preventDefault();
      const draft = this.getPlanFormDraft();

      if (!draft.title) {
        Toast.show('Informe o que deseja comprar.', 'warning');
        this.planTitleInput?.focus();
        return;
      }
      if (draft.targetAmount <= 0) {
        Toast.show('O valor total estimado deve ser maior que zero.', 'warning');
        this.planTargetAmountInput?.focus();
        return;
      }

      const remaining = Math.max(0, Math.round((draft.targetAmount - draft.savedAmount) * 100) / 100);
      if (draft.mode === 'save' && remaining > 0 && draft.monthlyContribution <= 0) {
        Toast.show('Informe quanto pretende guardar por mês ou use um atalho.', 'warning');
        this.planMonthlyContributionInput?.focus();
        return;
      }

      if (!Array.isArray(this.state.plans)) this.state.plans = [];

      if (draft.id) {
        const idx = this.state.plans.findIndex(p => p.id === draft.id);
        if (idx !== -1) {
          const existing = this.state.plans[idx];
          this.state.plans[idx] = Storage.normalizePlan({
            ...existing,
            ...draft,
            id: existing.id,
            status: existing.status,
            completedAt: existing.completedAt,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
          });
          Toast.show(`Planejamento "${draft.title}" atualizado!`, 'success');
        }
      } else {
        const created = Storage.normalizePlan({
          ...draft,
          id: Utils.generateUUID(),
          status: 'active',
          createdAt: new Date().toISOString()
        });
        this.state.plans.unshift(created);
        Toast.show(`Planejamento "${created.title}" salvo!`, 'success');
      }

      Storage.save(this.state);
      this.resetPlanningForm();
      this.render();
    },

    getEffectivePlanStartDate() {
      const todayISO = Utils.getTodayISO();
      const period = this.state.currentPeriod;
      if (todayISO.startsWith(period)) return todayISO;

      const dayNum = parseInt(todayISO.split('-')[2], 10) || 1;
      const [year, month] = period.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const clampedDay = String(Math.min(dayNum, daysInMonth)).padStart(2, '0');
      return `${period}-${clampedDay}`;
    },

    async completePlan(planId) {
      const plan = (this.state.plans || []).find(p => p.id === planId);
      if (!plan || plan.status === 'completed') return;

      const remainingAmount = Math.max(0, Math.round((plan.targetAmount - plan.savedAmount) * 100) / 100);
      const shouldLaunchExpenses = plan.mode === 'installment' && remainingAmount > 0;

      let confirmMsg = '';
      if (shouldLaunchExpenses) {
        const condText = plan.installments > 1
          ? `${plan.installments} parcelas em ${plan.paymentMethod}`
          : `1 lançamento à vista (${plan.paymentMethod})`;
        const entryNote = plan.savedAmount > 0
          ? ` (descontando ${Utils.formatCurrency(plan.savedAmount)} de entrada/reserva já guardada)`
          : '';
        confirmMsg = `Deseja efetivar "${plan.title}"? Será lançado o valor de ${Utils.formatCurrency(remainingAmount)}${entryNote} em Gastos Diários (${condText}, categoria ${plan.category}).`;
      } else if (plan.mode === 'save') {
        confirmMsg = `Marcar a meta "${plan.title}" como efetivada? Como é um plano de economia acumulada, nenhum gasto parcelado será lançado automaticamente no mês.`;
      } else {
        confirmMsg = `Marcar "${plan.title}" como concluído? Como o valor já está 100% coberto pela entrada/reserva, nenhum gasto mensal adicional será lançado.`;
      }

      const confirmed = await ConfirmDialog.open({
        title: 'Efetivar Compra Planejada',
        message: confirmMsg
      });
      if (!confirmed) return;

      if (shouldLaunchExpenses) {
        const startDateISO = this.getEffectivePlanStartDate();
        const { installments: createdExpenses } = this.buildInstallmentExpenses({
          description: plan.title,
          amount: remainingAmount,
          amountType: 'total',
          count: plan.installments,
          startDateISO,
          category: plan.category,
          method: plan.paymentMethod
        });
        this.state.expenses.unshift(...createdExpenses);
        Toast.show(
          createdExpenses.length > 1
            ? `Compra "${plan.title}" efetivada em ${createdExpenses.length}x nos Gastos Diários!`
            : `Compra "${plan.title}" lançada em Gastos Diários!`,
          'success'
        );
      } else {
        Toast.show(`Planejamento "${plan.title}" marcado como efetivado!`, 'success');
      }

      plan.status = 'completed';
      plan.completedAt = new Date().toISOString();
      plan.updatedAt = new Date().toISOString();

      if (this.planEditId?.value === plan.id) {
        this.resetPlanningForm();
      }

      Storage.save(this.state);
      this.render();
    },

    reopenPlan(planId) {
      const plan = (this.state.plans || []).find(p => p.id === planId);
      if (!plan) return;

      plan.status = 'active';
      plan.completedAt = null;
      plan.updatedAt = new Date().toISOString();

      Storage.save(this.state);
      this.render();
      Toast.show(`Planejamento "${plan.title}" reaberto.`, 'info');
    },

    async deletePlan(planId) {
      const plan = (this.state.plans || []).find(p => p.id === planId);
      if (!plan) return;

      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Planejamento',
        message: `Deseja remover "${plan.title}" dos seus planejamentos? Gastos já lançados anteriormente não serão apagados.`
      });
      if (!confirmed) return;

      this.state.plans = (this.state.plans || []).filter(p => p.id !== planId);

      if (this.planEditId?.value === planId) {
        this.resetPlanningForm();
      }

      Storage.save(this.state);
      this.render();
      Toast.show('Planejamento excluído.', 'info');
    },

    // ========================================================================
    // ALERTAS DE VENCIMENTO
    // ========================================================================
    getAlertSettings() {
      this.state.alertSettings = Utils.normalizeAlertSettings(this.state.alertSettings);
      return this.state.alertSettings;
    },

    getDueAlertBills(customDaysBefore = null) {
      const settings = this.getAlertSettings();
      const daysBefore = customDaysBefore !== null ? customDaysBefore : settings.daysBefore;

      const unpaidBills = this.state.bills
        .filter(b => !b.paid && b.dueDate)
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const overdue = [];
      const dueToday = [];
      const upcoming = [];

      unpaidBills.forEach(bill => {
        const status = Utils.calculateBillStatus(bill.dueDate, false, daysBefore);
        const item = { bill, status };
        if (status.key === 'overdue') {
          overdue.push(item);
        } else if (status.key === 'soon') {
          if (status.diffDays === 0) {
            dueToday.push(item);
          } else {
            upcoming.push(item);
          }
        }
      });

      const all = [...overdue, ...dueToday, ...upcoming];
      const totalAmount = all.reduce((sum, item) => sum + (item.bill.amount || 0), 0);

      return { overdue, dueToday, upcoming, all, totalAmount, daysBefore };
    },

    renderDueAlerts() {
      const settings = this.getAlertSettings();
      const alertData = this.getDueAlertBills();
      const hasAlerts = settings.enabled && alertData.all.length > 0;
      const hasUrgent = alertData.overdue.length > 0 || alertData.dueToday.length > 0;
      const badgeText = alertData.all.length > 9 ? '9+' : String(alertData.all.length);

      // Atualiza cor dos ícones de sino nos gatilhos (ativo vs desativado)
      [this.openAlertModalBtn, this.mobileAlertBtn, this.openAlertBillsBtn].forEach(btn => {
        const icon = btn?.querySelector('.fa-bell');
        if (!icon) return;
        icon.classList.toggle('text-amber-400', settings.enabled);
        icon.classList.toggle('text-slate-500', !settings.enabled);
      });

      // Atualiza badges no header desktop e barra mobile
      [this.headerAlertBadge, this.mobileAlertBadge].forEach(badge => {
        if (!badge) return;
        badge.textContent = badgeText;
        badge.classList.toggle('hidden', !hasAlerts);
        badge.classList.toggle('bg-rose-500', hasUrgent);
        badge.classList.toggle('bg-amber-500', !hasUrgent);
      });

      if (!this.dueAlertsBanner) return;

      const today = Utils.getTodayISO();
      const isDismissedToday = settings.dismissedDate === today;

      if (!hasAlerts || isDismissedToday) {
        this.dueAlertsBanner.classList.add('hidden');
        if (hasAlerts) {
          this.maybeShowBrowserNotification(alertData);
        }
        return;
      }

      const isOverdueMode = alertData.overdue.length > 0;
      this.dueAlertsBanner.className = isOverdueMode
        ? 'rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-500/15 via-slate-900 to-slate-900 p-4 sm:p-5 shadow-lg'
        : 'rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 p-4 sm:p-5 shadow-lg';

      if (this.alertsBannerIconWrap) {
        this.alertsBannerIconWrap.className = isOverdueMode
          ? 'w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5'
          : 'w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5';
      }
      if (this.alertsBannerIcon) {
        this.alertsBannerIcon.className = isOverdueMode
          ? 'fa-solid fa-triangle-exclamation text-rose-400 text-base'
          : 'fa-solid fa-bell text-amber-400 text-base';
      }

      if (this.alertsBannerTitle) {
        this.alertsBannerTitle.textContent = `Contas em atenção (${alertData.all.length})`;
      }

      if (this.alertsBannerBadges) {
        const pills = [];
        if (alertData.overdue.length > 0) {
          const n = alertData.overdue.length;
          pills.push(`<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">${n} atrasada${n > 1 ? 's' : ''}</span>`);
        }
        if (alertData.dueToday.length > 0) {
          const n = alertData.dueToday.length;
          pills.push(`<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">${n} ${n > 1 ? 'vencem' : 'vence'} hoje</span>`);
        }
        if (alertData.upcoming.length > 0) {
          const n = alertData.upcoming.length;
          pills.push(`<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">${n} próxima${n > 1 ? 's' : ''} (${alertData.daysBefore}d)</span>`);
        }
        this.alertsBannerBadges.innerHTML = pills.join('');
      }

      if (this.alertsBannerSubtitle) {
        this.alertsBannerSubtitle.textContent = `Total pendente em alerta: ${Utils.formatCurrency(alertData.totalAmount)}`;
      }

      if (this.alertsBannerList) {
        const visibleItems = alertData.all.slice(0, 6);
        let cardsHtml = '';

        visibleItems.forEach(({ bill, status }) => {
          const isItemOverdue = status.key === 'overdue';
          const pillClass = isItemOverdue
            ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'
            : 'text-amber-300 bg-amber-500/15 border-amber-500/30';

          cardsHtml += `
            <div class="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-700/70">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <p class="text-xs font-semibold text-slate-100 truncate">${Utils.escapeHTML(bill.title)}</p>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold border ${pillClass}">${status.label}</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-1">
                  ${Utils.formatDate(bill.dueDate)} • <span class="text-slate-200 font-semibold">${Utils.formatCurrency(bill.amount)}</span>
                </p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button data-banner-pay-id="${bill.id}" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-smooth active:scale-95" title="Marcar conta como paga">
                  Pagar
                </button>
              </div>
            </div>
          `;
        });

        if (alertData.all.length > 6) {
          const extra = alertData.all.length - 6;
          cardsHtml += `
            <div class="md:col-span-2 xl:col-span-3 text-[11px] text-slate-400 pt-1">
              + ${extra} outra${extra > 1 ? 's' : ''} conta${extra > 1 ? 's' : ''} em atenção listada${extra > 1 ? 's' : ''} abaixo.
            </div>
          `;
        }

        this.alertsBannerList.innerHTML = cardsHtml;

        this.alertsBannerList.querySelectorAll('[data-banner-pay-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-banner-pay-id');
            this.toggleBillStatus(id);
          });
        });
      }

      this.maybeShowBrowserNotification(alertData);
    },

    maybeShowBrowserNotification(alertData) {
      const settings = this.getAlertSettings();
      if (!settings.enabled || !settings.browserNotify || alertData.all.length === 0) return;
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      const today = Utils.getTodayISO();
      if (settings.lastNotifiedDate === today) return;

      const parts = [];
      if (alertData.overdue.length > 0) parts.push(`${alertData.overdue.length} atrasada(s)`);
      if (alertData.dueToday.length > 0) parts.push(`${alertData.dueToday.length} vence(m) hoje`);
      if (alertData.upcoming.length > 0) parts.push(`${alertData.upcoming.length} próxima(s)`);

      const body = `Você tem ${alertData.all.length} conta(s) em atenção (${parts.join(', ')}), totalizando ${Utils.formatCurrency(alertData.totalAmount)}.`;

      try {
        new Notification('FinFlow — Contas a Vencer', {
          body,
          icon: './icon-192.png',
          tag: 'finflow-due-alerts'
        });
        settings.lastNotifiedDate = today;
        this.state.alertSettings = settings;
        Storage.save(this.state);
      } catch (err) {
        console.warn('Não foi possível exibir notificação local:', err);
      }
    },

    dismissAlertsForToday() {
      const settings = this.getAlertSettings();
      settings.dismissedDate = Utils.getTodayISO();
      this.state.alertSettings = settings;
      Storage.save(this.state);
      this.renderDueAlerts();
      Toast.show('Banner ocultado por hoje. Acesse pelo sino quando precisar.', 'info');
    },

    openAlertModal() {
      const settings = this.getAlertSettings();

      if (this.alertEnabledToggle) this.alertEnabledToggle.checked = settings.enabled;
      if (this.alertDaysBeforeSelect) this.alertDaysBeforeSelect.value = String(settings.daysBefore);
      if (this.alertBrowserNotifyToggle) this.alertBrowserNotifyToggle.checked = settings.browserNotify;

      this.updateAlertModalControlsState();
      this.openModal(this.alertModal);
    },

    updateAlertModalControlsState() {
      const alertsOn = this.alertEnabledToggle ? this.alertEnabledToggle.checked : true;

      if (this.alertOptionsGroup) {
        this.alertOptionsGroup.classList.toggle('opacity-50', !alertsOn);
        this.alertOptionsGroup.classList.toggle('pointer-events-none', !alertsOn);
      }
      if (this.alertDaysBeforeSelect) this.alertDaysBeforeSelect.disabled = !alertsOn;
      if (this.alertBrowserNotifyToggle) this.alertBrowserNotifyToggle.disabled = !alertsOn;

      this.updateAlertModalPreview();
    },

    updateAlertModalPreview() {
      if (!this.alertModalSummaryBox) return;

      const alertsOn = this.alertEnabledToggle ? this.alertEnabledToggle.checked : true;
      const days = this.alertDaysBeforeSelect ? Number(this.alertDaysBeforeSelect.value) : 3;
      const alertData = this.getDueAlertBills(days);

      if (!alertsOn) {
        this.alertModalSummaryBox.innerHTML = `
          <div class="flex items-center gap-2 text-slate-400">
            <i class="fa-solid fa-bell-slash text-slate-500"></i>
            <span>Os alertas de vencimento estão desativados.</span>
          </div>
        `;
        return;
      }

      if (alertData.all.length === 0) {
        this.alertModalSummaryBox.innerHTML = `
          <div class="flex items-center gap-2 text-emerald-300">
            <i class="fa-solid fa-circle-check text-emerald-400"></i>
            <span>Nenhuma conta atrasada ou vencendo nos próximos <strong>${days} dia(s)</strong> no momento.</span>
          </div>
        `;
        return;
      }

      this.alertModalSummaryBox.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center gap-2 text-amber-300 font-semibold">
            <i class="fa-solid fa-bolt text-amber-400"></i>
            <span>Resumo com antecedência de ${days} dia(s):</span>
          </div>
          <p class="text-slate-300">
            <strong>${alertData.all.length} conta(s)</strong> em atenção (${alertData.overdue.length} atrasada(s), ${alertData.dueToday.length} hoje, ${alertData.upcoming.length} próxima(s)) — Total de <strong>${Utils.formatCurrency(alertData.totalAmount)}</strong>.
          </p>
        </div>
      `;
    },

    async handleAlertSubmit(e) {
      e.preventDefault();

      const prevSettings = this.getAlertSettings();
      const enabled = this.alertEnabledToggle ? this.alertEnabledToggle.checked : true;
      const daysBefore = this.alertDaysBeforeSelect ? Number(this.alertDaysBeforeSelect.value) : 3;
      let browserNotify = this.alertBrowserNotifyToggle ? this.alertBrowserNotifyToggle.checked : false;

      if (enabled && browserNotify) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          browserNotify = false;
          if (this.alertBrowserNotifyToggle) this.alertBrowserNotifyToggle.checked = false;
          Toast.show('Este navegador ou iPhone não suporta notificações locais neste modo.', 'warning');
        } else if (Notification.permission === 'default') {
          try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              browserNotify = false;
              if (this.alertBrowserNotifyToggle) this.alertBrowserNotifyToggle.checked = false;
              Toast.show('Permissão de notificação não concedida. Alertas no painel continuam ativos.', 'warning');
            }
          } catch (err) {
            browserNotify = false;
            if (this.alertBrowserNotifyToggle) this.alertBrowserNotifyToggle.checked = false;
          }
        } else if (Notification.permission === 'denied') {
          browserNotify = false;
          if (this.alertBrowserNotifyToggle) this.alertBrowserNotifyToggle.checked = false;
          Toast.show('As notificações estão bloqueadas nas permissões do navegador.', 'warning');
        }
      }

      this.state.alertSettings = Utils.normalizeAlertSettings({
        enabled,
        daysBefore,
        browserNotify,
        lastNotifiedDate: prevSettings.lastNotifiedDate,
        dismissedDate: null
      });

      Storage.save(this.state);
      this.closeModal(this.alertModal);
      this.render();

      if (!enabled) {
        Toast.show('Alertas de vencimento desativados.', 'info');
      } else {
        Toast.show('Configurações de alertas salvas!', 'success');
      }
    },

    // ========================================================================
    // RENDERIZAÇÃO DA SEÇÃO DE CONTAS
    // ========================================================================
    renderBills() {
      if (!this.billsListContainer) return;

      const period = this.state.currentPeriod;
      let bills = this.state.bills.filter(b => b.dueDate.startsWith(period));

      bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      if (this.billsCountBadge) {
        this.billsCountBadge.textContent = bills.length;
      }

      if (this.billFilter === 'pending') {
        bills = bills.filter(b => !b.paid);
      } else if (this.billFilter === 'paid') {
        bills = bills.filter(b => b.paid);
      }

      if (bills.length === 0) {
        this.billsListContainer.innerHTML = `
          <div class="empty-state">
            <div class="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-lg mb-3">
              <i class="fa-solid fa-receipt"></i>
            </div>
            <p class="text-sm font-semibold text-slate-300">Nenhuma conta encontrada</p>
            <p class="text-xs text-slate-500 mt-1 max-w-xs">Cadastre suas despesas fixas ou copie as contas do mês anterior.</p>
          </div>
        `;
        return;
      }

      const alertSettings = this.getAlertSettings();
      let html = '';
      bills.forEach(bill => {
        const status = Utils.calculateBillStatus(bill.dueDate, bill.paid, alertSettings.daysBefore);
        const isChecked = bill.paid ? 'checked' : '';
        const categoryIcon = CATEGORY_ICONS[bill.category] || 'fa-file-invoice';

        html += `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-smooth gap-3 group">
            
            <!-- Esquerda: Toggle rápido e Info -->
            <div class="flex items-center gap-3.5 flex-1 min-w-0">
              
              <label class="relative inline-flex items-center cursor-pointer flex-shrink-0" title="Marcar como ${bill.paid ? 'Pendente' : 'Pago'}">
                <input type="checkbox" class="sr-only bill-toggle-checkbox" data-bill-id="${bill.id}" ${isChecked} />
                <div class="bill-toggle-track w-11 h-6 bg-slate-700 rounded-full transition-colors relative">
                  <div class="bill-toggle-thumb w-5 h-5 bg-white rounded-full transition-transform absolute top-0.5 left-0.5 shadow-md flex items-center justify-center">
                    ${bill.paid ? '<i class="fa-solid fa-check text-[10px] text-emerald-600 font-bold"></i>' : ''}
                  </div>
                </div>
              </label>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-sm font-semibold text-slate-100 truncate ${bill.paid ? 'line-through text-slate-400' : ''}">
                    ${Utils.escapeHTML(bill.title)}
                  </h4>
                  <span class="status-pill ${status.cssClass}">
                    <span class="w-1.5 h-1.5 rounded-full ${status.dotColor}"></span>
                    ${status.label}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span class="flex items-center gap-1">
                    <i class="fa-regular fa-calendar text-[11px]"></i>
                    Vence: ${Utils.formatDate(bill.dueDate)}
                  </span>
                  <span>•</span>
                  <span class="flex items-center gap-1 text-slate-400">
                    <i class="fa-solid ${categoryIcon} text-[10px]"></i>
                    ${Utils.escapeHTML(bill.category)}
                  </span>
                </div>
              </div>

            </div>

            <!-- Direita: Valor e Ações (Editar / Excluir) -->
            <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              <span class="text-base font-bold text-slate-100 tracking-tight">
                ${Utils.formatCurrency(bill.amount)}
              </span>
              <div class="flex items-center gap-1">
                <button data-edit-bill-id="${bill.id}" class="action-icon-btn text-slate-400 hover:text-indigo-400 hover:bg-slate-800" title="Editar conta">
                  <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button data-delete-bill-id="${bill.id}" class="action-icon-btn text-slate-500 hover:text-rose-400 hover:bg-slate-800" title="Excluir conta">
                  <i class="fa-regular fa-trash-can text-sm"></i>
                </button>
              </div>
            </div>

          </div>
        `;
      });

      this.billsListContainer.innerHTML = html;

      // Eventos: Toggle rápido de 1 clique
      this.billsListContainer.querySelectorAll('.bill-toggle-checkbox').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-bill-id');
          this.toggleBillStatus(id);
        });
      });

      // Eventos: Editar Conta
      this.billsListContainer.querySelectorAll('[data-edit-bill-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-edit-bill-id');
          this.openEditBillModal(id);
        });
      });

      // Eventos: Excluir Conta
      this.billsListContainer.querySelectorAll('[data-delete-bill-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-delete-bill-id');
          this.deleteBill(id);
        });
      });
    },

    // ========================================================================
    // RENDERIZAÇÃO DA SEÇÃO DE GASTOS DIÁRIOS
    // ========================================================================
    renderExpenses() {
      if (!this.expensesListContainer) return;

      const period = this.state.currentPeriod;
      let expenses = this.state.expenses.filter(e => e.date.startsWith(period));

      if (this.expensesCountBadge) {
        this.expensesCountBadge.textContent = expenses.length;
      }

      if (this.expenseCategoryFilter !== 'all') {
        expenses = expenses.filter(e => e.category === this.expenseCategoryFilter);
      }

      if (this.expenseMethodFilter && this.expenseMethodFilter !== 'all') {
        expenses = expenses.filter(e => e.method === this.expenseMethodFilter);
      }

      if (this.expenseSearchQuery) {
        expenses = expenses.filter(e => e.description.toLowerCase().includes(this.expenseSearchQuery));
      }

      expenses.sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      if (expenses.length === 0) {
        this.expensesListContainer.innerHTML = `
          <div class="empty-state">
            <div class="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-lg mb-3">
              <i class="fa-solid fa-cart-shopping"></i>
            </div>
            <p class="text-sm font-semibold text-slate-300">Nenhum gasto encontrado</p>
            <p class="text-xs text-slate-500 mt-1 max-w-xs">Lance os gastos diários para acompanhar sua distribuição no mês.</p>
          </div>
        `;
        return;
      }

      let html = '';
      expenses.forEach(expense => {
        const iconClass = CATEGORY_ICONS[expense.category] || 'fa-receipt';
        const methodIcon = METHOD_ICONS[expense.method] || 'fa-money-bill text-slate-400';
        const catColor = CATEGORY_COLORS[expense.category] || '#64748b';

        html += `
          <div class="flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-smooth gap-3 group">
            
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs flex-shrink-0" style="background-color: ${catColor}20; color: ${catColor}; border: 1px solid ${catColor}40;">
                <i class="fa-solid ${iconClass}"></i>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-semibold text-slate-100 truncate">
                    ${Utils.escapeHTML(expense.description)}
                  </h4>
                  ${expense.installmentGroupId ? `
                    <span class="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-md inline-flex items-center gap-1 flex-shrink-0" title="Compra Parcelada">
                      <i class="fa-solid fa-layer-group text-[9px]"></i>
                      ${expense.installmentNumber}/${expense.totalInstallments}
                    </span>
                  ` : ''}
                </div>
                <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                  <span>${Utils.formatDate(expense.date)}</span>
                  <span>•</span>
                  <span class="flex items-center gap-1">
                    <i class="fa-solid ${methodIcon} text-[10px]"></i>
                    ${Utils.escapeHTML(expense.method)}
                  </span>
                  <span>•</span>
                  <span class="text-slate-400">${Utils.escapeHTML(expense.category)}</span>
                </div>
              </div>
            </div>

            <!-- Valor e Ações (Editar / Excluir) -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                ${Utils.formatCurrency(expense.amount)}
              </span>
              <div class="flex items-center gap-1">
                <button data-edit-expense-id="${expense.id}" class="action-icon-btn text-slate-400 hover:text-emerald-400 hover:bg-slate-800" title="Editar lançamento">
                  <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button data-delete-expense-id="${expense.id}" class="action-icon-btn text-slate-500 hover:text-rose-400 hover:bg-slate-800" title="Excluir lançamento">
                  <i class="fa-regular fa-trash-can text-sm"></i>
                </button>
              </div>
            </div>

          </div>
        `;
      });

      this.expensesListContainer.innerHTML = html;

      // Eventos: Editar Gasto
      this.expensesListContainer.querySelectorAll('[data-edit-expense-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-edit-expense-id');
          this.openEditExpenseModal(id);
        });
      });

      // Eventos: Excluir Gasto
      this.expensesListContainer.querySelectorAll('[data-delete-expense-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-delete-expense-id');
          this.deleteExpense(id);
        });
      });
    },

    // ========================================================================
    // RENDERIZAÇÃO DE GRÁFICOS E INSIGHTS
    // ========================================================================
    renderChartsAndInsights() {
      const period = this.state.currentPeriod;
      const periodBills = this.state.bills.filter(b => b.dueDate.startsWith(period));
      const periodExpenses = this.state.expenses.filter(e => e.date.startsWith(period));

      const categoryTotals = {};
      let totalGastos = 0;

      [...periodExpenses, ...periodBills].forEach(item => {
        const cat = item.category || 'Outros';
        const val = item.amount || 0;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
        totalGastos += val;
      });

      ChartManager.render(categoryTotals);

      // Detalhamento de Categorias
      if (this.categoryBreakdownList) {
        const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

        if (sortedCategories.length === 0) {
          this.categoryBreakdownList.innerHTML = `
            <div class="text-center text-slate-500 py-3 text-xs">
              Sem dados para listar detalhamento.
            </div>
          `;
        } else {
          let breakdownHtml = '';
          sortedCategories.forEach(([cat, amount]) => {
            const percent = totalGastos > 0 ? Math.round((amount / totalGastos) * 100) : 0;
            const color = CATEGORY_COLORS[cat] || '#64748b';

            breakdownHtml += `
              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></span>
                    <span class="text-slate-300 font-medium">${Utils.escapeHTML(cat)}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-slate-400 text-[11px]">${percent}%</span>
                    <span class="font-semibold text-slate-200">${Utils.formatCurrency(amount)}</span>
                  </div>
                </div>
                <div class="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500" style="width: ${percent}%; background-color: ${color}"></div>
                </div>
              </div>
            `;
          });
          this.categoryBreakdownList.innerHTML = breakdownHtml;
        }
      }

      // Detalhamento por Métodos de Pagamento
      if (this.methodsBreakdownContainer) {
        const methodTotals = {};
        periodExpenses.forEach(exp => {
          const method = exp.method || 'Outros';
          const val = exp.amount || 0;
          methodTotals[method] = (methodTotals[method] || 0) + val;
        });

        const sortedMethods = Object.entries(methodTotals).sort((a, b) => b[1] - a[1]);

        if (sortedMethods.length === 0) {
          this.methodsBreakdownContainer.innerHTML = `
            <div class="text-center text-slate-500 py-3 text-xs">
              Nenhum método utilizado no mês.
            </div>
          `;
        } else {
          let methodsHtml = '';
          sortedMethods.forEach(([method, amount]) => {
            const percent = totalGastos > 0 ? Math.round((amount / totalGastos) * 100) : 0;
            const icon = METHOD_ICONS[method] || 'fa-money-bill text-slate-400';

            methodsHtml += `
              <div class="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/50">
                <div class="flex items-center gap-2">
                  <i class="fa-solid ${icon} text-xs"></i>
                  <span class="text-slate-300 font-medium">${Utils.escapeHTML(method)}</span>
                </div>
                <div class="text-right">
                  <div class="font-semibold text-slate-200">${Utils.formatCurrency(amount)}</div>
                  <div class="text-[10px] text-slate-400">${percent}% dos gastos</div>
                </div>
              </div>
            `;
          });
          this.methodsBreakdownContainer.innerHTML = methodsHtml;
        }
      }
    }
  };

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})();
