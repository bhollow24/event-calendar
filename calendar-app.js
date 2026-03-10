// Calendar Application Logic

let currentYear = 2026;
let currentQuarter = 'Q1';
let currentRegion = 'all';
let selectedEvent = null;

function getQuarterMonths(quarter) {
    const quarters = {
        'Q1': [0, 1, 2],
        'Q2': [3, 4, 5],
        'Q3': [6, 7, 8],
        'Q4': [9, 10, 11]
    };
    return quarters[quarter];
}

function getSizeClass(attendance) {
    if (attendance < 5000) return 'small';
    if (attendance <= 15000) return 'medium';
    return 'large';
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isDateInRange(date, startDate, endDate) {
    const d = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return d >= start && d <= end;
}

function getConflicts(dateStr) {
    return events.filter(e => 
        (currentRegion === 'all' || e.region === currentRegion) &&
        isDateInRange(dateStr, e.startDate, e.endDate)
    );
}

function switchYear(year) {
    currentYear = year;
    document.querySelectorAll('.controls .control-group:first-child .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    renderCalendar();
}

function switchQuarter(quarter) {
    currentQuarter = quarter;
    document.querySelectorAll('.controls .control-group:nth-child(2) .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    renderCalendar();
}

function filterRegion(region) {
    currentRegion = region;
    document.querySelectorAll('.controls .control-group:nth-child(3) .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    renderCalendar();
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '';

    const months = getQuarterMonths(currentQuarter);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

    months.forEach(monthIndex => {
        const monthSection = document.createElement('div');
        monthSection.className = 'month-section';

        const header = document.createElement('div');
        header.className = 'month-header';
        header.textContent = `${monthNames[monthIndex]} ${currentYear}`;
        monthSection.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });

        const daysInMonth = getDaysInMonth(currentYear, monthIndex);
        const firstDay = getFirstDayOfMonth(currentYear, monthIndex);

        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell other-month';
            grid.appendChild(cell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';

            const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            const conflicts = getConflicts(dateStr);
            if (conflicts.length >= 3) {
                cell.classList.add('conflict');
            }

            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            cell.appendChild(dayNumber);

            events.forEach(event => {
                if (currentRegion !== 'all' && event.region !== currentRegion) return;
                
                if (isDateInRange(dateStr, event.startDate, event.endDate)) {
                    const eventEl = document.createElement('div');
                    eventEl.className = `event ${getSizeClass(event.attendance)} ${event.category}`;
                    
                    if (event.estimated) {
                        eventEl.classList.add('estimated');
                    }
                    
                    if (event.tier === 1) {
                        eventEl.classList.add('tier-1-event');
                    }
                    
                    const tierBadge = document.createElement('span');
                    tierBadge.className = `tier-badge tier-${event.tier}`;
                    
                    eventEl.appendChild(tierBadge);
                    eventEl.appendChild(document.createTextNode(event.name));
                    
                    eventEl.onclick = () => showEventDetails(event);
                    cell.appendChild(eventEl);
                }
            });

            grid.appendChild(cell);
        }

        monthSection.appendChild(grid);
        container.appendChild(monthSection);
    });
}

function showEventDetails(event) {
    selectedEvent = event;
    const modal = document.getElementById('eventModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = event.name;
    
    const start = formatDate(event.startDate);
    const end = formatDate(event.endDate);
    const dateRange = start === end ? start : `${start} - ${end}`;

    const tierLabels = {
        1: 'Tier 1: Flagship/Must-Attend',
        2: 'Tier 2: Regional/Niche'
    };

    const categoryLabels = {
        'crypto': 'Digital Asset',
        'institutional': 'Institutional',
        'crossover': 'Crossover'
    };

    let conflictNote = '';
    const conflicts = getConflicts(event.startDate).filter(e => e.id !== event.id);
    if (conflicts.length > 0) {
        conflictNote = `<div class="conflict-badge">⚠️ Conflict: ${conflicts.length} other event(s) same week</div>`;
    }

    body.innerHTML = `
        <p><strong>📅 Date:</strong> ${dateRange}${event.estimated ? ' <em>(~estimated)</em>' : ''}</p>
        <p><strong>📍 Location:</strong> ${event.location}</p>
        <p><strong>🌍 Region:</strong> ${event.region}</p>
        <p><strong>👥 Expected Attendance:</strong> ${event.attendance.toLocaleString()}</p>
        <p><strong>🏷️ Category:</strong> ${categoryLabels[event.category]}</p>
        <p><strong>🎯 Tier:</strong> ${tierLabels[event.tier]}</p>
        <p><strong>👤 Audience:</strong> ${event.audience.join(', ')}</p>
        ${event.digitalAssetRelevance ? `<p><strong>💎 Digital Asset Relevance:</strong> ${event.digitalAssetRelevance}</p>` : ''}
        <p><strong>📝 Notes:</strong> ${event.notes}</p>
        <p><strong>🔗 Website:</strong> <a href="${event.url}" target="_blank" style="color: var(--accent-green);">${event.url}</a></p>
        ${conflictNote}
    `;

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('eventModal').classList.remove('active');
    selectedEvent = null;
}

function visitEvent() {
    if (selectedEvent && selectedEvent.url) {
        window.open(selectedEvent.url, '_blank');
    }
}

function editEvent() {
    if (!selectedEvent) return;
    
    closeModal();
    
    document.getElementById('manualName').value = selectedEvent.name;
    document.getElementById('manualStartDate').value = selectedEvent.startDate;
    document.getElementById('manualEndDate').value = selectedEvent.endDate;
    document.getElementById('manualLocation').value = selectedEvent.location;
    document.getElementById('manualRegion').value = selectedEvent.region;
    document.getElementById('manualAttendance').value = selectedEvent.attendance;
    document.getElementById('manualType').value = selectedEvent.category;
    document.getElementById('manualTier').value = selectedEvent.tier;
    document.getElementById('manualEstimated').value = selectedEvent.estimated.toString();
    document.getElementById('manualAudience').value = selectedEvent.audience.join(', ');
    document.getElementById('manualUrl').value = selectedEvent.url;
    document.getElementById('manualNotes').value = selectedEvent.notes || '';
    
    showManualForm();
    
    const submitBtn = document.querySelector('.manual-form .submit');
    submitBtn.textContent = 'Update Event';
    submitBtn.onclick = () => updateEvent();
}

function updateEvent() {
    const index = events.findIndex(e => e.id === selectedEvent.id);
    if (index === -1) return;
    
    events[index] = {
        ...selectedEvent,
        name: document.getElementById('manualName').value,
        startDate: document.getElementById('manualStartDate').value,
        endDate: document.getElementById('manualEndDate').value,
        location: document.getElementById('manualLocation').value,
        region: document.getElementById('manualRegion').value,
        attendance: parseInt(document.getElementById('manualAttendance').value),
        category: document.getElementById('manualType').value,
        tier: parseInt(document.getElementById('manualTier').value),
        estimated: document.getElementById('manualEstimated').value === 'true',
        audience: document.getElementById('manualAudience').value.split(',').map(s => s.trim()),
        url: document.getElementById('manualUrl').value,
        notes: document.getElementById('manualNotes').value
    };
    
    hideManualForm();
    renderCalendar();
    alert('✓ Event updated successfully!');
    
    const submitBtn = document.querySelector('.manual-form .submit');
    submitBtn.textContent = 'Add Event';
    submitBtn.onclick = () => addManualEvent();
}

function deleteEvent() {
    if (!selectedEvent) return;
    
    if (confirm(`Are you sure you want to delete "${selectedEvent.name}"?`)) {
        const index = events.findIndex(e => e.id === selectedEvent.id);
        if (index !== -1) {
            events.splice(index, 1);
        }
        closeModal();
        renderCalendar();
        alert('✓ Event deleted successfully!');
    }
}

function showManualForm() {
    document.getElementById('manualForm').classList.add('active');
}

function hideManualForm() {
    document.getElementById('manualForm').classList.remove('active');
    const form = document.getElementById('manualForm');
    form.querySelectorAll('input, textarea').forEach(el => el.value = '');
    
    const submitBtn = document.querySelector('.manual-form .submit');
    submitBtn.textContent = 'Add Event';
    submitBtn.onclick = () => addManualEvent();
}

async function scrapeEvent() {
    const url = document.getElementById('eventUrl').value;
    if (!url) {
        alert('Please enter an event URL');
        return;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Scraping...';

    setTimeout(() => {
        alert('Auto-scrape not available in demo mode. Please use manual entry.');
        showManualForm();
        document.getElementById('manualUrl').value = url;
        btn.disabled = false;
        btn.textContent = 'Add Event';
    }, 1000);
}

function addManualEvent() {
    const name = document.getElementById('manualName').value;
    const startDate = document.getElementById('manualStartDate').value;
    const endDate = document.getElementById('manualEndDate').value;
    const location = document.getElementById('manualLocation').value;
    const region = document.getElementById('manualRegion').value;
    const attendance = parseInt(document.getElementById('manualAttendance').value);
    const category = document.getElementById('manualType').value;
    const tier = parseInt(document.getElementById('manualTier').value);
    const estimated = document.getElementById('manualEstimated').value === 'true';
    const audience = document.getElementById('manualAudience').value.split(',').map(s => s.trim());
    const url = document.getElementById('manualUrl').value;
    const notes = document.getElementById('manualNotes').value;

    if (!name || !startDate || !endDate || !location || !attendance || !url) {
        alert('Please fill in all required fields');
        return;
    }

    const duplicate = events.find(e => 
        e.name.toLowerCase() === name.toLowerCase() && 
        e.startDate === startDate
    );

    if (duplicate) {
        if (!confirm('An event with this name and date already exists. Add anyway?')) {
            return;
        }
    }

    const newEvent = {
        id: Math.max(...events.map(e => e.id)) + 1,
        name,
        startDate,
        endDate,
        location,
        region,
        attendance,
        category,
        tier,
        estimated,
        audience,
        url,
        notes
    };

    events.push(newEvent);
    hideManualForm();
    renderCalendar();
    
    document.getElementById('eventUrl').value = '';
    
    alert('✓ Event added successfully!');
}

renderCalendar();

document.getElementById('eventModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});
