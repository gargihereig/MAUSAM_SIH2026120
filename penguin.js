(function () {
    'use strict';

    const notifyStyleId = 'mausam-notify-style';
    const notifyRootId = 'mausam-notify-popup';
    const notifySlotId = 'mausam-notify-slot';
    const retryDelay = 500;
    const maxRetries = 60;

    function hasValue(value) {
        return value !== null && value !== undefined && value !== '' && value !== 'Unavailable';
    }

    function addScopedStyles() {
        if (document.getElementById(notifyStyleId)) return;

        const style = document.createElement('style');
        style.id = notifyStyleId;
        style.textContent = `
            .mausam-notify-popup {
                width: 100%;
                color: #f5f3ff;
                font-family: 'Plus Jakarta Sans', sans-serif;
                animation: mausam-notify-enter 0.45s ease-out both;
            }
            .mausam-notify-card {
                position: relative;
                overflow: hidden;
                padding: 16px;
                border: 1px solid rgba(196, 181, 253, 0.3);
                border-radius: 24px;
                background: linear-gradient(145deg, rgba(76, 29, 149, 0.94), rgba(30, 27, 75, 0.96));
                box-shadow: 0 16px 34px rgba(46, 16, 101, 0.34), 0 0 22px rgba(109, 40, 217, 0.2);
            }
            .mausam-notify-card::after {
                content: '';
                position: absolute;
                right: -35px;
                bottom: -50px;
                width: 130px;
                height: 130px;
                border-radius: 50%;
                background: rgba(167, 139, 250, 0.16);
                pointer-events: none;
            }
            .mausam-notify-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding-right: 24px;
            }
            .mausam-notify-penguin {
                display: grid;
                flex: 0 0 38px;
                place-items: center;
                width: 38px;
                height: 38px;
                border-radius: 12px;
                background: #6D28D9;
                color: #fff;
                font-size: 20px;
                box-shadow: 0 6px 14px rgba(109, 40, 217, 0.34);
            }
            .mausam-notify-eyebrow {
                margin: 0 0 3px;
                color: #6D28D9;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.18em;
                text-transform: uppercase;
            }
            .mausam-notify-title {
                margin: 0;
                color: #fff;
                font-size: 14px;
                font-weight: 800;
            }
            .mausam-notify-close {
                position: absolute;
                top: 10px;
                right: 10px;
                width: 24px;
                height: 24px;
                border: 0;
                border-radius: 50%;
                background: transparent;
                color: #ddd6fe;
                font-size: 19px;
                line-height: 1;
                cursor: pointer;
            }
            .mausam-notify-close:hover,
            .mausam-notify-close:focus-visible {
                background: rgba(216, 180, 254, 0.2);
                outline: none;
            }
            .mausam-notify-items {
                display: grid;
                gap: 9px;
                position: relative;
                z-index: 1;
                margin-top: 14px;
            }
            .mausam-notify-item {
                display: flex;
                align-items: flex-start;
                gap: 9px;
                min-width: 0;
                padding: 8px 9px;
                border: 1px solid rgba(196, 181, 253, 0.18);
                border-radius: 13px;
                background: rgba(46, 16, 101, 0.4);
            }
            .mausam-notify-item-icon {
                flex: 0 0 20px;
                font-size: 17px;
                line-height: 1.2;
            }
            .mausam-notify-item-text {
                min-width: 0;
            }
            .mausam-notify-item-title,
            .mausam-notify-item-subtitle {
                display: block;
                margin: 0;
                color: #fff;
                font-size: 12px;
                font-weight: 800;
            }
            .mausam-notify-item-subtitle {
                margin-top: 2px;
                color: #ddd6fe;
                font-size: 10px;
                font-weight: 600;
            }
            .mausam-notify-item-title:only-child {
                display: block;
            }
            @keyframes mausam-notify-enter {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    function createItem(icon, title, subtitle) {
        const item = document.createElement('div');
        item.className = 'mausam-notify-item';

        const iconElement = document.createElement('span');
        iconElement.className = 'mausam-notify-item-icon';
        iconElement.textContent = icon;

        const text = document.createElement('div');
        text.className = 'mausam-notify-item-text';

        const titleElement = document.createElement('p');
        titleElement.className = 'mausam-notify-item-title';
        titleElement.textContent = title;
        text.appendChild(titleElement);

        if (subtitle) {
            const subtitleElement = document.createElement('p');
            subtitleElement.className = 'mausam-notify-item-subtitle';
            subtitleElement.textContent = subtitle;
            text.appendChild(subtitleElement);
        }

        item.append(iconElement, text);
        return item;
    }

    function showNotification(weatherData) {
        if (document.getElementById(notifyRootId)) return;

        if (!weatherData || !hasValue(weatherData.temperatureC) && !hasValue(weatherData.weatherCondition)) return false;

        addScopedStyles();

        const root = document.createElement('aside');
        root.id = notifyRootId;
        root.className = 'mausam-notify-popup';
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');

        const card = document.createElement('div');
        card.className = 'mausam-notify-card';

        const closeButton = document.createElement('button');
        closeButton.className = 'mausam-notify-close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Close weather notification');
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => root.remove());

        const header = document.createElement('div');
        header.className = 'mausam-notify-header';
        header.innerHTML = '<div class="mausam-notify-penguin" aria-hidden="true">🐧</div><div><p class="mausam-notify-eyebrow">MAUSAM PENGUIN</p><h2 class="mausam-notify-title">Your Weather Buddy</h2><p class="mausam-notify-eyebrow">🟢 ONLINE</p></div>';

        const items = document.createElement('div');
        items.className = 'mausam-notify-items';
        const temperature = Number(weatherData.temperatureC);
        const hotMessage = Number.isFinite(temperature) && temperature >= 30 ? "It's hot 🥵" : 'Weather check is comfortable';
        const rainTime = hasValue(weatherData.rainTime) ? weatherData.rainTime : hasValue(weatherData.rainExpectedAt) ? weatherData.rainExpectedAt : null;
        const rainMessage = rainTime ? `Expecting rain at ${rainTime}` : hasValue(weatherData.rainProbability) && Number(weatherData.rainProbability) > 0 ? 'Expecting rain' : 'No rain currently indicated';
        const rainSubtitle = rainTime || (hasValue(weatherData.rainProbability) && Number(weatherData.rainProbability) > 0) ? 'Carry umbrella' : 'No umbrella needed';
        const alertMessage = hasValue(weatherData.alertMessage) ? weatherData.alertMessage : weatherData.severeWeatherAlert === true ? 'Severe weather alert active' : 'No alerts';
        items.append(
            createItem('☀️', hotMessage, ''),
            createItem('☔️', rainMessage, rainSubtitle),
            createItem('🔔', 'Alerts', alertMessage)
        );

        card.append(closeButton, header, items);
        const slot = document.getElementById(notifySlotId);
        if (!slot) return false;
        root.appendChild(card);
        slot.appendChild(root);
        return true;
    }

    function tryShowNotification(attempt) {
        const weatherData = window.mausamWeatherData;
        if (weatherData && showNotification(weatherData)) return;
        if (attempt < maxRetries) {
            window.setTimeout(() => tryShowNotification(attempt + 1), retryDelay);
        }
    }

    function init() {
        window.setTimeout(() => tryShowNotification(0), 4500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
