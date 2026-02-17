// Data Storage Manager
class DataStore {
    constructor() {
        this.data = this.loadData();
    }

    loadData() {
        const stored = localStorage.getItem('soleTraderData');
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            mileage: [],
            expenses: [],
            income: [],
            settings: {
                personalAllowance: 12570,
                incomeTaxRate: 0.20,
                niThreshold: 12570,
                niRate: 0.09,
                vehicleCostPerMile: 0.45 // HMRC approved mileage rate
            }
        };
    }

    saveData() {
        localStorage.setItem('soleTraderData', JSON.stringify(this.data));
    }

    addMileage(entry) {
        this.data.mileage.push({ ...entry, id: Date.now() });
        this.saveData();
    }

    addExpense(entry) {
        this.data.expenses.push({ ...entry, id: Date.now() });
        this.saveData();
    }

    addIncome(entry) {
        this.data.income.push({ ...entry, id: Date.now() });
        this.saveData();
    }

    deleteEntry(type, id) {
        this.data[type] = this.data[type].filter(item => item.id !== id);
        this.saveData();
    }

    clearAll() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
            this.data = { mileage: [], expenses: [], income: [], settings: this.data.settings };
            this.saveData();
            return true;
        }
        return false;
    }

    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sole-trader-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                this.data = imported;
                this.saveData();
                showToast('Data imported successfully!', 'success');
                app.renderAll();
            } catch (error) {
                showToast('Error importing data. Please check the file.', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(amount);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function getDateRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return { start: weekStart, end: now };
        case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: monthStart, end: now };
        case 'year':
            const yearStart = new Date(now.getFullYear(), 0, 1);
            return { start: yearStart, end: now };
        default:
            return { start: today, end: now };
    }
}

function filterByDateRange(items, start, end) {
    return items.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= start && itemDate <= end;
    });
}

// Main Application Class
class SoleTraderApp {
    constructor() {
        this.store = new DataStore();
        this.currentPeriod = 'week';
        this.initializeApp();
    }

    initializeApp() {
        this.setupTabs();
        this.setupForms();
        this.setupPeriodButtons();
        this.setupDataManagement();
        this.setupAutoCalculations();
        this.renderAll();
        this.setDefaultDates();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('mileageDate').value = today;
        document.getElementById('expenseDate').value = today;
        document.getElementById('incomeDate').value = today;
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
                
                if (targetTab === 'reports') {
                    this.renderTaxCalculator();
                }
            });
        });
    }

    setupForms() {
        // Mileage Form
        document.getElementById('mileageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const start = parseFloat(document.getElementById('startOdometer').value);
            const end = parseFloat(document.getElementById('endOdometer').value);
            const fuel = parseFloat(document.getElementById('fuelAdded').value) || 0;
            const date = document.getElementById('mileageDate').value;

            const miles = end - start;
            const mpg = fuel > 0 ? (miles / fuel) * 4.546 : 0; // Convert litres to gallons

            this.store.addMileage({ start, end, fuel, miles, mpg, date });
            showToast('Mileage entry added!', 'success');
            e.target.reset();
            this.setDefaultDates();
            this.renderMileage();
            this.renderDashboard();
        });

        // Expense Form
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const category = document.getElementById('expenseCategory').value;
            const amount = parseFloat(document.getElementById('expenseAmount').value);
            const description = document.getElementById('expenseDescription').value;
            const date = document.getElementById('expenseDate').value;
            const recurring = document.getElementById('expenseRecurring').checked;

            this.store.addExpense({ category, amount, description, date, recurring });
            showToast('Expense added!', 'success');
            e.target.reset();
            this.setDefaultDates();
            this.renderExpenses();
            this.renderDashboard();
        });

        // Income Form
        document.getElementById('incomeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('incomeAmount').value);
            const description = document.getElementById('incomeDescription').value;
            const date = document.getElementById('incomeDate').value;

            this.store.addIncome({ amount, description, date });
            showToast('Income added!', 'success');
            e.target.reset();
            this.setDefaultDates();
            this.renderIncome();
            this.renderDashboard();
        });
    }

    setupPeriodButtons() {
        const periodBtns = document.querySelectorAll('.period-btn');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                periodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.renderPeriodStats();
            });
        });
    }

    setupDataManagement() {
        document.getElementById('exportData').addEventListener('click', () => {
            this.store.exportData();
            showToast('Data exported!', 'success');
        });

        document.getElementById('importData').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.store.importData(file);
            }
        });

        document.getElementById('clearData').addEventListener('click', () => {
            if (this.store.clearAll()) {
                showToast('All data cleared!', 'success');
                this.renderAll();
            }
        });
    }

    setupAutoCalculations() {
        // Mileage auto-calculation
        const startOdo = document.getElementById('startOdometer');
        const endOdo = document.getElementById('endOdometer');
        const fuelAdded = document.getElementById('fuelAdded');

        const updateMileageCalc = () => {
            const start = parseFloat(startOdo.value) || 0;
            const end = parseFloat(endOdo.value) || 0;
            const fuel = parseFloat(fuelAdded.value) || 0;
            
            const miles = Math.max(0, end - start);
            document.getElementById('calcMiles').textContent = miles.toFixed(1);
            
            if (fuel > 0 && miles > 0) {
                const mpg = (miles / fuel) * 4.546;
                document.getElementById('calcMPG').textContent = mpg.toFixed(1);
            } else {
                document.getElementById('calcMPG').textContent = '-';
            }
        };

        startOdo.addEventListener('input', updateMileageCalc);
        endOdo.addEventListener('input', updateMileageCalc);
        fuelAdded.addEventListener('input', updateMileageCalc);
    }

    renderAll() {
        this.renderDashboard();
        this.renderMileage();
        this.renderExpenses();
        this.renderIncome();
        this.renderPeriodStats();
        this.renderTaxCalculator();
    }

    renderDashboard() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const todayIncome = this.store.data.income
            .filter(i => i.date === todayStr)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const todayExpenses = this.store.data.expenses
            .filter(e => e.date === todayStr)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const todayMiles = this.store.data.mileage
            .filter(m => m.date === todayStr)
            .reduce((sum, m) => sum + m.miles, 0);
        
        const todayNet = todayIncome - todayExpenses;

        document.getElementById('dashIncome').textContent = formatCurrency(todayIncome);
        document.getElementById('dashExpenses').textContent = formatCurrency(todayExpenses);
        document.getElementById('dashNet').textContent = formatCurrency(todayNet);
        document.getElementById('dashMiles').textContent = Math.round(todayMiles);
        
        document.getElementById('todayNet').textContent = formatCurrency(todayNet);
        
        // Calculate tax due
        const yearlyProfit = this.calculateYearlyProfit();
        const taxDue = this.calculateTotalTax(yearlyProfit);
        document.getElementById('taxDue').textContent = formatCurrency(taxDue);
    }

    renderPeriodStats() {
        const range = getDateRange(this.currentPeriod);
        const periodIncome = filterByDateRange(this.store.data.income, range.start, range.end);
        const periodExpenses = filterByDateRange(this.store.data.expenses, range.start, range.end);

        const totalIncome = periodIncome.reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalIncome - totalExpenses;
        const taxLiability = this.calculateTotalTax(netProfit);

        document.getElementById('periodIncome').textContent = formatCurrency(totalIncome);
        document.getElementById('periodExpenses').textContent = formatCurrency(totalExpenses);
        document.getElementById('periodNet').textContent = formatCurrency(netProfit);
        document.getElementById('periodTax').textContent = formatCurrency(taxLiability);
    }

    renderMileage() {
        // Summary stats
        const totalMiles = this.store.data.mileage.reduce((sum, m) => sum + m.miles, 0);
        const mileageWithMPG = this.store.data.mileage.filter(m => m.mpg > 0);
        const avgMPG = mileageWithMPG.length > 0 
            ? mileageWithMPG.reduce((sum, m) => sum + m.mpg, 0) / mileageWithMPG.length 
            : 0;
        
        const totalFuelCost = this.store.data.expenses
            .filter(e => e.category === 'fuel')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const costPerMile = totalMiles > 0 ? totalFuelCost / totalMiles : 0;
        
        // Estimate future costs (tires, brakes, suspension every 30k miles)
        const maintenanceCostPer30k = 1500;
        const futureCosts = (totalMiles / 30000) * maintenanceCostPer30k;

        document.getElementById('totalMiles').textContent = Math.round(totalMiles);
        document.getElementById('avgMPG').textContent = avgMPG > 0 ? avgMPG.toFixed(1) : '-';
        document.getElementById('costPerMile').textContent = formatCurrency(costPerMile);
        document.getElementById('futureCosts').textContent = formatCurrency(futureCosts);

        // Render list
        const list = document.getElementById('mileageList');
        if (this.store.data.mileage.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚗</div><p>No mileage entries yet</p></div>';
            return;
        }

        const sorted = [...this.store.data.mileage].sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = sorted.slice(0, 10).map(entry => `
            <div class="entry-item">
                <div class="entry-info">
                    <div class="entry-title">${entry.miles.toFixed(1)} miles ${entry.mpg > 0 ? `@ ${entry.mpg.toFixed(1)} MPG` : ''}</div>
                    <div class="entry-meta">${formatDate(entry.date)} • ${entry.start} → ${entry.end}</div>
                </div>
                <button class="entry-delete" onclick="app.deleteEntry('mileage', ${entry.id})">×</button>
            </div>
        `).join('');
    }

    renderExpenses() {
        // Breakdown by category
        const breakdown = {};
        this.store.data.expenses.forEach(e => {
            breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
        });

        const categoryNames = {
            fuel: '⛽ Fuel',
            food: '🍔 Food',
            vehicle_maintenance: '🔧 Vehicle Maintenance',
            tools: '🛠️ Tools',
            clothes: '👔 Work Clothes',
            insurance: '🛡️ Insurance',
            phone: '📱 Phone/Internet',
            office: '🏢 Office Supplies',
            other: '📦 Other'
        };

        const breakdownList = document.getElementById('expenseBreakdown');
        if (Object.keys(breakdown).length === 0) {
            breakdownList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div><p>No expenses yet</p></div>';
        } else {
            breakdownList.innerHTML = Object.entries(breakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => `
                    <div class="breakdown-item">
                        <span class="breakdown-category">${categoryNames[cat] || cat}</span>
                        <span class="breakdown-amount">${formatCurrency(amount)}</span>
                    </div>
                `).join('');
        }

        // Render list
        const list = document.getElementById('expenseList');
        if (this.store.data.expenses.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>No expenses yet</p></div>';
            return;
        }

        const sorted = [...this.store.data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = sorted.slice(0, 10).map(entry => `
            <div class="entry-item expense-entry">
                <div class="entry-info">
                    <div class="entry-title">${entry.description}</div>
                    <div class="entry-meta">${formatDate(entry.date)} • ${categoryNames[entry.category]}</div>
                </div>
                <span class="entry-amount expense">${formatCurrency(entry.amount)}</span>
                <button class="entry-delete" onclick="app.deleteEntry('expenses', ${entry.id})">×</button>
            </div>
        `).join('');
    }

    renderIncome() {
        const today = new Date().toISOString().split('T')[0];
        const todayIncome = this.store.data.income
            .filter(i => i.date === today)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const todayExpenses = this.store.data.expenses
            .filter(e => e.date === today)
            .reduce((sum, e) => sum + e.amount, 0);

        const netDailyWage = todayIncome - todayExpenses;

        document.getElementById('todayIncome').textContent = formatCurrency(todayIncome);
        document.getElementById('todayExpenses').textContent = formatCurrency(todayExpenses);
        document.getElementById('netDailyWage').textContent = formatCurrency(netDailyWage);

        // Render list
        const list = document.getElementById('incomeList');
        if (this.store.data.income.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💵</div><p>No income yet</p></div>';
            return;
        }

        const sorted = [...this.store.data.income].sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = sorted.slice(0, 10).map(entry => `
            <div class="entry-item income-entry">
                <div class="entry-info">
                    <div class="entry-title">${entry.description}</div>
                    <div class="entry-meta">${formatDate(entry.date)}</div>
                </div>
                <span class="entry-amount income">${formatCurrency(entry.amount)}</span>
                <button class="entry-delete" onclick="app.deleteEntry('income', ${entry.id})">×</button>
            </div>
        `).join('');
    }

    calculateYearlyProfit() {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const now = new Date();
        
        const yearIncome = filterByDateRange(this.store.data.income, yearStart, now)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = filterByDateRange(this.store.data.expenses, yearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        return yearIncome - yearExpenses;
    }

    calculateTotalTax(profit) {
        const settings = this.store.data.settings;
        const taxableIncome = Math.max(0, profit - settings.personalAllowance);
        const incomeTax = taxableIncome * settings.incomeTaxRate;
        
        const niableIncome = Math.max(0, profit - settings.niThreshold);
        const ni = niableIncome * settings.niRate;
        
        return incomeTax + ni;
    }

    renderTaxCalculator() {
        const yearlyProfit = this.calculateYearlyProfit();
        const settings = this.store.data.settings;
        
        const yearIncome = this.store.data.income
            .filter(i => new Date(i.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = this.store.data.expenses
            .filter(e => new Date(e.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, e) => sum + e.amount, 0);
        
        const taxableIncome = Math.max(0, yearlyProfit - settings.personalAllowance);
        const incomeTax = taxableIncome * settings.incomeTaxRate;
        
        const niableIncome = Math.max(0, yearlyProfit - settings.niThreshold);
        const ni = niableIncome * settings.niRate;
        
        const totalTax = incomeTax + ni;

        document.getElementById('taxGrossIncome').textContent = formatCurrency(yearIncome);
        document.getElementById('taxExpenses').textContent = formatCurrency(yearExpenses);
        document.getElementById('taxableProfit').textContent = formatCurrency(yearlyProfit);
        document.getElementById('personalAllowance').textContent = formatCurrency(settings.personalAllowance);
        document.getElementById('incomeTax').textContent = formatCurrency(incomeTax);
        document.getElementById('nationalInsurance').textContent = formatCurrency(ni);
        document.getElementById('totalTaxDue').textContent = formatCurrency(totalTax);

        // Time-based estimates
        const daysInYear = 365;
        const weeksInYear = 52;
        const monthsInYear = 12;

        document.getElementById('dailyTax').textContent = formatCurrency(totalTax / daysInYear);
        document.getElementById('weeklyTax').textContent = formatCurrency(totalTax / weeksInYear);
        document.getElementById('monthlyTax').textContent = formatCurrency(totalTax / monthsInYear);

        // Annual summary
        const yearMiles = this.store.data.mileage
            .filter(m => new Date(m.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, m) => sum + m.miles, 0);

        document.getElementById('annualIncome').textContent = formatCurrency(yearIncome);
        document.getElementById('annualExpenses').textContent = formatCurrency(yearExpenses);
        document.getElementById('annualProfit').textContent = formatCurrency(yearlyProfit);
        document.getElementById('annualMiles').textContent = Math.round(yearMiles);
    }

    deleteEntry(type, id) {
        if (confirm('Are you sure you want to delete this entry?')) {
            this.store.deleteEntry(type, id);
            showToast('Entry deleted', 'success');
            this.renderAll();
        }
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SoleTraderApp();
});
