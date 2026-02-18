// Data Storage Manager
class DataStore {
    constructor() {
        this.data = this.loadData();
    }

    loadData() {
        const stored = localStorage.getItem('soleTraderData');
        if (stored) {
            const data = JSON.parse(stored);
            // Migrate old PAYE format to new array format
            if (data.paye && !Array.isArray(data.paye)) {
                const oldPaye = data.paye;
                if (oldPaye.grossIncome > 0) {
                    data.paye = [{ taxYear: 2025, ...oldPaye }];
                } else {
                    data.paye = [];
                }
            }
            return data;
        }
        return {
            mileage: [],
            expenses: [],
            income: [],
            paye: [], // Array of {taxYear, grossIncome, taxPaid, niPaid}
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

    savePAYE(taxYear, payeData) {
        // Ensure paye is an array
        if (!Array.isArray(this.data.paye)) {
            this.data.paye = [];
        }
        // Remove existing entry for this tax year
        this.data.paye = this.data.paye.filter(p => p.taxYear !== taxYear);
        // Add new entry if it has data
        if (payeData.grossIncome > 0 || payeData.taxPaid > 0 || payeData.niPaid > 0) {
            this.data.paye.push({ taxYear, ...payeData });
        }
        this.saveData();
    }

    getPAYEForYear(taxYear) {
        if (!Array.isArray(this.data.paye)) {
            this.data.paye = [];
        }
        const payeEntry = this.data.paye.find(p => p.taxYear === taxYear);
        return payeEntry || { grossIncome: 0, taxPaid: 0, niPaid: 0 };
    }

    getEntry(type, id) {
        return this.data[type].find(item => item.id === id);
    }

    clearAll() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
            this.data = { mileage: [], expenses: [], income: [], paye: [], settings: this.data.settings };
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

function getDateRange(period, customDate = null, customEndDate = null) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
        case 'custom':
            if (customDate && customEndDate) {
                const start = new Date(customDate);
                const end = new Date(customEndDate);
                end.setHours(23, 59, 59, 999);
                return { start, end };
            }
            return { start: today, end: now };
        case 'day':
            if (customDate) {
                const dayStart = new Date(customDate);
                const dayEnd = new Date(customDate);
                dayEnd.setHours(23, 59, 59, 999);
                return { start: dayStart, end: dayEnd };
            }
            return { start: today, end: now };
        case 'week':
            if (customDate) {
                const weekStart = new Date(customDate);
                weekStart.setDate(customDate.getDate() - customDate.getDay()); // Start of week (Sunday)
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
                weekEnd.setHours(23, 59, 59, 999);
                return { start: weekStart, end: weekEnd };
            }
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return { start: weekStart, end: now };
        case 'month':
            if (customDate) {
                const monthStart = new Date(customDate.getFullYear(), customDate.getMonth(), 1);
                const monthEnd = new Date(customDate.getFullYear(), customDate.getMonth() + 1, 0);
                monthEnd.setHours(23, 59, 59, 999);
                return { start: monthStart, end: monthEnd };
            }
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: monthStart, end: now };
        case 'year':
            // UK tax year (April 6 - April 5)
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            let taxYearStart;
            if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
                taxYearStart = new Date(currentYear - 1, 3, 6); // April 6 of previous year
            } else {
                taxYearStart = new Date(currentYear, 3, 6); // April 6 of current year
            }
            return { start: taxYearStart, end: now };
        default:
            return { start: today, end: now };
    }
}

function formatDateRange(start, end) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    const startStr = start.toLocaleDateString('en-GB', options);
    const endStr = end.toLocaleDateString('en-GB', options);
    
    if (startStr === endStr) {
        return startStr;
    }
    return `${startStr} - ${endStr}`;
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
        this.selectedCustomDate = null;
        this.initializeApp();
    }

    getCurrentTaxYear() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        // UK tax year starts April 6
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            return currentYear - 1;
        }
        return currentYear;
    }

    initializeApp() {
        this.setupTabs();
        this.setupForms();
        this.setupDailyLog();
        this.setupPeriodButtons();
        this.setupTrendButtons();
        this.setupDataManagement();
        this.setupAutoCalculations();
        this.setupViewToggles();
        this.currentEditType = null;
        this.currentEditId = null;
        this.currentTrend = 'week';
        this.renderAll();
        this.setDefaultDates();
        this.initializeCharts();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const dailyLogDateEl = document.getElementById('dailyLogDate');
        
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
        // Mileage Form - REMOVED (use Daily Log instead)
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
                this.selectedCustomDate = null; // Reset custom date when changing period
                
                // Show/hide custom date range inputs
                const customRangeDiv = document.getElementById('customDateRange');
                if (customRangeDiv) {
                    customRangeDiv.style.display = (btn.dataset.period === 'custom') ? 'block' : 'none';
                }
                
                this.renderPeriodStats();
            });
        });

        // Setup dropdown filters
        const dayFilter = document.getElementById('dayFilter');
        const weekFilter = document.getElementById('weekFilter');
        const monthFilter = document.getElementById('monthFilter');

        if (dayFilter) {
            dayFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.selectedCustomDate = new Date(e.target.value);
                    this.renderPeriodStats();
                }
            });
        }

        if (weekFilter) {
            weekFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.selectedCustomDate = new Date(e.target.value);
                    this.renderPeriodStats();
                }
            });
        }

        if (monthFilter) {
            monthFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    this.selectedCustomDate = new Date(parseInt(year), parseInt(month), 1);
                    this.renderPeriodStats();
                }
            });
        }

        // Populate dropdowns
        this.populatePeriodFilters();
    }

    populatePeriodFilters() {
        const dayFilter = document.getElementById('dayFilter');
        const weekFilter = document.getElementById('weekFilter');
        const monthFilter = document.getElementById('monthFilter');

        if (!dayFilter || !weekFilter || !monthFilter) return;

        // Get all unique dates from data
        const allDates = new Set();
        [...this.store.data.income, ...this.store.data.expenses, ...this.store.data.mileage]
            .forEach(item => allDates.add(item.date));

        const sortedDates = Array.from(allDates).sort().reverse();

        // Populate day filter
        dayFilter.innerHTML = '<option value="">Select a day...</option>' + 
            sortedDates.map(date => {
                const d = new Date(date);
                const formatted = d.toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                });
                return `<option value="${date}">${formatted}</option>`;
            }).join('');

        // Populate week filter with unique weeks
        const weeksSet = new Set();
        sortedDates.forEach(date => {
            const d = new Date(date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
            const weekKey = weekStart.toISOString().split('T')[0];
            weeksSet.add(weekKey);
        });

        const sortedWeeks = Array.from(weeksSet).sort().reverse();

        weekFilter.innerHTML = '<option value="">Select a week...</option>' +
            sortedWeeks.map(weekKey => {
                const weekStart = new Date(weekKey);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                const formatted = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                return `<option value="${weekKey}">${formatted}</option>`;
            }).join('');

        // Populate month filter with unique months
        const monthsSet = new Set();
        sortedDates.forEach(date => {
            const d = new Date(date);
            const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
            monthsSet.add(monthKey);
        });

        const sortedMonths = Array.from(monthsSet).sort((a, b) => {
            const [yearA, monthA] = a.split('-').map(Number);
            const [yearB, monthB] = b.split('-').map(Number);
            return yearB - yearA || monthB - monthA;
        });

        monthFilter.innerHTML = '<option value="">Select a month...</option>' +
            sortedMonths.map(monthKey => {
                const [year, month] = monthKey.split('-').map(Number);
                const d = new Date(year, month, 1);
                const formatted = d.toLocaleDateString('en-GB', { 
                    month: 'long', 
                    year: 'numeric' 
                });
                return `<option value="${year}-${month}">${formatted}</option>`;
            }).join('');
    }

    setupTrendButtons() {
        const trendBtns = document.querySelectorAll('[data-trend]');
        trendBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                trendBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTrend = btn.dataset.trend;
                this.updateTrendChart();
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

        // Tax year selector
        const taxYearSelect = document.getElementById('taxYear');
        if (taxYearSelect) {
            taxYearSelect.addEventListener('change', (e) => {
                this.selectedTaxYear = parseInt(e.target.value);
                this.renderTaxCalculator();
            });
        }

        // PAYE save button
        const savePAYE = document.getElementById('savePAYE');
        if (savePAYE) {
            savePAYE.addEventListener('click', () => {
                const taxYear = parseInt(document.getElementById('payeTaxYear').value);
                const payeData = {
                    grossIncome: parseFloat(document.getElementById('payeGrossIncome').value) || 0,
                    taxPaid: parseFloat(document.getElementById('payeTaxPaid').value) || 0,
                    niPaid: parseFloat(document.getElementById('payeNIPaid').value) || 0
                };
                this.store.savePAYE(taxYear, payeData);
                showToast('PAYE details saved for ' + taxYear + '/' + (taxYear + 1).toString().slice(-2) + '!', 'success');
                this.renderTaxCalculator();
                this.renderDashboard();
            });
        }

        // PAYE tax year selector - load PAYE data when year changes
        const payeTaxYearSelect = document.getElementById('payeTaxYear');
        if (payeTaxYearSelect) {
            payeTaxYearSelect.addEventListener('change', () => {
                const selectedYear = parseInt(payeTaxYearSelect.value);
                const payeData = this.store.getPAYEForYear(selectedYear);
                document.getElementById('payeGrossIncome').value = payeData.grossIncome || '';
                document.getElementById('payeTaxPaid').value = payeData.taxPaid || '';
                document.getElementById('payeNIPaid').value = payeData.niPaid || '';
            });
        }

        // Load PAYE data into form for current tax year
        const currentTaxYear = this.getCurrentTaxYear();
        if (payeTaxYearSelect) {
            payeTaxYearSelect.value = currentTaxYear;
        }
        const payeData = this.store.getPAYEForYear(currentTaxYear);
        if (document.getElementById('payeGrossIncome')) {
            document.getElementById('payeGrossIncome').value = payeData.grossIncome || '';
            document.getElementById('payeTaxPaid').value = payeData.taxPaid || '';
            document.getElementById('payeNIPaid').value = payeData.niPaid || '';
        }

        // Custom date range
        const applyCustomRange = document.getElementById('applyCustomRange');
        if (applyCustomRange) {
            applyCustomRange.addEventListener('click', () => {
                const startDate = document.getElementById('customStartDate').value;
                const endDate = document.getElementById('customEndDate').value;
                if (startDate && endDate) {
                    this.customStartDate = startDate;
                    this.customEndDate = endDate;
                    this.renderPeriodStats();
                } else {
                    showToast('Please select both start and end dates', 'error');
                }
            });
        }

        // Daily overview toggle
        const toggleBtn = document.getElementById('toggleDailyOverview');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const table = document.getElementById('dailyOverviewTable');
                const card = document.getElementById('dailyOverviewTableCard');
                if (table.style.display === 'none') {
                    table.style.display = 'block';
                    toggleBtn.textContent = 'Hide This View';
                    card.querySelector('p').style.display = 'block';
                } else {
                    table.style.display = 'none';
                    toggleBtn.textContent = 'Show This View';
                    card.querySelector('p').style.display = 'none';
                }
            });
        }
    }

    setupAutoCalculations() {
        // Auto-calculations removed - all entry done via Daily Log
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
        this.updateTrendChart();
    }

    updateTrendChart() {
        if (!this.charts.weekly) return;

        const labels = [];
        const profits = [];
        
        // Find earliest entry date
        const allDates = [
            ...this.store.data.income.map(i => i.date),
            ...this.store.data.expenses.map(e => e.date),
            ...this.store.data.mileage.map(m => m.date)
        ];
        
        if (allDates.length === 0) {
            this.charts.weekly.data.labels = [];
            this.charts.weekly.data.datasets[0].data = [];
            this.charts.weekly.update();
            return;
        }
        
        const earliestDate = new Date(Math.min(...allDates.map(d => new Date(d).getTime())));
        const now = new Date();
        
        if (this.currentTrend === 'week') {
            // Show all weeks from earliest to now
            const currentDate = new Date(earliestDate);
            currentDate.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week
            
            while (currentDate <= now) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 6);
                
                const weekIncome = this.store.data.income
                    .filter(item => {
                        const d = new Date(item.date);
                        return d >= weekStart && d <= weekEnd;
                    })
                    .reduce((sum, item) => sum + item.amount, 0);
                
                const weekExpenses = this.store.data.expenses
                    .filter(item => {
                        const d = new Date(item.date);
                        return d >= weekStart && d <= weekEnd;
                    })
                    .reduce((sum, item) => sum + item.amount, 0);
                
                labels.push(weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
                profits.push(weekIncome - weekExpenses);
                
                currentDate.setDate(currentDate.getDate() + 7);
            }
        } else if (this.currentTrend === 'month') {
            // Show all months from earliest to now
            const currentDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
            
            while (currentDate <= now) {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                
                const monthIncome = this.store.data.income
                    .filter(item => {
                        const itemDate = new Date(item.date);
                        return itemDate.getFullYear() === year && itemDate.getMonth() === month;
                    })
                    .reduce((sum, item) => sum + item.amount, 0);
                
                const monthExpenses = this.store.data.expenses
                    .filter(item => {
                        const itemDate = new Date(item.date);
                        return itemDate.getFullYear() === year && itemDate.getMonth() === month;
                    })
                    .reduce((sum, item) => sum + item.amount, 0);
                
                labels.push(currentDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
                profits.push(monthIncome - monthExpenses);
                
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        } else if (this.currentTrend === 'year') {
            // Show all years from earliest to now - UK tax year aggregates
            const startYear = earliestDate.getFullYear();
            const endYear = now.getFullYear();
            
            for (let year = startYear; year <= endYear; year++) {
                // UK tax year: April 6th to April 5th
                const taxYearStart = new Date(year, 3, 6); // April 6
                const taxYearEnd = new Date(year + 1, 3, 5); // April 5 next year
                
                const yearIncome = this.store.data.income
                    .filter(item => {
                        const itemDate = new Date(item.date);
                        return itemDate >= taxYearStart && itemDate <= taxYearEnd;
                    })
                    .reduce((sum, item) => sum + item.amount, 0);
                
                const yearExpenses = this.store.data.expenses
                    .filter(item => {
                        const itemDate = new Date(item.date);
                        return itemDate >= taxYearStart && itemDate <= taxYearEnd;
                    })
                    .reduce((sum, item) => sum + item.amount, 0);
                
                labels.push(`${year}/${String(year + 1).slice(-2)}`);
                profits.push(yearIncome - yearExpenses);
            }
        }

        this.charts.weekly.data.labels = labels;
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
        
        // Calculate YTD (Year-to-Date) metrics for header
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
        
        const ytdIncome = filterByDateRange(this.store.data.income, taxYearStart, now)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const ytdExpenses = filterByDateRange(this.store.data.expenses, taxYearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const ytdFuelCost = filterByDateRange(this.store.data.expenses.filter(e => e.category === 'fuel'), taxYearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const ytdMiles = filterByDateRange(this.store.data.mileage, taxYearStart, now)
            .reduce((sum, m) => sum + m.miles, 0);
        
        // Calculate mileage allowance
        let mileageAllowance = 0;
        if (ytdMiles <= 10000) {
            mileageAllowance = ytdMiles * 0.45;
        } else {
            mileageAllowance = (10000 * 0.45) + ((ytdMiles - 10000) * 0.25);
        }
        
        // Choose better option: actual fuel OR mileage allowance (not both!)
        let totalDeductions = ytdExpenses;
        let mileageDeduction = 0;
        
        if (mileageAllowance > ytdFuelCost) {
            // Use mileage allowance, exclude fuel from expenses
            totalDeductions = ytdExpenses - ytdFuelCost;
            mileageDeduction = mileageAllowance;
        } else {
            // Use actual fuel, no mileage allowance
            totalDeductions = ytdExpenses;
            mileageDeduction = 0;
        }
        
        const adjustedProfit = ytdIncome - totalDeductions - mileageDeduction;
        
        // Add PAYE income to calculations - only for current tax year
        const currentTaxYear = this.getCurrentTaxYear();
        const payeData = this.store.getPAYEForYear(currentTaxYear);
        const totalYTDGross = ytdIncome + payeData.grossIncome;
        const combinedIncome = adjustedProfit + payeData.grossIncome;
        const totalYTDNet = totalYTDGross - totalDeductions - mileageDeduction;
        
        // Calculate tax - pass ONLY self-employment profit (function adds PAYE internally)
        const taxDue = this.calculateCombinedTax(adjustedProfit, payeData);
        
        // Update header stats
        const ytdGrossEl = document.getElementById('ytdGross');
        const ytdNetEl = document.getElementById('ytdNet');
        const taxDueEl = document.getElementById('taxDue');
        
        if (ytdGrossEl) ytdGrossEl.textContent = formatCurrency(totalYTDGross);
        if (ytdNetEl) ytdNetEl.textContent = formatCurrency(totalYTDNet);
        if (taxDueEl) {
            if (taxDue < 0) {
                taxDueEl.textContent = `${formatCurrency(Math.abs(taxDue))} REBATE`;
                taxDueEl.style.color = '#10B981';
            } else {
                taxDueEl.textContent = formatCurrency(taxDue);
                taxDueEl.style.color = '';
            }
        }
        
        // Weekly tax saving target (52 weeks) - use absolute value for saving/rebate
        const weeklyTaxSave = Math.round(Math.abs(taxDue) / 52);
        const weeklyEl = document.getElementById('weeklyTaxSave');
        if (weeklyEl) {
            weeklyEl.textContent = weeklyTaxSave;
        }

        // Personal allowance progress - use combined income
        const settings = this.store.data.settings;
        const allowanceUsed = Math.min(combinedIncome, settings.personalAllowance);
        const allowancePercent = Math.min(100, (combinedIncome / settings.personalAllowance) * 100);
        
        const percentEl = document.getElementById('allowancePercent');
        const progressEl = document.getElementById('allowanceProgress');
        
        if (percentEl && progressEl) {
            percentEl.textContent = `${Math.round(allowancePercent)}%`;
            progressEl.style.width = `${allowancePercent}%`;
        }
    }

    renderPeriodStats() {
        let range;
        if (this.currentPeriod === 'custom' && this.customStartDate && this.customEndDate) {
            range = getDateRange('custom', this.customStartDate, this.customEndDate);
        } else {
            range = getDateRange(this.currentPeriod, this.selectedCustomDate);
        }
        
        const periodIncome = filterByDateRange(this.store.data.income, range.start, range.end);
        const periodExpenses = filterByDateRange(this.store.data.expenses, range.start, range.end);
        const periodMileage = filterByDateRange(this.store.data.mileage, range.start, range.end);

        const totalIncome = periodIncome.reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalFuelCost = periodExpenses.filter(e => e.category === 'fuel').reduce((sum, e) => sum + e.amount, 0);
        const totalMiles = periodMileage.reduce((sum, m) => sum + m.miles, 0);
        
        // Calculate mileage allowance for the period
        let mileageAllowance = 0;
        if (totalMiles <= 10000) {
            mileageAllowance = totalMiles * 0.45;
        } else {
            mileageAllowance = (10000 * 0.45) + ((totalMiles - 10000) * 0.25);
        }
        
        // Choose better option: actual fuel OR mileage allowance
        let deductions = totalExpenses;
        if (mileageAllowance > totalFuelCost) {
            deductions = totalExpenses - totalFuelCost + mileageAllowance;
        }
        
        const netProfit = totalIncome - deductions;
        
        // Get PAYE data for current tax year (only if viewing year period)
        const currentTaxYear = this.getCurrentTaxYear();
        const payeData = this.store.getPAYEForYear(currentTaxYear);
        
        // Only include PAYE in year calculation
        let taxLiability;
        if (this.currentPeriod === 'year') {
            // Pass self-employment profit only (function adds PAYE internally)
            taxLiability = this.calculateCombinedTax(netProfit, payeData);
        } else {
            // For other periods, don't include PAYE (just estimate based on period profit)
            taxLiability = this.calculateCombinedTax(netProfit, { grossIncome: 0, taxPaid: 0, niPaid: 0 });
        }

        document.getElementById('periodIncome').textContent = formatCurrency(totalIncome);
        document.getElementById('periodExpenses').textContent = formatCurrency(deductions);
        document.getElementById('periodNet').textContent = formatCurrency(netProfit);
        
        const periodTaxEl = document.getElementById('periodTax');
        if (periodTaxEl) {
            if (taxLiability < 0) {
                periodTaxEl.textContent = `${formatCurrency(Math.abs(taxLiability))} REBATE`;
                periodTaxEl.style.color = '#10B981';
            } else {
                periodTaxEl.textContent = formatCurrency(taxLiability);
                periodTaxEl.style.color = '';
            }
        }

        // Update date range display
        const dateRangeEl = document.getElementById('periodDateRange');
        if (dateRangeEl) {
            dateRangeEl.textContent = formatDateRange(range.start, range.end);
        }

        // Show/hide appropriate filters
        const periodFilters = document.getElementById('periodFilters');
        const dayFilter = document.getElementById('dayFilter');
        const weekFilter = document.getElementById('weekFilter');
        const monthFilter = document.getElementById('monthFilter');

        if (periodFilters && dayFilter && weekFilter && monthFilter) {
            if (this.currentPeriod === 'day') {
                periodFilters.style.display = 'block';
                dayFilter.style.display = 'inline-block';
                weekFilter.style.display = 'none';
                monthFilter.style.display = 'none';
            } else if (this.currentPeriod === 'week') {
                periodFilters.style.display = 'block';
                dayFilter.style.display = 'none';
                weekFilter.style.display = 'inline-block';
                monthFilter.style.display = 'none';
            } else if (this.currentPeriod === 'month') {
                periodFilters.style.display = 'block';
                dayFilter.style.display = 'none';
                weekFilter.style.display = 'none';
                monthFilter.style.display = 'inline-block';
            } else {
                periodFilters.style.display = 'none';
            }
        }
    }

    renderMileage() {
        // Mileage allowance calculation - UK tax year (April 6 - April 5)
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
        
        const mileageAllowance = this.calculateMileageAllowance();
        
        const yearFuelCost = filterByDateRange(this.store.data.expenses.filter(e => e.category === 'fuel'), taxYearStart, now)
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
        if (!list) return;
        
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
        // Calculate total expenses for the tax year
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6);
        } else {
            taxYearStart = new Date(currentYear, 3, 6);
        }
        
        const yearExpenses = filterByDateRange(this.store.data.expenses, taxYearStart, now)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const totalExpensesEl = document.getElementById('totalExpenses');
        if (totalExpensesEl) totalExpensesEl.textContent = formatCurrency(yearExpenses);
        
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
        if (!breakdownList) return;
        
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
        if (!list) return;
        
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

        // Income breakdown by source (description)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        let taxYearStart;
        if (currentMonth < 3 || (currentMonth === 3 && now.getDate() < 6)) {
            taxYearStart = new Date(currentYear - 1, 3, 6);
        } else {
            taxYearStart = new Date(currentYear, 3, 6);
        }
        
        const yearIncomeEntries = filterByDateRange(this.store.data.income, taxYearStart, now);
        const sourceBreakdown = {};
        yearIncomeEntries.forEach(income => {
            const source = income.description || 'Other';
            sourceBreakdown[source] = (sourceBreakdown[source] || 0) + income.amount;
        });

        const breakdownList = document.getElementById('incomeBreakdown');
        if (breakdownList) {
            if (Object.keys(sourceBreakdown).length === 0) {
                breakdownList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div><p>No income yet</p></div>';
            } else {
                breakdownList.innerHTML = Object.entries(sourceBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, amount]) => `
                        <div class="breakdown-item">
                            <span class="breakdown-category">💼 ${source}</span>
                            <span class="breakdown-amount">${formatCurrency(amount)}</span>
                        </div>
                    `).join('');
            }
        }

        // Render list
        const list = document.getElementById('incomeList');
        if (!list) return;
        
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

    calculateCombinedTax(selfEmploymentProfit, payeData) {
        const personalAllowance = 12570;
        const basicRateLimit = 50270;
        const higherRateLimit = 125140;
        const niLowerLimit = 12570;
        const niUpperLimit = 50270;
        const smallProfitsThreshold = 6725;
        
        // Combined income for tax calculation
        const combinedIncome = selfEmploymentProfit + payeData.grossIncome;
        
        // Income Tax - Progressive bands on combined income
        let totalIncomeTax = 0;
        const totalTaxableIncome = Math.max(0, combinedIncome - personalAllowance);
        
        if (totalTaxableIncome > 0) {
            // Basic rate band (20%)
            const basicRateTaxable = Math.min(totalTaxableIncome, basicRateLimit - personalAllowance);
            totalIncomeTax += basicRateTaxable * 0.20;
            
            // Higher rate band (40%)
            if (totalTaxableIncome > basicRateLimit - personalAllowance) {
                const higherRateTaxable = Math.min(
                    totalTaxableIncome - (basicRateLimit - personalAllowance),
                    higherRateLimit - basicRateLimit
                );
                totalIncomeTax += higherRateTaxable * 0.40;
            }
            
            // Additional rate band (45%)
            if (totalTaxableIncome > higherRateLimit - personalAllowance) {
                const additionalRateTaxable = totalTaxableIncome - (higherRateLimit - personalAllowance);
                totalIncomeTax += additionalRateTaxable * 0.45;
            }
        }
        
        // Calculate income tax (can be negative for rebate)
        const incomeTax = totalIncomeTax - payeData.taxPaid;
        
        // NI Class 2 - £0 if profit above threshold (automatic state pension qualification)
        let niClass2 = 0;
        // Class 2 is only for profits BELOW £6,725 and is optional
        // Above £6,725: automatic state pension qualification, no charge
        
        // NI Class 4 - only on self-employment profit
        let niClass4 = 0;
        if (selfEmploymentProfit > niLowerLimit) {
            const lowerBandProfit = Math.min(selfEmploymentProfit - niLowerLimit, niUpperLimit - niLowerLimit);
            niClass4 += lowerBandProfit * 0.09;
            
            if (selfEmploymentProfit > niUpperLimit) {
                const upperBandProfit = selfEmploymentProfit - niUpperLimit;
                niClass4 += upperBandProfit * 0.02;
            }
        }
        
        // Calculate NI due (can be negative for rebate)
        const totalNI = niClass2 + niClass4;
        const niDue = totalNI - payeData.niPaid;
        
        // Return total (can be negative if rebate due)
        return incomeTax + niDue;
    }

    renderTaxCalculator() {
        // Check if a tax year has been selected
        if (!this.selectedTaxYear) {
            // Show prompt to select a year
            const elements = [
                'taxGrossIncome', 'taxExpenses', 'taxableProfit', 'personalAllowance',
                'incomeTax', 'niClass2', 'niClass4', 'totalTaxDue', 'dailyTax', 'weeklyTax',
                'monthlyTax', 'annualIncome', 'annualExpenses', 'annualProfit', 'annualMiles'
            ];
            
            elements.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (id === 'annualMiles') {
                        el.textContent = '-';
                    } else if (id === 'personalAllowance') {
                        el.textContent = '£12,570';
                    } else {
                        el.textContent = '-';
                    }
                }
            });
            return;
        }
        
        const settings = this.store.data.settings;
        
        // Get selected tax year
        const selectedYear = this.selectedTaxYear;
        const taxYearStart = new Date(selectedYear, 3, 6); // April 6
        const taxYearEnd = new Date(selectedYear + 1, 3, 5); // April 5 next year
        
        const yearIncome = filterByDateRange(this.store.data.income, taxYearStart, taxYearEnd)
            .reduce((sum, i) => sum + i.amount, 0);
        
        const yearExpenses = filterByDateRange(this.store.data.expenses, taxYearStart, taxYearEnd)
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Get PAYE data for the selected tax year
        const payeData = this.store.getPAYEForYear(selectedYear);
        
        const yearFuelCost = filterByDateRange(this.store.data.expenses.filter(e => e.category === 'fuel'), taxYearStart, taxYearEnd)
            .reduce((sum, e) => sum + e.amount, 0);
        
        const yearMiles = filterByDateRange(this.store.data.mileage, taxYearStart, taxYearEnd)
            .reduce((sum, m) => sum + m.miles, 0);
        
        // Calculate mileage allowance for selected year
        let yearMileageAllowance = 0;
        if (yearMiles <= 10000) {
            yearMileageAllowance = yearMiles * 0.45;
        } else {
            yearMileageAllowance = (10000 * 0.45) + ((yearMiles - 10000) * 0.25);
        }
        
        // Choose the better option: actual fuel OR mileage allowance (not both!)
        let totalDeductions = yearExpenses; // Start with all expenses
        let mileageDeduction = 0;
        let usingMileageAllowance = false;
        
        if (yearMileageAllowance > yearFuelCost) {
            // Mileage allowance is better - use it and exclude fuel from expenses
            totalDeductions = yearExpenses - yearFuelCost; // Remove fuel from expenses
            mileageDeduction = yearMileageAllowance; // Add mileage allowance instead
            usingMileageAllowance = true;
        } else {
            // Actual fuel is better - use actual expenses including fuel, no mileage allowance
            totalDeductions = yearExpenses; // Keep all expenses including fuel
            mileageDeduction = 0;
            usingMileageAllowance = false;
        }
        
        const yearAdjustedProfit = yearIncome - totalDeductions - mileageDeduction;
        
        // Calculate combined income (self-employment profit + PAYE income)
        const combinedIncome = yearAdjustedProfit + payeData.grossIncome;
        
        // Income Tax - Progressive tax bands on COMBINED income
        // Personal Allowance: £12,570
        // Basic rate (20%): £12,571 - £50,270
        // Higher rate (40%): £50,271 - £125,140
        // Additional rate (45%): £125,141+
        
        const personalAllowance = settings.personalAllowance; // £12,570
        const basicRateLimit = 50270;
        const higherRateLimit = 125140;
        
        let totalIncomeTax = 0;
        const totalTaxableIncome = Math.max(0, combinedIncome - personalAllowance);
        
        if (totalTaxableIncome > 0) {
            // Basic rate band (20%)
            const basicRateTaxable = Math.min(totalTaxableIncome, basicRateLimit - personalAllowance);
            totalIncomeTax += basicRateTaxable * 0.20;
            
            // Higher rate band (40%)
            if (totalTaxableIncome > basicRateLimit - personalAllowance) {
                const higherRateTaxable = Math.min(
                    totalTaxableIncome - (basicRateLimit - personalAllowance),
                    higherRateLimit - basicRateLimit
                );
                totalIncomeTax += higherRateTaxable * 0.40;
            }
            
            // Additional rate band (45%)
            if (totalTaxableIncome > higherRateLimit - personalAllowance) {
                const additionalRateTaxable = totalTaxableIncome - (higherRateLimit - personalAllowance);
                totalIncomeTax += additionalRateTaxable * 0.45;
            }
        }
        
        // Calculate tax due on self-employment only (subtract PAYE tax already paid)
        // This can be negative if PAYE overpaid (rebate scenario)
        const incomeTax = totalIncomeTax - payeData.taxPaid;
        
        // Class 2 NI - Only for profits BELOW £6,725 (optional, to qualify for state pension)
        // Above £6,725: Automatically qualify for state pension, NO Class 2 NI charged
        const smallProfitsThreshold = 6725;
        let niClass2 = 0;
        // Class 2 is now £0 if above threshold (automatic state pension qualification)
        // User can voluntarily pay £3.45/week if below threshold, but we don't calculate that here
        
        // Class 4 NI - 9% on profits £12,570-£50,270, then 2% above £50,270
        const niLowerLimit = 12570;
        const niUpperLimit = 50270;
        
        let niClass4 = 0;
        if (yearAdjustedProfit > niLowerLimit) {
            // 9% on profits between £12,570 and £50,270
            const lowerBandProfit = Math.min(yearAdjustedProfit - niLowerLimit, niUpperLimit - niLowerLimit);
            niClass4 += lowerBandProfit * 0.09;
            
            // 2% on profits above £50,270
            if (yearAdjustedProfit > niUpperLimit) {
                const upperBandProfit = yearAdjustedProfit - niUpperLimit;
                niClass4 += upperBandProfit * 0.02;
            }
        }
        
        const totalNI = niClass2 + niClass4;
        
        // Add PAYE NI already paid to get total NI, then subtract to get remaining
        const totalNILiability = totalNI; // Self-employment NI only (PAYE NI is separate)
        const niStillToPay = totalNILiability - payeData.niPaid; // Can be negative for rebate
        
        const totalTax = incomeTax + niStillToPay; // Can be negative (rebate)
        
        // Show rebate message if applicable
        const isRebate = (totalIncomeTax < payeData.taxPaid) || (totalNILiability < payeData.niPaid);

        document.getElementById('taxGrossIncome').textContent = formatCurrency(yearIncome);
        
        // Show expense breakdown: actual expenses OR (expenses - fuel + mileage allowance)
        const expensesEl = document.getElementById('taxExpenses');
        const expenseNoteEl = document.getElementById('expenseBreakdownNote');
        
        if (usingMileageAllowance) {
            // Using HMRC mileage allowance (fuel excluded from expenses)
            const expensesWithoutFuel = yearExpenses - yearFuelCost;
            expensesEl.textContent = formatCurrency(totalDeductions + mileageDeduction);
            if (expenseNoteEl) {
                expenseNoteEl.textContent = `(Expenses excl. fuel: ${formatCurrency(expensesWithoutFuel)} + HMRC Mileage: ${formatCurrency(mileageDeduction)})`;
            }
        } else {
            // Using actual fuel costs (no mileage allowance)
            expensesEl.textContent = formatCurrency(totalDeductions);
            if (expenseNoteEl) {
                expenseNoteEl.textContent = `(All expenses including fuel: ${formatCurrency(yearFuelCost)} - better than mileage allowance: ${formatCurrency(yearMileageAllowance)})`;
            }
        }
        
        document.getElementById('taxableProfit').textContent = formatCurrency(yearAdjustedProfit);
        document.getElementById('personalAllowance').textContent = formatCurrency(settings.personalAllowance);
        
        // Show PAYE breakdown if applicable
        const payeBreakdown = document.getElementById('payeBreakdown');
        if (payeData.grossIncome > 0 && payeBreakdown) {
            payeBreakdown.style.display = 'block';
            document.getElementById('selfEmploymentDisplay').textContent = formatCurrency(yearAdjustedProfit);
            document.getElementById('payeIncomeDisplay').textContent = formatCurrency(payeData.grossIncome);
            document.getElementById('combinedIncomeDisplay').textContent = formatCurrency(combinedIncome);
            document.getElementById('personalAllowanceInCalc').textContent = formatCurrency(settings.personalAllowance);
            
            // Calculate and show the taxable amount (after personal allowance)
            const taxableAfterAllowance = Math.max(0, combinedIncome - settings.personalAllowance);
            const taxableAmountEl = document.getElementById('taxableAmount');
            if (taxableAmountEl) {
                taxableAmountEl.textContent = formatCurrency(taxableAfterAllowance);
            }
            
            // Show the calculated tax on this amount
            const calculatedIncomeTaxEl = document.getElementById('calculatedIncomeTax');
            if (calculatedIncomeTaxEl) {
                calculatedIncomeTaxEl.textContent = formatCurrency(totalIncomeTax);
            }
            
            document.getElementById('payeTaxPaidDisplay').textContent = formatCurrency(payeData.taxPaid);
            document.getElementById('payeNIPaidDisplay').textContent = formatCurrency(payeData.niPaid);
        } else if (payeBreakdown) {
            payeBreakdown.style.display = 'none';
        }
        
        // Show combined tax calculation with PAYE info if applicable
        if (payeData.grossIncome > 0) {
            const incomeTaxNote = incomeTax < 0 ? `${formatCurrency(Math.abs(incomeTax))} REBATE` : formatCurrency(incomeTax);
            document.getElementById('incomeTax').textContent = incomeTaxNote;
            document.getElementById('incomeTax').style.color = incomeTax < 0 ? '#10B981' : '';
        } else {
            document.getElementById('incomeTax').textContent = formatCurrency(incomeTax);
        }
        
        document.getElementById('niClass2').textContent = formatCurrency(niClass2);
        document.getElementById('niClass4').textContent = formatCurrency(niClass4);
        
        // Show total tax due or rebate
        const totalTaxEl = document.getElementById('totalTaxDue');
        if (totalTax < 0) {
            totalTaxEl.textContent = `${formatCurrency(Math.abs(totalTax))} REBATE`;
            totalTaxEl.style.color = '#10B981';
            totalTaxEl.style.fontWeight = '600';
        } else {
            totalTaxEl.textContent = formatCurrency(totalTax);
            totalTaxEl.style.color = '';
            totalTaxEl.style.fontWeight = '';
        }

        // Time-based estimates (use absolute value for saving targets)
        const daysInYear = 365;
        const weeksInYear = 52;
        const monthsInYear = 12;

        document.getElementById('dailyTax').textContent = formatCurrency(totalTax / daysInYear);
        document.getElementById('weeklyTax').textContent = formatCurrency(totalTax / weeksInYear);
        document.getElementById('monthlyTax').textContent = formatCurrency(totalTax / monthsInYear);

        // Annual summary - show combined PAYE + self-employed income
        document.getElementById('annualIncome').textContent = formatCurrency(yearIncome + payeData.grossIncome);
        document.getElementById('annualExpenses').textContent = formatCurrency(yearExpenses);
        document.getElementById('annualProfit').textContent = formatCurrency(yearAdjustedProfit);
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

                const miles = Math.max(0, end - start);
                const milesEl = document.getElementById('dailyMilesCalc');
                if (milesEl) milesEl.textContent = miles.toFixed(1);

                const mpgEl = document.getElementById('dailyMPGCalc');
                if (mpgEl) {
                    if (fuel > 0 && miles > 0) {
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

            dailyMileageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = document.getElementById('dailyLogDate').value;
                const start = parseFloat(startInput.value);
                const end = parseFloat(endInput.value);
                const fuel = parseFloat(fuelInput.value) || 0;

                if (end <= start) {
                    showToast('End odometer must be greater than start', 'error');
                    return;
                }

                const miles = end - start;
                const mpg = (fuel > 0 && miles > 0) ? (miles * 4.54609) / fuel : 0;

                this.store.addMileage({ start, end, fuel, miles, mpg, date, fullTank: false });
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

        // Render Daily Overview Table
        this.renderDailyOverviewTable();
    }

    renderDailyOverviewTable() {
        const tableContainer = document.getElementById('dailyOverviewTable');
        if (!tableContainer) return;

        // Get all unique dates
        const allDates = new Set();
        [...this.store.data.income, ...this.store.data.expenses, ...this.store.data.mileage]
            .forEach(item => allDates.add(item.date));

        if (allDates.size === 0) {
            tableContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>No data to display yet</p></div>';
            return;
        }

        const sortedDates = Array.from(allDates).sort().reverse();

        // Build table rows
        const rows = sortedDates.map(date => {
            const dayIncome = this.store.data.income.filter(i => i.date === date);
            const dayExpenses = this.store.data.expenses.filter(e => e.date === date);
            const dayMileage = this.store.data.mileage.filter(m => m.date === date);

            const totalIncome = dayIncome.reduce((sum, i) => sum + i.amount, 0);
            const fuelCost = dayExpenses.filter(e => e.category === 'fuel').reduce((sum, e) => sum + e.amount, 0);
            const mealCost = dayExpenses.filter(e => e.category === 'food').reduce((sum, e) => sum + e.amount, 0);
            const otherExpenses = dayExpenses.filter(e => e.category !== 'fuel' && e.category !== 'food').reduce((sum, e) => sum + e.amount, 0);
            const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
            const netProfit = totalIncome - totalExpenses;
            const totalMiles = dayMileage.reduce((sum, m) => sum + m.miles, 0);

            // Get notes from expense descriptions
            const notes = dayExpenses
                .filter(e => e.description && e.description.trim())
                .map(e => e.description)
                .join(', ');

            const formattedDate = new Date(date).toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            });

            return `
                <tr>
                    <td>${formattedDate}</td>
                    <td class="text-right">${formatCurrency(totalIncome)}</td>
                    <td class="text-right">${fuelCost > 0 ? formatCurrency(fuelCost) : '-'}</td>
                    <td class="text-right">${mealCost > 0 ? formatCurrency(mealCost) : '-'}</td>
                    <td class="text-right">${otherExpenses > 0 ? formatCurrency(otherExpenses) : '-'}</td>
                    <td class="text-right">${formatCurrency(totalExpenses)}</td>
                    <td class="text-right ${netProfit >= 0 ? 'income' : 'expense'}" style="font-weight: 600;">${formatCurrency(netProfit)}</td>
                    <td class="text-right">${totalMiles > 0 ? Math.round(totalMiles) : '-'}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${notes}">${notes || '-'}</td>
                </tr>
            `;
        }).join('');

        tableContainer.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th class="text-right">Income</th>
                        <th class="text-right">Fuel</th>
                        <th class="text-right">Meals</th>
                        <th class="text-right">Other</th>
                        <th class="text-right">Total Exp.</th>
                        <th class="text-right">Net Profit</th>
                        <th class="text-right">Miles</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
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



