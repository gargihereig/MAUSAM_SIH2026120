(function () {
    'use strict';

    // Add your real OpenWeather API key here before running the app.
    // Safe option for a plain HTML/JS project: set window.OPENWEATHER_API_KEY = 'YOUR_KEY';
    // before weather.js loads, or replace the placeholder below.
    const DEFAULT_API_KEY = 'PASTE_YOUR_OPENWEATHER_API_KEY_HERE';
    const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
    const OPENWEATHER_GEO_URL = 'https://api.openweathermap.org/geo/1.0';

    function getApiKey() {
        const configuredKey = (window.OPENWEATHER_API_KEY || DEFAULT_API_KEY || '').trim();
        if (!configuredKey || configuredKey === 'PASTE_YOUR_OPENWEATHER_API_KEY_HERE') {
            return null;
        }
        return configuredKey;
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function formatWeatherLabel(value) {
        if (!value) return 'Unavailable';
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function toTitleCase(value) {
        if (!value) return 'Unavailable';
        return value
            .split(' ')
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function getAqiLabel(aqiIndex) {
        const mapping = {
            1: 'Good',
            2: 'Fair',
            3: 'Moderate',
            4: 'Poor',
            5: 'Very Poor'
        };
        return mapping[aqiIndex] || 'Unavailable';
    }

    function getWeatherIconClass(iconCode) {
        if (!iconCode) return 'fa-cloud-sun';

        if (iconCode.includes('01')) return 'fa-sun';
        if (iconCode.includes('02')) return 'fa-cloud-sun';
        if (iconCode.includes('03')) return 'fa-cloud';
        if (iconCode.includes('04')) return 'fa-cloud';
        if (iconCode.includes('09')) return 'fa-cloud-showers-heavy';
        if (iconCode.includes('10')) return 'fa-cloud-rain';
        if (iconCode.includes('11')) return 'fa-bolt';
        if (iconCode.includes('13')) return 'fa-snowflake';
        if (iconCode.includes('50')) return 'fa-smog';

        return 'fa-cloud-sun';
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            let errorMessage = 'OpenWeather API request failed';
            try {
                const payload = await response.json();
                errorMessage = payload && payload.message ? payload.message : errorMessage;
            } catch (error) {
                console.error('[weather] error response could not be parsed', { url, status: response.status });
            }
            throw new Error(errorMessage);
        }
        return response.json();
    }

    async function reverseGeocode(lat, lon) {
        const key = getApiKey();
        if (!key) {
            return { cityName: 'Your location' };
        }

        try {
            const payload = await fetchJson(
                `${OPENWEATHER_GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`
            );

            const result = (payload && payload.length && payload[0]) || null;
            if (!result) {
                return { cityName: 'Your location' };
            }

            const city = result.name || 'Your location';
            const region = result.state || result.country || '';
            const cityName = region ? `${city}, ${region}` : city;
            return { cityName };
        } catch (error) {
            console.error('[weather] reverse geocoding failed', {
                message: error && error.message
            });
            return { cityName: 'Your location' };
        }
    }

    async function searchCity(cityName) {
        const key = getApiKey();
        if (!key) {
            return null;
        }

        try {
            const payload = await fetchJson(
                `${OPENWEATHER_GEO_URL}/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${key}`
            );

            const result = (payload && payload.length && payload[0]) || null;
            if (!result) {
                return null;
            }

            return {
                cityName: result.state ? `${result.name}, ${result.state}` : result.name,
                latitude: result.lat,
                longitude: result.lon
            };
        } catch (error) {
            console.error('[weather] city search failed', {
                message: error && error.message
            });
            return null;
        }
    }

    async function fetchWeatherData({ lat, lon, cityName }) {
        const apiKey = getApiKey();
        const apiRequestsAvailable = window.location.protocol === 'http:' || window.location.protocol === 'https:';

        const fallback = {
            locationLabel: cityName || 'Your location',
            temperatureC: null,
            feelsLikeC: null,
            humidity: null,
            weatherCondition: 'Unavailable',
            precipitation: null,
            windSpeedKmh: null,
            sunrise: null,
            sunset: null,
            rainProbability: null,
            bestRunningHours: null,
            heatAlert: null,
            stormAlert: null,
            fogAlert: null,
            severeWeatherAlert: null,
            alertMessage: null,
            visibility: null,
            aqi: null,
            aqiLabel: 'Unavailable',
            pm25: null,
            pm10: null,
            iconClass: 'fa-cloud-sun',
            error: apiKey ? 'OpenWeather request failed' : 'Missing API key'
        };

        if (!apiKey && !apiRequestsAvailable) {
            console.error('[weather] missing browser OpenWeather API key for file-based loading');
            return fallback;
        }

        try {
            const currentWeatherUrl = apiRequestsAvailable
                ? `/api/weather?lat=${lat}&lon=${lon}`
                : `${OPENWEATHER_BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            const requestWithLogging = (url, label) => fetchJson(url).catch(error => {
                console.error(`[weather] ${label} request failed`, {
                    url,
                    message: error && error.message
                });
                return null;
            });
            const [currentWeather, airData, insights] = await Promise.all([
                requestWithLogging(currentWeatherUrl, 'current weather'),
                apiRequestsAvailable
                    ? requestWithLogging(`/api/air-quality?lat=${lat}&lon=${lon}`, 'air quality')
                    : Promise.resolve(null),
                apiRequestsAvailable
                    ? requestWithLogging(`/api/weather-insights?lat=${lat}&lon=${lon}`, 'weather insights')
                    : Promise.resolve(null)
            ]);

            const normalizedCurrentWeather = currentWeather && Object.prototype.hasOwnProperty.call(currentWeather, 'temperatureC');
            const weatherMain = !normalizedCurrentWeather && currentWeather && currentWeather.main ? currentWeather.main : {};
            const weatherInfo = !normalizedCurrentWeather && currentWeather && currentWeather.weather && currentWeather.weather[0] ? currentWeather.weather[0] : {};
            const rainInfo = !normalizedCurrentWeather && currentWeather && currentWeather.rain ? currentWeather.rain : {};
            const snowInfo = !normalizedCurrentWeather && currentWeather && currentWeather.snow ? currentWeather.snow : {};
            const airQuality = airData || {};
            const windSpeedKmh = normalizedCurrentWeather
                ? currentWeather.windSpeedKmh
                : currentWeather && currentWeather.wind && isFiniteNumber(currentWeather.wind.speed)
                ? Math.round(currentWeather.wind.speed * 3.6)
                : null;

            const precipitationValue = normalizedCurrentWeather
                ? currentWeather.precipitation
                : currentWeather
                    ? isFiniteNumber(rainInfo['1h']) ? rainInfo['1h'] :
                        isFiniteNumber(rainInfo['3h']) ? rainInfo['3h'] :
                        isFiniteNumber(snowInfo['1h']) ? snowInfo['1h'] :
                        isFiniteNumber(snowInfo['3h']) ? snowInfo['3h'] : 0
                    : null;

            const aqiValue = isFiniteNumber(airQuality.aqi) ? airQuality.aqi : null;

            const weatherCondition = normalizedCurrentWeather
                ? currentWeather.weatherCondition
                : weatherInfo.description ? toTitleCase(weatherInfo.description) : 'Unavailable';
            const iconClass = normalizedCurrentWeather ? currentWeather.iconClass : getWeatherIconClass(weatherInfo.icon || '');

            return {
                locationLabel: normalizedCurrentWeather ? (currentWeather.locationLabel || cityName || 'Your location') : cityName || 'Your location',
                temperatureC: normalizedCurrentWeather ? currentWeather.temperatureC : isFiniteNumber(weatherMain.temp) ? weatherMain.temp : null,
                feelsLikeC: normalizedCurrentWeather ? currentWeather.feelsLikeC : isFiniteNumber(weatherMain.feels_like) ? weatherMain.feels_like : null,
                humidity: normalizedCurrentWeather ? currentWeather.humidity : isFiniteNumber(weatherMain.humidity) ? weatherMain.humidity : null,
                weatherCondition,
                precipitation: precipitationValue,
                windSpeedKmh,
                sunrise: insights && insights.sunrise || null,
                sunset: insights && insights.sunset || null,
                rainProbability: insights && insights.rainProbability,
                bestRunningHours: insights && insights.bestRunningHours,
                heatAlert: insights && insights.heatAlert,
                stormAlert: insights && insights.stormAlert,
                fogAlert: insights && insights.fogAlert,
                severeWeatherAlert: insights && insights.severeWeatherAlert,
                alertMessage: insights && insights.alertMessage,
                visibility: insights && insights.visibility !== null && insights.visibility !== undefined
                    ? insights.visibility
                    : normalizedCurrentWeather ? currentWeather.visibility : null,
                aqi: aqiValue,
                aqiLabel: aqiValue ? (airQuality.aqiLabel || getAqiLabel(aqiValue)) : 'Unavailable',
                pm25: isFiniteNumber(airQuality.pm25) ? airQuality.pm25 : null,
                pm10: isFiniteNumber(airQuality.pm10) ? airQuality.pm10 : null,
                iconClass,
                error: null
            };
        } catch (error) {
            console.error('[weather] weather data assembly failed', {
                message: error && error.message,
                stack: error && error.stack
            });
            return {
                ...fallback,
                error: error && error.message ? error.message : 'OpenWeather request failed'
            };
        }
    }

    window.MausamWeather = {
        getApiKey,
        searchCity,
        getLocationFromCoordinates: reverseGeocode,
        fetchWeatherData
    };
})();
