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

  const RESERVE_TYPE_META = {
    'Reserva de Emergência': { icon: 'fa-shield-halved', color: '#10b981' },
    'Despesas Anuais': { icon: 'fa-calendar-days', color: '#38bdf8' },
    'Caixinha / Conta Rende': { icon: 'fa-piggy-bank', color: '#14b8a6' },
    'Poupança': { icon: 'fa-building-columns', color: '#3b82f6' },
    'Investimentos / CDB': { icon: 'fa-chart-line', color: '#f59e0b' },
    'Dinheiro Físico': { icon: 'fa-money-bill-wave', color: '#22c55e' },
    'Objetivo / Sonho': { icon: 'fa-star', color: '#a855f7' },
    'Outros': { icon: 'fa-vault', color: '#64748b' }
  };

  const ESSENTIAL_DEFAULT_CATEGORIES = new Set([
    'Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Serviços'
  ]);

  const PLAN_PRIORITY_META = {
    essential: {
      label: 'Essencial',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      icon: 'fa-shield-heart',
      rank: 0
    },
    important: {
      label: 'Importante',
      badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      icon: 'fa-star',
      rank: 1
    },
    desire: {
      label: 'Desejo',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: 'fa-sparkles',
      rank: 2
    }
  };

  const BALANCED_BUDGET_PRESET_PERCENTS = {
    'Alimentação': 15,
    'Transporte': 10,
    'Lazer': 10,
    'Compras': 5
  };

  const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

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
     * Converte taxas percentuais digitadas (ex: "1,89%", "1.495") mantendo até 4 casas decimais
     */
    parsePercent(input) {
      if (typeof input === 'number') {
        return Number.isFinite(input) && input >= 0 ? Math.round(input * 10000) / 10000 : 0;
      }
      if (!input || typeof input !== 'string') {
        return 0;
      }

      let sanitized = input.trim().replace(/[%\s]/g, '');
      if (sanitized.includes(',') && sanitized.includes('.')) {
        sanitized = sanitized.replace(/\./g, '').replace(',', '.');
      } else if (sanitized.includes(',')) {
        sanitized = sanitized.replace(',', '.');
      }

      const parsed = parseFloat(sanitized);
      if (!Number.isFinite(parsed) || parsed < 0) return 0;
      return Math.round(parsed * 10000) / 10000;
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
     * Navega meses (+N ou -N) mantendo formato YYYY-MM com aritmética calendário exata
     */
    shiftPeriod(periodStr, delta) {
      const [yearStr, monthStr] = periodStr.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const totalMonths = (year * 12) + (month - 1) + (parseInt(delta, 10) || 0);
      const targetYear = Math.floor(totalMonths / 12);
      const targetMonth = ((totalMonths % 12) + 12) % 12 + 1;

      return `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
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
    iconWrapEl: document.getElementById('confirmModalIconWrap'),
    iconEl: document.getElementById('confirmModalIcon'),
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

    open({
      title = 'Confirmar Exclusão',
      message = 'Tem certeza que deseja continuar?',
      confirmText,
      cancelText = 'Cancelar',
      variant = 'danger',
      icon
    }) {
      const VARIANTS = {
        danger: {
          confirmText: 'Excluir',
          icon: 'fa-trash-can',
          iconWrapClass: 'w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center text-lg mb-3',
          okBtnClass: 'flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-smooth shadow-md shadow-rose-600/20'
        },
        warning: {
          confirmText: 'Confirmar',
          icon: 'fa-triangle-exclamation',
          iconWrapClass: 'w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center text-lg mb-3',
          okBtnClass: 'flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-smooth shadow-md shadow-amber-600/20'
        },
        primary: {
          confirmText: 'Confirmar',
          icon: 'fa-copy',
          iconWrapClass: 'w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center text-lg mb-3',
          okBtnClass: 'flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-smooth shadow-md shadow-indigo-600/20'
        },
        success: {
          confirmText: 'Confirmar',
          icon: 'fa-check',
          iconWrapClass: 'w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center text-lg mb-3',
          okBtnClass: 'flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-smooth shadow-md shadow-emerald-600/20'
        }
      };

      const cfg = VARIANTS[variant] || VARIANTS.danger;
      const resolvedIcon = icon || cfg.icon;
      const resolvedConfirmText = confirmText || cfg.confirmText;

      return new Promise((resolve) => {
        this.resolveCallback = resolve;
        this.titleEl.textContent = title;
        this.messageEl.textContent = message;
        if (this.iconWrapEl) this.iconWrapEl.className = cfg.iconWrapClass;
        if (this.iconEl) this.iconEl.className = `fa-solid ${resolvedIcon}`;
        if (this.okBtn) {
          this.okBtn.textContent = resolvedConfirmText;
          this.okBtn.className = cfg.okBtnClass;
        }
        if (this.cancelBtn) this.cancelBtn.textContent = cancelText;
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
        financeGoals: {
          saveGoalMode: 'percent',
          saveGoalValue: 20,
          emergencyMonths: 6
        },
        annualExpenses: [],
        debts: [],
        debtStrategy: 'avalanche',
        plans: [],
        reserves: [],
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
      const validModes = new Set(['installment', 'financing', 'save']);
      const mode = validModes.has(raw.mode) ? raw.mode : 'installment';

      const maxInstallments = mode === 'financing' ? 420 : 36;
      const defaultInstallments = mode === 'financing' ? 48 : 10;
      const parsedInst = parseInt(raw.installments, 10);
      const installments = (Number.isFinite(parsedInst) && parsedInst >= 1)
        ? Math.min(maxInstallments, parsedInst)
        : defaultInstallments;

      const downPaymentSource = raw.downPaymentSource === 'month_budget' ? 'month_budget' : 'saved';
      const financingCalcBy = raw.financingCalcBy === 'installment' ? 'installment' : 'rate';
      const parsedRate = Number(raw.interestRate);
      const interestRate = (Number.isFinite(parsedRate) && parsedRate >= 0)
        ? Math.round(parsedRate * 10000) / 10000
        : 0;
      const interestRateUnit = raw.interestRateUnit === 'annual' ? 'annual' : 'monthly';
      const amortizationType = raw.amortizationType === 'sac' ? 'sac' : 'price';
      const parsedFinPmt = Number(raw.financingInstallmentAmount);
      const financingInstallmentAmount = (Number.isFinite(parsedFinPmt) && parsedFinPmt >= 0)
        ? Math.round(parsedFinPmt * 100) / 100
        : 0;
      const parsedDueDay = parseInt(raw.financingDueDay, 10);
      const financingDueDay = (Number.isFinite(parsedDueDay) && parsedDueDay >= 1)
        ? Math.min(31, parsedDueDay)
        : 10;
      const parsedOffset = parseInt(raw.firstInstallmentOffset, 10);
      const firstInstallmentOffset = [0, 1, 2].includes(parsedOffset) ? parsedOffset : 1;

      const parsedMonthly = Number(raw.monthlyContribution);
      const monthlyContribution = (Number.isFinite(parsedMonthly) && parsedMonthly >= 0)
        ? Math.round(parsedMonthly * 100) / 100
        : 0;
      const paymentMethod = METHOD_ICONS[raw.paymentMethod] ? raw.paymentMethod : 'Cartão de Crédito';
      const status = raw.status === 'completed' ? 'completed' : 'active';
      const priority = PLAN_PRIORITY_META[raw.priority] ? raw.priority : 'important';

      return {
        id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id : Utils.generateUUID(),
        title,
        targetAmount,
        savedAmount,
        downPaymentSource,
        category,
        priority,
        mode,
        installments,
        firstInstallmentOffset,
        financingCalcBy,
        interestRate,
        interestRateUnit,
        amortizationType,
        financingInstallmentAmount,
        financingDueDay,
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

    normalizeBudgets(rawBudgets) {
      if (!rawBudgets || typeof rawBudgets !== 'object') return {};
      const out = {};
      Object.entries(rawBudgets).forEach(([cat, val]) => {
        if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          out[cat] = Math.round(val * 100) / 100;
        } else if (val && typeof val === 'object') {
          const mode = val.mode === 'percent' ? 'percent' : 'fixed';
          const numVal = Number(val.value);
          if (Number.isFinite(numVal) && numVal > 0) {
            if (mode === 'percent') {
              out[cat] = { mode: 'percent', value: Math.min(100, Math.round(numVal * 100) / 100) };
            } else {
              out[cat] = Math.round(numVal * 100) / 100;
            }
          }
        }
      });
      return out;
    },

    normalizeFinanceGoals(raw) {
      const obj = (raw && typeof raw === 'object') ? raw : {};
      const saveGoalMode = obj.saveGoalMode === 'fixed' ? 'fixed' : 'percent';
      const parsedVal = Number(obj.saveGoalValue);
      let saveGoalValue = (Number.isFinite(parsedVal) && parsedVal >= 0)
        ? Math.round(parsedVal * 100) / 100
        : (saveGoalMode === 'percent' ? 20 : 0);
      if (saveGoalMode === 'percent') {
        saveGoalValue = Math.min(90, saveGoalValue);
      }
      const parsedMonths = parseInt(obj.emergencyMonths, 10);
      const emergencyMonths = [3, 6, 9, 12].includes(parsedMonths) ? parsedMonths : 6;
      return { saveGoalMode, saveGoalValue, emergencyMonths };
    },

    normalizeAnnualExpense(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const title = (typeof raw.title === 'string' && raw.title.trim()) ? raw.title.trim() : 'Despesa Anual';
      const category = CATEGORY_COLORS[raw.category] ? raw.category : 'Outros';
      const parsedAmount = Number(raw.amount);
      const amount = (Number.isFinite(parsedAmount) && parsedAmount > 0) ? Math.round(parsedAmount * 100) / 100 : 0;
      if (amount <= 0) return null;
      const parsedMonth = parseInt(raw.dueMonth, 10);
      const dueMonth = (Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) ? parsedMonth : 1;
      const reserveId = (typeof raw.reserveId === 'string' && raw.reserveId.trim()) ? raw.reserveId.trim() : '';
      const lastDepositedPeriod = (typeof raw.lastDepositedPeriod === 'string' && /^\d{4}-\d{2}$/.test(raw.lastDepositedPeriod))
        ? raw.lastDepositedPeriod
        : null;
      return {
        id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id : Utils.generateUUID(),
        title,
        category,
        amount,
        dueMonth,
        reserveId,
        lastDepositedPeriod,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {})
      };
    },

    normalizeAnnualExpenses(rawList) {
      if (!Array.isArray(rawList)) return [];
      return rawList.map(item => this.normalizeAnnualExpense(item)).filter(Boolean);
    },

    normalizeDebt(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const title = (typeof raw.title === 'string' && raw.title.trim()) ? raw.title.trim() : 'Dívida';
      const creditor = (typeof raw.creditor === 'string') ? raw.creditor.trim() : '';
      const parsedBal = Number(raw.totalBalance);
      const totalBalance = (Number.isFinite(parsedBal) && parsedBal >= 0) ? Math.round(parsedBal * 100) / 100 : 0;
      const parsedPmt = Number(raw.monthlyPayment);
      const monthlyPayment = (Number.isFinite(parsedPmt) && parsedPmt >= 0) ? Math.round(parsedPmt * 100) / 100 : 0;
      const parsedRate = Number(raw.interestRatePct);
      const interestRatePct = (Number.isFinite(parsedRate) && parsedRate >= 0) ? Math.min(200, Math.round(parsedRate * 100) / 100) : 0;
      const paidOff = Boolean(raw.paidOff) || totalBalance === 0;
      return {
        id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id : Utils.generateUUID(),
        title,
        creditor,
        totalBalance,
        monthlyPayment,
        interestRatePct,
        paidOff,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {})
      };
    },

    normalizeDebts(rawList) {
      if (!Array.isArray(rawList)) return [];
      return rawList.map(item => this.normalizeDebt(item)).filter(Boolean);
    },

    normalizeBillRecord(bill) {
      if (!bill || typeof bill !== 'object') return null;
      const cat = CATEGORY_COLORS[bill.category] ? bill.category : 'Outros';
      const defaultNature = ESSENTIAL_DEFAULT_CATEGORIES.has(cat) ? 'essential' : 'superfluous';
      const nature = (bill.nature === 'essential' || bill.nature === 'superfluous') ? bill.nature : defaultNature;
      const parsedFee = Number(bill.lateFee);
      const lateFee = (Number.isFinite(parsedFee) && parsedFee > 0) ? Math.round(parsedFee * 100) / 100 : 0;
      return {
        ...bill,
        category: cat,
        nature,
        ...(lateFee > 0 ? { lateFee } : {})
      };
    },

    normalizeExpenseRecord(expense) {
      if (!expense || typeof expense !== 'object') return null;
      const cat = CATEGORY_COLORS[expense.category] ? expense.category : 'Outros';
      const defaultNature = ESSENTIAL_DEFAULT_CATEGORIES.has(cat) ? 'essential' : 'superfluous';
      const nature = (expense.nature === 'essential' || expense.nature === 'superfluous') ? expense.nature : defaultNature;
      return {
        ...expense,
        category: cat,
        nature
      };
    },

    normalizeReserveMovement(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const validTypes = new Set(['initial', 'deposit', 'withdraw']);
      const type = validTypes.has(raw.type) ? raw.type : 'deposit';
      const parsedAmount = Number(raw.amount);
      const amount = (Number.isFinite(parsedAmount) && parsedAmount >= 0)
        ? Math.round(parsedAmount * 100) / 100
        : 0;
      if (amount <= 0) return null;

      const date = (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date))
        ? raw.date
        : Utils.getTodayISO();

      return {
        id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id : Utils.generateUUID(),
        type,
        amount,
        date,
        note: (typeof raw.note === 'string') ? raw.note.trim() : '',
        affectMonthBalance: type === 'initial' ? false : Boolean(raw.affectMonthBalance),
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
      };
    },

    normalizeReserve(raw) {
      if (!raw || typeof raw !== 'object') return null;

      const title = (typeof raw.title === 'string' && raw.title.trim())
        ? raw.title.trim()
        : 'Reserva';
      const type = RESERVE_TYPE_META[raw.type] ? raw.type : 'Outros';
      const parsedBalance = Number(raw.balance);
      const balance = (Number.isFinite(parsedBalance) && parsedBalance >= 0)
        ? Math.round(parsedBalance * 100) / 100
        : 0;
      const parsedGoal = Number(raw.goalAmount);
      const goalAmount = (Number.isFinite(parsedGoal) && parsedGoal >= 0)
        ? Math.round(parsedGoal * 100) / 100
        : 0;

      const movements = Array.isArray(raw.movements)
        ? raw.movements.map(m => this.normalizeReserveMovement(m)).filter(Boolean)
        : [];

      return {
        id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id : Utils.generateUUID(),
        title,
        type,
        balance,
        goalAmount,
        movements,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {})
      };
    },

    normalizeReserves(rawReserves) {
      if (!Array.isArray(rawReserves)) return [];
      return rawReserves.map(r => this.normalizeReserve(r)).filter(Boolean);
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
        parsed.budgets = this.normalizeBudgets(parsed.budgets);
        parsed.financeGoals = this.normalizeFinanceGoals(parsed.financeGoals);
        parsed.annualExpenses = this.normalizeAnnualExpenses(parsed.annualExpenses);
        parsed.debts = this.normalizeDebts(parsed.debts);
        parsed.debtStrategy = parsed.debtStrategy === 'snowball' ? 'snowball' : 'avalanche';
        parsed.bills = parsed.bills.map(b => this.normalizeBillRecord(b)).filter(Boolean);
        parsed.expenses = parsed.expenses.map(e => this.normalizeExpenseRecord(e)).filter(Boolean);

        parsed.incomeEntries = this.normalizeIncomeEntries(parsed);
        parsed.plans = this.normalizePlans(parsed.plans);
        parsed.reserves = this.normalizeReserves(parsed.reserves);
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
    expenseNatureFilter: 'all',
    billNatureManuallyToggled: false,
    expenseNatureManuallyToggled: false,
    expandedReserveHistoryIds: new Set(),

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
      Utils.attachCurrencyMask(this.billLateFeeInput);
      Utils.attachCurrencyMask(this.expenseAmountInput);
      Utils.attachCurrencyMask(this.planTargetAmountInput);
      Utils.attachCurrencyMask(this.planSavedAmountInput);
      Utils.attachCurrencyMask(this.planFinancingInstallmentInput);
      Utils.attachCurrencyMask(this.planMonthlyContributionInput);
      Utils.attachCurrencyMask(this.reserveMoveAmountInput);
      Utils.attachCurrencyMask(this.reserveBalanceInput);
      Utils.attachCurrencyMask(this.reserveGoalInput);
      Utils.attachCurrencyMask(this.goalSaveValueInput);
      Utils.attachCurrencyMask(this.annualAmountInput);
      Utils.attachCurrencyMask(this.debtBalanceInput);
      Utils.attachCurrencyMask(this.debtMonthlyPaymentInput);
      Utils.attachCurrencyMask(this.debtExtraMonthlyInput);
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
      this.expenseNatureFilterSelect = document.getElementById('expenseNatureFilter');

      // Insights, Orçamentos & Planejamento
      this.categoryBreakdownList = document.getElementById('categoryBreakdownList');
      this.natureBreakdownSummary = document.getElementById('natureBreakdownSummary');
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
      this.incomeAutoReserveBox = document.getElementById('incomeAutoReserveBox');
      this.incomeAutoReserveCheck = document.getElementById('incomeAutoReserveCheck');
      this.incomeAutoReserveFields = document.getElementById('incomeAutoReserveFields');
      this.incomeAutoReservePercentInput = document.getElementById('incomeAutoReservePercentInput');
      this.incomeAutoReservePreview = document.getElementById('incomeAutoReservePreview');
      this.incomeAutoReserveTargetSelect = document.getElementById('incomeAutoReserveTargetSelect');
      this.cancelIncomeEditBtn = document.getElementById('cancelIncomeEditBtn');
      this.incomeSubmitBtn = document.getElementById('incomeSubmitBtn');
      this.incomesListContainer = document.getElementById('incomesListContainer');

      this.budgetModal = document.getElementById('budgetModal');
      this.budgetForm = document.getElementById('budgetForm');
      this.budgetInputsContainer = document.getElementById('budgetInputsContainer');
      this.budgetPresetBalancedBtn = document.getElementById('budgetPresetBalancedBtn');
      this.budgetClearAllBtn = document.getElementById('budgetClearAllBtn');

      this.billModal = document.getElementById('billModal');
      this.billForm = document.getElementById('billForm');
      this.billModalTitle = document.getElementById('billModalTitle');
      this.billSubmitBtn = document.getElementById('billSubmitBtn');
      this.billEditId = document.getElementById('billEditId');
      this.billTitleInput = document.getElementById('billTitleInput');
      this.billAmountInput = document.getElementById('billAmountInput');
      this.billDueDateInput = document.getElementById('billDueDateInput');
      this.billCategorySelect = document.getElementById('billCategorySelect');
      this.billNatureInput = document.getElementById('billNatureInput');
      this.billNatureBtns = document.querySelectorAll('.bill-nature-btn');
      this.billLateFeeInput = document.getElementById('billLateFeeInput');

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
      this.expenseNatureInput = document.getElementById('expenseNatureInput');
      this.expenseNatureBtns = document.querySelectorAll('.expense-nature-btn');
      this.expenseBudgetPreview = document.getElementById('expenseBudgetPreview');

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
      this.planSavedAmountLabel = document.getElementById('planSavedAmountLabel');
      this.planSavedAmountInput = document.getElementById('planSavedAmountInput');
      this.planDownPaymentSourceBox = document.getElementById('planDownPaymentSourceBox');
      this.planDownPaymentSourceInput = document.getElementById('planDownPaymentSourceInput');
      this.planDownPaymentSourceBtns = document.querySelectorAll('.plan-entry-source-btn');
      this.planDownPaymentSourceHint = document.getElementById('planDownPaymentSourceHint');
      this.planFirstInstallmentOffsetSelect = document.getElementById('planFirstInstallmentOffsetSelect');
      this.planEntryPercentBtns = document.querySelectorAll('[data-plan-entry-pct]');
      this.planInstallmentFields = document.getElementById('planInstallmentFields');
      this.planInstallmentsSelect = document.getElementById('planInstallmentsSelect');
      this.planPaymentMethodSelect = document.getElementById('planPaymentMethodSelect');
      this.planFinancingFields = document.getElementById('planFinancingFields');
      this.planFinancingCalcByInput = document.getElementById('planFinancingCalcByInput');
      this.planFinancingCalcBtns = document.querySelectorAll('.plan-fin-calc-btn');
      this.planFinancingMonthsInput = document.getElementById('planFinancingMonthsInput');
      this.planFinancingMonthPresetBtns = document.querySelectorAll('[data-plan-fin-months]');
      this.planFinancingDueDayInput = document.getElementById('planFinancingDueDayInput');
      this.planFinancingRateFields = document.getElementById('planFinancingRateFields');
      this.planInterestRateInput = document.getElementById('planInterestRateInput');
      this.planInterestRateUnitSelect = document.getElementById('planInterestRateUnitSelect');
      this.planAmortizationSelect = document.getElementById('planAmortizationSelect');
      this.planFinancingInstallmentFields = document.getElementById('planFinancingInstallmentFields');
      this.planFinancingInstallmentInput = document.getElementById('planFinancingInstallmentInput');
      this.planSaveFields = document.getElementById('planSaveFields');
      this.planMonthlyContributionInput = document.getElementById('planMonthlyContributionInput');
      this.planPresetMonthBtns = document.querySelectorAll('[data-plan-preset-months]');
      this.planUseFreeBalanceBtn = document.getElementById('planUseFreeBalanceBtn');
      this.planSimulationPreview = document.getElementById('planSimulationPreview');
      this.planningSubmitBtn = document.getElementById('planningSubmitBtn');
      this.plansCountBadge = document.getElementById('plansCountBadge');
      this.plansListContainer = document.getElementById('plansListContainer');
      this.planReserveAssistBox = document.getElementById('planReserveAssistBox');
      this.planReserveSourceSelect = document.getElementById('planReserveSourceSelect');
      this.planApplyReserveBtn = document.getElementById('planApplyReserveBtn');

      // Caixinhas e Reservas (Dinheiro Guardado)
      this.topTotalReserves = document.getElementById('topTotalReserves');
      this.topReservesMetaText = document.getElementById('topReservesMetaText');
      this.topMonthReservedBadge = document.getElementById('topMonthReservedBadge');
      this.sidebarTotalReserves = document.getElementById('sidebarTotalReserves');
      this.reservesBreakdownList = document.getElementById('reservesBreakdownList');

      this.reservesModal = document.getElementById('reservesModal');
      this.reservesModalBody = document.getElementById('reservesModalBody');
      this.reservesModalTotal = document.getElementById('reservesModalTotal');
      this.reserveTabBtns = document.querySelectorAll('.reserve-tab-btn');
      this.reserveMovePanel = document.getElementById('reserveMovePanel');
      this.reserveManagePanel = document.getElementById('reserveManagePanel');

      this.reserveMoveForm = document.getElementById('reserveMoveForm');
      this.reserveOpTypeInput = document.getElementById('reserveOpTypeInput');
      this.reserveOpBtns = document.querySelectorAll('.reserve-op-btn');
      this.reserveMoveSelect = document.getElementById('reserveMoveSelect');
      this.reserveMoveSelectedBalance = document.getElementById('reserveMoveSelectedBalance');
      this.reserveMoveAmountInput = document.getElementById('reserveMoveAmountInput');
      this.reserveMoveDateInput = document.getElementById('reserveMoveDateInput');
      this.reserveMoveNoteInput = document.getElementById('reserveMoveNoteInput');
      this.reserveMoveAffectMonthCheckbox = document.getElementById('reserveMoveAffectMonthCheckbox');
      this.reserveMoveAffectMonthLabel = document.getElementById('reserveMoveAffectMonthLabel');
      this.reserveMoveAffectMonthHint = document.getElementById('reserveMoveAffectMonthHint');
      this.reserveMoveSubmitBtn = document.getElementById('reserveMoveSubmitBtn');

      this.reserveForm = document.getElementById('reserveForm');
      this.reserveFormTitle = document.getElementById('reserveFormTitle');
      this.reserveEditId = document.getElementById('reserveEditId');
      this.cancelReserveEditBtn = document.getElementById('cancelReserveEditBtn');
      this.reserveTitleInput = document.getElementById('reserveTitleInput');
      this.reserveTypeSelect = document.getElementById('reserveTypeSelect');
      this.reserveBalanceInput = document.getElementById('reserveBalanceInput');
      this.reserveBalanceHint = document.getElementById('reserveBalanceHint');
      this.reserveGoalInput = document.getElementById('reserveGoalInput');
      this.reserveSubmitBtn = document.getElementById('reserveSubmitBtn');
      this.reservesCountBadge = document.getElementById('reservesCountBadge');
      this.reservesListContainer = document.getElementById('reservesListContainer');
      this.reservesEmergencyBanner = document.getElementById('reservesEmergencyBanner');

      // Planejamento - Prioridade
      this.planPriorityInput = document.getElementById('planPriorityInput');
      this.planPriorityBtns = document.querySelectorAll('.plan-priority-btn');
      this.plansPriorityInsight = document.getElementById('plansPriorityInsight');

      // Painel Saúde Financeira (7 Pilares)
      this.financialHealthPanel = document.getElementById('financialHealthPanel');
      this.healthScoreBadge = document.getElementById('healthScoreBadge');
      this.healthPanelSubtitle = document.getElementById('healthPanelSubtitle');
      this.openGoalsModalBtn = document.getElementById('openGoalsModalBtn');
      this.openAnnualModalBtn = document.getElementById('openAnnualModalBtn');
      this.openDebtsModalBtn = document.getElementById('openDebtsModalBtn');
      this.healthDebtsCountBadge = document.getElementById('healthDebtsCountBadge');
      this.healthFixedPctBadge = document.getElementById('healthFixedPctBadge');
      this.healthLivingCostValue = document.getElementById('healthLivingCostValue');
      this.healthLivingCostSub = document.getElementById('healthLivingCostSub');
      this.healthNatureRatioText = document.getElementById('healthNatureRatioText');
      this.healthEssentialBar = document.getElementById('healthEssentialBar');
      this.healthSuperfluousBar = document.getElementById('healthSuperfluousBar');
      this.healthSaveGoalPctBadge = document.getElementById('healthSaveGoalPctBadge');
      this.healthSaveGoalValue = document.getElementById('healthSaveGoalValue');
      this.healthSaveGoalSub = document.getElementById('healthSaveGoalSub');
      this.healthSaveGoalBar = document.getElementById('healthSaveGoalBar');
      this.healthEmergencyPctBadge = document.getElementById('healthEmergencyPctBadge');
      this.healthEmergencyValue = document.getElementById('healthEmergencyValue');
      this.healthEmergencySub = document.getElementById('healthEmergencySub');
      this.healthEmergencyBar = document.getElementById('healthEmergencyBar');
      this.healthDebtStatusBadge = document.getElementById('healthDebtStatusBadge');
      this.healthAnnualValue = document.getElementById('healthAnnualValue');
      this.healthAnnualSub = document.getElementById('healthAnnualSub');
      this.healthDebtSub = document.getElementById('healthDebtSub');

      // Modal Metas & Emergência
      this.goalsModal = document.getElementById('goalsModal');
      this.goalsForm = document.getElementById('goalsForm');
      this.goalSaveModeInput = document.getElementById('goalSaveModeInput');
      this.goalModeBtns = document.querySelectorAll('.goal-mode-btn');
      this.goalSavePercentWrap = document.getElementById('goalSavePercentWrap');
      this.goalSaveFixedWrap = document.getElementById('goalSaveFixedWrap');
      this.goalSavePercentInput = document.getElementById('goalSavePercentInput');
      this.goalSaveValueInput = document.getElementById('goalSaveValueInput');
      this.goalPctPresetBtns = document.querySelectorAll('[data-goal-pct]');
      this.goalSaveLivePreview = document.getElementById('goalSaveLivePreview');
      this.goalEmergencyMonthsInput = document.getElementById('goalEmergencyMonthsInput');
      this.goalMonthsBtns = document.querySelectorAll('.goal-months-btn');
      this.goalEmergencyPreview = document.getElementById('goalEmergencyPreview');

      // Modal Despesas Anuais
      this.annualExpensesModal = document.getElementById('annualExpensesModal');
      this.annualSummaryBanner = document.getElementById('annualSummaryBanner');
      this.annualExpenseForm = document.getElementById('annualExpenseForm');
      this.annualEditId = document.getElementById('annualEditId');
      this.annualTitleInput = document.getElementById('annualTitleInput');
      this.annualCategorySelect = document.getElementById('annualCategorySelect');
      this.annualAmountInput = document.getElementById('annualAmountInput');
      this.annualDueMonthSelect = document.getElementById('annualDueMonthSelect');
      this.annualReserveSelect = document.getElementById('annualReserveSelect');
      this.annualCancelEditBtn = document.getElementById('annualCancelEditBtn');
      this.annualSubmitBtn = document.getElementById('annualSubmitBtn');
      this.annualPresetBtns = document.querySelectorAll('[data-annual-preset]');
      this.annualExpensesListContainer = document.getElementById('annualExpensesListContainer');

      // Modal Dívidas & Quitação
      this.debtsModal = document.getElementById('debtsModal');
      this.debtsSummaryBanner = document.getElementById('debtsSummaryBanner');
      this.debtStrategyInput = document.getElementById('debtStrategyInput');
      this.debtStrategyBtns = document.querySelectorAll('.debt-strategy-btn');
      this.debtExtraMonthlyInput = document.getElementById('debtExtraMonthlyInput');
      this.debtStrategyProjection = document.getElementById('debtStrategyProjection');
      this.debtForm = document.getElementById('debtForm');
      this.debtEditId = document.getElementById('debtEditId');
      this.debtTitleInput = document.getElementById('debtTitleInput');
      this.debtCreditorInput = document.getElementById('debtCreditorInput');
      this.debtBalanceInput = document.getElementById('debtBalanceInput');
      this.debtMonthlyPaymentInput = document.getElementById('debtMonthlyPaymentInput');
      this.debtInterestInput = document.getElementById('debtInterestInput');
      this.debtCancelEditBtn = document.getElementById('debtCancelEditBtn');
      this.debtSubmitBtn = document.getElementById('debtSubmitBtn');
      this.debtsListContainer = document.getElementById('debtsListContainer');
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
        if (this.billLateFeeInput) this.billLateFeeInput.value = '0,00';
        this.billDueDateInput.value = `${this.state.currentPeriod}-10`;
        this.billNatureManuallyToggled = false;
        this.setBillNature(this.getDefaultNatureForCategory(this.billCategorySelect?.value || 'Moradia'));
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
        this.expenseNatureManuallyToggled = false;
        this.setExpenseNature(this.getDefaultNatureForCategory(this.expenseCategorySelect?.value || 'Alimentação'));
        this.updateExpenseBudgetPreview();
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

      // Caixinhas e Reservas Modal
      const openReserves = () => this.openReservesModal();
      document.getElementById('openReservesHeaderBtn')?.addEventListener('click', openReserves);
      document.getElementById('openReservesStripBtn')?.addEventListener('click', openReserves);
      document.getElementById('openReservesModalBtn')?.addEventListener('click', openReserves);

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
          [
            this.incomeModal,
            this.billModal,
            this.expenseModal,
            this.budgetModal,
            this.alertModal,
            this.planningModal,
            this.reservesModal,
            this.goalsModal,
            this.annualExpensesModal,
            this.debtsModal
          ].forEach(m => {
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

      // Controles de Reservas / Caixinhas
      this.reserveTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setReserveTab(btn.getAttribute('data-reserve-tab') || 'move');
        });
      });
      this.reserveOpBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setReserveOp(btn.getAttribute('data-reserve-op') || 'deposit');
        });
      });
      this.reserveMoveSelect?.addEventListener('change', () => this.updateSelectedReserveBalanceDisplay());
      this.reserveMoveForm?.addEventListener('submit', (e) => this.handleReserveMoveSubmit(e));
      this.reserveForm?.addEventListener('submit', (e) => this.handleReserveSubmit(e));
      this.cancelReserveEditBtn?.addEventListener('click', () => this.resetReserveForm());

      // Integração Planejamento <- Caixinhas
      this.planApplyReserveBtn?.addEventListener('click', () => this.applyReserveToPlan());

      // Controles dinâmicos do Simulador de Planejamento
      this.planModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setPlanMode(btn.getAttribute('data-plan-mode') || 'installment');
        });
      });

      this.planDownPaymentSourceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setPlanDownPaymentSource(btn.getAttribute('data-plan-entry-source') || 'saved');
        });
      });

      this.planEntryPercentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const pct = parseFloat(btn.getAttribute('data-plan-entry-pct'));
          this.applyPlanDownPaymentPercent(pct);
        });
      });

      this.planFinancingCalcBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setPlanFinancingCalcBy(btn.getAttribute('data-plan-fin-calc') || 'rate');
        });
      });

      this.planFinancingMonthPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const months = parseInt(btn.getAttribute('data-plan-fin-months'), 10);
          if (this.planFinancingMonthsInput && Number.isFinite(months) && months > 0) {
            this.planFinancingMonthsInput.value = String(months);
            this.updatePlanSimulationPreview();
          }
        });
      });

      [
        this.planTitleInput,
        this.planCategorySelect,
        this.planTargetAmountInput,
        this.planSavedAmountInput,
        this.planFirstInstallmentOffsetSelect,
        this.planInstallmentsSelect,
        this.planPaymentMethodSelect,
        this.planFinancingMonthsInput,
        this.planFinancingDueDayInput,
        this.planInterestRateInput,
        this.planInterestRateUnitSelect,
        this.planAmortizationSelect,
        this.planFinancingInstallmentInput,
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

      this.expenseNatureFilterSelect?.addEventListener('change', (e) => {
        this.expenseNatureFilter = e.target.value || 'all';
        this.renderExpenses();
      });

      // Classificação Essencial / Supérfluo & Alerta de Teto no Gasto
      this.billNatureBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.billNatureManuallyToggled = true;
          this.setBillNature(btn.getAttribute('data-bill-nature') || 'essential');
        });
      });
      this.billCategorySelect?.addEventListener('change', () => {
        if (!this.billEditId?.value && !this.billNatureManuallyToggled) {
          this.setBillNature(this.getDefaultNatureForCategory(this.billCategorySelect.value));
        }
      });

      this.expenseNatureBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.expenseNatureManuallyToggled = true;
          this.setExpenseNature(btn.getAttribute('data-expense-nature') || 'essential');
        });
      });
      this.expenseCategorySelect?.addEventListener('change', () => {
        if (!this.expenseEditId?.value && !this.expenseNatureManuallyToggled) {
          this.setExpenseNature(this.getDefaultNatureForCategory(this.expenseCategorySelect.value));
        }
        this.updateExpenseBudgetPreview();
      });
      [
        this.expenseAmountInput,
        this.expenseDateInput,
        this.expenseIsInstallmentCheckbox,
        this.expenseInstallmentCount
      ].forEach(el => {
        el?.addEventListener('input', () => this.updateExpenseBudgetPreview());
        el?.addEventListener('change', () => this.updateExpenseBudgetPreview());
      });
      this.expenseForm?.querySelectorAll('input[name="installmentAmountType"]').forEach(radio => {
        radio.addEventListener('change', () => this.updateExpenseBudgetPreview());
      });

      // Separação Automática de Renda ("Pague-se Primeiro")
      this.incomeAutoReserveCheck?.addEventListener('change', () => this.updateIncomeAutoReserveUI());
      [this.incomeInput, this.incomeAutoReservePercentInput].forEach(el => {
        el?.addEventListener('input', () => this.updateIncomeAutoReserveUI());
      });

      // Presets de Orçamento (% da Renda)
      this.budgetPresetBalancedBtn?.addEventListener('click', () => this.applyBalancedBudgetPresets());
      this.budgetClearAllBtn?.addEventListener('click', () => this.clearBudgetModalInputs());

      // Prioridade no Planejamento de Compras
      this.planPriorityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setPlanPriority(btn.getAttribute('data-plan-priority') || 'important');
        });
      });

      // Painel Saúde Financeira: Metas, Despesas Anuais & Dívidas
      this.openGoalsModalBtn?.addEventListener('click', () => this.openGoalsModal());
      this.goalsForm?.addEventListener('submit', (e) => this.handleGoalsSubmit(e));
      this.goalModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setGoalSaveMode(btn.getAttribute('data-goal-mode') || 'percent');
        });
      });
      this.goalPctPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setGoalSaveMode('percent');
          if (this.goalSavePercentInput) {
            this.goalSavePercentInput.value = btn.getAttribute('data-goal-pct') || '20';
          }
          this.updateGoalsModalPreviews();
        });
      });
      this.goalMonthsBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setGoalEmergencyMonths(parseInt(btn.getAttribute('data-emergency-months') || '6', 10));
        });
      });
      [this.goalSavePercentInput, this.goalSaveValueInput].forEach(el => {
        el?.addEventListener('input', () => this.updateGoalsModalPreviews());
      });

      this.openAnnualModalBtn?.addEventListener('click', () => this.openAnnualExpensesModal());
      this.annualExpenseForm?.addEventListener('submit', (e) => this.handleAnnualExpenseSubmit(e));
      this.annualCancelEditBtn?.addEventListener('click', () => this.resetAnnualExpenseForm());
      this.annualPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.annualTitleInput) this.annualTitleInput.value = btn.getAttribute('data-annual-preset') || '';
          if (this.annualCategorySelect) this.annualCategorySelect.value = btn.getAttribute('data-annual-cat') || 'Outros';
          if (this.annualDueMonthSelect) this.annualDueMonthSelect.value = btn.getAttribute('data-annual-month') || '1';
          this.annualAmountInput?.focus();
        });
      });

      this.openDebtsModalBtn?.addEventListener('click', () => this.openDebtsModal());
      this.debtForm?.addEventListener('submit', (e) => this.handleDebtSubmit(e));
      this.debtCancelEditBtn?.addEventListener('click', () => this.resetDebtForm());
      this.debtStrategyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const strategy = btn.getAttribute('data-debt-strategy') === 'snowball' ? 'snowball' : 'avalanche';
          this.state.debtStrategy = strategy;
          Storage.save(this.state);
          this.setDebtStrategyUI(strategy);
          this.renderDebtsModal();
        });
      });
      this.debtExtraMonthlyInput?.addEventListener('input', () => this.renderDebtStrategyProjection());

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
      const hasRegularCurrentBills = currentBills.some(b => !b.financingPlanId);

      const prevPeriod = Utils.shiftPeriod(currentPeriod, -1);
      const prevBills = this.state.bills.filter(b => b.dueDate.startsWith(prevPeriod));
      const existingFinancingPlanIds = new Set(currentBills.map(b => b.financingPlanId).filter(Boolean));
      const eligiblePrevBills = prevBills.filter(b => !b.financingPlanId || !existingFinancingPlanIds.has(b.financingPlanId));

      // Se o mês atual não tem contas fixas regulares (apenas eventuais financiamentos pré-agendados) e o mês anterior tem contas elegíveis
      if (!hasRegularCurrentBills && eligiblePrevBills.length > 0) {
        if (this.recurrentBillsBanner) {
          const prevMonthName = Utils.formatPeriod(prevPeriod);
          this.recurrentBillsBannerText.textContent = `Você tem ${eligiblePrevBills.length} contas em ${prevMonthName}. Deseja copiá-las com status pendente?`;
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
          // Exibe botão no cabeçalho se houver contas elegíveis no mês anterior
          if (eligiblePrevBills.length > 0) {
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

      const currentBills = this.state.bills.filter(b => b.dueDate.startsWith(currentPeriod));
      const existingFinancingPlanIds = new Set(currentBills.map(b => b.financingPlanId).filter(Boolean));
      const billsToCopy = prevBills.filter(b => !b.financingPlanId || !existingFinancingPlanIds.has(b.financingPlanId));

      if (billsToCopy.length === 0) {
        Toast.show('As parcelas de financiamento do mês anterior já estão lançadas neste mês.', 'info');
        return;
      }

      const confirmed = await ConfirmDialog.open({
        title: 'Replicar Contas Fixas',
        message: `Deseja copiar ${billsToCopy.length} contas de ${Utils.formatPeriod(prevPeriod)} para ${Utils.formatPeriod(currentPeriod)}? Elas serão criadas como Pendentes.`,
        confirmText: 'Copiar Contas',
        variant: 'primary',
        icon: 'fa-copy'
      });

      if (!confirmed) return;

      let skippedFinishedFinancing = 0;
      const newBills = [];
      billsToCopy.forEach(bill => {
        // Mantém o dia original de vencimento ajustando com segurança para o novo período
        const dayPart = bill.dueDate.split('-')[2] || '10';
        const nextDueDate = Utils.shiftDateToPeriod(`${prevPeriod}-${dayPart}`, currentPeriod) || `${currentPeriod}-${dayPart}`;
        const totalFin = parseInt(bill.financingTotalInstallments, 10) || 0;
        const currFin = parseInt(bill.financingCurrentInstallment, 10) || 0;

        if (totalFin > 0 && currFin > 0) {
          if (currFin >= totalFin) {
            skippedFinishedFinancing++;
            return;
          }
          const nextInst = currFin + 1;
          const updatedTitle = bill.title.replace(/\(Financ\.\s*\d+\/\d+\)/, `(Financ. ${nextInst}/${totalFin})`);
          newBills.push({
            id: Utils.generateUUID(),
            title: updatedTitle !== bill.title ? updatedTitle : `${bill.title} (${nextInst}/${totalFin})`,
            amount: bill.amount,
            dueDate: nextDueDate,
            category: bill.category,
            nature: this.getItemNature(bill),
            paid: false,
            ...(bill.financingPlanId ? { financingPlanId: bill.financingPlanId } : {}),
            financingCurrentInstallment: nextInst,
            financingTotalInstallments: totalFin,
            createdAt: new Date().toISOString()
          });
          return;
        }

        newBills.push({
          id: Utils.generateUUID(),
          title: bill.title,
          amount: bill.amount,
          dueDate: nextDueDate,
          category: bill.category,
          nature: this.getItemNature(bill),
          paid: false,
          createdAt: new Date().toISOString()
        });
      });

      if (newBills.length === 0 && skippedFinishedFinancing > 0) {
        Toast.show('Os financiamentos do mês anterior já chegaram à parcela final.', 'info');
        return;
      }

      this.state.bills.push(...newBills);
      Storage.save(this.state);
      this.render();
      Toast.show(
        skippedFinishedFinancing > 0
          ? `${newBills.length} conta(s) replicada(s) (${skippedFinishedFinancing} financiamento encerrado não copiado).`
          : `${newBills.length} contas replicadas com sucesso para este mês!`,
        'success'
      );
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
      if (this.billLateFeeInput) {
        this.billLateFeeInput.value = Utils.formatNumberToInput(bill.lateFee || 0);
      }
      this.billDueDateInput.value = bill.dueDate;
      this.billCategorySelect.value = bill.category || 'Moradia';
      this.billNatureManuallyToggled = true;
      this.setBillNature(this.getItemNature(bill));

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
      this.expenseNatureManuallyToggled = true;
      this.setExpenseNature(this.getItemNature(expense));

      if (this.expenseInstallmentContainer) {
        this.expenseInstallmentContainer.classList.add('hidden');
      }

      this.updateExpenseBudgetPreview();
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
      if (this.incomeAutoReserveBox) this.incomeAutoReserveBox.classList.remove('hidden');
      if (this.incomeAutoReserveCheck) this.incomeAutoReserveCheck.checked = false;
      const goals = this.state?.financeGoals || { saveGoalMode: 'percent', saveGoalValue: 20 };
      const defaultPct = goals.saveGoalMode === 'percent' && goals.saveGoalValue > 0 ? goals.saveGoalValue : 10;
      if (this.incomeAutoReservePercentInput) this.incomeAutoReservePercentInput.value = String(defaultPct);
      this.populateIncomeAutoReserveSelect();
      this.updateIncomeAutoReserveUI();
    },

    openEditIncomeModal(incomeId) {
      const entry = (this.state.incomeEntries || []).find(item => item.id === incomeId);
      if (!entry) return;

      if (this.incomeEditId) this.incomeEditId.value = entry.id;
      if (this.incomeTitleInput) this.incomeTitleInput.value = entry.title;
      if (this.incomeTypeSelect) this.incomeTypeSelect.value = INCOME_TYPE_META[entry.type] ? entry.type : 'Outros';
      if (this.incomeInput) this.incomeInput.value = Utils.formatNumberToInput(entry.amount);
      if (this.incomeDateInput) this.incomeDateInput.value = entry.date || '';
      if (this.incomeAutoReserveCheck) this.incomeAutoReserveCheck.checked = false;
      if (this.incomeAutoReserveBox) this.incomeAutoReserveBox.classList.add('hidden');

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

      let autoReservedMsg = '';
      if (!editId && this.incomeAutoReserveCheck?.checked) {
        const pct = Math.min(90, Math.max(0, Utils.parsePercent(this.incomeAutoReservePercentInput?.value || '0')));
        const saveAmount = Math.round((amount * (pct / 100)) * 100) / 100;
        if (saveAmount > 0) {
          const targetId = this.incomeAutoReserveTargetSelect?.value || '__create_emergency__';
          const moveDate = date || `${targetPeriod}-05`;
          const resObj = this.depositToReserve(
            targetId,
            saveAmount,
            moveDate,
            `Pague-se Primeiro (${pct}% de ${title})`,
            true
          );
          if (resObj) {
            autoReservedMsg = ` • ${Utils.formatCurrency(saveAmount)} separado(s) em "${resObj.title}"`;
          }
        }
      }

      Storage.save(this.state);
      this.resetIncomeForm();
      this.render();
      this.renderIncomeModal();

      if (targetPeriod !== this.state.currentPeriod) {
        Toast.show(`Renda "${title}" salva em ${Utils.formatPeriod(targetPeriod)}${autoReservedMsg}!`, 'success');
      } else {
        Toast.show(`Renda "${title}" ${editId ? 'atualizada' : 'adicionada'} com sucesso${autoReservedMsg}!`, 'success');
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
        message: `Deseja copiar ${prevIncomes.length} fonte(s) de renda de ${Utils.formatPeriod(prevPeriod)} para ${Utils.formatPeriod(currentPeriod)}?`,
        confirmText: 'Copiar Rendas',
        variant: 'primary',
        icon: 'fa-copy'
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
      const lateFee = Math.max(0, Math.round(Utils.parseCurrency(this.billLateFeeInput?.value || '0') * 100) / 100);
      const dueDate = this.billDueDateInput.value;
      const category = this.billCategorySelect.value;
      const rawNature = this.billNatureInput?.value;
      const nature = (rawNature === 'essential' || rawNature === 'superfluous')
        ? rawNature
        : this.getDefaultNatureForCategory(category);
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
          const updatedBill = {
            ...this.state.bills[billIndex],
            title,
            amount,
            dueDate,
            category,
            nature,
            paid: isPaid,
            updatedAt: new Date().toISOString()
          };
          if (lateFee > 0) {
            updatedBill.lateFee = lateFee;
          } else {
            delete updatedBill.lateFee;
          }
          this.state.bills[billIndex] = updatedBill;
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
          nature,
          ...(lateFee > 0 ? { lateFee } : {}),
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

    buildInstallmentExpenses({ description, amount, amountType = 'total', count, startDateISO, category, method, nature = null }) {
      const safeCount = Math.max(1, parseInt(count, 10) || 1);
      const baseAmount = Math.round((Number(amount) || 0) * 100) / 100;
      const resolvedNature = (nature === 'essential' || nature === 'superfluous')
        ? nature
        : this.getDefaultNatureForCategory(category);

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
          nature: resolvedNature,
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
      const rawNature = this.expenseNatureInput?.value;
      const nature = (rawNature === 'essential' || rawNature === 'superfluous')
        ? rawNature
        : this.getDefaultNatureForCategory(category);

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
            nature,
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
          method,
          nature
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
          nature,
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
        const reserveFlow = this.getPeriodReserveFlow(period);
        const totalReserves = this.getTotalReservesBalance();
        const balance = income - billsTotal - expensesTotal - reserveFlow.netSavedInMonth;

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
        csv += `Guardado / Resgatado Líquido no Mês;${Utils.formatCurrency(reserveFlow.netSavedInMonth)}\r\n`;
        csv += `Saldo Líquido Restante;${Utils.formatCurrency(balance)}\r\n`;
        csv += `Patrimônio Total em Reservas;${Utils.formatCurrency(totalReserves)}\r\n\r\n`;

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
        csv += '\r\n';

        // Tabela de Reservas e Caixinhas
        const reserves = this.state.reserves || [];
        csv += 'RESERVAS E CAIXINHAS (DINHEIRO GUARDADO)\r\n';
        csv += 'Caixinha;Tipo;Saldo Atual (R$);Meta (R$);Progresso\r\n';
        if (reserves.length === 0) {
          csv += 'Nenhuma caixinha cadastrada;;;;\r\n';
        } else {
          reserves.forEach(r => {
            const bal = (r.balance || 0).toFixed(2).replace('.', ',');
            const goal = (r.goalAmount || 0).toFixed(2).replace('.', ',');
            const prog = r.goalAmount > 0 ? `${Math.min(100, Math.round((r.balance / r.goalAmount) * 100))}%` : 'Sem meta';
            csv += `"${r.title.replace(/"/g, '""')}";"${r.type}";${bal};${goal};"${prog}"\r\n`;
          });
        }
        csv += '\r\n';

        // Movimentações de Reservas no Mês
        const monthMovements = [];
        reserves.forEach(r => {
          (r.movements || []).forEach(mov => {
            if ((mov.date || '').startsWith(period)) {
              monthMovements.push({ reserveTitle: r.title, ...mov });
            }
          });
        });
        csv += 'MOVIMENTAÇÕES DE RESERVAS NO MÊS\r\n';
        csv += 'Data;Caixinha;Operação;Impacta Saldo do Mês;Valor (R$);Observação\r\n';
        if (monthMovements.length === 0) {
          csv += 'Nenhuma movimentação de reserva neste mês;;;;;\r\n';
        } else {
          const OP_LABELS = { initial: 'Saldo inicial', deposit: 'Aporte', withdraw: 'Resgate' };
          monthMovements.forEach(mov => {
            const valor = (mov.amount || 0).toFixed(2).replace('.', ',');
            const opLabel = OP_LABELS[mov.type] || mov.type;
            const impactLabel = mov.affectMonthBalance ? 'Sim' : 'Não';
            const note = (mov.note || '').replace(/"/g, '""');
            csv += `"${Utils.formatDate(mov.date)}";"${mov.reserveTitle.replace(/"/g, '""')}";"${opLabel}";"${impactLabel}";${valor};"${note}"\r\n`;
          });
        }

        csv += '\r\n';

        // Resumo dos 7 Pilares & Despesas Anuais
        const livingMetrics = this.getLivingCostMetrics(period);
        const emergencyMetrics = this.getEmergencyReserveMetrics(period);
        const annualMetrics = this.getAnnualExpensesMetrics();
        csv += 'SAÚDE FINANCEIRA E PROVISÕES ANUAIS\r\n';
        csv += `Custo de Vida Fixo;${Utils.formatCurrency(livingMetrics.livingCost)}\r\n`;
        csv += `Reserva de Emergência;${Utils.formatCurrency(emergencyMetrics.emergencyBalance)} (${emergencyMetrics.monthsCovered} meses de ${emergencyMetrics.targetMonths} meses)\r\n`;
        csv += `Provisão Anual Mensal (/12);${Utils.formatCurrency(annualMetrics.monthlyProvision)}\r\n\r\n`;

        csv += 'DESPESAS ANUAIS CADASTRADAS\r\n';
        csv += 'Descrição;Categoria;Mês Vencimento;Valor Anual (R$);Provisão Mensal (R$)\r\n';
        if (annualMetrics.items.length === 0) {
          csv += 'Nenhuma despesa anual cadastrada;;;;\r\n';
        } else {
          annualMetrics.items.forEach(item => {
            const anualStr = item.amount.toFixed(2).replace('.', ',');
            const provStr = (item.amount / 12).toFixed(2).replace('.', ',');
            csv += `"${item.title.replace(/"/g, '""')}";"${item.category}";"${MONTH_NAMES_PT[(item.dueMonth || 1) - 1]}";${anualStr};${provStr}\r\n`;
          });
        }
        csv += '\r\n';

        // Dívidas Ativas
        const activeDebts = (this.state.debts || []).filter(d => !d.paidOff && d.totalBalance > 0);
        csv += 'PAINEL DE DÍVIDAS ATIVAS\r\n';
        csv += 'Descrição;Credor;Saldo Devedor (R$);Parcela Mensal (R$);Juros (% a.m.)\r\n';
        if (activeDebts.length === 0) {
          csv += 'Nenhuma dívida ativa;;;;\r\n';
        } else {
          activeDebts.forEach(d => {
            const balStr = d.totalBalance.toFixed(2).replace('.', ',');
            const pmtStr = d.monthlyPayment.toFixed(2).replace('.', ',');
            const rateStr = d.interestRatePct.toFixed(2).replace('.', ',');
            csv += `"${d.title.replace(/"/g, '""')}";"${(d.creditor || '').replace(/"/g, '""')}";${balStr};${pmtStr};${rateStr}\r\n`;
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
            message: 'A importação deste arquivo substituirá todos os lançamentos e configurações atuais. Deseja prosseguir?',
            confirmText: 'Substituir',
            variant: 'warning',
            icon: 'fa-file-import'
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
            budgets: Storage.normalizeBudgets(parsed.budgets),
            financeGoals: Storage.normalizeFinanceGoals(parsed.financeGoals),
            annualExpenses: Storage.normalizeAnnualExpenses(parsed.annualExpenses),
            debts: Storage.normalizeDebts(parsed.debts),
            debtStrategy: parsed.debtStrategy === 'snowball' ? 'snowball' : 'avalanche',
            alertSettings: Utils.normalizeAlertSettings(parsed.alertSettings),
            bills: (Array.isArray(parsed.bills) ? parsed.bills : []).map(b => Storage.normalizeBillRecord(b)).filter(Boolean),
            expenses: (Array.isArray(parsed.expenses) ? parsed.expenses : []).map(e => Storage.normalizeExpenseRecord(e)).filter(Boolean),
            plans: Storage.normalizePlans(parsed.plans),
            reserves: Storage.normalizeReserves(parsed.reserves)
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
      this.renderFinancialHealthPanel();
      this.checkPreviousMonthBills();
      this.renderBills();
      this.renderExpenses();
      this.renderChartsAndInsights();
      this.renderBudgets();
      this.renderReserves();
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
      const reserveFlow = this.getPeriodReserveFlow(period);

      const balance = Math.round((income - billsTotal - expensesTotal - reserveFlow.netSavedInMonth) * 100) / 100;

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
            if (reserveFlow.netSavedInMonth > 0) {
              this.kpiBalanceSubtitle.textContent = `Descontando ${Utils.formatCurrency(reserveFlow.netSavedInMonth)} guardados no mês`;
            } else if (reserveFlow.netSavedInMonth < 0) {
              this.kpiBalanceSubtitle.textContent = `Inclui ${Utils.formatCurrency(Math.abs(reserveFlow.netSavedInMonth))} resgatados de reservas`;
            } else {
              this.kpiBalanceSubtitle.textContent = 'Orçamento sob controle';
            }
          }
        } else {
          this.kpiBalance.className = 'text-2xl font-bold text-rose-400 tracking-tight';
          if (this.kpiBalanceIcon) {
            this.kpiBalanceIcon.className = 'w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs';
          }
          if (this.kpiBalanceSubtitle) {
            this.kpiBalanceSubtitle.textContent = reserveFlow.netSavedInMonth > 0
              ? 'Atenção: Despesas e reservas superam a renda'
              : 'Atenção: Despesas superam a renda';
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
      const reserveFlow = this.getPeriodReserveFlow(period);
      const balance = Math.round((income - billsTotal - expensesTotal - reserveFlow.netSavedInMonth) * 100) / 100;

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
      const projectedBalance = Math.round((income - billsTotal - projectedTotalExpenses - reserveFlow.netSavedInMonth) * 100) / 100;

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
    // RENDERIZAÇÃO DOS TETOS DE GASTOS (BUDGETING: R$ FIXO OU % DA RENDA)
    // ========================================================================
    getBudgetConfig(category, period = this.state.currentPeriod) {
      const raw = (this.state.budgets || {})[category];
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
        return { mode: 'fixed', value: raw, limit: Math.round(raw * 100) / 100 };
      }
      if (raw && typeof raw === 'object' && raw.mode === 'percent') {
        const pct = Number(raw.value);
        if (Number.isFinite(pct) && pct > 0) {
          const income = this.getCurrentIncome(period);
          const limit = Math.round((income * (pct / 100)) * 100) / 100;
          return { mode: 'percent', value: pct, limit };
        }
      }
      return { mode: 'fixed', value: 0, limit: 0 };
    },

    getCategoryBudgetLimit(category, period = this.state.currentPeriod) {
      return this.getBudgetConfig(category, period).limit;
    },

    updateExpenseBudgetPreview() {
      if (!this.expenseBudgetPreview) return;
      const cat = this.expenseCategorySelect?.value || 'Alimentação';
      const dateISO = this.expenseDateInput?.value || Utils.getTodayISO();
      const targetPeriod = /^\d{4}-\d{2}/.test(dateISO) ? dateISO.slice(0, 7) : this.state.currentPeriod;
      const cfg = this.getBudgetConfig(cat, targetPeriod);
      const limit = cfg.limit;

      if (limit <= 0) {
        this.expenseBudgetPreview.classList.add('hidden');
        this.expenseBudgetPreview.innerHTML = '';
        return;
      }

      const rawAmount = Utils.parseCurrency(this.expenseAmountInput?.value || '0');
      const editId = this.expenseEditId?.value || '';
      const isInstallment = !editId && Boolean(this.expenseIsInstallmentCheckbox?.checked);
      let addedImpact = rawAmount;
      if (isInstallment && rawAmount > 0) {
        const count = Math.max(1, parseInt(this.expenseInstallmentCount?.value || '2', 10));
        const instType = this.expenseForm?.querySelector('input[name="installmentAmountType"]:checked')?.value || 'per_installment';
        addedImpact = instType === 'total' ? (rawAmount / count) : rawAmount;
      }

      let existingOtherSpent = [
        ...this.state.expenses.filter(e => e.id !== editId && (e.date || '').startsWith(targetPeriod) && (e.category || 'Outros') === cat),
        ...this.state.bills.filter(b => (b.dueDate || '').startsWith(targetPeriod) && (b.category || 'Outros') === cat)
      ].reduce((sum, item) => sum + (item.amount || 0), 0);

      existingOtherSpent = Math.round(existingOtherSpent * 100) / 100;
      const projectedTotal = Math.round((existingOtherSpent + addedImpact) * 100) / 100;
      const pct = Math.round((projectedTotal / limit) * 100);
      const remainingBefore = Math.round((limit - existingOtherSpent) * 100) / 100;

      this.expenseBudgetPreview.classList.remove('hidden');
      if (pct >= 100) {
        this.expenseBudgetPreview.className = 'p-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 text-rose-200 text-[11px] flex items-center gap-2';
        this.expenseBudgetPreview.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation text-rose-400 flex-shrink-0"></i>
          <span>Teto de <strong>${Utils.escapeHTML(cat)}</strong> (${Utils.formatCurrency(limit)}): ficará em <strong>${Utils.formatCurrency(projectedTotal)}</strong> (${pct}% — acima em ${Utils.formatCurrency(projectedTotal - limit)}).</span>
        `;
      } else if (pct >= 80) {
        this.expenseBudgetPreview.className = 'p-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-200 text-[11px] flex items-center gap-2';
        this.expenseBudgetPreview.innerHTML = `
          <i class="fa-solid fa-bullseye text-amber-400 flex-shrink-0"></i>
          <span>Atenção no teto de <strong>${Utils.escapeHTML(cat)}</strong>: atingirá <strong>${pct}%</strong> (${Utils.formatCurrency(projectedTotal)} de ${Utils.formatCurrency(limit)}).</span>
        `;
      } else {
        this.expenseBudgetPreview.className = 'p-2.5 rounded-xl border border-slate-700/70 bg-slate-900/70 text-slate-300 text-[11px] flex items-center gap-2';
        this.expenseBudgetPreview.innerHTML = `
          <i class="fa-solid fa-circle-check text-emerald-400 flex-shrink-0"></i>
          <span>Saldo livre em <strong>${Utils.escapeHTML(cat)}</strong>: ${Utils.formatCurrency(Math.max(0, remainingBefore))} de ${Utils.formatCurrency(limit)} (ficará em ${pct}%).</span>
        `;
      }
    },

    renderBudgets() {
      if (!this.budgetBreakdownList) return;

      const period = this.state.currentPeriod;
      const periodExpenses = this.state.expenses.filter(e => e.date.startsWith(period));
      const budgets = this.state.budgets || {};

      const categoriesWithBudget = Object.keys(budgets).filter(cat => {
        const cfg = this.getBudgetConfig(cat, period);
        return cfg.value > 0;
      });

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
        const cfg = this.getBudgetConfig(cat, period);
        const limit = cfg.limit;
        const spent = spentByCategory[cat] || 0;
        const percent = limit > 0 ? Math.round((spent / limit) * 100) : (spent > 0 ? 100 : 0);
        const icon = CATEGORY_ICONS[cat] || 'fa-tags';
        const color = CATEGORY_COLORS[cat] || '#64748b';

        let statusClass = 'status-pill-paid';
        let statusText = `${percent}%`;
        let barColor = color;

        if (limit <= 0 && cfg.mode === 'percent') {
          statusClass = 'status-pill-soon';
          statusText = 'Sem renda no mês';
          barColor = '#64748b';
        } else if (percent >= 100) {
          statusClass = 'status-pill-overdue';
          statusText = `Estourado (+${Utils.formatCurrency(spent - limit)})`;
          barColor = '#f43f5e';
        } else if (percent >= 80) {
          statusClass = 'status-pill-soon';
          statusText = `Atenção (${percent}%)`;
          barColor = '#f59e0b';
        }

        const barWidth = Math.min(100, percent);
        const limitText = cfg.mode === 'percent'
          ? `${cfg.value}% (${Utils.formatCurrency(limit)})`
          : Utils.formatCurrency(limit);

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
              <span>Teto: ${limitText}</span>
            </div>

            <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" style="width: ${barWidth}%; background-color: ${barColor};"></div>
            </div>
          </div>
        `;
      });

      this.budgetBreakdownList.innerHTML = html;
    },

    buildBudgetRowControls(cat, mode, rawVal) {
      const icon = CATEGORY_ICONS[cat] || 'fa-tags';
      const color = CATEGORY_COLORS[cat] || '#64748b';
      const income = this.getCurrentIncome(this.state.currentPeriod);
      const isPercent = mode === 'percent';
      const displayVal = isPercent
        ? (rawVal > 0 ? String(rawVal) : '')
        : (rawVal > 0 ? Utils.formatNumberToInput(rawVal) : '0,00');
      const convertedBrl = isPercent && rawVal > 0
        ? `= ${Utils.formatCurrency(income * (rawVal / 100))}/mês`
        : '';

      return `
        <div class="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-xl" data-budget-row="${cat}">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0" style="background-color: ${color}20; color: ${color};">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div class="min-w-0">
              <label for="budget_${cat}" class="text-xs font-semibold text-slate-200 truncate cursor-pointer block">${Utils.escapeHTML(cat)}</label>
              <span class="budget-row-preview text-[10px] text-amber-300/90 block">${convertedBrl}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="inline-flex bg-slate-950 border border-slate-700 rounded-lg p-0.5 text-[10px] font-semibold">
              <button type="button" data-budget-mode-btn="${cat}" data-mode="fixed" class="px-2 py-1 rounded ${!isPercent ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'} transition-colors">R$</button>
              <button type="button" data-budget-mode-btn="${cat}" data-mode="percent" class="px-2 py-1 rounded ${isPercent ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'} transition-colors">%</button>
            </div>
            <input type="hidden" data-budget-mode-input="${cat}" value="${mode}" />
            <div class="relative w-32">
              <span class="budget-unit-prefix absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">${isPercent ? '%' : 'R$'}</span>
              <input type="text" id="budget_${cat}" data-category-budget="${cat}" inputmode="decimal" value="${displayVal}" placeholder="${isPercent ? '0' : '0,00'}" class="budget-input ${isPercent ? '' : 'money-input'} w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs font-semibold text-right focus:border-amber-500 transition-colors" />
            </div>
          </div>
        </div>
      `;
    },

    updateBudgetModalRowPreview(cat) {
      const row = this.budgetInputsContainer?.querySelector(`[data-budget-row="${cat}"]`);
      if (!row) return;
      const modeInput = row.querySelector(`[data-budget-mode-input="${cat}"]`);
      const valueInput = row.querySelector(`[data-category-budget="${cat}"]`);
      const previewEl = row.querySelector('.budget-row-preview');
      if (!modeInput || !valueInput || !previewEl) return;

      if (modeInput.value === 'percent') {
        const pct = Utils.parsePercent(valueInput.value || '0');
        const income = this.getCurrentIncome(this.state.currentPeriod);
        previewEl.textContent = pct > 0 ? `= ${Utils.formatCurrency(income * (pct / 100))}/mês` : '';
      } else {
        previewEl.textContent = '';
      }
    },

    setBudgetRowMode(cat, newMode) {
      const row = this.budgetInputsContainer?.querySelector(`[data-budget-row="${cat}"]`);
      if (!row) return;
      const modeInput = row.querySelector(`[data-budget-mode-input="${cat}"]`);
      const prefixEl = row.querySelector('.budget-unit-prefix');
      const valueInput = row.querySelector(`[data-category-budget="${cat}"]`);
      if (!modeInput || !valueInput) return;

      const normalized = newMode === 'percent' ? 'percent' : 'fixed';
      const oldMode = modeInput.value;
      if (oldMode !== normalized) {
        const income = this.getCurrentIncome(this.state.currentPeriod);
        if (normalized === 'percent') {
          const brl = Utils.parseCurrency(valueInput.value || '0');
          const pct = income > 0 && brl > 0 ? Math.min(100, Math.round((brl / income) * 1000) / 10) : 0;
          valueInput.value = pct > 0 ? String(pct) : '';
        } else {
          const pct = Utils.parsePercent(valueInput.value || '0');
          const brl = income > 0 && pct > 0 ? Math.round((income * (pct / 100)) * 100) / 100 : 0;
          valueInput.value = Utils.formatNumberToInput(brl);
        }
      }

      modeInput.value = normalized;
      if (prefixEl) prefixEl.textContent = normalized === 'percent' ? '%' : 'R$';
      valueInput.placeholder = normalized === 'percent' ? '0' : '0,00';

      row.querySelectorAll(`[data-budget-mode-btn="${cat}"]`).forEach(btn => {
        const active = btn.getAttribute('data-mode') === normalized;
        btn.classList.toggle('bg-amber-600', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('text-slate-400', !active);
      });
      this.updateBudgetModalRowPreview(cat);
    },

    applyBalancedBudgetPresets() {
      Object.entries(BALANCED_BUDGET_PRESET_PERCENTS).forEach(([cat, pct]) => {
        this.setBudgetRowMode(cat, 'percent');
        const input = this.budgetInputsContainer?.querySelector(`[data-category-budget="${cat}"]`);
        if (input) input.value = String(pct);
        this.updateBudgetModalRowPreview(cat);
      });
      Toast.show('Sugestão aplicada: Alimentação 15%, Transporte 10%, Lazer 10%, Compras 5%.', 'info', 3000);
    },

    clearBudgetModalInputs() {
      this.budgetInputsContainer?.querySelectorAll('[data-category-budget]').forEach(input => {
        const cat = input.getAttribute('data-category-budget');
        const modeInput = this.budgetInputsContainer?.querySelector(`[data-budget-mode-input="${cat}"]`);
        input.value = modeInput?.value === 'percent' ? '' : '0,00';
        this.updateBudgetModalRowPreview(cat);
      });
    },

    openBudgetModal() {
      if (!this.budgetInputsContainer) return;

      const categories = [
        'Alimentação', 'Transporte', 'Moradia', 'Lazer',
        'Saúde', 'Educação', 'Compras', 'Serviços', 'Assinaturas', 'Outros'
      ];

      let html = '';
      categories.forEach(cat => {
        const cfg = this.getBudgetConfig(cat, this.state.currentPeriod);
        html += this.buildBudgetRowControls(cat, cfg.mode, cfg.value);
      });

      this.budgetInputsContainer.innerHTML = html;

      this.budgetInputsContainer.querySelectorAll('[data-budget-mode-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.setBudgetRowMode(btn.getAttribute('data-budget-mode-btn'), btn.getAttribute('data-mode'));
        });
      });

      this.budgetInputsContainer.querySelectorAll('.budget-input').forEach(input => {
        const cat = input.getAttribute('data-category-budget');
        input.addEventListener('input', () => {
          const modeInput = this.budgetInputsContainer?.querySelector(`[data-budget-mode-input="${cat}"]`);
          if (modeInput?.value === 'fixed') {
            const digits = input.value.replace(/\D/g, '');
            const cents = parseInt(digits || '0', 10) || 0;
            input.value = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
          this.updateBudgetModalRowPreview(cat);
        });
      });

      this.openModal(this.budgetModal);
    },

    handleBudgetSubmit(e) {
      e.preventDefault();
      const inputs = this.budgetInputsContainer.querySelectorAll('[data-category-budget]');
      const updatedBudgets = {};

      inputs.forEach(input => {
        const cat = input.getAttribute('data-category-budget');
        const modeInput = this.budgetInputsContainer.querySelector(`[data-budget-mode-input="${cat}"]`);
        const mode = modeInput?.value === 'percent' ? 'percent' : 'fixed';
        if (mode === 'percent') {
          const pct = Math.min(100, Math.max(0, Utils.parsePercent(input.value)));
          if (pct > 0) {
            updatedBudgets[cat] = { mode: 'percent', value: Math.round(pct * 100) / 100 };
          }
        } else {
          const amount = Utils.parseCurrency(input.value);
          if (amount > 0) {
            updatedBudgets[cat] = amount;
          }
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
      const hasScheduledFutureOnly = isFuture && periodBillsList.length > 0 && periodBillsList.every(b => Boolean(b.financingPlanId));
      const usesRecurringBills = isFuture && (periodBillsList.length === 0 || hasScheduledFutureOnly);
      let refBillsList = periodBillsList;
      if (usesRecurringBills) {
        const scheduledPlanIds = new Set(periodBillsList.map(b => b.financingPlanId).filter(Boolean));
        const baseRecurring = this.state.bills.filter(b => (b.dueDate || '').startsWith(basePeriod) && (!b.financingPlanId || !scheduledPlanIds.has(b.financingPlanId)));
        refBillsList = [...baseRecurring, ...periodBillsList];
      }
      const bills = refBillsList.reduce((sum, b) => sum + (b.amount || 0), 0);

      const expenses = this.state.expenses
        .filter(e => (e.date || '').startsWith(period))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const reserveFlow = this.getPeriodReserveFlow(period);
      const totalCommitted = Math.round((bills + expenses + reserveFlow.netSavedInMonth) * 100) / 100;
      const balanceBefore = Math.round((income - totalCommitted) * 100) / 100;

      return {
        period,
        income: Math.round(income * 100) / 100,
        bills: Math.round(bills * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        reservedNet: reserveFlow.netSavedInMonth,
        totalCommitted,
        balanceBefore,
        usesRecurringBase: isFuture && (usesRecurringIncome || usesRecurringBills)
      };
    },

    getPlanCategoryUsage(category, period) {
      const budgetLimit = this.getCategoryBudgetLimit(category, period);
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

    getSpecialPeriodsSet() {
      const periods = new Set([this.state.currentPeriod]);
      (this.state.incomeEntries || []).forEach(entry => {
        const p = Utils.getIncomePeriod(entry);
        if (p) periods.add(p);
      });
      (this.state.bills || []).forEach(b => {
        if (typeof b.dueDate === 'string' && b.dueDate.length >= 7) periods.add(b.dueDate.slice(0, 7));
      });
      (this.state.expenses || []).forEach(e => {
        if (typeof e.date === 'string' && e.date.length >= 7) periods.add(e.date.slice(0, 7));
      });
      (this.state.reserves || []).forEach(r => {
        (r.movements || []).forEach(m => {
          if (typeof m.date === 'string' && m.date.length >= 7) periods.add(m.date.slice(0, 7));
        });
      });
      return periods;
    },

    getGenericFutureBaseline(basePeriod) {
      const recurringIncome = Math.round(this.getCurrentIncome(basePeriod) * 100) / 100;
      const recurringBills = Math.round(
        (this.state.bills || [])
          .filter(b => (b.dueDate || '').startsWith(basePeriod))
          .reduce((sum, b) => sum + (b.amount || 0), 0) * 100
      ) / 100;

      return {
        period: basePeriod,
        income: recurringIncome,
        bills: recurringBills,
        expenses: 0,
        reservedNet: 0,
        totalCommitted: recurringBills,
        balanceBefore: Math.round((recurringIncome - recurringBills) * 100) / 100,
        usesRecurringBase: true
      };
    },

    solveMonthlyRateFromPMT(principal, pmt, months) {
      if (principal <= 0 || months <= 0 || pmt <= 0) return 0;
      if ((pmt * months) <= principal + 0.005) return 0;
      if (months === 1) return Math.max(0, (pmt / principal) - 1);

      const calcPmt = (r) => {
        if (r === 0) return principal / months;
        return (principal * r) / (1 - Math.pow(1 + r, -months));
      };

      let low = 0;
      let high = 2.0;
      while (calcPmt(high) < pmt && high < 16) {
        high *= 2;
      }

      for (let iter = 0; iter < 60; iter++) {
        const mid = (low + high) / 2;
        if (calcPmt(mid) < pmt) {
          low = mid;
        } else {
          high = mid;
        }
      }
      return (low + high) / 2;
    },

    buildFinancingSchedule({
      principal,
      months,
      calcBy = 'rate',
      interestRate = 0,
      interestRateUnit = 'monthly',
      amortizationType = 'price',
      quotedPmt = 0
    }) {
      const safeMonths = Math.max(1, Math.min(420, parseInt(months, 10) || 48));
      const safePrincipal = Math.max(0, Math.round((Number(principal) || 0) * 100) / 100);

      if (safePrincipal <= 0) {
        return {
          schedule: [0],
          monthlyRate: 0,
          monthlyRatePct: 0,
          annualRatePct: 0,
          monthlyImpact: 0,
          firstInstallmentAmount: 0,
          lastInstallmentAmount: 0,
          totalInstallmentsSum: 0
        };
      }

      if (calcBy === 'installment') {
        const pmt = Math.max(0, Math.round((Number(quotedPmt) || 0) * 100) / 100);
        if (pmt <= 0) {
          return {
            schedule: [],
            monthlyRate: 0,
            monthlyRatePct: 0,
            annualRatePct: 0,
            monthlyImpact: 0,
            firstInstallmentAmount: 0,
            lastInstallmentAmount: 0,
            totalInstallmentsSum: 0
          };
        }

        const schedule = Array(safeMonths).fill(pmt);
        const totalInstallmentsSum = Math.round((pmt * safeMonths) * 100) / 100;
        const monthlyRate = this.solveMonthlyRateFromPMT(safePrincipal, pmt, safeMonths);
        const monthlyRatePct = Math.round(monthlyRate * 10000) / 100;
        const annualRatePct = Math.round(((Math.pow(1 + monthlyRate, 12) - 1) * 100) * 100) / 100;

        return {
          schedule,
          monthlyRate,
          monthlyRatePct,
          annualRatePct,
          monthlyImpact: pmt,
          firstInstallmentAmount: pmt,
          lastInstallmentAmount: pmt,
          totalInstallmentsSum
        };
      }

      const safeRate = Math.max(0, Number(interestRate) || 0);
      const monthlyRate = interestRateUnit === 'annual'
        ? Math.pow(1 + safeRate / 100, 1 / 12) - 1
        : safeRate / 100;
      const monthlyRatePct = Math.round(monthlyRate * 10000) / 100;
      const annualRatePct = interestRateUnit === 'annual'
        ? Math.round(safeRate * 100) / 100
        : Math.round(((Math.pow(1 + monthlyRate, 12) - 1) * 100) * 100) / 100;

      if (amortizationType === 'sac') {
        const amort = safePrincipal / safeMonths;
        const schedule = [];
        for (let k = 0; k < safeMonths; k++) {
          const remainingPrincipal = Math.max(0, safePrincipal - (amort * k));
          const installment = Math.round((amort + (remainingPrincipal * monthlyRate)) * 100) / 100;
          schedule.push(installment);
        }
        const totalInstallmentsSum = Math.round(schedule.reduce((sum, val) => sum + val, 0) * 100) / 100;
        return {
          schedule,
          monthlyRate,
          monthlyRatePct,
          annualRatePct,
          monthlyImpact: schedule[0] || 0,
          firstInstallmentAmount: schedule[0] || 0,
          lastInstallmentAmount: schedule[schedule.length - 1] || 0,
          totalInstallmentsSum
        };
      }

      if (monthlyRate === 0) {
        const { baseAmount, firstAmount } = this.computeInstallmentBreakdown(safePrincipal, safeMonths);
        const schedule = Array.from({ length: safeMonths }, (_, idx) => (idx === 0 ? firstAmount : baseAmount));
        return {
          schedule,
          monthlyRate: 0,
          monthlyRatePct: 0,
          annualRatePct: 0,
          monthlyImpact: safeMonths === 1 ? firstAmount : baseAmount,
          firstInstallmentAmount: firstAmount,
          lastInstallmentAmount: baseAmount,
          totalInstallmentsSum: safePrincipal
        };
      }

      const factor = Math.pow(1 + monthlyRate, -safeMonths);
      const pmt = Math.round(((safePrincipal * monthlyRate) / (1 - factor)) * 100) / 100;
      const schedule = Array(safeMonths).fill(pmt);
      const totalInstallmentsSum = Math.round((pmt * safeMonths) * 100) / 100;

      return {
        schedule,
        monthlyRate,
        monthlyRatePct,
        annualRatePct,
        monthlyImpact: pmt,
        firstInstallmentAmount: pmt,
        lastInstallmentAmount: pmt,
        totalInstallmentsSum
      };
    },

    getPlanFirstInstallmentOffset(plan) {
      const parsed = parseInt(plan?.firstInstallmentOffset, 10);
      return [0, 1, 2].includes(parsed) ? parsed : 1;
    },

    evaluatePlanCategoryOverflow(category, startPeriod, startPeriodImpact, firstInstallmentPeriod, firstInstallmentImpact) {
      const startUsage = this.getPlanCategoryUsage(category, startPeriod);
      const budgetLimit = startUsage.budgetLimit;
      if (firstInstallmentPeriod === startPeriod) {
        const combined = Math.round((startPeriodImpact + firstInstallmentImpact) * 100) / 100;
        const projected = Math.round((startUsage.currentSpent + combined) * 100) / 100;
        const exceeds = budgetLimit > 0 && projected > budgetLimit;
        return {
          categoryBudget: budgetLimit,
          categorySpentCurrent: startUsage.currentSpent,
          categoryExceedsBudget: exceeds,
          categoryOverflowAmount: exceeds ? Math.round((projected - budgetLimit) * 100) / 100 : 0,
          categoryCheckPeriod: startPeriod
        };
      }

      const instUsage = this.getPlanCategoryUsage(category, firstInstallmentPeriod);
      const instProjected = Math.round((instUsage.currentSpent + firstInstallmentImpact) * 100) / 100;
      const instExceeds = budgetLimit > 0 && instProjected > budgetLimit;
      const instOverflow = instExceeds ? Math.round((instProjected - budgetLimit) * 100) / 100 : 0;

      let startExceeds = false;
      let startOverflow = 0;
      if (startPeriodImpact > 0) {
        const startProjected = Math.round((startUsage.currentSpent + startPeriodImpact) * 100) / 100;
        startExceeds = budgetLimit > 0 && startProjected > budgetLimit;
        startOverflow = startExceeds ? Math.round((startProjected - budgetLimit) * 100) / 100 : 0;
      }

      if (startOverflow > instOverflow) {
        return {
          categoryBudget: budgetLimit,
          categorySpentCurrent: startUsage.currentSpent,
          categoryExceedsBudget: startExceeds,
          categoryOverflowAmount: startOverflow,
          categoryCheckPeriod: startPeriod
        };
      }

      return {
        categoryBudget: budgetLimit,
        categorySpentCurrent: instUsage.currentSpent,
        categoryExceedsBudget: instExceeds,
        categoryOverflowAmount: instOverflow,
        categoryCheckPeriod: firstInstallmentPeriod
      };
    },

    evaluateInstallmentPlan(plan, metrics) {
      const { startPeriod, currentBase, targetAmount, effectiveEntry, remainingAmount, progressPercent } = metrics;
      const installments = Math.max(1, Math.min(36, parseInt(plan.installments, 10) || 1));
      const downPaymentSource = plan.downPaymentSource === 'month_budget' ? 'month_budget' : 'saved';
      const downPaymentMonthImpact = downPaymentSource === 'month_budget' ? effectiveEntry : 0;
      const firstInstallmentOffset = this.getPlanFirstInstallmentOffset(plan);
      const firstInstallmentPeriod = Utils.shiftPeriod(startPeriod, firstInstallmentOffset);

      if (targetAmount > 0 && remainingAmount === 0 && downPaymentMonthImpact === 0) {
        const currentMonth = { ...currentBase, impact: 0, balanceAfter: currentBase.balanceBefore };
        const catCheck = this.evaluatePlanCategoryOverflow(plan.category, startPeriod, 0, startPeriod, 0);
        return {
          mode: 'installment',
          status: 'fits',
          statusMeta: this.getPlanStatusMeta('fits'),
          targetAmount,
          savedAmount: metrics.savedAmount,
          downPaymentSource,
          downPaymentMonthImpact: 0,
          firstInstallmentOffset,
          firstInstallmentPeriod: startPeriod,
          firstInstallmentMonth: currentMonth,
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
          ...catCheck,
          recommendation: 'Você já possui 100% do valor separado! Pode efetivar a compra sem comprometer seu orçamento mensal.'
        };
      }

      if (targetAmount > 0 && remainingAmount === 0 && downPaymentMonthImpact > 0) {
        const balanceAfter = Math.round((currentBase.balanceBefore - downPaymentMonthImpact) * 100) / 100;
        const currentMonth = { ...currentBase, impact: downPaymentMonthImpact, balanceAfter };
        const incomeSharePercent = currentBase.income > 0
          ? Math.round((downPaymentMonthImpact / currentBase.income) * 100)
          : 100;
        const catCheck = this.evaluatePlanCategoryOverflow(plan.category, startPeriod, downPaymentMonthImpact, startPeriod, 0);

        let status = 'fits';
        if (currentBase.income <= 0 || balanceAfter < 0) {
          status = 'over';
        } else if (balanceAfter < (currentBase.income * 0.1) || incomeSharePercent > 25 || catCheck.categoryExceedsBudget) {
          status = 'tight';
        }

        const recommendation = status === 'over'
          ? `Pagar a entrada integral de ${Utils.formatCurrency(downPaymentMonthImpact)} com o saldo deste mês deixaria ${Utils.formatPeriod(startPeriod)} no vermelho (${Utils.formatCurrency(balanceAfter)}). Considere parcelar ou usar uma Caixinha.`
          : (catCheck.categoryExceedsBudget
            ? `Cabe no saldo geral, mas ultrapassa em ${Utils.formatCurrency(catCheck.categoryOverflowAmount)} o teto mensal da categoria ${plan.category}.`
            : `Pagamento à vista com recursos deste mês! Sobrará ${Utils.formatCurrency(balanceAfter)} livre em ${Utils.formatPeriod(startPeriod)}.`);

        return {
          mode: 'installment',
          status,
          statusMeta: this.getPlanStatusMeta(status),
          targetAmount,
          savedAmount: metrics.savedAmount,
          downPaymentSource,
          downPaymentMonthImpact,
          firstInstallmentOffset,
          firstInstallmentPeriod: startPeriod,
          firstInstallmentMonth: currentMonth,
          remainingAmount: 0,
          progressPercent: 100,
          installments: 1,
          monthlyImpact: downPaymentMonthImpact,
          firstInstallmentImpact: downPaymentMonthImpact,
          incomeSharePercent,
          monthsNeeded: 1,
          targetCompletionPeriod: startPeriod,
          currentMonth,
          worstMonth: currentMonth,
          deficitMonths: balanceAfter < 0 ? [currentMonth] : [],
          timeline: [currentMonth],
          usesRecurringHorizon: false,
          ...catCheck,
          recommendation
        };
      }

      const { baseAmount, firstAmount } = this.computeInstallmentBreakdown(remainingAmount, installments);
      const currentMonthBalanceAfter = Math.round((currentBase.balanceBefore - downPaymentMonthImpact) * 100) / 100;
      const timeline = [];
      let currentMonth = null;

      if (firstInstallmentOffset > 0 && downPaymentMonthImpact > 0) {
        currentMonth = {
          ...currentBase,
          impact: downPaymentMonthImpact,
          balanceAfter: currentMonthBalanceAfter,
          isDownPaymentOnly: true
        };
        timeline.push(currentMonth);
      }

      const firstInstallmentIndexInTimeline = timeline.length;
      for (let i = 0; i < installments; i++) {
        const period = Utils.shiftPeriod(firstInstallmentPeriod, i);
        const base = this.getMonthBaseline(period);
        const impact = i === 0
          ? (firstInstallmentOffset === 0 ? Math.round((firstAmount + downPaymentMonthImpact) * 100) / 100 : firstAmount)
          : baseAmount;
        const balanceAfter = Math.round((base.balanceBefore - impact) * 100) / 100;
        timeline.push({ ...base, impact, balanceAfter });
      }

      const firstInstallmentMonth = timeline[firstInstallmentIndexInTimeline];
      if (!currentMonth) {
        currentMonth = firstInstallmentOffset === 0
          ? firstInstallmentMonth
          : { ...currentBase, impact: 0, balanceAfter: currentBase.balanceBefore };
      }

      const worstMonth = timeline.reduce((worst, m) => (m.balanceAfter < worst.balanceAfter ? m : worst), timeline[0]);
      const deficitMonths = timeline.filter(m => m.balanceAfter < 0);
      const monthlyImpact = installments === 1
        ? (firstInstallmentOffset === 0 ? Math.round((firstAmount + downPaymentMonthImpact) * 100) / 100 : firstAmount)
        : baseAmount;
      const firstInstallmentImpact = firstInstallmentOffset === 0
        ? Math.round((firstAmount + downPaymentMonthImpact) * 100) / 100
        : firstAmount;

      const refIncome = downPaymentMonthImpact > 0
        ? currentBase.income
        : (firstInstallmentMonth.income || currentBase.income);
      const incomeSharePercent = refIncome > 0
        ? Math.round((monthlyImpact / refIncome) * 100)
        : (monthlyImpact > 0 ? 100 : 0);

      const catCheck = this.evaluatePlanCategoryOverflow(
        plan.category,
        startPeriod,
        downPaymentMonthImpact,
        firstInstallmentPeriod,
        firstAmount
      );

      let status = 'fits';
      if (refIncome <= 0 || deficitMonths.length > 0) {
        status = 'over';
      } else if (worstMonth.balanceAfter < (refIncome * 0.1) || incomeSharePercent > 25 || catCheck.categoryExceedsBudget) {
        status = 'tight';
      }

      let recommendation = '';
      if (status === 'over') {
        const entryOnlyIssue = deficitMonths.length === 1 &&
          deficitMonths[0].period === startPeriod &&
          downPaymentMonthImpact > 0 &&
          (currentMonth.balanceAfter + downPaymentMonthImpact) >= 0;

        if (entryOnlyIssue) {
          recommendation = `As parcelas cabem nos meses seguintes, mas pagar a entrada de ${Utils.formatCurrency(downPaymentMonthImpact)} com o saldo deste mês deixaria ${Utils.formatPeriod(startPeriod)} negativo. Use uma Caixinha ou diminua a entrada imediata.`;
        } else {
          const altOptions = [2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24, 36].filter(n => n > installments);
          let foundAlt = null;

          const currentMonthSupportsEntry = firstInstallmentOffset === 0 || downPaymentMonthImpact === 0 || currentMonth.balanceAfter >= 0;
          if (currentMonthSupportsEntry && refIncome > 0) {
            for (const k of altOptions) {
              const { baseAmount: altBase, firstAmount: altFirst } = this.computeInstallmentBreakdown(remainingAmount, k);
              let allNonNegative = true;
              for (let j = 0; j < k; j++) {
                const p = Utils.shiftPeriod(firstInstallmentPeriod, j);
                const b = this.getMonthBaseline(p);
                const imp = j === 0
                  ? (firstInstallmentOffset === 0 ? (altFirst + downPaymentMonthImpact) : altFirst)
                  : altBase;
                if ((b.balanceBefore - imp) < 0) {
                  allNonNegative = false;
                  break;
                }
              }
              if (allNonNegative) {
                foundAlt = { count: k, perMonth: altBase };
                break;
              }
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
        }
      } else if (status === 'tight') {
        if (catCheck.categoryExceedsBudget) {
          recommendation = `As parcelas cabem no saldo geral, mas o impacto inicial em ${Utils.formatPeriod(catCheck.categoryCheckPeriod)} ultrapassa em ${Utils.formatCurrency(catCheck.categoryOverflowAmount)} o teto mensal da categoria ${plan.category}.`;
        } else {
          recommendation = `Cabe no orçamento, mas a sobra em ${Utils.formatPeriod(worstMonth.period)} ficará apertada (${Utils.formatCurrency(worstMonth.balanceAfter)}). Considere aumentar a entrada ou parcelar em mais vezes.`;
        }
      } else {
        const startHint = firstInstallmentOffset > 0
          ? ` (1ª parcela em ${Utils.formatPeriod(firstInstallmentPeriod)})`
          : '';
        recommendation = `Compra saudável!${startHint} Mesmo no mês de maior comprometimento (${Utils.formatPeriod(worstMonth.period)}), restará ${Utils.formatCurrency(worstMonth.balanceAfter)} livre.`;
      }

      return {
        mode: 'installment',
        status,
        statusMeta: this.getPlanStatusMeta(status),
        targetAmount,
        savedAmount: metrics.savedAmount,
        downPaymentSource,
        downPaymentMonthImpact,
        firstInstallmentOffset,
        firstInstallmentPeriod,
        firstInstallmentMonth,
        remainingAmount,
        progressPercent,
        installments,
        monthlyImpact,
        firstInstallmentImpact,
        incomeSharePercent,
        monthsNeeded: installments,
        targetCompletionPeriod: Utils.shiftPeriod(firstInstallmentPeriod, installments - 1),
        currentMonth,
        worstMonth,
        deficitMonths,
        timeline,
        usesRecurringHorizon: timeline.some(m => m.usesRecurringBase),
        ...catCheck,
        recommendation
      };
    },

    evaluateFinancingPlan(plan, metrics) {
      const { startPeriod, currentBase, targetAmount, effectiveEntry, remainingAmount, progressPercent } = metrics;
      const installments = Math.max(1, Math.min(420, parseInt(plan.installments, 10) || 48));
      const downPaymentSource = plan.downPaymentSource === 'month_budget' ? 'month_budget' : 'saved';
      const downPaymentMonthImpact = downPaymentSource === 'month_budget' ? effectiveEntry : 0;
      const calcBy = plan.financingCalcBy === 'installment' ? 'installment' : 'rate';
      const interestRateUnit = plan.interestRateUnit === 'annual' ? 'annual' : 'monthly';
      const amortizationType = plan.amortizationType === 'sac' ? 'sac' : 'price';
      const firstInstallmentOffset = this.getPlanFirstInstallmentOffset(plan);
      const firstInstallmentPeriod = Utils.shiftPeriod(startPeriod, firstInstallmentOffset);

      if (targetAmount > 0 && remainingAmount === 0) {
        const balanceAfter = Math.round((currentBase.balanceBefore - downPaymentMonthImpact) * 100) / 100;
        const currentMonth = { ...currentBase, impact: downPaymentMonthImpact, balanceAfter };
        const incomeSharePercent = currentBase.income > 0 && downPaymentMonthImpact > 0
          ? Math.round((downPaymentMonthImpact / currentBase.income) * 100)
          : 0;
        const catCheck = this.evaluatePlanCategoryOverflow(plan.category, startPeriod, downPaymentMonthImpact, startPeriod, 0);

        let status = 'fits';
        if (downPaymentMonthImpact > 0) {
          if (currentBase.income <= 0 || balanceAfter < 0) status = 'over';
          else if (balanceAfter < (currentBase.income * 0.1) || incomeSharePercent > 25 || catCheck.categoryExceedsBudget) status = 'tight';
        }

        const recommendation = downPaymentMonthImpact === 0
          ? 'A entrada já cobre 100% do bem! Nenhum financiamento ou parcela será necessário.'
          : (status === 'over'
            ? `A entrada cobre 100% do bem, mas pagá-la integralmente com o saldo deste mês deixaria ${Utils.formatPeriod(startPeriod)} negativo (${Utils.formatCurrency(balanceAfter)}).`
            : `A entrada cobre 100% do bem sem juros, restando ${Utils.formatCurrency(balanceAfter)} livre neste mês!`);

        return {
          mode: 'financing',
          calcBy,
          amortizationType,
          status,
          statusMeta: this.getPlanStatusMeta(status),
          targetAmount,
          savedAmount: metrics.savedAmount,
          downPaymentSource,
          downPaymentMonthImpact,
          firstInstallmentOffset,
          firstInstallmentPeriod: startPeriod,
          firstInstallmentMonth: currentMonth,
          remainingAmount: 0,
          financedAmount: 0,
          progressPercent: 100,
          installments,
          monthlyImpact: downPaymentMonthImpact,
          firstInstallmentImpact: downPaymentMonthImpact,
          lastInstallmentAmount: 0,
          totalInstallmentsSum: 0,
          totalInterest: 0,
          rawInterestDiff: 0,
          totalCost: effectiveEntry,
          interestOverPrincipalPercent: 0,
          effectiveMonthlyRatePct: 0,
          effectiveAnnualRatePct: 0,
          incomeSharePercent,
          monthsNeeded: 0,
          targetCompletionPeriod: startPeriod,
          currentMonth,
          worstMonth: currentMonth,
          deficitMonths: balanceAfter < 0 ? [currentMonth] : [],
          timeline: [currentMonth],
          usesRecurringHorizon: false,
          ...catCheck,
          recommendation
        };
      }

      const scheduleData = this.buildFinancingSchedule({
        principal: remainingAmount,
        months: installments,
        calcBy,
        interestRate: plan.interestRate,
        interestRateUnit,
        amortizationType: calcBy === 'installment' ? 'price' : amortizationType,
        quotedPmt: plan.financingInstallmentAmount
      });

      if (calcBy === 'installment' && scheduleData.schedule.length === 0) {
        const balanceAfter = Math.round((currentBase.balanceBefore - downPaymentMonthImpact) * 100) / 100;
        const currentMonth = { ...currentBase, impact: downPaymentMonthImpact, balanceAfter };
        const status = currentBase.balanceBefore > 0 ? 'tight' : 'over';
        const catCheck = this.evaluatePlanCategoryOverflow(plan.category, startPeriod, downPaymentMonthImpact, firstInstallmentPeriod, 0);
        return {
          mode: 'financing',
          calcBy,
          amortizationType: 'price',
          status,
          statusMeta: this.getPlanStatusMeta(status),
          targetAmount,
          savedAmount: metrics.savedAmount,
          downPaymentSource,
          downPaymentMonthImpact,
          firstInstallmentOffset,
          firstInstallmentPeriod,
          firstInstallmentMonth: currentMonth,
          remainingAmount,
          financedAmount: remainingAmount,
          progressPercent,
          installments,
          monthlyImpact: 0,
          firstInstallmentImpact: downPaymentMonthImpact,
          lastInstallmentAmount: 0,
          totalInstallmentsSum: 0,
          totalInterest: 0,
          rawInterestDiff: 0,
          totalCost: effectiveEntry,
          interestOverPrincipalPercent: 0,
          effectiveMonthlyRatePct: 0,
          effectiveAnnualRatePct: 0,
          incomeSharePercent: 0,
          monthsNeeded: installments,
          targetCompletionPeriod: Utils.shiftPeriod(firstInstallmentPeriod, installments - 1),
          currentMonth,
          worstMonth: currentMonth,
          deficitMonths: balanceAfter < 0 ? [currentMonth] : [],
          timeline: [currentMonth],
          usesRecurringHorizon: false,
          ...catCheck,
          recommendation: 'Informe o valor da parcela proposta pelo banco ou loja para calcular juros, taxa implícita e impacto mensal.'
        };
      }

      const {
        schedule,
        monthlyImpact,
        firstInstallmentAmount,
        lastInstallmentAmount,
        totalInstallmentsSum,
        monthlyRatePct,
        annualRatePct
      } = scheduleData;

      const rawInterestDiff = Math.round((totalInstallmentsSum - remainingAmount) * 100) / 100;
      const totalInterest = Math.max(0, rawInterestDiff);
      const totalCost = Math.round((effectiveEntry + totalInstallmentsSum) * 100) / 100;
      const interestOverPrincipalPercent = remainingAmount > 0
        ? Math.round((totalInterest / remainingAmount) * 1000) / 10
        : 0;

      const specialPeriods = this.getSpecialPeriodsSet();
      const genericBase = this.getGenericFutureBaseline(startPeriod);

      const timelinePreview = [];
      let currentMonth = null;
      let worstMonth = null;
      const deficitMonths = [];
      let usesRecurringHorizon = false;

      if (firstInstallmentOffset > 0 && downPaymentMonthImpact > 0) {
        const entryBalanceAfter = Math.round((currentBase.balanceBefore - downPaymentMonthImpact) * 100) / 100;
        currentMonth = {
          ...currentBase,
          impact: downPaymentMonthImpact,
          balanceAfter: entryBalanceAfter,
          isDownPaymentOnly: true
        };
        timelinePreview.push(currentMonth);
        worstMonth = currentMonth;
        if (currentMonth.balanceAfter < 0) deficitMonths.push(currentMonth);
      }

      const firstInstallmentPreviewIndex = timelinePreview.length;
      for (let i = 0; i < installments; i++) {
        const period = Utils.shiftPeriod(firstInstallmentPeriod, i);
        const base = ((firstInstallmentOffset + i) < 12 || specialPeriods.has(period))
          ? this.getMonthBaseline(period)
          : { ...genericBase, period };

        if (base.usesRecurringBase) usesRecurringHorizon = true;

        const installmentVal = schedule[i] ?? monthlyImpact;
        const impact = i === 0
          ? (firstInstallmentOffset === 0 ? Math.round((installmentVal + downPaymentMonthImpact) * 100) / 100 : installmentVal)
          : installmentVal;
        const balanceAfter = Math.round((base.balanceBefore - impact) * 100) / 100;
        const point = { ...base, impact, balanceAfter };

        if (i < 12) timelinePreview.push(point);
        if (!worstMonth || point.balanceAfter < worstMonth.balanceAfter) worstMonth = point;
        if (point.balanceAfter < 0) deficitMonths.push(point);
      }

      const firstInstallmentMonth = timelinePreview[firstInstallmentPreviewIndex];
      if (!currentMonth) {
        currentMonth = firstInstallmentOffset === 0
          ? firstInstallmentMonth
          : { ...currentBase, impact: 0, balanceAfter: currentBase.balanceBefore };
      }

      const firstInstallmentImpact = firstInstallmentOffset === 0
        ? Math.round(((schedule[0] ?? monthlyImpact) + downPaymentMonthImpact) * 100) / 100
        : (schedule[0] ?? monthlyImpact);
      const refIncome = downPaymentMonthImpact > 0
        ? currentBase.income
        : (firstInstallmentMonth.income || currentBase.income);
      const incomeSharePercent = refIncome > 0
        ? Math.round((monthlyImpact / refIncome) * 100)
        : (monthlyImpact > 0 ? 100 : 0);

      const catCheck = this.evaluatePlanCategoryOverflow(
        plan.category,
        startPeriod,
        downPaymentMonthImpact,
        firstInstallmentPeriod,
        schedule[0] ?? monthlyImpact
      );

      let status = 'fits';
      if (refIncome <= 0 || deficitMonths.length > 0) {
        status = 'over';
      } else if (worstMonth.balanceAfter < (refIncome * 0.1) || incomeSharePercent > 25 || catCheck.categoryExceedsBudget) {
        status = 'tight';
      }

      let recommendation = '';
      if (calcBy === 'installment' && rawInterestDiff < -0.01) {
        recommendation = `Atenção: ${installments}x de ${Utils.formatCurrency(monthlyImpact)} soma ${Utils.formatCurrency(totalInstallmentsSum)}, abaixo do valor financiado (${Utils.formatCurrency(remainingAmount)}). Confira o valor do bem, entrada ou prazo.`;
      } else if (status === 'over') {
        const entryOnlyIssue = deficitMonths.length === 1 &&
          deficitMonths[0].period === startPeriod &&
          downPaymentMonthImpact > 0 &&
          (currentMonth.balanceAfter + downPaymentMonthImpact) >= 0;

        if (entryOnlyIssue) {
          recommendation = `A parcela de ${Utils.formatCurrency(monthlyImpact)}/mês cabe nos meses seguintes, mas pagar a entrada de ${Utils.formatCurrency(downPaymentMonthImpact)} com o saldo deste mês deixaria ${Utils.formatPeriod(startPeriod)} negativo. Use uma Caixinha ou junte a entrada antes.`;
        } else if (calcBy === 'rate' && refIncome > 0 && (firstInstallmentOffset === 0 || downPaymentMonthImpact === 0 || currentMonth.balanceAfter >= 0)) {
          const altTerms = [12, 18, 24, 36, 48, 60, 72, 84, 96, 120, 180, 240, 360].filter(n => n > installments);
          let foundAlt = null;

          for (const k of altTerms) {
            const altSched = this.buildFinancingSchedule({
              principal: remainingAmount,
              months: k,
              calcBy: 'rate',
              interestRate: plan.interestRate,
              interestRateUnit,
              amortizationType
            });

            let allNonNegative = true;
            for (let j = 0; j < k; j++) {
              const p = Utils.shiftPeriod(firstInstallmentPeriod, j);
              const b = ((firstInstallmentOffset + j) < 12 || specialPeriods.has(p))
                ? this.getMonthBaseline(p)
                : genericBase;
              const altFirst = altSched.schedule[0] ?? altSched.monthlyImpact;
              const imp = j === 0
                ? (firstInstallmentOffset === 0 ? (altFirst + downPaymentMonthImpact) : altFirst)
                : (altSched.schedule[j] ?? altSched.monthlyImpact);
              if ((b.balanceBefore - imp) < 0) {
                allNonNegative = false;
                break;
              }
            }
            if (allNonNegative) {
              const altInterest = Math.max(0, Math.round((altSched.totalInstallmentsSum - remainingAmount) * 100) / 100);
              foundAlt = { count: k, perMonth: altSched.monthlyImpact, totalInterest: altInterest };
              break;
            }
          }

          if (foundAlt) {
            recommendation = `Em ${installments}x, o orçamento fecha negativo em ${Utils.formatPeriod(worstMonth.period)}. Em ${foundAlt.count}x (${Utils.formatCurrency(foundAlt.perMonth)}/mês), todos os meses ficam no azul (juros totais de ${Utils.formatCurrency(foundAlt.totalInterest)}).`;
          } else {
            recommendation = `A parcela de ${Utils.formatCurrency(monthlyImpact)}/mês deixa ${Utils.formatPeriod(worstMonth.period)} negativo (${Utils.formatCurrency(worstMonth.balanceAfter)}). Aumente o valor de entrada ou busque juros menores.`;
          }
        } else {
          recommendation = refIncome <= 0
            ? 'Cadastre a renda mensal para avaliar se a parcela do financiamento cabe no orçamento.'
            : `A parcela de ${Utils.formatCurrency(monthlyImpact)}/mês deixa ${Utils.formatPeriod(worstMonth.period)} no vermelho (${Utils.formatCurrency(worstMonth.balanceAfter)}). Negocie prazo maior ou aumente a entrada.`;
        }
      } else if (status === 'tight') {
        if (catCheck.categoryExceedsBudget) {
          recommendation = `A parcela cabe no saldo geral, mas o impacto inicial em ${Utils.formatPeriod(catCheck.categoryCheckPeriod)} ultrapassa em ${Utils.formatCurrency(catCheck.categoryOverflowAmount)} o teto mensal da categoria ${plan.category}.`;
        } else {
          recommendation = `Financiamento apertado: restará ${Utils.formatCurrency(worstMonth.balanceAfter)} livre em ${Utils.formatPeriod(worstMonth.period)} (${incomeSharePercent}% da renda comprometida). Aumentar a entrada aliviaria o mês e reduziria ${Utils.formatCurrency(totalInterest)} de juros.`;
        }
      } else {
        const interestInsight = totalInterest > 0
          ? `Você pagará +${Utils.formatCurrency(totalInterest)} em juros (${interestOverPrincipalPercent}% sobre o valor financiado).`
          : 'Financiamento simulado com taxa zero de juros.';
        const startHint = firstInstallmentOffset > 0
          ? ` (1ª parcela em ${Utils.formatPeriod(firstInstallmentPeriod)})`
          : '';
        recommendation = `Financiamento viável!${startHint} Menor sobra prevista: ${Utils.formatCurrency(worstMonth.balanceAfter)} (${Utils.formatPeriod(worstMonth.period)}).${interestInsight ? ` ${interestInsight}` : ''}`;
      }

      return {
        mode: 'financing',
        calcBy,
        amortizationType: calcBy === 'installment' ? 'price' : amortizationType,
        status,
        statusMeta: this.getPlanStatusMeta(status),
        targetAmount,
        savedAmount: metrics.savedAmount,
        downPaymentSource,
        downPaymentMonthImpact,
        firstInstallmentOffset,
        firstInstallmentPeriod,
        firstInstallmentMonth,
        remainingAmount,
        financedAmount: remainingAmount,
        progressPercent,
        installments,
        monthlyImpact,
        firstInstallmentAmount,
        firstInstallmentImpact,
        lastInstallmentAmount,
        totalInstallmentsSum,
        totalInterest,
        rawInterestDiff,
        totalCost,
        interestOverPrincipalPercent,
        effectiveMonthlyRatePct: monthlyRatePct,
        effectiveAnnualRatePct: annualRatePct,
        incomeSharePercent,
        monthsNeeded: installments,
        targetCompletionPeriod: Utils.shiftPeriod(firstInstallmentPeriod, installments - 1),
        currentMonth,
        worstMonth,
        deficitMonths,
        timeline: timelinePreview,
        usesRecurringHorizon,
        ...catCheck,
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
      const effectiveEntry = targetAmount > 0 ? Math.min(savedAmount, targetAmount) : savedAmount;
      const remainingAmount = Math.max(0, Math.round((targetAmount - savedAmount) * 100) / 100);
      const progressPercent = targetAmount > 0
        ? Math.min(100, Math.round((savedAmount / targetAmount) * 100))
        : 0;

      const metrics = {
        startPeriod,
        currentBase,
        targetAmount,
        savedAmount,
        effectiveEntry,
        remainingAmount,
        progressPercent
      };

      if (plan.mode === 'save') return this.evaluateSavePlan(plan, metrics);
      if (plan.mode === 'financing') return this.evaluateFinancingPlan(plan, metrics);
      return this.evaluateInstallmentPlan(plan, metrics);
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
          } else if (plan.mode === 'financing') {
            const condLabel = evaluation.remainingAmount === 0
              ? 'Coberto pela entrada'
              : (evaluation.monthlyImpact > 0 ? `Financ. ${evaluation.installments}x ${Utils.formatCurrency(evaluation.monthlyImpact)}` : `${evaluation.installments}x (defina parcela)`);
            subline = `<span>Bem: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong></span><span class="font-medium text-indigo-300">${condLabel}</span>`;
            if (evaluation.remainingAmount > 0 && evaluation.firstInstallmentPeriod) {
              progressHtml = `<div class="text-[10px] text-slate-400">1ª parcela: <strong class="text-slate-300">${this.formatCompactPeriod(evaluation.firstInstallmentPeriod)}</strong>${evaluation.downPaymentMonthImpact > 0 ? ' • Entrada neste mês' : ''}</div>`;
            }
          } else {
            const condLabel = evaluation.remainingAmount === 0
              ? (evaluation.downPaymentMonthImpact > 0 ? `À vista (mês): ${Utils.formatCurrency(evaluation.downPaymentMonthImpact)}` : 'Coberto pela reserva')
              : (plan.installments > 1 ? `${plan.installments}x de ${Utils.formatCurrency(evaluation.monthlyImpact)}` : `À vista: ${Utils.formatCurrency(evaluation.monthlyImpact)}`);
            subline = `<span>Alvo: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong></span><span class="font-medium text-slate-300">${condLabel}</span>`;
            if (evaluation.remainingAmount > 0 && evaluation.firstInstallmentPeriod) {
              progressHtml = `<div class="text-[10px] text-slate-400">1ª parcela: <strong class="text-slate-300">${this.formatCompactPeriod(evaluation.firstInstallmentPeriod)}</strong>${evaluation.downPaymentMonthImpact > 0 ? ' • Entrada neste mês' : ''}</div>`;
            }
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
        this.populatePlanReserveSelector();
        this.updatePlanSimulationPreview();
      }
    },

    openPlanningModal(editPlanId = null) {
      if (editPlanId) {
        this.openEditPlan(editPlanId);
      } else {
        this.resetPlanningForm();
      }
      this.populatePlanReserveSelector();
      this.renderPlanningModalList();
      this.updatePlanSimulationPreview();
      this.openModal(this.planningModal);
      this.planTitleInput?.focus();
    },

    populatePlanReserveSelector() {
      if (!this.planReserveAssistBox || !this.planReserveSourceSelect) return;

      const reserves = (this.state.reserves || []).filter(r => (r.balance || 0) > 0);
      const total = this.getTotalReservesBalance();

      if (reserves.length === 0 || total <= 0) {
        this.planReserveAssistBox.classList.add('hidden');
        this.planReserveSourceSelect.innerHTML = '';
        return;
      }

      const prevSelected = this.planReserveSourceSelect.value;
      let optionsHtml = `<option value="__all__">Todas as caixinhas (${Utils.formatCurrency(total)})</option>`;
      reserves.forEach(r => {
        optionsHtml += `<option value="${r.id}">${Utils.escapeHTML(r.title)} (${Utils.formatCurrency(r.balance)})</option>`;
      });

      this.planReserveSourceSelect.innerHTML = optionsHtml;
      if (prevSelected && Array.from(this.planReserveSourceSelect.options).some(o => o.value === prevSelected)) {
        this.planReserveSourceSelect.value = prevSelected;
      } else {
        this.planReserveSourceSelect.value = '__all__';
      }
      this.planReserveAssistBox.classList.remove('hidden');
    },

    applyReserveToPlan() {
      const source = this.planReserveSourceSelect?.value || '__all__';
      let available = 0;
      let includesEmergency = false;

      if (source === '__all__') {
        available = this.getTotalReservesBalance();
        includesEmergency = (this.state.reserves || []).some(r => r.type === 'Reserva de Emergência' && (r.balance || 0) > 0);
      } else {
        const reserve = (this.state.reserves || []).find(r => r.id === source);
        available = reserve ? (reserve.balance || 0) : 0;
        includesEmergency = reserve?.type === 'Reserva de Emergência';
      }

      if (available <= 0) {
        Toast.show('A caixinha selecionada não possui saldo disponível.', 'warning');
        return;
      }

      const targetAmount = Utils.parseCurrency(this.planTargetAmountInput?.value || '0');
      const applied = targetAmount > 0 ? Math.min(available, targetAmount) : available;

      if (this.planSavedAmountInput) {
        this.planSavedAmountInput.value = Utils.formatNumberToInput(applied);
      }
      this.setPlanDownPaymentSource('saved', false);
      this.updatePlanSimulationPreview();
      if (includesEmergency) {
        Toast.show(`Entrada de ${Utils.formatCurrency(applied)} aplicada. Atenção: envolve sua Reserva de Emergência — use apenas se for necessário.`, 'warning', 4500);
      } else {
        Toast.show(`Valor de ${Utils.formatCurrency(applied)} aplicado como entrada já guardada.`, 'success');
      }
    },

    setPlanPriority(priority) {
      const normalized = PLAN_PRIORITY_META[priority] ? priority : 'important';
      if (this.planPriorityInput) this.planPriorityInput.value = normalized;
      this.planPriorityBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-plan-priority') === normalized;
        if (isActive) {
          btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
          btn.classList.remove('text-slate-400', 'hover:text-white');
        } else {
          btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
          btn.classList.add('text-slate-400', 'hover:text-white');
        }
      });
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
      this.setPlanPriority('important');
      if (this.planTargetAmountInput) this.planTargetAmountInput.value = '0,00';
      if (this.planSavedAmountInput) this.planSavedAmountInput.value = '0,00';
      if (this.planInstallmentsSelect) this.planInstallmentsSelect.value = '10';
      if (this.planPaymentMethodSelect) this.planPaymentMethodSelect.value = 'Cartão de Crédito';
      if (this.planFinancingMonthsInput) this.planFinancingMonthsInput.value = '48';
      if (this.planFinancingDueDayInput) this.planFinancingDueDayInput.value = '10';
      if (this.planInterestRateInput) this.planInterestRateInput.value = '';
      if (this.planInterestRateUnitSelect) this.planInterestRateUnitSelect.value = 'monthly';
      if (this.planAmortizationSelect) this.planAmortizationSelect.value = 'price';
      if (this.planFinancingInstallmentInput) this.planFinancingInstallmentInput.value = '0,00';
      if (this.planMonthlyContributionInput) this.planMonthlyContributionInput.value = '0,00';
      if (this.planFirstInstallmentOffsetSelect) this.planFirstInstallmentOffsetSelect.value = '1';
      this.setPlanDownPaymentSource('saved', false);
      this.setPlanFinancingCalcBy('rate', false);
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
        const instStr = String(plan.mode === 'financing' ? 10 : (plan.installments || 10));
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
      if (this.planFinancingMonthsInput) {
        this.planFinancingMonthsInput.value = String(plan.mode === 'financing' ? (plan.installments || 48) : 48);
      }
      if (this.planFinancingDueDayInput) {
        this.planFinancingDueDayInput.value = String(plan.financingDueDay || 10);
      }
      if (this.planInterestRateInput) {
        this.planInterestRateInput.value = plan.interestRate > 0 ? String(plan.interestRate).replace('.', ',') : '';
      }
      if (this.planInterestRateUnitSelect) {
        this.planInterestRateUnitSelect.value = plan.interestRateUnit === 'annual' ? 'annual' : 'monthly';
      }
      if (this.planAmortizationSelect) {
        this.planAmortizationSelect.value = plan.amortizationType === 'sac' ? 'sac' : 'price';
      }
      if (this.planFinancingInstallmentInput) {
        this.planFinancingInstallmentInput.value = Utils.formatNumberToInput(plan.financingInstallmentAmount || 0);
      }
      if (this.planMonthlyContributionInput) {
        this.planMonthlyContributionInput.value = Utils.formatNumberToInput(plan.monthlyContribution || 0);
      }
      if (this.planFirstInstallmentOffsetSelect) {
        this.planFirstInstallmentOffsetSelect.value = String(this.getPlanFirstInstallmentOffset(plan));
      }

      this.setPlanPriority(plan.priority || 'important');
      this.setPlanDownPaymentSource(plan.downPaymentSource || 'saved', false);
      this.setPlanFinancingCalcBy(plan.financingCalcBy || 'rate', false);
      this.setPlanMode(plan.mode, false);
      this.updatePlanSimulationPreview();
      if (this.planningModalBody) this.planningModalBody.scrollTop = 0;
    },

    setPlanMode(mode, updatePreview = true) {
      const validModes = new Set(['installment', 'financing', 'save']);
      const normalizedMode = validModes.has(mode) ? mode : 'installment';
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

      if (this.planSavedAmountLabel) {
        if (normalizedMode === 'save') {
          this.planSavedAmountLabel.textContent = 'Quanto já tenho guardado';
        } else if (normalizedMode === 'financing') {
          this.planSavedAmountLabel.textContent = 'Valor de entrada';
        } else {
          this.planSavedAmountLabel.textContent = 'Valor de entrada / Já guardado';
        }
      }

      if (normalizedMode === 'save') {
        this.planDownPaymentSourceBox?.classList.add('hidden');
        this.planInstallmentFields?.classList.add('hidden');
        this.planFinancingFields?.classList.add('hidden');
        this.planSaveFields?.classList.remove('hidden');
      } else if (normalizedMode === 'financing') {
        this.planDownPaymentSourceBox?.classList.remove('hidden');
        this.planInstallmentFields?.classList.add('hidden');
        this.planFinancingFields?.classList.remove('hidden');
        this.planSaveFields?.classList.add('hidden');
      } else {
        this.planDownPaymentSourceBox?.classList.remove('hidden');
        this.planInstallmentFields?.classList.remove('hidden');
        this.planFinancingFields?.classList.add('hidden');
        this.planSaveFields?.classList.add('hidden');
      }

      if (updatePreview) {
        this.updatePlanSimulationPreview();
      }
    },

    setPlanDownPaymentSource(source, updatePreview = true) {
      const normalizedSource = source === 'month_budget' ? 'month_budget' : 'saved';
      if (this.planDownPaymentSourceInput) this.planDownPaymentSourceInput.value = normalizedSource;

      this.planDownPaymentSourceBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-plan-entry-source') === normalizedSource;
        btn.classList.remove(
          'bg-indigo-600/20', 'text-indigo-200', 'border-indigo-500/40',
          'bg-slate-900', 'text-slate-400', 'hover:text-slate-200', 'border-slate-700'
        );
        if (isActive) {
          btn.classList.add('bg-indigo-600/20', 'text-indigo-200', 'border-indigo-500/40');
        } else {
          btn.classList.add('bg-slate-900', 'text-slate-400', 'hover:text-slate-200', 'border-slate-700');
        }
      });

      if (this.planDownPaymentSourceHint) {
        this.planDownPaymentSourceHint.textContent = normalizedSource === 'month_budget'
          ? 'Soma a entrada ao impacto deste mês na simulação e lança nos Gastos Diários ao efetivar.'
          : 'Considera a entrada já separada fora do fluxo deste mês (apenas reduz o saldo parcelado/financiado).';
      }

      if (updatePreview) {
        this.updatePlanSimulationPreview();
      }
    },

    applyPlanDownPaymentPercent(pct) {
      const targetAmount = Utils.parseCurrency(this.planTargetAmountInput?.value || '0');
      if (targetAmount <= 0) {
        Toast.show('Informe o valor total do bem / compra primeiro para calcular a entrada.', 'warning');
        this.planTargetAmountInput?.focus();
        return;
      }

      const safePct = Math.max(0, Math.min(100, Number(pct) || 0));
      const entryAmount = Math.round((targetAmount * (safePct / 100)) * 100) / 100;
      if (this.planSavedAmountInput) {
        this.planSavedAmountInput.value = Utils.formatNumberToInput(entryAmount);
      }
      this.updatePlanSimulationPreview();
    },

    setPlanFinancingCalcBy(calcBy, updatePreview = true) {
      const normalized = calcBy === 'installment' ? 'installment' : 'rate';
      if (this.planFinancingCalcByInput) this.planFinancingCalcByInput.value = normalized;

      this.planFinancingCalcBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-plan-fin-calc') === normalized;
        if (isActive) {
          btn.classList.add('bg-indigo-600', 'text-white');
          btn.classList.remove('text-slate-400', 'hover:text-white');
        } else {
          btn.classList.remove('bg-indigo-600', 'text-white');
          btn.classList.add('text-slate-400', 'hover:text-white');
        }
      });

      if (normalized === 'installment') {
        this.planFinancingRateFields?.classList.add('hidden');
        this.planFinancingInstallmentFields?.classList.remove('hidden');
      } else {
        this.planFinancingRateFields?.classList.remove('hidden');
        this.planFinancingInstallmentFields?.classList.add('hidden');
      }

      if (updatePreview) {
        this.updatePlanSimulationPreview();
      }
    },

    getPlanFormDraft() {
      const rawMode = this.planModeInput?.value;
      const mode = rawMode === 'save' ? 'save' : (rawMode === 'financing' ? 'financing' : 'installment');
      const rawInstallments = mode === 'financing'
        ? parseInt(this.planFinancingMonthsInput?.value || '48', 10)
        : parseInt(this.planInstallmentsSelect?.value || '10', 10);
      const maxInst = mode === 'financing' ? 420 : 36;
      const defaultInst = mode === 'financing' ? 48 : 10;
      const installments = (Number.isFinite(rawInstallments) && rawInstallments >= 1)
        ? Math.min(maxInst, rawInstallments)
        : defaultInst;
      const rawDueDay = parseInt(this.planFinancingDueDayInput?.value || '10', 10);
      const financingDueDay = (Number.isFinite(rawDueDay) && rawDueDay >= 1)
        ? Math.min(31, rawDueDay)
        : 10;

      return {
        id: this.planEditId?.value || '',
        title: (this.planTitleInput?.value || '').trim(),
        category: this.planCategorySelect?.value || 'Compras',
        priority: PLAN_PRIORITY_META[this.planPriorityInput?.value] ? this.planPriorityInput.value : 'important',
        mode,
        targetAmount: Utils.parseCurrency(this.planTargetAmountInput?.value || '0'),
        savedAmount: Utils.parseCurrency(this.planSavedAmountInput?.value || '0'),
        downPaymentSource: this.planDownPaymentSourceInput?.value === 'month_budget' ? 'month_budget' : 'saved',
        firstInstallmentOffset: this.getPlanFirstInstallmentOffset({ firstInstallmentOffset: this.planFirstInstallmentOffsetSelect?.value }),
        installments,
        paymentMethod: this.planPaymentMethodSelect?.value || 'Cartão de Crédito',
        financingCalcBy: this.planFinancingCalcByInput?.value === 'installment' ? 'installment' : 'rate',
        interestRate: Utils.parsePercent(this.planInterestRateInput?.value || '0'),
        interestRateUnit: this.planInterestRateUnitSelect?.value === 'annual' ? 'annual' : 'monthly',
        amortizationType: this.planAmortizationSelect?.value === 'sac' ? 'sac' : 'price',
        financingInstallmentAmount: Utils.parseCurrency(this.planFinancingInstallmentInput?.value || '0'),
        financingDueDay,
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
        : (ev.mode === 'financing'
          ? (ev.remainingAmount === 0
            ? '100% coberto pela entrada'
            : (ev.monthlyImpact <= 0
              ? 'Informe o valor da parcela'
              : (ev.amortizationType === 'sac' && ev.installments > 1 && ev.lastInstallmentAmount !== ev.monthlyImpact
                ? `${ev.installments}x SAC: ${Utils.formatCurrency(ev.monthlyImpact)} até ${Utils.formatCurrency(ev.lastInstallmentAmount)}`
                : `${ev.installments}x de ${Utils.formatCurrency(ev.monthlyImpact)}`)))
          : (ev.remainingAmount === 0
            ? (ev.downPaymentMonthImpact > 0 ? `À vista (mês): ${Utils.formatCurrency(ev.downPaymentMonthImpact)}` : '100% coberto pela entrada')
            : (ev.installments > 1 ? `${ev.installments}x de ${Utils.formatCurrency(ev.monthlyImpact)}` : `À vista: ${Utils.formatCurrency(ev.monthlyImpact)}`)));

      const thirdMetricLabel = ev.mode === 'save'
        ? 'Previsão de compra'
        : `Pior mês (${this.formatCompactPeriod(ev.worstMonth.period)})`;
      const thirdMetricValue = ev.mode === 'save'
        ? (ev.targetCompletionPeriod ? `${this.formatCompactPeriod(ev.targetCompletionPeriod)}` : '—')
        : Utils.formatCurrency(ev.worstMonth.balanceAfter);
      const thirdMetricClass = ev.mode === 'save' ? 'text-indigo-300' : worstClass;

      const financingDetailsHtml = (ev.mode === 'financing' && ev.remainingAmount > 0 && ev.monthlyImpact > 0) ? `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="p-2 rounded-lg bg-slate-900/70 border border-slate-800/90">
            <span class="block text-[10px] text-slate-400">Valor financiado</span>
            <span class="font-bold text-slate-100 text-[11px]">${Utils.formatCurrency(ev.financedAmount)}</span>
            <span class="block text-[10px] text-slate-500">Entrada: ${Utils.formatCurrency(ev.savedAmount)}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-900/70 border border-slate-800/90">
            <span class="block text-[10px] text-slate-400">Total em juros</span>
            <span class="font-bold ${ev.totalInterest > 0 ? 'text-amber-300' : 'text-emerald-300'} text-[11px]">+${Utils.formatCurrency(ev.totalInterest)}</span>
            <span class="block text-[10px] text-slate-500">+${ev.interestOverPrincipalPercent}% s/ financiado</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-900/70 border border-slate-800/90">
            <span class="block text-[10px] text-slate-400">Custo total final</span>
            <span class="font-bold text-indigo-300 text-[11px]">${Utils.formatCurrency(ev.totalCost)}</span>
            <span class="block text-[10px] text-slate-500">Entrada + parcelas</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-900/70 border border-slate-800/90">
            <span class="block text-[10px] text-slate-400">Taxa efetiva (${ev.amortizationType.toUpperCase()})</span>
            <span class="font-bold text-slate-100 text-[11px]">${ev.effectiveMonthlyRatePct.toFixed(2).replace('.', ',')}% a.m.</span>
            <span class="block text-[10px] text-slate-500">${ev.effectiveAnnualRatePct.toFixed(2).replace('.', ',')}% a.a.</span>
          </div>
        </div>
      ` : '';

      const progressBarHtml = (ev.mode === 'save' || ev.savedAmount > 0) ? `
        <div class="space-y-1 pt-0.5">
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>${ev.mode === 'save' ? 'Reserva' : 'Entrada'}: <strong class="text-slate-200">${Utils.formatCurrency(ev.savedAmount)}</strong> de ${Utils.formatCurrency(ev.targetAmount)}</span>
            <span>${ev.mode === 'financing' ? 'Financiado' : 'Falta'}: <strong class="text-slate-200">${Utils.formatCurrency(ev.remainingAmount)}</strong> (${ev.progressPercent}%)</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${ev.progressPercent}%; background-color: ${meta.barColor};"></div>
          </div>
        </div>
      ` : '';

      const hasDeferredStart = ev.mode !== 'save' && ev.remainingAmount > 0 && (ev.firstInstallmentOffset || 0) > 0;
      const startBadgeHtml = hasDeferredStart
        ? `<span class="text-[11px] font-medium text-indigo-300/90 ml-1.5">• 1ª parc. ${this.formatCompactPeriod(ev.firstInstallmentPeriod)}</span>`
        : '';

      let secondMetricLabel = 'Saldo do mês após';
      let secondMetricValue = balanceAfterCurrent;
      let entryImpactSubline = `<span class="block text-[10px] text-slate-500">Antes: ${Utils.formatCurrency(currentBase.balanceBefore)}</span>`;

      if (hasDeferredStart && ev.downPaymentMonthImpact > 0) {
        secondMetricLabel = `Saldo ${this.formatCompactPeriod(this.state.currentPeriod)} (entrada)`;
        secondMetricValue = balanceAfterCurrent;
        entryImpactSubline = `<span class="block text-[10px] text-amber-300/90">Entrada agora • 1ª parc. em ${this.formatCompactPeriod(ev.firstInstallmentPeriod)}</span>`;
      } else if (hasDeferredStart) {
        const refFirst = ev.firstInstallmentMonth || ev.currentMonth;
        secondMetricLabel = `Saldo ${this.formatCompactPeriod(ev.firstInstallmentPeriod)} (1ª parc.)`;
        secondMetricValue = refFirst.balanceAfter;
        entryImpactSubline = `<span class="block text-[10px] text-slate-400">Antes: ${Utils.formatCurrency(refFirst.balanceBefore)} • ${this.formatCompactPeriod(this.state.currentPeriod)} livre</span>`;
      } else if (ev.downPaymentMonthImpact > 0) {
        entryImpactSubline = `<span class="block text-[10px] text-amber-300/90">Inclui entrada de ${Utils.formatCurrency(ev.downPaymentMonthImpact)} no mês 1</span>`;
      }

      const secondMetricClass = secondMetricValue >= 0 ? 'text-emerald-300' : 'text-rose-300';
      const checkPeriodLabel = (!ev.categoryCheckPeriod || ev.categoryCheckPeriod === this.state.currentPeriod)
        ? 'neste mês'
        : `em ${this.formatCompactPeriod(ev.categoryCheckPeriod)}`;

      const categoryWarningHtml = ev.categoryExceedsBudget ? `
        <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] flex items-start gap-2">
          <i class="fa-solid fa-bullseye mt-0.5 flex-shrink-0 text-amber-400"></i>
          <span>Teto da categoria <strong>${Utils.escapeHTML(draft.category)}</strong> (${Utils.formatCurrency(ev.categoryBudget)}): seria ultrapassado em <strong>${Utils.formatCurrency(ev.categoryOverflowAmount)}</strong> ${checkPeriodLabel}.</span>
        </div>
      ` : '';

      const timelineSlice = ev.timeline.slice(0, 6);
      const timelineChipsHtml = timelineSlice.length > 1 ? `
        <div class="pt-1 space-y-1">
          <div class="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            <span>Projeção de saldo pós-compromisso${ev.timeline.length > 6 ? ` (primeiros ${timelineSlice.length} meses)` : ''}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${timelineSlice.map(m => {
              const chipColor = m.balanceAfter >= 0
                ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-200';
              const chipTag = m.isDownPaymentOnly ? ' <span class="text-[9px] text-amber-300">(entrada)</span>' : '';
              return `<span class="px-2 py-0.5 rounded-md border text-[10px] font-medium ${chipColor}">${this.formatCompactPeriod(m.period)}${chipTag}: <strong>${Utils.formatCurrency(m.balanceAfter)}</strong></span>`;
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
            <div class="flex items-center gap-2 flex-wrap">
              <i class="fa-solid ${meta.icon} ${meta.textClass}"></i>
              <span class="font-bold text-slate-100">${headlineValue}</span>${startBadgeHtml}
            </div>
            <span class="status-pill ${meta.pillClass} text-[10px]">${meta.label}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span class="block text-[10px] text-slate-400">${ev.mode === 'financing' && ev.amortizationType === 'sac' ? '1ª parcela' : 'Peso mensal'}</span>
              <span class="font-bold text-slate-100">${Utils.formatCurrency(ev.monthlyImpact)}</span>
              <span class="text-[10px] text-slate-400 ml-1">(${ev.incomeSharePercent}% renda)</span>
            </div>
            <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span class="block text-[10px] text-slate-400">${secondMetricLabel}</span>
              <span class="font-bold ${secondMetricClass}">${Utils.formatCurrency(secondMetricValue)}</span>
              ${entryImpactSubline}
            </div>
            <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span class="block text-[10px] text-slate-400">${thirdMetricLabel}</span>
              <span class="font-bold ${thirdMetricClass}">${thirdMetricValue}</span>
            </div>
          </div>

          ${financingDetailsHtml}
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
        const rA = (PLAN_PRIORITY_META[a.priority] || PLAN_PRIORITY_META.important).rank;
        const rB = (PLAN_PRIORITY_META[b.priority] || PLAN_PRIORITY_META.important).rank;
        return rA - rB;
      });

      if (this.plansCountBadge) {
        this.plansCountBadge.textContent = `${plans.length} ${plans.length === 1 ? 'plano' : 'planos'}`;
      }

      const activePlans = plans.filter(p => p.status === 'active');
      if (this.plansPriorityInsight) {
        if (activePlans.length >= 2) {
          const hasEssentialOrImportant = activePlans.some(p => (p.priority || 'important') !== 'desire');
          const desirePlans = activePlans.filter(p => p.priority === 'desire');
          const sumAllActive = activePlans.reduce((s, p) => s + (p.targetAmount || 0), 0);
          const freeMonth = this.getMonthBaseline(this.state.currentPeriod).balanceBefore;
          this.plansPriorityInsight.classList.remove('hidden');
          if (hasEssentialOrImportant && desirePlans.length > 0) {
            this.plansPriorityInsight.innerHTML = `<i class="fa-solid fa-scale-balanced text-indigo-400 mr-1.5"></i><strong>Priorização:</strong> Você tem ${activePlans.length} planos ativos (${Utils.formatCurrency(sumAllActive)}). Ordene executando primeiro os itens <strong>Essenciais / Importantes</strong> antes dos <strong>Desejos</strong> (folga atual do mês: ${Utils.formatCurrency(freeMonth)}).`;
          } else {
            this.plansPriorityInsight.innerHTML = `<i class="fa-solid fa-compass text-indigo-400 mr-1.5"></i>Comparativo: ${activePlans.length} planos ativos somando <strong>${Utils.formatCurrency(sumAllActive)}</strong> no total.`;
          }
        } else {
          this.plansPriorityInsight.classList.add('hidden');
        }
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
        const prioMeta = PLAN_PRIORITY_META[plan.priority] || PLAN_PRIORITY_META.important;
        const modeBadge = plan.mode === 'save'
          ? 'Juntar/mês'
          : (plan.mode === 'financing'
            ? `Financ. (${plan.installments}x)`
            : (plan.installments > 1 ? `Parcelado (${plan.installments}x)` : 'À vista (1x)'));

        const firstInstBadge = (!isCompleted && plan.mode !== 'save' && ev.remainingAmount > 0 && ev.firstInstallmentPeriod)
          ? ` • 1ª parc: ${this.formatCompactPeriod(ev.firstInstallmentPeriod)}`
          : '';
        const subtitleLine = plan.mode === 'financing'
          ? `${Utils.escapeHTML(plan.category)} • Conta Fixa (dia ${plan.financingDueDay || 10})${firstInstBadge}`
          : `${Utils.escapeHTML(plan.category)} • ${Utils.escapeHTML(plan.paymentMethod)}${firstInstBadge}`;

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
        } else if (plan.mode === 'financing') {
          const entryNote = plan.savedAmount > 0
            ? ` • Entrada: <strong class="text-slate-200">${Utils.formatCurrency(plan.savedAmount)}</strong> (${plan.downPaymentSource === 'month_budget' ? 'no mês' : 'guardada'})`
            : '';
          const finSummary = ev.remainingAmount === 0
            ? '100% coberto pela entrada'
            : `${ev.installments}x de <strong class="text-indigo-300">${Utils.formatCurrency(ev.monthlyImpact)}</strong> • Juros: <span class="text-amber-300">+${Utils.formatCurrency(ev.totalInterest)}</span> (${ev.effectiveMonthlyRatePct.toFixed(2).replace('.', ',')}% a.m.) • Total: <strong class="text-slate-200">${Utils.formatCurrency(ev.totalCost)}</strong>`;
          detailLine = `Bem: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong>${entryNote}<br/>${finSummary} • Pior mês: <span class="${ev.worstMonth.balanceAfter >= 0 ? 'text-slate-200' : 'text-rose-300'} font-semibold">${Utils.formatCurrency(ev.worstMonth.balanceAfter)}</span>`;
        } else {
          const financedText = ev.remainingAmount === 0
            ? (ev.downPaymentMonthImpact > 0 ? `À vista (mês): ${Utils.formatCurrency(ev.downPaymentMonthImpact)}` : '100% coberto pela entrada')
            : (plan.installments > 1 ? `${plan.installments}x de ${Utils.formatCurrency(ev.monthlyImpact)}` : Utils.formatCurrency(ev.monthlyImpact));
          const entryInfo = (plan.savedAmount > 0 && ev.remainingAmount > 0)
            ? ` • Entrada: <strong class="text-slate-200">${Utils.formatCurrency(plan.savedAmount)}</strong> (${plan.downPaymentSource === 'month_budget' ? 'no mês' : 'guardada'})`
            : '';
          detailLine = `Alvo: <strong class="text-slate-200">${Utils.formatCurrency(plan.targetAmount)}</strong>${entryInfo} • Impacto: <strong class="text-slate-200">${financedText}</strong> • Pior mês: <span class="${ev.worstMonth.balanceAfter >= 0 ? 'text-slate-200' : 'text-rose-300'} font-semibold">${Utils.formatCurrency(ev.worstMonth.balanceAfter)}</span>`;
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
                    <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${prioMeta.badgeClass}"><i class="fa-solid ${prioMeta.icon} text-[9px] mr-1"></i>${prioMeta.label}</span>
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    ${subtitleLine}
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
      if (draft.mode === 'financing' && draft.financingCalcBy === 'installment' && remaining > 0 && draft.financingInstallmentAmount <= 0) {
        Toast.show('Informe o valor da parcela proposta pelo banco ou loja.', 'warning');
        this.planFinancingInstallmentInput?.focus();
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

      const ev = this.evaluatePlan(plan);
      const remainingAmount = ev.remainingAmount;
      const downPaymentMonthImpact = (plan.mode !== 'save' && plan.downPaymentSource === 'month_budget' && ev.savedAmount > 0)
        ? Math.min(ev.savedAmount, ev.targetAmount || ev.savedAmount)
        : 0;

      if (plan.mode === 'financing' && remainingAmount > 0 && ev.monthlyImpact <= 0) {
        Toast.show('Informe a taxa ou o valor da parcela do financiamento antes de efetivar.', 'warning');
        this.openPlanningModal(plan.id);
        return;
      }

      const currentPeriod = this.state.currentPeriod;
      const firstInstallmentOffset = this.getPlanFirstInstallmentOffset(plan);
      const firstInstallmentPeriod = Utils.shiftPeriod(currentPeriod, firstInstallmentOffset);
      const dueDay = Math.max(1, Math.min(31, parseInt(plan.financingDueDay, 10) || 10));
      const dueDate = Utils.shiftDateToPeriod(`${firstInstallmentPeriod}-${String(dueDay).padStart(2, '0')}`, firstInstallmentPeriod) || `${firstInstallmentPeriod}-10`;

      let confirmMsg = '';
      if (plan.mode === 'financing') {
        if (remainingAmount > 0) {
          const billTitlePreview = `${plan.title} (Financ. 1/${ev.installments})`;
          const dueMonthNote = firstInstallmentOffset > 0 ? ` — ${Utils.formatPeriod(firstInstallmentPeriod)}` : '';
          const entryNote = downPaymentMonthImpact > 0
            ? ` Também será lançado agora em ${Utils.formatPeriod(currentPeriod)} o valor de ${Utils.formatCurrency(downPaymentMonthImpact)} referente à Entrada em Gastos Diários (Pix).`
            : (ev.savedAmount > 0 ? ` (com ${Utils.formatCurrency(ev.savedAmount)} de entrada já separada).` : '.');
          confirmMsg = `Deseja efetivar o financiamento "${plan.title}"? Será criada a Conta Fixa "${billTitlePreview}" no valor de ${Utils.formatCurrency(ev.monthlyImpact)} (vencimento ${Utils.formatDate(dueDate)}${dueMonthNote}, categoria ${plan.category})${entryNote}`;
        } else if (downPaymentMonthImpact > 0) {
          confirmMsg = `Deseja efetivar "${plan.title}"? A entrada cobre 100% do valor e será lançada em Gastos Diários (${Utils.formatCurrency(downPaymentMonthImpact)} via Pix, categoria ${plan.category}).`;
        } else {
          confirmMsg = `Marcar "${plan.title}" como concluído? Como o valor já está 100% coberto pela entrada guardada, nenhuma conta fixa ou gasto adicional será lançado.`;
        }
      } else if (plan.mode === 'installment' && remainingAmount > 0) {
        const startNote = firstInstallmentOffset > 0 ? `, 1ª parcela em ${Utils.formatPeriod(firstInstallmentPeriod)}` : '';
        const condText = plan.installments > 1
          ? `${plan.installments} parcelas em ${plan.paymentMethod}${startNote}`
          : `1 lançamento à vista (${plan.paymentMethod}${startNote})`;
        const entryNote = ev.savedAmount > 0
          ? (downPaymentMonthImpact > 0
            ? ` + lançamento imediato da entrada de ${Utils.formatCurrency(downPaymentMonthImpact)} em ${Utils.formatPeriod(currentPeriod)} via Pix`
            : ` (descontando ${Utils.formatCurrency(ev.savedAmount)} de entrada/reserva já guardada)`)
          : '';
        confirmMsg = `Deseja efetivar "${plan.title}"? Será lançado o valor de ${Utils.formatCurrency(remainingAmount)} em Gastos Diários (${condText}, categoria ${plan.category})${entryNote}.`;
      } else if (plan.mode === 'installment' && downPaymentMonthImpact > 0) {
        confirmMsg = `Deseja efetivar "${plan.title}"? Será lançado o pagamento à vista de ${Utils.formatCurrency(downPaymentMonthImpact)} em Gastos Diários (${plan.paymentMethod}, categoria ${plan.category}).`;
      } else if (plan.mode === 'save') {
        confirmMsg = `Marcar a meta "${plan.title}" como efetivada? Como é um plano de economia acumulada, nenhum gasto parcelado será lançado automaticamente no mês.`;
      } else {
        confirmMsg = `Marcar "${plan.title}" como concluído? Como o valor já está 100% coberto pela entrada/reserva, nenhum gasto mensal adicional será lançado.`;
      }

      if (plan.priority === 'desire') {
        confirmMsg += ' ⚠️ Este plano está classificado como "Desejo": confirme se caberá sem comprometer seus gastos essenciais e metas.';
      }

      const confirmed = await ConfirmDialog.open({
        title: 'Efetivar Compra Planejada',
        message: confirmMsg,
        confirmText: 'Efetivar',
        variant: 'success',
        icon: 'fa-check'
      });
      if (!confirmed) return;

      const startDateISO = this.getEffectivePlanStartDate();
      const firstInstallmentStartDateISO = Utils.shiftDateToPeriod(startDateISO, firstInstallmentPeriod) || startDateISO;
      const planNature = plan.priority === 'desire'
        ? 'superfluous'
        : (plan.priority === 'essential' ? 'essential' : this.getDefaultNatureForCategory(plan.category));

      if (plan.mode === 'financing') {
        let feedbackParts = [];
        if (remainingAmount > 0) {
          if (!Array.isArray(this.state.bills)) this.state.bills = [];
          this.state.bills.push({
            id: Utils.generateUUID(),
            title: `${plan.title} (Financ. 1/${ev.installments})`,
            amount: ev.monthlyImpact,
            dueDate,
            category: plan.category,
            nature: planNature,
            paid: false,
            financingPlanId: plan.id,
            financingCurrentInstallment: 1,
            financingTotalInstallments: ev.installments,
            createdAt: new Date().toISOString()
          });
          feedbackParts.push(`Conta fixa da 1ª parcela em ${this.formatCompactPeriod(firstInstallmentPeriod)} (${Utils.formatCurrency(ev.monthlyImpact)}) cadastrada`);
        }
        if (downPaymentMonthImpact > 0) {
          if (!Array.isArray(this.state.expenses)) this.state.expenses = [];
          this.state.expenses.unshift({
            id: Utils.generateUUID(),
            description: remainingAmount > 0 ? `Entrada: ${plan.title}` : plan.title,
            amount: downPaymentMonthImpact,
            date: startDateISO,
            category: plan.category,
            method: 'Pix',
            nature: planNature,
            createdAt: new Date().toISOString()
          });
          feedbackParts.push(`entrada de ${Utils.formatCurrency(downPaymentMonthImpact)} lançada`);
        }

        Toast.show(
          feedbackParts.length > 0
            ? `Financiamento "${plan.title}" efetivado (${feedbackParts.join(' e ')})!`
            : `Financiamento "${plan.title}" marcado como efetivado!`,
          'success'
        );
      } else if (plan.mode === 'installment' && remainingAmount > 0) {
        const { installments: createdExpenses } = this.buildInstallmentExpenses({
          description: plan.title,
          amount: remainingAmount,
          amountType: 'total',
          count: plan.installments,
          startDateISO: firstInstallmentStartDateISO,
          category: plan.category,
          method: plan.paymentMethod,
          nature: planNature
        });
        this.state.expenses.unshift(...createdExpenses);
        if (downPaymentMonthImpact > 0) {
          this.state.expenses.unshift({
            id: Utils.generateUUID(),
            description: `Entrada: ${plan.title}`,
            amount: downPaymentMonthImpact,
            date: startDateISO,
            category: plan.category,
            method: 'Pix',
            nature: planNature,
            createdAt: new Date().toISOString()
          });
        }
        const parcelStartLabel = firstInstallmentOffset > 0 ? ` a partir de ${this.formatCompactPeriod(firstInstallmentPeriod)}` : '';
        Toast.show(
          createdExpenses.length > 1
            ? `Compra "${plan.title}" efetivada em ${createdExpenses.length}x nos Gastos Diários${parcelStartLabel}!`
            : `Compra "${plan.title}" lançada em Gastos Diários${parcelStartLabel}!`,
          'success'
        );
      } else if (plan.mode === 'installment' && downPaymentMonthImpact > 0) {
        this.state.expenses.unshift({
          id: Utils.generateUUID(),
          description: plan.title,
          amount: downPaymentMonthImpact,
          date: startDateISO,
          category: plan.category,
          method: plan.paymentMethod,
          nature: planNature,
          createdAt: new Date().toISOString()
        });
        Toast.show(`Compra "${plan.title}" lançada em Gastos Diários!`, 'success');
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
    // CAIXINHAS E RESERVAS (DINHEIRO GUARDADO)
    // ========================================================================
    getTotalReservesBalance() {
      const total = (this.state.reserves || []).reduce((sum, r) => sum + (r.balance || 0), 0);
      return Math.round(total * 100) / 100;
    },

    getPeriodReserveFlow(period = this.state.currentPeriod) {
      let depositedInMonth = 0;
      let withdrawnToMonth = 0;
      let monthMovementCount = 0;

      (this.state.reserves || []).forEach(reserve => {
        (reserve.movements || []).forEach(mov => {
          if (!(mov.date || '').startsWith(period)) return;
          if (!mov.affectMonthBalance) return;
          monthMovementCount++;
          if (mov.type === 'deposit') {
            depositedInMonth += mov.amount || 0;
          } else if (mov.type === 'withdraw') {
            withdrawnToMonth += mov.amount || 0;
          }
        });
      });

      depositedInMonth = Math.round(depositedInMonth * 100) / 100;
      withdrawnToMonth = Math.round(withdrawnToMonth * 100) / 100;
      const netSavedInMonth = Math.round((depositedInMonth - withdrawnToMonth) * 100) / 100;

      return {
        depositedInMonth,
        withdrawnToMonth,
        netSavedInMonth,
        monthMovementCount
      };
    },

    getReserveEffectiveDefaultDate() {
      const todayISO = Utils.getTodayISO();
      const period = this.state.currentPeriod;
      if (todayISO.startsWith(period)) return todayISO;
      const dayNum = parseInt(todayISO.split('-')[2], 10) || 10;
      const [year, month] = period.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      return `${period}-${String(Math.min(dayNum, daysInMonth)).padStart(2, '0')}`;
    },

    setReserveTab(tab) {
      const normalizedTab = tab === 'manage' ? 'manage' : 'move';

      this.reserveTabBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-reserve-tab') === normalizedTab;
        if (isActive) {
          btn.classList.add('bg-teal-600', 'text-white', 'shadow-sm');
          btn.classList.remove('text-slate-400', 'hover:text-white');
        } else {
          btn.classList.remove('bg-teal-600', 'text-white', 'shadow-sm');
          btn.classList.add('text-slate-400', 'hover:text-white');
        }
      });

      if (normalizedTab === 'manage') {
        this.reserveMovePanel?.classList.add('hidden');
        this.reserveManagePanel?.classList.remove('hidden');
      } else {
        this.reserveMovePanel?.classList.remove('hidden');
        this.reserveManagePanel?.classList.add('hidden');
      }
    },

    setReserveOp(op) {
      const normalizedOp = op === 'withdraw' ? 'withdraw' : 'deposit';
      if (this.reserveOpTypeInput) this.reserveOpTypeInput.value = normalizedOp;

      this.reserveOpBtns.forEach(btn => {
        const btnOp = btn.getAttribute('data-reserve-op');
        const isActive = btnOp === normalizedOp;
        btn.classList.remove('bg-emerald-600', 'bg-amber-600', 'text-white', 'shadow-sm', 'text-slate-400', 'hover:text-white');
        if (isActive) {
          btn.classList.add(normalizedOp === 'deposit' ? 'bg-emerald-600' : 'bg-amber-600', 'text-white', 'shadow-sm');
        } else {
          btn.classList.add('text-slate-400', 'hover:text-white');
        }
      });

      if (normalizedOp === 'deposit') {
        if (this.reserveMoveAffectMonthCheckbox) this.reserveMoveAffectMonthCheckbox.checked = true;
        if (this.reserveMoveAffectMonthLabel) this.reserveMoveAffectMonthLabel.textContent = 'Abater do Saldo Restante deste mês';
        if (this.reserveMoveAffectMonthHint) {
          this.reserveMoveAffectMonthHint.textContent = 'Reduz a folga livre do mês para evitar gastar o que já foi guardado (sem contar como gasto diário).';
        }
        if (this.reserveMoveSubmitBtn) {
          this.reserveMoveSubmitBtn.className = 'w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-semibold transition-smooth shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5';
          this.reserveMoveSubmitBtn.innerHTML = '<i class="fa-solid fa-piggy-bank"></i><span>Confirmar Aporte</span>';
        }
      } else {
        if (this.reserveMoveAffectMonthCheckbox) this.reserveMoveAffectMonthCheckbox.checked = false;
        if (this.reserveMoveAffectMonthLabel) this.reserveMoveAffectMonthLabel.textContent = 'Somar no Saldo Restante deste mês';
        if (this.reserveMoveAffectMonthHint) {
          this.reserveMoveAffectMonthHint.textContent = 'Marque se estiver usando essa reserva para pagar contas ou despesas deste mês.';
        }
        if (this.reserveMoveSubmitBtn) {
          this.reserveMoveSubmitBtn.className = 'w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white rounded-xl text-xs font-semibold transition-smooth shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5';
          this.reserveMoveSubmitBtn.innerHTML = '<i class="fa-solid fa-hand-holding-dollar"></i><span>Confirmar Resgate</span>';
        }
      }
    },

    populateReserveMoveSelect(preferredId = null) {
      if (!this.reserveMoveSelect) return;

      const reserves = this.state.reserves || [];
      if (reserves.length === 0) {
        this.reserveMoveSelect.innerHTML = '<option value="">Crie uma caixinha na aba ao lado primeiro</option>';
        this.reserveMoveSelect.disabled = true;
        if (this.reserveMoveSubmitBtn) this.reserveMoveSubmitBtn.disabled = true;
        if (this.reserveMoveSelectedBalance) this.reserveMoveSelectedBalance.textContent = 'Saldo: R$ 0,00';
        return;
      }

      this.reserveMoveSelect.disabled = false;
      if (this.reserveMoveSubmitBtn) this.reserveMoveSubmitBtn.disabled = false;

      const currentVal = preferredId || this.reserveMoveSelect.value;
      this.reserveMoveSelect.innerHTML = reserves
        .map(r => `<option value="${r.id}">${Utils.escapeHTML(r.title)} (${Utils.formatCurrency(r.balance)})</option>`)
        .join('');

      if (currentVal && reserves.some(r => r.id === currentVal)) {
        this.reserveMoveSelect.value = currentVal;
      } else {
        this.reserveMoveSelect.value = reserves[0].id;
      }

      this.updateSelectedReserveBalanceDisplay();
    },

    updateSelectedReserveBalanceDisplay() {
      if (!this.reserveMoveSelectedBalance || !this.reserveMoveSelect) return;
      const selectedId = this.reserveMoveSelect.value;
      const reserve = (this.state.reserves || []).find(r => r.id === selectedId);
      const bal = reserve ? (reserve.balance || 0) : 0;
      this.reserveMoveSelectedBalance.textContent = `Saldo: ${Utils.formatCurrency(bal)}`;
    },

    resetReserveForm() {
      this.reserveForm?.reset();
      if (this.reserveEditId) this.reserveEditId.value = '';
      if (this.reserveFormTitle) this.reserveFormTitle.textContent = 'Nova Caixinha / Reserva';
      this.cancelReserveEditBtn?.classList.add('hidden');
      if (this.reserveTypeSelect) this.reserveTypeSelect.value = 'Reserva de Emergência';
      if (this.reserveBalanceInput) this.reserveBalanceInput.value = '0,00';
      if (this.reserveGoalInput) this.reserveGoalInput.value = '0,00';
      if (this.reserveBalanceHint) {
        this.reserveBalanceHint.textContent = 'Saldo já existente não altera a renda nem o saldo livre deste mês.';
      }
      if (this.reserveSubmitBtn) {
        this.reserveSubmitBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span>Criar Caixinha</span>';
      }
    },

    resetReserveMoveForm(reserveId = null, op = 'deposit') {
      this.populateReserveMoveSelect(reserveId);
      if (this.reserveMoveAmountInput) this.reserveMoveAmountInput.value = '0,00';
      if (this.reserveMoveDateInput) this.reserveMoveDateInput.value = this.getReserveEffectiveDefaultDate();
      if (this.reserveMoveNoteInput) this.reserveMoveNoteInput.value = '';
      this.setReserveOp(op);
    },

    openReservesModal({ tab = null, op = 'deposit', reserveId = null, editId = null } = {}) {
      const hasReserves = (this.state.reserves || []).length > 0;

      if (this.reservesModalTotal) {
        this.reservesModalTotal.textContent = Utils.formatCurrency(this.getTotalReservesBalance());
      }

      if (editId) {
        this.resetReserveMoveForm(editId, 'deposit');
        this.openEditReserve(editId);
      } else {
        this.resetReserveForm();
        this.resetReserveMoveForm(reserveId, op);
        const resolvedTab = tab || (hasReserves ? 'move' : 'manage');
        this.setReserveTab(resolvedTab);
      }

      this.renderReservesModalList();
      this.openModal(this.reservesModal);

      if (editId || (!hasReserves && !tab) || tab === 'manage') {
        this.reserveTitleInput?.focus();
      } else {
        this.reserveMoveAmountInput?.focus();
      }
    },

    openEditReserve(reserveId) {
      const reserve = (this.state.reserves || []).find(r => r.id === reserveId);
      if (!reserve) return;

      if (this.reserveEditId) this.reserveEditId.value = reserve.id;
      if (this.reserveFormTitle) this.reserveFormTitle.textContent = 'Editar Caixinha';
      this.cancelReserveEditBtn?.classList.remove('hidden');
      if (this.reserveTitleInput) this.reserveTitleInput.value = reserve.title;
      if (this.reserveTypeSelect) {
        this.reserveTypeSelect.value = RESERVE_TYPE_META[reserve.type] ? reserve.type : 'Outros';
      }
      if (this.reserveBalanceInput) {
        this.reserveBalanceInput.value = Utils.formatNumberToInput(reserve.balance || 0);
      }
      if (this.reserveGoalInput) {
        this.reserveGoalInput.value = Utils.formatNumberToInput(reserve.goalAmount || 0);
      }
      if (this.reserveBalanceHint) {
        this.reserveBalanceHint.textContent = 'Alterar o saldo aqui registra um ajuste direto sem afetar o saldo do mês.';
      }
      if (this.reserveSubmitBtn) {
        this.reserveSubmitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Salvar Alterações</span>';
      }

      this.setReserveTab('manage');
      if (this.reservesModalBody) this.reservesModalBody.scrollTop = 0;
    },

    handleReserveSubmit(e) {
      e.preventDefault();
      const editId = this.reserveEditId?.value || '';
      const title = (this.reserveTitleInput?.value || '').trim();
      const rawType = this.reserveTypeSelect?.value || 'Outros';
      const type = RESERVE_TYPE_META[rawType] ? rawType : 'Outros';
      const balance = Math.max(0, Math.round(Utils.parseCurrency(this.reserveBalanceInput?.value || '0') * 100) / 100);
      const goalAmount = Math.max(0, Math.round(Utils.parseCurrency(this.reserveGoalInput?.value || '0') * 100) / 100);

      if (!title) {
        Toast.show('Informe o nome da caixinha ou reserva.', 'warning');
        this.reserveTitleInput?.focus();
        return;
      }

      if (!Array.isArray(this.state.reserves)) this.state.reserves = [];

      let activeReserveId = editId;
      if (editId) {
        const idx = this.state.reserves.findIndex(r => r.id === editId);
        if (idx !== -1) {
          const existing = this.state.reserves[idx];
          const movements = [...(existing.movements || [])];
          const delta = Math.round((balance - (existing.balance || 0)) * 100) / 100;

          if (Math.abs(delta) >= 0.01) {
            movements.unshift(Storage.normalizeReserveMovement({
              id: Utils.generateUUID(),
              type: delta > 0 ? 'deposit' : 'withdraw',
              amount: Math.abs(delta),
              date: Utils.getTodayISO(),
              note: 'Ajuste manual de saldo',
              affectMonthBalance: false,
              createdAt: new Date().toISOString()
            }));
          }

          this.state.reserves[idx] = Storage.normalizeReserve({
            ...existing,
            title,
            type,
            balance,
            goalAmount,
            movements,
            updatedAt: new Date().toISOString()
          });
          Toast.show(`Caixinha "${title}" atualizada!`, 'success');
        }
      } else {
        const movements = [];
        if (balance > 0) {
          movements.push(Storage.normalizeReserveMovement({
            id: Utils.generateUUID(),
            type: 'initial',
            amount: balance,
            date: Utils.getTodayISO(),
            note: 'Saldo inicial já guardado',
            affectMonthBalance: false,
            createdAt: new Date().toISOString()
          }));
        }

        const created = Storage.normalizeReserve({
          id: Utils.generateUUID(),
          title,
          type,
          balance,
          goalAmount,
          movements,
          createdAt: new Date().toISOString()
        });

        this.state.reserves.unshift(created);
        activeReserveId = created.id;
        Toast.show(
          balance > 0
            ? `Caixinha "${created.title}" criada com ${Utils.formatCurrency(balance)}!`
            : `Caixinha "${created.title}" criada!`,
          'success'
        );
      }

      Storage.save(this.state);
      this.resetReserveForm();
      this.resetReserveMoveForm(activeReserveId, 'deposit');
      this.render();
    },

    handleReserveMoveSubmit(e) {
      e.preventDefault();
      const reserveId = this.reserveMoveSelect?.value || '';
      const reserve = (this.state.reserves || []).find(r => r.id === reserveId);

      if (!reserve) {
        Toast.show('Crie uma caixinha antes de registrar movimentações.', 'warning');
        this.setReserveTab('manage');
        return;
      }

      const op = this.reserveOpTypeInput?.value === 'withdraw' ? 'withdraw' : 'deposit';
      const amount = Math.round(Utils.parseCurrency(this.reserveMoveAmountInput?.value || '0') * 100) / 100;
      const date = this.reserveMoveDateInput?.value || '';
      const note = (this.reserveMoveNoteInput?.value || '').trim();
      const affectMonthBalance = Boolean(this.reserveMoveAffectMonthCheckbox?.checked);

      if (amount <= 0) {
        Toast.show('O valor da movimentação deve ser maior que zero.', 'warning');
        this.reserveMoveAmountInput?.focus();
        return;
      }
      if (!date) {
        Toast.show('Selecione a data da movimentação.', 'warning');
        return;
      }
      if (op === 'withdraw' && amount > (reserve.balance || 0)) {
        Toast.show(`Saldo insuficiente em "${reserve.title}" (disponível: ${Utils.formatCurrency(reserve.balance)}).`, 'warning');
        return;
      }

      const nextBalance = op === 'deposit'
        ? Math.round(((reserve.balance || 0) + amount) * 100) / 100
        : Math.round(((reserve.balance || 0) - amount) * 100) / 100;

      const movement = Storage.normalizeReserveMovement({
        id: Utils.generateUUID(),
        type: op,
        amount,
        date,
        note,
        affectMonthBalance,
        createdAt: new Date().toISOString()
      });

      reserve.balance = Math.max(0, nextBalance);
      if (!Array.isArray(reserve.movements)) reserve.movements = [];
      reserve.movements.unshift(movement);
      reserve.updatedAt = new Date().toISOString();

      Storage.save(this.state);
      if (this.reserveMoveAmountInput) this.reserveMoveAmountInput.value = '0,00';
      if (this.reserveMoveNoteInput) this.reserveMoveNoteInput.value = '';
      this.render();

      Toast.show(
        op === 'deposit'
          ? `+${Utils.formatCurrency(amount)} guardado em "${reserve.title}"!`
          : `Resgate de ${Utils.formatCurrency(amount)} realizado em "${reserve.title}"!`,
        'success'
      );
    },

    async deleteReserveMovement(reserveId, movementId) {
      const reserve = (this.state.reserves || []).find(r => r.id === reserveId);
      if (!reserve) return;
      const mov = (reserve.movements || []).find(m => m.id === movementId);
      if (!mov) return;

      if ((mov.type === 'deposit' || mov.type === 'initial') && (reserve.balance || 0) < mov.amount) {
        Toast.show('Não é possível excluir este registro porque parte desse saldo já foi resgatada.', 'warning');
        return;
      }

      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Movimentação',
        message: `Deseja remover este registro de ${Utils.formatCurrency(mov.amount)} e recalcular o saldo de "${reserve.title}"?`,
        confirmText: 'Excluir',
        variant: 'danger'
      });
      if (!confirmed) return;

      const nextBalance = mov.type === 'withdraw'
        ? Math.round(((reserve.balance || 0) + mov.amount) * 100) / 100
        : Math.max(0, Math.round(((reserve.balance || 0) - mov.amount) * 100) / 100);

      reserve.balance = nextBalance;
      reserve.movements = (reserve.movements || []).filter(m => m.id !== movementId);
      reserve.updatedAt = new Date().toISOString();

      Storage.save(this.state);
      this.render();
      Toast.show('Movimentação removida e saldo atualizado.', 'info');
    },

    async deleteReserve(reserveId) {
      const reserve = (this.state.reserves || []).find(r => r.id === reserveId);
      if (!reserve) return;

      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Caixinha',
        message: `Deseja excluir "${reserve.title}" (saldo atual de ${Utils.formatCurrency(reserve.balance)}) e todo o histórico dela?`,
        confirmText: 'Excluir',
        variant: 'danger'
      });
      if (!confirmed) return;

      this.state.reserves = (this.state.reserves || []).filter(r => r.id !== reserveId);
      this.expandedReserveHistoryIds.delete(reserveId);

      if (this.reserveEditId?.value === reserveId) {
        this.resetReserveForm();
      }

      Storage.save(this.state);
      this.render();
      Toast.show('Caixinha excluída.', 'info');
    },

    renderReserves() {
      const reserves = this.state.reserves || [];
      const totalReserves = this.getTotalReservesBalance();
      const reserveFlow = this.getPeriodReserveFlow(this.state.currentPeriod);

      // 1. Atualiza Faixa do Topo
      if (this.topTotalReserves) {
        this.topTotalReserves.textContent = Utils.formatCurrency(totalReserves);
      }
      if (this.topReservesMetaText) {
        if (reserves.length === 0) {
          this.topReservesMetaText.textContent = 'Crie caixinhas para dinheiro já guardado ou novas reservas';
        } else {
          this.topReservesMetaText.textContent = `${reserves.length} ${reserves.length === 1 ? 'caixinha ativa' : 'caixinhas ativas'} • Saldo contínuo`;
        }
      }
      if (this.topMonthReservedBadge) {
        if (reserveFlow.netSavedInMonth > 0) {
          this.topMonthReservedBadge.textContent = `Guardado no mês: +${Utils.formatCurrency(reserveFlow.netSavedInMonth)}`;
          this.topMonthReservedBadge.className = 'px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/30 text-[11px] font-semibold text-teal-300';
        } else if (reserveFlow.netSavedInMonth < 0) {
          this.topMonthReservedBadge.textContent = `Usado no mês: ${Utils.formatCurrency(Math.abs(reserveFlow.netSavedInMonth))}`;
          this.topMonthReservedBadge.className = 'px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-300';
        } else {
          this.topMonthReservedBadge.textContent = 'Sem impacto no mês atual';
          this.topMonthReservedBadge.className = 'px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/70 text-[11px] font-medium text-slate-400';
        }
      }

      // 2. Atualiza Card da Coluna Direita
      if (this.sidebarTotalReserves) {
        this.sidebarTotalReserves.textContent = Utils.formatCurrency(totalReserves);
      }

      if (this.reservesBreakdownList) {
        if (reserves.length === 0) {
          this.reservesBreakdownList.innerHTML = `
            <div class="text-center py-4 text-slate-500 text-xs">
              <i class="fa-solid fa-piggy-bank text-2xl mb-1.5 opacity-40"></i>
              <p>Nenhum dinheiro guardado cadastrado.</p>
              <button id="quickOpenReservesBtn" type="button" class="mt-2.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-400/30 rounded-lg text-xs font-semibold transition-colors">
                Adicionar Dinheiro Guardado
              </button>
            </div>
          `;
          document.getElementById('quickOpenReservesBtn')?.addEventListener('click', () => this.openReservesModal({ tab: 'manage' }));
        } else {
          const visibleReserves = reserves.slice(0, 3);
          let html = '';

          visibleReserves.forEach(res => {
            const meta = RESERVE_TYPE_META[res.type] || RESERVE_TYPE_META['Outros'];
            const emergMetrics = res.type === 'Reserva de Emergência' ? this.getEmergencyReserveMetrics() : null;
            const effectiveGoal = (res.goalAmount || 0) > 0
              ? res.goalAmount
              : (emergMetrics && emergMetrics.suggestedTargetAmount > 0 ? emergMetrics.suggestedTargetAmount : 0);
            const hasGoal = effectiveGoal > 0;
            const percent = hasGoal ? Math.min(100, Math.round(((res.balance || 0) / effectiveGoal) * 100)) : 0;
            const goalPrefix = (res.goalAmount || 0) <= 0 && emergMetrics ? `Meta sugerida (${emergMetrics.targetMonths}m)` : 'Meta';

            const goalHtml = hasGoal ? `
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px] text-slate-400">
                  <span>${goalPrefix}: ${Utils.formatCurrency(effectiveGoal)}</span>
                  <span class="font-semibold text-teal-300">${percent}%</span>
                </div>
                <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500" style="width: ${percent}%; background-color: ${meta.color};"></div>
                </div>
              </div>
            ` : '';

            html += `
              <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-700/50 space-y-2">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px]" style="background-color: ${meta.color}20; color: ${meta.color};">
                      <i class="fa-solid ${meta.icon}"></i>
                    </div>
                    <div class="min-w-0">
                      <span class="font-semibold text-slate-200 truncate block">${Utils.escapeHTML(res.title)}</span>
                      <span class="text-[10px] text-slate-500 block">${Utils.escapeHTML(res.type)}</span>
                    </div>
                  </div>
                  <span class="font-bold text-teal-300 text-xs flex-shrink-0">${Utils.formatCurrency(res.balance)}</span>
                </div>
                ${goalHtml}
                <div class="pt-1 flex items-center justify-end gap-1.5 border-t border-slate-800/80">
                  <button type="button" data-sidebar-res-op="deposit" data-sidebar-res-id="${res.id}" class="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold transition-colors">
                    + Guardar
                  </button>
                  <button type="button" data-sidebar-res-op="withdraw" data-sidebar-res-id="${res.id}" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-semibold transition-colors">
                    - Resgatar
                  </button>
                </div>
              </div>
            `;
          });

          if (reserves.length > 3) {
            html += `
              <button type="button" id="viewAllReservesBtn" class="w-full py-1.5 text-[11px] font-medium text-teal-300 hover:text-teal-200 bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/20 rounded-lg transition-colors">
                Ver todas as ${reserves.length} caixinhas
              </button>
            `;
          }

          this.reservesBreakdownList.innerHTML = html;

          this.reservesBreakdownList.querySelectorAll('[data-sidebar-res-id]').forEach(btn => {
            btn.addEventListener('click', () => {
              this.openReservesModal({
                tab: 'move',
                op: btn.getAttribute('data-sidebar-res-op') || 'deposit',
                reserveId: btn.getAttribute('data-sidebar-res-id')
              });
            });
          });

          document.getElementById('viewAllReservesBtn')?.addEventListener('click', () => this.openReservesModal());
        }
      }

      // 3. Mantém Planejamento de Compras e Modal de Reservas sincronizados
      this.populatePlanReserveSelector();

      if (this.reservesModal && !this.reservesModal.classList.contains('hidden')) {
        if (this.reservesModalTotal) {
          this.reservesModalTotal.textContent = Utils.formatCurrency(totalReserves);
        }
        this.populateReserveMoveSelect();
        this.renderReservesModalList();
      }
    },

    renderReservesModalList() {
      if (!this.reservesListContainer) return;

      const reserves = this.state.reserves || [];
      if (this.reservesCountBadge) {
        this.reservesCountBadge.textContent = `${reserves.length} ${reserves.length === 1 ? 'caixinha' : 'caixinhas'}`;
      }

      if (this.reservesEmergencyBanner) {
        const em = this.getEmergencyReserveMetrics();
        this.reservesEmergencyBanner.classList.remove('hidden');
        if (em.monthlyBase <= 0) {
          this.reservesEmergencyBanner.className = 'p-3 rounded-xl border border-slate-700/70 bg-slate-900/70 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2';
          this.reservesEmergencyBanner.innerHTML = `<span><i class="fa-solid fa-shield-halved text-teal-400 mr-1.5"></i>Cadastre suas contas fixas para calcularmos sua meta automática de <strong>${em.targetMonths} meses</strong> na Reserva de Emergência.</span>`;
        } else {
          const isCovered = em.coveragePct >= 100;
          this.reservesEmergencyBanner.className = isCovered
            ? 'p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2'
            : 'p-3 rounded-xl border border-teal-500/30 bg-teal-500/10 text-xs text-teal-200 flex flex-wrap items-center justify-between gap-2';
          this.reservesEmergencyBanner.innerHTML = `
            <div>
              <strong><i class="fa-solid fa-shield-halved mr-1.5"></i>Reserva de Emergência (${em.monthsCovered} / ${em.targetMonths} meses):</strong>
              ${Utils.formatCurrency(em.emergencyBalance)} guardados de ${Utils.formatCurrency(em.suggestedTargetAmount)} sugeridos (base custo de vida ${Utils.formatCurrency(em.monthlyBase)}/mês).
            </div>
            <span class="px-2 py-0.5 rounded-full bg-slate-900/70 border border-teal-500/30 font-bold text-[11px]">${em.coveragePct}%</span>
          `;
        }
      }

      if (reserves.length === 0) {
        this.reservesListContainer.innerHTML = `
          <div class="text-center py-6 px-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-1.5">
            <i class="fa-solid fa-piggy-bank text-2xl text-slate-600"></i>
            <p class="text-xs font-semibold text-slate-300">Nenhuma caixinha cadastrada ainda</p>
            <p class="text-[11px] text-slate-500">Crie uma caixinha na aba "Nova Caixinha / Editar" e informe quanto já tem guardado ou comece do zero.</p>
          </div>
        `;
        return;
      }

      const OP_META = {
        initial: { label: 'Saldo inicial', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700', sign: '' },
        deposit: { label: 'Aporte', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', sign: '+' },
        withdraw: { label: 'Resgate', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30', sign: '-' }
      };

      const emergMetricsAll = this.getEmergencyReserveMetrics();
      let html = '';
      reserves.forEach(res => {
        const meta = RESERVE_TYPE_META[res.type] || RESERVE_TYPE_META['Outros'];
        const effectiveGoal = (res.goalAmount || 0) > 0
          ? res.goalAmount
          : (res.type === 'Reserva de Emergência' && emergMetricsAll.suggestedTargetAmount > 0 ? emergMetricsAll.suggestedTargetAmount : 0);
        const hasGoal = effectiveGoal > 0;
        const percent = hasGoal ? Math.min(100, Math.round(((res.balance || 0) / effectiveGoal) * 100)) : 0;
        const goalLabel = (res.goalAmount || 0) <= 0 && res.type === 'Reserva de Emergência'
          ? `Meta sugerida (${emergMetricsAll.targetMonths} meses)`
          : 'Meta';
        const movements = res.movements || [];
        const isExpanded = this.expandedReserveHistoryIds.has(res.id);

        const goalBarHtml = hasGoal ? `
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[11px] text-slate-400">
              <span>${goalLabel}: <strong class="text-slate-200">${Utils.formatCurrency(effectiveGoal)}</strong></span>
              <span class="font-semibold text-teal-300">${percent}% concluído</span>
            </div>
            <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width: ${percent}%; background-color: ${meta.color};"></div>
            </div>
          </div>
        ` : '';

        let historyHtml = '';
        if (isExpanded) {
          if (movements.length === 0) {
            historyHtml = `
              <div class="mt-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-500 text-center">
                Nenhuma movimentação registrada nesta caixinha ainda.
              </div>
            `;
          } else {
            historyHtml = `
              <div class="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                ${movements.map(mov => {
                  const om = OP_META[mov.type] || OP_META.deposit;
                  const amountColor = mov.type === 'withdraw' ? 'text-amber-300' : 'text-emerald-300';
                  const monthTag = mov.affectMonthBalance
                    ? '<span class="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[9px]">Impacta mês</span>'
                    : '<span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[9px]">Só reserva</span>';
                  return `
                    <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px]">
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="px-1.5 py-0.5 rounded border text-[9px] font-semibold ${om.badgeClass}">${om.label}</span>
                          <span class="text-slate-400">${Utils.formatDate(mov.date)}</span>
                          ${monthTag}
                        </div>
                        ${mov.note ? `<p class="text-slate-300 truncate mt-0.5">${Utils.escapeHTML(mov.note)}</p>` : ''}
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="font-bold ${amountColor}">${om.sign}${Utils.formatCurrency(mov.amount)}</span>
                        <button type="button" data-res-mov-del="${mov.id}" data-res-id="${res.id}" class="text-slate-500 hover:text-rose-400 p-1" title="Excluir movimentação">
                          <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }
        }

        html += `
          <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs" style="background-color: ${meta.color}20; color: ${meta.color};">
                  <i class="fa-solid ${meta.icon}"></i>
                </div>
                <div class="min-w-0">
                  <span class="font-bold text-slate-100 text-xs block truncate">${Utils.escapeHTML(res.title)}</span>
                  <span class="text-[11px] text-slate-400">${Utils.escapeHTML(res.type)}</span>
                </div>
              </div>
              <div class="text-right">
                <span class="block text-[10px] text-slate-400">Saldo guardado</span>
                <span class="text-sm font-bold text-teal-300">${Utils.formatCurrency(res.balance)}</span>
              </div>
            </div>

            ${goalBarHtml}

            <div class="pt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
              <div class="flex items-center gap-1.5">
                <button type="button" data-res-quick-op="deposit" data-res-id="${res.id}" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-colors">
                  + Guardar
                </button>
                <button type="button" data-res-quick-op="withdraw" data-res-id="${res.id}" class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-colors">
                  - Resgatar
                </button>
                <button type="button" data-res-toggle-hist="${res.id}" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium transition-colors">
                  ${isExpanded ? 'Ocultar' : `Histórico (${movements.length})`}
                </button>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" data-res-edit="${res.id}" class="action-icon-btn text-slate-400 hover:text-teal-400 hover:bg-teal-500/10" title="Editar caixinha">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <button type="button" data-res-delete="${res.id}" class="action-icon-btn text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" title="Excluir caixinha">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </div>

            ${historyHtml}
          </div>
        `;
      });

      this.reservesListContainer.innerHTML = html;

      this.reservesListContainer.querySelectorAll('[data-res-quick-op]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-res-id');
          const op = btn.getAttribute('data-res-quick-op') || 'deposit';
          this.setReserveTab('move');
          this.populateReserveMoveSelect(id);
          this.setReserveOp(op);
          if (this.reservesModalBody) this.reservesModalBody.scrollTop = 0;
          this.reserveMoveAmountInput?.focus();
        });
      });

      this.reservesListContainer.querySelectorAll('[data-res-toggle-hist]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-res-toggle-hist');
          if (this.expandedReserveHistoryIds.has(id)) {
            this.expandedReserveHistoryIds.delete(id);
          } else {
            this.expandedReserveHistoryIds.add(id);
          }
          this.renderReservesModalList();
        });
      });

      this.reservesListContainer.querySelectorAll('[data-res-edit]').forEach(btn => {
        btn.addEventListener('click', () => this.openEditReserve(btn.getAttribute('data-res-edit')));
      });

      this.reservesListContainer.querySelectorAll('[data-res-delete]').forEach(btn => {
        btn.addEventListener('click', () => this.deleteReserve(btn.getAttribute('data-res-delete')));
      });

      this.reservesListContainer.querySelectorAll('[data-res-mov-del]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.deleteReserveMovement(btn.getAttribute('data-res-id'), btn.getAttribute('data-res-mov-del'));
        });
      });
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
        const overdueLateFees = alertData.overdue.reduce((sum, item) => sum + (Number(item.bill.lateFee) || 0), 0);
        const overdueWarn = alertData.overdue.length > 0
          ? (overdueLateFees > 0
            ? ` • Evite juros/multas (+${Utils.formatCurrency(overdueLateFees)} em atraso)`
            : ' • Priorize quitar contas vencidas para evitar juros')
          : '';
        this.alertsBannerSubtitle.textContent = `Total pendente em alerta: ${Utils.formatCurrency(alertData.totalAmount)}${overdueWarn}`;
      }

      if (this.alertsBannerList) {
        const visibleItems = alertData.all.slice(0, 6);
        let cardsHtml = '';

        visibleItems.forEach(({ bill, status }) => {
          const isItemOverdue = status.key === 'overdue';
          const pillClass = isItemOverdue
            ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'
            : 'text-amber-300 bg-amber-500/15 border-amber-500/30';
          const feeText = (Number(bill.lateFee) || 0) > 0
            ? ` <span class="text-rose-300 font-semibold">(+${Utils.formatCurrency(bill.lateFee)} juros/multa)</span>`
            : '';

          cardsHtml += `
            <div class="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-700/70">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <p class="text-xs font-semibold text-slate-100 truncate">${Utils.escapeHTML(bill.title)}</p>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold border ${pillClass}">${status.label}</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-1">
                  ${Utils.formatDate(bill.dueDate)} • <span class="text-slate-200 font-semibold">${Utils.formatCurrency(bill.amount)}</span>${feeText}
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
        const nature = this.getItemNature(bill);
        const lateFeeVal = Number(bill.lateFee) || 0;
        const natureBadge = nature === 'superfluous'
          ? '<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-md">Supérfluo</span>'
          : '';
        const feeBadge = lateFeeVal > 0
          ? `<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-md">+${Utils.formatCurrency(lateFeeVal)} multa/juros</span>`
          : '';

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
                  ${natureBadge}
                  ${feeBadge}
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

      if (this.expenseNatureFilter && this.expenseNatureFilter !== 'all') {
        expenses = expenses.filter(e => this.getItemNature(e) === this.expenseNatureFilter);
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
        const nature = this.getItemNature(expense);
        const natureTag = nature === 'superfluous'
          ? '<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-md flex-shrink-0">Supérfluo</span>'
          : '';

        html += `
          <div class="flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-smooth gap-3 group">
            
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs flex-shrink-0" style="background-color: ${catColor}20; color: ${catColor}; border: 1px solid ${catColor}40;">
                <i class="fa-solid ${iconClass}"></i>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-sm font-semibold text-slate-100 truncate">
                    ${Utils.escapeHTML(expense.description)}
                  </h4>
                  ${natureTag}
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

      // Resumo Essencial vs Supérfluo (Consumo Consciente)
      if (this.natureBreakdownSummary) {
        let essentialSum = 0;
        let superfluousSum = 0;
        [...periodExpenses, ...periodBills].forEach(item => {
          const val = item.amount || 0;
          if (this.getItemNature(item) === 'superfluous') superfluousSum += val;
          else essentialSum += val;
        });
        const natureTotal = essentialSum + superfluousSum;
        if (natureTotal <= 0) {
          this.natureBreakdownSummary.innerHTML = `<p class="text-[11px] text-slate-500 text-center">Classifique gastos como Essencial ou Supérfluo para ver o raio-x do consumo.</p>`;
        } else {
          const essPct = Math.round((essentialSum / natureTotal) * 100);
          const supPct = 100 - essPct;
          const nudge = superfluousSum > 0
            ? (supPct >= 35
              ? `<p class="text-[10px] text-amber-300/90 mt-1"><i class="fa-solid fa-lightbulb mr-1"></i>Supérfluos somam ${Utils.formatCurrency(supPct > 0 ? superfluousSum : 0)}: cortar 50% liberaria ${Utils.formatCurrency(superfluousSum * 0.5)}/mês para reservas ou metas.</p>`
              : `<p class="text-[10px] text-slate-400 mt-1">Se cortar supérfluos pela metade, libera +${Utils.formatCurrency(superfluousSum * 0.5)}/mês.</p>`)
            : `<p class="text-[10px] text-emerald-300/90 mt-1"><i class="fa-solid fa-shield-check mr-1"></i>100% das despesas deste mês são essenciais.</p>`;
          this.natureBreakdownSummary.innerHTML = `
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-emerald-300 font-semibold">Essenciais (${essPct}%): ${Utils.formatCurrency(essentialSum)}</span>
                <span class="text-amber-300 font-semibold">Supérfluos (${supPct}%): ${Utils.formatCurrency(superfluousSum)}</span>
              </div>
              <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden flex">
                <div class="h-full bg-emerald-500" style="width: ${essPct}%"></div>
                <div class="h-full bg-amber-400" style="width: ${supPct}%"></div>
              </div>
              ${nudge}
            </div>
          `;
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
    },

    // ========================================================================
    // 7 PILARES DA ORGANIZAÇÃO FINANCEIRA PESSOAL (FASES 1, 2 E 3)
    // ========================================================================
    getDefaultNatureForCategory(category) {
      return ESSENTIAL_DEFAULT_CATEGORIES.has(category) ? 'essential' : 'superfluous';
    },

    getItemNature(item) {
      if (item && (item.nature === 'essential' || item.nature === 'superfluous')) {
        return item.nature;
      }
      return this.getDefaultNatureForCategory(item?.category || 'Outros');
    },

    setBillNature(nature) {
      const normalized = nature === 'superfluous' ? 'superfluous' : 'essential';
      if (this.billNatureInput) this.billNatureInput.value = normalized;
      this.billNatureBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-bill-nature') === normalized;
        btn.classList.toggle('bg-emerald-600', isActive && normalized === 'essential');
        btn.classList.toggle('bg-amber-600', isActive && normalized === 'superfluous');
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-slate-400', !isActive);
      });
    },

    setExpenseNature(nature) {
      const normalized = nature === 'superfluous' ? 'superfluous' : 'essential';
      if (this.expenseNatureInput) this.expenseNatureInput.value = normalized;
      this.expenseNatureBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-expense-nature') === normalized;
        btn.classList.toggle('bg-emerald-600', isActive && normalized === 'essential');
        btn.classList.toggle('bg-amber-600', isActive && normalized === 'superfluous');
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-slate-400', !isActive);
      });
    },

    populateIncomeAutoReserveSelect() {
      if (!this.incomeAutoReserveTargetSelect) return;
      const reserves = this.state.reserves || [];
      let optionsHtml = '';
      if (reserves.length === 0) {
        optionsHtml = '<option value="__create_emergency__">Criar "Reserva de Emergência" automaticamente</option>';
      } else {
        reserves.forEach(r => {
          optionsHtml += `<option value="${r.id}">${Utils.escapeHTML(r.title)} (${Utils.formatCurrency(r.balance)})</option>`;
        });
        if (!reserves.some(r => r.type === 'Reserva de Emergência')) {
          optionsHtml += '<option value="__create_emergency__">+ Nova "Reserva de Emergência"</option>';
        }
      }
      this.incomeAutoReserveTargetSelect.innerHTML = optionsHtml;
    },

    updateIncomeAutoReserveUI() {
      const enabled = Boolean(this.incomeAutoReserveCheck?.checked);
      if (this.incomeAutoReserveFields) {
        this.incomeAutoReserveFields.classList.toggle('hidden', !enabled);
      }
      if (this.incomeAutoReservePreview) {
        const amount = Utils.parseCurrency(this.incomeInput?.value || '0');
        const pct = Math.min(90, Math.max(0, Utils.parsePercent(this.incomeAutoReservePercentInput?.value || '0')));
        const calculated = Math.round((amount * (pct / 100)) * 100) / 100;
        this.incomeAutoReservePreview.textContent = `Separar ao salvar: ${Utils.formatCurrency(calculated)} (${pct}%)`;
      }
    },

    depositToReserve(targetId, amount, date, note, affectMonthBalance = true) {
      const safeAmount = Math.round((Number(amount) || 0) * 100) / 100;
      if (safeAmount <= 0) return null;
      if (!Array.isArray(this.state.reserves)) this.state.reserves = [];

      let reserve = this.state.reserves.find(r => r.id === targetId);
      if (!reserve) {
        reserve = Storage.normalizeReserve({
          id: Utils.generateUUID(),
          title: 'Reserva de Emergência',
          type: 'Reserva de Emergência',
          balance: 0,
          goalAmount: 0,
          movements: [],
          createdAt: new Date().toISOString()
        });
        this.state.reserves.unshift(reserve);
      }

      const movement = Storage.normalizeReserveMovement({
        id: Utils.generateUUID(),
        type: 'deposit',
        amount: safeAmount,
        date: date || Utils.getTodayISO(),
        note: note || 'Aporte automático',
        affectMonthBalance: Boolean(affectMonthBalance),
        createdAt: new Date().toISOString()
      });

      reserve.balance = Math.round(((reserve.balance || 0) + safeAmount) * 100) / 100;
      if (!Array.isArray(reserve.movements)) reserve.movements = [];
      reserve.movements.unshift(movement);
      reserve.updatedAt = new Date().toISOString();
      return reserve;
    },

    getLivingCostMetrics(period = this.state.currentPeriod) {
      const allBills = this.state.bills || [];
      const periodBills = allBills.filter(b => (b.dueDate || '').startsWith(period));
      const structuralBills = periodBills
        .filter(b => !b.financingPlanId)
        .reduce((sum, b) => sum + (b.amount || 0), 0);
      const financingBills = periodBills
        .filter(b => Boolean(b.financingPlanId))
        .reduce((sum, b) => sum + (b.amount || 0), 0);
      const currentBillsTotal = Math.round((structuralBills + financingBills) * 100) / 100;

      const byMonth = {};
      allBills.forEach(b => {
        const p = (b.dueDate || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(p)) {
          byMonth[p] = (byMonth[p] || 0) + (b.amount || 0);
        }
      });
      const monthValues = Object.values(byMonth);
      const historicalBillsAvg = monthValues.length > 0
        ? Math.round((monthValues.reduce((s, v) => s + v, 0) / monthValues.length) * 100) / 100
        : 0;

      const livingCost = currentBillsTotal > 0 ? currentBillsTotal : historicalBillsAvg;
      const income = this.getCurrentIncome(period);
      const committedPct = income > 0 ? Math.round((livingCost / income) * 100) : 0;
      const remainingAfterFixed = Math.round((income - livingCost) * 100) / 100;

      const periodExpenses = (this.state.expenses || []).filter(e => (e.date || '').startsWith(period));
      let essentialTotal = 0;
      let superfluousTotal = 0;
      [...periodBills, ...periodExpenses].forEach(item => {
        const val = item.amount || 0;
        if (this.getItemNature(item) === 'superfluous') superfluousTotal += val;
        else essentialTotal += val;
      });
      const totalSpent = essentialTotal + superfluousTotal;
      const essentialPct = totalSpent > 0 ? Math.round((essentialTotal / totalSpent) * 100) : 0;
      const superfluousPct = totalSpent > 0 ? 100 - essentialPct : 0;

      return {
        livingCost,
        structuralBills: Math.round(structuralBills * 100) / 100,
        financingBills: Math.round(financingBills * 100) / 100,
        historicalBillsAvg,
        income,
        committedPct,
        remainingAfterFixed,
        essentialTotal: Math.round(essentialTotal * 100) / 100,
        superfluousTotal: Math.round(superfluousTotal * 100) / 100,
        essentialPct,
        superfluousPct
      };
    },

    getPeriodSavingsProgress(period = this.state.currentPeriod) {
      const goals = this.state.financeGoals || { saveGoalMode: 'percent', saveGoalValue: 20, emergencyMonths: 6 };
      const income = this.getCurrentIncome(period);
      const targetAmount = goals.saveGoalMode === 'fixed'
        ? Math.round((goals.saveGoalValue || 0) * 100) / 100
        : Math.round((income * ((goals.saveGoalValue || 0) / 100)) * 100) / 100;

      const reserveFlow = this.getPeriodReserveFlow(period);
      const savedInMonth = Math.max(0, Math.round((reserveFlow.netSavedInMonth || 0) * 100) / 100);
      const progressPct = targetAmount > 0 ? Math.min(100, Math.round((savedInMonth / targetAmount) * 100)) : 0;
      const goalPctOfIncome = goals.saveGoalMode === 'percent'
        ? goals.saveGoalValue
        : (income > 0 ? Math.round((targetAmount / income) * 100) : 0);

      return {
        mode: goals.saveGoalMode,
        configuredValue: goals.saveGoalValue,
        targetAmount,
        savedInMonth,
        progressPct,
        goalPctOfIncome,
        income
      };
    },

    getEmergencyReserveMetrics(period = this.state.currentPeriod) {
      const goals = this.state.financeGoals || { saveGoalMode: 'percent', saveGoalValue: 20, emergencyMonths: 6 };
      const targetMonths = goals.emergencyMonths || 6;
      const reserves = this.state.reserves || [];
      const emergencyReserves = reserves.filter(r => r.type === 'Reserva de Emergência');
      const emergencyBalance = Math.round(emergencyReserves.reduce((s, r) => s + (r.balance || 0), 0) * 100) / 100;

      const livingMetrics = this.getLivingCostMetrics(period);
      const monthlyBase = livingMetrics.livingCost > 0
        ? livingMetrics.livingCost
        : livingMetrics.essentialTotal;

      const suggestedTargetAmount = Math.round((monthlyBase * targetMonths) * 100) / 100;
      const monthsCovered = monthlyBase > 0 ? Math.round((emergencyBalance / monthlyBase) * 10) / 10 : 0;
      const coveragePct = suggestedTargetAmount > 0
        ? Math.min(100, Math.round((emergencyBalance / suggestedTargetAmount) * 100))
        : 0;

      return {
        targetMonths,
        monthlyBase: Math.round(monthlyBase * 100) / 100,
        emergencyBalance,
        suggestedTargetAmount,
        monthsCovered,
        coveragePct,
        hasEmergencyReserve: emergencyReserves.length > 0
      };
    },

    getAnnualExpensesMetrics() {
      const items = this.state.annualExpenses || [];
      const totalAnnual = Math.round(items.reduce((s, it) => s + (it.amount || 0), 0) * 100) / 100;
      const monthlyProvision = Math.round((totalAnnual / 12) * 100) / 100;
      const annualReservesTotal = Math.round(
        (this.state.reserves || [])
          .filter(r => r.type === 'Despesas Anuais')
          .reduce((s, r) => s + (r.balance || 0), 0) * 100
      ) / 100;

      return {
        items,
        count: items.length,
        totalAnnual,
        monthlyProvision,
        annualReservesTotal
      };
    },

    evaluateDebtStrategy(debtsList = this.state.debts || [], strategy = this.state.debtStrategy || 'avalanche', extraMonthly = 0) {
      const active = debtsList
        .filter(d => !d.paidOff && (d.totalBalance || 0) > 0)
        .map(d => ({
          id: d.id,
          title: d.title,
          creditor: d.creditor || '',
          balance: Number(d.totalBalance) || 0,
          minPayment: Math.max(0, Number(d.monthlyPayment) || 0),
          rate: Math.max(0, Number(d.interestRatePct) || 0) / 100,
          ratePct: Math.max(0, Number(d.interestRatePct) || 0)
        }));

      const totalBalance = Math.round(active.reduce((s, d) => s + d.balance, 0) * 100) / 100;
      const totalMonthlyMin = Math.round(active.reduce((s, d) => s + d.minPayment, 0) * 100) / 100;
      const safeExtra = Math.max(0, Number(extraMonthly) || 0);

      if (active.length === 0) {
        return {
          activeCount: 0,
          totalBalance: 0,
          totalMonthlyMin: 0,
          monthsToPayoff: 0,
          totalInterestPaid: 0,
          payoffOrder: [],
          stalled: false
        };
      }

      const sortFn = strategy === 'snowball'
        ? (a, b) => (a.balance - b.balance) || (b.ratePct - a.ratePct)
        : (a, b) => (b.ratePct - a.ratePct) || (a.balance - b.balance);

      const ordered = [...active].sort(sortFn);
      const sim = ordered.map(d => ({ ...d, paidInMonth: null }));
      let month = 0;
      let totalInterestPaid = 0;
      const MAX_MONTHS = 120;

      while (sim.some(d => d.balance > 0.01) && month < MAX_MONTHS) {
        month++;
        let freedMinPool = 0;

        sim.forEach(d => {
          if (d.balance <= 0.01) {
            freedMinPool += d.minPayment;
            return;
          }
          const interest = Math.round((d.balance * d.rate) * 100) / 100;
          totalInterestPaid += interest;
          d.balance = Math.round((d.balance + interest) * 100) / 100;

          const pmt = Math.min(d.balance, d.minPayment);
          d.balance = Math.round((d.balance - pmt) * 100) / 100;
          if (d.balance <= 0.01) {
            freedMinPool += Math.max(0, d.minPayment - pmt);
            d.balance = 0;
            d.paidInMonth = month;
          }
        });

        let extraBudget = safeExtra + freedMinPool;
        for (let i = 0; i < sim.length && extraBudget > 0.01; i++) {
          const target = sim[i];
          if (target.balance <= 0.01) continue;
          const applied = Math.min(target.balance, extraBudget);
          target.balance = Math.round((target.balance - applied) * 100) / 100;
          extraBudget = Math.round((extraBudget - applied) * 100) / 100;
          if (target.balance <= 0.01) {
            target.balance = 0;
            if (!target.paidInMonth) target.paidInMonth = month;
          }
        }
      }

      const unresolved = sim.some(d => d.balance > 0.01);
      return {
        activeCount: active.length,
        totalBalance,
        totalMonthlyMin,
        monthsToPayoff: unresolved ? null : month,
        totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
        payoffOrder: sim.map(d => ({ id: d.id, title: d.title, ratePct: d.ratePct, paidInMonth: d.paidInMonth })),
        stalled: unresolved
      };
    },

    renderFinancialHealthPanel() {
      if (!this.financialHealthPanel) return;
      const period = this.state.currentPeriod;
      const living = this.getLivingCostMetrics(period);
      const savings = this.getPeriodSavingsProgress(period);
      const emergency = this.getEmergencyReserveMetrics(period);
      const annual = this.getAnnualExpensesMetrics();
      const debtEval = this.evaluateDebtStrategy(this.state.debts || [], this.state.debtStrategy || 'avalanche', 0);

      const overdueAlerts = this.getDueAlertBills().overdue;
      const overdueCount = overdueAlerts.length;
      const overdueLateFees = overdueAlerts.reduce((s, item) => s + (Number(item.bill.lateFee) || 0), 0);

      // Card A: Custo de Vida & Natureza
      if (this.healthLivingCostValue) {
        this.healthLivingCostValue.textContent = Utils.formatCurrency(living.livingCost);
      }
      if (this.healthFixedPctBadge) {
        this.healthFixedPctBadge.textContent = living.income > 0 ? `${living.committedPct}% renda` : 'Sem renda';
        this.healthFixedPctBadge.className = living.committedPct > 70
          ? 'px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold'
          : (living.committedPct > 50
            ? 'px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold'
            : 'px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-semibold');
      }
      if (this.healthLivingCostSub) {
        const freeText = living.income > 0 ? `Livre p/ variáveis: ${Utils.formatCurrency(living.remainingAfterFixed)}` : 'Cadastre sua renda';
        const histNote = living.historicalBillsAvg > 0 && living.historicalBillsAvg !== living.livingCost
          ? ` • Média: ${Utils.formatCurrency(living.historicalBillsAvg)}`
          : '';
        this.healthLivingCostSub.textContent = `${freeText}${histNote}`;
      }
      if (this.healthNatureRatioText) {
        this.healthNatureRatioText.textContent = (living.essentialTotal + living.superfluousTotal) > 0
          ? `${living.essentialPct}% / ${living.superfluousPct}%`
          : '—';
      }
      if (this.healthEssentialBar) this.healthEssentialBar.style.width = `${living.essentialPct}%`;
      if (this.healthSuperfluousBar) this.healthSuperfluousBar.style.width = `${living.superfluousPct}%`;

      // Card B: Pague-se Primeiro
      if (this.healthSaveGoalValue) {
        this.healthSaveGoalValue.textContent = `${Utils.formatCurrency(savings.savedInMonth)} / ${Utils.formatCurrency(savings.targetAmount)}`;
      }
      if (this.healthSaveGoalPctBadge) {
        this.healthSaveGoalPctBadge.textContent = `${savings.progressPct}%`;
      }
      if (this.healthSaveGoalSub) {
        this.healthSaveGoalSub.textContent = savings.targetAmount > 0
          ? (savings.progressPct >= 100
            ? `Meta mensal (${savings.goalPctOfIncome}%) atingida!`
            : `Falta separar ${Utils.formatCurrency(Math.max(0, savings.targetAmount - savings.savedInMonth))} neste mês`)
          : 'Configure sua meta em Metas & Emergência';
      }
      if (this.healthSaveGoalBar) {
        this.healthSaveGoalBar.style.width = `${savings.progressPct}%`;
      }

      // Card C: Reserva de Emergência
      if (this.healthEmergencyValue) {
        this.healthEmergencyValue.textContent = `${emergency.monthsCovered} meses`;
      }
      if (this.healthEmergencyPctBadge) {
        this.healthEmergencyPctBadge.textContent = `${emergency.coveragePct}%`;
      }
      if (this.healthEmergencySub) {
        this.healthEmergencySub.textContent = emergency.monthlyBase > 0
          ? `${Utils.formatCurrency(emergency.emergencyBalance)} de ${Utils.formatCurrency(emergency.suggestedTargetAmount)} (${emergency.targetMonths} meses)`
          : `Meta: ${emergency.targetMonths} meses de custo de vida`;
      }
      if (this.healthEmergencyBar) {
        this.healthEmergencyBar.style.width = `${emergency.coveragePct}%`;
      }

      // Card D: Despesas Anuais & Dívidas
      if (this.healthAnnualValue) {
        this.healthAnnualValue.textContent = `${Utils.formatCurrency(annual.monthlyProvision)}/mês`;
      }
      if (this.healthAnnualSub) {
        this.healthAnnualSub.textContent = annual.count > 0
          ? `${annual.count} ${annual.count === 1 ? 'despesa anual' : 'despesas anuais'} (${Utils.formatCurrency(annual.totalAnnual)}/ano)`
          : 'Nenhuma despesa anual provisionada';
      }

      const activeIssuesCount = debtEval.activeCount + overdueCount;
      if (this.healthDebtsCountBadge) {
        this.healthDebtsCountBadge.textContent = String(activeIssuesCount);
        this.healthDebtsCountBadge.classList.toggle('hidden', activeIssuesCount === 0);
      }

      if (this.healthDebtStatusBadge) {
        if (debtEval.activeCount > 0 || overdueCount > 0) {
          this.healthDebtStatusBadge.textContent = `${activeIssuesCount} alerta${activeIssuesCount > 1 ? 's' : ''}`;
          this.healthDebtStatusBadge.className = 'px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold';
        } else {
          this.healthDebtStatusBadge.textContent = 'Sem dívidas';
          this.healthDebtStatusBadge.className = 'px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-semibold';
        }
      }

      if (this.healthDebtSub) {
        const parts = [];
        if (debtEval.activeCount > 0) {
          parts.push(`Dívidas: ${Utils.formatCurrency(debtEval.totalBalance)} (${Utils.formatCurrency(debtEval.totalMonthlyMin)}/mês)`);
        }
        if (overdueCount > 0) {
          parts.push(`${overdueCount} conta${overdueCount > 1 ? 's' : ''} atrasada${overdueCount > 1 ? 's' : ''}${overdueLateFees > 0 ? ` (+${Utils.formatCurrency(overdueLateFees)} multa)` : ''}`);
        }
        this.healthDebtSub.textContent = parts.length > 0 ? parts.join(' • ') : 'Sem dívidas ou atrasos pendentes';
      }

      // Badge geral de saúde dos 7 pilares
      if (this.healthScoreBadge) {
        let pillars = 0;
        if (living.income > 0 && living.committedPct <= 60) pillars++;
        if (savings.progressPct >= 100) pillars++;
        if (emergency.coveragePct >= 50) pillars++;
        if (debtEval.activeCount === 0 && overdueCount === 0) pillars++;

        if (debtEval.activeCount > 0 || overdueCount > 0) {
          this.healthScoreBadge.textContent = 'Priorize Quitar Dívidas';
          this.healthScoreBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300';
        } else if (pillars >= 3) {
          this.healthScoreBadge.textContent = 'Finanças Equilibradas';
          this.healthScoreBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300';
        } else {
          this.healthScoreBadge.textContent = 'Em Construção';
          this.healthScoreBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300';
        }
      }
    },

    // ========================================================================
    // MODAL: METAS DE ECONOMIA & RESERVA DE EMERGÊNCIA
    // ========================================================================
    openGoalsModal() {
      const goals = Storage.normalizeFinanceGoals(this.state.financeGoals);
      this.setGoalSaveMode(goals.saveGoalMode, false);
      if (goals.saveGoalMode === 'percent' && this.goalSavePercentInput) {
        this.goalSavePercentInput.value = String(goals.saveGoalValue || 20);
      } else if (this.goalSaveValueInput) {
        this.goalSaveValueInput.value = Utils.formatNumberToInput(goals.saveGoalValue || 0);
      }
      this.setGoalEmergencyMonths(goals.emergencyMonths, false);
      this.updateGoalsModalPreviews();
      this.openModal(this.goalsModal);
    },

    setGoalSaveMode(mode, refresh = true) {
      const normalized = mode === 'fixed' ? 'fixed' : 'percent';
      if (this.goalSaveModeInput) this.goalSaveModeInput.value = normalized;
      this.goalModeBtns.forEach(btn => {
        const active = btn.getAttribute('data-goal-mode') === normalized;
        btn.classList.toggle('bg-teal-600', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('text-slate-400', !active);
      });
      if (this.goalSavePercentWrap) this.goalSavePercentWrap.classList.toggle('hidden', normalized !== 'percent');
      if (this.goalSaveFixedWrap) this.goalSaveFixedWrap.classList.toggle('hidden', normalized !== 'fixed');
      if (refresh) this.updateGoalsModalPreviews();
    },

    setGoalEmergencyMonths(months, refresh = true) {
      const valid = [3, 6, 9, 12].includes(months) ? months : 6;
      if (this.goalEmergencyMonthsInput) this.goalEmergencyMonthsInput.value = String(valid);
      this.goalMonthsBtns.forEach(btn => {
        const active = parseInt(btn.getAttribute('data-emergency-months') || '6', 10) === valid;
        btn.classList.toggle('border-sky-500', active);
        btn.classList.toggle('bg-sky-500/20', active);
        btn.classList.toggle('text-sky-300', active);
        btn.classList.toggle('border-slate-700', !active);
        btn.classList.toggle('bg-slate-950', !active);
        btn.classList.toggle('text-slate-300', !active);
      });
      if (refresh) this.updateGoalsModalPreviews();
    },

    updateGoalsModalPreviews() {
      const mode = this.goalSaveModeInput?.value === 'fixed' ? 'fixed' : 'percent';
      const income = this.getCurrentIncome(this.state.currentPeriod);
      const val = mode === 'fixed'
        ? Utils.parseCurrency(this.goalSaveValueInput?.value || '0')
        : Math.min(90, Math.max(0, Utils.parsePercent(this.goalSavePercentInput?.value || '0')));
      const monthlyTarget = mode === 'fixed' ? val : Math.round((income * (val / 100)) * 100) / 100;

      if (this.goalSaveLivePreview) {
        this.goalSaveLivePreview.innerHTML = income > 0
          ? `Com renda atual de <strong>${Utils.formatCurrency(income)}</strong>, sua meta mensal é guardar <strong class="text-teal-300">${Utils.formatCurrency(monthlyTarget)}/mês</strong> (em 12 meses: <strong>${Utils.formatCurrency(monthlyTarget * 12)}</strong>).`
          : `Meta configurada: <strong class="text-teal-300">${mode === 'percent' ? `${val}% da renda` : `${Utils.formatCurrency(val)}/mês`}</strong>.`;
      }

      if (this.goalEmergencyPreview) {
        const months = parseInt(this.goalEmergencyMonthsInput?.value || '6', 10) || 6;
        const living = this.getLivingCostMetrics(this.state.currentPeriod);
        const base = living.livingCost > 0 ? living.livingCost : living.essentialTotal;
        const suggested = Math.round((base * months) * 100) / 100;
        const curEmerg = this.getEmergencyReserveMetrics(this.state.currentPeriod).emergencyBalance;
        this.goalEmergencyPreview.innerHTML = base > 0
          ? `Base do seu Custo de Vida: <strong>${Utils.formatCurrency(base)}/mês</strong> × <strong>${months} meses</strong> = Meta recomendada de <strong class="text-sky-300">${Utils.formatCurrency(suggested)}</strong> (você já tem ${Utils.formatCurrency(curEmerg)}).`
          : `Cadastre contas fixas para calcularmos automaticamente o valor ideal para ${months} meses.`;
      }
    },

    handleGoalsSubmit(e) {
      e.preventDefault();
      const mode = this.goalSaveModeInput?.value === 'fixed' ? 'fixed' : 'percent';
      const val = mode === 'fixed'
        ? Utils.parseCurrency(this.goalSaveValueInput?.value || '0')
        : Math.min(90, Math.max(0, Utils.parsePercent(this.goalSavePercentInput?.value || '0')));
      const emergencyMonths = parseInt(this.goalEmergencyMonthsInput?.value || '6', 10) || 6;

      this.state.financeGoals = Storage.normalizeFinanceGoals({
        saveGoalMode: mode,
        saveGoalValue: val,
        emergencyMonths
      });
      Storage.save(this.state);
      this.closeModal(this.goalsModal);
      this.render();
      Toast.show('Metas de economia e reserva de emergência atualizadas!', 'success');
    },

    // ========================================================================
    // MODAL: DESPESAS ANUAIS & PROVISÃO MENSAL (IPVA, IPTU, SEGURO)
    // ========================================================================
    openAnnualExpensesModal() {
      this.resetAnnualExpenseForm();
      this.renderAnnualExpensesModal();
      this.openModal(this.annualExpensesModal);
      this.annualTitleInput?.focus();
    },

    resetAnnualExpenseForm() {
      this.annualExpenseForm?.reset();
      if (this.annualEditId) this.annualEditId.value = '';
      if (this.annualAmountInput) this.annualAmountInput.value = '0,00';
      if (this.annualCategorySelect) this.annualCategorySelect.value = 'Outros';
      if (this.annualDueMonthSelect) this.annualDueMonthSelect.value = '1';
      this.annualCancelEditBtn?.classList.add('hidden');
      if (this.annualSubmitBtn) this.annualSubmitBtn.textContent = 'Salvar Despesa Anual';
      this.populateAnnualReserveSelect();
    },

    populateAnnualReserveSelect(selectedId = '') {
      if (!this.annualReserveSelect) return;
      const reserves = this.state.reserves || [];
      let html = '<option value="">Sem vínculo específico (auto-criar se separar)</option>';
      reserves.forEach(r => {
        html += `<option value="${r.id}">${Utils.escapeHTML(r.title)} (${Utils.formatCurrency(r.balance)})</option>`;
      });
      this.annualReserveSelect.innerHTML = html;
      this.annualReserveSelect.value = reserves.some(r => r.id === selectedId) ? selectedId : '';
    },

    editAnnualExpense(id) {
      const item = (this.state.annualExpenses || []).find(a => a.id === id);
      if (!item) return;
      if (this.annualEditId) this.annualEditId.value = item.id;
      if (this.annualTitleInput) this.annualTitleInput.value = item.title;
      if (this.annualCategorySelect) this.annualCategorySelect.value = item.category || 'Outros';
      if (this.annualAmountInput) this.annualAmountInput.value = Utils.formatNumberToInput(item.amount);
      if (this.annualDueMonthSelect) this.annualDueMonthSelect.value = String(item.dueMonth || 1);
      this.populateAnnualReserveSelect(item.reserveId || '');
      this.annualCancelEditBtn?.classList.remove('hidden');
      if (this.annualSubmitBtn) this.annualSubmitBtn.textContent = 'Salvar Alterações';
      this.annualTitleInput?.focus();
    },

    async deleteAnnualExpense(id) {
      const item = (this.state.annualExpenses || []).find(a => a.id === id);
      if (!item) return;
      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Despesa Anual',
        message: `Deseja remover "${item.title}" (${Utils.formatCurrency(item.amount)}/ano)?`
      });
      if (!confirmed) return;

      this.state.annualExpenses = (this.state.annualExpenses || []).filter(a => a.id !== id);
      Storage.save(this.state);
      this.render();
      this.renderAnnualExpensesModal();
      Toast.show(`Despesa anual "${item.title}" removida.`, 'info');
    },

    handleAnnualExpenseSubmit(e) {
      e.preventDefault();
      const editId = this.annualEditId?.value || '';
      const title = (this.annualTitleInput?.value || '').trim();
      const category = this.annualCategorySelect?.value || 'Outros';
      const amount = Utils.parseCurrency(this.annualAmountInput?.value || '0');
      const dueMonth = parseInt(this.annualDueMonthSelect?.value || '1', 10) || 1;
      const reserveId = this.annualReserveSelect?.value || '';

      if (!title) {
        Toast.show('Informe a descrição da despesa anual (ex: IPVA, IPTU).', 'warning');
        return;
      }
      if (amount <= 0) {
        Toast.show('O valor anual estimado deve ser maior que zero.', 'warning');
        return;
      }

      if (!Array.isArray(this.state.annualExpenses)) this.state.annualExpenses = [];

      if (editId) {
        const idx = this.state.annualExpenses.findIndex(a => a.id === editId);
        if (idx !== -1) {
          this.state.annualExpenses[idx] = Storage.normalizeAnnualExpense({
            ...this.state.annualExpenses[idx],
            title,
            category,
            amount,
            dueMonth,
            reserveId,
            updatedAt: new Date().toISOString()
          });
          Toast.show(`Despesa anual "${title}" atualizada!`, 'success');
        }
      } else {
        this.state.annualExpenses.unshift(Storage.normalizeAnnualExpense({
          id: Utils.generateUUID(),
          title,
          category,
          amount,
          dueMonth,
          reserveId,
          createdAt: new Date().toISOString()
        }));
        Toast.show(`Despesa anual "${title}" cadastrada! Provisão sugerida: ${Utils.formatCurrency(amount / 12)}/mês.`, 'success');
      }

      Storage.save(this.state);
      this.resetAnnualExpenseForm();
      this.render();
      this.renderAnnualExpensesModal();
    },

    depositAnnualMonthlyProvision(annualId) {
      const item = (this.state.annualExpenses || []).find(a => a.id === annualId);
      if (!item) return;

      const monthlyPart = Math.round((item.amount / 12) * 100) / 100;
      let targetReserve = (this.state.reserves || []).find(r => r.id === item.reserveId)
        || (this.state.reserves || []).find(r => r.type === 'Despesas Anuais');

      if (!targetReserve) {
        targetReserve = Storage.normalizeReserve({
          id: Utils.generateUUID(),
          title: 'Fundo Despesas Anuais',
          type: 'Despesas Anuais',
          balance: 0,
          goalAmount: this.getAnnualExpensesMetrics().totalAnnual,
          movements: [],
          createdAt: new Date().toISOString()
        });
        if (!Array.isArray(this.state.reserves)) this.state.reserves = [];
        this.state.reserves.unshift(targetReserve);
      }

      item.reserveId = targetReserve.id;
      item.lastDepositedPeriod = this.state.currentPeriod;
      this.depositToReserve(
        targetReserve.id,
        monthlyPart,
        Utils.shiftDateToPeriod(Utils.getTodayISO(), this.state.currentPeriod) || `${this.state.currentPeriod}-05`,
        `Provisão Anual 1/12: ${item.title}`,
        true
      );

      Storage.save(this.state);
      this.render();
      this.renderAnnualExpensesModal();
      Toast.show(`Provisão de ${Utils.formatCurrency(monthlyPart)} separada para "${item.title}" em "${targetReserve.title}"!`, 'success');
    },

    launchAnnualExpenseBill(annualId) {
      const item = (this.state.annualExpenses || []).find(a => a.id === annualId);
      if (!item) return;

      const curYear = parseInt(this.state.currentPeriod.split('-')[0], 10) || new Date().getFullYear();
      const targetPeriod = `${curYear}-${String(item.dueMonth).padStart(2, '0')}`;
      const dueDate = `${targetPeriod}-10`;

      if (!Array.isArray(this.state.bills)) this.state.bills = [];
      this.state.bills.push(Storage.normalizeBillRecord({
        id: Utils.generateUUID(),
        title: `${item.title} (Anual ${curYear})`,
        amount: item.amount,
        dueDate,
        category: item.category,
        nature: 'essential',
        paid: false,
        createdAt: new Date().toISOString()
      }));

      Storage.save(this.state);
      this.render();
      Toast.show(`Conta "${item.title}" lançada em ${Utils.formatPeriod(targetPeriod)}!`, 'success');
    },

    renderAnnualExpensesModal() {
      const metrics = this.getAnnualExpensesMetrics();
      if (this.annualSummaryBanner) {
        this.annualSummaryBanner.innerHTML = `
          <div>
            <span class="text-[10px] uppercase tracking-wider font-semibold text-sky-300 block">Provisão Mensal Sugerida (/ 12 meses)</span>
            <span class="text-lg font-bold text-white">${Utils.formatCurrency(metrics.monthlyProvision)}/mês</span>
          </div>
          <div class="text-right text-xs">
            <span class="text-slate-300 block">Total anual: <strong>${Utils.formatCurrency(metrics.totalAnnual)}</strong></span>
            <span class="text-sky-300 block">Guardado p/ anuais: <strong>${Utils.formatCurrency(metrics.annualReservesTotal)}</strong></span>
          </div>
        `;
      }

      if (!this.annualExpensesListContainer) return;
      if (metrics.items.length === 0) {
        this.annualExpensesListContainer.innerHTML = `
          <div class="text-center py-6 px-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-1.5">
            <i class="fa-solid fa-calendar-check text-2xl text-slate-600"></i>
            <p class="text-xs font-semibold text-slate-300">Nenhuma despesa anual cadastrada</p>
            <p class="text-[11px] text-slate-500">Use os atalhos acima (IPVA, IPTU, Seguro, Escolar) para evitar sustos no início e meio do ano.</p>
          </div>
        `;
        return;
      }

      const curMonth = parseInt(this.state.currentPeriod.split('-')[1], 10) || 1;
      let html = '';
      metrics.items.forEach(item => {
        const monthlyPart = Math.round((item.amount / 12) * 100) / 100;
        const diffMonths = (item.dueMonth - curMonth + 12) % 12 || 12;
        const monthName = MONTH_NAMES_PT[(item.dueMonth || 1) - 1] || 'Janeiro';
        const alreadySavedThisMonth = item.lastDepositedPeriod === this.state.currentPeriod;

        html += `
          <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-bold text-slate-100">${Utils.escapeHTML(item.title)}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">${monthName} (em ${diffMonths}m)</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">${Utils.escapeHTML(item.category)}</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-1">
                  Anual: <strong class="text-slate-200">${Utils.formatCurrency(item.amount)}</strong> • Provisão (/12): <strong class="text-sky-300">${Utils.formatCurrency(monthlyPart)}/mês</strong>
                </p>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <button type="button" data-annual-deposit="${item.id}" class="px-2.5 py-1 rounded-lg ${alreadySavedThisMonth ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500'} border text-[11px] font-semibold transition-colors">
                  ${alreadySavedThisMonth ? '✓ Separado no mês' : `Separar ${Utils.formatCurrency(monthlyPart)}`}
                </button>
                <button type="button" data-annual-bill="${item.id}" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors" title="Criar Conta Fixa no mês de vencimento">
                  Lançar Conta
                </button>
                <button type="button" data-annual-edit="${item.id}" class="action-icon-btn text-slate-400 hover:text-sky-400 hover:bg-slate-800" title="Editar">
                  <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button type="button" data-annual-del="${item.id}" class="action-icon-btn text-slate-400 hover:text-rose-400 hover:bg-slate-800" title="Excluir">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      });

      this.annualExpensesListContainer.innerHTML = html;
      this.annualExpensesListContainer.querySelectorAll('[data-annual-deposit]').forEach(b => {
        b.addEventListener('click', () => this.depositAnnualMonthlyProvision(b.getAttribute('data-annual-deposit')));
      });
      this.annualExpensesListContainer.querySelectorAll('[data-annual-bill]').forEach(b => {
        b.addEventListener('click', () => this.launchAnnualExpenseBill(b.getAttribute('data-annual-bill')));
      });
      this.annualExpensesListContainer.querySelectorAll('[data-annual-edit]').forEach(b => {
        b.addEventListener('click', () => this.editAnnualExpense(b.getAttribute('data-annual-edit')));
      });
      this.annualExpensesListContainer.querySelectorAll('[data-annual-del]').forEach(b => {
        b.addEventListener('click', () => this.deleteAnnualExpense(b.getAttribute('data-annual-del')));
      });
    },

    // ========================================================================
    // MODAL: PAINEL DE DÍVIDAS & ESTRATÉGIA (AVALANCHE VS BOLA DE NEVE)
    // ========================================================================
    openDebtsModal() {
      this.resetDebtForm();
      this.setDebtStrategyUI(this.state.debtStrategy || 'avalanche');
      this.renderDebtsModal();
      this.openModal(this.debtsModal);
      this.debtTitleInput?.focus();
    },

    setDebtStrategyUI(strategy) {
      const normalized = strategy === 'snowball' ? 'snowball' : 'avalanche';
      if (this.debtStrategyInput) this.debtStrategyInput.value = normalized;
      this.debtStrategyBtns.forEach(btn => {
        const active = btn.getAttribute('data-debt-strategy') === normalized;
        btn.classList.toggle('bg-rose-600', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('text-slate-400', !active);
      });
    },

    resetDebtForm() {
      this.debtForm?.reset();
      if (this.debtEditId) this.debtEditId.value = '';
      if (this.debtBalanceInput) this.debtBalanceInput.value = '0,00';
      if (this.debtMonthlyPaymentInput) this.debtMonthlyPaymentInput.value = '0,00';
      if (this.debtInterestInput) this.debtInterestInput.value = '';
      this.debtCancelEditBtn?.classList.add('hidden');
      if (this.debtSubmitBtn) this.debtSubmitBtn.textContent = 'Salvar Dívida';
    },

    editDebt(debtId) {
      const d = (this.state.debts || []).find(item => item.id === debtId);
      if (!d) return;
      if (this.debtEditId) this.debtEditId.value = d.id;
      if (this.debtTitleInput) this.debtTitleInput.value = d.title;
      if (this.debtCreditorInput) this.debtCreditorInput.value = d.creditor || '';
      if (this.debtBalanceInput) this.debtBalanceInput.value = Utils.formatNumberToInput(d.totalBalance || 0);
      if (this.debtMonthlyPaymentInput) this.debtMonthlyPaymentInput.value = Utils.formatNumberToInput(d.monthlyPayment || 0);
      if (this.debtInterestInput) this.debtInterestInput.value = d.interestRatePct > 0 ? String(d.interestRatePct) : '';
      this.debtCancelEditBtn?.classList.remove('hidden');
      if (this.debtSubmitBtn) this.debtSubmitBtn.textContent = 'Salvar Alterações';
      this.debtTitleInput?.focus();
    },

    async deleteDebt(debtId) {
      const d = (this.state.debts || []).find(item => item.id === debtId);
      if (!d) return;
      const confirmed = await ConfirmDialog.open({
        title: 'Excluir Dívida',
        message: `Remover o registro da dívida "${d.title}"?`
      });
      if (!confirmed) return;

      this.state.debts = (this.state.debts || []).filter(item => item.id !== debtId);
      Storage.save(this.state);
      this.render();
      this.renderDebtsModal();
      Toast.show(`Dívida "${d.title}" removida.`, 'info');
    },

    amortizeDebt(debtId) {
      const d = (this.state.debts || []).find(item => item.id === debtId);
      if (!d || d.paidOff) return;
      const payment = d.monthlyPayment > 0 ? Math.min(d.totalBalance, d.monthlyPayment) : d.totalBalance;
      d.totalBalance = Math.max(0, Math.round((d.totalBalance - payment) * 100) / 100);
      if (d.totalBalance <= 0.01) {
        d.totalBalance = 0;
        d.paidOff = true;
      }
      d.updatedAt = new Date().toISOString();

      Storage.save(this.state);
      this.render();
      this.renderDebtsModal();
      Toast.show(
        d.paidOff
          ? `Parabéns! Dívida "${d.title}" marcada como QUITADA!`
          : `Amortização de ${Utils.formatCurrency(payment)} registrada em "${d.title}". Saldo: ${Utils.formatCurrency(d.totalBalance)}.`,
        'success'
      );
    },

    handleDebtSubmit(e) {
      e.preventDefault();
      const editId = this.debtEditId?.value || '';
      const title = (this.debtTitleInput?.value || '').trim();
      const creditor = (this.debtCreditorInput?.value || '').trim();
      const totalBalance = Utils.parseCurrency(this.debtBalanceInput?.value || '0');
      const monthlyPayment = Utils.parseCurrency(this.debtMonthlyPaymentInput?.value || '0');
      const interestRatePct = Math.max(0, Utils.parsePercent(this.debtInterestInput?.value || '0'));

      if (!title) {
        Toast.show('Informe a descrição da dívida.', 'warning');
        return;
      }
      if (totalBalance <= 0) {
        Toast.show('Informe o saldo devedor atual maior que zero.', 'warning');
        return;
      }

      if (!Array.isArray(this.state.debts)) this.state.debts = [];

      if (editId) {
        const idx = this.state.debts.findIndex(item => item.id === editId);
        if (idx !== -1) {
          this.state.debts[idx] = Storage.normalizeDebt({
            ...this.state.debts[idx],
            title,
            creditor,
            totalBalance,
            monthlyPayment,
            interestRatePct,
            paidOff: false,
            updatedAt: new Date().toISOString()
          });
          Toast.show(`Dívida "${title}" atualizada!`, 'success');
        }
      } else {
        this.state.debts.unshift(Storage.normalizeDebt({
          id: Utils.generateUUID(),
          title,
          creditor,
          totalBalance,
          monthlyPayment,
          interestRatePct,
          paidOff: false,
          createdAt: new Date().toISOString()
        }));
        Toast.show(`Dívida "${title}" registrada no plano de quitação.`, 'success');
      }

      Storage.save(this.state);
      this.resetDebtForm();
      this.render();
      this.renderDebtsModal();
    },

    renderDebtStrategyProjection() {
      if (!this.debtStrategyProjection) return;
      const debts = this.state.debts || [];
      const strategy = this.debtStrategyInput?.value === 'snowball' ? 'snowball' : 'avalanche';
      const extra = Utils.parseCurrency(this.debtExtraMonthlyInput?.value || '0');
      const res = this.evaluateDebtStrategy(debts, strategy, extra);

      if (res.activeCount === 0) {
        this.debtStrategyProjection.innerHTML = 'Nenhuma dívida ativa. Continue evitando parcelamentos desnecessários!';
        return;
      }
      if (res.stalled || !res.monthsToPayoff) {
        this.debtStrategyProjection.innerHTML = `<span class="text-rose-300 font-semibold">Pagamento mensal insuficiente para cobrir os juros em até 120 meses. Aumente a parcela ou o aporte extra.</span>`;
        return;
      }

      const firstTarget = res.payoffOrder[0];
      const strategyLabel = strategy === 'snowball' ? 'Bola de Neve' : 'Avalanche';
      this.debtStrategyProjection.innerHTML = `
        <strong>${strategyLabel}:</strong> quitação total prevista em <strong class="text-emerald-300">${res.monthsToPayoff} ${res.monthsToPayoff === 1 ? 'mês' : 'meses'}</strong> (juros est.: ${Utils.formatCurrency(res.totalInterestPaid)}). Atacar primeiro: <strong class="text-rose-300">${Utils.escapeHTML(firstTarget.title)}</strong>.
      `;
    },

    renderDebtsModal() {
      const period = this.state.currentPeriod;
      const debts = this.state.debts || [];
      const strategy = this.state.debtStrategy || 'avalanche';
      const evalCurrent = this.evaluateDebtStrategy(debts, strategy, 0);
      const income = this.getCurrentIncome(period);
      const financingMonthly = (this.state.bills || [])
        .filter(b => (b.dueDate || '').startsWith(period) && b.financingPlanId)
        .reduce((s, b) => s + (b.amount || 0), 0);
      const totalBurden = evalCurrent.totalMonthlyMin + financingMonthly;
      const burdenPct = income > 0 ? Math.round((totalBurden / income) * 100) : 0;

      if (this.debtsSummaryBanner) {
        this.debtsSummaryBanner.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Saldo Total em Dívidas</span>
              <span class="text-lg font-bold ${evalCurrent.totalBalance > 0 ? 'text-rose-300' : 'text-emerald-300'}">${Utils.formatCurrency(evalCurrent.totalBalance)}</span>
            </div>
            <div class="text-right">
              <span class="text-slate-300 block">Parcelas dívidas + financ.: <strong>${Utils.formatCurrency(totalBurden)}/mês</strong></span>
              <span class="text-[11px] ${burdenPct > 30 ? 'text-rose-300 font-semibold' : 'text-slate-400'}">Comprometimento da renda: ${burdenPct}%</span>
            </div>
          </div>
        `;
      }

      this.renderDebtStrategyProjection();
      if (!this.debtsListContainer) return;

      if (debts.length === 0) {
        this.debtsListContainer.innerHTML = `
          <div class="text-center py-6 px-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-1.5">
            <i class="fa-solid fa-link-slash text-2xl text-emerald-500/50"></i>
            <p class="text-xs font-semibold text-slate-200">Nenhuma dívida registrada</p>
            <p class="text-[11px] text-slate-500">Se você tem rotativo, cheque especial ou atrasos, cadastre aqui para simular a estratégia mais rápida para quitar.</p>
          </div>
        `;
        return;
      }

      const rankMap = {};
      evalCurrent.payoffOrder.forEach((p, idx) => { rankMap[p.id] = idx + 1; });

      let html = '';
      debts.forEach(d => {
        const orderNum = rankMap[d.id];
        const statusBadge = d.paidOff || d.totalBalance === 0
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Quitada</span>'
          : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">${orderNum ? `Prioridade #${orderNum}` : 'Ativa'}</span>`;

        html += `
          <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 flex flex-wrap items-center justify-between gap-2.5">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-slate-100">${Utils.escapeHTML(d.title)}</span>
                ${d.creditor ? `<span class="text-[11px] text-slate-400">(${Utils.escapeHTML(d.creditor)})</span>` : ''}
                ${statusBadge}
              </div>
              <p class="text-[11px] text-slate-400 mt-1">
                Saldo: <strong class="text-slate-200">${Utils.formatCurrency(d.totalBalance)}</strong> • Parcela: ${Utils.formatCurrency(d.monthlyPayment)}/mês • Juros: <strong class="text-amber-300">${d.interestRatePct}% a.m.</strong>
              </p>
            </div>
            <div class="flex items-center gap-1.5">
              ${(!d.paidOff && d.totalBalance > 0) ? `
                <button type="button" data-debt-amortize="${d.id}" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors">
                  Amortizar / Pagar
                </button>
              ` : ''}
              <button type="button" data-debt-edit="${d.id}" class="action-icon-btn text-slate-400 hover:text-rose-300 hover:bg-slate-800" title="Editar dívida">
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
              <button type="button" data-debt-del="${d.id}" class="action-icon-btn text-slate-400 hover:text-rose-400 hover:bg-slate-800" title="Excluir dívida">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        `;
      });

      this.debtsListContainer.innerHTML = html;
      this.debtsListContainer.querySelectorAll('[data-debt-amortize]').forEach(b => {
        b.addEventListener('click', () => this.amortizeDebt(b.getAttribute('data-debt-amortize')));
      });
      this.debtsListContainer.querySelectorAll('[data-debt-edit]').forEach(b => {
        b.addEventListener('click', () => this.editDebt(b.getAttribute('data-debt-edit')));
      });
      this.debtsListContainer.querySelectorAll('[data-debt-del]').forEach(b => {
        b.addEventListener('click', () => this.deleteDebt(b.getAttribute('data-debt-del')));
      });
    }
  };

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})();
