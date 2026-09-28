import type { Locale } from './currency';

export type TranslationKey =
  | 'app.name'
  | 'nav.dashboard'
  | 'nav.transactions'
  | 'nav.add'
  | 'nav.reports'
  | 'nav.settings'
  | 'nav.accounts'
  | 'nav.budgets'
  | 'nav.import'
  | 'nav.lightMode'
  | 'nav.darkMode'
  | 'dashboard.greeting.morning'
  | 'dashboard.greeting.afternoon'
  | 'dashboard.greeting.evening'
  | 'dashboard.netWorth'
  | 'dashboard.thisMonth'
  | 'dashboard.income'
  | 'dashboard.expenses'
  | 'dashboard.savingsRatio'
  | 'dashboard.savingsTarget'
  | 'dashboard.cashFlow'
  | 'dashboard.expenseDistribution'
  | 'dashboard.alerts'
  | 'dashboard.recentTransactions'
  | 'dashboard.viewAll'
  | 'dashboard.topCategories'
  | 'dashboard.forecast'
  | 'transactions.title'
  | 'transactions.search'
  | 'transactions.filter'
  | 'transactions.export'
  | 'transactions.allCategories'
  | 'transactions.allMembers'
  | 'transactions.allAccounts'
  | 'transactions.allCurrencies'
  | 'transactions.thisMonth'
  | 'transactions.lastMonth'
  | 'transactions.thisQuarter'
  | 'transactions.thisYear'
  | 'transactions.lastYear'
  | 'transactions.noTransactions'
  | 'transactions.showing'
  | 'transactions.of'
  | 'transactions.today'
  | 'transactions.yesterday'
  | 'transactions.income'
  | 'transactions.expense'
  | 'transactions.transfer'
  | 'transactions.adjustment'
  | 'tx.addTitle'
  | 'tx.amount'
  | 'tx.fromAccount'
  | 'tx.toAccount'
  | 'tx.toCategory'
  | 'tx.source'
  | 'tx.description'
  | 'tx.descriptionPlaceholder'
  | 'tx.date'
  | 'tx.pickDate'
  | 'tx.member'
  | 'tx.save'
  | 'tx.saving'
  | 'tx.saved'
  | 'tx.saveFailed'
  | 'tx.attachReceipt'
  | 'tx.cancel'
  | 'budgets.title'
  | 'budgets.new'
  | 'budgets.overall'
  | 'budgets.spent'
  | 'budgets.approaching'
  | 'budgets.overBudget'
  | 'budgets.left'
  | 'budgets.by'
  | 'budgets.suggestion'
  | 'reports.title'
  | 'reports.range'
  | 'reports.totalIncome'
  | 'reports.totalExpenses'
  | 'reports.netSavings'
  | 'reports.incomeVsExpenses'
  | 'reports.topCategories'
  | 'reports.export'
  | 'import.title'
  | 'import.csv'
  | 'import.csvDesc'
  | 'import.receipt'
  | 'import.receiptDesc'
  | 'import.bank'
  | 'import.bankDesc'
  | 'import.recentImports'
  | 'settings.title'
  | 'settings.profile'
  | 'settings.household'
  | 'settings.categories'
  | 'settings.security'
  | 'settings.bankConnections'
  | 'settings.appearance'
  | 'settings.language'
  | 'settings.theme'
  | 'settings.currency'
  | 'settings.dataExport'
  | 'settings.deleteAccount'
  | 'common.light'
  | 'common.dark'
  | 'common.system'
  | 'common.spanish'
  | 'common.english';

const es: Record<TranslationKey, string> = {
  'app.name': 'FinZen',
  'nav.dashboard': 'Panel',
  'nav.transactions': 'Transacciones',
  'nav.add': 'Agregar',
  'nav.reports': 'Reportes',
  'nav.settings': 'Ajustes',
  'nav.accounts': 'Cuentas',
  'nav.budgets': 'Presupuestos',
  'nav.import': 'Importar',
  'nav.lightMode': 'Modo claro',
  'nav.darkMode': 'Modo oscuro',
  'dashboard.greeting.morning': 'Buenos días',
  'dashboard.greeting.afternoon': 'Buenas tardes',
  'dashboard.greeting.evening': 'Buenas noches',
  'dashboard.netWorth': 'Patrimonio Neto',
  'dashboard.thisMonth': 'Este mes',
  'dashboard.income': 'Ingresos',
  'dashboard.expenses': 'Gastos',
  'dashboard.savingsRatio': 'Ratio de Ahorro',
  'dashboard.savingsTarget': 'Meta 20%',
  'dashboard.cashFlow': 'Flujo de Caja',
  'dashboard.expenseDistribution': 'Distribución de Gastos',
  'dashboard.alerts': 'Alertas',
  'dashboard.recentTransactions': 'Transacciones Recientes',
  'dashboard.viewAll': 'Ver todas',
  'dashboard.topCategories': 'Categorías Principales',
  'dashboard.forecast': 'Pronóstico del Próximo Mes',
  'transactions.title': 'Transacciones',
  'transactions.search': 'Buscar...',
  'transactions.filter': 'Filtrar',
  'transactions.export': 'Exportar',
  'transactions.allCategories': 'Todas las categorías',
  'transactions.allMembers': 'Todos los miembros',
  'transactions.allAccounts': 'Todas las cuentas',
  'transactions.allCurrencies': 'Todas las monedas',
  'transactions.thisMonth': 'Este mes',
  'transactions.lastMonth': 'Mes pasado',
  'transactions.thisQuarter': 'Este trimestre',
  'transactions.thisYear': 'Este año',
  'transactions.lastYear': 'Año pasado',
  'transactions.noTransactions': 'No hay transacciones',
  'transactions.showing': 'Mostrando',
  'transactions.of': 'de',
  'transactions.today': 'HOY',
  'transactions.yesterday': 'AYER',
  'transactions.income': 'Ingreso',
  'transactions.expense': 'Gasto',
  'transactions.transfer': 'Transferencia',
  'transactions.adjustment': 'Ajuste',
  'tx.addTitle': 'Nueva Transacción',
  'tx.amount': 'Monto',
  'tx.fromAccount': 'De cuenta',
  'tx.toAccount': 'A cuenta',
  'tx.toCategory': 'Categoría',
  'tx.source': 'Origen',
  'tx.description': 'Descripción',
  'tx.descriptionPlaceholder': 'ej. Supermercado Nacional',
  'tx.date': 'Fecha',
  'tx.pickDate': 'Elegir fecha',
  'tx.member': 'Miembro',
  'tx.save': 'Guardar Transacción',
  'tx.saving': 'Guardando...',
  'tx.saved': 'Transacción guardada',
  'tx.saveFailed': 'Error al guardar',
  'tx.attachReceipt': 'Adjuntar recibo',
  'tx.cancel': 'Cancelar',
  'budgets.title': 'Presupuestos',
  'budgets.new': 'Nuevo',
  'budgets.overall': 'General',
  'budgets.spent': 'gastado',
  'budgets.approaching': 'Acercándose al límite',
  'budgets.overBudget': 'Sobre presupuesto',
  'budgets.left': 'restante',
  'budgets.by': 'por',
  'budgets.suggestion': 'Sugerencia',
  'reports.title': 'Reportes',
  'reports.range': 'Rango',
  'reports.totalIncome': 'Ingresos Totales',
  'reports.totalExpenses': 'Gastos Totales',
  'reports.netSavings': 'Ahorro Neto',
  'reports.incomeVsExpenses': 'Ingresos vs Gastos',
  'reports.topCategories': 'Categorías Principales',
  'reports.export': 'Exportar',
  'import.title': 'Centro de Importación',
  'import.csv': 'Importar CSV o Excel',
  'import.csvDesc': 'Arrastra un archivo .csv, .xlsx o .xls',
  'import.receipt': 'Escanear Recibo (OCR)',
  'import.receiptDesc': 'Toma una foto o sube una imagen',
  'import.bank': 'Conectar Banco (Plaid)',
  'import.bankDesc': 'Importación automática y segura',
  'import.recentImports': 'Importaciones recientes',
  'settings.title': 'Ajustes',
  'settings.profile': 'Perfil',
  'settings.household': 'Hogar',
  'settings.categories': 'Categorías',
  'settings.security': 'Seguridad',
  'settings.bankConnections': 'Conexiones Bancarias',
  'settings.appearance': 'Apariencia',
  'settings.language': 'Idioma',
  'settings.theme': 'Tema',
  'settings.currency': 'Moneda base',
  'settings.dataExport': 'Exportar datos',
  'settings.deleteAccount': 'Eliminar cuenta',
  'common.light': 'Claro',
  'common.dark': 'Oscuro',
  'common.system': 'Sistema',
  'common.spanish': 'Español',
  'common.english': 'Inglés',
};

const en: Record<TranslationKey, string> = {
  'app.name': 'FinZen',
  'nav.dashboard': 'Dashboard',
  'nav.transactions': 'Transactions',
  'nav.add': 'Add',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.accounts': 'Accounts',
  'nav.budgets': 'Budgets',
  'nav.import': 'Import',
  'nav.lightMode': 'Light mode',
  'nav.darkMode': 'Dark mode',
  'dashboard.greeting.morning': 'Good morning',
  'dashboard.greeting.afternoon': 'Good afternoon',
  'dashboard.greeting.evening': 'Good evening',
  'dashboard.netWorth': 'Net Worth',
  'dashboard.thisMonth': 'This month',
  'dashboard.income': 'Income',
  'dashboard.expenses': 'Expenses',
  'dashboard.savingsRatio': 'Savings Ratio',
  'dashboard.savingsTarget': 'Target 20%',
  'dashboard.cashFlow': 'Cash Flow',
  'dashboard.expenseDistribution': 'Expense Distribution',
  'dashboard.alerts': 'Alerts',
  'dashboard.recentTransactions': 'Recent Transactions',
  'dashboard.viewAll': 'View all',
  'dashboard.topCategories': 'Top Categories',
  'dashboard.forecast': 'Next Month Forecast',
  'transactions.title': 'Transactions',
  'transactions.search': 'Search...',
  'transactions.filter': 'Filter',
  'transactions.export': 'Export',
  'transactions.allCategories': 'All categories',
  'transactions.allMembers': 'All members',
  'transactions.allAccounts': 'All accounts',
  'transactions.allCurrencies': 'All currencies',
  'transactions.thisMonth': 'This month',
  'transactions.lastMonth': 'Last month',
  'transactions.thisQuarter': 'This quarter',
  'transactions.thisYear': 'This year',
  'transactions.lastYear': 'Last year',
  'transactions.noTransactions': 'No transactions',
  'transactions.showing': 'Showing',
  'transactions.of': 'of',
  'transactions.today': 'TODAY',
  'transactions.yesterday': 'YESTERDAY',
  'transactions.income': 'Income',
  'transactions.expense': 'Expense',
  'transactions.transfer': 'Transfer',
  'transactions.adjustment': 'Adjustment',
  'tx.addTitle': 'New Transaction',
  'tx.amount': 'Amount',
  'tx.fromAccount': 'From account',
  'tx.toAccount': 'To account',
  'tx.toCategory': 'Category',
  'tx.source': 'Source',
  'tx.description': 'Description',
  'tx.descriptionPlaceholder': 'e.g. Supermarket',
  'tx.date': 'Date',
  'tx.pickDate': 'Pick a date',
  'tx.member': 'Member',
  'tx.save': 'Save Transaction',
  'tx.saving': 'Saving...',
  'tx.saved': 'Transaction saved',
  'tx.saveFailed': 'Failed to save',
  'tx.attachReceipt': 'Attach receipt',
  'tx.cancel': 'Cancel',
  'budgets.title': 'Budgets',
  'budgets.new': 'New',
  'budgets.overall': 'Overall',
  'budgets.spent': 'spent',
  'budgets.approaching': 'Approaching limit',
  'budgets.overBudget': 'Over budget',
  'budgets.left': 'left',
  'budgets.by': 'by',
  'budgets.suggestion': 'Suggestion',
  'reports.title': 'Reports',
  'reports.range': 'Range',
  'reports.totalIncome': 'Total Income',
  'reports.totalExpenses': 'Total Expenses',
  'reports.netSavings': 'Net Savings',
  'reports.incomeVsExpenses': 'Income vs Expenses',
  'reports.topCategories': 'Top Categories',
  'reports.export': 'Export',
  'import.title': 'Import Center',
  'import.csv': 'Import CSV or Excel',
  'import.csvDesc': 'Drop a .csv, .xlsx, or .xls file',
  'import.receipt': 'Scan Receipt (OCR)',
  'import.receiptDesc': 'Take a photo or upload an image',
  'import.bank': 'Connect Bank (Plaid)',
  'import.bankDesc': 'Secure auto-import',
  'import.recentImports': 'Recent imports',
  'settings.title': 'Settings',
  'settings.profile': 'Profile',
  'settings.household': 'Household',
  'settings.categories': 'Categories',
  'settings.security': 'Security',
  'settings.bankConnections': 'Bank Connections',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.currency': 'Base currency',
  'settings.dataExport': 'Export data',
  'settings.deleteAccount': 'Delete account',
  'common.light': 'Light',
  'common.dark': 'Dark',
  'common.system': 'System',
  'common.spanish': 'Spanish',
  'common.english': 'English',
};

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  es,
  en,
};
