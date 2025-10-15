import { useEffect } from 'react';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

export default function CalendarClient() {
  useEffect(() => {
    const el = document.getElementById('calendar');
    if (!el) return;

    fetch('/events/events.json')
      .then(res => res.json())
      .then(events => {
        const calendar = new Calendar(el, {
          plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
          initialView: window.matchMedia('(max-width: 768px)').matches ? 'listYear' : 'dayGridMonth',
          locale: 'fr',
          firstDay: 1,
          hiddenDays: [0],
          allDayText: 'All day',
          headerToolbar: {
            left: 'prev,dynamicTitle,next',
            center: '',
            right: 'today timeGridWeek,dayGridMonth,listYear subscribeButton google',
          },
          customButtons: {
            dynamicTitle: { text: '' },
            subscribeButton: {
              click: () => {
                window.location.href = 'webcal://hacklabesgi.netlify.app/calendar.ics';
              },
              hint: 'S’abonner au calendrier',
            },
            google: {
              click: () => {
                window.location.href = 'https://calendar.google.com/calendar/r?cid=webcal://hacklabesgi.netlify.app/calendar.ics';
              },
              hint: 'S’abonner au calendrier google',
            },
          },
          buttonText: {
            today: 'Today',
            month: 'Month',
            week: 'Week',
            list: 'Year',
          },
          views: {
            listYear: {
              type: 'list',
              duration: { years: 1 },
              buttonText: 'Année',
            },
          },
          events: events.map(ev => {
            const base = {
              title: ev.title,
              start: ev.start,
              extendedProps: {
                duration: ev.duration,
                location: ev.location,
                description: ev.description,
                speaker: ev.speaker,
              },
            };
          
            if (ev.url && ev.url.trim() !== '') {
              base.extendedProps.url = ev.url;
            }
          
            return base;
          }),
          eventDidMount(info) {
            const { location, description, url } = info.event.extendedProps;
            const startDate = new Date(info.event.start);
            const heure = startDate.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const timeEl = info.el.querySelector('.fc-event-time');
            if (timeEl) timeEl.remove();
            const dot = info.el.querySelector('.fc-daygrid-event-dot');
            if (dot) dot.remove();

            const content = info.el.querySelector('.fc-event-title');
            if (content) {
              content.innerHTML = `📌 ${heure}<br/>${info.event.title}`;
              content.style.whiteSpace = 'normal';
            }

            if (url) {
              info.el.style.cursor = 'pointer';
              info.el.addEventListener('click', () => window.open(url, '_blank'));
            }

            const tooltip = document.createElement('div');
            tooltip.className = 'fc-event-tooltip';
            tooltip.innerHTML = `
              <strong>${info.event.title}</strong><br/>
              🕒 ${heure}<br/>
              📍 ${location}<br/>
              📝 ${description || 'Aucune description'}<br/>
              ${info.event.extendedProps.speaker && info.event.extendedProps.speaker.trim() !== ''
                ? `👤 ${info.event.extendedProps.speaker}<br/>`
                : ''
              }
            `;
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);

            info.el.addEventListener('mouseenter', e => {
              tooltip.style.display = 'block';
              tooltip.style.left = e.pageX + 10 + 'px';
              tooltip.style.top = e.pageY + 10 + 'px';
            });

            info.el.addEventListener('mousemove', e => {
              tooltip.style.left = e.pageX + 10 + 'px';
              tooltip.style.top = e.pageY + 10 + 'px';
            });

            info.el.addEventListener('mouseleave', () => {
              tooltip.style.display = 'none';
            });

            
            const googleBtn = document.querySelector('.fc-google-button');
            if (googleBtn) {
              googleBtn.innerHTML = `<img src="/img/google.png" alt="Google Calendar" style="height: 1em; vertical-align: middle;">`;
            }
            const subscribeBtn = document.querySelector('.fc-subscribeButton-button');
            if (subscribeBtn) {
              subscribeBtn.innerHTML = `<img src="/img/calendar.png" alt="Calendar" style="height: 1em; vertical-align: middle;">`;
            }
          },
        });

        const updateDynamicTitle = () => {
          const currentDate = calendar.getDate();
          const viewType = calendar.view.type;
          const year = currentDate.getFullYear();
          const month = currentDate.toLocaleString('fr-FR', { month: 'long' });

          let title = '';
          if (viewType === 'dayGridMonth') {
            title = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
          } else if (viewType === 'timeGridWeek') {
            const tmp = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
            const dayNum = tmp.getUTCDay() || 7;
            tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
            const weekNumber = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
            title = `Week ${weekNumber} of ${year}`;
          } else if (viewType === 'listYear') {
            title = `${year}`;
          }

          const button = document.querySelector('.fc-dynamicTitle-button');
          if (button) button.textContent = title;
        };

        calendar.on('datesSet', (info) => {updateDynamicTitle()});

        calendar.render();
      });
  }, []);

  return null;
}
