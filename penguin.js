(function () {
    'use strict';

    const notifyStyleId = 'mausam-notify-style';
    const notifyRootId = 'mausam-notify-popup';
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
                position: fixed;
                right: 24px;
                bottom: 24px;
                z-index: 99990;
                width: min(360px, calc(100vw - 32px));
                color: #2e1065;
                font-family: 'Plus Jakarta Sans', sans-serif;
                animation: mausam-notify-enter 0.45s ease-out both;
            }
            .mausam-notify-card {
                position: relative;
                overflow: hidden;
                padding: 20px;
                border: 1px solid rgba(109, 40, 217, 0.18);
                border-radius: 22px;
                background: rgba(255, 255, 255, 0.97);
                box-shadow: 0 18px 45px rgba(46, 16, 101, 0.24);
            }
            .mausam-notify-card::after {
                content: '';
                position: absolute;
                right: -35px;
                bottom: -50px;
                width: 130px;
                height: 130px;
                border-radius: 50%;
                background: rgba(216, 180, 254, 0.28);
                pointer-events: none;
            }
            .mausam-notify-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding-right: 28px;
            }
            .mausam-notify-penguin {
                display: grid;
                flex: 0 0 46px;
                place-items: center;
                width: 46px;
                height: 46px;
                border-radius: 15px;
                background: #6D28D9;
                color: #fff;
                font-size: 25px;
                box-shadow: 0 8px 18px rgba(109, 40, 217, 0.28);
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
                color: #2e1065;
                font-size: 17px;
                font-weight: 800;
            }
            .mausam-notify-close {
                position: absolute;
                top: 12px;
                right: 14px;
                width: 28px;
                height: 28px;
                border: 0;
                border-radius: 50%;
                background: transparent;
                color: #6D28D9;
                font-size: 22px;
                line-height: 1;
                cursor: pointer;
            }
            .mausam-notify-close:hover,
            .mausam-notify-close:focus-visible {
                background: #f3e8ff;
                outline: none;
            }
            .mausam-notify-condition {
                margin: 16px 0 12px;
                color: #4c1d95;
                font-size: 14px;
                font-weight: 700;
            }
            .mausam-notify-metrics {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                position: relative;
                z-index: 1;
            }
            .mausam-notify-metric {
                padding: 10px 11px;
                border: 1px solid #ede9fe;
                border-radius: 12px;
                background: #fafaff;
            }
            .mausam-notify-label {
                display: block;
                margin-bottom: 3px;
                color: #7c3aed;
                font-size: 9px;
                font-weight: 800;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .mausam-notify-value {
                display: block;
                color: #2e1065;
                font-size: 13px;
                font-weight: 800;
            }
            @keyframes mausam-notify-enter {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @media (max-width: 500px) {
                .mausam-notify-popup {
                    right: 16px;
                    bottom: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function createMetric(label, value) {
        const metric = document.createElement('div');
        metric.className = 'mausam-notify-metric';

        const labelElement = document.createElement('span');
        labelElement.className = 'mausam-notify-label';
        labelElement.textContent = label;

        const valueElement = document.createElement('span');
        valueElement.className = 'mausam-notify-value';
        valueElement.textContent = value;

        metric.append(labelElement, valueElement);
        return metric;
    }

    function showNotification(weatherData) {
        if (document.getElementById(notifyRootId)) return;

        const metrics = [];
        if (hasValue(weatherData.temperatureC)) metrics.push(['Temperature', `${Math.round(weatherData.temperatureC)}°C`]);
        if (hasValue(weatherData.feelsLikeC)) metrics.push(['Feels like', `${Math.round(weatherData.feelsLikeC)}°C`]);
        if (hasValue(weatherData.precipitation)) metrics.push(['Precipitation', `${Number(weatherData.precipitation).toFixed(1)} mm`]);
        if (hasValue(weatherData.aqi)) metrics.push(['Air quality', `${weatherData.aqiLabel || weatherData.aqi}`]);

        if (!hasValue(weatherData.weatherCondition) && metrics.length === 0) return false;

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
        header.innerHTML = '<div class="mausam-notify-penguin" aria-hidden="true">🐧</div><div><p class="mausam-notify-eyebrow">Mausam update</p><h2 class="mausam-notify-title">A little weather note</h2></div>';

        const condition = document.createElement('p');
        condition.className = 'mausam-notify-condition';
        condition.textContent = hasValue(weatherData.weatherCondition) ? weatherData.weatherCondition : 'Your latest conditions are ready.';

        const metricsContainer = document.createElement('div');
        metricsContainer.className = 'mausam-notify-metrics';
        metrics.forEach(([label, value]) => metricsContainer.appendChild(createMetric(label, value)));

        card.append(closeButton, header, condition, metricsContainer);
        root.appendChild(card);
        document.body.appendChild(root);
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
