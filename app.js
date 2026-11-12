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
    calculateBillStatus(dueDateISO, isPaid) {
      if (isPaid) {
        return {
          label: 'Pago',
          cssClass: 'status-pill-paid',
          dotColor: 'bg-emerald-400',
          key: 'paid'
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [year, month, day] = dueDateISO.split('-').map(Number);
      const due = new Date(year, month - 1, day);
      due.setHours(0, 0, 0, 0);

      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return {
          label: 'Atrasado',
          cssClass: 'status-pill-overdue',
          dotColor: 'bg-rose-500',
          key: 'overdue'
        };
      } else if (diffDays <= 3) {
        return {
          label: diffDays === 0 ? 'Vence Hoje' : 'Vence em breve',
          cssClass: 'status-pill-soon',
          dotColor: 'bg-amber-400',
          key: 'soon'
        };
      } else {
        return {
          label: 'Pendente',
          cssClass: 'status-pill-pending',
          dotColor: 'bg-slate-400',
          key: 'pending'
        };
      }
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
        version: 1,
        monthlyIncome: 6500.00,
        incomes: {},
        currentPeriod: currentPeriod,
        budgets: {
          'Alimentação': 1200.00,
          'Transporte': 350.00,
          'Lazer': 250.00
        },
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

        if (!Array.isArray(parsed.bills)) parsed.bills = [];
        if (!Array.isArray(parsed.expenses)) parsed.expenses = [];
        if (typeof parsed.monthlyIncome !== 'number' || isNaN(parsed.monthlyIncome)) {
          parsed.monthlyIncome = 0;
        }
        if (!parsed.currentPeriod) {
          parsed.currentPeriod = Utils.getCurrentPeriodISO();
        }
        if (!parsed.budgets || typeof parsed.budgets !== 'object') {
          parsed.budgets = {};
        }
        if (!parsed.incomes || typeof parsed.incomes !== 'object') {
          parsed.incomes = {};
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
    },

    cacheDOMElements() {
      // Header & Período
      this.currentPeriodDisplay = document.getElementById('currentPeriodDisplay');
      this.prevMonthBtn = document.getElementById('prevMonthBtn');
      this.nextMonthBtn = document.getElementById('nextMonthBtn');

      // KPIs
      this.kpiIncome = document.getElementById('kpiIncome');
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

      // Insights & Orçamentos
      this.categoryBreakdownList = document.getElementById('categoryBreakdownList');
      this.methodsBreakdownContainer = document.getElementById('methodsBreakdownContainer');
      this.budgetBreakdownList = document.getElementById('budgetBreakdownList');

      // Modais & Edição
      this.incomeModal = document.getElementById('incomeModal');
      this.incomeForm = document.getElementById('incomeForm');
      this.incomeInput = document.getElementById('incomeInput');

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
    },

    bindEvents() {
      // 1. Navegação de Mês
      this.prevMonthBtn?.addEventListener('click', () => this.changePeriod(-1));
      this.nextMonthBtn?.addEventListener('click', () => this.changePeriod(1));

      // 2. Modais - Abertura
      const openIncome = () => {
        this.incomeInput.value = Utils.formatNumberToInput(this.getCurrentIncome());
        this.openModal(this.incomeModal);
        this.incomeInput.focus();
        this.incomeInput.select();
      };

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
          [this.incomeModal, this.billModal, this.expenseModal, this.budgetModal].forEach(m => {
            if (m && !m.classList.contains('hidden')) this.closeModal(m);
          });
        }
      });

      // 4. Submissão de Formulários
      this.incomeForm?.addEventListener('submit', (e) => this.handleIncomeSubmit(e));
      this.billForm?.addEventListener('submit', (e) => this.handleBillSubmit(e));
      this.expenseForm?.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
      this.budgetForm?.addEventListener('submit', (e) => this.handleBudgetSubmit(e));

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
    // AÇÕES DE FORMULÁRIO (CRIAÇÃO E ATUALIZAÇÃO)
    // ========================================================================
    handleIncomeSubmit(e) {
      e.preventDefault();
      const parsedIncome = Utils.parseCurrency(this.incomeInput.value);

      if (parsedIncome < 0) {
        Toast.show('O valor da renda não pode ser negativo.', 'warning');
        return;
      }

      if (!this.state.incomes || typeof this.state.incomes !== 'object') {
        this.state.incomes = {};
      }
      this.state.incomes[this.state.currentPeriod] = parsedIncome;
      this.state.monthlyIncome = parsedIncome;
      Storage.save(this.state);
      this.closeModal(this.incomeModal);
      this.render();
      Toast.show(`Renda de ${Utils.formatPeriod(this.state.currentPeriod)} atualizada para ${Utils.formatCurrency(parsedIncome)}.`, 'success');
    },

    getCurrentIncome() {
      if (this.state.incomes && typeof this.state.incomes === 'object' && this.state.incomes[this.state.currentPeriod] !== undefined) {
        return this.state.incomes[this.state.currentPeriod];
      }
      return this.state.monthlyIncome || 0;
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

        let amountPerInstallment = amount;
        let diff = 0;

        if (installmentType === 'total') {
          amountPerInstallment = Math.floor((amount / count) * 100) / 100;
          diff = Math.round((amount - (amountPerInstallment * count)) * 100) / 100;
        }

        const groupId = Utils.generateUUID();
        const [startYear, startMonth, startDay] = date.split('-').map(Number);
        const newInstallments = [];

        for (let i = 0; i < count; i++) {
          const monthIndex = startMonth - 1 + i;
          const targetYear = startYear + Math.floor(monthIndex / 12);
          const targetMonth = (monthIndex % 12) + 1;
          const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
          const targetDay = Math.min(startDay, daysInMonth);
          const targetDateISO = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

          const instAmount = (i === 0 && installmentType === 'total')
            ? Math.round((amountPerInstallment + diff) * 100) / 100
            : amountPerInstallment;

          newInstallments.push({
            id: Utils.generateUUID(),
            description: `${description} (${i + 1}/${count})`,
            amount: instAmount,
            date: targetDateISO,
            category,
            method,
            installmentGroupId: groupId,
            installmentNumber: i + 1,
            totalInstallments: count,
            createdAt: new Date().toISOString()
          });
        }

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

          this.state = {
            version: parsed.version || 1,
            monthlyIncome: typeof parsed.monthlyIncome === 'number' ? parsed.monthlyIncome : 0,
            incomes: (parsed.incomes && typeof parsed.incomes === 'object') ? parsed.incomes : {},
            currentPeriod: parsed.currentPeriod || Utils.getCurrentPeriodISO(),
            budgets: (parsed.budgets && typeof parsed.budgets === 'object') ? parsed.budgets : {},
            bills: Array.isArray(parsed.bills) ? parsed.bills : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : []
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
      this.renderKPIs();
      this.renderBurnRate();
      this.checkPreviousMonthBills();
      this.renderBills();
      this.renderExpenses();
      this.renderChartsAndInsights();
      this.renderBudgets();
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

      let html = '';
      bills.forEach(bill => {
        const status = Utils.calculateBillStatus(bill.dueDate, bill.paid);
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
