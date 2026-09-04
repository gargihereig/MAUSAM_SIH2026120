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

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function toTitleCase(value) {
    return value
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getWeatherIconClass(iconCode) {
    if (!iconCode) return 'fa-cloud-sun';
    if (iconCode.includes('01')) return 'fa-sun';
    if (iconCode.includes('02')) return 'fa-cloud-sun';
    if (iconCode.includes('03') || iconCode.includes('04')) return 'fa-cloud';
    if (iconCode.includes('09')) return 'fa-cloud-showers-heavy';
    if (iconCode.includes('10')) return 'fa-cloud-rain';
    if (iconCode.includes('11')) return 'fa-bolt';
    if (iconCode.includes('13')) return 'fa-snowflake';
    if (iconCode.includes('50')) return 'fa-smog';
    return 'fa-cloud-sun';
}

module.exports = async function weather(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const coordinates = getCoordinates(req);
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!coordinates) return sendJson(res, 400, { error: 'Valid latitude and longitude are required' });
    if (!apiKey) {
        console.error('[weather] missing OPENWEATHER_API_KEY');
        return sendJson(res, 503, { error: 'Weather service is not configured' });
    }

    try {
        const upstreamUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coordinates.lat}&lon=${coordinates.lon}&units=metric&appid=${apiKey}`;
        const response = await fetch(upstreamUrl);
        if (!response.ok) {
            const body = await response.text();
            console.error('[weather] upstream request failed', {
                status: response.status,
                statusText: response.statusText,
                body: body.slice(0, 500)
            });
            return sendJson(res, 502, { error: 'Weather service failed' });
        }

        const payload = await response.json();
        const weatherMain = payload.main || {};
        const weatherInfo = payload.weather && payload.weather[0] ? payload.weather[0] : {};
        const rainInfo = payload.rain || {};
        const snowInfo = payload.snow || {};
        const precipitation = isFiniteNumber(rainInfo['1h']) ? rainInfo['1h'] :
            isFiniteNumber(rainInfo['3h']) ? rainInfo['3h'] :
            isFiniteNumber(snowInfo['1h']) ? snowInfo['1h'] :
            isFiniteNumber(snowInfo['3h']) ? snowInfo['3h'] : 0;

        return sendJson(res, 200, {
            locationLabel: payload.name || 'Your location',
            temperatureC: isFiniteNumber(weatherMain.temp) ? weatherMain.temp : null,
            feelsLikeC: isFiniteNumber(weatherMain.feels_like) ? weatherMain.feels_like : null,
            humidity: isFiniteNumber(weatherMain.humidity) ? weatherMain.humidity : null,
            weatherCondition: weatherInfo.description ? toTitleCase(weatherInfo.description) : null,
            precipitation,
            windSpeedKmh: payload.wind && isFiniteNumber(payload.wind.speed) ? Math.round(payload.wind.speed * 3.6) : null,
            visibility: isFiniteNumber(payload.visibility) ? payload.visibility : null,
            iconClass: getWeatherIconClass(weatherInfo.icon || '')
        });
    } catch (error) {
        console.error('[weather] request failed', {
            name: error && error.name,
            code: error && error.code,
            message: error && error.message
        });
        return sendJson(res, 502, { error: 'Weather service failed' });
    }
};
