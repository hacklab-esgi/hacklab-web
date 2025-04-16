import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

export async function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const response = await fetch('/events/events.json');
    const events = await response.json();

    const calendar = new Calendar(calendarEl, {
        plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
        initialView: 'dayGridMonth',
        locale: 'fr',
        firstDay: 1,
        hiddenDays: [0],
        allDayText: 'All day',
        headerToolbar: {
            left: 'prev,dynamicTitle,next',
            center: '',
            right: 'today timeGridWeek,dayGridMonth,listYear downloadButton'
        },
        customButtons: {
            dynamicTitle: {
              text: '',
            },
            downloadButton: {
                text: '📥',
                click: () => {
                    window.open('/calendar.ics', '_blank');
                },
                hint: 'Télécharger le calendrier (.ics)',
            }
        },
        buttonText: {
            today: "Today",
            month: "Month",
            week: "Week",
            list: "Year",
        },
        views: {
            listYear: {
                type: 'list',
                duration: { years: 1 },
                buttonText: 'Année'
            }
        },
        events: events.map(ev => ({
            title: ev.title,
            start: ev.start,
            extendedProps: {
                duration: ev.duration,
                location: ev.location,
                description: ev.description,
                url: ev.url
            }
        })),
        eventDidMount(info) {
            const { location, description, url } = info.event.extendedProps;
            const startDate = new Date(info.event.start);

            // Format l'heure depuis info.event.start (objet Date)
            const heure = startDate.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const timeEl = info.el.querySelector('.fc-event-time');
            if (timeEl) timeEl.remove();

            const dot = info.el.querySelector('.fc-daygrid-event-dot');
            if (dot) dot.remove();

            const content = info.el.querySelector('.fc-event-title');
            if (content) {
                content.innerHTML = `📌 ${heure}<br/>${info.event.title}`;
                content.style.whiteSpace = 'normal'; // Pour autoriser le retour à la ligne si nécessaire
            }

            if (url) {
                info.el.style.cursor = 'pointer';
                info.el.addEventListener('click', () => {
                    window.open(url, '_blank');
                });
            }

            const tooltip = document.createElement('div');
            tooltip.className = 'fc-event-tooltip';
            tooltip.innerHTML = `
                <strong>${info.event.title}</strong><br/>
                🕒 ${heure}<br/>
                📍 ${location}<br/>
                📝 ${description || 'Aucune description'}<br/>
            `;
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);

            info.el.addEventListener('mouseenter', (e) => {
                tooltip.style.display = 'block';
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
            });

            info.el.addEventListener('mousemove', (e) => {
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
            });

            info.el.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });

        }
    });

    // Fonction pour mettre à jour dynamiquement le bouton "titre"
    const updateDynamicTitle = () => {
        const currentDate = calendar.getDate();
        const viewType = calendar.view.type;
        const year = currentDate.getFullYear();
        const month = currentDate.toLocaleString('fr-FR', { month: 'long' });
        const week = calendar.view.currentStart.toLocaleDateString('fr-FR', { week: 'numeric' });
        let title = '';

        if (viewType === 'dayGridMonth') {
            title = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
        } else if (viewType === 'timeGridWeek') {
            const weekNumber = getWeekNumber(currentDate);
            title = `Week ${weekNumber} of ${year}`;
        } else if (viewType === 'listYear') {
            title = `${year}`;
        }

        const button = document.querySelector('.fc-dynamicTitle-button');
        if (button) button.textContent = title;
    };

    // Utilitaire pour obtenir le numéro de semaine ISO
    const getWeekNumber = (date) => {
        const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = tmp.getUTCDay() || 7;
        tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    };

    // Met à jour le titre à l'initialisation et au changement de vue
    calendar.on('datesSet', updateDynamicTitle);
    calendar.render();
}
