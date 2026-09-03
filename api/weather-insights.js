function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

function getCoordinates(req) {
    const url = new URL(req.url, 'http://localhost');
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
    }
    return { lat, lon };
}

function formatTime(timestamp, timezoneOffset) {
    if (!Number.isFinite(timestamp)) return null;
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: 'UTC'
    }).format(new Date((timestamp + timezoneOffset) * 1000));
}

function getRunningHours(sunrise, sunset, forecast, timezoneOffset) {
    const periods = forecast.filter(item => Number.isFinite(item.dt) && Number.isFinite(item.main && item.main.feels_like));
    const localMinutes = timestamp => ((timestamp + timezoneOffset) % 86400 + 86400) % 86400 / 60;
    const sunriseMinutes = localMinutes(sunrise);
    const sunsetMinutes = localMinutes(sunset);
    const daylight = periods.filter(item => {
        const minutes = localMinutes(item.dt);
        return minutes >= sunriseMinutes && minutes <= sunsetMinutes;
    });
    const comfortable = daylight.filter(item =>
        item.main.feels_like <= 28 &&
        (!item.wind || item.wind.speed < 8) &&
        !(item.weather || []).some(condition => condition.id >= 200 && condition.id < 600)
    );
    const morning = comfortable.find(item => {
        const minutes = localMinutes(item.dt);
        return minutes >= sunriseMinutes && minutes <= sunriseMinutes + 180;
    });
    const evening = comfortable.find(item => {
        const minutes = localMinutes(item.dt);
        return minutes >= sunsetMinutes - 180 && minutes <= sunsetMinutes;
    });
    if (morning) return `${formatTime(morning.dt, timezoneOffset)} - ${formatTime(morning.dt + 2 * 3600, timezoneOffset)}`;
    if (evening) return `${formatTime(evening.dt, timezoneOffset)} - ${formatTime(evening.dt + 2 * 3600, timezoneOffset)}`;
    const lowestRisk = daylight
        .map(item => ({
            item,
            risk: (Number(item.pop) || 0) * 10 + (item.wind && Number(item.wind.speed) || 0) + Math.max(0, item.main.feels_like - 28)
        }))
        .sort((first, second) => first.risk - second.risk)[0];
    return lowestRisk
        ? `${formatTime(lowestRisk.item.dt, timezoneOffset)} - ${formatTime(lowestRisk.item.dt + 2 * 3600, timezoneOffset)}`
        : 'Unavailable: no daylight forecast';
}

module.exports = async function weatherInsights(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const coordinates = getCoordinates(req);
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!coordinates) return sendJson(res, 400, { error: 'Valid latitude and longitude are required' });
    if (!apiKey) return sendJson(res, 503, { error: 'Weather service is not configured' });

    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${coordinates.lat}&lon=${coordinates.lon}&units=metric&appid=${apiKey}`);
        if (!response.ok) return sendJson(res, 502, { error: 'Forecast service failed' });
        const payload = await response.json();
        const forecast = Array.isArray(payload.list) ? payload.list : [];
        const city = payload.city || {};
        const nextDay = forecast.slice(0, 8);
        const rainProbability = nextDay.length ? Math.round(Math.max(...nextDay.map(item => Number(item.pop) || 0)) * 100) : null;
        const conditions = nextDay.flatMap(item => Array.isArray(item.weather) ? item.weather : []);
        const stormAlert = conditions.some(condition => condition.id >= 200 && condition.id < 300);
        const fogAlert = conditions.some(condition => condition.id >= 700 && condition.id < 800) || nextDay.some(item => Number.isFinite(item.visibility) && item.visibility < 1000);
        const severeWeatherAlert = stormAlert || conditions.some(condition => condition.id >= 502 && condition.id < 600);
        const temperatures = nextDay.map(item => Number(item.main && item.main.feels_like)).filter(Number.isFinite);
        const maxFeelsLike = temperatures.length ? Math.max(...temperatures) : null;
        const heatAlert = maxFeelsLike === null ? null : maxFeelsLike >= 35 ? 'Heat Alert' : maxFeelsLike >= 30 ? 'Warm' : 'Normal';
        const visibilityValues = nextDay.map(item => item.visibility).filter(Number.isFinite);
        return sendJson(res, 200, {
            rainProbability,
            sunrise: formatTime(city.sunrise, city.timezone || 0),
            sunset: formatTime(city.sunset, city.timezone || 0),
            bestRunningHours: Number.isFinite(city.sunrise) && Number.isFinite(city.sunset)
                ? getRunningHours(city.sunrise, city.sunset, forecast, city.timezone || 0)
                : null,
            heatAlert,
            stormAlert,
            fogAlert,
            severeWeatherAlert,
            alertMessage: severeWeatherAlert ? 'Severe weather detected.' : 'No severe weather detected.',
            visibility: visibilityValues.length ? Math.min(...visibilityValues) : null
        });
    } catch (error) {
        console.error('[weather-insights] request failed', { code: error && error.code, message: error && error.message });
        return sendJson(res, 502, { error: 'Forecast service failed' });
    }
};
