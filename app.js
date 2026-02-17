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

    updateEntry(type, id, updatedData) {
        const index = this.data[type].findIndex(item => item.id === id);
        if (index !== -1) {
            this.data[type][index] = { ...this.data[type][index], ...updatedData };
            this.saveData();
            return true;
        }
        return false;
    }

    getEntry(type, id) {
        return this.data[type].find(item => item.id === id);
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
        this.charts = {};
        this.initializeApp();
    }

    initializeApp() {
        this.setupTabs();
        this.setupForms();
        this.setupDailyLog();
        this.setupPeriodButtons();
        this.setupDataManagement();
        this.setupAutoCalculations();
        this.setupViewToggles();
        this.currentEditType = null;
        this.currentEditId = null;
        this.renderAll();
        this.setDefaultDates();
        this.initializeCharts();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const mileageDateEl = document.getElementById('mileageDate');
        const dailyLogDateEl = document.getElementById('dailyLogDate');
        
        if (mileageDateEl) mileageDateEl.value = today;
        if (dailyLogDateEl) {
            dailyLogDateEl.value = today;
            dailyLogDateEl.addEventListener('change', () => this.renderDailyLogForDate());
        }
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

        // Expense Form - REMOVED (use Daily Log instead)
        // Income Form - REMOVED (use Daily Log instead)
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
        this.updateWeeklyChart();
    }

    initializeCharts() {
        // Initialize weekly trend chart
        const ctx = document.getElementById('weeklyChart');
        if (ctx) {
            this.charts.weekly = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Net Profit',
                        data: [],
                        borderColor: '#4F46E5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => '£' + value
                            }
                        }
                    }
                }
            });
        }
    }

    updateWeeklyChart() {
        if (!this.charts.weekly) return;

        // Get last 7 days
        const days = [];
        const profits = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayIncome = this.store.data.income
                .filter(item => item.date === dateStr)
                .reduce((sum, item) => sum + item.amount, 0);
            
            const dayExpenses = this.store.data.expenses
                .filter(item => item.date === dateStr)
                .reduce((sum, item) => sum + item.amount, 0);
            
            days.push(date.toLocaleDateString('en-GB', { weekday: 'short' }));
            profits.push(dayIncome - dayExpenses);
        }

        this.charts.weekly.data.labels = days;
        this.charts.weekly.data.datasets[0].data = profits;
        this.charts.weekly.update();
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

        // Get yesterday's net for comparison
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const yesterdayIncome = this.store.data.income
            .filter(i => i.date === yesterdayStr)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yesterdayExpenses = this.store.data.expenses
            .filter(e => e.date === yesterdayStr)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const yesterdayNet = yesterdayIncome - yesterdayExpenses;
        const change = todayNet - yesterdayNet;
        
        // Update today's change indicator
        const changeEl = document.getElementById('todayChange');
        if (changeEl) {
            if (change > 0) {
                changeEl.textContent = `↑ ${formatCurrency(change)} vs yesterday`;
                changeEl.style.color = '#10B981';
            } else if (change < 0) {
                changeEl.textContent = `↓ ${formatCurrency(Math.abs(change))} vs yesterday`;
                changeEl.style.color = '#EF4444';
            } else {
                changeEl.textContent = 'Same as yesterday';
                changeEl.style.color = '#6B7280';
            }
        }

        document.getElementById('dashIncome').textContent = formatCurrency(todayIncome);
        document.getElementById('dashExpenses').textContent = formatCurrency(todayExpenses);
        document.getElementById('dashNet').textContent = formatCurrency(todayNet);
        document.getElementById('dashMiles').textContent = Math.round(todayMiles);
        
        document.getElementById('todayNet').textContent = formatCurrency(todayNet);
        
        // Calculate tax due and weekly savings needed
        const yearlyProfit = this.calculateYearlyProfit();
        const mileageDeduction = this.calculateMileageAllowance();
        const adjustedProfit = yearlyProfit - mileageDeduction;
        const taxDue = this.calculateTotalTax(adjustedProfit);
        
        document.getElementById('taxDue').textContent = formatCurrency(taxDue);
        
        // Weekly tax saving target (52 weeks)
        const weeklyTaxSave = Math.round(taxDue / 52);
        const weeklyEl = document.getElementById('weeklyTaxSave');
        if (weeklyEl) {
            weeklyEl.textContent = weeklyTaxSave;
        }

        // Personal allowance progress
        const settings = this.store.data.settings;
        const allowanceUsed = Math.min(yearlyProfit, settings.personalAllowance);
        const allowancePercent = Math.min(100, (yearlyProfit / settings.personalAllowance) * 100);
        
        const percentEl = document.getElementById('allowancePercent');
        const progressEl = document.getElementById('allowanceProgress');
        
        if (percentEl && progressEl) {
            percentEl.textContent = `${Math.round(allowancePercent)}%`;
            progressEl.style.width = `${allowancePercent}%`;
        }
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

        // Mileage allowance calculation
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const now = new Date();
        const yearMiles = filterByDateRange(this.store.data.mileage, yearStart, now)
            .reduce((sum, m) => sum + m.miles, 0);
        
        const mileageAllowance = this.calculateMileageAllowance();
        
        const yearFuelCost = this.store.data.expenses
            .filter(e => e.category === 'fuel' && new Date(e.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, e) => sum + e.amount, 0);
        
        const yearMilesEl = document.getElementById('yearMiles');
        const mileageAllowanceEl = document.getElementById('mileageAllowance');
        const actualFuelEl = document.getElementById('actualFuelCost');
        const bestClaimEl = document.getElementById('bestClaim');
        const mileageTaxSavingEl = document.getElementById('mileageTaxSaving');
        
        if (yearMilesEl) yearMilesEl.textContent = Math.round(yearMiles);
        if (mileageAllowanceEl) mileageAllowanceEl.textContent = formatCurrency(mileageAllowance);
        if (actualFuelEl) actualFuelEl.textContent = formatCurrency(yearFuelCost);
        
        if (bestClaimEl) {
            if (mileageAllowance > yearFuelCost) {
                bestClaimEl.textContent = '✓ Mileage allowance';
                bestClaimEl.style.color = '#10B981';
            } else {
                bestClaimEl.textContent = '✓ Actual costs (likely)';
                bestClaimEl.style.color = '#10B981';
            }
        }
        
        if (mileageTaxSavingEl) {
            const taxSaving = Math.max(mileageAllowance, yearFuelCost);
            mileageTaxSavingEl.textContent = formatCurrency(taxSaving);
        }

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
        // UK tax year runs April 6 to April 5
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed
        
        // If before April 6, tax year is previous year to current year
        // If April 6 or later, tax year is current year to next year
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6); // April 6 of previous year
        } else {
            taxYearStart = new Date(currentYear, 3, 6); // April 6 of current year
        }
        
        const yearIncome = filterByDateRange(this.store.data.income, taxYearStart, now)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = filterByDateRange(this.store.data.expenses, taxYearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        return yearIncome - yearExpenses;
    }

    calculateMileageAllowance() {
        // UK tax year runs April 6 to April 5
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6);
        } else {
            taxYearStart = new Date(currentYear, 3, 6);
        }
        
        const yearMiles = filterByDateRange(this.store.data.mileage, taxYearStart, now)
            .reduce((sum, m) => sum + m.miles, 0);
        
        // HMRC rates: 45p for first 10,000 miles, 25p thereafter
        let allowance = 0;
        if (yearMiles <= 10000) {
            allowance = yearMiles * 0.45;
        } else {
            allowance = (10000 * 0.45) + ((yearMiles - 10000) * 0.25);
        }
        
        return allowance;
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
        const mileageDeduction = this.calculateMileageAllowance();
        const adjustedProfit = yearlyProfit - mileageDeduction;
        const settings = this.store.data.settings;
        
        // UK tax year
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6);
        } else {
            taxYearStart = new Date(currentYear, 3, 6);
        }
        
        const yearIncome = filterByDateRange(this.store.data.income, taxYearStart, now)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = filterByDateRange(this.store.data.expenses, taxYearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const taxableIncome = Math.max(0, adjustedProfit - settings.personalAllowance);
        const incomeTax = taxableIncome * settings.incomeTaxRate;
        
        const niableIncome = Math.max(0, adjustedProfit - settings.niThreshold);
        const ni = niableIncome * settings.niRate;
        
        const totalTax = incomeTax + ni;

        document.getElementById('taxGrossIncome').textContent = formatCurrency(yearIncome);
        document.getElementById('taxExpenses').textContent = formatCurrency(yearExpenses + mileageDeduction);
        document.getElementById('taxableProfit').textContent = formatCurrency(adjustedProfit);
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
        document.getElementById('annualProfit').textContent = formatCurrency(adjustedProfit);
        document.getElementById('annualMiles').textContent = Math.round(yearMiles);
    }

    // === DAILY LOG SYSTEM ===
    setupDailyLog() {
        // Daily Income Form
        const dailyIncomeForm = document.getElementById('dailyIncomeForm');
        if (dailyIncomeForm) {
            dailyIncomeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const amount = parseFloat(document.getElementById('dailyIncomeAmount').value);
                const description = document.getElementById('dailyIncomeDesc').value;

                this.store.addIncome({ amount, description, date });
                showToast('Income added!', 'success');
                e.target.reset();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        // Daily Expense Form
        const dailyExpenseForm = document.getElementById('dailyExpenseForm');
        if (dailyExpenseForm) {
            dailyExpenseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const category = document.getElementById('dailyExpenseCategory').value;
                const amount = parseFloat(document.getElementById('dailyExpenseAmount').value);
                const description = document.getElementById('dailyExpenseDesc').value;

                this.store.addExpense({ category, amount, description, date, recurring: false });
                showToast('Expense added!', 'success');
                e.target.reset();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        // Daily Mileage Form
        const dailyMileageForm = document.getElementById('dailyMileageForm');
        if (dailyMileageForm) {
            // Auto-calculate on input
            const startInput = document.getElementById('dailyStartOdo');
            const endInput = document.getElementById('dailyEndOdo');
            const fuelInput = document.getElementById('dailyFuel');
            const fullTankCheck = document.getElementById('dailyFullTank');

            const updateCalc = () => {
                const start = parseFloat(startInput?.value) || 0;
                const end = parseFloat(endInput?.value) || 0;
                const fuel = parseFloat(fuelInput?.value) || 0;
                const fullTank = fullTankCheck?.checked;

                const miles = Math.max(0, end - start);
                const milesEl = document.getElementById('dailyMilesCalc');
                if (milesEl) milesEl.textContent = miles.toFixed(1);

                const mpgEl = document.getElementById('dailyMPGCalc');
                if (mpgEl) {
                    if (fuel > 0 && miles > 0 && fullTank) {
                        const mpg = (miles * 4.54609) / fuel;
                        mpgEl.textContent = mpg.toFixed(1);
                    } else {
                        mpgEl.textContent = '-';
                    }
                }
            };

            if (startInput) startInput.addEventListener('input', updateCalc);
            if (endInput) endInput.addEventListener('input', updateCalc);
            if (fuelInput) fuelInput.addEventListener('input', updateCalc);
            if (fullTankCheck) fullTankCheck.addEventListener('change', updateCalc);

            dailyMileageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const start = parseFloat(startInput.value);
                const end = parseFloat(endInput.value);
                const fuel = parseFloat(fuelInput.value) || 0;
                const fullTank = fullTankCheck.checked;

                if (end <= start) {
                    showToast('End odometer must be greater than start', 'error');
                    return;
                }

                const miles = end - start;
                const mpg = (fuel > 0 && fullTank) ? (miles * 4.54609) / fuel : 0;

                this.store.addMileage({ start, end, fuel, miles, mpg, date, fullTank });
                showToast('Mileage added!', 'success');
                e.target.reset();
                updateCalc();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        this.renderDailyLogForDate();
    }

    renderDailyLogForDate() {
        const dateInput = document.getElementById('dailyLogDate');
        if (!dateInput) return;

        const selectedDate = dateInput.value;
        
        const displayDate = new Date(selectedDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const dateDisplayEl = document.getElementById('dailyLogDateDisplay');
        if (dateDisplayEl) dateDisplayEl.textContent = displayDate;

        const dayIncome = this.store.data.income.filter(i => i.date === selectedDate);
        const dayExpenses = this.store.data.expenses.filter(e => e.date === selectedDate);
        const dayMileage = this.store.data.mileage.filter(m => m.date === selectedDate);

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

        // Render income
        const incomeContainer = document.getElementById('dailyIncomeEntries');
        if (incomeContainer) {
            incomeContainer.innerHTML = dayIncome.length === 0 
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No income entries</div>'
                : dayIncome.map(entry => `
                    <div class="daily-entry-item income-type">
                        <div class="daily-entry-info"><div>${entry.description}</div></div>
                        <span class="daily-entry-amount income">${formatCurrency(entry.amount)}</span>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('income', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('income', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Render expenses
        const expenseContainer = document.getElementById('dailyExpenseEntries');
        if (expenseContainer) {
            expenseContainer.innerHTML = dayExpenses.length === 0
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No expense entries</div>'
                : dayExpenses.map(entry => `
                    <div class="daily-entry-item expense-type">
                        <div class="daily-entry-info">
                            <div>${entry.description}</div>
                            <div style="font-size: 0.75rem; color: #6B7280;">${categoryNames[entry.category]}</div>
                        </div>
                        <span class="daily-entry-amount expense">${formatCurrency(entry.amount)}</span>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('expenses', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('expenses', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Render mileage
        const mileageContainer = document.getElementById('dailyMileageEntry');
        if (mileageContainer) {
            mileageContainer.innerHTML = dayMileage.length === 0
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No mileage entry</div>'
                : dayMileage.map(entry => `
                    <div class="daily-entry-item">
                        <div class="daily-entry-info">
                            <div>${entry.miles.toFixed(1)} miles</div>
                            <div style="font-size: 0.75rem; color: #6B7280;">${entry.start} → ${entry.end} ${entry.mpg > 0 ? `• ${entry.mpg.toFixed(1)} MPG` : ''}</div>
                        </div>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('mileage', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('mileage', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Summary
        const totalIncome = dayIncome.reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalMiles = dayMileage.reduce((sum, m) => sum + m.miles, 0);

        const elements = {
            'dailyTotalIncome': formatCurrency(totalIncome),
            'dailyTotalExpenses': formatCurrency(totalExpenses),
            'dailyNetProfit': formatCurrency(totalIncome - totalExpenses),
            'dailyTotalMiles': Math.round(totalMiles).toString()
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    // === EDIT MODAL ===
    openEditModal(type, id) {
        const entry = this.store.getEntry(type, id);
        if (!entry) return;

        this.currentEditType = type;
        this.currentEditId = id;

        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        if (!modal || !modalTitle || !modalBody) return;

        const titles = { income: 'Edit Income', expenses: 'Edit Expense', mileage: 'Edit Mileage' };
        modalTitle.textContent = titles[type] || 'Edit Entry';

        if (type === 'income') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Amount (£)</label>
                        <input type="number" id="editAmount" step="0.01" value="${entry.amount}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="editDescription" value="${entry.description}" required>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                </div>
            `;
        } else if (type === 'expenses') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Category</label>
                        <select id="editCategory" required>
                            <option value="fuel" ${entry.category === 'fuel' ? 'selected' : ''}>⛽ Fuel</option>
                            <option value="food" ${entry.category === 'food' ? 'selected' : ''}>🍔 Food</option>
                            <option value="vehicle_maintenance" ${entry.category === 'vehicle_maintenance' ? 'selected' : ''}>🔧 Vehicle Maintenance</option>
                            <option value="tools" ${entry.category === 'tools' ? 'selected' : ''}>🛠️ Tools</option>
                            <option value="clothes" ${entry.category === 'clothes' ? 'selected' : ''}>👔 Work Clothes</option>
                            <option value="insurance" ${entry.category === 'insurance' ? 'selected' : ''}>🛡️ Insurance</option>
                            <option value="phone" ${entry.category === 'phone' ? 'selected' : ''}>📱 Phone/Internet</option>
                            <option value="office" ${entry.category === 'office' ? 'selected' : ''}>🏢 Office Supplies</option>
                            <option value="other" ${entry.category === 'other' ? 'selected' : ''}>📦 Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount (£)</label>
                        <input type="number" id="editAmount" step="0.01" value="${entry.amount}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="editDescription" value="${entry.description}" required>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                </div>
            `;
        } else if (type === 'mileage') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Start Odometer</label>
                        <input type="number" id="editStartOdo" step="0.1" value="${entry.start}" required>
                    </div>
                    <div class="form-group">
                        <label>End Odometer</label>
                        <input type="number" id="editEndOdo" step="0.1" value="${entry.end}" required>
                    </div>
                    <div class="form-group">
                        <label>Fuel Added (Litres)</label>
                        <input type="number" id="editFuel" step="0.01" value="${entry.fuel || 0}">
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="editFullTank" ${entry.fullTank ? 'checked' : ''}> Full tank fill-up</label>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                    <div id="editValidationWarning"></div>
                </div>
            `;

            setTimeout(() => {
                const startInput = document.getElementById('editStartOdo');
                const endInput = document.getElementById('editEndOdo');
                const warningDiv = document.getElementById('editValidationWarning');

                const validate = () => {
                    const start = parseFloat(startInput.value) || 0;
                    const end = parseFloat(endInput.value) || 0;
                    
                    if (end <= start && end > 0) {
                        warningDiv.innerHTML = '<div class="validation-warning">⚠️ End odometer must be greater than start</div>';
                    } else if ((end - start) > 500) {
                        warningDiv.innerHTML = '<div class="validation-warning">⚠️ That\'s a lot of miles. Please confirm.</div>';
                    } else {
                        warningDiv.innerHTML = '';
                    }
                };

                startInput.addEventListener('input', validate);
                endInput.addEventListener('input', validate);
            }, 100);
        }

        modal.classList.add('active');
    }

    closeEditModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.classList.remove('active');
            this.currentEditType = null;
            this.currentEditId = null;
        }
    }

    saveEdit() {
        if (!this.currentEditType || !this.currentEditId) return;

        const type = this.currentEditType;
        const id = this.currentEditId;
        let updatedData = {};

        if (type === 'income') {
            const amount = parseFloat(document.getElementById('editAmount').value);
            const description = document.getElementById('editDescription').value;
            const date = document.getElementById('editDate').value;
            
            if (!amount || !description || !date) {
                showToast('Please fill all fields', 'error');
                return;
            }
            updatedData = { amount, description, date };
        } else if (type === 'expenses') {
            const category = document.getElementById('editCategory').value;
            const amount = parseFloat(document.getElementById('editAmount').value);
            const description = document.getElementById('editDescription').value;
            const date = document.getElementById('editDate').value;

            if (!category || !amount || !description || !date) {
                showToast('Please fill all fields', 'error');
                return;
            }
            updatedData = { category, amount, description, date };
        } else if (type === 'mileage') {
            const start = parseFloat(document.getElementById('editStartOdo').value);
            const end = parseFloat(document.getElementById('editEndOdo').value);
            const fuel = parseFloat(document.getElementById('editFuel').value) || 0;
            const fullTank = document.getElementById('editFullTank').checked;
            const date = document.getElementById('editDate').value;

            if (!start || !end || !date) {
                showToast('Please fill all required fields', 'error');
                return;
            }

            if (end <= start) {
                showToast('End odometer must be greater than start', 'error');
                return;
            }

            const miles = end - start;
            const mpg = (fuel > 0 && fullTank) ? (miles * 4.54609) / fuel : 0;
            updatedData = { start, end, fuel, fullTank, miles, mpg, date };
        }

        if (this.store.updateEntry(type, id, updatedData)) {
            showToast('Entry updated!', 'success');
            this.closeEditModal();
            this.renderAll();
            this.renderDailyLogForDate();
        } else {
            showToast('Error updating entry', 'error');
        }
    }

    // === VIEW TOGGLE ===
    setupViewToggles() {
        const mileageToggles = document.querySelectorAll('.view-toggle .toggle-btn');
        const mileageList = document.getElementById('mileageList');
        const mileageTable = document.getElementById('mileageTable');

        mileageToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                mileageToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (view === 'table') {
                    if (mileageList) mileageList.style.display = 'none';
                    if (mileageTable) mileageTable.style.display = 'block';
                    this.renderMileageTable();
                } else {
                    if (mileageList) mileageList.style.display = 'flex';
                    if (mileageTable) mileageTable.style.display = 'none';
                }
            });
        });
    }

    renderMileageTable() {
        const tbody = document.getElementById('mileageTableBody');
        if (!tbody) return;

        const sorted = [...this.store.data.mileage].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #9CA3AF;">No mileage entries yet</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map(entry => `
            <tr>
                <td>${formatDate(entry.date)}</td>
                <td>${entry.start.toFixed(1)}</td>
                <td>${entry.end.toFixed(1)}</td>
                <td>${entry.miles.toFixed(1)}</td>
                <td>${entry.fuel ? entry.fuel.toFixed(2) : '-'}</td>
                <td>${entry.mpg > 0 ? entry.mpg.toFixed(1) : '-'}</td>
                <td>${entry.fullTank ? '✓' : '-'}</td>
                <td class="table-actions">
                    <button class="icon-btn edit" onclick="app.openEditModal('mileage', ${entry.id})" title="Edit">✎</button>
                    <button class="icon-btn delete" onclick="app.deleteEntry('mileage', ${entry.id})" title="Delete">×</button>
                </td>
            </tr>
        `).join('');
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

        if (stored) {
            return JSON.parse(stored);// Data Storage Manager
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

    updateEntry(type, id, updatedData) {
        const index = this.data[type].findIndex(item => item.id === id);
        if (index !== -1) {
            this.data[type][index] = { ...this.data[type][index], ...updatedData };
            this.saveData();
            return true;
        }
        return false;
    }

    getEntry(type, id) {
        return this.data[type].find(item => item.id === id);
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
        this.charts = {};
        this.initializeApp();
    }

    initializeApp() {
        this.setupTabs();
        this.setupForms();
        this.setupDailyLog();
        this.setupPeriodButtons();
        this.setupDataManagement();
        this.setupAutoCalculations();
        this.setupViewToggles();
        this.currentEditType = null;
        this.currentEditId = null;
        this.renderAll();
        this.setDefaultDates();
        this.initializeCharts();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const mileageDateEl = document.getElementById('mileageDate');
        const expenseDateEl = document.getElementById('expenseDate');
        const incomeDateEl = document.getElementById('incomeDate');
        const dailyLogDateEl = document.getElementById('dailyLogDate');
        
        if (mileageDateEl) mileageDateEl.value = today;
        if (expenseDateEl) expenseDateEl.value = today;
        if (incomeDateEl) incomeDateEl.value = today;
        if (dailyLogDateEl) {
            dailyLogDateEl.value = today;
            dailyLogDateEl.addEventListener('change', () => this.renderDailyLogForDate());
        }
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
        this.updateWeeklyChart();
    }

    initializeCharts() {
        // Initialize weekly trend chart
        const ctx = document.getElementById('weeklyChart');
        if (ctx) {
            this.charts.weekly = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Net Profit',
                        data: [],
                        borderColor: '#4F46E5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => '£' + value
                            }
                        }
                    }
                }
            });
        }
    }

    updateWeeklyChart() {
        if (!this.charts.weekly) return;

        // Get last 7 days
        const days = [];
        const profits = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayIncome = this.store.data.income
                .filter(item => item.date === dateStr)
                .reduce((sum, item) => sum + item.amount, 0);
            
            const dayExpenses = this.store.data.expenses
                .filter(item => item.date === dateStr)
                .reduce((sum, item) => sum + item.amount, 0);
            
            days.push(date.toLocaleDateString('en-GB', { weekday: 'short' }));
            profits.push(dayIncome - dayExpenses);
        }

        this.charts.weekly.data.labels = days;
        this.charts.weekly.data.datasets[0].data = profits;
        this.charts.weekly.update();
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

        // Get yesterday's net for comparison
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const yesterdayIncome = this.store.data.income
            .filter(i => i.date === yesterdayStr)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yesterdayExpenses = this.store.data.expenses
            .filter(e => e.date === yesterdayStr)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const yesterdayNet = yesterdayIncome - yesterdayExpenses;
        const change = todayNet - yesterdayNet;
        
        // Update today's change indicator
        const changeEl = document.getElementById('todayChange');
        if (changeEl) {
            if (change > 0) {
                changeEl.textContent = `↑ ${formatCurrency(change)} vs yesterday`;
                changeEl.style.color = '#10B981';
            } else if (change < 0) {
                changeEl.textContent = `↓ ${formatCurrency(Math.abs(change))} vs yesterday`;
                changeEl.style.color = '#EF4444';
            } else {
                changeEl.textContent = 'Same as yesterday';
                changeEl.style.color = '#6B7280';
            }
        }

        document.getElementById('dashIncome').textContent = formatCurrency(todayIncome);
        document.getElementById('dashExpenses').textContent = formatCurrency(todayExpenses);
        document.getElementById('dashNet').textContent = formatCurrency(todayNet);
        document.getElementById('dashMiles').textContent = Math.round(todayMiles);
        
        document.getElementById('todayNet').textContent = formatCurrency(todayNet);
        
        // Calculate tax due and weekly savings needed
        const yearlyProfit = this.calculateYearlyProfit();
        const mileageDeduction = this.calculateMileageAllowance();
        const adjustedProfit = yearlyProfit - mileageDeduction;
        const taxDue = this.calculateTotalTax(adjustedProfit);
        
        document.getElementById('taxDue').textContent = formatCurrency(taxDue);
        
        // Weekly tax saving target (52 weeks)
        const weeklyTaxSave = Math.round(taxDue / 52);
        const weeklyEl = document.getElementById('weeklyTaxSave');
        if (weeklyEl) {
            weeklyEl.textContent = weeklyTaxSave;
        }

        // Personal allowance progress
        const settings = this.store.data.settings;
        const allowanceUsed = Math.min(yearlyProfit, settings.personalAllowance);
        const allowancePercent = Math.min(100, (yearlyProfit / settings.personalAllowance) * 100);
        
        const percentEl = document.getElementById('allowancePercent');
        const progressEl = document.getElementById('allowanceProgress');
        
        if (percentEl && progressEl) {
            percentEl.textContent = `${Math.round(allowancePercent)}%`;
            progressEl.style.width = `${allowancePercent}%`;
        }
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

        // Mileage allowance calculation
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const now = new Date();
        const yearMiles = filterByDateRange(this.store.data.mileage, yearStart, now)
            .reduce((sum, m) => sum + m.miles, 0);
        
        const mileageAllowance = this.calculateMileageAllowance();
        
        const yearFuelCost = this.store.data.expenses
            .filter(e => e.category === 'fuel' && new Date(e.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, e) => sum + e.amount, 0);
        
        const yearMilesEl = document.getElementById('yearMiles');
        const mileageAllowanceEl = document.getElementById('mileageAllowance');
        const actualFuelEl = document.getElementById('actualFuelCost');
        const bestClaimEl = document.getElementById('bestClaim');
        const mileageTaxSavingEl = document.getElementById('mileageTaxSaving');
        
        if (yearMilesEl) yearMilesEl.textContent = Math.round(yearMiles);
        if (mileageAllowanceEl) mileageAllowanceEl.textContent = formatCurrency(mileageAllowance);
        if (actualFuelEl) actualFuelEl.textContent = formatCurrency(yearFuelCost);
        
        if (bestClaimEl) {
            if (mileageAllowance > yearFuelCost) {
                bestClaimEl.textContent = '✓ Mileage allowance';
                bestClaimEl.style.color = '#10B981';
            } else {
                bestClaimEl.textContent = '✓ Actual costs (likely)';
                bestClaimEl.style.color = '#10B981';
            }
        }
        
        if (mileageTaxSavingEl) {
            const taxSaving = Math.max(mileageAllowance, yearFuelCost);
            mileageTaxSavingEl.textContent = formatCurrency(taxSaving);
        }

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
        // UK tax year runs April 6 to April 5
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed
        
        // If before April 6, tax year is previous year to current year
        // If April 6 or later, tax year is current year to next year
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6); // April 6 of previous year
        } else {
            taxYearStart = new Date(currentYear, 3, 6); // April 6 of current year
        }
        
        const yearIncome = filterByDateRange(this.store.data.income, taxYearStart, now)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = filterByDateRange(this.store.data.expenses, taxYearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        return yearIncome - yearExpenses;
    }

    calculateMileageAllowance() {
        // UK tax year runs April 6 to April 5
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6);
        } else {
            taxYearStart = new Date(currentYear, 3, 6);
        }
        
        const yearMiles = filterByDateRange(this.store.data.mileage, taxYearStart, now)
            .reduce((sum, m) => sum + m.miles, 0);
        
        // HMRC rates: 45p for first 10,000 miles, 25p thereafter
        let allowance = 0;
        if (yearMiles <= 10000) {
            allowance = yearMiles * 0.45;
        } else {
            allowance = (10000 * 0.45) + ((yearMiles - 10000) * 0.25);
        }
        
        return allowance;
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
        const mileageDeduction = this.calculateMileageAllowance();
        const adjustedProfit = yearlyProfit - mileageDeduction;
        const settings = this.store.data.settings;
        
        // UK tax year
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6);
        } else {
            taxYearStart = new Date(currentYear, 3, 6);
        }
        
        const yearIncome = filterByDateRange(this.store.data.income, taxYearStart, now)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = filterByDateRange(this.store.data.expenses, taxYearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const taxableIncome = Math.max(0, adjustedProfit - settings.personalAllowance);
        const incomeTax = taxableIncome * settings.incomeTaxRate;
        
        const niableIncome = Math.max(0, adjustedProfit - settings.niThreshold);
        const ni = niableIncome * settings.niRate;
        
        const totalTax = incomeTax + ni;

        document.getElementById('taxGrossIncome').textContent = formatCurrency(yearIncome);
        document.getElementById('taxExpenses').textContent = formatCurrency(yearExpenses + mileageDeduction);
        document.getElementById('taxableProfit').textContent = formatCurrency(adjustedProfit);
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
        document.getElementById('annualProfit').textContent = formatCurrency(adjustedProfit);
        document.getElementById('annualMiles').textContent = Math.round(yearMiles);
    }

    // === DAILY LOG SYSTEM ===
    setupDailyLog() {
        // Daily Income Form
        const dailyIncomeForm = document.getElementById('dailyIncomeForm');
        if (dailyIncomeForm) {
            dailyIncomeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const amount = parseFloat(document.getElementById('dailyIncomeAmount').value);
                const description = document.getElementById('dailyIncomeDesc').value;

                this.store.addIncome({ amount, description, date });
                showToast('Income added!', 'success');
                e.target.reset();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        // Daily Expense Form
        const dailyExpenseForm = document.getElementById('dailyExpenseForm');
        if (dailyExpenseForm) {
            dailyExpenseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const category = document.getElementById('dailyExpenseCategory').value;
                const amount = parseFloat(document.getElementById('dailyExpenseAmount').value);
                const description = document.getElementById('dailyExpenseDesc').value;

                this.store.addExpense({ category, amount, description, date, recurring: false });
                showToast('Expense added!', 'success');
                e.target.reset();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        // Daily Mileage Form
        const dailyMileageForm = document.getElementById('dailyMileageForm');
        if (dailyMileageForm) {
            // Auto-calculate on input
            const startInput = document.getElementById('dailyStartOdo');
            const endInput = document.getElementById('dailyEndOdo');
            const fuelInput = document.getElementById('dailyFuel');
            const fullTankCheck = document.getElementById('dailyFullTank');

            const updateCalc = () => {
                const start = parseFloat(startInput?.value) || 0;
                const end = parseFloat(endInput?.value) || 0;
                const fuel = parseFloat(fuelInput?.value) || 0;
                const fullTank = fullTankCheck?.checked;

                const miles = Math.max(0, end - start);
                const milesEl = document.getElementById('dailyMilesCalc');
                if (milesEl) milesEl.textContent = miles.toFixed(1);

                const mpgEl = document.getElementById('dailyMPGCalc');
                if (mpgEl) {
                    if (fuel > 0 && miles > 0 && fullTank) {
                        const mpg = (miles * 4.54609) / fuel;
                        mpgEl.textContent = mpg.toFixed(1);
                    } else {
                        mpgEl.textContent = '-';
                    }
                }
            };

            if (startInput) startInput.addEventListener('input', updateCalc);
            if (endInput) endInput.addEventListener('input', updateCalc);
            if (fuelInput) fuelInput.addEventListener('input', updateCalc);
            if (fullTankCheck) fullTankCheck.addEventListener('change', updateCalc);

            dailyMileageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const start = parseFloat(startInput.value);
                const end = parseFloat(endInput.value);
                const fuel = parseFloat(fuelInput.value) || 0;
                const fullTank = fullTankCheck.checked;

                if (end <= start) {
                    showToast('End odometer must be greater than start', 'error');
                    return;
                }

                const miles = end - start;
                const mpg = (fuel > 0 && fullTank) ? (miles * 4.54609) / fuel : 0;

                this.store.addMileage({ start, end, fuel, miles, mpg, date, fullTank });
                showToast('Mileage added!', 'success');
                e.target.reset();
                updateCalc();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        this.renderDailyLogForDate();
    }

    renderDailyLogForDate() {
        const dateInput = document.getElementById('dailyLogDate');
        if (!dateInput) return;

        const selectedDate = dateInput.value;
        
        const displayDate = new Date(selectedDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const dateDisplayEl = document.getElementById('dailyLogDateDisplay');
        if (dateDisplayEl) dateDisplayEl.textContent = displayDate;

        const dayIncome = this.store.data.income.filter(i => i.date === selectedDate);
        const dayExpenses = this.store.data.expenses.filter(e => e.date === selectedDate);
        const dayMileage = this.store.data.mileage.filter(m => m.date === selectedDate);

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

        // Render income
        const incomeContainer = document.getElementById('dailyIncomeEntries');
        if (incomeContainer) {
            incomeContainer.innerHTML = dayIncome.length === 0 
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No income entries</div>'
                : dayIncome.map(entry => `
                    <div class="daily-entry-item income-type">
                        <div class="daily-entry-info"><div>${entry.description}</div></div>
                        <span class="daily-entry-amount income">${formatCurrency(entry.amount)}</span>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('income', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('income', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Render expenses
        const expenseContainer = document.getElementById('dailyExpenseEntries');
        if (expenseContainer) {
            expenseContainer.innerHTML = dayExpenses.length === 0
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No expense entries</div>'
                : dayExpenses.map(entry => `
                    <div class="daily-entry-item expense-type">
                        <div class="daily-entry-info">
                            <div>${entry.description}</div>
                            <div style="font-size: 0.75rem; color: #6B7280;">${categoryNames[entry.category]}</div>
                        </div>
                        <span class="daily-entry-amount expense">${formatCurrency(entry.amount)}</span>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('expenses', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('expenses', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Render mileage
        const mileageContainer = document.getElementById('dailyMileageEntry');
        if (mileageContainer) {
            mileageContainer.innerHTML = dayMileage.length === 0
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No mileage entry</div>'
                : dayMileage.map(entry => `
                    <div class="daily-entry-item">
                        <div class="daily-entry-info">
                            <div>${entry.miles.toFixed(1)} miles</div>
                            <div style="font-size: 0.75rem; color: #6B7280;">${entry.start} → ${entry.end} ${entry.mpg > 0 ? `• ${entry.mpg.toFixed(1)} MPG` : ''}</div>
                        </div>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('mileage', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('mileage', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Summary
        const totalIncome = dayIncome.reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalMiles = dayMileage.reduce((sum, m) => sum + m.miles, 0);

        const elements = {
            'dailyTotalIncome': formatCurrency(totalIncome),
            'dailyTotalExpenses': formatCurrency(totalExpenses),
            'dailyNetProfit': formatCurrency(totalIncome - totalExpenses),
            'dailyTotalMiles': Math.round(totalMiles).toString()
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    // === EDIT MODAL ===
    openEditModal(type, id) {
        const entry = this.store.getEntry(type, id);
        if (!entry) return;

        this.currentEditType = type;
        this.currentEditId = id;

        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        if (!modal || !modalTitle || !modalBody) return;

        const titles = { income: 'Edit Income', expenses: 'Edit Expense', mileage: 'Edit Mileage' };
        modalTitle.textContent = titles[type] || 'Edit Entry';

        if (type === 'income') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Amount (£)</label>
                        <input type="number" id="editAmount" step="0.01" value="${entry.amount}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="editDescription" value="${entry.description}" required>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                </div>
            `;
        } else if (type === 'expenses') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Category</label>
                        <select id="editCategory" required>
                            <option value="fuel" ${entry.category === 'fuel' ? 'selected' : ''}>⛽ Fuel</option>
                            <option value="food" ${entry.category === 'food' ? 'selected' : ''}>🍔 Food</option>
                            <option value="vehicle_maintenance" ${entry.category === 'vehicle_maintenance' ? 'selected' : ''}>🔧 Vehicle Maintenance</option>
                            <option value="tools" ${entry.category === 'tools' ? 'selected' : ''}>🛠️ Tools</option>
                            <option value="clothes" ${entry.category === 'clothes' ? 'selected' : ''}>👔 Work Clothes</option>
                            <option value="insurance" ${entry.category === 'insurance' ? 'selected' : ''}>🛡️ Insurance</option>
                            <option value="phone" ${entry.category === 'phone' ? 'selected' : ''}>📱 Phone/Internet</option>
                            <option value="office" ${entry.category === 'office' ? 'selected' : ''}>🏢 Office Supplies</option>
                            <option value="other" ${entry.category === 'other' ? 'selected' : ''}>📦 Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount (£)</label>
                        <input type="number" id="editAmount" step="0.01" value="${entry.amount}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="editDescription" value="${entry.description}" required>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                </div>
            `;
        } else if (type === 'mileage') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Start Odometer</label>
                        <input type="number" id="editStartOdo" step="0.1" value="${entry.start}" required>
                    </div>
                    <div class="form-group">
                        <label>End Odometer</label>
                        <input type="number" id="editEndOdo" step="0.1" value="${entry.end}" required>
                    </div>
                    <div class="form-group">
                        <label>Fuel Added (Litres)</label>
                        <input type="number" id="editFuel" step="0.01" value="${entry.fuel || 0}">
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="editFullTank" ${entry.fullTank ? 'checked' : ''}> Full tank fill-up</label>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                    <div id="editValidationWarning"></div>
                </div>
            `;

            setTimeout(() => {
                const startInput = document.getElementById('editStartOdo');
                const endInput = document.getElementById('editEndOdo');
                const warningDiv = document.getElementById('editValidationWarning');

                const validate = () => {
                    const start = parseFloat(startInput.value) || 0;
                    const end = parseFloat(endInput.value) || 0;
                    
                    if (end <= start && end > 0) {
                        warningDiv.innerHTML = '<div class="validation-warning">⚠️ End odometer must be greater than start</div>';
                    } else if ((end - start) > 500) {
                        warningDiv.innerHTML = '<div class="validation-warning">⚠️ That\'s a lot of miles. Please confirm.</div>';
                    } else {
                        warningDiv.innerHTML = '';
                    }
                };

                startInput.addEventListener('input', validate);
                endInput.addEventListener('input', validate);
            }, 100);
        }

        modal.classList.add('active');
    }

    closeEditModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.classList.remove('active');
            this.currentEditType = null;
            this.currentEditId = null;
        }
    }

    saveEdit() {
        if (!this.currentEditType || !this.currentEditId) return;

        const type = this.currentEditType;
        const id = this.currentEditId;
        let updatedData = {};

        if (type === 'income') {
            const amount = parseFloat(document.getElementById('editAmount').value);
            const description = document.getElementById('editDescription').value;
            const date = document.getElementById('editDate').value;
            
            if (!amount || !description || !date) {
                showToast('Please fill all fields', 'error');
                return;
            }
            updatedData = { amount, description, date };
        } else if (type === 'expenses') {
            const category = document.getElementById('editCategory').value;
            const amount = parseFloat(document.getElementById('editAmount').value);
            const description = document.getElementById('editDescription').value;
            const date = document.getElementById('editDate').value;

            if (!category || !amount || !description || !date) {
                showToast('Please fill all fields', 'error');
                return;
            }
            updatedData = { category, amount, description, date };
        } else if (type === 'mileage') {
            const start = parseFloat(document.getElementById('editStartOdo').value);
            const end = parseFloat(document.getElementById('editEndOdo').value);
            const fuel = parseFloat(document.getElementById('editFuel').value) || 0;
            const fullTank = document.getElementById('editFullTank').checked;
            const date = document.getElementById('editDate').value;

            if (!start || !end || !date) {
                showToast('Please fill all required fields', 'error');
                return;
            }

            if (end <= start) {
                showToast('End odometer must be greater than start', 'error');
                return;
            }

            const miles = end - start;
            const mpg = (fuel > 0 && fullTank) ? (miles * 4.54609) / fuel : 0;
            updatedData = { start, end, fuel, fullTank, miles, mpg, date };
        }

        if (this.store.updateEntry(type, id, updatedData)) {
            showToast('Entry updated!', 'success');
            this.closeEditModal();
            this.renderAll();
            this.renderDailyLogForDate();
        } else {
            showToast('Error updating entry', 'error');
        }
    }

    // === VIEW TOGGLE ===
    setupViewToggles() {
        const mileageToggles = document.querySelectorAll('.view-toggle .toggle-btn');
        const mileageList = document.getElementById('mileageList');
        const mileageTable = document.getElementById('mileageTable');

        mileageToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                mileageToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (view === 'table') {
                    if (mileageList) mileageList.style.display = 'none';
                    if (mileageTable) mileageTable.style.display = 'block';
                    this.renderMileageTable();
                } else {
                    if (mileageList) mileageList.style.display = 'flex';
                    if (mileageTable) mileageTable.style.display = 'none';
                }
            });
        });
    }

    renderMileageTable() {
        const tbody = document.getElementById('mileageTableBody');
        if (!tbody) return;

        const sorted = [...this.store.data.mileage].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #9CA3AF;">No mileage entries yet</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map(entry => `
            <tr>
                <td>${formatDate(entry.date)}</td>
                <td>${entry.start.toFixed(1)}</td>
                <td>${entry.end.toFixed(1)}</td>
                <td>${entry.miles.toFixed(1)}</td>
                <td>${entry.fuel ? entry.fuel.toFixed(2) : '-'}</td>
                <td>${entry.mpg > 0 ? entry.mpg.toFixed(1) : '-'}</td>
                <td>${entry.fullTank ? '✓' : '-'}</td>
                <td class="table-actions">
                    <button class="icon-btn edit" onclick="app.openEditModal('mileage', ${entry.id})" title="Edit">✎</button>
                    <button class="icon-btn delete" onclick="app.deleteEntry('mileage', ${entry.id})" title="Delete">×</button>
                </td>
            </tr>
        `).join('');
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

    updateEntry(type, id, updatedData) {
        const index = this.data[type].findIndex(item => item.id === id);
        if (index !== -1) {
            this.data[type][index] = { ...this.data[type][index], ...updatedData };
            this.saveData();
            return true;
        }
        return false;
    }

    getEntry(type, id) {
        return this.data[type].find(item => item.id === id);
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
        this.charts = {};
        this.initializeApp();
    }

    initializeApp() {
        this.setupTabs();
        this.setupForms();
        this.setupDailyLog();
        this.setupPeriodButtons();
        this.setupDataManagement();
        this.setupAutoCalculations();
        this.setupViewToggles();
        this.currentEditType = null;
        this.currentEditId = null;
        this.renderAll();
        this.setDefaultDates();
        this.initializeCharts();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const mileageDateEl = document.getElementById('mileageDate');
        const expenseDateEl = document.getElementById('expenseDate');
        const incomeDateEl = document.getElementById('incomeDate');
        const dailyLogDateEl = document.getElementById('dailyLogDate');
        
        if (mileageDateEl) mileageDateEl.value = today;
        if (expenseDateEl) expenseDateEl.value = today;
        if (incomeDateEl) incomeDateEl.value = today;
        if (dailyLogDateEl) {
            dailyLogDateEl.value = today;
            dailyLogDateEl.addEventListener('change', () => this.renderDailyLogForDate());
        }
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
        this.updateWeeklyChart();
    }

    initializeCharts() {
        // Initialize weekly trend chart
        const ctx = document.getElementById('weeklyChart');
        if (ctx) {
            this.charts.weekly = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Net Profit',
                        data: [],
                        borderColor: '#4F46E5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => '£' + value
                            }
                        }
                    }
                }
            });
        }
    }

    updateWeeklyChart() {
        if (!this.charts.weekly) return;

        // Get last 7 days
        const days = [];
        const profits = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayIncome = this.store.data.income
                .filter(item => item.date === dateStr)
                .reduce((sum, item) => sum + item.amount, 0);
            
            const dayExpenses = this.store.data.expenses
                .filter(item => item.date === dateStr)
                .reduce((sum, item) => sum + item.amount, 0);
            
            days.push(date.toLocaleDateString('en-GB', { weekday: 'short' }));
            profits.push(dayIncome - dayExpenses);
        }

        this.charts.weekly.data.labels = days;
        this.charts.weekly.data.datasets[0].data = profits;
        this.charts.weekly.update();
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

        // Get yesterday's net for comparison
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const yesterdayIncome = this.store.data.income
            .filter(i => i.date === yesterdayStr)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yesterdayExpenses = this.store.data.expenses
            .filter(e => e.date === yesterdayStr)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const yesterdayNet = yesterdayIncome - yesterdayExpenses;
        const change = todayNet - yesterdayNet;
        
        // Update today's change indicator
        const changeEl = document.getElementById('todayChange');
        if (changeEl) {
            if (change > 0) {
                changeEl.textContent = `↑ ${formatCurrency(change)} vs yesterday`;
                changeEl.style.color = '#10B981';
            } else if (change < 0) {
                changeEl.textContent = `↓ ${formatCurrency(Math.abs(change))} vs yesterday`;
                changeEl.style.color = '#EF4444';
            } else {
                changeEl.textContent = 'Same as yesterday';
                changeEl.style.color = '#6B7280';
            }
        }

        document.getElementById('dashIncome').textContent = formatCurrency(todayIncome);
        document.getElementById('dashExpenses').textContent = formatCurrency(todayExpenses);
        document.getElementById('dashNet').textContent = formatCurrency(todayNet);
        document.getElementById('dashMiles').textContent = Math.round(todayMiles);
        
        document.getElementById('todayNet').textContent = formatCurrency(todayNet);
        
        // Calculate tax due and weekly savings needed
        const yearlyProfit = this.calculateYearlyProfit();
        const mileageDeduction = this.calculateMileageAllowance();
        const adjustedProfit = yearlyProfit - mileageDeduction;
        const taxDue = this.calculateTotalTax(adjustedProfit);
        
        document.getElementById('taxDue').textContent = formatCurrency(taxDue);
        
        // Weekly tax saving target (52 weeks)
        const weeklyTaxSave = Math.round(taxDue / 52);
        const weeklyEl = document.getElementById('weeklyTaxSave');
        if (weeklyEl) {
            weeklyEl.textContent = weeklyTaxSave;
        }

        // Personal allowance progress
        const settings = this.store.data.settings;
        const allowanceUsed = Math.min(yearlyProfit, settings.personalAllowance);
        const allowancePercent = Math.min(100, (yearlyProfit / settings.personalAllowance) * 100);
        
        const percentEl = document.getElementById('allowancePercent');
        const progressEl = document.getElementById('allowanceProgress');
        
        if (percentEl && progressEl) {
            percentEl.textContent = `${Math.round(allowancePercent)}%`;
            progressEl.style.width = `${allowancePercent}%`;
        }
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

        // Mileage allowance calculation
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const now = new Date();
        const yearMiles = filterByDateRange(this.store.data.mileage, yearStart, now)
            .reduce((sum, m) => sum + m.miles, 0);
        
        const mileageAllowance = this.calculateMileageAllowance();
        
        const yearFuelCost = this.store.data.expenses
            .filter(e => e.category === 'fuel' && new Date(e.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, e) => sum + e.amount, 0);
        
        const yearMilesEl = document.getElementById('yearMiles');
        const mileageAllowanceEl = document.getElementById('mileageAllowance');
        const actualFuelEl = document.getElementById('actualFuelCost');
        const bestClaimEl = document.getElementById('bestClaim');
        const mileageTaxSavingEl = document.getElementById('mileageTaxSaving');
        
        if (yearMilesEl) yearMilesEl.textContent = Math.round(yearMiles);
        if (mileageAllowanceEl) mileageAllowanceEl.textContent = formatCurrency(mileageAllowance);
        if (actualFuelEl) actualFuelEl.textContent = formatCurrency(yearFuelCost);
        
        if (bestClaimEl) {
            if (mileageAllowance > yearFuelCost) {
                bestClaimEl.textContent = '✅ Mileage Allowance';
                bestClaimEl.style.color = '#10B981';
            } else {
                bestClaimEl.textContent = '✅ Actual Fuel';
                bestClaimEl.style.color = '#10B981';
            }
        }
        
        if (mileageTaxSavingEl) {
            const taxSaving = Math.max(mileageAllowance, yearFuelCost);
            mileageTaxSavingEl.textContent = formatCurrency(taxSaving);
        }

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

    calculateMileageAllowance() {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const now = new Date();
        
        const yearMiles = filterByDateRange(this.store.data.mileage, yearStart, now)
            .reduce((sum, m) => sum + m.miles, 0);
        
        // HMRC rates: 45p for first 10,000 miles, 25p thereafter
        let allowance = 0;
        if (yearMiles <= 10000) {
            allowance = yearMiles * 0.45;
        } else {
            allowance = (10000 * 0.45) + ((yearMiles - 10000) * 0.25);
        }
        
        return allowance;
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
        const mileageDeduction = this.calculateMileageAllowance();
        const adjustedProfit = yearlyProfit - mileageDeduction;
        const settings = this.store.data.settings;
        
        const yearIncome = this.store.data.income
            .filter(i => new Date(i.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = this.store.data.expenses
            .filter(e => new Date(e.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, e) => sum + e.amount, 0);
        
        const taxableIncome = Math.max(0, adjustedProfit - settings.personalAllowance);
        const incomeTax = taxableIncome * settings.incomeTaxRate;
        
        const niableIncome = Math.max(0, adjustedProfit - settings.niThreshold);
        const ni = niableIncome * settings.niRate;
        
        const totalTax = incomeTax + ni;

        document.getElementById('taxGrossIncome').textContent = formatCurrency(yearIncome);
        document.getElementById('taxExpenses').textContent = formatCurrency(yearExpenses + mileageDeduction);
        document.getElementById('taxableProfit').textContent = formatCurrency(adjustedProfit);
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
        document.getElementById('annualProfit').textContent = formatCurrency(adjustedProfit);
        document.getElementById('annualMiles').textContent = Math.round(yearMiles);
    }

    // === DAILY LOG SYSTEM ===
    setupDailyLog() {
        // Daily Income Form
        const dailyIncomeForm = document.getElementById('dailyIncomeForm');
        if (dailyIncomeForm) {
            dailyIncomeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const amount = parseFloat(document.getElementById('dailyIncomeAmount').value);
                const description = document.getElementById('dailyIncomeDesc').value;

                this.store.addIncome({ amount, description, date });
                showToast('Income added!', 'success');
                e.target.reset();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        // Daily Expense Form
        const dailyExpenseForm = document.getElementById('dailyExpenseForm');
        if (dailyExpenseForm) {
            dailyExpenseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const category = document.getElementById('dailyExpenseCategory').value;
                const amount = parseFloat(document.getElementById('dailyExpenseAmount').value);
                const description = document.getElementById('dailyExpenseDesc').value;

                this.store.addExpense({ category, amount, description, date, recurring: false });
                showToast('Expense added!', 'success');
                e.target.reset();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        // Daily Mileage Form
        const dailyMileageForm = document.getElementById('dailyMileageForm');
        if (dailyMileageForm) {
            // Auto-calculate on input
            const startInput = document.getElementById('dailyStartOdo');
            const endInput = document.getElementById('dailyEndOdo');
            const fuelInput = document.getElementById('dailyFuel');
            const fullTankCheck = document.getElementById('dailyFullTank');

            const updateCalc = () => {
                const start = parseFloat(startInput?.value) || 0;
                const end = parseFloat(endInput?.value) || 0;
                const fuel = parseFloat(fuelInput?.value) || 0;
                const fullTank = fullTankCheck?.checked;

                const miles = Math.max(0, end - start);
                const milesEl = document.getElementById('dailyMilesCalc');
                if (milesEl) milesEl.textContent = miles.toFixed(1);

                const mpgEl = document.getElementById('dailyMPGCalc');
                if (mpgEl) {
                    if (fuel > 0 && miles > 0 && fullTank) {
                        const mpg = (miles * 4.54609) / fuel;
                        mpgEl.textContent = mpg.toFixed(1);
                    } else {
                        mpgEl.textContent = '-';
                    }
                }
            };

            if (startInput) startInput.addEventListener('input', updateCalc);
            if (endInput) endInput.addEventListener('input', updateCalc);
            if (fuelInput) fuelInput.addEventListener('input', updateCalc);
            if (fullTankCheck) fullTankCheck.addEventListener('change', updateCalc);

            dailyMileageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const start = parseFloat(startInput.value);
                const end = parseFloat(endInput.value);
                const fuel = parseFloat(fuelInput.value) || 0;
                const fullTank = fullTankCheck.checked;

                if (end <= start) {
                    showToast('End odometer must be greater than start', 'error');
                    return;
                }

                const miles = end - start;
                const mpg = (fuel > 0 && fullTank) ? (miles * 4.54609) / fuel : 0;

                this.store.addMileage({ start, end, fuel, miles, mpg, date, fullTank });
                showToast('Mileage added!', 'success');
                e.target.reset();
                updateCalc();
                this.renderDailyLogForDate();
                this.renderAll();
            });
        }

        this.renderDailyLogForDate();
    }

    renderDailyLogForDate() {
        const dateInput = document.getElementById('dailyLogDate');
        if (!dateInput) return;

        const selectedDate = dateInput.value;
        
        const displayDate = new Date(selectedDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const dateDisplayEl = document.getElementById('dailyLogDateDisplay');
        if (dateDisplayEl) dateDisplayEl.textContent = displayDate;

        const dayIncome = this.store.data.income.filter(i => i.date === selectedDate);
        const dayExpenses = this.store.data.expenses.filter(e => e.date === selectedDate);
        const dayMileage = this.store.data.mileage.filter(m => m.date === selectedDate);

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

        // Render income
        const incomeContainer = document.getElementById('dailyIncomeEntries');
        if (incomeContainer) {
            incomeContainer.innerHTML = dayIncome.length === 0 
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No income entries</div>'
                : dayIncome.map(entry => `
                    <div class="daily-entry-item income-type">
                        <div class="daily-entry-info"><div>${entry.description}</div></div>
                        <span class="daily-entry-amount income">${formatCurrency(entry.amount)}</span>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('income', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('income', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Render expenses
        const expenseContainer = document.getElementById('dailyExpenseEntries');
        if (expenseContainer) {
            expenseContainer.innerHTML = dayExpenses.length === 0
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No expense entries</div>'
                : dayExpenses.map(entry => `
                    <div class="daily-entry-item expense-type">
                        <div class="daily-entry-info">
                            <div>${entry.description}</div>
                            <div style="font-size: 0.75rem; color: #6B7280;">${categoryNames[entry.category]}</div>
                        </div>
                        <span class="daily-entry-amount expense">${formatCurrency(entry.amount)}</span>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('expenses', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('expenses', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Render mileage
        const mileageContainer = document.getElementById('dailyMileageEntry');
        if (mileageContainer) {
            mileageContainer.innerHTML = dayMileage.length === 0
                ? '<div style="color: #9CA3AF; font-size: 0.875rem; padding: 0.5rem;">No mileage entry</div>'
                : dayMileage.map(entry => `
                    <div class="daily-entry-item">
                        <div class="daily-entry-info">
                            <div>${entry.miles.toFixed(1)} miles</div>
                            <div style="font-size: 0.75rem; color: #6B7280;">${entry.start} → ${entry.end} ${entry.mpg > 0 ? `• ${entry.mpg.toFixed(1)} MPG` : ''}</div>
                        </div>
                        <div class="daily-entry-actions">
                            <button class="icon-btn edit" onclick="app.openEditModal('mileage', ${entry.id})" title="Edit">✎</button>
                            <button class="icon-btn delete" onclick="app.deleteEntry('mileage', ${entry.id})" title="Delete">×</button>
                        </div>
                    </div>
                `).join('');
        }

        // Summary
        const totalIncome = dayIncome.reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalMiles = dayMileage.reduce((sum, m) => sum + m.miles, 0);

        const elements = {
            'dailyTotalIncome': formatCurrency(totalIncome),
            'dailyTotalExpenses': formatCurrency(totalExpenses),
            'dailyNetProfit': formatCurrency(totalIncome - totalExpenses),
            'dailyTotalMiles': Math.round(totalMiles).toString()
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    // === EDIT MODAL ===
    openEditModal(type, id) {
        const entry = this.store.getEntry(type, id);
        if (!entry) return;

        this.currentEditType = type;
        this.currentEditId = id;

        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        if (!modal || !modalTitle || !modalBody) return;

        const titles = { income: 'Edit Income', expenses: 'Edit Expense', mileage: 'Edit Mileage' };
        modalTitle.textContent = titles[type] || 'Edit Entry';

        if (type === 'income') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Amount (£)</label>
                        <input type="number" id="editAmount" step="0.01" value="${entry.amount}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="editDescription" value="${entry.description}" required>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                </div>
            `;
        } else if (type === 'expenses') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Category</label>
                        <select id="editCategory" required>
                            <option value="fuel" ${entry.category === 'fuel' ? 'selected' : ''}>⛽ Fuel</option>
                            <option value="food" ${entry.category === 'food' ? 'selected' : ''}>🍔 Food</option>
                            <option value="vehicle_maintenance" ${entry.category === 'vehicle_maintenance' ? 'selected' : ''}>🔧 Vehicle Maintenance</option>
                            <option value="tools" ${entry.category === 'tools' ? 'selected' : ''}>🛠️ Tools</option>
                            <option value="clothes" ${entry.category === 'clothes' ? 'selected' : ''}>👔 Work Clothes</option>
                            <option value="insurance" ${entry.category === 'insurance' ? 'selected' : ''}>🛡️ Insurance</option>
                            <option value="phone" ${entry.category === 'phone' ? 'selected' : ''}>📱 Phone/Internet</option>
                            <option value="office" ${entry.category === 'office' ? 'selected' : ''}>🏢 Office Supplies</option>
                            <option value="other" ${entry.category === 'other' ? 'selected' : ''}>📦 Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount (£)</label>
                        <input type="number" id="editAmount" step="0.01" value="${entry.amount}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="editDescription" value="${entry.description}" required>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                </div>
            `;
        } else if (type === 'mileage') {
            modalBody.innerHTML = `
                <div class="form">
                    <div class="form-group">
                        <label>Start Odometer</label>
                        <input type="number" id="editStartOdo" step="0.1" value="${entry.start}" required>
                    </div>
                    <div class="form-group">
                        <label>End Odometer</label>
                        <input type="number" id="editEndOdo" step="0.1" value="${entry.end}" required>
                    </div>
                    <div class="form-group">
                        <label>Fuel Added (Litres)</label>
                        <input type="number" id="editFuel" step="0.01" value="${entry.fuel || 0}">
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="editFullTank" ${entry.fullTank ? 'checked' : ''}> Full tank fill-up</label>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" value="${entry.date}" required>
                    </div>
                    <div id="editValidationWarning"></div>
                </div>
            `;

            setTimeout(() => {
                const startInput = document.getElementById('editStartOdo');
                const endInput = document.getElementById('editEndOdo');
                const warningDiv = document.getElementById('editValidationWarning');

                const validate = () => {
                    const start = parseFloat(startInput.value) || 0;
                    const end = parseFloat(endInput.value) || 0;
                    
                    if (end <= start && end > 0) {
                        warningDiv.innerHTML = '<div class="validation-warning">⚠️ End odometer must be greater than start</div>';
                    } else if ((end - start) > 500) {
                        warningDiv.innerHTML = '<div class="validation-warning">⚠️ That\'s a lot of miles. Please confirm.</div>';
                    } else {
                        warningDiv.innerHTML = '';
                    }
                };

                startInput.addEventListener('input', validate);
                endInput.addEventListener('input', validate);
            }, 100);
        }

        modal.classList.add('active');
    }

    closeEditModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.classList.remove('active');
            this.currentEditType = null;
            this.currentEditId = null;
        }
    }

    saveEdit() {
        if (!this.currentEditType || !this.currentEditId) return;

        const type = this.currentEditType;
        const id = this.currentEditId;
        let updatedData = {};

        if (type === 'income') {
            const amount = parseFloat(document.getElementById('editAmount').value);
            const description = document.getElementById('editDescription').value;
            const date = document.getElementById('editDate').value;
            
            if (!amount || !description || !date) {
                showToast('Please fill all fields', 'error');
                return;
            }
            updatedData = { amount, description, date };
        } else if (type === 'expenses') {
            const category = document.getElementById('editCategory').value;
            const amount = parseFloat(document.getElementById('editAmount').value);
            const description = document.getElementById('editDescription').value;
            const date = document.getElementById('editDate').value;

            if (!category || !amount || !description || !date) {
                showToast('Please fill all fields', 'error');
                return;
            }
            updatedData = { category, amount, description, date };
        } else if (type === 'mileage') {
            const start = parseFloat(document.getElementById('editStartOdo').value);
            const end = parseFloat(document.getElementById('editEndOdo').value);
            const fuel = parseFloat(document.getElementById('editFuel').value) || 0;
            const fullTank = document.getElementById('editFullTank').checked;
            const date = document.getElementById('editDate').value;

            if (!start || !end || !date) {
                showToast('Please fill all required fields', 'error');
                return;
            }

            if (end <= start) {
                showToast('End odometer must be greater than start', 'error');
                return;
            }

            const miles = end - start;
            const mpg = (fuel > 0 && fullTank) ? (miles * 4.54609) / fuel : 0;
            updatedData = { start, end, fuel, fullTank, miles, mpg, date };
        }

        if (this.store.updateEntry(type, id, updatedData)) {
            showToast('Entry updated!', 'success');
            this.closeEditModal();
            this.renderAll();
            this.renderDailyLogForDate();
        } else {
            showToast('Error updating entry', 'error');
        }
    }

    // === VIEW TOGGLE ===
    setupViewToggles() {
        const mileageToggles = document.querySelectorAll('.view-toggle .toggle-btn');
        const mileageList = document.getElementById('mileageList');
        const mileageTable = document.getElementById('mileageTable');

        mileageToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                mileageToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (view === 'table') {
                    if (mileageList) mileageList.style.display = 'none';
                    if (mileageTable) mileageTable.style.display = 'block';
                    this.renderMileageTable();
                } else {
                    if (mileageList) mileageList.style.display = 'flex';
                    if (mileageTable) mileageTable.style.display = 'none';
                }
            });
        });
    }

    renderMileageTable() {
        const tbody = document.getElementById('mileageTableBody');
        if (!tbody) return;

        const sorted = [...this.store.data.mileage].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #9CA3AF;">No mileage entries yet</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map(entry => `
            <tr>
                <td>${formatDate(entry.date)}</td>
                <td>${entry.start.toFixed(1)}</td>
                <td>${entry.end.toFixed(1)}</td>
                <td>${entry.miles.toFixed(1)}</td>
                <td>${entry.fuel ? entry.fuel.toFixed(2) : '-'}</td>
                <td>${entry.mpg > 0 ? entry.mpg.toFixed(1) : '-'}</td>
                <td>${entry.fullTank ? '✓' : '-'}</td>
                <td class="table-actions">
                    <button class="icon-btn edit" onclick="app.openEditModal('mileage', ${entry.id})" title="Edit">✎</button>
                    <button class="icon-btn delete" onclick="app.deleteEntry('mileage', ${entry.id})" title="Delete">×</button>
                </td>
            </tr>
        `).join('');
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


